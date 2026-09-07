import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useReservationFilters } from "../use-reservation-filters";
import type { Reservation, ReservationPayment } from "@/components/reservations/types";

function pay(amount: number): ReservationPayment {
  return {
    id: `p-${amount}`,
    amount: String(amount),
    status: "COMPLETED",
    method: "TRANSFER",
    paymentType: "RESERVATION",
    deletedAt: null,
  };
}

function reserva(
  id: string,
  totalPrice: string,
  payments: ReservationPayment[],
  status = "CONFIRMED",
): Reservation {
  return {
    id,
    propertyId: "prop-1",
    clientId: `client-${id}`,
    startDate: "2026-09-01T16:00:00.000Z",
    endDate: "2026-09-05T16:00:00.000Z",
    billingType: "DAILY",
    unitsBooked: 1,
    totalPrice,
    status,
    bookingAirbnb: false,
    notes: null,
    createdAt: "2026-08-01T00:00:00.000Z",
    property: {
      id: "prop-1",
      name: "Cabaña 3",
      unitsAvailable: 1,
      dailyPrice: "50000",
      monthlyPrice: null,
    },
    client: { id: `client-${id}`, name: `Huésped ${id}`, email: `${id}@mail.cl` },
    payments,
  };
}

const saldada = reserva("saldada", "620000", [pay(620000)]);
const parcial = reserva("parcial", "620000", [pay(200000)]);
const sinAbonos = reserva("sin-abonos", "620000", []);
const cancelada = reserva("cancelada", "620000", [], "CANCELLED");
const exceso = reserva("exceso", "620000", [pay(700000)]);

const todas = [saldada, parcial, sinAbonos, cancelada, exceso];

function setup(serverReservations: Reservation[] = todas) {
  return renderHook(() =>
    useReservationFilters({ serverReservations, onServerFiltersChange: vi.fn() }),
  );
}

describe("filtro de pago", () => {
  it("'Pendiente' incluye a los abonos parciales — son justamente a los que hay que cobrar", () => {
    // Regresión: la condición era `paymentFilter === "pending" && paidAmount > 0
    // → descartar`, así que una reserva con $200.000 abonados de $620.000 (debe
    // $420.000) quedaba fuera del filtro con el que uno busca a los que deben.
    const { result } = setup();
    act(() => result.current.updatePaymentFilter("pending"));

    const ids = result.current.filteredReservations.map((r) => r.id);
    expect(ids).toContain("parcial");
    expect(ids).toContain("sin-abonos");
  });

  it("'Pendiente' deja fuera lo saldado y lo cancelado", () => {
    const { result } = setup();
    act(() => result.current.updatePaymentFilter("pending"));

    const ids = result.current.filteredReservations.map((r) => r.id);
    expect(ids).not.toContain("saldada");
    expect(ids).not.toContain("exceso");
    // Una cancelada no tiene saldo por cobrar (misma regla que getFinanceTone).
    expect(ids).not.toContain("cancelada");
  });

  it("'Pagado' trae saldadas y excesos, no parciales", () => {
    const { result } = setup();
    act(() => result.current.updatePaymentFilter("paid"));

    const ids = result.current.filteredReservations.map((r) => r.id);
    expect(ids).toEqual(expect.arrayContaining(["saldada", "exceso"]));
    expect(ids).not.toContain("parcial");
  });

  it("'Exceso' trae solo lo que pagó de más", () => {
    const { result } = setup();
    act(() => result.current.updatePaymentFilter("overpaid"));

    expect(result.current.filteredReservations.map((r) => r.id)).toEqual(["exceso"]);
  });
});

describe("hasClientFilters", () => {
  it("es falso sin filtros de cliente, aunque haya filtros de servidor", () => {
    const { result } = setup();
    expect(result.current.hasClientFilters).toBe(false);

    act(() => result.current.updateServerFilter("status", "CONFIRMED"));
    expect(result.current.hasClientFilters).toBe(false);
  });

  it("es verdadero con filtro de pago", () => {
    const { result } = setup();
    act(() => result.current.updatePaymentFilter("pending"));
    expect(result.current.hasClientFilters).toBe(true);
  });
});
