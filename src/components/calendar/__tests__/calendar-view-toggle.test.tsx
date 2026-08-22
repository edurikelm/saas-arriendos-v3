import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CalendarView } from "../calendar-view";
import type { CalendarReservation, CalendarExternalBlock } from "@/lib/actions/reservations";

const replaceMock = vi.fn();

// vi.hoisted() permite declarar estado mutable accesible desde los vi.mock()
// factories (que son hoisted al top del archivo antes que el código normal).
// Cada test reasigna `currentMockReservations` antes del render — el mock
// lee su valor actual vía closure en cada llamada. `let` es necesario para
// reasignar entre tests (la desestructuración de vi.hoisted lo exporta como const
// por defecto, lo cual rompe la mutación).
let currentMockReservations: CalendarReservation[] = [];
const { getCalendarReservationsMock } = vi.hoisted(() => {
  return {
    getCalendarReservationsMock: vi.fn(),
  };
});
// Configurar el mock para retornar currentMockReservations dinámicamente.
getCalendarReservationsMock.mockImplementation(
  () => Promise.resolve(currentMockReservations),
);

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    property: { findMany: vi.fn() },
    reservation: { findMany: vi.fn() },
    externalChannelBlock: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/actions/reservations", () => ({
  getCalendarReservations: getCalendarReservationsMock,
  getCalendarExternalBlocks: vi.fn().mockReturnValue(Promise.resolve([])),
  createReservation: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: replaceMock,
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/calendar",
}));

const baseProperty = {
  id: "p1",
  name: "Casa",
  unitsAvailable: 2,
  dailyPrice: "50000",
  monthlyPrice: null,
};

const baseClient = {
  id: "c1",
  name: "Juan",
  email: "juan@test.com",
};

function makeRes(overrides: Partial<CalendarReservation> = {}): CalendarReservation {
  // Fechas en el mes actual (runtime = agosto 2026) para que las reservas
  // caigan dentro del rango visible del calendar y ejerciten los filtros.
  return {
    id: "r1",
    startDate: "2026-08-10",
    endDate: "2026-08-15",
    status: "CONFIRMED",
    billingType: "DAILY",
    totalPrice: 100,
    unitsBooked: 1,
    property: { id: "p1", name: "Casa" },
    client: { name: "Juan" },
    ...overrides,
  };
}

function makeBlock(overrides: Partial<CalendarExternalBlock> = {}): CalendarExternalBlock {
  return {
    id: "b1",
    startDate: "2025-06-08",
    endDate: "2025-06-12",
    channel: "AIRBNB",
    propertyId: "p1",
    summary: null,
    ...overrides,
  };
}

describe("CalendarView external blocks toggle", () => {
  beforeEach(() => {
    replaceMock.mockClear();
    currentMockReservations = [];
  });

  it("hides Bloqueos button when plan is FREE", () => {
    render(
      <CalendarView
        initialReservations={[makeRes()]}
        properties={[baseProperty]}
        clients={[baseClient]}
        plan="FREE"
      />
    );
    const button = screen.queryByRole("button", { name: /bloqueos/i });
    expect(button).toBeNull();
  });

  it("shows Bloqueos button when plan is PRO", async () => {
    render(
      <CalendarView
        initialReservations={[makeRes()]}
        initialExternalBlocks={[makeBlock()]}
        initialShowExternalBlocks={false}
        properties={[baseProperty]}
        clients={[baseClient]}
        plan="PRO"
      />
    );
    // Wait for loading to finish
    await new Promise((r) => setTimeout(r, 100));
    const button = screen.queryByRole("button", { name: /bloqueos/i });
    expect(button).toBeDefined();
  });

  it("Bloqueos button has aria-pressed=false when toggle is OFF", async () => {
    render(
      <CalendarView
        initialReservations={[makeRes()]}
        initialExternalBlocks={[makeBlock()]}
        initialShowExternalBlocks={false}
        properties={[baseProperty]}
        clients={[baseClient]}
        plan="PRO"
      />
    );
    await new Promise((r) => setTimeout(r, 100));
    const button = screen.getByRole("button", { name: /bloqueos/i });
    expect(button.getAttribute("aria-pressed")).toBe("false");
  });

  it("Bloqueos button has aria-pressed=true when initialShowExternalBlocks is true", async () => {
    render(
      <CalendarView
        initialReservations={[makeRes()]}
        initialExternalBlocks={[makeBlock()]}
        initialShowExternalBlocks={true}
        properties={[baseProperty]}
        clients={[baseClient]}
        plan="PRO"
      />
    );
    await new Promise((r) => setTimeout(r, 100));
    const button = screen.getByRole("button", { name: /bloqueos/i });
    expect(button.getAttribute("aria-pressed")).toBe("true");
  });

  it("does not show conflict banner when no initialShowExternalBlocks", async () => {
    render(
      <CalendarView
        initialReservations={[makeRes()]}
        initialExternalBlocks={[makeBlock()]}
        initialShowExternalBlocks={false}
        properties={[baseProperty]}
        clients={[baseClient]}
        plan="PRO"
      />
    );
    await new Promise((r) => setTimeout(r, 100));
    const banner = screen.queryByText(/día\(s\) con conflicto/i);
    expect(banner).toBeNull();
  });
});

describe("CalendarView cancelled reservations toggle", () => {
  beforeEach(() => {
    replaceMock.mockClear();
    currentMockReservations = [];
  });

  it("does NOT show cancelled toggle when there are no CANCELLED reservations", async () => {
    render(
      <CalendarView
        initialReservations={[makeRes()]}
        properties={[baseProperty]}
        clients={[baseClient]}
        plan="FREE"
      />
    );
    await new Promise((r) => setTimeout(r, 100));
    // El toggle solo aparece si hay canceladas (no hay nada que filtrar).
    const toggle = screen.queryByRole("button", { name: /cancelada/i });
    expect(toggle).toBeNull();
  });

  it("shows cancelled toggle when there is at least one CANCELLED reservation", async () => {
    currentMockReservations = [makeRes({ id: "r-cancel", status: "CANCELLED" })];
    render(
      <CalendarView
        initialReservations={[makeRes({ id: "r-cancel", status: "CANCELLED" })]}
        properties={[baseProperty]}
        clients={[baseClient]}
      />
    );
    await new Promise((r) => setTimeout(r, 100));
    const toggle = screen.getByRole("button", { name: /cancelada/i });
    expect(toggle).toBeDefined();
  });

  it("cancelled toggle has aria-pressed=false by default", async () => {
    currentMockReservations = [makeRes({ id: "r-cancel", status: "CANCELLED" })];
    render(
      <CalendarView
        initialReservations={[makeRes({ id: "r-cancel", status: "CANCELLED" })]}
        properties={[baseProperty]}
        clients={[baseClient]}
      />
    );
    await new Promise((r) => setTimeout(r, 100));
    const toggle = screen.getByRole("button", { name: /cancelada/i });
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
  });

  it("cancelled toggle has aria-pressed=true when initialShowCancelled is true", async () => {
    currentMockReservations = [makeRes({ id: "r-cancel", status: "CANCELLED" })];
    render(
      <CalendarView
        initialReservations={[makeRes({ id: "r-cancel", status: "CANCELLED" })]}
        initialShowCancelled={true}
        properties={[baseProperty]}
        clients={[baseClient]}
      />
    );
    await new Promise((r) => setTimeout(r, 100));
    const toggle = screen.getByRole("button", { name: /ocultar.*cancelada/i });
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
  });

  it("toggling cancelled updates URL search params (showCancelled=1)", async () => {
    currentMockReservations = [makeRes({ id: "r-cancel", status: "CANCELLED" })];
    render(
      <CalendarView
        initialReservations={[makeRes({ id: "r-cancel", status: "CANCELLED" })]}
        properties={[baseProperty]}
        clients={[baseClient]}
      />
    );
    await new Promise((r) => setTimeout(r, 100));
    const toggle = screen.getByRole("button", { name: /cancelada/i });
    fireEvent.click(toggle);
    expect(replaceMock).toHaveBeenCalled();
    const lastCall = replaceMock.mock.calls[replaceMock.mock.calls.length - 1];
    const url = lastCall[0];
    expect(url).toMatch(/showCancelled=1/);
  });

  it("toggling cancelled OFF removes showCancelled from URL", async () => {
    currentMockReservations = [makeRes({ id: "r-cancel", status: "CANCELLED" })];
    render(
      <CalendarView
        initialReservations={[makeRes({ id: "r-cancel", status: "CANCELLED" })]}
        initialShowCancelled={true}
        properties={[baseProperty]}
        clients={[baseClient]}
      />
    );
    await new Promise((r) => setTimeout(r, 100));
    const toggle = screen.getByRole("button", { name: /ocultar.*cancelada/i });
    fireEvent.click(toggle);
    expect(replaceMock).toHaveBeenCalled();
    const lastCall = replaceMock.mock.calls[replaceMock.mock.calls.length - 1];
    const url = lastCall[0];
    expect(url).not.toMatch(/showCancelled=1/);
  });

  it("shows sublabel 'X canceladas ocultas' when toggle is OFF and there are cancelled", async () => {
    currentMockReservations = [
      makeRes({ id: "r-active" }),
      makeRes({ id: "r-cancel-1", status: "CANCELLED" }),
      makeRes({ id: "r-cancel-2", status: "CANCELLED" }),
    ];
    render(
      <CalendarView
        initialReservations={[
          makeRes({ id: "r-active" }),
          makeRes({ id: "r-cancel-1", status: "CANCELLED" }),
          makeRes({ id: "r-cancel-2", status: "CANCELLED" }),
        ]}
        properties={[baseProperty]}
        clients={[baseClient]}
      />
    );
    await new Promise((r) => setTimeout(r, 100));
    const sublabel = screen.getByTestId("cancelled-sublabel");
    expect(sublabel).toBeDefined();
    expect(sublabel.getAttribute("aria-label")).toMatch(/2 reservas canceladas ocultas/);
  });

  it("does NOT show sublabel when toggle is ON", async () => {
    currentMockReservations = [
      makeRes({ id: "r-active" }),
      makeRes({ id: "r-cancel", status: "CANCELLED" }),
    ];
    render(
      <CalendarView
        initialReservations={[
          makeRes({ id: "r-active" }),
          makeRes({ id: "r-cancel", status: "CANCELLED" }),
        ]}
        initialShowCancelled={true}
        properties={[baseProperty]}
        clients={[baseClient]}
      />
    );
    await new Promise((r) => setTimeout(r, 100));
    const sublabel = screen.queryByTestId("cancelled-sublabel");
    expect(sublabel).toBeNull();
  });

  it("uses singular 'cancelada oculta' when there is exactly 1 cancelled", async () => {
    currentMockReservations = [makeRes({ id: "r-cancel", status: "CANCELLED" })];
    render(
      <CalendarView
        initialReservations={[makeRes({ id: "r-cancel", status: "CANCELLED" })]}
        properties={[baseProperty]}
        clients={[baseClient]}
      />
    );
    await new Promise((r) => setTimeout(r, 100));
    const sublabel = screen.getByTestId("cancelled-sublabel");
    expect(sublabel).toBeDefined();
    // aria-label usa singular: "1 reserva cancelada oculta"
    expect(sublabel.getAttribute("aria-label")).toMatch(/1 reserva cancelada oculta$/);
  });
});
