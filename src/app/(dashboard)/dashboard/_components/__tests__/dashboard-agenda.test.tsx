import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { DashboardAgenda as AgendaData, DashboardAgendaEvent } from "@/lib/dashboard/summary";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

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
    lastNightDateKey: "2026-09-18",
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

  describe("preview de la reserva", () => {
    afterEach(() => {
      vi.unstubAllGlobals();
      push.mockReset();
    });

    const renderOne = () =>
      render(
        <DashboardAgenda
          agenda={makeAgenda({ days: [{ dateKey: TODAY, offset: 0, events: [makeEvent()] }] })}
          todayKey={TODAY}
        />,
      );

    const apiReservation = {
      id: "res-1",
      propertyId: "prop-1",
      clientId: "cli-1",
      startDate: "2026-09-14T15:00:00.000Z",
      endDate: "2026-09-18T15:00:00.000Z",
      billingType: "DAILY",
      unitsBooked: 1,
      totalPrice: "300000",
      status: "CONFIRMED",
      bookingAirbnb: false,
      notes: null,
      createdAt: "2026-09-01T12:00:00.000Z",
      property: {
        id: "prop-1",
        name: "Cabaña El Mirador",
        color: "#3B82F6",
        unitsAvailable: 1,
        dailyPrice: "60000",
        monthlyPrice: null,
      },
      client: { id: "cli-1", name: "Camila Rojas", email: "camila@example.com", phone: null },
      payments: [],
    };

    it("un click abre el mismo preview que /calendar, con el link a la reserva completa", async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => apiReservation });
      vi.stubGlobal("fetch", fetchMock);
      renderOne();

      fireEvent.click(screen.getByRole("link", { name: /Camila Rojas/ }));

      const cta = await screen.findByRole("link", { name: /Ver reserva completa/ });
      expect(cta.getAttribute("href")).toBe("/reservations/res-1");
      expect(fetchMock).toHaveBeenCalledWith("/api/reservations/res-1");
      expect(screen.getByText("camila@example.com")).toBeTruthy();
      expect(push).not.toHaveBeenCalled();
    });

    it("si no se puede traer el detalle, navega a la página de la reserva", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
      renderOne();

      fireEvent.click(screen.getByRole("link", { name: /Camila Rojas/ }));

      await waitFor(() => expect(push).toHaveBeenCalledWith("/reservations/res-1"));
      expect(screen.queryByRole("link", { name: /Ver reserva completa/ })).toBeNull();
    });

    it("ctrl+click conserva la navegación del link y no abre el preview", () => {
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
      renderOne();

      fireEvent.click(screen.getByRole("link", { name: /Camila Rojas/ }), { ctrlKey: true });

      expect(fetchMock).not.toHaveBeenCalled();
    });
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

  // La Última Noche es la noche anterior al día de salida (CONTEXT.md): una
  // salida del viernes 18 muestra "jueves 17", nunca el 18.
  it("muestra la última noche de las reservas diarias, no de las mensuales", () => {
    const agenda = makeAgenda({
      days: [
        { dateKey: TODAY, offset: 0, events: [] },
        {
          dateKey: "2026-09-18",
          offset: 4,
          events: [
            makeEvent({ kind: "DEPARTURE", lastNightDateKey: "2026-09-17" }),
            makeEvent({ reservationId: "res-2", clientName: "Luis Pérez", lastNightDateKey: "2026-10-02" }),
            makeEvent({
              reservationId: "res-3",
              clientName: "Andrea Soto",
              billingType: "MONTHLY",
              months: 3,
              lastNightDateKey: "2026-12-17",
            }),
          ],
        },
      ],
    });

    render(<DashboardAgenda agenda={agenda} todayKey={TODAY} />);

    const camila = screen.getByRole("link", { name: /Camila Rojas/ });
    expect(within(camila).getByText("Última noche jue 17")).toBeTruthy();
    const luis = screen.getByRole("link", { name: /Luis Pérez/ });
    expect(within(luis).getByText("Última noche vie 2 oct")).toBeTruthy();
    const andrea = screen.getByRole("link", { name: /Andrea Soto/ });
    expect(within(andrea).queryByText(/Última noche/)).toBeNull();
  });

  it("una salida de hoy muestra su última noche como ayer", () => {
    const agenda = makeAgenda({
      days: [
        {
          dateKey: TODAY,
          offset: 0,
          events: [makeEvent({ kind: "DEPARTURE", lastNightDateKey: "2026-09-13" })],
        },
      ],
    });

    render(<DashboardAgenda agenda={agenda} todayKey={TODAY} />);

    expect(screen.getByText("Última noche ayer")).toBeTruthy();
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
    expect(screen.getByText("Sin llegadas ni salidas")).toBeTruthy();
    expect(screen.queryByRole("list", { name: "Hoy" })).toBeNull();
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
