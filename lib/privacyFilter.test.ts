import { describe, it, expect } from "vitest";
import { redactPHI, containsLikelyPHI } from "./privacyFilter";

describe("redactPHI", () => {
  it("redacts a phone number", () => {
    expect(redactPHI("call me at 555-123-4567")).toBe("call me at [Phone Removed]");
  });

  it("redacts an email address", () => {
    expect(redactPHI("reach me at jane.doe@example.com please")).toBe(
      "reach me at [Email Removed] please",
    );
  });

  it("redacts an SSN", () => {
    expect(redactPHI("my ssn is 123-45-6789")).toBe("my ssn is [SSN Removed]");
  });

  it("redacts a street address", () => {
    expect(redactPHI("I live at 742 Evergreen Terrace Street")).toContain("[Address Removed]");
  });

  it("redacts a date-of-birth-shaped date", () => {
    expect(redactPHI("born on 04/12/1958")).toBe("born on [Date of Birth Removed]");
  });

  it("leaves ordinary care-request text untouched", () => {
    const text = "I need water and my leg hurts, please send a nurse";
    expect(redactPHI(text)).toBe(text);
  });

  it("handles empty and falsy input safely", () => {
    expect(redactPHI("")).toBe("");
  });
});

describe("containsLikelyPHI", () => {
  it("is true when a rule fires", () => {
    expect(containsLikelyPHI("email me at a@b.com")).toBe(true);
  });

  it("is false for plain text", () => {
    expect(containsLikelyPHI("I need help with my blanket")).toBe(false);
  });
});
