import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type {
  DashboardAgendaEvent,
  DashboardCollectionKpi,
  DashboardSummary,
} from "@/lib/dashboard/summary";
import { DashboardHome } from "../dashboard-home";

const TODAY = "2026-09-14";

function makeCollection(overdue: { amount: number; count: number }): DashboardCollectionKpi {
  return {
    pendingCount: overdue.count,
    totalToCollect: overdue.amount,
    overdueCount: overdue.count,
    overdueAmount: overdue.amount,
    dueTodayCount: 0,
    dueTodayAmount: 0,
    upcoming7dCount: 0,
    upcoming7dAmount: 0,
    overdueInstallmentsCount: overdue.count,
    windowAmount: overdue.amount,
    windowCount: overdue.count,
    windowGroups: {
      OVERDUE: { ...overdue, hiddenAmount: 0, hiddenCount: 0 },
      DUE_SOON: { amount: 0, count: 0, hiddenAmount: 0, hiddenCount: 0 },
    },
  };
}

function makeEvent(overrides: Partial<DashboardAgendaEvent>): DashboardAgendaEvent {
  return {
    kind: "ARRIVAL",
    reservationId: "res-1",
    propertyId: "prop-1",
    propertyName: "Cabaña El Mirador",
    clientName: "Camila Rojas",
    billingType: "DAILY",
    nights: 5,
    months: 0,
    unitsBooked: 1,
    amountDue: 0,
    hasNoPayments: false,
    ...overrides,
  };
}

function makeSummary(overrides: Partial<DashboardSummary> = {}): DashboardSummary {
  return {
    todayKey: TODAY,
    collection: makeCollection({ amount: 0, count: 0 }),
    collectionItems: [],
    agenda: {
      horizonDays: 7,
      days: [{ dateKey: TODAY, offset: 0, events: [] }],
      nextEventAfterHorizon: null,
    },
    propertyBoard: { properties: [], occupiedUnits: 0, totalUnits: 0, allSingleUnit: true },
    month: {
      monthKey: "2026-09",
      dayOfMonth: 14,
      collected: 0,
      previousMonthKey: "2026-08",
      previousCutoffDay: 14,
      collectedPreviousSamePeriod: 0,
      occupancyRate: 0,
      occupiedNightUnits: 0,
      capacityNightUnits: 0,
    },
    isEmpty: { properties: false, reservations: false },
    ...overrides,
  };
}

describe("DashboardHome", () => {
  it("titula con la fecha de hoy y deja el nombre de la página para lectores de pantalla", () => {
    render(<DashboardHome summary={makeSummary()} />);

    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading.textContent).toBe("Dashboard: Lunes 14 de septiembre");
    expect(screen.getByText("Dashboard:").classList.contains("sr-only")).toBe(true);
  });

  it("resume en el subtítulo el movimiento de hoy y la plata vencida", () => {
    const summary = makeSummary({
      collection: makeCollection({ amount: 3_095_000, count: 3 }),
      agenda: {
        horizonDays: 7,
        days: [
          {
            dateKey: TODAY,
            offset: 0,
            events: [
              makeEvent({ kind: "DEPARTURE", reservationId: "res-2" }),
              makeEvent({ kind: "DEPARTURE", reservationId: "res-3" }),
              makeEvent({ kind: "ARRIVAL", reservationId: "res-4" }),
            ],
          },
        ],
        nextEventAfterHorizon: null,
      },
    });

    render(<DashboardHome summary={summary} />);

    expect(screen.getByText("1 llegada y 2 salidas hoy · 3 cobros vencidos por $3.095.000")).toBeTruthy();
  });

  it("sin movimiento ni vencidos, el subtítulo lo dice en vez de quedar vacío", () => {
    render(<DashboardHome summary={makeSummary()} />);

    expect(screen.getByText("Sin llegadas ni salidas hoy · Cobranza al día")).toBeTruthy();
  });

  it("una cuenta sin reservas ve los primeros pasos y ninguna sección vacía", () => {
    render(
      <DashboardHome
        summary={makeSummary({ isEmpty: { properties: true, reservations: true } })}
      />,
    );

    expect(screen.getByRole("heading", { name: "Primeros pasos" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: /Agenda/ })).toBeNull();
    expect(screen.queryByText(/Cobranza al día/)).toBeNull();
    // Un solo camino: el botón del encabezado repetiría el paso de la reserva.
    expect(screen.queryByRole("link", { name: /Nueva Reserva/ })).toBeNull();
  });

  it("con reservas muestra las cuatro secciones", () => {
    render(<DashboardHome summary={makeSummary()} />);

    expect(screen.getByRole("heading", { name: /Agenda/ })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Cobros pendientes" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Propiedades" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Septiembre" })).toBeTruthy();
  });
});
