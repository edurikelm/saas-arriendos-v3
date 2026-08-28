import { BUSINESS_TIME_ZONE, dateKeyToDayIndex, dateOnlyKey, daysFromTodayDateOnly, formatDateOnly, getDateKeyInTz, isOverdueDateOnly, nowKeyInBusinessTz } from "@/lib/domain/timezone";

export type CollectionBillingFilter = "GENERAL" | "DAILY" | "MONTHLY";
export type CollectionDebtStatusFilter = "ACTIVE" | "ALL" | "OVERDUE" | "UPCOMING" | "PAID";

/**
 * Estado de cobranza derivado de una fila del reporte.
 *
 * El estado es el que el owner necesita ver en la tabla para decidir acción:
 *  - `overdue > 0`         → "Vencido"  (destructive) — hay cuotas atrasadas
 *  - vence hoy             → "Vence hoy" (warning)     — acción inmediata
 *  - próximos 7 días       → "Próximo"   (info)         — preparar recordatorio
 *  - más de 7 días         → "Pendiente" (warning)      — en seguimiento
 *  - totalToCollect === 0  → "Pagado"    (success)      — sin deuda
 *
 * Mapeo 1:1 con los `<Badge variant>` semánticos del design system (Ocean Breeze).
 * Las fechas se evalúan en wall-time `America/Santiago` (ADR-0020).
 */
export type CollectionStatus = "PAID" | "OVERDUE" | "DUE_TODAY" | "UPCOMING" | "PENDING";

export interface CollectionStatusInfo {
  status: CollectionStatus;
  label: string;
  variant: "success" | "destructive" | "warning" | "info" | "secondary";
}

const STATUS_INFO: Record<CollectionStatus, CollectionStatusInfo> = {
  PAID:      { status: "PAID",      label: "Pagado",     variant: "success" },
  OVERDUE:   { status: "OVERDUE",   label: "Vencido",    variant: "destructive" },
  DUE_TODAY: { status: "DUE_TODAY", label: "Vence hoy",  variant: "warning" },
  UPCOMING:  { status: "UPCOMING",  label: "Próximo",    variant: "info" },
  PENDING:   { status: "PENDING",   label: "Pendiente",  variant: "warning" },
};

/**
 * Deriva el estado de cobranza visible para el owner.
 *
 * El orden de checks importa:
 *  1. Sin deuda → Pagado (terminal, no importa el calendario).
 *  2. overdue > 0 → Vencido (prevalece sobre "vence hoy" si una cuota
 *     venció ayer y la próxima vence hoy: la fila sigue marcada como vencida).
 *  3. Por fecha del `nextDueDate` (en wall-time `America/Santiago`):
 *     - mismo día → Vence hoy
 *     - 1..7 días → Próximo
 *     - > 7 días  → Pendiente
 *  4. Fallback: si hay deuda pero no hay `nextDueDate`, marcar como Pendiente.
 */
export function getCollectionStatus(
  row: Pick<CollectionReportRow, "totalToCollect" | "overdue" | "nextDueDate">,
  now: Date = new Date(),
): CollectionStatusInfo {
  if (row.totalToCollect <= 0) return STATUS_INFO.PAID;
  if (row.overdue > 0) return STATUS_INFO.OVERDUE;

  if (row.nextDueDate) {
    const daysDiff = daysFromTodayDateOnly(row.nextDueDate, now);
    if (daysDiff <= 0) {
      // daysDiff === 0 → hoy. < 0 sin overdue solo es posible si la fila
      // se renderiza justo en el cambio de día en Santiago; tratar como vence hoy.
      return STATUS_INFO.DUE_TODAY;
    }
    if (daysDiff <= 7) return STATUS_INFO.UPCOMING;
    return STATUS_INFO.PENDING;
  }

  return STATUS_INFO.PENDING;
}

/**
 * Etiqueta humana del `nextDueDate` relativa a "hoy" en `America/Santiago`.
 *  - 0 días         → "Hoy"
 *  - 1 día          → "Mañana"
 *  - 2..7 días      → "En N días"
 *  - mismo año      → "15 Feb"
 *  - otro año       → "15 Feb 2027"
 *
 * Devuelve `"—"` cuando no hay `nextDueDate` (caso típico: reserva sin pagos
 * pendientes, ya cubierto por el badge "Pagado").
 */
export function getCollectionDueLabel(
  nextDueDate: Date | null,
  now: Date = new Date(),
  locale: string = "es-CL",
): string {
  if (!nextDueDate) return "—";

  const daysDiff = daysFromTodayDateOnly(nextDueDate, now);
  if (daysDiff === 0) return "Hoy";
  if (daysDiff === 1) return "Mañana";
  if (daysDiff > 1 && daysDiff <= 7) return `En ${daysDiff} días`;

  const nowKey = getDateKeyInTz(now, BUSINESS_TIME_ZONE);
  const dueKey = dateOnlyKey(nextDueDate);
  const sameYear = nowKey.startsWith(dueKey.slice(0, 4));
  return formatDateOnly(
    nextDueDate,
    { day: "2-digit", month: "short", year: sameYear ? undefined : "numeric" },
    locale,
  );
}

export interface CollectionPaymentInput {
  amount: number;
  status: "PENDING" | "COMPLETED" | "FAILED";
  paymentType: "RESERVATION" | "EXTRA";
  dueDate?: Date | null;
  deletedAt?: Date | null;
}

export interface CollectionReservationInput {
  id: string;
  propertyId: string;
  propertyName: string;
  clientId: string;
  clientName: string;
  billingType: "DAILY" | "MONTHLY";
  status: "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED";
  startDate: Date;
  totalPrice: number;
  payments: CollectionPaymentInput[];
}

export interface CollectionReportRow {
  reservationId: string;
  propertyId: string;
  propertyName: string;
  clientId: string;
  clientName: string;
  billingType: "DAILY" | "MONTHLY";
  reservationStatus: "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED";
  totalRent: number;
  paid: number;
  pending: number;
  overdue: number;
  nextDueDate: Date | null;
  /**
   * Monto de la **próxima cuota individual** a cobrar, alineado con `nextDueDate`.
   *  - MONTHLY: amount del unpaid installment con el `dueDate` más temprano.
   *  - DAILY:   `pending` (no hay cuotas separadas; el total pendiente ES la próxima).
   *  - Sin cuotas pendientes: 0.
   *
   * La UI muestra este valor (sumado a `extrasPending`) en "Monto a cobrar"
   * cuando el estado NO es Vencido. Si `overdue > 0`, la UI muestra `overdue`
   * (el owner quiere normalizar la deuda, no solo la próxima cuota).
   */
  nextInstallmentAmount: number;
  extrasPaid: number;
  extrasPending: number;
  totalToCollect: number;
  /**
   * Cantidad de cuotas RESERVATION impagas con `dueDate` ya vencido —
   * granularidad de cuota, mientras `overdue` es la suma en $.
   *  - MONTHLY: cuenta de unpaid installments con `dueDate` estrictamente
   *    anterior a hoy (misma regla que `isOverdueDateOnly`; ambos campos se
   *    calculan sobre el mismo predicate para no divergir). Cuotas impagas
   *    sin `dueDate` no cuentan (no hay forma de saber si están vencidas).
   *  - DAILY: 1 si `overdue > 0` (la deuda entera es un solo cobro contra
   *    `startDate`), si no 0.
   *
   * Existe para que la UI pueda decir "2 cuotas vencidas" en vez de "1 cobro
   * vencido" cuando una fila (una reserva) agrupa varias cuotas MONTHLY.
   */
  overdueCount: number;
  /**
   * Suma de cuotas RESERVATION impagas que vencen HOY o dentro de los
   * próximos 7 días (`0 <= delta <= 7` días calendario, wall-time SCL,
   * ADR-0020).
   *  - MONTHLY: suma de amounts de unpaid installments en esa ventana.
   *  - DAILY: `pending` si `startDate` cae en la ventana y la deuda no está
   *    vencida (`overdue === 0`); si no, 0.
   *
   * Junto con `overdue` y `extrasPending`, compone el monto real de la
   * ventana "vencido + vence hoy + próximos 7 días" que usa el dashboard
   * (ver `amountForRow` en `@/lib/dashboard/summary`). Deliberadamente NO es
   * `totalToCollect`: en un contrato MONTHLY largo (12 cuotas) eso sumaría
   * el arriendo del año completo, el mismo error que este campo corrige.
   */
  dueSoon: number;
  /** Cantidad de cuotas que componen `dueSoon`. */
  dueSoonCount: number;
  /**
   * `dueDate` de la cuota impaga más temprana dentro de la ventana de
   * `dueSoon` (HOY..+7 días). `null` cuando `dueSoonCount === 0`. Permite
   * mostrar "vence en N días" en el sufijo "+N vence en X días" sin
   * rederivar la búsqueda desde `payments` crudos en la capa de UI.
   */
  dueSoonNextDueDate: Date | null;
  /** Cantidad de cobros EXTRA impagos (los que componen `extrasPending`). */
  extrasPendingCount: number;
  /**
   * Cantidad total de cobros impagos de la reserva: cuotas RESERVATION
   * impagas (MONTHLY: todas las unpaid installments, con o sin `dueDate`;
   * DAILY: 1 si `pending > 0`, si no 0) + `extrasPendingCount`.
   *
   * A diferencia de `overdueCount`/`dueSoonCount`, no tiene ventana de
   * tiempo — cuenta TODA cuota/extra impago, incluidos los que vencen a
   * 30+ días. Alimenta el KPI "Pagos Pendientes" del dashboard, que cuenta
   * cobros (no reservas).
   */
  pendingChargesCount: number;
}

export interface BuildCollectionOptions {
  billingType?: CollectionBillingFilter;
  propertyId?: string;
  clientId?: string;
  dueDateFrom?: Date;
  dueDateTo?: Date;
  debtStatus?: CollectionDebtStatusFilter;
  now?: Date;
}

function sumAmounts(payments: CollectionPaymentInput[], predicate: (p: CollectionPaymentInput) => boolean): number {
  return payments.reduce((sum, payment) => (predicate(payment) ? sum + Number(payment.amount || 0) : sum), 0);
}

export function buildCollectionReportRows(
  reservations: CollectionReservationInput[],
  options?: BuildCollectionOptions
): CollectionReportRow[] {
  // Cache del "hoy" en zona de negocio (ADR-0020) para usar en
  // comparaciones day-level. Evita recalcular `nowKeyInBusinessTz()` por
  // cada pago/reserva en el loop.
  const nowKey = options?.now
    ? getDateKeyInTz(options.now, BUSINESS_TIME_ZONE)
    : nowKeyInBusinessTz();
  const debtStatus = options?.debtStatus ?? "ACTIVE";

  const rows = reservations
    .filter((reservation) => {
      if (reservation.status === "CANCELLED") return false;
      if (options?.billingType && options.billingType !== "GENERAL" && reservation.billingType !== options.billingType) {
        return false;
      }
      if (options?.propertyId && reservation.propertyId !== options.propertyId) return false;
      if (options?.clientId && reservation.clientId !== options.clientId) return false;
      return true;
    })
    .map((reservation) => {
      const activePayments = reservation.payments.filter((payment) => payment.deletedAt == null);
      const reservationPayments = activePayments.filter((payment) => payment.paymentType === "RESERVATION");
      const extraPayments = activePayments.filter((payment) => payment.paymentType === "EXTRA");

      const paid = sumAmounts(
        reservationPayments,
        (payment) => payment.status === "COMPLETED"
      );
      const totalRent = Number(reservation.totalPrice || 0);
      const pending = Math.max(totalRent - paid, 0);

      const extrasPaid = sumAmounts(extraPayments, (payment) => payment.status === "COMPLETED");
      const extrasPending = sumAmounts(extraPayments, (payment) => payment.status !== "COMPLETED");

      let overdue = 0;
      let nextDueDate: Date | null = null;
      let nextInstallmentAmount = 0;
      let overdueCount = 0;
      let dueSoon = 0;
      let dueSoonCount = 0;
      let dueSoonNextDueDate: Date | null = null;
      // Cuotas RESERVATION impagas (sin contar extras) — alimenta
      // pendingChargesCount junto con extrasPendingCount, calculado más abajo.
      let unpaidChargesCount = 0;

      if (reservation.billingType === "MONTHLY") {
        const unpaidInstallments = reservationPayments.filter((payment) => payment.status !== "COMPLETED");
        unpaidChargesCount = unpaidInstallments.length;

        overdue = sumAmounts(
          unpaidInstallments,
          (payment) => isOverdueDateOnly(payment.dueDate, nowKey)
        );
        overdueCount = unpaidInstallments.filter((payment) =>
          isOverdueDateOnly(payment.dueDate, nowKey)
        ).length;

        // Ventana "vence hoy + próximos 7 días": aritmética date-only
        // (dateKeyToDayIndex/dateOnlyKey) consistente con isOverdueDateOnly.
        // Cuotas impagas sin dueDate no entran a esta ventana (no hay forma
        // de saber si caen dentro), pero siguen contando en unpaidChargesCount.
        const nowDayIndex = dateKeyToDayIndex(nowKey);
        for (const payment of unpaidInstallments) {
          if (!payment.dueDate) continue;
          const delta = dateKeyToDayIndex(dateOnlyKey(payment.dueDate)) - nowDayIndex;
          if (delta < 0 || delta > 7) continue;
          dueSoon += Number(payment.amount || 0);
          dueSoonCount += 1;
          if (!dueSoonNextDueDate || payment.dueDate.getTime() < dueSoonNextDueDate.getTime()) {
            dueSoonNextDueDate = payment.dueDate;
          }
        }

        const dueDates = unpaidInstallments
          .map((payment) => payment.dueDate)
          .filter((dueDate): dueDate is Date => Boolean(dueDate))
          .sort((a, b) => a.getTime() - b.getTime());

        nextDueDate = dueDates[0] ?? (pending > 0 ? reservation.startDate : null);

        // Monto de la próxima cuota: unpaid installment con el `dueDate` más
        // temprano. Si no hay cuotas con `dueDate`, no podemos atribuir el
        // monto a una cuota específica (degradar a 0; la UI mostrará solo
        // extrasPending en ese caso).
        const nextUnpaidInstallment = unpaidInstallments
          .filter((payment): payment is CollectionPaymentInput & { dueDate: Date } => payment.dueDate != null)
          .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())[0];
        nextInstallmentAmount = nextUnpaidInstallment ? Number(nextUnpaidInstallment.amount) : 0;
      } else if (pending > 0) {
        // DAILY no tiene cuotas separadas: si hay deuda pendiente, toda es
        // "la próxima" (un solo pago contra `startDate`).
        nextInstallmentAmount = pending;
        nextDueDate = reservation.startDate;
        overdue = isOverdueDateOnly(reservation.startDate, nowKey) ? pending : 0;
        overdueCount = overdue > 0 ? 1 : 0;
        unpaidChargesCount = 1;

        if (overdue === 0) {
          const delta =
            dateKeyToDayIndex(dateOnlyKey(reservation.startDate)) - dateKeyToDayIndex(nowKey);
          if (delta >= 0 && delta <= 7) {
            dueSoon = pending;
            dueSoonCount = 1;
            dueSoonNextDueDate = reservation.startDate;
          }
        }
      }

      const extrasPendingCount = extraPayments.filter((payment) => payment.status !== "COMPLETED").length;

      return {
        reservationId: reservation.id,
        propertyId: reservation.propertyId,
        propertyName: reservation.propertyName,
        clientId: reservation.clientId,
        clientName: reservation.clientName,
        billingType: reservation.billingType,
        reservationStatus: reservation.status,
        totalRent,
        paid,
        pending,
        overdue,
        nextDueDate,
        nextInstallmentAmount,
        extrasPaid,
        extrasPending,
        totalToCollect: pending + extrasPending,
        overdueCount,
        dueSoon,
        dueSoonCount,
        dueSoonNextDueDate,
        extrasPendingCount,
        pendingChargesCount: unpaidChargesCount + extrasPendingCount,
      } satisfies CollectionReportRow;
    })
    .filter((row) => {
      if (row.reservationStatus === "COMPLETED" && row.totalToCollect <= 0) {
        return false;
      }

      if (options?.dueDateFrom || options?.dueDateTo) {
        if (!row.nextDueDate) return false;
        if (options.dueDateFrom && row.nextDueDate < options.dueDateFrom) return false;
        if (options.dueDateTo && row.nextDueDate > options.dueDateTo) return false;
      }

      if (debtStatus === "ALL") return true;
      if (debtStatus === "ACTIVE") return row.totalToCollect > 0;
      if (debtStatus === "OVERDUE") return row.overdue > 0;
      if (debtStatus === "UPCOMING") return row.totalToCollect > 0 && row.overdue === 0;
      if (debtStatus === "PAID") return row.totalToCollect <= 0;
      return true;
    });

  return rows.sort((a, b) => {
    const left = a.nextDueDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const right = b.nextDueDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
    return left - right;
  });
}
