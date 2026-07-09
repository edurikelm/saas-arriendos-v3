import { BUSINESS_TIME_ZONE, daysFromNowInBusinessTz } from "@/lib/domain/timezone";

export type ReservationStatus = "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED" | string;

export interface CollectionAlertReservation {
  id: string;
  status: ReservationStatus;
  client: {
    name: string;
  };
  property: {
    name: string;
  };
}

export interface CollectionAlertPayment {
  id: string;
  status: string;
  paymentType?: string | null;
  method: string;
  /** Payment amount in CLP as a number (Prisma Decimal is normalized to number). */
  amount: number;
  dueDate?: string | null;
  initPoint?: string | null;
  expiresAt?: string | null;
  reservation: CollectionAlertReservation;
}

export interface CollectionAlertItem {
  paymentId: string;
  reservationId: string;
  clientName: string;
  propertyName: string;
  dueDate: string;
  method: string;
  /** Payment amount in CLP. */
  amount: number;
  initPoint: string | null;
  expiresAt: string | null;
  daysFromToday: number;
}

export interface CollectionAlertsResult {
  vencidos: CollectionAlertItem[];
  vencenHoy: CollectionAlertItem[];
  proximos7Dias: CollectionAlertItem[];
}

export function classifyCollectionAlerts(
  payments: CollectionAlertPayment[],
  now: Date = new Date()
): CollectionAlertsResult {
  const result: CollectionAlertsResult = {
    vencidos: [],
    vencenHoy: [],
    proximos7Dias: [],
  };

  const allowedReservationStatuses = new Set(["PENDING", "CONFIRMED"]);

  for (const payment of payments) {
    if (payment.status !== "PENDING") continue;
    if (payment.paymentType !== "RESERVATION") continue;
    if (!allowedReservationStatuses.has(payment.reservation.status)) continue;
    if (!payment.dueDate) continue;

    const daysFromToday = daysFromNowInBusinessTz(new Date(payment.dueDate), now);

    const item: CollectionAlertItem = {
      paymentId: payment.id,
      reservationId: payment.reservation.id,
      clientName: payment.reservation.client.name,
      propertyName: payment.reservation.property.name,
      dueDate: payment.dueDate,
      method: payment.method,
      amount: Number(payment.amount),
      initPoint: payment.initPoint ?? null,
      expiresAt: payment.expiresAt ?? null,
      daysFromToday,
    };

    if (daysFromToday < 0) {
      result.vencidos.push(item);
      continue;
    }

    if (daysFromToday === 0) {
      result.vencenHoy.push(item);
      continue;
    }

    if (daysFromToday <= 7) {
      result.proximos7Dias.push(item);
    }
  }

  const sortByDueDate = (a: CollectionAlertItem, b: CollectionAlertItem) =>
    new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();

  result.vencidos.sort(sortByDueDate);
  result.vencenHoy.sort(sortByDueDate);
  result.proximos7Dias.sort(sortByDueDate);

  return result;
}
