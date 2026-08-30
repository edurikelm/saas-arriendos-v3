import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DashboardTodayStrip } from "../dashboard-today-strip";
import type { DashboardToday } from "@/lib/dashboard/summary";

function expectInDoc(node: Element | null): asserts node is Element {
  expect(node).not.toBeNull();
}

const EMPTY_TODAY: DashboardToday = {
  arrivals: [],
  departures: [],
  inStayCount: 0,
  pendingConfirmationCount: 0,
  oldestPendingConfirmationDays: null,
  activeMonthlyContracts: 0,
  monthlyEndingSoon: [],
};

describe("DashboardTodayStrip", () => {
  it("renderiza llegadas y salidas con nombre de cliente y propiedad", () => {
    const today: DashboardToday = {
      ...EMPTY_TODAY,
      arrivals: [
        {
          reservationId: "res-arrival-1",
          kind: "ARRIVAL",
          clientName: "Camila Rojas",
          clientPhone: null,
          propertyName: "Cabaña del Lago",
          startDate: "2026-08-30T00:00:00.000Z",
          endDate: "2026-09-05T00:00:00.000Z",
          unitsBooked: 1,
        },
      ],
      departures: [
        {
          reservationId: "res-departure-1",
          kind: "DEPARTURE",
          clientName: "Juan Pérez",
          clientPhone: null,
          propertyName: "Depto Centro",
          startDate: "2026-08-20T00:00:00.000Z",
          endDate: "2026-08-30T00:00:00.000Z",
          unitsBooked: 1,
        },
      ],
    };

    render(<DashboardTodayStrip today={today} />);

    expectInDoc(screen.queryByText(/1 llegada/));
    expectInDoc(screen.queryByText(/Camila Rojas/));
    expectInDoc(screen.queryByText(/Cabaña del Lago/));
    expectInDoc(screen.queryByText(/1 salida/));
    expectInDoc(screen.queryByText(/Juan Pérez/));
    expectInDoc(screen.queryByText(/Depto Centro/));

    const arrivalLink = screen.getByRole("link", { name: /Camila Rojas/ });
    expect(arrivalLink.getAttribute("href")).toBe("/reservations/res-arrival-1");
  });

  it("con todo en cero, renderiza solo el fallback 'Sin llegadas ni salidas hoy'", () => {
    render(<DashboardTodayStrip today={EMPTY_TODAY} />);

    const container = screen.getByRole("status");
    expect(container.textContent).toBe("HoySin llegadas ni salidas hoy");
  });

  it("muestra la línea de contratos mensuales cuando activeMonthlyContracts > 0", () => {
    const today: DashboardToday = {
      ...EMPTY_TODAY,
      activeMonthlyContracts: 3,
    };

    render(<DashboardTodayStrip today={today} />);

    expectInDoc(screen.queryByText(/3 contratos mensuales/));
  });

  it("muestra un vencimiento próximo con su plazo en días", () => {
    const today: DashboardToday = {
      ...EMPTY_TODAY,
      monthlyEndingSoon: [
        {
          reservationId: "res-ending-1",
          propertyName: "Casa Playa Norte",
          clientName: "Marta Silva",
          endDate: "2026-09-05T00:00:00.000Z",
          daysToEnd: 6,
        },
      ],
    };

    render(<DashboardTodayStrip today={today} />);

    expectInDoc(screen.queryByText(/1 vencimiento de contrato/));
    expectInDoc(screen.queryByText(/Casa Playa Norte/));
    expectInDoc(screen.queryByText(/vence en 6 días/));

    const link = screen.getByRole("link", { name: /Casa Playa Norte/ });
    expect(link.getAttribute("href")).toBe("/reservations/res-ending-1");
  });

  it("un contrato que termina HOY dice 'vence hoy', no 'vence en 0 días'", () => {
    const today: DashboardToday = {
      ...EMPTY_TODAY,
      monthlyEndingSoon: [
        {
          reservationId: "res-ending-today",
          propertyName: "Teja 2",
          clientName: "Alejandra Mayorga",
          endDate: "2026-08-30T00:00:00.000Z",
          daysToEnd: 0,
        },
      ],
    };

    render(<DashboardTodayStrip today={today} />);

    expectInDoc(screen.queryByText(/vence hoy/));
    expect(screen.queryByText(/vence en 0 días/)).toBeNull();
  });

  it("la reserva por confirmar más antigua creada hoy dice 'de hoy', no 'hace 0 días'", () => {
    const today: DashboardToday = {
      ...EMPTY_TODAY,
      pendingConfirmationCount: 2,
      oldestPendingConfirmationDays: 0,
    };

    render(<DashboardTodayStrip today={today} />);

    expectInDoc(screen.queryByText(/la más antigua, de hoy/));
    expect(screen.queryByText(/hace 0 días/)).toBeNull();
  });
});
