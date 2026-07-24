import { describe, it, expect } from "vitest";
import { triage } from "./triageEngine";
import { URGENCY_LEVELS } from "./types";

const RANK: Record<string, number> = Object.fromEntries(
  URGENCY_LEVELS.map((l, i) => [l, URGENCY_LEVELS.length - i]),
);

describe("triage — critical safety phrases", () => {
  const critical = [
    "I can't breathe",
    "chest pain and pressure",
    "I fell and hit my head",
    "I'm bleeding a lot",
    "I think I'm having a stroke",
    "having a seizure right now",
    "I want to end my life",
    "I can't feel my leg",
    "I'm coughing up blood",
    "I think I took too many pills",
    "my blood sugar is low and I'm shaking and sweating",
    // Realistic phrasings found missing via manual probing before a real
    // facility deployment — the exact substrings above all matched, but
    // patients don't always phrase things in the engine's existing fragments.
    "my chest feels really heavy",
    "I'm having trouble catching my breath",
    "I can't catch my breath",
    "it hurts when I breathe",
    "there's blood in the toilet",
    "my heart is pounding really fast",
    "I feel like I'm going to pass out",
    "half my body feels numb",
    "I'm seeing double",
    "my stitches opened up",
    "I think my IV came out",
    "I don't want to be here anymore", // indirect suicidal ideation
    "my speech is coming out wrong",
    // Second coverage pass — oxygen/device failure, visible color change,
    // sudden severe headache, acute abdomen, and delirium, none of which
    // had any signal coverage at all before this pass.
    "my oxygen tank is empty",
    "the cpap isn't working",
    "his lips are turning blue",
    "her skin looks grey",
    "this is the worst headache of my life",
    "my stomach is hard as a rock and hurts so bad",
    "she's seeing things that aren't there",
    "he's suddenly confused and not making sense",
  ];

  for (const phrase of critical) {
    it(`classifies "${phrase}" as Critical`, () => {
      const result = triage(phrase);
      expect(result.urgency).toBe("Critical");
    });
  }

  // Regression guard for a real bug found while adding the phrases above:
  // "catch my breath" preceded by "can't" was being swallowed by the
  // generic negation filter (which sees "n't " and assumes the symptom
  // is being denied) — the exact opposite of the truth for breathing
  // complaints, where "can't X" IS the emergency. Any future respiratory
  // fragment must be negation-safe the same way "can't breathe" already was.
  it("does not let the negation filter swallow a breathing complaint phrased as \"can't ...\"", () => {
    const result = triage("I can't catch my breath");
    expect(result.urgency).toBe("Critical");
  });
});

describe("triage — routine/comfort requests stay low", () => {
  const routine = ["can I get an extra blanket", "can you turn on the TV", "I'd like some water please"];

  for (const phrase of routine) {
    it(`does not classify "${phrase}" as Critical or High`, () => {
      const result = triage(phrase);
      expect(["Critical", "High"]).not.toContain(result.urgency);
    });
  }
});

describe("triage — ambiguous symptoms are held at the correct band, not over-escalated", () => {
  // These read as "concerning" but must NOT reach Critical on their own —
  // over-escalating routine-adjacent language is exactly how a triage system
  // trains staff to stop trusting its alerts. The AI layer, not this
  // deterministic floor, is responsible for raising these further with context.
  const shouldBeHighNotCritical: [string, string][] = [
    ["panic attack framing must not fire the cardiac critical signal", "I think I'm having a panic attack"],
    ["a reported medication error is High, not an automatic Critical", "I think they gave me the wrong pill"],
    ["infection signs are High, not Critical, absent other red flags", "my incision looks infected and there's pus"],
    ["a subjective blood-pressure complaint is High, not Critical", "my blood pressure feels really high"],
    ["severe shivering alone is High, not Critical", "I can't stop shivering"],
    ["swallowing difficulty alone (no choking) is High, not Critical", "I'm having trouble swallowing my food"],
  ];
  for (const [why, phrase] of shouldBeHighNotCritical) {
    it(`"${phrase}" -> High, not Critical (${why})`, () => {
      const result = triage(phrase);
      expect(result.urgency).toBe("High");
    });
  }

  const shouldBeMediumNotHigh: [string, string][] = [
    ["broken mobility equipment is logistics, not a clinical emergency", "my wheelchair is broken"],
    ["a scheduling question about therapy is not urgent", "when is my physical therapy session"],
    ["a family-contact request is not urgent", "can you call my daughter for me"],
    ["a hygiene assistance request is routine", "I need help with a shower"],
  ];
  for (const [why, phrase] of shouldBeMediumNotHigh) {
    it(`"${phrase}" -> Medium, not High/Critical (${why})`, () => {
      const result = triage(phrase);
      expect(["Critical", "High"]).not.toContain(result.urgency);
    });
  }
});

describe("triage — safety floor never lowers a preset", () => {
  it("keeps the result at least as urgent as presetUrgency for vague text", () => {
    const result = triage("ok", { presetUrgency: "High" });
    expect(RANK[result.urgency]).toBeGreaterThanOrEqual(RANK["High"]);
  });

  it("keeps a Critical preset at Critical even for unrelated follow-up text", () => {
    const result = triage("thanks", { presetUrgency: "Critical" });
    expect(result.urgency).toBe("Critical");
  });
});

describe("triage — repeated unresolved requests escalate, never de-escalate", () => {
  it("a repeated routine request scores at least as high as a single one", () => {
    const once = triage("can I get some water");
    const repeated = triage("can I get some water", { repeatedUnresolved: 3 });
    expect(repeated.score).toBeGreaterThanOrEqual(once.score);
  });
});

describe("triage — every result is auditable", () => {
  it("always returns a non-empty plain-English reason", () => {
    const result = triage("my pain is getting worse");
    expect(result.reason.length).toBeGreaterThan(0);
  });

  it("confidence is within 0..1", () => {
    const result = triage("I need help with the bathroom");
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });
});
