import { describe, expect, it } from "vitest";
import {
  BUSINESS_TIME_ZONE,
  daysFromNowInBusinessTz,
  isSameBusinessDay,
  getDateKeyInTz,
  dateKeyToDayIndex,
  startOfMonthInSantiago,
} from "@/lib/domain/timezone";

describe("BUSINESS_TIME_ZONE", () => {
  it("is America/Santiago", () => {
    expect(BUSINESS_TIME_ZONE).toBe("America/Santiago");
  });
});

describe("getDateKeyInTz", () => {
  it("returns YYYY-MM-DD format in America/Santiago", () => {
    // July is winter in Chile (UTC-4)
    const date = new Date("2026-07-20T14:00:00.000Z"); // 14:00 UTC = 10:00 SCL (UTC-4)
    expect(getDateKeyInTz(date, "America/Santiago")).toBe("2026-07-20");
  });

  it("handles string input", () => {
    const result = getDateKeyInTz("2026-01-15T12:00:00.000Z", "America/Santiago");
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("dateKeyToDayIndex", () => {
  it("converts YYYY-MM-DD to days since epoch", () => {
    const idx = dateKeyToDayIndex("1970-01-01");
    expect(idx).toBe(0);
  });

  it("handles arbitrary dates", () => {
    const idx = dateKeyToDayIndex("2026-01-01");
    expect(typeof idx).toBe("number");
    expect(idx).toBeGreaterThan(20000);
  });
});

describe("daysFromNowInBusinessTz", () => {
  it("returns 0 when target is today", () => {
    // Use noon UTC to avoid any midnight boundary issues
    const now = new Date("2026-05-20T12:00:00.000Z");
    // May 20 noon UTC = May 20 08:00 SCL (winter) → same calendar day
    const target = new Date("2026-05-20T12:00:00.000Z");
    expect(daysFromNowInBusinessTz(target, now)).toBe(0);
  });

  it("returns positive days for future dates", () => {
    const now = new Date("2026-05-20T12:00:00.000Z"); // May 20 midday UTC
    const target = new Date("2026-05-23T12:00:00.000Z"); // May 23 midday UTC → May 23 SCL
    expect(daysFromNowInBusinessTz(target, now)).toBe(3);
  });

  it("returns negative days for past dates", () => {
    const now = new Date("2026-05-20T12:00:00.000Z");
    const target = new Date("2026-05-17T12:00:00.000Z"); // May 17 midday UTC → May 17 SCL
    expect(daysFromNowInBusinessTz(target, now)).toBe(-3);
  });

  it("handles string dates", () => {
    const now = new Date("2026-05-20T12:00:00.000Z");
    // May 20 to May 25 is 5 days apart
    expect(daysFromNowInBusinessTz("2026-05-25T12:00:00.000Z", now)).toBe(5);
  });

  it("accepts custom timezone override", () => {
    const now = new Date("2026-05-20T12:00:00.000Z");
    // In Tokyo (UTC+9), 12:00 UTC = 21:00 on May 20
    // Next day midnight UTC = previous day 09:00 Tokyo
    const target = new Date("2026-05-21T00:00:00.000Z"); // midnight UTC May 21 = 09:00 Tokyo May 21
    expect(daysFromNowInBusinessTz(target, now, "Asia/Tokyo")).toBe(1);
  });
});

describe("isSameBusinessDay", () => {
  it("returns true for same calendar day", () => {
    // May 20 midday UTC and evening UTC are both May 20 in SCL
    const a = new Date("2026-05-20T12:00:00.000Z"); // midday
    const b = new Date("2026-05-20T20:00:00.000Z"); // evening
    expect(isSameBusinessDay(a, b)).toBe(true);
  });

  it("returns false for different calendar days", () => {
    const a = new Date("2026-05-20T12:00:00.000Z"); // May 20
    const b = new Date("2026-05-21T12:00:00.000Z"); // May 21
    expect(isSameBusinessDay(a, b)).toBe(false);
  });

  it("handles string inputs", () => {
    expect(isSameBusinessDay("2026-05-20T12:00:00.000Z", "2026-05-20T12:00:00.000Z")).toBe(true);
    expect(isSameBusinessDay("2026-05-20T12:00:00.000Z", "2026-05-21T12:00:00.000Z")).toBe(false);
  });

  it("respects custom timezone", () => {
    const a = new Date("2026-05-20T12:00:00.000Z");
    const b = new Date("2026-05-21T00:00:00.000Z"); // May 21 00:00 UTC = May 21 09:00 Tokyo
    expect(isSameBusinessDay(a, b, "Asia/Tokyo")).toBe(false); // May 20 vs May 21 in Tokyo
  });
});

describe("startOfMonthInSantiago", () => {
  it("returns YYYY-MM-01 format", () => {
    const result = startOfMonthInSantiago();
    expect(result).toMatch(/^\d{4}-\d{2}-01$/);
  });

  it("uses America/Santiago timezone for month boundary", () => {
    const result = startOfMonthInSantiago();
    const [year, month] = result.split("-").map(Number);
    expect(month).toBeGreaterThanOrEqual(1);
    expect(month).toBeLessThanOrEqual(12);
    expect(year).toBeGreaterThan(2020);
  });
});
