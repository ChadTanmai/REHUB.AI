import { describe, it, expect } from "vitest";
import { computeStats, computeSessionStats } from "./analyticsUtils";
import type { Request } from "./types";

const NOW = new Date("2026-07-21T15:00:00Z").getTime();

function makeRequest(overrides: Partial<Request>): Request {
  return {
    id: overrides.id ?? "r1",
    facilityId: "f1",
    roomId: "room1",
    roomNumber: "101",
    residentName: "Test Patient",
    requestType: "Water",
    priority: "Routine",
    priorityScore: 10,
    status: "Resolved",
    notes: "",
    aiSummary: "",
    source: "Button",
    aiConfidence: 1,
    detectedKeywords: [],
    safetyFlag: false,
    createdAt: new Date(NOW).toISOString(),
    ...overrides,
  };
}

describe("computeStats — avg response time is scoped to today", () => {
  it("does not let an old resolved request poison today's average", () => {
    // An ancient request resolved 2 weeks after it was created — exactly the
    // kind of stale/demo data that used to produce a 16,000+ minute average.
    const old = makeRequest({
      id: "old",
      createdAt: new Date(NOW - 20 * 86400000).toISOString(),
      responseTimeMinutes: 20 * 24 * 60, // 20 days, in minutes
    });
    // Two ordinary requests handled quickly today.
    const today1 = makeRequest({ id: "t1", createdAt: new Date(NOW).toISOString(), responseTimeMinutes: 4 });
    const today2 = makeRequest({ id: "t2", createdAt: new Date(NOW).toISOString(), responseTimeMinutes: 6 });

    const stats = computeStats([old, today1, today2], NOW);

    expect(stats.avgResponseMinutes).toBe(5);
  });

  it("returns null (not NaN or a stale value) when nothing was resolved today", () => {
    const old = makeRequest({
      id: "old",
      createdAt: new Date(NOW - 5 * 86400000).toISOString(),
      responseTimeMinutes: 42,
    });
    const stats = computeStats([old], NOW);
    expect(stats.avgResponseMinutes).toBeNull();
  });

  it("avgConfidence is likewise scoped to today, not all-time", () => {
    const old = makeRequest({
      id: "old",
      source: "Voice",
      createdAt: new Date(NOW - 3 * 86400000).toISOString(),
      aiConfidence: 0.1,
    });
    const today = makeRequest({ id: "t1", source: "Voice", createdAt: new Date(NOW).toISOString(), aiConfidence: 0.9 });
    const stats = computeStats([old, today], NOW);
    expect(stats.avgConfidence).toBe(0.9);
  });
});

describe("computeSessionStats — windowed by session start, not calendar day", () => {
  const sessionStart = new Date(NOW - 2 * 3600000).toISOString(); // session began 2h ago

  it("excludes requests from before the session started", () => {
    const beforeSession = makeRequest({
      id: "before",
      createdAt: new Date(NOW - 3 * 3600000).toISOString(), // 3h ago, before session start
      responseTimeMinutes: 999,
    });
    const inSession = makeRequest({
      id: "in",
      createdAt: new Date(NOW - 1 * 3600000).toISOString(), // 1h ago, after session start
      responseTimeMinutes: 5,
    });

    const stats = computeSessionStats([beforeSession, inSession], sessionStart);

    expect(stats.requestsHandled).toBe(1);
    expect(stats.avgResponseMinutes).toBe(5);
  });

  it("is independent of computeStats' 'today' window — a session spanning midnight still counts requests from yesterday", () => {
    const lateLastNight = makeRequest({
      id: "late",
      createdAt: new Date(sessionStart).toISOString(),
      responseTimeMinutes: 3,
    });
    const stats = computeSessionStats([lateLastNight], sessionStart);
    expect(stats.requestsHandled).toBe(1);
  });

  it("returns zeroed/null stats for a brand-new session with no activity yet", () => {
    const stats = computeSessionStats([], new Date(NOW).toISOString());
    expect(stats.requestsHandled).toBe(0);
    expect(stats.resolvedCount).toBe(0);
    expect(stats.avgResponseMinutes).toBeNull();
  });
});
