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
  ];

  for (const phrase of critical) {
    it(`classifies "${phrase}" as Critical`, () => {
      const result = triage(phrase);
      expect(result.urgency).toBe("Critical");
    });
  }
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
