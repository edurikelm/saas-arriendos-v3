import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { ReservationTable } from "../reservation-table";

vi.mock("@/lib/reservation-payment", () => ({
  getPaymentStatus: vi.fn(() => ({ label: "Pendiente", tone: "amber" as const })),
}));

vi.mock("@/lib/reservation-dates", () => ({
  getInclusiveMonths: vi.fn(() => 1),
}));

const reservation = {
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
    const { container } = render(<ReservationTable reservations={[reservation]} />);

    const pills = container.querySelectorAll("span");
    const reservationPill = Array.from(pills).find((el) =>
      el.classList.contains("rounded-md")
    );
    expect(reservationPill).toBeDefined();
  });

  it("ReservationPill does NOT use rounded-full on its container", () => {
    const { container } = render(<ReservationTable reservations={[reservation]} />);

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
