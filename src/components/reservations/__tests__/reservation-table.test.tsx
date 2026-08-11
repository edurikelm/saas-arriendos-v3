import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render } from "@testing-library/react";
import { ReservationTable } from "../reservation-table";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));

vi.mock("@/lib/reservation-payment", () => ({
  getPaymentStatus: vi.fn(() => ({ label: "Pendiente", tone: "amber" as const })),
}));

vi.mock("@/lib/reservation-dates", () => ({
  getInclusiveMonths: vi.fn(() => 1),
}));

const baseReservation = {
  id: "res-1",
  propertyId: "prop-1",
  clientId: "client-1",
  startDate: "2025-01-15",
  endDate: "2025-01-20",
  billingType: "DAILY",
  unitsBooked: 1,
  totalPrice: "250000",
  status: "CONFIRMED",
  bookingAirbnb: false,
  notes: null,
  createdAt: "2025-01-01T00:00:00.000Z",
  property: { id: "prop-1", name: "Cabaña A", color: "#3B82F6", unitsAvailable: 1, dailyPrice: "25000", monthlyPrice: null },
  client: { id: "client-1", name: "Juan Pérez", email: "juan@example.com" },
  payments: [],
};

describe("Reservation radius system", () => {
  it("ReservationPill uses rectangular radius (rounded-md), not pill radius", () => {
    const { container } = render(<ReservationTable reservations={[baseReservation]} />);

    const pills = container.querySelectorAll("span");
    const reservationPill = Array.from(pills).find((el) =>
      el.classList.contains("rounded-md")
    );
    expect(reservationPill).toBeDefined();
  });

  it("ReservationPill does NOT use rounded-full on its container", () => {
    const { container } = render(<ReservationTable reservations={[baseReservation]} />);

    const candidatePills = Array.from(container.querySelectorAll("span")).filter(
      (el) =>
        el.classList.contains("inline-flex") &&
        el.classList.contains("items-center") &&
        el.classList.contains("gap-1.5") &&
        el.classList.contains("border") &&
        el.classList.contains("px-2")
    );
    expect(candidatePills.length).toBeGreaterThan(0);
    candidatePills.forEach((pill) => {
      expect(pill.classList.contains("rounded-full")).toBe(false);
    });
  });
});

describe("Reservation temporal status — regresión bug 'PRÓXIMA En 1 días' cuando start_date = hoy", () => {
  // El bug reportado por el usuario: crear una reserva con start_date = hoy
  // (ej: 2026-08-11) la mostraba como "PRÓXIMA En 1 días" en /reservations.
  // Causa raíz: el cálculo de status comparaba `new Date(startDate)` (UTC midnight
  // del string ISO) contra `today.setHours(0,0,0,0)` (medianoche local del
  // navegador). En zonas horarias positivas (UTC+0, UTC+1), `today < start`
  // se cumplía con 1 hora de desfase y mostraba "En 1 días".

  beforeEach(() => {
    // Fijamos "ahora" al mediodía UTC del 2026-08-11.
    // → wall-time 2026-08-11 08:00 SCL (invierno Chile, UTC-4).
    // En este instante, start_date = 2026-08-11 debe ser interpretado como "hoy".
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-11T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("DAILY reserva con start_date = hoy (UTC midnight del backend) → label 'Activa', no 'Próxima'", () => {
    // El backend serializa startDate con Date.toISOString() → "YYYY-MM-DDT00:00:00.000Z".
    // El seam extrae YYYY-MM-DD directamente (no reinterpreta UTC midnight como día anterior).
    const reservation = {
      ...baseReservation,
      startDate: "2026-08-11T00:00:00.000Z",
      endDate: "2026-08-12T00:00:00.000Z",
      status: "CONFIRMED",
      billingType: "DAILY",
    };

    const { container } = render(<ReservationTable reservations={[reservation]} />);

    // Debe haber un pill con label "Activa"
    expect(container.textContent).toContain("Activa");
    // NO debe haber "Próxima"
    expect(container.textContent).not.toContain("Próxima");
    // Y debe mencionar noches restantes
    expect(container.textContent).toMatch(/noches?/i);
  });

  it("MONTHLY reserva con start_date = este mes → label 'Activa', no 'Próxima'", () => {
    const reservation = {
      ...baseReservation,
      startDate: "2026-08-11T00:00:00.000Z",
      endDate: "2026-11-30T00:00:00.000Z",
      status: "CONFIRMED",
      billingType: "MONTHLY",
    };

    const { container } = render(<ReservationTable reservations={[reservation]} />);

    expect(container.textContent).toContain("Activa");
    expect(container.textContent).not.toContain("Próxima");
    expect(container.textContent).toMatch(/mes(es)?/i);
  });

  it("reserva con start_date = mañana (DAILY) → label 'Próxima', sublabel 'Mañana' (no 'En 1 días')", () => {
    const reservation = {
      ...baseReservation,
      startDate: "2026-08-12T00:00:00.000Z",
      endDate: "2026-08-13T00:00:00.000Z",
      status: "CONFIRMED",
      billingType: "DAILY",
    };

    const { container } = render(<ReservationTable reservations={[reservation]} />);

    expect(container.textContent).toContain("Próxima");
    expect(container.textContent).toContain("Mañana");
    // Sublabel humano, no la versión cruda
    expect(container.textContent).not.toContain("En 1 días");
  });

  it("reserva con status CANCELLED → label 'Cancelada' (independiente de fechas)", () => {
    const reservation = {
      ...baseReservation,
      startDate: "2026-08-11T00:00:00.000Z",
      endDate: "2026-08-12T00:00:00.000Z",
      status: "CANCELLED",
    };

    const { container } = render(<ReservationTable reservations={[reservation]} />);

    expect(container.textContent).toContain("Cancelada");
    expect(container.textContent).not.toContain("Próxima");
    expect(container.textContent).not.toContain("Activa");
  });
});
