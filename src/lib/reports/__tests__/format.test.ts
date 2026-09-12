import { describe, expect, it } from "vitest";
import { monthKeyLabel, formatPeriodRangeLabel } from "@/lib/reports/format";

describe("monthKeyLabel", () => {
  it("formats 2026-01 as a short month + year in Spanish", () => {
    const result = monthKeyLabel("2026-01");
    expect(result).toContain("2026");
    expect(result).toMatch(/ene/i);
  });

  it("formats 2026-12 correctly", () => {
    const result = monthKeyLabel("2026-12");
    expect(result).toContain("2026");
    expect(result).toMatch(/dic/i);
  });
});

describe("formatPeriodRangeLabel", () => {
  it("collapses a full-month range to 'Mes Año'", () => {
    const from = new Date(2026, 8, 1); // Sep 1
    const to = new Date(2026, 8, 30); // Sep 30
    expect(formatPeriodRangeLabel(from, to)).toBe("Septiembre 2026");
  });

  it("still collapses when the range doesn't cover the full month, as long as both dates share month/year", () => {
    const from = new Date(2026, 8, 5);
    const to = new Date(2026, 8, 20);
    expect(formatPeriodRangeLabel(from, to)).toBe("Septiembre 2026");
  });

  it("shows both dates when the range spans multiple months", () => {
    const from = new Date(2026, 0, 1);
    const to = new Date(2026, 2, 31);
    const label = formatPeriodRangeLabel(from, to);
    expect(label).toMatch(/01 ene 2026/i);
    expect(label).toMatch(/31 mar 2026/i);
    expect(label).toContain(" - ");
  });

  it("shows both dates when the range spans multiple years", () => {
    const from = new Date(2025, 11, 1);
    const to = new Date(2026, 0, 31);
    const label = formatPeriodRangeLabel(from, to);
    expect(label).toMatch(/2025/);
    expect(label).toMatch(/2026/);
  });
});
