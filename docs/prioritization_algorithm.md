# Rehub Prioritization Algorithm

Transparent, deterministic scoring. Implemented in `lib/priorityAlgorithm.ts`
and `lib/aiClassifier.ts`. Every contribution is auditable.

## 1. Base score by request type
| Type | Base |
| --- | --- |
| Pain | 70 |
| Help | 60 |
| Mobility | 55 |
| Medication Question | 50 |
| Bathroom | 40 |
| Custom | 30 |
| Food | 20 |
| Water | 15 |

## 2. Keyword modifiers
- **Urgent (+30 to +50):** can't breathe, chest pain, fell, fall, bleeding,
  severe, dizzy, cannot stand, can't move, help now, emergency, pain is bad,
  very painful
- **Important (+10 to +25):** pain, weak, nauseous, bathroom, medication, missed,
  again, waiting, need help
- **Routine (+0 to +10):** water, food, blanket, remote, question

## 3. Repeated request modifier
If the same resident has 2+ unresolved requests within 30 minutes: **+15**.

## 4. Time-waiting modifier
**+5 per 10 minutes** waiting — applied to the *display* score only. It nudges
queue ordering but does **not** change the originally detected priority label.

## 5. Score → priority
| Score | Priority |
| --- | --- |
| 0–39 | Routine |
| 40–69 | Important |
| 70+ | Urgent |

## 6. Safety flag
If the text contains an emergency-like phrase (can't breathe, chest pain, fell,
bleeding, unconscious, severe pain):
- priority = **Urgent**
- safetyFlag = **true**
- the row sorts to the top
- the resident sees the facility-emergency-call-system message

## Worked examples
| Transcript | Type | Priority | Score | Confidence | Safety |
| --- | --- | --- | --- | --- | --- |
| "I need water." | Water | Routine | 15 | 0.90 | false |
| "I need help going to the bathroom." | Bathroom | Important | ~50 | 0.85 | false |
| "I fell and I'm in pain." | Pain | Urgent | 90+ | 0.95 | true |
| "I feel dizzy and cannot stand." | Mobility | Urgent | 90 | 0.90 | false* |

\* "dizzy"/"cannot stand" drive Urgent via keyword modifiers; they are not in the
hard safety-phrase set, so urgency is classified without claiming an emergency.

## Confidence
A transparent heuristic: a clear single-type match with recognizable keywords
scores high (up to 0.97); vague custom text scores lower (~0.6). Low-confidence
voice requests are flagged on the dashboard row.
