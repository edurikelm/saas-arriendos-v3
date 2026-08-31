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
import { getInclusiveMonths } from "@/lib/reservation-dates";

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
  /**
   * Cantidad de CUOTAS vencidas (granularidad de cuota, no de reserva) —
   * suma de `row.overdueCount` sobre las filas OVERDUE. Alimenta el
   * subtítulo del header ("Tienes N cuotas vencidas") y el indicador del
   * KPI "Pagos Pendientes", ambos wording en cuotas para no mentir cuando
   * una reserva MONTHLY agrupa varias cuotas vencidas en una sola fila.
   * `overdueCount` (arriba) se queda contando RESERVAS — lo usan el tono
   * del KPI y su `indicator` previo, sin cambiar de significado.
   */
  overdueInstallmentsCount: number;
  /**
   * Monto real que muestra el footer de `DashboardCobranzaList`: suma de
   * `amountForRow` (vencido + vence-hoy/próximos-7-días + extras) sobre las
   * 3 buckets (OVERDUE, DUE_TODAY, UPCOMING). Reemplaza el cálculo legacy en
   * `page.tsx` que sumaba `overdueAmount + dueTodayAmount + upcoming7dAmount`
   * — equivalente en valor, pero ahora vive junto a `amountForRow` (misma
   * fuente de verdad) en vez de reimplementarse en la página.
   */
  windowAmount: number;
  /**
   * Cantidad de cobros (cuotas + extras) de esa misma ventana: suma de
   * `overdueCount + dueSoonCount + extrasPendingCount` sobre las 3 buckets.
   * Reemplaza el `overdueCount + dueTodayCount + upcoming7dCount` (conteo de
   * RESERVAS) que usaba `page.tsx` — ahora cuenta cobros, coherente con
   * `windowAmount`.
   */
  windowCount: number;
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
  /** Meses inclusivos (`getInclusiveMonths`). `0` para `DAILY`. */
  months: number;
  /**
   * Monto de UNA cuota mensual (no el contrato completo). `null` para
   * `DAILY`. Ver `computeInstallmentAmount` para la derivación.
   */
  installmentAmount: number | null;
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
  /** Cantidad de cuotas vencidas detrás de esta fila (`row.overdueCount`). */
  overdueCount: number;
  /**
   * Cantidad de cuotas que vencen hoy o dentro de los próximos 7 días
   * detrás de esta fila (`row.dueSoonCount`). No incluye la cuota vencida
   * más temprana que ya representa `dueDate`/`daysFromToday`.
   */
  dueSoonCount: number;
  /**
   * Días hasta la cuota impaga más temprana dentro de la ventana de
   * `dueSoonCount` (`row.dueSoonNextDueDate` convertido a días). `null`
   * cuando `dueSoonCount === 0`. Distinto de `daysFromToday`, que siempre
   * apunta a la cuota impaga MÁS temprana (la vencida, si existe una).
   */
  dueSoonDaysFromToday: number | null;
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
  /**
   * Reservas EN CURSO hoy (`isActive`), ambos billing types, sin ventana —
   * una reserva en curso lo está sin importar cuán lejos esté su fin. Vista
   * "Activas" de la tabla de agenda: coincide 1:1 con el pill de estado
   * "Activa" (`getTemporalStatus`), igual que `upcomingReservations` coincide
   * con el pill "Próxima".
   */
  activeReservations: DashboardUpcomingReservation[];
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

  // `pendingCount` cuenta COBROS (cuotas + extras impagos), no reservas —
  // el KPI se llama "Pagos Pendientes". `sumCollectionTotals.pendingInvoices`
  // cuenta reservas con deuda (correcto para /reports, donde ese es el
  // significado esperado); NO se toca ese helper.
  const pendingCount = collectionRows.reduce((sum, row) => sum + row.pendingChargesCount, 0);

  // Ventana real del card (vencido + vence hoy + próximos 7 días): monto y
  // cantidad de COBROS, no de reservas. `windowAmount` reemplaza el cálculo
  // legacy de `page.tsx` (`overdueAmount + dueTodayAmount + upcoming7dAmount`,
  // que sub-contaba cuando una fila OVERDUE tenía además cuotas por vencer
  // dentro de los 7 días — el bug que este cambio corrige). Se computa con
  // `amountForRow`, definida más abajo (function declaration, hoisted).
  const windowRows = [...overdueRows, ...dueTodayRows, ...upcoming7dRows];
  const overdueInstallmentsCount = overdueRows.reduce((sum, { row }) => sum + row.overdueCount, 0);

  const collection: DashboardCollectionKpi = {
    pendingCount,
    totalToCollect: collectionTotals.totalToCollect,
    overdueCount: overdueRows.length,
    overdueAmount: collectionTotals.totalOverdue,
    dueTodayCount: dueTodayRows.length,
    dueTodayAmount,
    upcoming7dCount: upcoming7dRows.length,
    upcoming7dAmount,
    overdueInstallmentsCount,
    windowAmount: windowRows.reduce((sum, { row }) => sum + amountForRow(row), 0),
    windowCount: windowRows.reduce(
      (sum, { row }) => sum + row.overdueCount + row.dueSoonCount + row.extrasPendingCount,
      0,
    ),
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

  /**
   * Monto real de la fila dentro de la ventana de cobranza del dashboard
   * (vencido + vence-hoy/próximos-7-días + extras impagos). Reemplaza el
   * cálculo legacy `overdue > 0 ? overdue : nextInstallmentAmount +
   * extrasPending`, que en una reserva MONTHLY con varias cuotas colapsaba
   * el monto a UNA sola cuota — origen del bug reportado ("1 cobro ·
   * $500.000" quedándose corto en las cuotas por vencer). Deliberadamente
   * NO usa `totalToCollect`: en un contrato de 12 meses eso mostraría el
   * arriendo del año entero.
   */
  function amountForRow(row: CollectionReportRow): number {
    const windowed = row.overdue + row.dueSoon + row.extrasPending;
    if (windowed > 0) return windowed;
    // Fallback defensivo: fila DUE_TODAY por el caso borde documentado en
    // `getCollectionStatus` (daysDiff < 0 sin overdue, cambio de día en
    // Santiago) donde `overdue` y `dueSoon` dan 0 aunque la fila sí tenga
    // una próxima cuota. Preserva el comportamiento previo en vez de $0.
    return row.nextInstallmentAmount + row.extrasPending;
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
      overdueCount: row.overdueCount,
      dueSoonCount: row.dueSoonCount,
      dueSoonDaysFromToday: row.dueSoonNextDueDate
        ? daysFromTodayDateOnly(row.dueSoonNextDueDate, now)
        : null,
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

  // ── Upcoming KPI ─────────────────────────────────────────────────────────
  // Alineado con la misma regla de población y la misma ventana
  // (`upcomingWindowDays`) que `upcomingReservations` (tabla, más abajo):
  // cuenta reservas que AÚN NO llegan (`daysToStart > 0`) dentro de la
  // ventana, sin distinguir billing type. Para MONTHLY esto es exactamente
  // el "evento de inicio en la ventana" — un contrato mensual solo tiene
  // `daysToStart > 0` mientras no ha arrancado, así que no hace falta un
  // chequeo de billing type aparte: la misma condición de ventana YA es el
  // filtro de población.
  //
  // Relación con la vista homónima de la tabla: este KPI es el conteo SIN
  // TOPE (`upcomingLimit`) de exactamente la misma población que la vista
  // "Próximas" — misma condición (`daysToStart > 0 && <= upcomingWindowDays`),
  // ambos billing types. Ya no hace falta la salvedad de "más las activas":
  // desde que la tabla separó "Próximas" (pill "Próxima") de "Activas" (pill
  // "Activa") en dos vistas distintas, el KPI y la vista "Próximas" cuentan
  // exactamente lo mismo, solo que una topada y la otra no.
  let upcomingTotal = 0;
  let upcomingNext7Days = 0;
  for (const r of input.reservations) {
    if (r.status === "CANCELLED") continue;
    const daysToStart = daysUntilStart(r.startDate.toISOString(), now);
    if (daysToStart > 0 && daysToStart <= upcomingWindowDays) {
      upcomingTotal += 1;
      if (daysToStart <= 7) upcomingNext7Days += 1;
    }
  }
  const upcoming: DashboardUpcomingKpi = { total: upcomingTotal, next7Days: upcomingNext7Days };

  // ── upcomingReservations / activeReservations (tabla "Agenda de reservas"):
  // dos poblaciones disjuntas que coinciden 1:1 con el pill de estado
  // temporal que ve el dueño en cada fila (`getTemporalStatus`,
  // `@/components/reservations/reservation-status`):
  //   - "Próxima" (`daysToStart > 0`) → vista `upcomingReservations`.
  //   - "Activa"  (`daysToStart <= 0 && daysToEnd >= 0`) → vista `activeReservations`.
  // Nunca al revés — si una fila con pill "Activa" apareciera en la vista
  // "Próximas", la tabla se contradice sola. Por eso ambas poblaciones se
  // derivan del MISMO cómputo de `daysToStart`/`daysToEnd`/`isActive` sobre
  // el mismo dataset, en vez de reglas independientes que podrían divergir.
  interface ReservationCandidate {
    reservation: DashboardReservationInput;
    daysToStart: number;
    daysToEnd: number;
    isActive: boolean;
    isArrivingToday: boolean;
  }

  const candidates: ReservationCandidate[] = [];
  for (const r of input.reservations) {
    if (r.status === "CANCELLED") continue;
    const startIso = r.startDate.toISOString();
    const endIso = r.endDate.toISOString();
    const daysToStart = daysUntilStart(startIso, now);
    const daysToEnd = daysUntilEnd(endIso, now);
    const isActive = daysToStart <= 0 && daysToEnd >= 0;

    candidates.push({
      reservation: r,
      daysToStart,
      daysToEnd,
      isActive,
      isArrivingToday: daysToStart === 0,
    });
  }

  // "Próximas": estrictamente futuras, ambos billing types, dentro de la
  // ventana. Para MONTHLY el inicio de contrato es una llegada (mudanza,
  // evento de agenda) — misma condición que DAILY, sin chequeo de billing
  // type aparte. Un contrato MONTHLY en curso sin evento cercano NO entra
  // aquí (no tiene `daysToStart > 0`); un término de contrato tampoco es un
  // evento de agenda (no pasa nada ese día) y queda fuera de la tabla.
  const upcomingCandidates = candidates.filter(
    (c) => c.daysToStart > 0 && c.daysToStart <= upcomingWindowDays,
  );
  upcomingCandidates.sort((a, b) => a.daysToStart - b.daysToStart);

  // "Activas": en curso hoy (incluye las que llegan hoy — `daysToStart === 0`
  // cae dentro de `[start, end]`, así que su pill es "Activa"), ambos billing
  // types, SIN ventana — una reserva en curso lo está sin importar cuán lejos
  // esté su fin.
  const activeCandidates = candidates.filter((c) => c.isActive);
  activeCandidates.sort((a, b) => {
    if (a.isArrivingToday !== b.isArrivingToday) return a.isArrivingToday ? -1 : 1;
    return a.daysToEnd - b.daysToEnd;
  });

  /**
   * Monto de UNA cuota mensual (no el contrato completo). `generateMonthlyPayments`
   * (`@/lib/payments/monthly`) genera cuotas de monto idéntico
   * (`monthlyPrice × unitsBooked`), así que basta tomar el `amount` de la
   * cuota `RESERVATION` (no `EXTRA`, no soft-deleted) con el `dueDate` más
   * temprano. Fallback defensivo cuando la reserva MONTHLY no tiene filas de
   * `Payment` (no debería pasar en producción, pero el tipo lo permite):
   * `totalPrice / months`, redondeado.
   */
  function computeInstallmentAmount(
    r: DashboardReservationInput,
    months: number,
  ): number | null {
    if (r.billingType !== "MONTHLY") return null;
    const installments = r.payments.filter(
      (p) => p.paymentType === "RESERVATION" && p.deletedAt == null && p.dueDate !== null,
    );
    if (installments.length > 0) {
      const earliest = installments.reduce((min, p) =>
        (p.dueDate as Date) < (min.dueDate as Date) ? p : min,
      );
      return earliest.amount;
    }
    return months > 0 ? Math.round(r.totalPrice / months) : null;
  }

  function mapCandidateToRow(c: ReservationCandidate): DashboardUpcomingReservation {
    const r = c.reservation;
    const startIso = r.startDate.toISOString();
    const endIso = r.endDate.toISOString();
    const months = r.billingType === "MONTHLY" ? getInclusiveMonths(startIso, endIso) : 0;
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
      months,
      installmentAmount: computeInstallmentAmount(r, months),
      daysToStart: c.daysToStart,
      daysToEnd: c.daysToEnd,
      isActive: c.isActive,
      isArrivingToday: c.isArrivingToday,
    };
  }

  const upcomingReservations: DashboardUpcomingReservation[] = upcomingCandidates
    .slice(0, upcomingLimit)
    .map(mapCandidateToRow);

  const activeReservations: DashboardUpcomingReservation[] = activeCandidates
    .slice(0, upcomingLimit)
    .map(mapCandidateToRow);

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
    activeReservations,
    collectionItems,
    occupancyStrip,
    isEmpty: {
      properties: input.properties.length === 0,
      reservations: input.reservations.length === 0,
    },
  };
}
