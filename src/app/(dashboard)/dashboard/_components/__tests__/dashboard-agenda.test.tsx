import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import type { DashboardAgenda as AgendaData, DashboardAgendaEvent } from "@/lib/dashboard/summary";
import { DashboardAgenda } from "../dashboard-agenda";

const TODAY = "2026-09-14";

function makeEvent(overrides: Partial<DashboardAgendaEvent> = {}): DashboardAgendaEvent {
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

function makeAgenda(overrides: Partial<AgendaData> = {}): AgendaData {
  return {
    horizonDays: 7,
    days: [{ dateKey: TODAY, offset: 0, events: [] }],
    nextEventAfterHorizon: null,
    ...overrides,
  };
}

describe("DashboardAgenda", () => {
  it("agrupa los eventos bajo el encabezado de su día", () => {
    const agenda = makeAgenda({
      days: [
        { dateKey: TODAY, offset: 0, events: [makeEvent()] },
        {
          dateKey: "2026-09-18",
          offset: 4,
          events: [
            makeEvent({ kind: "DEPARTURE", reservationId: "res-2", clientName: "Jorge Muñoz" }),
          ],
        },
      ],
    });

    render(<DashboardAgenda agenda={agenda} todayKey={TODAY} />);

    const hoy = screen.getByRole("list", { name: "Hoy" });
    expect(within(hoy).getByText("Camila Rojas")).toBeTruthy();
    expect(within(hoy).getByText("Llega")).toBeTruthy();

    const viernes = screen.getByRole("list", { name: "Viernes 18" });
    expect(within(viernes).getByText("Jorge Muñoz")).toBeTruthy();
    expect(within(viernes).getByText("Sale")).toBeTruthy();
  });

  it("cada evento enlaza al detalle de su reserva", () => {
    render(
      <DashboardAgenda
        agenda={makeAgenda({ days: [{ dateKey: TODAY, offset: 0, events: [makeEvent()] }] })}
        todayKey={TODAY}
      />,
    );

    const link = screen.getByRole("link", { name: /Camila Rojas/ });
    expect(link.getAttribute("href")).toBe("/reservations/res-1");
  });

  it("muestra la duración en noches para diarias y en meses para mensuales", () => {
    const agenda = makeAgenda({
      days: [
        {
          dateKey: TODAY,
          offset: 0,
          events: [
            makeEvent({ nights: 1 }),
            makeEvent({
              reservationId: "res-2",
              clientName: "Andrea Soto",
              billingType: "MONTHLY",
              nights: 92,
              months: 3,
              unitsBooked: 2,
            }),
          ],
        },
      ],
    });

    render(<DashboardAgenda agenda={agenda} todayKey={TODAY} />);

    expect(screen.getByText("Cabaña El Mirador · 1 noche")).toBeTruthy();
    expect(screen.getByText("Cabaña El Mirador · 3 meses · 2 unidades")).toBeTruthy();
  });

  // El monto solo aparece cuando hay plata exigible, y sin color: el color de
  // la cobranza vive en "Por cobrar".
  it("muestra el monto exigible con 'sin pagos' o 'saldo', y nada si está pagada", () => {
    const agenda = makeAgenda({
      days: [
        {
          dateKey: TODAY,
          offset: 0,
          events: [
            makeEvent({ amountDue: 300_000, hasNoPayments: true }),
            makeEvent({
              kind: "DEPARTURE",
              reservationId: "res-2",
              clientName: "Jorge Muñoz",
              amountDue: 145_000,
              hasNoPayments: false,
            }),
            makeEvent({ reservationId: "res-3", clientName: "Pedro Vidal", amountDue: 0 }),
          ],
        },
      ],
    });

    render(<DashboardAgenda agenda={agenda} todayKey={TODAY} />);

    const camila = screen.getByRole("link", { name: /Camila Rojas/ });
    expect(within(camila).getByText("$300.000")).toBeTruthy();
    expect(within(camila).getByText("sin pagos")).toBeTruthy();

    const jorge = screen.getByRole("link", { name: /Jorge Muñoz/ });
    expect(within(jorge).getByText("$145.000")).toBeTruthy();
    expect(within(jorge).getByText("saldo")).toBeTruthy();

    const pedro = screen.getByRole("link", { name: /Pedro Vidal/ });
    expect(within(pedro).queryByText(/\$/)).toBeNull();
  });

  it("hoy sin movimientos lo dice en su propio grupo si la semana tiene otros eventos", () => {
    const agenda = makeAgenda({
      days: [
        { dateKey: TODAY, offset: 0, events: [] },
        { dateKey: "2026-09-16", offset: 2, events: [makeEvent()] },
      ],
    });

    render(<DashboardAgenda agenda={agenda} todayKey={TODAY} />);

    expect(screen.getByRole("heading", { name: "Hoy" })).toBeTruthy();
    expect(screen.getByText("Sin llegadas ni salidas hoy.")).toBeTruthy();
    expect(screen.getByRole("list", { name: "Miércoles 16" })).toBeTruthy();
  });

  it("una semana sin movimientos dice cuándo es el próximo", () => {
    render(
      <DashboardAgenda
        agenda={makeAgenda({ nextEventAfterHorizon: { dateKey: "2026-09-26", offset: 12 } })}
        todayKey={TODAY}
      />,
    );

    expect(screen.getByText("Sin llegadas ni salidas en los próximos 7 días")).toBeTruthy();
    expect(screen.getByText("El próximo movimiento es el sáb 26.")).toBeTruthy();
  });

  it("una semana sin movimientos y nada después lo dice sin inventar fecha", () => {
    render(<DashboardAgenda agenda={makeAgenda()} todayKey={TODAY} />);

    expect(screen.getByText("No hay reservas por llegar ni por salir.")).toBeTruthy();
  });
});
