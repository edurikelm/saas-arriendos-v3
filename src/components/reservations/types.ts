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