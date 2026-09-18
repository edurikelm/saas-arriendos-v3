import { describe, expect, it } from "vitest";
import { newestCreatedAt, shouldRing } from "@/lib/notifications/should-ring";

describe("shouldRing", () => {
  it("does not ring when there is nothing unread", () => {
    expect(shouldRing(null, "2026-09-18T12:00:00.000Z")).toBe(false);
    expect(shouldRing(null, null)).toBe(false);
  });

  it("rings when the newest unread arrived after the last one seen", () => {
    expect(shouldRing("2026-09-18T12:00:30.000Z", "2026-09-18T12:00:00.000Z")).toBe(true);
  });

  it("does not ring again for the same notification", () => {
    expect(shouldRing("2026-09-18T12:00:00.000Z", "2026-09-18T12:00:00.000Z")).toBe(false);
  });

  it("does not ring for unread notifications that were already there on load", () => {
    expect(shouldRing("2026-09-17T09:00:00.000Z", "2026-09-18T12:00:00.000Z")).toBe(false);
  });

  it("rings for the first notification when the account had none on load", () => {
    expect(shouldRing("2026-09-18T12:00:30.000Z", null)).toBe(true);
  });

  it("compares chronologically across a day and month boundary", () => {
    expect(shouldRing("2026-10-01T00:00:00.000Z", "2026-09-30T23:59:59.999Z")).toBe(true);
  });
});

describe("newestCreatedAt", () => {
  it("is null without notifications", () => {
    expect(newestCreatedAt(undefined)).toBeNull();
    expect(newestCreatedAt([])).toBeNull();
  });

  it("returns the newest regardless of order", () => {
    expect(
      newestCreatedAt([
        { createdAt: "2026-09-17T09:00:00.000Z" },
        { createdAt: "2026-09-18T12:00:00.000Z" },
        { createdAt: "2026-09-16T08:00:00.000Z" },
      ]),
    ).toBe("2026-09-18T12:00:00.000Z");
  });
});
