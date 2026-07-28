/**
 * Revenue Series — pure domain module for cash-basis revenue reporting.
 *
 * Key design decisions:
 * - `monthKey` = "YYYY-MM" in `America/Santiago` (getDateKeyInTz + slice to month)
 * - Predicate: COMPLETED, paymentType RESERVATION, deletedAt null, paidAt not null
 * - `cancelledCash` is a SUBTOTAL within `collectedCash` (cancelled reservation payments are INCLUDED in total)
 * - `byMethod` keys: MERCADO_PAGO | CASH | TRANSFER
 * - All arithmetic is pure; no DB calls
 *
 * Source of truth: ADR-0030
 */

import { getDateKeyInTz, BUSINESS_TIME_ZONE } from "@/lib/domain/timezone";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CashPaymentInput {
  id: string;
  amount: number;
  status: "PENDING" | "COMPLETED" | "FAILED";
  paymentType: "RESERVATION" | "EXTRA";
  method: "MERCADO_PAGO" | "CASH" | "TRANSFER";
  paidAt: Date | null;
  deletedAt: Date | null;
}

/** Monthly aggregation: one entry per month in range (zero-filled), ascending order. */
export interface MonthlyCollectedCash {
  /** "YYYY-MM" in America/Santiago */
  monthKey: string;
  collectedCash: number;
  paymentCount: number;
  /** Subtotal within collectedCash — cash from cancelled reservation payments */
  cancelledCash: number;
}

/** Annual aggregation: full year with 12 months, byMethod breakdown, reconciliation. */
export interface AnnualCollectedCash {
  year: number;
  totalCash: number;
  byMonth: MonthlyCollectedCash[];
  /** Method → total amount. Keys: MERCADO_PAGO | CASH | TRANSFER */
  byMethod: Record<string, number>;
  paymentCount: number;
  /** Subtotal within totalCash */
  cancelledCash: number;
}

// ─── Predicate ────────────────────────────────────────────────────────────────

/**
 * Returns true if the payment is an eligible cash-basis revenue payment.
 *
 * Eligible: COMPLETED, RESERVATION, deletedAt null, paidAt not null.
 * FAILED, PENDING, EXTRA, soft-deleted, and unpaid payments are excluded.
 */
export function isEligibleCashPayment(p: CashPaymentInput): boolean {
  return (
    p.status === "COMPLETED" &&
    p.paymentType === "RESERVATION" &&
    p.deletedAt === null &&
    p.paidAt !== null
  );
}

// ─── Monthly ────────────────────────────────────────────────────────────────

/**
 * Builds monthly collected-cash series from a flat list of payments.
 *
 * @param payments — flat array of payments (caller filters to owner's scope)
 * @param rangeStart — inclusive start of the reporting range
 * @param rangeEnd — inclusive end of the reporting range
 * @param ownerTz — timezone for month boundary (default: BUSINESS_TIME_ZONE)
 * @param cancelledPaymentIds — optional Set of payment IDs that came from CANCELLED reservations
 *                             (used to compute cancelledCash subtotal)
 */
export function buildMonthlyCollectedCash(
  payments: CashPaymentInput[],
  rangeStart: Date,
  rangeEnd: Date,
  ownerTz: string = BUSINESS_TIME_ZONE,
  cancelledPaymentIds?: Set<string>,
): MonthlyCollectedCash[] {
  // Compute range in months (YYYY-MM) for zero-fill
  const startKey = getDateKeyInTz(rangeStart, ownerTz).slice(0, 7); // "YYYY-MM"
  const endKey = getDateKeyInTz(rangeEnd, ownerTz).slice(0, 7);

  // Build sorted list of all month keys in range
  const monthKeys: string[] = [];
  const [startYear, startMonth] = startKey.split("-").map(Number);
  const [endYear, endMonth] = endKey.split("-").map(Number);

  let y = startYear;
  let m = startMonth;
  while (y < endYear || (y === endYear && m <= endMonth)) {
    monthKeys.push(`${y}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }

  // Aggregate
  const bucket = new Map<string, { cash: number; count: number; cancelled: number }>();
  for (const key of monthKeys) {
    bucket.set(key, { cash: 0, count: 0, cancelled: 0 });
  }

  for (const p of payments) {
    if (!isEligibleCashPayment(p)) continue;
    if (p.paidAt === null) continue; // safety — already excluded by predicate

    const paidDay = Math.floor(p.paidAt.getTime() / 86_400_000);
    const rangeStartDay = Math.floor(rangeStart.getTime() / 86_400_000);
    const rangeEndDay = Math.floor(rangeEnd.getTime() / 86_400_000);

    // Check paidAt in range (inclusive)
    if (paidDay < rangeStartDay || paidDay > rangeEndDay) continue;

    const monthKey = getDateKeyInTz(p.paidAt, ownerTz).slice(0, 7);
    if (!bucket.has(monthKey)) continue; // outside range

    const entry = bucket.get(monthKey)!;
    entry.cash += Number(p.amount);
    entry.count += 1;
    if (cancelledPaymentIds?.has(p.id)) {
      entry.cancelled += Number(p.amount);
    }
  }

  return monthKeys.map((key) => {
    const b = bucket.get(key)!;
    return {
      monthKey: key,
      collectedCash: b.cash,
      paymentCount: b.count,
      cancelledCash: b.cancelled,
    };
  });
}

// ─── Annual ─────────────────────────────────────────────────────────────────

/**
 * Builds annual collected-cash report with full reconciliation:
 * totalCash === sum(byMonth) === sum(byMethod)
 *
 * @param payments — flat array of eligible + cancelled payments for the year
 * @param year — the calendar year to report
 * @param ownerTz — timezone (default: America/Santiago)
 * @param cancelledPaymentIds — optional Set of payment IDs from CANCELLED reservations
 */
export function buildAnnualCollectedCash(
  payments: CashPaymentInput[],
  year: number,
  ownerTz: string = BUSINESS_TIME_ZONE,
  cancelledPaymentIds?: Set<string>,
): AnnualCollectedCash {
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999);

  const byMonth = buildMonthlyCollectedCash(
    payments,
    yearStart,
    yearEnd,
    ownerTz,
    cancelledPaymentIds,
  );

  // byMethod aggregation
  const byMethod: Record<string, number> = {};
  for (const p of payments) {
    if (!isEligibleCashPayment(p)) continue;
    if (p.paidAt === null) continue;
    const paidYear = new Date(p.paidAt).getFullYear();
    if (paidYear !== year) continue;
    byMethod[p.method] = (byMethod[p.method] ?? 0) + Number(p.amount);
  }

  const totalCash = byMonth.reduce((acc, m) => acc + m.collectedCash, 0);
  const paymentCount = byMonth.reduce((acc, m) => acc + m.paymentCount, 0);
  const cancelledCash = byMonth.reduce((acc, m) => acc + m.cancelledCash, 0);

  return {
    year,
    totalCash,
    byMonth,
    byMethod,
    paymentCount,
    cancelledCash,
  };
}
