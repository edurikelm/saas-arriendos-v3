/**
 * DecisionSummary — pure domain module for ReportDecisionSummary.
 *
 * Key design decisions:
 * - `collectedCash`: ALL COMPLETED RESERVATION payments with paidAt in inclusive range
 *   [rangeStart, rangeEnd] — cash is independent of stay intersection.
 *   Cash from CANCELLED reservations is tracked as `collectedCashFromCancelledReservations`
 *   (a SUBTOTAL within collectedCash, not excluded from it).
 * - `outstandingBalance`: max(totalPrice - ALL completed RESERVATION payments, 0) for
 *   non-CANCELLED reservations intersecting the stay range. Uses paid-to-date (all payments),
 *   NOT limited to the date range.
 * - `occupiedNightUnits`, `capacityNightUnits`, `occupancyRate`: date-only intersection × unitsBooked;
 *   CANCELLED out.
 * - `reservationCount`: distinct non-CANCELLED reservation IDs intersecting range.
 * - `byBillingType` DAILY/MONTHLY; `byProperty` includes ALL properties in scope even at zero.
 * - `activity`: NONE/DAILY/MONTHLY/MIXED per property.
 * - Payment EXTRA never enters any metric.
 * - Date-only arithmetic (timezone-agnostic epoch-day).
 */

import { clipNightsToRange as clipNightsToRangeUtil } from "@/lib/reports/kpis";
import {
  buildMonthlyCollectedCash,
  buildAnnualCollectedCash,
  type CashPaymentInput as RevenueCashPaymentInput,
} from "@/lib/reports/revenue-series";
import { BUSINESS_TIME_ZONE } from "@/lib/domain/timezone";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type DecisionActivity = "NONE" | "DAILY" | "MONTHLY" | "MIXED";

export interface DecisionPaymentInput {
  id: string;
  amount: number;
  status: "PENDING" | "COMPLETED" | "FAILED";
  paymentType: "RESERVATION" | "EXTRA";
  /** Required when using cash series (ADR-0030). Optional for backward compat. */
  method?: "MERCADO_PAGO" | "CASH" | "TRANSFER";
  paidAt: Date | null;
  deletedAt: Date | null;
  dueDate: Date | null;
}

export interface DecisionReservationInput {
  id: string;
  propertyId: string;
  billingType: "DAILY" | "MONTHLY";
  status: "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED";
  startDate: Date;
  endDate: Date;
  totalPrice: number;
  unitsBooked: number;
  payments: DecisionPaymentInput[];
}

export interface DecisionPropertyInput {
  id: string;
  name: string;
  unitsAvailable: number;
}

export interface DecisionByBillingTypeEntry {
  collectedCash: number;
  collectedCashFromCancelledReservations: number;
  outstandingBalance: number;
  occupiedNightUnits: number;
  capacityNightUnits: number;
  occupancyRate: number;
  reservationCount: number;
}

export interface DecisionByPropertyEntry {
  propertyId: string;
  propertyName: string;
  activity: DecisionActivity;
  collectedCash: number;
  collectedCashFromCancelledReservations: number;
  outstandingBalance: number;
  occupiedNightUnits: number;
  capacityNightUnits: number;
  occupancyRate: number;
  reservationCount: number;
}

export interface ReportDecisionSummary {
  collectedCash: number;
  collectedCashFromCancelledReservations: number;
  outstandingBalance: number;
  occupiedNightUnits: number;
  capacityNightUnits: number;
  occupancyRate: number;
  reservationCount: number;
  byBillingType: {
    DAILY: DecisionByBillingTypeEntry;
    MONTHLY: DecisionByBillingTypeEntry;
  };
  /** Array for cross-boundary serialization (Server→Client). */
  byProperty: DecisionByPropertyEntry[];
  activity: DecisionActivity;
  /** Cash-basis revenue series — MonthlyCollectedCash[] + AnnualCollectedCash */
  cash: {
    byMonth: import("@/lib/reports/revenue-series").MonthlyCollectedCash[];
    annual: import("@/lib/reports/revenue-series").AnnualCollectedCash;
  };
}

export interface DecisionSummaryInput {
  reservations: DecisionReservationInput[];
  properties: DecisionPropertyInput[];
  rangeStart: Date;
  rangeEnd: Date;
  /** Year for annual cash series (defaults to current year). */
  annualYear?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isReservationIntersectingRange(
  reservation: DecisionReservationInput,
  rangeStart: Date,
  rangeEnd: Date,
): boolean {
  const nights = clipNightsToRangeUtil(
    reservation.startDate,
    reservation.endDate,
    rangeStart,
    rangeEnd,
  );
  return nights > 0;
}

function computeOccupiedNightUnits(
  reservation: DecisionReservationInput,
  rangeStart: Date,
  rangeEnd: Date,
): number {
  if (reservation.status === "CANCELLED") return 0;
  const nights = clipNightsToRangeUtil(
    reservation.startDate,
    reservation.endDate,
    rangeStart,
    rangeEnd,
  );
  return nights * reservation.unitsBooked;
}

function emptyBillingEntry(): DecisionByBillingTypeEntry {
  return {
    collectedCash: 0,
    collectedCashFromCancelledReservations: 0,
    outstandingBalance: 0,
    occupiedNightUnits: 0,
    capacityNightUnits: 0,
    occupancyRate: 0,
    reservationCount: 0,
  };
}

function deriveActivity(
  hasDaily: boolean,
  hasMonthly: boolean,
): DecisionActivity {
  if (!hasDaily && !hasMonthly) return "NONE";
  if (hasDaily && hasMonthly) return "MIXED";
  if (hasDaily) return "DAILY";
  return "MONTHLY";
}

function daysInRange(rangeStart: Date, rangeEnd: Date): number {
  // Date-only: timezone-agnostic epoch-day arithmetic
  const startDay = Math.floor(rangeStart.getTime() / 86_400_000);
  const endDay = Math.floor(rangeEnd.getTime() / 86_400_000);
  return endDay - startDay + 1;
}

/**
 * Inclusive range check for paidAt: [rangeStart, rangeEnd].
 * Payments on the last day of the range DO count.
 * Uses date-only epoch-day arithmetic (timezone-agnostic).
 */
function isPaidAtInRange(paidAt: Date, rangeStart: Date, rangeEnd: Date): boolean {
  const paidDay = Math.floor(paidAt.getTime() / 86_400_000);
  const rangeStartDay = Math.floor(rangeStart.getTime() / 86_400_000);
  const rangeEndDay = Math.floor(rangeEnd.getTime() / 86_400_000);
  return paidDay >= rangeStartDay && paidDay <= rangeEndDay;
}

// ─── Main computation ────────────────────────────────────────────────────────

/**
 * Builds a complete DecisionSummary from a set of reservations and properties
 * within a date range.
 *
 * Fully pure — no side effects, no database calls.
 * Returns `byProperty` as an array (serializable across Server→Client).
 */
export function buildDecisionSummary(input: DecisionSummaryInput): ReportDecisionSummary {
  const { reservations, properties, rangeStart, rangeEnd } = input;

  // Separate intersecting active vs cancelled
  const intersectingActive: DecisionReservationInput[] = [];
  const intersectingCancelled: DecisionReservationInput[] = [];

  for (const res of reservations) {
    if (!isReservationIntersectingRange(res, rangeStart, rangeEnd)) continue;
    if (res.status === "CANCELLED") {
      intersectingCancelled.push(res);
    } else {
      intersectingActive.push(res);
    }
  }

  // ── Cash: ALL COMPLETED RESERVATION payments with paidAt in inclusive range
  // [rangeStart, rangeEnd] — independent of reservation stay intersection.
  // CANCELLED cash is INCLUDED in collectedCash (collectedCashFromCancelledReservations
  // is a subtotal within collectedCash, not excluded from it).
  let collectedCash = 0;
  let collectedCashFromCancelledReservations = 0;

  for (const res of reservations) {
    const isCancelled = res.status === "CANCELLED";
    for (const p of res.payments) {
      if (
        p.status === "COMPLETED" &&
        p.paymentType === "RESERVATION" &&
        !p.deletedAt &&
        p.paidAt !== null &&
        isPaidAtInRange(p.paidAt, rangeStart, rangeEnd)
      ) {
        collectedCash += Number(p.amount);
        if (isCancelled) {
          collectedCashFromCancelledReservations += Number(p.amount);
        }
      }
    }
  }

  // ── Outstanding balance: ALL completed RESERVATION payments (paid-to-date),
  // not limited to the date range. Only for non-CANCELLED reservations intersecting stay range.
  let outstandingBalance = 0;
  for (const res of intersectingActive) {
    const totalPaidToDate = res.payments
      .filter(
        (p) =>
          p.status === "COMPLETED" &&
          p.paymentType === "RESERVATION" &&
          !p.deletedAt,
      )
      .reduce((sum, p) => sum + Number(p.amount), 0);
    outstandingBalance += Math.max(Number(res.totalPrice) - totalPaidToDate, 0);
  }

  // ── Occupancy ────────────────────────────────────────────────────────────────
  let occupiedNightUnits = 0;
  const reservationCount = intersectingActive.length;
  let hasDaily = false;
  let hasMonthly = false;

  for (const res of intersectingActive) {
    occupiedNightUnits += computeOccupiedNightUnits(res, rangeStart, rangeEnd);
    if (res.billingType === "DAILY") hasDaily = true;
    else hasMonthly = true;
  }

  const days = daysInRange(rangeStart, rangeEnd);
  const totalCapacity = properties.reduce((acc, p) => acc + days * p.unitsAvailable, 0);
  const occupancyRate =
    totalCapacity > 0
      ? Math.round((occupiedNightUnits / totalCapacity) * 100)
      : 0;

  // ── byBillingType ────────────────────────────────────────────────────────────
  const byBillingType = {
    DAILY: emptyBillingEntry(),
    MONTHLY: emptyBillingEntry(),
  };

  const dailyRes = intersectingActive.filter((r) => r.billingType === "DAILY");
  const monthlyRes = intersectingActive.filter((r) => r.billingType === "MONTHLY");

  // Occupancy per billing type
  for (const res of dailyRes) {
    byBillingType.DAILY.occupiedNightUnits += computeOccupiedNightUnits(res, rangeStart, rangeEnd);
    byBillingType.DAILY.reservationCount += 1;
  }
  for (const res of monthlyRes) {
    byBillingType.MONTHLY.occupiedNightUnits += computeOccupiedNightUnits(res, rangeStart, rangeEnd);
    byBillingType.MONTHLY.reservationCount += 1;
  }

  // Cash per billing type (all reservations with paidAt in range, both active and cancelled)
  for (const res of reservations) {
    const isCancelled = res.status === "CANCELLED";
    for (const p of res.payments) {
      if (
        p.status === "COMPLETED" &&
        p.paymentType === "RESERVATION" &&
        !p.deletedAt &&
        p.paidAt !== null &&
        isPaidAtInRange(p.paidAt, rangeStart, rangeEnd)
      ) {
        const btEntry = byBillingType[res.billingType];
        btEntry.collectedCash += Number(p.amount);
        if (isCancelled) {
          btEntry.collectedCashFromCancelledReservations += Number(p.amount);
        }
      }
    }
  }

  // Outstanding per billing type (only intersecting active)
  for (const res of dailyRes) {
    const totalPaidToDate = res.payments
      .filter((p) => p.status === "COMPLETED" && p.paymentType === "RESERVATION" && !p.deletedAt)
      .reduce((sum, p) => sum + Number(p.amount), 0);
    byBillingType.DAILY.outstandingBalance += Math.max(Number(res.totalPrice) - totalPaidToDate, 0);
  }
  for (const res of monthlyRes) {
    const totalPaidToDate = res.payments
      .filter((p) => p.status === "COMPLETED" && p.paymentType === "RESERVATION" && !p.deletedAt)
      .reduce((sum, p) => sum + Number(p.amount), 0);
    byBillingType.MONTHLY.outstandingBalance += Math.max(Number(res.totalPrice) - totalPaidToDate, 0);
  }

  // Capacity per billing type: FULL scope capacity (all properties), not just
  // properties that had that billing type. Shows what % of the portfolio
  // each model consumes.
  byBillingType.DAILY.capacityNightUnits = properties.reduce(
    (acc, p) => acc + days * p.unitsAvailable,
    0,
  );
  byBillingType.MONTHLY.capacityNightUnits = properties.reduce(
    (acc, p) => acc + days * p.unitsAvailable,
    0,
  );

  // Occupancy rate per billing type
  for (const entry of Object.values(byBillingType)) {
    entry.occupancyRate =
      entry.capacityNightUnits > 0
        ? Math.round((entry.occupiedNightUnits / entry.capacityNightUnits) * 100)
        : 0;
  }

  // ── byProperty ────────────────────────────────────────────────────────────────
  // Activity flags per property (from intersecting active reservations)
  const propHasDaily = new Map<string, boolean>();
  const propHasMonthly = new Map<string, boolean>();
  for (const res of intersectingActive) {
    if (res.billingType === "DAILY") propHasDaily.set(res.propertyId, true);
    else propHasMonthly.set(res.propertyId, true);
  }

  const byProperty: DecisionByPropertyEntry[] = properties.map((prop) => {
    const phD = propHasDaily.get(prop.id) ?? false;
    const phM = propHasMonthly.get(prop.id) ?? false;
    const activity = deriveActivity(phD, phM);

    const propIntersectingActive = intersectingActive.filter((r) => r.propertyId === prop.id);
    const propCapacity = days * prop.unitsAvailable;

    // Occupancy
    const propOcc = propIntersectingActive.reduce(
      (acc, r) => acc + computeOccupiedNightUnits(r, rangeStart, rangeEnd),
      0,
    );

    // Outstanding (all completed RESERVATION payments, paid-to-date)
    let propOutstanding = 0;
    for (const res of propIntersectingActive) {
      const totalPaidToDate = res.payments
        .filter((p) => p.status === "COMPLETED" && p.paymentType === "RESERVATION" && !p.deletedAt)
        .reduce((sum, p) => sum + Number(p.amount), 0);
      propOutstanding += Math.max(Number(res.totalPrice) - totalPaidToDate, 0);
    }

    // Cash (all property reservations with paidAt in range, active + cancelled)
    let propCash = 0;
    let propCashCancelled = 0;
    for (const res of reservations.filter((r) => r.propertyId === prop.id)) {
      const isCancelled = res.status === "CANCELLED";
      for (const p of res.payments) {
        if (
          p.status === "COMPLETED" &&
          p.paymentType === "RESERVATION" &&
          !p.deletedAt &&
          p.paidAt !== null &&
          isPaidAtInRange(p.paidAt, rangeStart, rangeEnd)
        ) {
          propCash += Number(p.amount);
          if (isCancelled) propCashCancelled += Number(p.amount);
        }
      }
    }

    return {
      propertyId: prop.id,
      propertyName: prop.name,
      activity,
      collectedCash: propCash,
      collectedCashFromCancelledReservations: propCashCancelled,
      outstandingBalance: propOutstanding,
      occupiedNightUnits: propOcc,
      capacityNightUnits: propCapacity,
      occupancyRate: propCapacity > 0 ? Math.round((propOcc / propCapacity) * 100) : 0,
      reservationCount: propIntersectingActive.length,
    };
  });

  // ── Cash series (ADR-0030: cash basis, single read, same predicate) ─────
  // Flatten all payments for the revenue-series seam.
  // We already iterated all reservations above — reuse that loop to avoid a second pass.
  const allPayments: RevenueCashPaymentInput[] = [];
  const cancelledPaymentIds = new Set<string>();

  for (const res of reservations) {
    const isCancelled = res.status === "CANCELLED";
    for (const p of res.payments) {
      // method is required for cash byMethod; default to CASH if not present (backward compat)
      const method = p.method ?? "CASH";
      allPayments.push({
        id: p.id,
        amount: Number(p.amount),
        status: p.status,
        paymentType: p.paymentType,
        method,
        paidAt: p.paidAt,
        deletedAt: p.deletedAt,
      });
      if (isCancelled) cancelledPaymentIds.add(p.id);
    }
  }

  const annualYear = input.annualYear ?? new Date().getFullYear();

  const cashByMonth = buildMonthlyCollectedCash(
    allPayments,
    rangeStart,
    rangeEnd,
    BUSINESS_TIME_ZONE,
    cancelledPaymentIds,
  );

  const cashAnnual = buildAnnualCollectedCash(
    allPayments,
    annualYear,
    BUSINESS_TIME_ZONE,
    cancelledPaymentIds,
  );

  return {
    collectedCash,
    collectedCashFromCancelledReservations,
    outstandingBalance,
    occupiedNightUnits,
    capacityNightUnits: totalCapacity,
    occupancyRate,
    reservationCount,
    byBillingType,
    byProperty,
    activity: deriveActivity(hasDaily, hasMonthly),
    cash: {
      byMonth: cashByMonth,
      annual: cashAnnual,
    },
  };
}

// ─── Exported utilities (for testability) ─────────────────────────────────────

export { clipNightsToRange } from "@/lib/reports/kpis";
