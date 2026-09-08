// Shared types for reservations components.
// Single source of truth — consumed by list-client, table, list-item, filters hook, etc.

export interface ReservationProperty {
  id: string;
  name: string;
  color?: string;
  unitsAvailable: number;
  dailyPrice: string;
  monthlyPrice: string | null;
}

export interface ReservationClient {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
}

export interface ReservationPayment {
  id: string;
  amount: string;
  status: string;
  method: string;
  paymentType?: string | null;
  deletedAt?: string | null;
  initPoint?: string | null;
  expiresAt?: string | null;
  /**
   * Vencimiento de la cuota. Solo lo traen los arriendos MONTHLY: en producción
   * (2026-09-07) los 4 pagos DAILY tienen `dueDate` nulo y 7 de los 8 MONTHLY
   * lo tienen poblado, junto con `installmentIndex`.
   *
   * `getReservations` ya lo seleccionaba y lo serializaba; faltaba declararlo
   * acá, así que el tipo escondía un campo que sí venía en la respuesta.
   */
  dueDate?: string | null;
  /** Ordinal de cuota en arriendos mensuales (1, 2, 3...). Null en DAILY. */
  installmentIndex?: number | null;
}

export interface Reservation {
  id: string;
  propertyId: string;
  clientId: string;
  startDate: string;
  endDate: string;
  billingType: string;
  unitsBooked: number;
  totalPrice: string;
  status: string;
  bookingAirbnb: boolean;
  notes: string | null;
  createdAt: string;
  property: ReservationProperty;
  client: ReservationClient;
  payments: ReservationPayment[];
}

export interface PaginatedReservations {
  data: Reservation[];
  total: number;
  page: number;
  totalPages: number;
}