/**
 * Trend computation for KPI comparison against previous period.
 *
 * Pure helper — no side effects, no DB calls.
 * Designed for cash-basis KPI comparison (e.g., "Ingresos cobrados" in reports).
 *
 * Test cases:
 * - actual=1000, prev=500  → direction: 'up',   pct: 100,  label: "vs período anterior"
 * - actual=500,  prev=1000  → direction: 'down', pct: -50,  label: "vs período anterior"
 * - actual=1000, prev=1000  → direction: null,   pct: null, label: "vs período anterior"
 * - actual=0,    prev=0     → direction: null,   pct: null, label: "vs período anterior"
 * - actual=500,  prev=0     → direction: 'up',   pct: null, label: "vs período anterior"
 *   (pct null when prev is 0 — division by zero)
 * - actual=0,    prev=500  → direction: 'down', pct: null, label: "vs período anterior"
 */

export type TrendDirection = "up" | "down" | null;

export interface TrendResult {
  direction: TrendDirection;
  /** Percentage change from previous period. Null when previous is 0. */
  pct: number | null;
  /** Human-readable label for the KpiCard indicator. */
  label: string;
}

/**
 * Computes trend between current and previous period values.
 *
 * @param current — current period value (e.g., collectedCash)
 * @param previous — previous period value (e.g., collectedCash of prior period)
 */
export function computeTrend(current: number, previous: number): TrendResult {
  const label = "vs período anterior";

  // Both zero → no meaningful comparison
  if (current === 0 && previous === 0) {
    return { direction: null, pct: null, label };
  }

  // Previous zero → direction is up if current > 0, but pct is indeterminate
  if (previous === 0) {
    return current > 0
      ? { direction: "up", pct: null, label }
      : { direction: null, pct: null, label };
  }

  // Current zero → direction is down
  if (current === 0) {
    return { direction: "down", pct: null, label };
  }

  const pct = Math.round(((current - previous) / previous) * 100);

  if (pct > 0) {
    return { direction: "up", pct, label };
  }
  if (pct < 0) {
    return { direction: "down", pct, label };
  }

  // pct === 0
  return { direction: null, pct: null, label };
}

// ─── P2: Top debtors selection ────────────────────────────────────────────────

import type { DecisionByPropertyEntry, ReportDecisionSummary } from "@/lib/reports/decision-summary";

/**
 * Returns the top N properties by outstandingBalance (descending).
 * Skips properties with outstandingBalance === 0.
 *
 * Pure helper for client-side useMemo over decisionSummary.byProperty.
 */
export function selectTopDebtors(
  byProperty: DecisionByPropertyEntry[],
  limit: number = 5,
): DecisionByPropertyEntry[] {
  return byProperty
    .filter((p) => p.outstandingBalance > 0)
    .sort((a, b) => b.outstandingBalance - a.outstandingBalance)
    .slice(0, limit);
}

// ─── P3: Export grouped summary from decisionSummary ─────────────────────────

export interface GroupedPropertyExport {
  propertyName: string;
  totalReservations: number;
  totalNights: number;
  reservedRevenueInRange: number;
  /** @deprecated backward compat alias for reservedRevenueInRange */
  totalRevenue: number;
  paidRevenue: number;
  pendingRevenue: number;
}

/**
 * Derives export summary rows from decisionSummary.byProperty (ADR-0029).
 *
 * Uses decisionSummary.byProperty instead of raw reservation details to ensure
 * the export reflects the same cash-basis semantics as the KPIs.
 *
 * - reservedRevenueInRange = outstandingBalance + collectedCash (total reservado)
 * - paidRevenue = collectedCash (cobrado — cash received in range)
 * - pendingRevenue = outstandingBalance (saldo pendiente)
 * - totalNights = occupiedNightUnits (noches ocupadas en rango)
 * - totalReservations = reservationCount
 *
 * Ordered by pendingRevenue descending (highest debt first).
 */
export function computeGroupedByPropertyFromSummary(
  summary: ReportDecisionSummary,
): GroupedPropertyExport[] {
  return summary.byProperty
    .map((p) => ({
      propertyName: p.propertyName,
      totalReservations: p.reservationCount,
      totalNights: p.occupiedNightUnits,
      reservedRevenueInRange: p.outstandingBalance + p.collectedCash,
      totalRevenue: p.outstandingBalance + p.collectedCash, // backward compat
      paidRevenue: p.collectedCash,
      pendingRevenue: p.outstandingBalance,
    }))
    .filter((p) => p.reservedRevenueInRange > 0 || p.pendingRevenue > 0)
    .sort((a, b) => b.pendingRevenue - a.pendingRevenue);
}
