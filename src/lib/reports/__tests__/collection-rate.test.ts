import { describe, expect, it } from "vitest";
import { computeCollectionRate } from "@/lib/reports/collection-rate";

describe("computeCollectionRate", () => {
  it("returns null pct when accruedRevenue is 0 (no denominator)", () => {
    expect(computeCollectionRate(100_000, 0)).toEqual({ pct: null });
  });

  it("returns null pct when accruedRevenue is negative (defensive)", () => {
    expect(computeCollectionRate(100_000, -1)).toEqual({ pct: null });
  });

  it("computes exact 100% when cash equals accrued", () => {
    expect(computeCollectionRate(500_000, 500_000)).toEqual({ pct: 100 });
  });

  it("computes under 100% when cash is less than accrued", () => {
    expect(computeCollectionRate(250_000, 500_000)).toEqual({ pct: 50 });
  });

  it("does NOT clamp above 100% — a prepayment can exceed it", () => {
    expect(computeCollectionRate(900_000, 500_000)).toEqual({ pct: 180 });
  });

  it("returns 0 when no cash was collected but there is accrued revenue", () => {
    expect(computeCollectionRate(0, 500_000)).toEqual({ pct: 0 });
  });

  it("rounds to nearest integer", () => {
    expect(computeCollectionRate(1, 3)).toEqual({ pct: 33 });
  });
});
