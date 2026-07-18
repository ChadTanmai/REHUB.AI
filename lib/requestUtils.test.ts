import { describe, it, expect } from "vitest";
import { canTransition, patientStatusMessage, formatWaiting } from "./requestUtils";
import type { Request, Status } from "./types";

describe("canTransition", () => {
  const cases: Array<[Status, Status, boolean]> = [
    ["New", "Acknowledged", true],
    ["New", "In Progress", true],
    ["New", "Resolved", true],
    ["Acknowledged", "In Progress", true],
    ["Acknowledged", "Resolved", true],
    ["Acknowledged", "New", false],
    ["In Progress", "Resolved", true],
    ["In Progress", "New", false],
    ["Resolved", "New", false],
    ["Resolved", "In Progress", false],
  ];

  for (const [from, to, expected] of cases) {
    it(`${from} -> ${to} is ${expected}`, () => {
      expect(canTransition(from, to)).toBe(expected);
    });
  }
});

describe("patientStatusMessage", () => {
  const base: Request = {
    id: "r1",
    facilityId: "f1",
    roomId: "room1",
    roomNumber: "101",
    residentName: "Test Patient",
    requestType: "Water",
    priority: "Routine",
    priorityScore: 10,
    status: "New",
    notes: "",
    aiSummary: "",
    source: "Button",
    aiConfidence: 1,
    detectedKeywords: [],
    safetyFlag: false,
    createdAt: new Date().toISOString(),
  };

  it("never implies a nurse is already on the way for a New request", () => {
    const msg = patientStatusMessage(base);
    expect(msg.toLowerCase()).not.toContain("coming");
    expect(msg.toLowerCase()).not.toContain("dispatched");
  });

  it("describes each status distinctly", () => {
    const statuses: Status[] = ["New", "Acknowledged", "In Progress", "Resolved"];
    const messages = statuses.map((status) => patientStatusMessage({ ...base, status }));
    expect(new Set(messages).size).toBe(statuses.length);
  });
});

describe("formatWaiting", () => {
  it("formats sub-minute waits", () => {
    expect(formatWaiting(0)).toBe("just now");
  });

  it("formats minute waits", () => {
    expect(formatWaiting(5)).toBe("5 min");
  });

  it("formats hour+ waits", () => {
    expect(formatWaiting(125)).toBe("2h 5m");
  });
});
