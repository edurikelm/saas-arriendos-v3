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

// ─── By method (range) ──────────────────────────────────────────────────────

/**
 * Desglosa la caja del rango seleccionado por método de pago (CASH | TRANSFER
 * | MERCADO_PAGO), sobre EXACTAMENTE el mismo conjunto de pagos elegibles y el
 * mismo predicado que `collectedCash` y `buildMonthlyCollectedCash`:
 * `isEligibleCashPayment` + `paidAt` dentro de `[rangeStart, rangeEnd]`
 * (inclusive, comparado por día-época en UTC — mismo criterio que
 * `isPaidAtInRange` en `decision-summary.ts`).
 *
 * Invariante: `sum(Object.values(buildCashByMethod(...))) === collectedCash`
 * para el mismo `payments`/`rangeStart`/`rangeEnd` (incluye pagos de reservas
 * CANCELLED, igual que `collectedCash` — ADR-0029).
 *
 * No depende de la zona horaria: a diferencia de `buildMonthlyCollectedCash`,
 * este desglose no necesita agrupar por `monthKey`, así que no requiere
 * `ownerTz`.
 */
export function buildCashByMethod(
  payments: CashPaymentInput[],
  rangeStart: Date,
  rangeEnd: Date,
): Record<string, number> {
  const rangeStartDay = Math.floor(rangeStart.getTime() / 86_400_000);
  const rangeEndDay = Math.floor(rangeEnd.getTime() / 86_400_000);

  const byMethod: Record<string, number> = {};
  for (const p of payments) {
    if (!isEligibleCashPayment(p)) continue;
    if (p.paidAt === null) continue; // safety — already excluded by predicate

    const paidDay = Math.floor(p.paidAt.getTime() / 86_400_000);
    if (paidDay < rangeStartDay || paidDay > rangeEndDay) continue;

    byMethod[p.method] = (byMethod[p.method] ?? 0) + Number(p.amount);
  }

  return byMethod;
}
