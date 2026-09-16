/**
 * Revenue Series — pure domain module for cash-basis revenue reporting.
 *
 * Key design decisions:
 * - `monthKey` = "YYYY-MM" in `America/Santiago` (getDateKeyInTz + slice to month)
 * - Rango: `rangeStart`/`rangeEnd` son DÍAS (se leen con `dateOnlyKey`, igual que
 *   la ocupación de `decision-summary`). `paidAt` es un instante y entra al rango
 *   por su día en Santiago (`isPaidAtInRange`), el mismo día que decide su mes.
 * - Predicate: COMPLETED, paymentType RESERVATION, deletedAt null, paidAt not null
 * - `cancelledCash` is a SUBTOTAL within `collectedCash` (cancelled reservation payments are INCLUDED in total)
 * - `byMethod` keys: MERCADO_PAGO | CASH | TRANSFER
 * - All arithmetic is pure; no DB calls
 *
 * Source of truth: ADR-0030
 */

import { getDateKeyInTz, dateOnlyKey, BUSINESS_TIME_ZONE } from "@/lib/domain/timezone";

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

// ─── Rango ──────────────────────────────────────────────────────────────────

/**
 * `paidAt` cae dentro de `[startKey, endKey]` (claves `YYYY-MM-DD`, inclusive)
 * según su DÍA DE NEGOCIO: el día de pared del instante en `tz` (ADR-0020).
 *
 * Es el único criterio de rango para caja. `collectedCash` (`decision-summary`),
 * la serie mensual y el desglose por método lo comparten, y la serie agrupa por
 * el mes de ese mismo día: por eso `total === sum(byMonth) === sum(byMethod)`.
 *
 * Antes se comparaba por día UTC (`Math.floor(t / 86_400_000)`). Un pago de las
 * 20:00 a las 23:59 de Santiago ya es el día siguiente en UTC: un webhook de
 * Mercado Pago aprobado a las 22:30 del 31 de agosto (`2026-09-01T01:30Z`)
 * contaba en "cobrado" de septiembre y en la serie mensual de agosto.
 */
export function isPaidAtInRange(
  paidAt: Date,
  startKey: string,
  endKey: string,
  tz: string = BUSINESS_TIME_ZONE,
): boolean {
  const paidKey = getDateKeyInTz(paidAt, tz);
  return paidKey >= startKey && paidKey <= endKey;
}

// ─── Monthly ────────────────────────────────────────────────────────────────

/**
 * Builds monthly collected-cash series from a flat list of payments.
 *
 * @param payments — flat array of payments (caller filters to owner's scope)
 * @param rangeStart — primer día del rango, inclusive (se lee con `dateOnlyKey`)
 * @param rangeEnd — último día del rango, inclusive (se lee con `dateOnlyKey`)
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
  // Los bordes son días, no instantes: leerlos en `ownerTz` corría un rango
  // anclado a medianoche UTC al día anterior y sumaba el mes previo a la serie.
  const rangeStartKey = dateOnlyKey(rangeStart);
  const rangeEndKey = dateOnlyKey(rangeEnd);

  // Build sorted list of all month keys in range
  const monthKeys: string[] = [];
  const [startYear, startMonth] = rangeStartKey.slice(0, 7).split("-").map(Number);
  const [endYear, endMonth] = rangeEndKey.slice(0, 7).split("-").map(Number);

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

    if (!isPaidAtInRange(p.paidAt, rangeStartKey, rangeEndKey, ownerTz)) continue;

    // Un día dentro del rango siempre tiene su mes entre los buckets.
    const monthKey = getDateKeyInTz(p.paidAt, ownerTz).slice(0, 7);
    if (!bucket.has(monthKey)) continue; // safety — unreachable

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
 * `isEligibleCashPayment` + `isPaidAtInRange` (día de negocio de `paidAt`
 * dentro de los días `[rangeStart, rangeEnd]`, inclusive).
 *
 * Invariante: `sum(Object.values(buildCashByMethod(...))) === collectedCash`
 * para el mismo `payments`/`rangeStart`/`rangeEnd` (incluye pagos de reservas
 * CANCELLED, igual que `collectedCash` — ADR-0029).
 *
 * Sí depende de la zona, aunque no agrupe por mes: el rango se decide por el
 * día de negocio de `paidAt`, igual que en la serie mensual.
 */
export function buildCashByMethod(
  payments: CashPaymentInput[],
  rangeStart: Date,
  rangeEnd: Date,
  ownerTz: string = BUSINESS_TIME_ZONE,
): Record<string, number> {
  const rangeStartKey = dateOnlyKey(rangeStart);
  const rangeEndKey = dateOnlyKey(rangeEnd);

  const byMethod: Record<string, number> = {};
  for (const p of payments) {
    if (!isEligibleCashPayment(p)) continue;
    if (p.paidAt === null) continue; // safety — already excluded by predicate

    if (!isPaidAtInRange(p.paidAt, rangeStartKey, rangeEndKey, ownerTz)) continue;

    byMethod[p.method] = (byMethod[p.method] ?? 0) + Number(p.amount);
  }

  return byMethod;
}
