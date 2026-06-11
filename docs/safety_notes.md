# Rehub Safety Notes

## Positioning
Rehub is a **communication and workflow tool**. It is **not**:
- a diagnosis app
- a medical device
- an emergency response system

> Rehub does not replace emergency response systems or medical judgment.

This note is shown across the UI (resident/room screens, dashboards, footer).

## AI safety rules
- The AI may classify **request type** and **urgency** only.
- The AI must **never** diagnose, give medical advice, or tell a patient what
  condition they have.
- Summaries restate the resident's words and the basis for prioritization.
- The classifier is deterministic and keyword-based — explainable and auditable.

## Emergency language
When emergency-like phrases are detected (e.g. "can't breathe", "chest pain",
"fell", "bleeding", "unconscious", "severe pain"):
- priority is forced to **Urgent**
- a **safety flag** is set
- the resident sees: "Staff has been notified. If this is life-threatening, use
  the facility emergency call system."

We deliberately say **"facility emergency call system"** rather than "call 911",
because facilities have their own emergency protocols.

## Microphone & voice
- The microphone is **never always-on**. It opens only after an explicit tap and
  closes on stop.
- Voice requests are **never auto-submitted** — the resident confirms first.
- Voice transcription runs in the browser (Web Speech API). No audio is sent to
  any external service in the MVP.

## Demo data
- Demo mode uses **fictional names only**.
- No real patient health information is used anywhere in the MVP.
