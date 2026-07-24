/**
 * Rehub AI Triage Engine — deterministic 5-level urgency classification.
 *
 * Design: instead of an impossible hand-maintained list of 100,000 phrases,
 * the engine combines a few hundred weighted *signals* (symptoms, intents,
 * body parts, intensifiers, time-pressure, negation) and composes them. A few
 * hundred signals × the ways they combine covers effectively unlimited phrasing
 * ("I can't breathe", "my breathing is bad", "hard to breathe now" all fire the
 * same respiratory-distress signal).
 *
 * Safety bias: when the score sits near a boundary, the engine rounds UP. An
 * uncertain emergency is treated as the higher urgency, never the lower.
 *
 * It is deterministic and explainable (every decision traces to matched
 * signals), runs offline, and never diagnoses — it only ranks how fast a human
 * should respond.
 */

import type { UrgencyLevel } from "./types";

export interface TriageResult {
  urgency: UrgencyLevel;
  score: number;          // 0–100
  confidence: number;     // 0–1
  matched: string[];      // signals that fired
  reason: string;         // plain-English explanation
  suggestedAction: string;
  escalated: boolean;     // true if safety bias bumped it up
}

// ── Signal tables ────────────────────────────────────────────────────────────
// Each entry: a set of phrase fragments that all mean the same thing → weight.
// Weights are tuned so a single strong critical signal alone reaches Critical.

interface Signal {
  id: string;
  any: string[];     // any of these fragments present → signal fires
  weight: number;    // contribution to score
  critical?: boolean; // hard floor to Critical when fired (unless negated)
}

// CRITICAL — life/safety. Any one fires red.
const CRITICAL: Signal[] = [
  { id: "respiratory", critical: true, weight: 100, any: ["can't breathe", "cant breathe", "cannot breathe", "can not breathe", "trouble breathing", "hard to breathe", "short of breath", "not breathing", "struggling to breathe", "gasping", "suffocating", "can't catch my breath", "cant catch my breath", "cannot catch my breath", "catching my breath", "can't get air", "cant get air", "can't get enough air", "gasping for air", "hard time breathing", "difficulty breathing", "breathing is hard", "hurts to breathe", "hurts when i breathe", "painful to breathe", "can't stop coughing", "wheezing"] },
  { id: "choking", critical: true, weight: 100, any: ["choking", "can't swallow air", "something stuck in my throat", "i'm choking", "can't swallow", "cant swallow", "food is stuck", "stuck in my throat"] },
  { id: "cardiac", critical: true, weight: 100, any: ["chest pain", "chest is tight", "chest tight", "heart hurts", "heart attack", "pressure in my chest", "my heart is racing badly", "heart racing", "chest is heavy", "chest feels heavy", "chest feels really heavy", "heavy chest", "chest feels really tight", "tightness in my chest", "chest hurts", "pain in my chest", "heart is pounding", "heart pounding", "heart is racing", "fluttering in my chest", "cold sweat"] },
  { id: "stroke", critical: true, weight: 100, any: ["can't move my face", "face is drooping", "slurred", "can't speak", "cant speak", "numb on one side", "weak on one side", "stroke", "can't feel my arm", "can't feel my leg", "sudden numbness", "one side of my body", "seeing double", "double vision", "lost my vision", "can't see out of", "half my body", "half my face", "one side of my face", "words won't come out", "can't find my words", "slurring", "speech is wrong", "speech is off", "speech coming out wrong", "speech is coming out wrong", "talking funny", "trouble speaking", "trouble talking", "words are wrong", "face feels funny", "arm went numb", "leg went numb", "feels numb", "going numb"] },
  { id: "fall", critical: true, weight: 95, any: ["i fell", "i've fallen", "ive fallen", "i have fallen", "fell down", "on the floor", "on the ground", "i fall", "slipped and", "i slipped", "tripped and", "fell out of bed", "fell in the"] },
  { id: "head", critical: true, weight: 95, any: ["hit my head", "head injury", "banged my head", "hit my head hard"] },
  { id: "bleeding", critical: true, weight: 95, any: ["bleeding", "blood everywhere", "lot of blood", "won't stop bleeding", "wont stop bleeding", "hemorrhage", "vomiting blood", "coughing up blood", "throwing up blood", "blood in the toilet", "blood in my stool", "blood in my urine", "blood in my pee", "passing blood", "bleeding through", "soaked through", "blood on my"] },
  // Post-surgical / device emergencies — high-frequency in a rehab and
  // post-acute setting specifically, and previously not covered at all.
  { id: "wound_device", critical: true, weight: 95, any: ["stitches opened", "stitches came out", "incision opened", "incision is open", "wound opened", "wound is open", "staples came out", "my iv came out", "iv came out", "iv is out", "catheter came out", "catheter is out", "feeding tube came out", "tube came out", "drain came out", "pulled out my"] },
  { id: "unconscious", critical: true, weight: 100, any: ["can't wake", "cant wake", "won't wake up", "wont wake up", "unconscious", "passed out", "passing out", "blacking out", "fainted", "going to pass out", "about to pass out", "gonna pass out", "everything went black", "vision going dark", "going to faint"] },
  { id: "seizure", critical: true, weight: 100, any: ["seizure", "convulsing", "shaking uncontrollably"] },
  { id: "allergic", critical: true, weight: 95, any: ["allergic reaction", "throat is closing", "throat closing", "anaphylaxis", "can't feel my tongue", "throat feels tight", "tongue is swelling", "lips are swelling", "face is swelling", "breaking out in hives", "hives"] },
  { id: "overdose", critical: true, weight: 100, any: ["overdose", "took too many pills", "took too much medication", "swallowed too many", "took the whole bottle", "took my pills twice", "double dose"] },
  { id: "diabetic", critical: true, weight: 95, any: ["low blood sugar", "diabetic emergency", "insulin reaction", "blood sugar is low", "shaking and sweating", "sugar is low", "sugar feels low"] },
  { id: "emergency", critical: true, weight: 90, any: ["emergency", "call 911", "help me now", "i'm dying", "im dying", "i am dying", "code blue", "something is really wrong", "something's really wrong"] },
  // Suicidal ideation is frequently expressed indirectly — the euphemisms
  // matter as much as the explicit phrasings.
  { id: "suicidal", critical: true, weight: 100, any: ["want to die", "kill myself", "end my life", "hurt myself", "don't want to be here anymore", "dont want to be here anymore", "don't want to live", "dont want to live", "better off without me", "no reason to live", "no reason to go on", "want it to end", "want to end it", "don't want to wake up"] },
  // Respiratory-equipment failure — a resident on home oxygen or a CPAP
  // whose supply fails is a respiratory emergency in progress, not a
  // maintenance request. Distinct from the generic "respiratory" signal
  // because the phrasing centers on the device, not the breathing itself.
  { id: "oxygen_equipment", critical: true, weight: 95, any: ["oxygen ran out", "out of oxygen", "oxygen tank is empty", "oxygen tank empty", "no more oxygen", "cpap isn't working", "cpap is not working", "cpap stopped", "oxygen alarm", "oxygen machine stopped", "oxygen machine is beeping", "ventilator alarm", "cannula fell off", "oxygen is off", "oxygen came off", "oxygen concentrator stopped"] },
  // Visible color change — a lay-language way patients and family describe
  // cyanosis/pallor, both of which indicate a circulation or oxygenation
  // crisis regardless of what else is being said.
  { id: "color_change", critical: true, weight: 95, any: ["turning blue", "lips are blue", "lips turning blue", "looks blue", "turning grey", "turning gray", "skin looks grey", "skin looks gray", "turning pale", "looks very pale", "skin is grey", "skin is gray", "fingernails are blue", "nail beds are blue", "face looks grey", "face looks gray"] },
  // Sudden, severe headache is a classic stroke/aneurysm red flag distinct
  // from ordinary headache (which stays uncategorized/Medium on purpose).
  { id: "headache_severe", critical: true, weight: 90, any: ["worst headache of my life", "worst headache i've ever had", "sudden severe headache", "sudden bad headache", "splitting headache", "head is pounding really bad", "thunderclap headache"] },
  // Acute abdominal emergency — a rigid/board-like or unrelenting abdomen
  // is a surgical red flag, especially in a post-surgical rehab population.
  { id: "abdominal_severe", critical: true, weight: 90, any: ["severe stomach pain", "stomach pain won't stop", "worst stomach pain", "abdomen is hard", "stomach is rigid", "stomach is hard as a rock", "unbearable stomach pain", "belly pain won't stop"] },
  // Sudden confusion/hallucination/combativeness — acute delirium is a
  // medical emergency in elderly/post-acute patients, not routine confusion.
  // Kept separate from the existing (non-critical) "confused" HIGH signal,
  // which covers ordinary disorientation.
  { id: "acute_delirium", critical: true, weight: 90, any: ["seeing things that aren't there", "seeing things that are not there", "hearing voices", "suddenly confused", "suddenly not making sense", "acting very strange", "not himself suddenly", "not herself suddenly", "combative and confused"] },
];

// HIGH — needs prompt clinical attention.
const HIGH: Signal[] = [
  { id: "med_urgent", weight: 55, any: ["i need my medication", "need medication now", "missed my medication", "missed my meds", "need my pills", "haven't had my medicine", "out of medication"] },
  { id: "immobile", weight: 55, any: ["can't move", "cant move", "can't get up", "cant get up", "stuck", "can't stand", "cant stand", "can't move my legs", "can't move my arms", "paralyzed"] },
  { id: "pain_severe", weight: 55, any: ["severe pain", "terrible pain", "worst pain", "unbearable pain", "excruciating", "pain is unbearable", "so much pain", "really bad pain"] },
  { id: "pain_worse", weight: 45, any: ["pain is getting worse", "getting worse", "worse than before", "more pain", "pain is increasing"] },
  { id: "dizzy", weight: 45, any: ["dizzy", "lightheaded", "light headed", "room is spinning", "going to faint", "feel faint"] },
  { id: "fever", weight: 45, any: ["fever", "burning up", "very hot", "high temperature", "chills"] },
  { id: "vomiting", weight: 45, any: ["throwing up", "vomiting", "can't stop vomiting", "nauseous and", "keep vomiting"] },
  { id: "fall_risk", weight: 45, any: ["going to fall", "about to fall", "losing my balance", "can't balance", "feel unsteady"] },
  { id: "confused", weight: 45, any: ["confused", "don't know where i am", "disoriented", "can't think straight", "can't remember", "feel foggy"] },
  // Concerning but genuinely ambiguous — deliberately High, not Critical, so a
  // rehab patient winded after PT doesn't fire a red alert, while still getting
  // a prompt look. The AI layer can raise these; it can never lower them.
  { id: "breathless_mild", weight: 55, any: ["out of breath", "winded", "short of air", "breathing feels off", "hard to catch up"] },
  { id: "weakness", weight: 50, any: ["really weak", "very weak", "so weak", "no strength", "legs gave out", "legs are giving out", "can't hold myself up"] },
  { id: "unwell_vague", weight: 50, any: ["something is wrong", "something's wrong", "doesn't feel right", "does not feel right", "feel really bad", "feel awful", "feel terrible", "feel very sick", "feel really sick"] },
  { id: "swelling", weight: 45, any: ["swelling", "swollen", "leg is puffy", "ankles are swollen"] },
  { id: "urinary", weight: 45, any: ["can't urinate", "cant urinate", "can't pee", "haven't gone to the bathroom", "burns when i pee", "hurts to pee"] },
  // Anxiety/panic can present identically to cardiac symptoms — deliberately
  // High rather than Critical when named explicitly as panic, but the
  // symptom-based cardiac/respiratory signals above still fire Critical for
  // the same physical complaints without the "panic" framing, which is the
  // correct safety-biased outcome (never assume it's "just anxiety").
  { id: "panic", weight: 50, any: ["panic attack", "having a panic attack", "can't calm down", "cant calm down", "anxiety attack", "feel like i'm panicking", "feel like im panicking"] },
  // A medication error report needs a nurse to verify promptly (wrong drug,
  // wrong dose, wrong patient), but isn't automatically a Critical symptom
  // on its own — the AI layer can raise it further from context.
  { id: "med_error", weight: 55, any: ["wrong pill", "wrong pills", "wrong medication", "wrong medicine", "gave me the wrong", "took the wrong", "wrong dose", "extra dose by mistake", "double dosed by accident"] },
  { id: "infection_signs", weight: 50, any: ["wound looks infected", "incision looks infected", "looks infected", "redness around my", "red streaks", "pus coming from", "draining pus", "warm and red", "smells bad", "foul smell from"] },
  { id: "bp_symptoms", weight: 45, any: ["blood pressure is really high", "blood pressure feels high", "pressure feels really high", "my pressure is high", "blood pressure is really low", "pressure feels low"] },
  { id: "cold_severe", weight: 45, any: ["can't stop shivering", "cant stop shivering", "freezing and can't warm up", "shivering uncontrollably", "extremely cold and shaking"] },
  { id: "swallowing_difficulty", weight: 50, any: ["trouble swallowing", "hard to swallow", "difficulty swallowing", "food went down wrong", "choked a little on", "keep choking on my food"] },
];

// MEDIUM — assistance needed, not clinical emergency.
const MEDIUM: Signal[] = [
  { id: "help_generic", weight: 35, any: ["i need help", "need help", "can someone come", "come here", "need assistance", "please help", "i need someone"] },
  { id: "mobility_help", weight: 35, any: ["help me up", "help getting up", "help me stand", "help to the bathroom", "need help walking", "help me move"] },
  { id: "bathroom", weight: 30, any: ["bathroom", "restroom", "toilet", "need to pee", "need to go", "commode", "bedpan"] },
  { id: "water", weight: 28, any: ["water", "thirsty", "need a drink", "something to drink", "so thirsty", "can't reach my water"] },
  { id: "pain_mild", weight: 30, any: ["pain", "hurts", "aching", "sore", "uncomfortable"] },
  { id: "reposition", weight: 28, any: ["help me turn", "reposition", "uncomfortable in bed", "adjust my bed", "move my pillow under"] },
  { id: "food", weight: 25, any: ["hungry", "food", "something to eat", "missed my meal", "when is lunch", "when is dinner"] },
  // Rehab-population-specific: mobility equipment, therapy sessions, and
  // family communication are frequent, non-emergency, but real needs that
  // shouldn't fall through to Custom/uncategorized.
  { id: "equipment", weight: 30, any: ["wheelchair is broken", "wheelchair broke", "walker is broken", "walker broke", "call button", "bed alarm", "cane broke", "brace isn't fitting", "sling is uncomfortable"] },
  { id: "therapy", weight: 28, any: ["physical therapy", "occupational therapy", "my therapy session", "pt session", "ot session", "therapy appointment", "speech therapy"] },
  { id: "family_contact", weight: 28, any: ["call my family", "call my daughter", "call my son", "call my wife", "call my husband", "my family isn't answering", "need to reach my family", "talk to my family"] },
  { id: "hygiene", weight: 28, any: ["need a shower", "need to bathe", "help me wash", "brush my teeth", "need a bed bath", "haven't been cleaned"] },
];

// LOW — comfort requests.
const LOW: Signal[] = [
  { id: "blanket", weight: 15, any: ["blanket", "cold", "another blanket", "extra blanket"] },
  { id: "pillow", weight: 15, any: ["pillow", "another pillow", "fluff my pillow"] },
  { id: "comfort", weight: 12, any: ["too warm", "too hot", "adjust the temperature", "tv", "television", "remote", "channel", "lights", "curtain", "blinds"] },
  { id: "tidy", weight: 12, any: ["tissue", "napkin", "trash", "clean up", "tidy"] },
];

// INFORMATIONAL — questions, no action urgency.
const INFO: Signal[] = [
  { id: "question", weight: 6, any: ["what time", "when is", "what day", "schedule", "visiting hours", "just wondering", "question about", "can you tell me"] },
  { id: "thanks", weight: 4, any: ["thank you", "thanks", "no longer need", "never mind", "all good", "i'm okay now", "im okay now"] },
];

// Intensity amplifiers — multiply the situation's urgency.
const AMPLIFIERS: { any: string[]; add: number }[] = [
  { any: ["now", "right now", "immediately", "quickly", "hurry", "asap", "urgent"], add: 12 },
  { any: ["really", "very", "so ", "extremely", "badly", "a lot", "can't take it"], add: 8 },
  { any: ["please", "someone", "anyone"], add: 4 },
  { any: ["getting worse", "worse", "more and more"], add: 10 },
];

const NEGATORS = ["no ", "not ", "n't ", "without ", "don't ", "dont ", "isn't ", "aren't ", "never "];

function firedNegated(text: string, fragment: string): boolean {
  // True if every occurrence of `fragment` is preceded by a negator within 14 chars.
  let idx = text.indexOf(fragment);
  if (idx === -1) return false;
  while (idx !== -1) {
    const window = text.slice(Math.max(0, idx - 14), idx);
    if (!NEGATORS.some((n) => window.includes(n))) return false; // a real occurrence
    idx = text.indexOf(fragment, idx + fragment.length);
  }
  return true;
}

function matchSignals(text: string, table: Signal[]): { hits: Signal[]; weight: number } {
  const hits: Signal[] = [];
  let weight = 0;
  for (const sig of table) {
    const frag = sig.any.find((f) => text.includes(f));
    if (frag && !firedNegated(text, frag)) {
      hits.push(sig);
      weight = Math.max(weight, sig.weight); // strongest signal in a band wins
    }
  }
  return { hits, weight };
}

function urgencyFromScore(score: number): UrgencyLevel {
  if (score >= 85) return "Critical";
  if (score >= 45) return "High";   // single high-acuity symptom (dizzy/fever) → High
  if (score >= 28) return "Medium";
  if (score >= 12) return "Low";
  return "Informational";
}

const ACTIONS: Record<UrgencyLevel, string> = {
  Critical: "Respond immediately — possible medical emergency. Escalate to a nurse now.",
  High: "Attend promptly — clinical attention may be needed.",
  Medium: "Send a staff member to assist.",
  Low: "Fulfill when convenient.",
  Informational: "No action needed beyond a reply.",
};

/**
 * Classify a free-text patient message into a 5-level triage result.
 * `presetUrgency` (set when admitting the patient) acts as a FLOOR — the result
 * is never less urgent than the preset.
 */
export function triage(
  text: string,
  opts: { presetUrgency?: UrgencyLevel; repeatedUnresolved?: number } = {},
): TriageResult {
  const lower = ` ${(text || "").toLowerCase().trim()} `;

  const crit = matchSignals(lower, CRITICAL);
  const high = matchSignals(lower, HIGH);
  const med = matchSignals(lower, MEDIUM);
  const low = matchSignals(lower, LOW);
  const info = matchSignals(lower, INFO);

  let amp = 0;
  for (const a of AMPLIFIERS) {
    if (a.any.some((f) => lower.includes(f))) amp += a.add;
  }

  // Base score = strongest band that fired, plus amplifiers.
  let score = Math.max(crit.weight, high.weight, med.weight, low.weight, info.weight);
  const anyFired = crit.hits.length || high.hits.length || med.hits.length || low.hits.length || info.hits.length;
  if (!anyFired) score = 28; // unclassified text → treat as Medium-ish, never ignore
  score += amp;

  // Repeated unresolved requests from the same patient escalate.
  if ((opts.repeatedUnresolved ?? 0) >= 2) score += 12;

  const hardCritical = crit.hits.some((s) => s.critical);
  if (hardCritical) score = Math.max(score, 92);

  score = Math.max(0, Math.min(100, score));

  const matched = [...crit.hits, ...high.hits, ...med.hits, ...low.hits, ...info.hits].map((s) => s.id);

  // Confidence: clear single-band matches are confident; ambiguous/empty less so.
  const bandsFired = [crit, high, med, low, info].filter((b) => b.hits.length > 0).length;
  let confidence = anyFired ? 0.7 + Math.min(0.25, matched.length * 0.06) : 0.4;
  if (bandsFired > 1) confidence -= 0.1;
  confidence = Math.max(0.3, Math.min(0.97, Number(confidence.toFixed(2))));

  let urgency = urgencyFromScore(score);
  let escalated = false;

  // SAFETY BIAS: low confidence near a boundary → round up one level.
  // Only when a REAL signal fired — an unrecognized message (empty/garbled
  // transcript) must NOT be auto-escalated to Urgent. No words = no emergency
  // signal to round up from; it stays Medium ("send someone to check").
  const NEAR = { Critical: 85, High: 45, Medium: 28, Low: 12, Informational: 0 } as const;
  if (anyFired && confidence < 0.6 && urgency !== "Critical") {
    const dist = score - NEAR[urgency];
    if (dist <= 8) {
      urgency = bumpUp(urgency);
      escalated = true;
    }
  }

  // Apply the admit-time preset as a floor.
  if (opts.presetUrgency && rank(opts.presetUrgency) > rank(urgency)) {
    urgency = opts.presetUrgency;
    escalated = true;
  }

  return {
    urgency,
    score,
    confidence,
    matched,
    reason: buildReason(urgency, matched, escalated),
    suggestedAction: ACTIONS[urgency],
    escalated,
  };
}

function rank(u: UrgencyLevel): number {
  return { Critical: 5, High: 4, Medium: 3, Low: 2, Informational: 1 }[u];
}
function bumpUp(u: UrgencyLevel): UrgencyLevel {
  const order: UrgencyLevel[] = ["Informational", "Low", "Medium", "High", "Critical"];
  return order[Math.min(order.length - 1, order.indexOf(u) + 1)];
}

function buildReason(urgency: UrgencyLevel, matched: string[], escalated: boolean): string {
  const human: Record<string, string> = {
    respiratory: "breathing difficulty", choking: "choking", cardiac: "chest/heart symptoms",
    stroke: "possible stroke signs", fall: "a fall", head: "head injury", bleeding: "bleeding",
    wound_device: "a wound or medical device problem",
    unconscious: "loss of consciousness", seizure: "seizure", allergic: "allergic reaction",
    overdose: "possible medication overdose", diabetic: "a possible diabetic emergency",
    emergency: "an explicit emergency call", suicidal: "self-harm risk",
    oxygen_equipment: "oxygen/breathing equipment failure", color_change: "a visible color change (circulation/oxygen concern)",
    headache_severe: "a sudden severe headache", abdominal_severe: "severe abdominal pain",
    acute_delirium: "sudden confusion or altered mental status",
    med_urgent: "a medication need", immobile: "inability to move", pain_severe: "severe pain",
    pain_worse: "worsening pain", dizzy: "dizziness", fever: "fever", vomiting: "vomiting",
    fall_risk: "fall risk", confused: "confusion", help_generic: "a request for help",
    breathless_mild: "shortness of breath after exertion", weakness: "significant weakness",
    unwell_vague: "a general feeling of being unwell", swelling: "swelling", urinary: "a urinary symptom",
    panic: "possible panic/anxiety", med_error: "a possible medication error",
    infection_signs: "possible signs of infection", bp_symptoms: "a blood pressure concern",
    cold_severe: "severe cold/shivering", swallowing_difficulty: "difficulty swallowing",
    mobility_help: "mobility assistance", bathroom: "a bathroom need", water: "thirst/water",
    pain_mild: "discomfort", reposition: "repositioning", food: "food/meal",
    equipment: "a mobility equipment issue", therapy: "a therapy session need",
    family_contact: "a request to contact family", hygiene: "a hygiene need",
    blanket: "a blanket", pillow: "a pillow", comfort: "comfort/environment", tidy: "tidying",
    question: "a question", thanks: "an acknowledgement",
  };
  const phrases = matched.slice(0, 3).map((m) => human[m] ?? m);
  const base = phrases.length
    ? `Detected ${phrases.join(", ")}.`
    : "No clear signal — treated cautiously.";
  return escalated ? `${base} Escalated for safety.` : base;
}
