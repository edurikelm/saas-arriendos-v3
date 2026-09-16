/**
 * TDD tests for revenue-series pure module.
 *
 * Behaviors tested (all pure, no DB):
 * 1. isEligibleCashPayment — predicate per payment
 * 2. buildMonthlyCollectedCash — groups by monthKey (America/Santiago), zero-fill, cancelledCash subtotal
 * 3. buildCashByMethod — byMethod breakdown for a range, same predicate as collectedCash
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
  buildCashByMethod,
  type CashPaymentInput,
} from "@/lib/reports/revenue-series";
import { BUSINESS_TIME_ZONE, dateOnlyFromKey } from "@/lib/domain/timezone";

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

  // Jan 2026: el rango son DÍAS, leídos con `dateOnlyKey` (ADR-0038). Antes
  // este fixture era el instante de fin de día en Santiago (Feb 1 02:59 UTC),
  // que como día es el 1 de febrero.
  const rangeStart = dateOnlyFromKey("2026-01-01");
  const rangeEnd = dateOnlyFromKey("2026-01-31");

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

// ─── buildCashByMethod ────────────────────────────────────────────────────────

describe("buildCashByMethod", () => {
  const rangeStart = new Date(Date.UTC(2026, 0, 1, 3, 0, 0)); // Jan 1 00:00 Santiago
  const rangeEnd = new Date(Date.UTC(2026, 0, 31, 23, 59, 59)); // Jan 31, well within range

  it("groups collected cash by method within the range", () => {
    const payments: CashPaymentInput[] = [
      makePayment({ id: "p1", amount: 100000, status: "COMPLETED", paymentType: "RESERVATION", method: "MERCADO_PAGO", paidAt: new Date("2026-01-10T15:00:00.000Z") }),
      makePayment({ id: "p2", amount: 200000, status: "COMPLETED", paymentType: "RESERVATION", method: "CASH", paidAt: new Date("2026-01-15T15:00:00.000Z") }),
      makePayment({ id: "p3", amount: 300000, status: "COMPLETED", paymentType: "RESERVATION", method: "TRANSFER", paidAt: new Date("2026-01-20T15:00:00.000Z") }),
    ];

    const result = buildCashByMethod(payments, rangeStart, rangeEnd);

    expect(result).toEqual({ MERCADO_PAGO: 100000, CASH: 200000, TRANSFER: 300000 });
  });

  it("sums multiple payments of the same method", () => {
    const payments: CashPaymentInput[] = [
      makePayment({ id: "p1", amount: 50000, status: "COMPLETED", paymentType: "RESERVATION", method: "CASH", paidAt: new Date("2026-01-10T15:00:00.000Z") }),
      makePayment({ id: "p2", amount: 70000, status: "COMPLETED", paymentType: "RESERVATION", method: "CASH", paidAt: new Date("2026-01-11T15:00:00.000Z") }),
    ];

    const result = buildCashByMethod(payments, rangeStart, rangeEnd);

    expect(result).toEqual({ CASH: 120000 });
  });

  it("uses the same predicate as isEligibleCashPayment — excludes PENDING / FAILED / EXTRA / deletedAt / null paidAt", () => {
    const payments: CashPaymentInput[] = [
      makePayment({ id: "p1", amount: 100000, status: "PENDING", paymentType: "RESERVATION", method: "CASH", paidAt: new Date("2026-01-10T15:00:00.000Z") }),
      makePayment({ id: "p2", amount: 200000, status: "FAILED", paymentType: "RESERVATION", method: "CASH", paidAt: new Date("2026-01-10T15:00:00.000Z") }),
      makePayment({ id: "p3", amount: 300000, status: "COMPLETED", paymentType: "EXTRA", method: "CASH", paidAt: new Date("2026-01-10T15:00:00.000Z") }),
      makePayment({ id: "p4", amount: 400000, status: "COMPLETED", paymentType: "RESERVATION", method: "CASH", paidAt: null }),
      makePayment({ id: "p5", amount: 500000, status: "COMPLETED", paymentType: "RESERVATION", method: "CASH", paidAt: new Date("2026-01-10T15:00:00.000Z"), deletedAt: new Date("2026-01-11") }),
      makePayment({ id: "p6", amount: 600000, status: "COMPLETED", paymentType: "RESERVATION", method: "CASH", paidAt: new Date("2026-01-10T15:00:00.000Z") }),
    ];

    const result = buildCashByMethod(payments, rangeStart, rangeEnd);

    expect(result).toEqual({ CASH: 600000 });
  });

  it("excludes payments with paidAt outside the range", () => {
    const payments: CashPaymentInput[] = [
      makePayment({ id: "p1", amount: 100000, status: "COMPLETED", paymentType: "RESERVATION", method: "CASH", paidAt: new Date("2026-02-01T15:00:00.000Z") }),
    ];

    const result = buildCashByMethod(payments, rangeStart, rangeEnd);

    expect(result).toEqual({});
  });

  it("includes cash from CANCELLED reservations — no reservation-status filter at this seam (ADR-0029)", () => {
    // buildCashByMethod, like collectedCash, doesn't know about reservation
    // status: the caller (decision-summary.ts) already includes cancelled
    // reservations' payments in the flat `allPayments` list it builds.
    const payments: CashPaymentInput[] = [
      makePayment({ id: "p1", amount: 100000, status: "COMPLETED", paymentType: "RESERVATION", method: "CASH", paidAt: new Date("2026-01-10T15:00:00.000Z") }),
    ];

    const result = buildCashByMethod(payments, rangeStart, rangeEnd);

    expect(result).toEqual({ CASH: 100000 });
  });

  it("reconciles with a manually-summed collectedCash over the same payments/range", () => {
    const payments: CashPaymentInput[] = [
      makePayment({ id: "p1", amount: 100000, status: "COMPLETED", paymentType: "RESERVATION", method: "MERCADO_PAGO", paidAt: new Date("2026-01-05T15:00:00.000Z") }),
      makePayment({ id: "p2", amount: 200000, status: "COMPLETED", paymentType: "RESERVATION", method: "CASH", paidAt: new Date("2026-01-10T15:00:00.000Z") }),
      makePayment({ id: "p3", amount: 300000, status: "COMPLETED", paymentType: "RESERVATION", method: "TRANSFER", paidAt: new Date("2026-01-15T15:00:00.000Z") }),
      makePayment({ id: "p4", amount: 999999, status: "PENDING", paymentType: "RESERVATION", method: "CASH", paidAt: new Date("2026-01-15T15:00:00.000Z") }), // ineligible
    ];

    const collectedCash = payments
      .filter(isEligibleCashPayment)
      .reduce((sum, p) => sum + p.amount, 0);

    const result = buildCashByMethod(payments, rangeStart, rangeEnd);
    const sumByMethod = Object.values(result).reduce((a, b) => a + b, 0);

    expect(sumByMethod).toBe(collectedCash);
    expect(sumByMethod).toBe(600000);
  });
});
