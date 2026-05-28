export type CollectionBillingFilter = "GENERAL" | "DAILY" | "MONTHLY";
export type CollectionDebtStatusFilter = "ACTIVE" | "ALL" | "OVERDUE" | "UPCOMING" | "PAID";

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
  extrasPaid: number;
  extrasPending: number;
  totalToCollect: number;
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
  const now = options?.now ?? new Date();
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

      if (reservation.billingType === "MONTHLY") {
        const unpaidInstallments = reservationPayments.filter((payment) => payment.status !== "COMPLETED");
        overdue = sumAmounts(unpaidInstallments, (payment) => !!payment.dueDate && payment.dueDate < now);

        const dueDates = unpaidInstallments
          .map((payment) => payment.dueDate)
          .filter((dueDate): dueDate is Date => Boolean(dueDate))
          .sort((a, b) => a.getTime() - b.getTime());

        nextDueDate = dueDates[0] ?? (pending > 0 ? reservation.startDate : null);
      } else if (pending > 0) {
        nextDueDate = reservation.startDate;
        overdue = reservation.startDate < now ? pending : 0;
      }

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
        extrasPaid,
        extrasPending,
        totalToCollect: pending + extrasPending,
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
