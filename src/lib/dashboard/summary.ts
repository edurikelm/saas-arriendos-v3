/**
 * DashboardSummary — pure domain seam para `/dashboard`.
 *
 * Compone (no reimplementa) los módulos de dominio ya probados:
 * - `buildDecisionSummary` (`@/lib/reports/decision-summary`) — ADR-0028/0029/0030.
 * - `buildCollectionReportRows` + `getCollectionStatus` + `sumCollectionTotals`
 *   (`@/lib/reports/collection`, `@/lib/reports/kpis`) — fuente de verdad de
 *   cobranza (única población que ve deuda DAILY, vía `startDate` como proxy).
 * - `classifyCollectionAlerts` (`@/lib/alerts/collection-alerts`) — SOLO como
 *   enriquecimiento (paymentId/initPoint/expiresAt) de items MONTHLY.
 *
 * Este módulo es PURO: sin `"use server"`, sin Prisma, sin `new Date()`
 * implícito — todo cómputo temporal recibe `now` como parámetro.
 *
 * ⚠️ Gotcha de timezone (ADR-0020): `buildDecisionSummary` compara rangos con
 * epoch-day UTC (`Math.floor(t / 86_400_000)`). Los rangos de "hoy" y de mes
 * actual/anterior se derivan del `dateKey` (`YYYY-MM-DD`) en
 * `America/Santiago`, nunca directamente de `now`, para no cruzar el día
 * equivocado cerca de medianoche UTC.
 */

import {
  buildDecisionSummary,
  type DecisionReservationInput,
} from "@/lib/reports/decision-summary";
import {
  buildCollectionReportRows,
  getCollectionStatus,
  type CollectionReportRow,
  type CollectionReservationInput,
} from "@/lib/reports/collection";
import { sumCollectionTotals } from "@/lib/reports/kpis";
import {
  classifyCollectionAlerts,
  type CollectionAlertItem,
  type CollectionAlertPayment,
} from "@/lib/alerts/collection-alerts";
import {
  BUSINESS_TIME_ZONE,
  daysFromNowInBusinessTz,
  daysFromTodayDateOnly,
  getDateKeyInTz,
} from "@/lib/domain/timezone";
import {
  daysUntilEnd,
  daysUntilStart,
  getNights,
} from "@/components/reservations/reservation-status";

// ─── Constantes ─────────────────────────────────────────────────────────────

const DEFAULT_UPCOMING_WINDOW_DAYS = 14;
const DEFAULT_UPCOMING_LIMIT = 6;
const DEFAULT_COLLECTION_LIMIT = 4;

// ─── Tipos de input ─────────────────────────────────────────────────────────

export interface DashboardPaymentInput {
  id: string;
  amount: number;
  status: "PENDING" | "COMPLETED" | "FAILED";
  paymentType: "RESERVATION" | "EXTRA";
  method: "MERCADO_PAGO" | "CASH" | "TRANSFER";
  paidAt: Date | null;
  deletedAt: Date | null;
  dueDate: Date | null;
  initPoint: string | null;
  expiresAt: Date | null;
}

/**
 * Superset de `DecisionReservationInput` (decision-summary.ts) +
 * `CollectionReservationInput` (collection.ts), más `client.phone` y
 * `createdAt` — ninguna de las dos exige estos dos, pero el dashboard los
 * necesita: `client.phone` para acciones de contacto (movimientos/cobranza)
 * y `createdAt` para "reserva PENDING más antigua" (`DashboardToday`).
 */
export interface DashboardReservationInput {
  id: string;
  propertyId: string;
  billingType: "DAILY" | "MONTHLY";
  status: "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED";
  startDate: Date;
  endDate: Date;
  totalPrice: number;
  unitsBooked: number;
  createdAt: Date;
  property: { id: string; name: string; color: string };
  client: { id: string; name: string; phone: string | null };
  payments: DashboardPaymentInput[];
}

export interface DashboardSummaryInput {
  properties: Array<{ id: string; name: string; unitsAvailable: number }>;
  reservations: DashboardReservationInput[];
  now: Date;
  /** Ventana de días para `upcomingReservations` (tabla). Default 14. */
  upcomingWindowDays?: number;
  /** Tope de filas de `upcomingReservations`. Default 6. */
  upcomingLimit?: number;
  /** Tope de items de `collectionItems`. Default 4. */
  collectionLimit?: number;
}

// ─── Tipos de output ────────────────────────────────────────────────────────

export interface DashboardKpiDelta {
  pct: number;
  variant: "positive" | "warning" | "neutral";
  text: string;
}

export interface DashboardIncomeKpi {
  currentMonth: number;
  previousMonth: number;
  delta: DashboardKpiDelta;
}

export interface DashboardCollectionKpi {
  pendingCount: number;
  totalToCollect: number;
  overdueCount: number;
  overdueAmount: number;
  dueTodayCount: number;
  dueTodayAmount: number;
  /**
   * Cobros que vencen en los próximos 7 días (sin incluir hoy ni vencidos).
   * Scope acotado a la misma población que `collectionItems` — a diferencia
   * de `pendingCount`/`totalToCollect`, que cubren TODA deuda pendiente sin
   * ventana de tiempo. Existe para que el footer de `DashboardCobranzaList`
   * pueda mostrar el total real de vencido+hoy+próximos 7 días, no solo la
   * suma de los `collectionLimit` items visibles.
   */
  upcoming7dCount: number;
  upcoming7dAmount: number;
}

export interface DashboardUpcomingKpi {
  total: number;
  next7Days: number;
}

export interface DashboardOccupancyKpi {
  rate: number;
  occupiedNightUnits: number;
  capacityNightUnits: number;
}

export type DashboardMovementKind = "ARRIVAL" | "DEPARTURE";

export interface DashboardMovement {
  reservationId: string;
  kind: DashboardMovementKind;
  clientName: string;
  clientPhone: string | null;
  propertyName: string;
  startDate: string;
  endDate: string;
  unitsBooked: number;
}

export interface DashboardToday {
  arrivals: DashboardMovement[];
  departures: DashboardMovement[];
  inStayCount: number;
  pendingConfirmationCount: number;
  oldestPendingConfirmationDays: number | null;
  activeMonthlyContracts: number;
}

export interface DashboardUpcomingReservation {
  id: string;
  propertyId: string;
  propertyName: string;
  propertyColor: string;
  clientName: string;
  clientPhone: string | null;
  startDate: string;
  endDate: string;
  billingType: "DAILY" | "MONTHLY";
  status: string;
  totalPrice: number;
  unitsBooked: number;
  nights: number;
  daysToStart: number;
  daysToEnd: number;
  isActive: boolean;
  isArrivingToday: boolean;
}

export type DashboardCollectionBucket = "OVERDUE" | "DUE_TODAY" | "UPCOMING_7D";

export interface DashboardCollectionItem {
  bucket: DashboardCollectionBucket;
  reservationId: string;
  paymentId: string | null;
  clientName: string;
  clientPhone: string | null;
  propertyName: string;
  amount: number;
  dueDate: string | null;
  initPoint: string | null;
  expiresAt: string | null;
  daysFromToday: number | null;
}

export interface DashboardOccupancyStripReservation {
  id: string;
  propertyId: string;
  startDate: string;
  endDate: string;
  billingType: string;
  status: string;
  client: { id: string; name: string };
  property: { id: string; name: string; unitsAvailable: number };
}

export interface DashboardSummary {
  todayKey: string;
  income: DashboardIncomeKpi;
  collection: DashboardCollectionKpi;
  upcoming: DashboardUpcomingKpi;
  occupancy: DashboardOccupancyKpi;
  today: DashboardToday;
  upcomingReservations: DashboardUpcomingReservation[];
  collectionItems: DashboardCollectionItem[];
  occupancyStrip: {
    properties: Array<{ id: string; name: string; unitsAvailable: number }>;
    reservations: DashboardOccupancyStripReservation[];
  };
  isEmpty: { properties: boolean; reservations: boolean };
}

// ─── Helpers internos de fecha (wall-time SCL → UTC day para decision-summary) ─

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** `YYYY-MM-DD` → `Date` a medianoche UTC (para comparaciones epoch-day). */
function toUtcDay(key: string): Date {
  return new Date(`${key}T00:00:00.000Z`);
}

function monthStartKey(year: number, month1: number): string {
  return `${year}-${pad2(month1)}-01`;
}

function monthEndKey(year: number, month1: number): string {
  const lastDay = new Date(Date.UTC(year, month1, 0)).getUTCDate();
  return `${year}-${pad2(month1)}-${pad2(lastDay)}`;
}

function previousMonth(year: number, month1: number): { year: number; month1: number } {
  if (month1 === 1) return { year: year - 1, month1: 12 };
  return { year, month1: month1 - 1 };
}

// ─── Cómputo principal ────────────────────────────────────────────────────

export function buildDashboardSummary(input: DashboardSummaryInput): DashboardSummary {
  const now = input.now;
  const upcomingWindowDays = input.upcomingWindowDays ?? DEFAULT_UPCOMING_WINDOW_DAYS;
  const upcomingLimit = input.upcomingLimit ?? DEFAULT_UPCOMING_LIMIT;
  const collectionLimit = input.collectionLimit ?? DEFAULT_COLLECTION_LIMIT;

  // ── Rangos de fecha derivados de `todayKey` (America/Santiago), NUNCA de
  // `now` directo — evita el bug de epoch-day UTC cerca de medianoche SCL.
  const todayKey = getDateKeyInTz(now, BUSINESS_TIME_ZONE);
  const todayYear = Number(todayKey.slice(0, 4));
  const todayMonth1 = Number(todayKey.slice(5, 7));
  const prev = previousMonth(todayYear, todayMonth1);

  const monthRangeStart = toUtcDay(monthStartKey(todayYear, todayMonth1));
  const monthRangeEnd = toUtcDay(monthEndKey(todayYear, todayMonth1));
  const prevMonthRangeStart = toUtcDay(monthStartKey(prev.year, prev.month1));
  const prevMonthRangeEnd = toUtcDay(monthEndKey(prev.year, prev.month1));
  const todayUtc = toUtcDay(todayKey);

  // ── Decision summary — llamado 3 veces sobre el MISMO dataset en memoria.
  const decisionReservations: DecisionReservationInput[] = input.reservations;

  const currentMonthDecision = buildDecisionSummary({
    reservations: decisionReservations,
    properties: input.properties,
    rangeStart: monthRangeStart,
    rangeEnd: monthRangeEnd,
  });

  const previousMonthDecision = buildDecisionSummary({
    reservations: decisionReservations,
    properties: input.properties,
    rangeStart: prevMonthRangeStart,
    rangeEnd: prevMonthRangeEnd,
  });

  const todayDecision = buildDecisionSummary({
    reservations: decisionReservations,
    properties: input.properties,
    rangeStart: todayUtc,
    rangeEnd: todayUtc,
  });

  // ── Income KPI ──────────────────────────────────────────────────────────
  const currentMonthIncome = currentMonthDecision.collectedCash;
  const previousMonthIncome = previousMonthDecision.collectedCash;
  const incomePct =
    previousMonthIncome > 0
      ? Math.round(((currentMonthIncome - previousMonthIncome) / previousMonthIncome) * 100)
      : currentMonthIncome > 0
        ? 100
        : 0;
  const incomeVariant: DashboardKpiDelta["variant"] =
    incomePct > 0 ? "positive" : incomePct < 0 ? "warning" : "neutral";
  const incomeText =
    incomePct > 0
      ? `+${incomePct}% vs mes anterior`
      : incomePct < 0
        ? `${incomePct}% vs mes anterior`
        : "Sin cambio vs mes anterior";

  const income: DashboardIncomeKpi = {
    currentMonth: currentMonthIncome,
    previousMonth: previousMonthIncome,
    delta: { pct: incomePct, variant: incomeVariant, text: incomeText },
  };

  // ── Occupancy KPI (hoy) ─────────────────────────────────────────────────
  const occupancy: DashboardOccupancyKpi = {
    rate: todayDecision.occupancyRate,
    occupiedNightUnits: todayDecision.occupiedNightUnits,
    capacityNightUnits: todayDecision.capacityNightUnits,
  };

  // ── Collection: fuente de verdad = buildCollectionReportRows (ve DAILY). ──
  const collectionReservations: CollectionReservationInput[] = input.reservations.map((r) => ({
    id: r.id,
    propertyId: r.propertyId,
    propertyName: r.property.name,
    clientId: r.client.id,
    clientName: r.client.name,
    billingType: r.billingType,
    status: r.status,
    startDate: r.startDate,
    totalPrice: r.totalPrice,
    payments: r.payments.map((p) => ({
      amount: p.amount,
      status: p.status,
      paymentType: p.paymentType,
      dueDate: p.dueDate,
      deletedAt: p.deletedAt,
    })),
  }));

  const collectionRows = buildCollectionReportRows(collectionReservations, { now });
  const collectionTotals = sumCollectionTotals(collectionRows);

  const enrichedRows = collectionRows.map((row) => ({
    row,
    statusInfo: getCollectionStatus(row, now),
  }));

  const overdueRows = enrichedRows.filter((r) => r.statusInfo.status === "OVERDUE");
  const dueTodayRows = enrichedRows.filter((r) => r.statusInfo.status === "DUE_TODAY");
  const upcoming7dRows = enrichedRows.filter((r) => r.statusInfo.status === "UPCOMING");

  const dueTodayAmount = dueTodayRows.reduce(
    (sum, { row }) => sum + row.nextInstallmentAmount + row.extrasPending,
    0,
  );
  const upcoming7dAmount = upcoming7dRows.reduce(
    (sum, { row }) => sum + row.nextInstallmentAmount + row.extrasPending,
    0,
  );

  const collection: DashboardCollectionKpi = {
    pendingCount: collectionTotals.pendingInvoices,
    totalToCollect: collectionTotals.totalToCollect,
    overdueCount: overdueRows.length,
    overdueAmount: collectionTotals.totalOverdue,
    dueTodayCount: dueTodayRows.length,
    dueTodayAmount,
    upcoming7dCount: upcoming7dRows.length,
    upcoming7dAmount,
  };

  // ── Enriquecimiento (solo MONTHLY): paymentId/initPoint/expiresAt vía
  // classifyCollectionAlerts, indexado por reservationId.
  const alertPayments: CollectionAlertPayment[] = input.reservations.flatMap((r) =>
    r.payments
      .filter((p) => p.deletedAt == null)
      .map((p) => ({
        id: p.id,
        status: p.status,
        paymentType: p.paymentType,
        method: p.method,
        amount: p.amount,
        dueDate: p.dueDate ? p.dueDate.toISOString() : null,
        initPoint: p.initPoint,
        expiresAt: p.expiresAt ? p.expiresAt.toISOString() : null,
        reservation: {
          id: r.id,
          status: r.status,
          client: { name: r.client.name },
          property: { name: r.property.name },
        },
      })),
  );

  const alertsResult = classifyCollectionAlerts(alertPayments, now);
  const alertsByReservationId = new Map<string, CollectionAlertItem>();
  for (const item of [
    ...alertsResult.vencidos,
    ...alertsResult.vencenHoy,
    ...alertsResult.proximos7Dias,
  ]) {
    if (!alertsByReservationId.has(item.reservationId)) {
      alertsByReservationId.set(item.reservationId, item);
    }
  }

  const clientPhoneByReservationId = new Map(
    input.reservations.map((r) => [r.id, r.client.phone] as const),
  );
  const billingTypeByReservationId = new Map(
    input.reservations.map((r) => [r.id, r.billingType] as const),
  );

  function amountForRow(row: CollectionReportRow): number {
    return row.overdue > 0 ? row.overdue : row.nextInstallmentAmount + row.extrasPending;
  }

  function buildCollectionItem(
    row: CollectionReportRow,
    bucket: DashboardCollectionBucket,
  ): DashboardCollectionItem {
    const isMonthly = billingTypeByReservationId.get(row.reservationId) === "MONTHLY";
    const alert = isMonthly ? alertsByReservationId.get(row.reservationId) : undefined;
    return {
      bucket,
      reservationId: row.reservationId,
      paymentId: alert?.paymentId ?? null,
      clientName: row.clientName,
      clientPhone: clientPhoneByReservationId.get(row.reservationId) ?? null,
      propertyName: row.propertyName,
      amount: amountForRow(row),
      dueDate: row.nextDueDate ? row.nextDueDate.toISOString() : null,
      initPoint: alert?.initPoint ?? null,
      expiresAt: alert?.expiresAt ?? null,
      daysFromToday: row.nextDueDate ? daysFromTodayDateOnly(row.nextDueDate, now) : null,
    };
  }

  const collectionItems: DashboardCollectionItem[] = [
    ...overdueRows.map(({ row }) => buildCollectionItem(row, "OVERDUE")),
    ...dueTodayRows.map(({ row }) => buildCollectionItem(row, "DUE_TODAY")),
    ...upcoming7dRows.map(({ row }) => buildCollectionItem(row, "UPCOMING_7D")),
  ].slice(0, collectionLimit);

  // ── "Hoy": movimientos, estadías en curso, pendientes de confirmación. ───
  const arrivals: DashboardMovement[] = [];
  const departures: DashboardMovement[] = [];
  let inStayCount = 0;
  let pendingConfirmationCount = 0;
  let oldestPendingConfirmationDays: number | null = null;
  let activeMonthlyContracts = 0;

  for (const r of input.reservations) {
    if (r.status === "CANCELLED") continue;

    const startIso = r.startDate.toISOString();
    const endIso = r.endDate.toISOString();
    const daysToStart = daysUntilStart(startIso, now);
    const daysToEnd = daysUntilEnd(endIso, now);
    const isActive = daysToStart <= 0 && daysToEnd >= 0;

    if (daysToStart === 0) {
      arrivals.push({
        reservationId: r.id,
        kind: "ARRIVAL",
        clientName: r.client.name,
        clientPhone: r.client.phone,
        propertyName: r.property.name,
        startDate: startIso,
        endDate: endIso,
        unitsBooked: r.unitsBooked,
      });
    }
    if (daysToEnd === 0) {
      departures.push({
        reservationId: r.id,
        kind: "DEPARTURE",
        clientName: r.client.name,
        clientPhone: r.client.phone,
        propertyName: r.property.name,
        startDate: startIso,
        endDate: endIso,
        unitsBooked: r.unitsBooked,
      });
    }
    if (isActive) inStayCount += 1;
    if (r.billingType === "MONTHLY" && isActive) activeMonthlyContracts += 1;

    if (r.status === "PENDING") {
      pendingConfirmationCount += 1;
      const daysAgo = -daysFromNowInBusinessTz(r.createdAt, now);
      if (oldestPendingConfirmationDays === null || daysAgo > oldestPendingConfirmationDays) {
        oldestPendingConfirmationDays = daysAgo;
      }
    }
  }

  const today: DashboardToday = {
    arrivals,
    departures,
    inStayCount,
    pendingConfirmationCount,
    oldestPendingConfirmationDays,
    activeMonthlyContracts,
  };

  // ── Upcoming KPI (todo billing type, sin ventana) ─────────────────────────
  let upcomingTotal = 0;
  let upcomingNext7Days = 0;
  for (const r of input.reservations) {
    if (r.status === "CANCELLED") continue;
    const daysToStart = daysUntilStart(r.startDate.toISOString(), now);
    if (daysToStart > 0) {
      upcomingTotal += 1;
      if (daysToStart <= 7) upcomingNext7Days += 1;
    }
  }
  const upcoming: DashboardUpcomingKpi = { total: upcomingTotal, next7Days: upcomingNext7Days };

  // ── upcomingReservations (tabla): ventana `upcomingWindowDays`, DAILY. ────
  interface UpcomingCandidate {
    reservation: DashboardReservationInput;
    daysToStart: number;
    daysToEnd: number;
    isActive: boolean;
    isArrivingToday: boolean;
  }

  const upcomingCandidates: UpcomingCandidate[] = [];
  for (const r of input.reservations) {
    if (r.status === "CANCELLED" || r.billingType !== "DAILY") continue;
    const startIso = r.startDate.toISOString();
    const endIso = r.endDate.toISOString();
    const daysToStart = daysUntilStart(startIso, now);
    const daysToEnd = daysUntilEnd(endIso, now);
    const isActive = daysToStart <= 0 && daysToEnd >= 0;
    const withinWindow = isActive || (daysToStart > 0 && daysToStart <= upcomingWindowDays);
    if (!withinWindow) continue;
    upcomingCandidates.push({
      reservation: r,
      daysToStart,
      daysToEnd,
      isActive,
      isArrivingToday: daysToStart === 0,
    });
  }

  // Orden (idéntico al legacy page.tsx): llegan hoy primero (por daysToEnd asc
  // entre ellas), luego activas por daysToEnd asc, luego futuras por daysToStart asc.
  upcomingCandidates.sort((a, b) => {
    if (a.isArrivingToday !== b.isArrivingToday) return a.isArrivingToday ? -1 : 1;
    if (a.isArrivingToday && b.isArrivingToday) return a.daysToEnd - b.daysToEnd;
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
    if (a.isActive && b.isActive) return a.daysToEnd - b.daysToEnd;
    return a.daysToStart - b.daysToStart;
  });

  const upcomingReservations: DashboardUpcomingReservation[] = upcomingCandidates
    .slice(0, upcomingLimit)
    .map((c) => {
      const r = c.reservation;
      const startIso = r.startDate.toISOString();
      const endIso = r.endDate.toISOString();
      return {
        id: r.id,
        propertyId: r.propertyId,
        propertyName: r.property.name,
        propertyColor: r.property.color,
        clientName: r.client.name,
        clientPhone: r.client.phone,
        startDate: startIso,
        endDate: endIso,
        billingType: r.billingType,
        status: r.status,
        totalPrice: r.totalPrice,
        unitsBooked: r.unitsBooked,
        nights: getNights(startIso, endIso),
        daysToStart: c.daysToStart,
        daysToEnd: c.daysToEnd,
        isActive: c.isActive,
        isArrivingToday: c.isArrivingToday,
      };
    });

  // ── OccupancyStrip: dataset completo (el componente filtra DAILY + rango). ─
  const propertiesById = new Map(input.properties.map((p) => [p.id, p] as const));
  const occupancyStrip = {
    properties: input.properties.map((p) => ({
      id: p.id,
      name: p.name,
      unitsAvailable: p.unitsAvailable,
    })),
    reservations: input.reservations.map((r) => ({
      id: r.id,
      propertyId: r.propertyId,
      startDate: r.startDate.toISOString(),
      endDate: r.endDate.toISOString(),
      billingType: r.billingType,
      status: r.status,
      client: { id: r.client.id, name: r.client.name },
      property: {
        id: r.property.id,
        name: r.property.name,
        unitsAvailable: propertiesById.get(r.propertyId)?.unitsAvailable ?? 0,
      },
    })),
  };

  return {
    todayKey,
    income,
    collection,
    upcoming,
    occupancy,
    today,
    upcomingReservations,
    collectionItems,
    occupancyStrip,
    isEmpty: {
      properties: input.properties.length === 0,
      reservations: input.reservations.length === 0,
    },
  };
}
