/**
 * DashboardSummary — pure domain seam para `/dashboard`.
 *
 * Compone (no reimplementa) los módulos de dominio ya probados:
 * - `buildDecisionSummary` (`@/lib/reports/decision-summary`) — ADR-0028/0029/0030,
 *   fuente de `month.collected`, `month.collectedPreviousSamePeriod` y la
 *   ocupación del mes en curso.
 * - `buildCollectionReportRows` + `getCollectionStatus` + `sumCollectionTotals`
 *   (`@/lib/reports/collection`, `@/lib/reports/kpis`) — fuente de verdad de
 *   cobranza (única población que ve deuda DAILY, vía `startDate` como proxy)
 *   y también de `agenda[].amountDue`, vía la MISMA ventana completa.
 * - `getReservationPendingAmount` (`@/lib/payments/calculations`) — saldo del
 *   arriendo, usado por `computeNextCharge` cuando la reserva no tiene ningún
 *   `Payment` RESERVATION impago (caso DAILY sin cuotas, ADR-0017 Nivel 3).
 *
 * Produce cuatro piezas para la página:
 * - `collection`/`collectionItems` — cobros pendientes (sin cambios en esta
 *   iteración; ver CONTEXT.md "/dashboard — sección Cobros pendientes").
 * - `agenda` — llegadas/salidas por día en un horizonte de `AGENDA_HORIZON_DAYS`.
 * - `propertyBoard` — estado de cada propiedad HOY (ocupada/parcial/libre),
 *   incluyendo Bloqueos de Canal Externo.
 * - `month` — cobrado del mes en curso vs mismo período del mes anterior, y
 *   ocupación del mes en curso.
 *
 * Este módulo es PURO: sin `"use server"`, sin Prisma, sin `new Date()`
 * implícito — todo cómputo temporal recibe `now` como parámetro.
 *
 * ⚠️ Gotcha de timezone (ADR-0020): `buildDecisionSummary` recibe el rango como
 * DÍAS (`dateOnlyFromKey`, leídos por día UTC) y ubica cada `paidAt` por su día
 * en Santiago (ADR-0038). Los rangos de mes actual/anterior se derivan del
 * `dateKey` (`YYYY-MM-DD`) en `America/Santiago`, nunca directamente de `now`,
 * para no cruzar el día equivocado cerca de medianoche UTC. `agenda` y `propertyBoard`, en cambio,
 * operan enteramente sobre `dateKey`s (`dateOnlyKey`/`addDaysToDateKey`/
 * `dateKeyToDayIndex`), sin pasar por epoch-day de `Date`.
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
import { getReservationPendingAmount } from "@/lib/payments/calculations";
import {
  addDaysToDateKey,
  BUSINESS_TIME_ZONE,
  dateKeyToDayIndex,
  dateOnlyFromKey,
  dateOnlyKey,
  daysFromTodayDateOnly,
  getDateKeyInTz,
} from "@/lib/domain/timezone";
import { getNights } from "@/components/reservations/reservation-status";
import { getInclusiveMonths } from "@/lib/reservation-dates";

// ─── Constantes ─────────────────────────────────────────────────────────────

// 6 y no 4: el 4 salió de igualar la altura de la tabla de reservas que tenía
// el inicio antes de ADR-0036. Con el inicio en columnas esa tabla ya no existe
// y Cobros es la columna más corta de las tres.
const DEFAULT_COLLECTION_LIMIT = 6;

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
  /** Cuándo se creó el `Payment`. Desempata `computeNextCharge` cuando dos cobros no tienen `dueDate`. */
  createdAt: Date;
  /** Ordinal de cuota (arriendos MONTHLY). `null` fuera de esos casos. */
  installmentIndex: number | null;
  /** Título del pago. Obligatorio solo para `paymentType: EXTRA` (CONTEXT.md). */
  title: string | null;
}

/**
 * Superset de `DecisionReservationInput` (decision-summary.ts) +
 * `CollectionReservationInput` (collection.ts), más `client.phone`/`client.email`
 * — ninguna de las dos lo exige, pero `collectionItems` los necesita para
 * acciones de contacto (WhatsApp/email vía `SendPaymentLinkDialog`).
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
  property: { id: string; name: string; color: string };
  client: { id: string; name: string; phone: string | null; email: string };
  payments: DashboardPaymentInput[];
}

export type DashboardExternalChannel = "AIRBNB" | "BOOKING_COM" | "VRBO" | "OTHER";

/**
 * Bloqueo de Canal Externo ACTIVE. Solo alimenta el tablero de propiedades:
 * consume 1 unidad por cada noche que cubre, igual que en la disponibilidad
 * (CONTEXT.md, "Calendarios Externos"). Nunca es un evento de agenda ni una
 * cifra financiera (ADR-0018: iCal no es fuente financiera).
 */
export interface DashboardExternalBlockInput {
  propertyId: string;
  /** Date-only del dominio, misma convención de Última Noche que una reserva. */
  startDate: Date;
  endDate: Date;
  channel: DashboardExternalChannel;
}

export interface DashboardSummaryInput {
  /** `color` es el que el dueño eligió para la propiedad; solo identifica, no calcula nada. */
  properties: Array<{ id: string; name: string; unitsAvailable: number; color?: string | null }>;
  reservations: DashboardReservationInput[];
  /** Bloqueos ACTIVE. Opcional: sin iCal (plan FREE) no hay ninguno. */
  externalBlocks?: DashboardExternalBlockInput[];
  now: Date;
  /** Tope de items de `collectionItems`. Default 6. */
  collectionLimit?: number;
}

// ─── Tipos de output ────────────────────────────────────────────────────────

/**
 * Reparto de los cobros de una fila entre los dos grupos del card.
 * Interno: la UI consume `DashboardCollectionGroupTotal`, ya agregado.
 */
interface CollectionWindowSplit {
  overdueAmount: number;
  overdueCount: number;
  dueSoonAmount: number;
  dueSoonCount: number;
}

/**
 * Los DOS grupos visuales del card de cobranza. Deliberadamente dos y no
 * tres: la distincion "vence hoy" vs "vence en N dias" la carga el texto de
 * vencimiento de cada fila, mas preciso que un encabezado.
 */
export type DashboardCollectionGroup = "OVERDUE" | "DUE_SOON";

export interface DashboardCollectionGroupTotal {
  /** Monto de los cobros del grupo en la ventana completa. */
  amount: number;
  /** Cantidad de cobros (cuotas o extras) del grupo en la ventana completa. */
  count: number;
  /**
   * Porcion de `amount`/`count` que pertenece a filas truncadas por
   * `collectionLimit` — cobros que NO tienen ninguna representacion visible
   * en el card. Los cobros de una fila visible NO cuentan como ocultos
   * aunque su grupo no sea el que la contiene: viven en el monto y en la
   * linea de vencimiento de esa fila ("+1 vence en 4 dias").
   *
   * Alimenta la afordancia "+N cobros mas" al pie del grupo, para que la
   * aritmetica del card nunca cierre en falso.
   */
  hiddenAmount: number;
  hiddenCount: number;
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
  /**
   * Desglose de `windowAmount`/`windowCount` en los DOS grupos que renderiza
   * `DashboardCobranzaList` (vencidos · por vencer). El reparto es por
   * COBRO, no por reserva: una reserva con 2 cuotas vencidas + 1 por vencer
   * aporta 2 cobros a OVERDUE y 1 a DUE_SOON, aunque su fila se renderice
   * entera bajo "Vencidos". Ver `windowSplitForRow`.
   *
   * Existen porque los encabezados de grupo del card muestran subtotal: se
   * derivan de la ventana COMPLETA, no de los `collectionLimit` items
   * visibles. Derivarlos de los items visibles mentiria en cuanto hay mas
   * cobros de los que caben — el mismo motivo por el que el footer usa
   * `windowAmount` y no la suma de `items`.
   *
   * Invariante: `windowGroups.OVERDUE.<f> + windowGroups.DUE_SOON.<f> ===
   * window<F>` para amount y count.
   */
  windowGroups: Record<DashboardCollectionGroup, DashboardCollectionGroupTotal>;
}

export type DashboardCollectionBucket = "OVERDUE" | "DUE_TODAY" | "UPCOMING_7D";

/**
 * El próximo cobro accionable de una reserva — la base de las acciones
 * "Registrar pago" / "Enviar link" de "Por cobrar" (Nivel 3, ADR-0017).
 *
 * `EXISTING`: ya hay un `Payment` PENDING o FAILED sobre el que actuar
 * (marcar pagado, generar/reenviar su link). `NEW`: el arriendo tiene saldo
 * pero ningún `Payment` — el caso medido en producción de reservas DAILY con
 * deuda, que no generan cuotas automáticamente (CONTEXT.md, ADR-0036 "Fuera
 * de alcance"). Ahí la acción real es CREAR el cobro, no marcarlo.
 */
export type DashboardNextCharge =
  | {
      kind: "EXISTING";
      paymentId: string;
      paymentType: "RESERVATION" | "EXTRA";
      status: "PENDING" | "FAILED";
      amount: number;
      method: "MERCADO_PAGO" | "CASH" | "TRANSFER";
      installmentIndex: number | null;
      /** Mayor installmentIndex entre los pagos RESERVATION no borrados de la reserva; null si no hay cuotas. */
      installmentCount: number | null;
      dueDate: string | null;
      title: string | null;
      initPoint: string | null;
      expiresAt: string | null;
    }
  | { kind: "NEW"; /** Saldo del arriendo sin cobro creado. */ amount: number };

export interface DashboardCollectionItem {
  bucket: DashboardCollectionBucket;
  reservationId: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string | null;
  propertyName: string;
  amount: number;
  dueDate: string | null;
  /** `null` cuando la reserva quedó saldada entre el cálculo de la fila y este mapeo (defensivo; no debería ocurrir). */
  nextCharge: DashboardNextCharge | null;
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
  /**
   * Tipo de arriendo de la reserva detras del cobro. El card lo muestra como
   * label junto a la propiedad ("Teja 1 · Mensual") — es el dato que explica
   * por que una fila puede agrupar varias cuotas y la otra no.
   */
  billingType: "DAILY" | "MONTHLY";
}

// ─── Agenda: movimientos de los próximos días ───────────────────────────────

/** Horizonte de la agenda: hoy + los 6 días siguientes. */
export const AGENDA_HORIZON_DAYS = 7;

/**
 * Las dos cosas que pasan físicamente en una propiedad. Se aplican igual a
 * DAILY y a MONTHLY: el inicio de un contrato es una llegada (entrega de
 * llaves) y su término es una salida (entrega de la propiedad).
 */
export type DashboardAgendaEventKind = "ARRIVAL" | "DEPARTURE";

export interface DashboardAgendaEvent {
  kind: DashboardAgendaEventKind;
  reservationId: string;
  propertyId: string;
  propertyName: string;
  clientName: string;
  billingType: "DAILY" | "MONTHLY";
  /** Noches de la estadía completa (convención Última Noche). */
  nights: number;
  /** Meses inclusivos (`getInclusiveMonths`). `0` para DAILY. */
  months: number;
  /**
   * `YYYY-MM-DD` de la Última Noche (`endDate`, CONTEXT.md): la última noche
   * que duerme el huésped, no el día de salida (ese es el día siguiente).
   */
  lastNightDateKey: string;
  unitsBooked: number;
  /**
   * Plata exigible de la reserva: el MISMO monto que su fila en "Por cobrar"
   * (`amountForRow`) cuando la reserva está en la ventana de cobranza
   * (vencido / vence hoy / próximos 7 días), y `0` si no lo está. Sale de la
   * ventana completa, no de `collectionItems` (que viene truncado): una
   * reserva que no alcanzó a entrar en las filas visibles igual debe su plata.
   */
  amountDue: number;
  /**
   * `true` si la reserva no tiene ningún pago `RESERVATION` `COMPLETED`.
   * Distingue "sin pagos" de "saldo" en la fila.
   */
  hasNoPayments: boolean;
  /** Color de la propiedad (dato del usuario). La UI cae a `--primary` sin él. */
  propertyColor?: string | null;
}

export interface DashboardAgendaDay {
  /** `YYYY-MM-DD`, wall-time America/Santiago. */
  dateKey: string;
  /** Días desde hoy: 0 = hoy, 1 = mañana. */
  offset: number;
  /**
   * Salidas primero y después llegadas —el orden real del día: la unidad se
   * libera antes de volver a ocuparse—; dentro de cada tipo, por propiedad y
   * luego por cliente.
   */
  events: DashboardAgendaEvent[];
}

export interface DashboardAgenda {
  horizonDays: number;
  /**
   * Hoy SIEMPRE, aunque no tenga eventos, más cada día del horizonte que tenga
   * al menos uno, en orden. Los días sin movimiento no aparecen.
   */
  days: DashboardAgendaDay[];
  /**
   * Primer día con eventos después del horizonte, para que una semana quieta
   * diga cuándo vuelve a pasar algo. `null` si no hay ninguno.
   */
  nextEventAfterHorizon: { dateKey: string; offset: number } | null;
}

// ─── Tablero de propiedades: quién ocupa cada una hoy ───────────────────────

export type DashboardPropertyState = "OCCUPIED" | "PARTIAL" | "FREE";

export interface DashboardPropertyOccupant {
  source: "RESERVATION" | "EXTERNAL_BLOCK";
  /** `null` para bloqueos externos. */
  reservationId: string | null;
  /** `null` para bloqueos externos. */
  billingType: "DAILY" | "MONTHLY" | null;
  /** Canal del bloqueo; `null` para reservas. */
  channel: DashboardExternalChannel | null;
  /** Última noche (`endDate`), `YYYY-MM-DD`. */
  lastNightKey: string;
  /** Día en que se libera la unidad: última noche + 1 (salida o entrega). */
  releaseDateKey: string;
}

export interface DashboardPropertyStatus {
  propertyId: string;
  propertyName: string;
  /** Color de la propiedad (dato del usuario). La UI cae a `--primary` sin él. */
  propertyColor?: string | null;
  unitsAvailable: number;
  /**
   * Unidades consumidas la noche de HOY: Σ `unitsBooked` de las reservas no
   * canceladas con `startDate <= hoy <= endDate`, más 1 por cada bloqueo
   * externo que cubra hoy. Misma regla que la disponibilidad. Sin tope: con
   * sobreventa puede superar `unitsAvailable`.
   */
  unitsOccupied: number;
  /** `unitsOccupied >= unitsAvailable` → OCCUPIED; `> 0` → PARTIAL; `0` → FREE. */
  state: DashboardPropertyState;
  /**
   * Ocupante de hoy que se libera primero (menor `releaseDateKey`). `null`
   * cuando `state === "FREE"`.
   */
  nextRelease: DashboardPropertyOccupant | null;
  /** Próxima llegada estrictamente futura (`startDate > hoy`) de una reserva no cancelada. */
  nextArrival: { reservationId: string; dateKey: string } | null;
}

export interface DashboardPropertyBoard {
  /**
   * TODAS las propiedades, también las libres y sin reservas. Orden:
   * ocupadas/parciales por `nextRelease.releaseDateKey` ascendente; después
   * libres con `nextArrival` ascendente; al final libres sin llegada, por
   * nombre. Empates, por nombre.
   */
  properties: DashboardPropertyStatus[];
  /** Σ min(unitsOccupied, unitsAvailable): la sobreventa no infla el conteo. */
  occupiedUnits: number;
  totalUnits: number;
  /** Todas las propiedades tienen 1 unidad: la UI puede contar "propiedades". */
  allSingleUnit: boolean;
}

// ─── El mes en curso ────────────────────────────────────────────────────────

export interface DashboardMonthPulse {
  /** `YYYY-MM` del mes en curso (America/Santiago). */
  monthKey: string;
  /** Día del mes de hoy, 1-31. */
  dayOfMonth: number;
  /** Cobrado en el mes en curso: `collectedCash` de `buildDecisionSummary` (ADR-0028). */
  collected: number;
  /** `YYYY-MM` del mes anterior. */
  previousMonthKey: string;
  /** Día de corte del mes anterior: `min(dayOfMonth, último día de ese mes)`. */
  previousCutoffDay: number;
  /**
   * Cobrado entre el día 1 y `previousCutoffDay` del mes anterior. Comparar
   * contra el mes anterior COMPLETO hacía que cada comienzo de mes marcara
   * caída aunque el negocio fuera igual.
   */
  collectedPreviousSamePeriod: number;
  /** Ocupación del mes calendario completo, noches ya reservadas incluidas. */
  occupancyRate: number;
  occupiedNightUnits: number;
  capacityNightUnits: number;
}

export interface DashboardSummary {
  todayKey: string;
  collection: DashboardCollectionKpi;
  collectionItems: DashboardCollectionItem[];
  agenda: DashboardAgenda;
  propertyBoard: DashboardPropertyBoard;
  month: DashboardMonthPulse;
  isEmpty: { properties: boolean; reservations: boolean };
}

// ─── Helpers internos de fecha (wall-time SCL → días para decision-summary) ─

function pad2(n: number): string {
  return String(n).padStart(2, "0");
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
  const collectionLimit = input.collectionLimit ?? DEFAULT_COLLECTION_LIMIT;

  // ── Rangos de fecha derivados de `todayKey` (America/Santiago), NUNCA de
  // `now` directo — evita el bug de epoch-day UTC cerca de medianoche SCL.
  const todayKey = getDateKeyInTz(now, BUSINESS_TIME_ZONE);
  const todayYear = Number(todayKey.slice(0, 4));
  const todayMonth1 = Number(todayKey.slice(5, 7));
  const prev = previousMonth(todayYear, todayMonth1);

  const monthRangeStart = dateOnlyFromKey(monthStartKey(todayYear, todayMonth1));
  const monthRangeEnd = dateOnlyFromKey(monthEndKey(todayYear, todayMonth1));

  // ── Decision summary del mes en curso — alimenta `month.collected` y la
  // ocupación del mes (`month.occupancyRate`/`occupiedNightUnits`/
  // `capacityNightUnits`). La comparación "mismo período" del mes anterior
  // se resuelve más abajo, junto al resto de `month`, con un segundo rango.
  const decisionReservations: DecisionReservationInput[] = input.reservations;

  const currentMonthDecision = buildDecisionSummary({
    reservations: decisionReservations,
    properties: input.properties,
    rangeStart: monthRangeStart,
    rangeEnd: monthRangeEnd,
  });

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
  // dentro de los 7 días). Se computa con `windowSplitForRow`, definida más
  // abajo (function declaration, hoisted).
  //
  // El orden de esta lista ES el orden de render del card, y `collectionItems`
  // sale de cortarla en `collectionLimit`: por eso vive acá y no junto a los
  // items — el desglose por grupo necesita saber qué filas quedaron fuera
  // para poder reportar la porción sin representación visible. La agenda
  // (más abajo) reusa esta MISMA lista completa para `amountDue`.
  const orderedWindowRows: Array<{
    row: CollectionReportRow;
    bucket: DashboardCollectionBucket;
  }> = [
    ...overdueRows.map(({ row }) => ({ row, bucket: "OVERDUE" as const })),
    ...dueTodayRows.map(({ row }) => ({ row, bucket: "DUE_TODAY" as const })),
    ...upcoming7dRows.map(({ row }) => ({ row, bucket: "UPCOMING_7D" as const })),
  ];
  const visibleWindowRows = orderedWindowRows.slice(0, collectionLimit);
  const hiddenWindowRows = orderedWindowRows.slice(collectionLimit);

  // Desglose por grupo visual del card (vencidos · por vencer), repartiendo
  // cada fila POR COBRO — no metiendo la fila entera en el grupo de su
  // estado. La versión anterior sumaba `overdue + dueSoon + extrasPending`
  // de cada fila OVERDUE al encabezado "Vencidos", así que ese encabezado
  // contaba plata que no estaba vencida (issue #238): una fila con 2 cuotas
  // vencidas + 1 por vencer aportaba 3 a "Vencidos" . Ahora aporta 2 a
  // OVERDUE y 1 a DUE_SOON, y la palabra del encabezado dice la verdad sin
  // que se rompa la suma con el footer.
  const windowTotals = sumWindowSplit(orderedWindowRows);
  const hiddenTotals = sumWindowSplit(hiddenWindowRows);
  const windowGroups: Record<DashboardCollectionGroup, DashboardCollectionGroupTotal> = {
    OVERDUE: {
      amount: windowTotals.overdueAmount,
      count: windowTotals.overdueCount,
      hiddenAmount: hiddenTotals.overdueAmount,
      hiddenCount: hiddenTotals.overdueCount,
    },
    DUE_SOON: {
      amount: windowTotals.dueSoonAmount,
      count: windowTotals.dueSoonCount,
      hiddenAmount: hiddenTotals.dueSoonAmount,
      hiddenCount: hiddenTotals.dueSoonCount,
    },
  };

  // Una sola fuente para el número de cuotas vencidas: el subtítulo del
  // header ("Tienes N cuotas vencidas") y el encabezado "Vencidos · N" del
  // card son EL MISMO valor, no dos agregaciones parecidas. Que difirieran
  // bajo la misma palabra era el corazón de #238.
  const overdueInstallmentsCount = windowGroups.OVERDUE.count;

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
    // Suma de los dos grupos, no una tercera agregación: el footer del card
    // cierra con sus encabezados por construcción.
    windowAmount: windowTotals.overdueAmount + windowTotals.dueSoonAmount,
    windowCount: windowTotals.overdueCount + windowTotals.dueSoonCount,
    windowGroups,
  };

  const clientPhoneByReservationId = new Map(
    input.reservations.map((r) => [r.id, r.client.phone] as const),
  );
  const clientEmailByReservationId = new Map(
    input.reservations.map((r) => [r.id, r.client.email] as const),
  );
  const billingTypeByReservationId = new Map(
    input.reservations.map((r) => [r.id, r.billingType] as const),
  );

  // ── Próximo cobro accionable (Nivel 3, ADR-0017): qué `Payment` marcar
  // pagado o reenviar, o si hay que CREAR uno porque la reserva no tiene
  // ninguno (DAILY con deuda, ADR-0036 "Fuera de alcance"). Indexado por
  // reservationId, igual que los mapas de arriba.

  /** `true` cuando el pago sigue sin cobrarse: PENDING o FAILED, nunca COMPLETED. */
  function isUnpaidPayment(
    p: DashboardPaymentInput,
  ): p is DashboardPaymentInput & { status: "PENDING" | "FAILED" } {
    return p.status !== "COMPLETED";
  }

  function compareByCreatedThenId(a: DashboardPaymentInput, b: DashboardPaymentInput): number {
    const createdDiff = a.createdAt.getTime() - b.createdAt.getTime();
    if (createdDiff !== 0) return createdDiff;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  }

  /** `dueDate` ascendente, `null` al final — el cobro sin fecha no es "el más antiguo". */
  function compareByDueDateThenCreatedThenId(
    a: DashboardPaymentInput,
    b: DashboardPaymentInput,
  ): number {
    const aDue = a.dueDate ? a.dueDate.getTime() : null;
    const bDue = b.dueDate ? b.dueDate.getTime() : null;
    if (aDue !== bDue) {
      if (aDue === null) return 1;
      if (bDue === null) return -1;
      return aDue - bDue;
    }
    return compareByCreatedThenId(a, b);
  }

  /**
   * Mayor `installmentIndex` entre los pagos RESERVATION no borrados de la
   * reserva — pagados o no, porque el número de cuotas del contrato no
   * cambia cuando una ya se pagó. `null` si la reserva no tiene cuotas
   * (DAILY, o MONTHLY sin pagos generados).
   */
  function installmentCountFor(reservation: DashboardReservationInput): number | null {
    const indexes = reservation.payments
      .filter(
        (p) => p.deletedAt == null && p.paymentType === "RESERVATION" && p.installmentIndex != null,
      )
      .map((p) => p.installmentIndex as number);
    return indexes.length === 0 ? null : Math.max(...indexes);
  }

  function toExistingCharge(
    payment: DashboardPaymentInput & { status: "PENDING" | "FAILED" },
    reservation: DashboardReservationInput,
  ): DashboardNextCharge {
    return {
      kind: "EXISTING",
      paymentId: payment.id,
      paymentType: payment.paymentType,
      status: payment.status,
      amount: payment.amount,
      method: payment.method,
      installmentIndex: payment.installmentIndex,
      installmentCount: installmentCountFor(reservation),
      dueDate: payment.dueDate ? payment.dueDate.toISOString() : null,
      title: payment.title,
      initPoint: payment.initPoint,
      expiresAt: payment.expiresAt ? payment.expiresAt.toISOString() : null,
    };
  }

  /**
   * El próximo cobro de una reserva, en orden de prioridad:
   * 1. El `Payment` RESERVATION impago más antiguo (por `dueDate`, luego
   *    `createdAt`, luego `id`) — es lo que el cliente debe primero.
   * 2. Si no hay ninguno pero el arriendo tiene saldo (`totalPrice - pagado`,
   *    sobre los pagos no borrados): `NEW` — la reserva DAILY con deuda no
   *    genera `Payment` automáticamente (CONTEXT.md), así que la acción real
   *    es CREAR el cobro, no marcarlo.
   * 3. Si el arriendo está saldado, el primer cobro EXTRA impago (por
   *    `createdAt`) — nunca antes que el arriendo, que es prioritario.
   * 4. `null`: nada que cobrar.
   */
  function computeNextCharge(reservation: DashboardReservationInput): DashboardNextCharge | null {
    const activePayments = reservation.payments.filter((p) => p.deletedAt == null);
    const unpaid = activePayments.filter(isUnpaidPayment);
    const unpaidReservation = unpaid.filter((p) => p.paymentType === "RESERVATION");

    if (unpaidReservation.length > 0) {
      const [first] = [...unpaidReservation].sort(compareByDueDateThenCreatedThenId);
      return toExistingCharge(first, reservation);
    }

    const pendingAmount = getReservationPendingAmount(activePayments, reservation.totalPrice);
    if (pendingAmount > 0) {
      return { kind: "NEW", amount: pendingAmount };
    }

    const unpaidExtra = unpaid.filter((p) => p.paymentType === "EXTRA");
    if (unpaidExtra.length > 0) {
      const [first] = [...unpaidExtra].sort(compareByCreatedThenId);
      return toExistingCharge(first, reservation);
    }

    return null;
  }

  const nextChargeByReservationId = new Map<string, DashboardNextCharge | null>(
    input.reservations.map((r) => [r.id, computeNextCharge(r)] as const),
  );

  /**
   * Reparte los cobros de UNA fila (una reserva) entre los dos grupos
   * visuales del card, en granularidad de cobro (cuota o extra).
   *
   * El monto total de la fila —lo que se muestra en su columna de dinero—
   * es la suma de las dos mitades: vencido + vence-hoy/próximos-7-días +
   * extras impagos. Deliberadamente NO usa `totalToCollect`: en un contrato
   * de 12 meses eso mostraría el arriendo del año entero. Y deliberadamente
   * no colapsa a `overdue > 0 ? overdue : nextInstallmentAmount`, que en una
   * reserva MONTHLY con varias cuotas dejaba el monto en UNA sola cuota.
   *
   * Los extras impagos caen en DUE_SOON: no tienen `dueDate`, así que no hay
   * forma de saber si están vencidos, y el grupo "por vencer" es el que no
   * afirma una fecha pasada. El encuadre de los extras en esta ventana es
   * una pregunta abierta aparte (issue #232).
   */
  function windowSplitForRow(row: CollectionReportRow): CollectionWindowSplit {
    const windowed = row.overdue + row.dueSoon + row.extrasPending;
    if (windowed > 0) {
      return {
        overdueAmount: row.overdue,
        overdueCount: row.overdueCount,
        dueSoonAmount: row.dueSoon + row.extrasPending,
        dueSoonCount: row.dueSoonCount + row.extrasPendingCount,
      };
    }
    // Fallback defensivo: fila DUE_TODAY por el caso borde documentado en
    // `getCollectionStatus` (daysDiff < 0 sin overdue, cambio de día en
    // Santiago) donde `overdue` y `dueSoon` dan 0 aunque la fila sí tenga
    // una próxima cuota. Preserva el monto previo en vez de $0, y cuenta esa
    // cuota como UN cobro: antes aportaba monto con conteo 0, así que el
    // footer podía decir "0 cobros · $250.000".
    return {
      overdueAmount: 0,
      overdueCount: 0,
      dueSoonAmount: row.nextInstallmentAmount + row.extrasPending,
      dueSoonCount: (row.nextInstallmentAmount > 0 ? 1 : 0) + row.extrasPendingCount,
    };
  }

  /** Monto de la fila dentro de la ventana: las dos mitades del split. */
  function amountForRow(row: CollectionReportRow): number {
    const split = windowSplitForRow(row);
    return split.overdueAmount + split.dueSoonAmount;
  }

  function sumWindowSplit(rows: Array<{ row: CollectionReportRow }>): CollectionWindowSplit {
    return rows.reduce<CollectionWindowSplit>(
      (acc, { row }) => {
        const split = windowSplitForRow(row);
        return {
          overdueAmount: acc.overdueAmount + split.overdueAmount,
          overdueCount: acc.overdueCount + split.overdueCount,
          dueSoonAmount: acc.dueSoonAmount + split.dueSoonAmount,
          dueSoonCount: acc.dueSoonCount + split.dueSoonCount,
        };
      },
      { overdueAmount: 0, overdueCount: 0, dueSoonAmount: 0, dueSoonCount: 0 },
    );
  }

  function buildCollectionItem(
    row: CollectionReportRow,
    bucket: DashboardCollectionBucket,
  ): DashboardCollectionItem {
    const billingType = billingTypeByReservationId.get(row.reservationId) ?? row.billingType;
    return {
      bucket,
      billingType,
      reservationId: row.reservationId,
      clientName: row.clientName,
      clientEmail: clientEmailByReservationId.get(row.reservationId) ?? "",
      clientPhone: clientPhoneByReservationId.get(row.reservationId) ?? null,
      propertyName: row.propertyName,
      amount: amountForRow(row),
      dueDate: row.nextDueDate ? row.nextDueDate.toISOString() : null,
      nextCharge: nextChargeByReservationId.get(row.reservationId) ?? null,
      daysFromToday: row.nextDueDate ? daysFromTodayDateOnly(row.nextDueDate, now) : null,
      overdueCount: row.overdueCount,
      dueSoonCount: row.dueSoonCount,
      dueSoonDaysFromToday: row.dueSoonNextDueDate
        ? daysFromTodayDateOnly(row.dueSoonNextDueDate, now)
        : null,
    };
  }

  // El corte por `collectionLimit` ya está hecho en `visibleWindowRows`, que
  // es también la base de `hiddenWindowRows` — así el desglose por grupo y la
  // lista visible no pueden divergir sobre qué filas se muestran.
  const collectionItems: DashboardCollectionItem[] = visibleWindowRows.map(({ row, bucket }) =>
    buildCollectionItem(row, bucket),
  );

  // ── Agenda: llegadas y salidas por día, en el horizonte. ─────────────────
  //
  // El monto exigible de cada evento es el MISMO que su fila en "Por cobrar"
  // (`amountForRow`), tomado de `orderedWindowRows` (la ventana COMPLETA,
  // vencido/vence hoy/próximos 7 días) y no de `collectionItems` (que viene
  // truncado a `collectionLimit`): una reserva fuera de las filas visibles
  // igual debe aparecer con su monto real en la agenda.
  const amountDueByReservationId = new Map<string, number>(
    orderedWindowRows.map(({ row }) => [row.reservationId, amountForRow(row)] as const),
  );

  interface AgendaEventCandidate {
    offset: number;
    dateKey: string;
    event: DashboardAgendaEvent;
  }

  const agendaCandidates: AgendaEventCandidate[] = [];

  for (const r of input.reservations) {
    if (r.status === "CANCELLED") continue;

    const startKey = dateOnlyKey(r.startDate);
    const endKey = dateOnlyKey(r.endDate);
    // Convención Última Noche: la salida ocurre el día SIGUIENTE a la última
    // noche, tanto para DAILY como para MONTHLY.
    const departureKey = addDaysToDateKey(endKey, 1);
    const startIso = r.startDate.toISOString();
    const endIso = r.endDate.toISOString();
    const months = r.billingType === "MONTHLY" ? getInclusiveMonths(startIso, endIso) : 0;
    const hasNoPayments = !r.payments.some(
      (p) => p.paymentType === "RESERVATION" && p.status === "COMPLETED" && p.deletedAt == null,
    );

    const sharedEventFields = {
      reservationId: r.id,
      propertyId: r.propertyId,
      propertyName: r.property.name,
      propertyColor: r.property.color,
      clientName: r.client.name,
      billingType: r.billingType,
      nights: getNights(startIso, endIso),
      months,
      lastNightDateKey: endKey,
      unitsBooked: r.unitsBooked,
      amountDue: amountDueByReservationId.get(r.id) ?? 0,
      hasNoPayments,
    };

    agendaCandidates.push({
      offset: dateKeyToDayIndex(startKey) - dateKeyToDayIndex(todayKey),
      dateKey: startKey,
      event: { ...sharedEventFields, kind: "ARRIVAL" },
    });
    agendaCandidates.push({
      offset: dateKeyToDayIndex(departureKey) - dateKeyToDayIndex(todayKey),
      dateKey: departureKey,
      event: { ...sharedEventFields, kind: "DEPARTURE" },
    });
  }

  const withinHorizon = agendaCandidates.filter(
    (c) => c.offset >= 0 && c.offset < AGENDA_HORIZON_DAYS,
  );

  // Salidas antes que llegadas —el orden real del día: la unidad se libera
  // antes de volver a ocuparse—; dentro de cada tipo, por propiedad y luego
  // por cliente.
  function compareAgendaEvents(a: DashboardAgendaEvent, b: DashboardAgendaEvent): number {
    if (a.kind !== b.kind) return a.kind === "DEPARTURE" ? -1 : 1;
    const byProperty = a.propertyName.localeCompare(b.propertyName, "es");
    if (byProperty !== 0) return byProperty;
    return a.clientName.localeCompare(b.clientName, "es");
  }

  const eventsByDateKey = new Map<string, DashboardAgendaEvent[]>();
  for (const c of withinHorizon) {
    const list = eventsByDateKey.get(c.dateKey);
    if (list) {
      list.push(c.event);
    } else {
      eventsByDateKey.set(c.dateKey, [c.event]);
    }
  }

  // Hoy siempre aparece, incluso sin eventos — los demás días solo si tienen
  // alguno.
  const agendaDateKeys = new Set<string>([todayKey, ...eventsByDateKey.keys()]);
  const agendaDays: DashboardAgendaDay[] = Array.from(agendaDateKeys, (dateKey) => ({
    dateKey,
    offset: dateKeyToDayIndex(dateKey) - dateKeyToDayIndex(todayKey),
    events: (eventsByDateKey.get(dateKey) ?? []).slice().sort(compareAgendaEvents),
  })).sort((a, b) => a.offset - b.offset);

  // Primer evento después del horizonte, sin límite superior — para que una
  // semana quieta diga cuándo vuelve a pasar algo. Los eventos pasados
  // (offset negativo, de reservas ya en curso) no compiten acá: no son
  // "próximos".
  const nextEventAfterHorizon = agendaCandidates
    .filter((c) => c.offset >= AGENDA_HORIZON_DAYS)
    .reduce<{ dateKey: string; offset: number } | null>(
      (min, c) => (min === null || c.offset < min.offset ? { dateKey: c.dateKey, offset: c.offset } : min),
      null,
    );

  const agenda: DashboardAgenda = {
    horizonDays: AGENDA_HORIZON_DAYS,
    days: agendaDays,
    nextEventAfterHorizon,
  };

  // ── Tablero de propiedades: quién ocupa cada una HOY. ────────────────────
  //
  // Ocupantes de hoy: reservas no canceladas y bloqueos externos ACTIVE que
  // cubren la noche de hoy (`startKey <= todayKey <= endKey`) — la MISMA
  // regla que usa la disponibilidad (CONTEXT.md, "Calendarios Externos").
  interface OccupantCandidate {
    unitsContributed: number;
    occupant: DashboardPropertyOccupant;
  }

  const occupantsByPropertyId = new Map<string, OccupantCandidate[]>();
  function addOccupant(propertyId: string, candidate: OccupantCandidate): void {
    const list = occupantsByPropertyId.get(propertyId);
    if (list) {
      list.push(candidate);
    } else {
      occupantsByPropertyId.set(propertyId, [candidate]);
    }
  }

  for (const r of input.reservations) {
    if (r.status === "CANCELLED") continue;
    const startKey = dateOnlyKey(r.startDate);
    const endKey = dateOnlyKey(r.endDate);
    if (startKey > todayKey || todayKey > endKey) continue;
    addOccupant(r.propertyId, {
      unitsContributed: r.unitsBooked,
      occupant: {
        source: "RESERVATION",
        reservationId: r.id,
        billingType: r.billingType,
        channel: null,
        lastNightKey: endKey,
        releaseDateKey: addDaysToDateKey(endKey, 1),
      },
    });
  }

  for (const b of input.externalBlocks ?? []) {
    const startKey = dateOnlyKey(b.startDate);
    const endKey = dateOnlyKey(b.endDate);
    if (startKey > todayKey || todayKey > endKey) continue;
    addOccupant(b.propertyId, {
      unitsContributed: 1,
      occupant: {
        source: "EXTERNAL_BLOCK",
        reservationId: null,
        billingType: null,
        channel: b.channel,
        lastNightKey: endKey,
        releaseDateKey: addDaysToDateKey(endKey, 1),
      },
    });
  }

  // Próxima llegada estrictamente futura por propiedad (reservas no
  // canceladas), independiente de si la propiedad está ocupada hoy.
  const nextArrivalByPropertyId = new Map<string, { reservationId: string; dateKey: string }>();
  for (const r of input.reservations) {
    if (r.status === "CANCELLED") continue;
    const startKey = dateOnlyKey(r.startDate);
    if (startKey <= todayKey) continue;
    const current = nextArrivalByPropertyId.get(r.propertyId);
    if (!current || startKey < current.dateKey) {
      nextArrivalByPropertyId.set(r.propertyId, { reservationId: r.id, dateKey: startKey });
    }
  }

  const propertyStatuses: DashboardPropertyStatus[] = input.properties.map((p) => {
    const occupants = occupantsByPropertyId.get(p.id) ?? [];
    const unitsOccupied = occupants.reduce((sum, o) => sum + o.unitsContributed, 0);
    const state: DashboardPropertyState =
      unitsOccupied >= p.unitsAvailable ? "OCCUPIED" : unitsOccupied > 0 ? "PARTIAL" : "FREE";
    const nextRelease = occupants.reduce<DashboardPropertyOccupant | null>((min, o) => {
      if (!min || o.occupant.releaseDateKey < min.releaseDateKey) return o.occupant;
      return min;
    }, null);

    return {
      propertyId: p.id,
      propertyName: p.name,
      propertyColor: p.color ?? null,
      unitsAvailable: p.unitsAvailable,
      unitsOccupied,
      state,
      nextRelease,
      nextArrival: nextArrivalByPropertyId.get(p.id) ?? null,
    };
  });

  // Orden: ocupadas/parciales por liberación más próxima; libres con llegada
  // por esa llegada; libres sin llegada al final. Empates y último grupo,
  // por nombre.
  function propertyBoardRank(p: DashboardPropertyStatus): { group: number; sortKey: string } {
    if (p.state !== "FREE" && p.nextRelease) {
      return { group: 0, sortKey: p.nextRelease.releaseDateKey };
    }
    if (p.nextArrival) {
      return { group: 1, sortKey: p.nextArrival.dateKey };
    }
    return { group: 2, sortKey: "" };
  }

  propertyStatuses.sort((a, b) => {
    const rankA = propertyBoardRank(a);
    const rankB = propertyBoardRank(b);
    if (rankA.group !== rankB.group) return rankA.group - rankB.group;
    if (rankA.sortKey !== rankB.sortKey) return rankA.sortKey < rankB.sortKey ? -1 : 1;
    return a.propertyName.localeCompare(b.propertyName, "es");
  });

  const occupiedUnits = propertyStatuses.reduce(
    (sum, p) => sum + Math.min(p.unitsOccupied, p.unitsAvailable),
    0,
  );
  const totalUnits = propertyStatuses.reduce((sum, p) => sum + p.unitsAvailable, 0);
  const allSingleUnit = propertyStatuses.every((p) => p.unitsAvailable === 1);

  const propertyBoard: DashboardPropertyBoard = {
    properties: propertyStatuses,
    occupiedUnits,
    totalUnits,
    allSingleUnit,
  };

  // ── Pulso del mes: cobrado vs mismo período del mes anterior + ocupación. ─
  const dayOfMonth = Number(todayKey.slice(8, 10));
  const prevMonthLastDay = Number(monthEndKey(prev.year, prev.month1).slice(8, 10));
  const previousCutoffDay = Math.min(dayOfMonth, prevMonthLastDay);

  const previousSamePeriodDecision = buildDecisionSummary({
    reservations: decisionReservations,
    properties: input.properties,
    rangeStart: dateOnlyFromKey(monthStartKey(prev.year, prev.month1)),
    rangeEnd: dateOnlyFromKey(`${prev.year}-${pad2(prev.month1)}-${pad2(previousCutoffDay)}`),
  });

  const month: DashboardMonthPulse = {
    monthKey: `${todayYear}-${pad2(todayMonth1)}`,
    dayOfMonth,
    collected: currentMonthDecision.collectedCash,
    previousMonthKey: `${prev.year}-${pad2(prev.month1)}`,
    previousCutoffDay,
    collectedPreviousSamePeriod: previousSamePeriodDecision.collectedCash,
    occupancyRate: currentMonthDecision.occupancyRate,
    occupiedNightUnits: currentMonthDecision.occupiedNightUnits,
    capacityNightUnits: currentMonthDecision.capacityNightUnits,
  };

  return {
    todayKey,
    collection,
    collectionItems,
    agenda,
    propertyBoard,
    month,
    isEmpty: {
      properties: input.properties.length === 0,
      reservations: input.reservations.length === 0,
    },
  };
}
