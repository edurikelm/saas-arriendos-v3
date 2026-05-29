import { describe, expect, it } from "vitest";
import { getInclusiveMonths } from "@/lib/reservation-dates";

describe("getInclusiveMonths", () => {
  it("counts full calendar months with inclusive end dates", () => {
    expect(getInclusiveMonths("2026-09-01T12:00:00.000Z", "2026-11-30T12:00:00.000Z")).toBe(3);
  });

  it("counts a one-month reservation that ends the day before the next monthly anniversary", () => {
    expect(getInclusiveMonths("2026-01-15", "2026-02-14")).toBe(1);
  });
});
