/**
 * TDD tests for trend.ts seam:
 * - P1: computeTrend — KPI trend vs previous period
 * - P2: selectTopDebtors — top N debtors from byProperty
 * - P3: computeGroupedByPropertyFromSummary — ADR-0029 export semantics
 *
 * All helpers are pure — no side effects, no DB calls.
 */

import { describe, expect, it } from "vitest";
import {
  computeTrend,
  selectTopDebtors,
  computeGroupedByPropertyFromSummary,
  type GroupedPropertyExport,
} from "@/lib/reports/trend";
import type { DecisionByPropertyEntry, ReportDecisionSummary } from "@/lib/reports/decision-summary";

// ─── P1: computeTrend ─────────────────────────────────────────────────────────

describe("computeTrend — direction and percentage", () => {
  it("up when current > previous", () => {
    const result = computeTrend(1000, 500);
    expect(result.direction).toBe("up");
    expect(result.pct).toBe(100);
  });

  it("down when current < previous", () => {
    const result = computeTrend(500, 1000);
    expect(result.direction).toBe("down");
    expect(result.pct).toBe(-50);
  });

  it("null when both zero", () => {
    const result = computeTrend(0, 0);
    expect(result.direction).toBe(null);
    expect(result.pct).toBe(null);
  });

  it("up with null pct when previous is zero and current > 0", () => {
    const result = computeTrend(500, 0);
    expect(result.direction).toBe("up");
    expect(result.pct).toBe(null);
  });

  it("down with null pct when current is zero and previous > 0", () => {
    const result = computeTrend(0, 500);
    expect(result.direction).toBe("down");
    expect(result.pct).toBe(null);
  });

  it("null when current equals previous", () => {
    const result = computeTrend(1000, 1000);
    expect(result.direction).toBe(null);
    expect(result.pct).toBe(null);
  });

  it("up 50% for 300/200", () => {
    const result = computeTrend(300, 200);
    expect(result.direction).toBe("up");
    expect(result.pct).toBe(50);
  });
});

describe("computeTrend — label", () => {
  it("label is always 'vs período anterior'", () => {
    expect(computeTrend(1000, 500).label).toBe("vs período anterior");
    expect(computeTrend(500, 1000).label).toBe("vs período anterior");
    expect(computeTrend(0, 0).label).toBe("vs período anterior");
    expect(computeTrend(500, 0).label).toBe("vs período anterior");
    expect(computeTrend(0, 500).label).toBe("vs período anterior");
  });
});

// ─── P2: selectTopDebtors ────────────────────────────────────────────────────

describe("selectTopDebtors", () => {
  const makeEntry = (
    propertyId: string,
    propertyName: string,
    outstandingBalance: number,
  ): DecisionByPropertyEntry => ({
    propertyId,
    propertyName,
    activity: "DAILY",
    collectedCash: 0,
    collectedCashFromCancelledReservations: 0,
    outstandingBalance,
    occupiedNightUnits: 0,
    capacityNightUnits: 0,
    occupancyRate: 0,
    reservationCount: 0,
  });

  it("returns top 5 by outstandingBalance desc", () => {
    const byProperty: DecisionByPropertyEntry[] = [
      makeEntry("p1", "Casa Playa", 500000),
      makeEntry("p2", "Depto Centro", 1200000),
      makeEntry("p3", "Cabaña Norte", 300000),
      makeEntry("p4", "Loft Sur", 800000),
      makeEntry("p5", "Depto Este", 200000),
      makeEntry("p6", "Casa Oeste", 950000),
    ];

    const result = selectTopDebtors(byProperty, 5);

    expect(result).toHaveLength(5);
    expect(result[0].propertyName).toBe("Depto Centro");   // 1200000
    expect(result[1].propertyName).toBe("Casa Oeste");     // 950000
    expect(result[2].propertyName).toBe("Loft Sur");       // 800000
    expect(result[3].propertyName).toBe("Casa Playa");     // 500000
    expect(result[4].propertyName).toBe("Cabaña Norte");   // 300000
  });

  it("skips properties with zero outstandingBalance", () => {
    const byProperty: DecisionByPropertyEntry[] = [
      makeEntry("p1", "Casa Playa", 0),
      makeEntry("p2", "Depto Centro", 500000),
      makeEntry("p3", "Cabaña Norte", 0),
      makeEntry("p4", "Loft Sur", 300000),
    ];

    const result = selectTopDebtors(byProperty, 5);

    expect(result).toHaveLength(2);
    expect(result[0].propertyName).toBe("Depto Centro");
    expect(result[1].propertyName).toBe("Loft Sur");
  });

  it("returns empty array when all outstandingBalance are zero", () => {
    const byProperty: DecisionByPropertyEntry[] = [
      makeEntry("p1", "Casa Playa", 0),
      makeEntry("p2", "Depto Centro", 0),
    ];

    const result = selectTopDebtors(byProperty, 5);

    expect(result).toHaveLength(0);
  });

  it("returns all available when fewer than limit have outstandingBalance > 0", () => {
    const byProperty: DecisionByPropertyEntry[] = [
      makeEntry("p1", "Casa Playa", 100000),
      makeEntry("p2", "Depto Centro", 0),
    ];

    const result = selectTopDebtors(byProperty, 5);

    expect(result).toHaveLength(1);
    expect(result[0].propertyName).toBe("Casa Playa");
  });

  it("handles empty byProperty array", () => {
    const result = selectTopDebtors([], 5);
    expect(result).toHaveLength(0);
  });
});

// ─── P3: computeGroupedByPropertyFromSummary ──────────────────────────────────

describe("computeGroupedByPropertyFromSummary — ADR-0029 export semantics", () => {
  function makeByPropertyEntry(
    id: string,
    name: string,
    outstandingBalance: number,
    collectedCash: number,
    occupiedNightUnits = 0,
    reservationCount = 0,
  ): DecisionByPropertyEntry {
    return {
      propertyId: id,
      propertyName: name,
      activity: "DAILY",
      collectedCash,
      collectedCashFromCancelledReservations: 0,
      outstandingBalance,
      occupiedNightUnits,
      capacityNightUnits: 0,
      occupancyRate: 0,
      reservationCount,
    };
  }

  function makeSummary(entries: DecisionByPropertyEntry[]): ReportDecisionSummary {
    return {
      collectedCash: entries.reduce((s, e) => s + e.collectedCash, 0),
      collectedCashFromCancelledReservations: 0,
      outstandingBalance: entries.reduce((s, e) => s + e.outstandingBalance, 0),
      occupiedNightUnits: entries.reduce((s, e) => s + e.occupiedNightUnits, 0),
      capacityNightUnits: 0,
      occupancyRate: 0,
      reservationCount: entries.reduce((s, e) => s + e.reservationCount, 0),
      byBillingType: { DAILY: {} as any, MONTHLY: {} as any },
      byProperty: entries,
      activity: "DAILY",
      cash: { byMonth: [], annual: {} as any },
    };
  }

  it("derives paidRevenue=collectedCash, pendingRevenue=outstandingBalance, reservedRevenueInRange=sum", () => {
    const summary = makeSummary([
      makeByPropertyEntry("p1", "Casa Playa", 200000, 300000),
      makeByPropertyEntry("p2", "Depto Centro", 0, 300000),
    ]);

    const result = computeGroupedByPropertyFromSummary(summary);

    expect(result).toHaveLength(2);

    const casa = result.find((r) => r.propertyName === "Casa Playa")!;
    expect(casa.reservedRevenueInRange).toBe(500000);  // 200k + 300k
    expect(casa.paidRevenue).toBe(300000);             // collectedCash
    expect(casa.pendingRevenue).toBe(200000);          // outstandingBalance

    const depto = result.find((r) => r.propertyName === "Depto Centro")!;
    expect(depto.reservedRevenueInRange).toBe(300000);
    expect(depto.paidRevenue).toBe(300000);
    expect(depto.pendingRevenue).toBe(0);
  });

  it("orders by pendingRevenue descending (highest debt first)", () => {
    const summary = makeSummary([
      makeByPropertyEntry("p1", "Casa Playa", 100000, 200000),
      makeByPropertyEntry("p2", "Depto Centro", 500000, 300000),
      makeByPropertyEntry("p3", "Cabaña Norte", 200000, 200000),
    ]);

    const result = computeGroupedByPropertyFromSummary(summary);

    expect(result[0].propertyName).toBe("Depto Centro");   // 500k pending
    expect(result[1].propertyName).toBe("Cabaña Norte");    // 200k pending
    expect(result[2].propertyName).toBe("Casa Playa");     // 100k pending
  });

  it("maps totalNights and totalReservations from byProperty", () => {
    const summary = makeSummary([
      makeByPropertyEntry("p1", "Casa Playa", 100000, 400000, 15, 3),
    ]);

    const result = computeGroupedByPropertyFromSummary(summary);

    expect(result[0].totalNights).toBe(15);
    expect(result[0].totalReservations).toBe(3);
  });

  it("handles empty byProperty array", () => {
    const summary = makeSummary([]);
    const result = computeGroupedByPropertyFromSummary(summary);
    expect(result).toHaveLength(0);
  });
});
