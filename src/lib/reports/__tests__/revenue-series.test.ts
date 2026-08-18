/**
 * TDD tests for revenue-series pure module.
 *
 * Behaviors tested (all pure, no DB):
 * 1. isEligibleCashPayment — predicate per payment
 * 2. buildMonthlyCollectedCash — groups by monthKey (America/Santiago), zero-fill, cancelledCash subtotal
 * 3. buildAnnualCollectedCash — 12 months, byMethod, reconciliation invariants
 *
 * Key design decisions:
 * - monthKey = YYYY-MM in America/Santiago (getDateKeyInTz + slice to month)
 * - predicate: COMPLETED, RESERVATION, deletedAt null, paidAt not null
 * - cancelledCash is subtotal within collectedCash (not excluded)
 * - byMethod keys: MERCADO_PAGO | CASH | TRANSFER
 */

import { describe, expect, it } from "vitest";
import {
  isEligibleCashPayment,
  buildMonthlyCollectedCash,
  buildAnnualCollectedCash,
  type CashPaymentInput,
} from "@/lib/reports/revenue-series";
import { BUSINESS_TIME_ZONE } from "@/lib/domain/timezone";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makePayment(overrides: {
  id: string;
  amount: number;
  status: "PENDING" | "COMPLETED" | "FAILED";
  paymentType: "RESERVATION" | "EXTRA";
  method: "MERCADO_PAGO" | "CASH" | "TRANSFER";
  paidAt?: Date | null;
  deletedAt?: Date | null;
}): CashPaymentInput {
  return {
    id: overrides.id,
    amount: overrides.amount,
    status: overrides.status,
    paymentType: overrides.paymentType,
    method: overrides.method,
    paidAt: overrides.paidAt ?? null,
    deletedAt: overrides.deletedAt ?? null,
  };
}

// ─── isEligibleCashPayment ────────────────────────────────────────────────────

describe("isEligibleCashPayment — predicate", () => {
  it("returns true for COMPLETED RESERVATION with paidAt and no deletion", () => {
    const p = makePayment({
      id: "p1",
      amount: 100000,
      status: "COMPLETED",
      paymentType: "RESERVATION",
      method: "MERCADO_PAGO",
      paidAt: new Date("2026-01-15"),
    });
    expect(isEligibleCashPayment(p)).toBe(true);
  });

  it("returns false for PENDING", () => {
    const p = makePayment({
      id: "p1",
      amount: 100000,
      status: "PENDING",
      paymentType: "RESERVATION",
      method: "CASH",
      paidAt: new Date("2026-01-15"),
    });
    expect(isEligibleCashPayment(p)).toBe(false);
  });

  it("returns false for FAILED", () => {
    const p = makePayment({
      id: "p1",
      amount: 100000,
      status: "FAILED",
      paymentType: "RESERVATION",
      method: "CASH",
      paidAt: new Date("2026-01-15"),
    });
    expect(isEligibleCashPayment(p)).toBe(false);
  });

  it("returns false for EXTRA paymentType", () => {
    const p = makePayment({
      id: "p1",
      amount: 50000,
      status: "COMPLETED",
      paymentType: "EXTRA",
      method: "MERCADO_PAGO",
      paidAt: new Date("2026-01-15"),
    });
    expect(isEligibleCashPayment(p)).toBe(false);
  });

  it("returns false when deletedAt is set", () => {
    const p = makePayment({
      id: "p1",
      amount: 100000,
      status: "COMPLETED",
      paymentType: "RESERVATION",
      method: "MERCADO_PAGO",
      paidAt: new Date("2026-01-15"),
      deletedAt: new Date("2026-01-16"),
    });
    expect(isEligibleCashPayment(p)).toBe(false);
  });

  it("returns false when paidAt is null", () => {
    const p = makePayment({
      id: "p1",
      amount: 100000,
      status: "COMPLETED",
      paymentType: "RESERVATION",
      method: "CASH",
      paidAt: null,
    });
    expect(isEligibleCashPayment(p)).toBe(false);
  });

  it("returns true for all three payment methods", () => {
    for (const method of ["MERCADO_PAGO", "CASH", "TRANSFER"] as const) {
      const p = makePayment({
        id: `p-${method}`,
        amount: 100000,
        status: "COMPLETED",
        paymentType: "RESERVATION",
        method,
        paidAt: new Date("2026-01-15"),
      });
      expect(isEligibleCashPayment(p), `${method} should be eligible`).toBe(true);
    }
  });
});

// ─── buildMonthlyCollectedCash ───────────────────────────────────────────────

describe("buildMonthlyCollectedCash", () => {
  // Helper: create a Date representing noon in Santiago timezone
  // Santiago noon (12:00) = UTC + 3h = 15:00 UTC
  const noonSantiago = (y: number, m: number, d: number) =>
    new Date(Date.UTC(y, m - 1, d, 15, 0, 0));

  // Jan 2026 range in Santiago: Jan 1 00:00 to Jan 31 23:59:59
  // In UTC: Jan 1 03:00 to Feb 1 02:59:59
  const rangeStart = new Date(Date.UTC(2026, 0, 1, 3, 0, 0));
  const rangeEnd = new Date(Date.UTC(2026, 1, 1, 2, 59, 59));

  it("sums eligible payments into correct monthKey (America/Santiago)", () => {
    const payments: CashPaymentInput[] = [
      makePayment({ id: "p1", amount: 100000, status: "COMPLETED", paymentType: "RESERVATION", method: "MERCADO_PAGO", paidAt: noonSantiago(2026, 1, 10) }),
      makePayment({ id: "p2", amount: 150000, status: "COMPLETED", paymentType: "RESERVATION", method: "CASH", paidAt: noonSantiago(2026, 1, 20) }),
    ];

    const result = buildMonthlyCollectedCash(payments, rangeStart, rangeEnd, BUSINESS_TIME_ZONE);

    expect(result).toHaveLength(1);
    expect(result[0].monthKey).toBe("2026-01");
    expect(result[0].collectedCash).toBe(250000);
    expect(result[0].paymentCount).toBe(2);
    expect(result[0].cancelledCash).toBe(0);
  });

  it("groups across multiple months", () => {
    const payments: CashPaymentInput[] = [
      makePayment({ id: "p1", amount: 100000, status: "COMPLETED", paymentType: "RESERVATION", method: "MERCADO_PAGO", paidAt: noonSantiago(2026, 1, 10) }),
      makePayment({ id: "p2", amount: 200000, status: "COMPLETED", paymentType: "RESERVATION", method: "CASH", paidAt: noonSantiago(2026, 2, 15) }),
    ];

    // Range Jan 1 to Feb 28 Santiago
    const range = new Date(Date.UTC(2026, 1, 28, 23, 59, 59));
    const result = buildMonthlyCollectedCash(payments, rangeStart, range, BUSINESS_TIME_ZONE);

    expect(result).toHaveLength(2);
    expect(result[0].monthKey).toBe("2026-01");
    expect(result[0].collectedCash).toBe(100000);
    expect(result[1].monthKey).toBe("2026-02");
    expect(result[1].collectedCash).toBe(200000);
  });

  it("zero-fills months with no eligible payments", () => {
    const payments: CashPaymentInput[] = [
      makePayment({ id: "p1", amount: 100000, status: "COMPLETED", paymentType: "RESERVATION", method: "MERCADO_PAGO", paidAt: noonSantiago(2026, 1, 15) }),
    ];

    // Q1 2026: Jan 1 to Mar 31 in Santiago
    const rangeQ1Start = new Date(Date.UTC(2026, 0, 1, 3, 0, 0));
    const rangeQ1End = new Date(Date.UTC(2026, 2, 31, 23, 59, 59));
    const result = buildMonthlyCollectedCash(payments, rangeQ1Start, rangeQ1End, BUSINESS_TIME_ZONE);

    expect(result).toHaveLength(3);
    expect(result[0].monthKey).toBe("2026-01");
    expect(result[1].monthKey).toBe("2026-02");
    expect(result[1].collectedCash).toBe(0);
    expect(result[1].paymentCount).toBe(0);
    expect(result[2].monthKey).toBe("2026-03");
    expect(result[2].collectedCash).toBe(0);
  });

  it("tracks cancelledCash as subtotal within collectedCash", () => {
    const payments: CashPaymentInput[] = [
      makePayment({ id: "p1", amount: 200000, status: "COMPLETED", paymentType: "RESERVATION", method: "MERCADO_PAGO", paidAt: noonSantiago(2026, 1, 10) }),
      makePayment({ id: "p2", amount: 50000, status: "COMPLETED", paymentType: "RESERVATION", method: "CASH", paidAt: noonSantiago(2026, 1, 15) }),
    ];

    const result = buildMonthlyCollectedCash(
      payments,
      rangeStart,
      rangeEnd,
      BUSINESS_TIME_ZONE,
      new Set(["p2"]), // p2 is from a cancelled reservation
    );

    expect(result).toHaveLength(1);
    expect(result[0].collectedCash).toBe(250000); // p1 + p2
    expect(result[0].cancelledCash).toBe(50000);  // p2 is from cancelled reservation
  });

  it("excludes PENDING / FAILED / EXTRA / deletedAt / null paidAt", () => {
    const payments: CashPaymentInput[] = [
      makePayment({ id: "p1", amount: 100000, status: "PENDING", paymentType: "RESERVATION", method: "MERCADO_PAGO", paidAt: noonSantiago(2026, 1, 10) }),
      makePayment({ id: "p2", amount: 200000, status: "FAILED", paymentType: "RESERVATION", method: "MERCADO_PAGO", paidAt: noonSantiago(2026, 1, 15) }),
      makePayment({ id: "p3", amount: 300000, status: "COMPLETED", paymentType: "EXTRA", method: "MERCADO_PAGO", paidAt: noonSantiago(2026, 1, 20) }),
      makePayment({ id: "p4", amount: 400000, status: "COMPLETED", paymentType: "RESERVATION", method: "MERCADO_PAGO", paidAt: null }),
      makePayment({ id: "p5", amount: 500000, status: "COMPLETED", paymentType: "RESERVATION", method: "MERCADO_PAGO", paidAt: noonSantiago(2026, 1, 25), deletedAt: new Date("2026-01-26") }),
      // Only p6 is eligible
      makePayment({ id: "p6", amount: 600000, status: "COMPLETED", paymentType: "RESERVATION", method: "CASH", paidAt: noonSantiago(2026, 1, 30) }),
    ];

    const result = buildMonthlyCollectedCash(payments, rangeStart, rangeEnd, BUSINESS_TIME_ZONE);

    expect(result).toHaveLength(1);
    expect(result[0].collectedCash).toBe(600000);
    expect(result[0].paymentCount).toBe(1);
  });

  it("returns zero-filled months when no eligible payments in range", () => {
    // Payment is April — outside Jan-Feb range, so collectedCash is 0
    const payments: CashPaymentInput[] = [
      makePayment({ id: "p1", amount: 100000, status: "COMPLETED", paymentType: "RESERVATION", method: "MERCADO_PAGO", paidAt: noonSantiago(2026, 4, 15) }),
    ];

    const result = buildMonthlyCollectedCash(payments, rangeStart, rangeEnd, BUSINESS_TIME_ZONE);

    // Range is Jan 1 to Jan 31 Santiago → single month "2026-01" with zero
    expect(result).toHaveLength(1);
    expect(result[0].monthKey).toBe("2026-01");
    expect(result[0].collectedCash).toBe(0);
    expect(result[0].paymentCount).toBe(0);
  });

  it("orders result ascending by monthKey", () => {
    const payments: CashPaymentInput[] = [
      makePayment({ id: "p1", amount: 100000, status: "COMPLETED", paymentType: "RESERVATION", method: "MERCADO_PAGO", paidAt: noonSantiago(2026, 3, 1) }),
      makePayment({ id: "p2", amount: 200000, status: "COMPLETED", paymentType: "RESERVATION", method: "CASH", paidAt: noonSantiago(2026, 1, 1) }),
      makePayment({ id: "p3", amount: 300000, status: "COMPLETED", paymentType: "RESERVATION", method: "MERCADO_PAGO", paidAt: noonSantiago(2026, 2, 1) }),
    ];

    // Q1 2026
    const rangeQ1Start = new Date(Date.UTC(2026, 0, 1, 3, 0, 0));
    const rangeQ1End = new Date(Date.UTC(2026, 2, 31, 23, 59, 59));
    const result = buildMonthlyCollectedCash(payments, rangeQ1Start, rangeQ1End, BUSINESS_TIME_ZONE);

    expect(result[0].monthKey).toBe("2026-01");
    expect(result[1].monthKey).toBe("2026-02");
    expect(result[2].monthKey).toBe("2026-03");
  });
});

// ─── buildAnnualCollectedCash ─────────────────────────────────────────────────

describe("buildAnnualCollectedCash", () => {
  const year = 2026;

  // Helper: create a Date that represents noon in Santiago timezone
  // Santiago noon (12:00) = UTC + 3h = 15:00 UTC
  const noonSantiago = (y: number, m: number, d: number) =>
    new Date(Date.UTC(y, m - 1, d, 15, 0, 0));

  it("builds 12-month byMonth array with zero-fill", () => {
    const payments: CashPaymentInput[] = [
      makePayment({ id: "p1", amount: 100000, status: "COMPLETED", paymentType: "RESERVATION", method: "MERCADO_PAGO", paidAt: noonSantiago(2026, 3, 15) }),
    ];

    const result = buildAnnualCollectedCash(payments, year, BUSINESS_TIME_ZONE);

    expect(result.byMonth).toHaveLength(12);
    expect(result.byMonth[0].monthKey).toBe("2026-01");
    expect(result.byMonth[0].collectedCash).toBe(0);
    expect(result.byMonth[2].monthKey).toBe("2026-03");
    expect(result.byMonth[2].collectedCash).toBe(100000);
  });

  it("groups byMethod correctly", () => {
    const payments: CashPaymentInput[] = [
      makePayment({ id: "p1", amount: 100000, status: "COMPLETED", paymentType: "RESERVATION", method: "MERCADO_PAGO", paidAt: noonSantiago(2026, 1, 15) }),
      makePayment({ id: "p2", amount: 200000, status: "COMPLETED", paymentType: "RESERVATION", method: "CASH", paidAt: noonSantiago(2026, 1, 20) }),
      makePayment({ id: "p3", amount: 300000, status: "COMPLETED", paymentType: "RESERVATION", method: "TRANSFER", paidAt: noonSantiago(2026, 1, 25) }),
    ];

    const result = buildAnnualCollectedCash(payments, year, BUSINESS_TIME_ZONE);

    expect(result.byMethod["MERCADO_PAGO"]).toBe(100000);
    expect(result.byMethod["CASH"]).toBe(200000);
    expect(result.byMethod["TRANSFER"]).toBe(300000);
  });

  it("totalCash === sum of all byMonth.collectedCash", () => {
    const payments: CashPaymentInput[] = [
      makePayment({ id: "p1", amount: 100000, status: "COMPLETED", paymentType: "RESERVATION", method: "MERCADO_PAGO", paidAt: noonSantiago(2026, 1, 15) }),
      makePayment({ id: "p2", amount: 200000, status: "COMPLETED", paymentType: "RESERVATION", method: "CASH", paidAt: noonSantiago(2026, 2, 15) }),
      makePayment({ id: "p3", amount: 300000, status: "COMPLETED", paymentType: "RESERVATION", method: "MERCADO_PAGO", paidAt: noonSantiago(2026, 3, 15) }),
    ];

    const result = buildAnnualCollectedCash(payments, year, BUSINESS_TIME_ZONE);

    const sumByMonth = result.byMonth.reduce((acc, m) => acc + m.collectedCash, 0);
    expect(result.totalCash).toBe(sumByMonth);
    expect(result.totalCash).toBe(600000);
  });

  it("totalCash === sum of all byMethod values", () => {
    const payments: CashPaymentInput[] = [
      makePayment({ id: "p1", amount: 100000, status: "COMPLETED", paymentType: "RESERVATION", method: "MERCADO_PAGO", paidAt: noonSantiago(2026, 1, 15) }),
      makePayment({ id: "p2", amount: 200000, status: "COMPLETED", paymentType: "RESERVATION", method: "CASH", paidAt: noonSantiago(2026, 2, 15) }),
    ];

    const result = buildAnnualCollectedCash(payments, year, BUSINESS_TIME_ZONE);

    const sumByMethod = Object.values(result.byMethod).reduce((acc, v) => acc + v, 0);
    expect(result.totalCash).toBe(sumByMethod);
  });

  it("reconciles: totalCash === sum(byMonth) === sum(byMethod)", () => {
    const payments: CashPaymentInput[] = [
      makePayment({ id: "p1", amount: 50000, status: "COMPLETED", paymentType: "RESERVATION", method: "MERCADO_PAGO", paidAt: noonSantiago(2026, 6, 1) }),
      makePayment({ id: "p2", amount: 75000, status: "COMPLETED", paymentType: "RESERVATION", method: "CASH", paidAt: noonSantiago(2026, 6, 15) }),
      makePayment({ id: "p3", amount: 125000, status: "COMPLETED", paymentType: "RESERVATION", method: "TRANSFER", paidAt: noonSantiago(2026, 12, 1) }),
    ];

    const result = buildAnnualCollectedCash(payments, year, BUSINESS_TIME_ZONE);

    const sumByMonth = result.byMonth.reduce((acc, m) => acc + m.collectedCash, 0);
    const sumByMethod = Object.values(result.byMethod).reduce((acc, v) => acc + v, 0);

    expect(result.totalCash).toBe(sumByMonth);
    expect(result.totalCash).toBe(sumByMethod);
    expect(result.totalCash).toBe(250000);
    expect(result.paymentCount).toBe(3);
  });

  it("tracks cancelledCash as subtotal of totalCash", () => {
    const payments: CashPaymentInput[] = [
      makePayment({ id: "p1", amount: 100000, status: "COMPLETED", paymentType: "RESERVATION", method: "MERCADO_PAGO", paidAt: noonSantiago(2026, 1, 15) }),
      makePayment({ id: "p2", amount: 50000, status: "COMPLETED", paymentType: "RESERVATION", method: "CASH", paidAt: noonSantiago(2026, 1, 20) }),
    ];

    const result = buildAnnualCollectedCash(
      payments,
      year,
      BUSINESS_TIME_ZONE,
      new Set(["p2"]), // p2 is from a cancelled reservation
    );

    expect(result.totalCash).toBe(150000);
    expect(result.cancelledCash).toBe(50000);
    expect(result.cancelledCash).toBeLessThan(result.totalCash);
  });

  it("returns zero totals when no eligible payments in year", () => {
    const payments: CashPaymentInput[] = [
      // Dec 31 2025 noon Santiago = Dec 31 15:00 UTC → year 2025, not 2026
      makePayment({ id: "p1", amount: 100000, status: "COMPLETED", paymentType: "RESERVATION", method: "MERCADO_PAGO", paidAt: noonSantiago(2025, 12, 31) }),
    ];

    const result = buildAnnualCollectedCash(payments, year, BUSINESS_TIME_ZONE);

    expect(result.totalCash).toBe(0);
    expect(result.paymentCount).toBe(0);
    expect(result.cancelledCash).toBe(0);
    for (const m of result.byMonth) {
      expect(m.collectedCash).toBe(0);
    }
  });

  it("uses America/Santiago for month boundaries", () => {
    // Santiago is UTC-3: to get Feb 1 00:00 Santiago, need Jan 31 21:00 UTC
    // (because 21:00 UTC - 3h = 18:00... wait, that math is wrong too.
    //  Let me recalculate: to get Feb 1 00:00 Santiago, the UTC time is Feb 1 03:00 UTC
    //  because 03:00 UTC - 3h = 00:00 Santiago.
    // Jan 31 21:00 UTC = Jan 31 18:00 Santiago — still Jan 31.
    // To get Feb 1 00:00 Santiago: Feb 1 03:00 UTC.
    const payments: CashPaymentInput[] = [
      // Jan 1 noon Santiago = Jan 1 15:00 UTC → "2026-01"
      makePayment({ id: "p1", amount: 100000, status: "COMPLETED", paymentType: "RESERVATION", method: "MERCADO_PAGO", paidAt: new Date(Date.UTC(2026, 0, 1, 15, 0, 0)) }),
      // Jan 31 18:00 UTC = Jan 31 15:00 Santiago → "2026-01" (still January)
      makePayment({ id: "p2", amount: 200000, status: "COMPLETED", paymentType: "RESERVATION", method: "CASH", paidAt: new Date(Date.UTC(2026, 0, 31, 18, 0, 0)) }),
      // Feb 1 03:00 UTC = Feb 1 00:00 Santiago → "2026-02"
      makePayment({ id: "p3", amount: 300000, status: "COMPLETED", paymentType: "RESERVATION", method: "TRANSFER", paidAt: new Date(Date.UTC(2026, 1, 1, 3, 0, 0)) }),
    ];

    const result = buildAnnualCollectedCash(payments, year, BUSINESS_TIME_ZONE);

    // p1 + p2 in January, p3 in February
    expect(result.byMonth[0].collectedCash).toBe(300000); // Jan: p1 + p2
    expect(result.byMonth[1].collectedCash).toBe(300000); // Feb: p3
  });

  it("byMonth entries ordered ascending", () => {
    const payments: CashPaymentInput[] = [
      makePayment({ id: "p1", amount: 100000, status: "COMPLETED", paymentType: "RESERVATION", method: "MERCADO_PAGO", paidAt: noonSantiago(2026, 12, 1) }),
      makePayment({ id: "p2", amount: 50000, status: "COMPLETED", paymentType: "RESERVATION", method: "CASH", paidAt: noonSantiago(2026, 1, 15) }),
    ];

    const result = buildAnnualCollectedCash(payments, year, BUSINESS_TIME_ZONE);

    expect(result.byMonth[0].monthKey).toBe("2026-01");
    expect(result.byMonth[11].monthKey).toBe("2026-12");
  });
});
