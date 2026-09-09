/**
 * `/calendar` deja de excluir reservas MONTHLY. Estos tests cubren, a nivel
 * de `CalendarView` (integración con el resto del cliente, no solo el
 * timeline puro):
 *
 * 1. Una reserva MONTHLY ya no se pierde en el filtro client-side — antes
 *    `dailyReservations = reservations.filter(r => r.billingType === "DAILY")`
 *    la descartaba incluso si el server ya la enviaba.
 * 2. La alarma de sobreventa cuenta unidades consumidas por una reserva
 *    MONTHLY exactamente igual que por una DAILY (regla que ya aplica
 *    `checkAvailability`) — antes el punto ciego descrito en CONTEXT.md.
 *
 * Fechas relativas a "hoy" (no fijas) para no depender de en qué mes corre
 * la suite — igual que hacen otros tests de este directorio.
 *
 * Mock pattern (currentMockReservations/Blocks reasignables por test antes de
 * `render`) calcado de calendar-view-toggle.test.tsx: `CalendarView` refetch-ea
 * en un `useEffect` al montar, así que el mock debe reflejar los mismos datos
 * que `initialReservations`/`initialExternalBlocks`, o el efecto los pisa.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { CalendarView } from "../calendar-view";
import type { CalendarReservation, CalendarExternalBlock } from "@/lib/actions/reservations";

let currentMockReservations: CalendarReservation[] = [];
let currentMockBlocks: CalendarExternalBlock[] = [];

const { getCalendarReservationsMock, getCalendarExternalBlocksMock } = vi.hoisted(() => {
  return {
    getCalendarReservationsMock: vi.fn(),
    getCalendarExternalBlocksMock: vi.fn(),
  };
});
getCalendarReservationsMock.mockImplementation(() => Promise.resolve(currentMockReservations));
getCalendarExternalBlocksMock.mockImplementation(() => Promise.resolve(currentMockBlocks));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    property: { findMany: vi.fn() },
    reservation: { findMany: vi.fn() },
    externalChannelBlock: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/actions/reservations", () => ({
  getCalendarReservations: getCalendarReservationsMock,
  getCalendarExternalBlocks: getCalendarExternalBlocksMock,
  createReservation: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/calendar",
}));

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function currentMonthBounds(): { start: string; end: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed
  const lastDay = new Date(year, month + 1, 0).getDate();
  return {
    start: `${year}-${pad(month + 1)}-01`,
    end: `${year}-${pad(month + 1)}-${pad(lastDay)}`,
  };
}

const baseProperty = {
  id: "p1",
  name: "Casa",
  unitsAvailable: 1,
  dailyPrice: "50000",
  monthlyPrice: "500000",
};

const baseClient = { id: "c1", name: "Juan", email: "juan@test.com" };

function makeMonthlyRes(overrides: Partial<CalendarReservation> = {}): CalendarReservation {
  const { start, end } = currentMonthBounds();
  return {
    id: "r-monthly",
    startDate: start,
    endDate: end,
    status: "CONFIRMED",
    billingType: "MONTHLY",
    totalPrice: 500000,
    unitsBooked: 1,
    property: { id: "p1", name: "Casa" },
    client: { name: "Juan" },
    ...overrides,
  };
}

function makeBlock(overrides: Partial<CalendarExternalBlock> = {}): CalendarExternalBlock {
  const { start } = currentMonthBounds();
  return {
    id: "b1",
    startDate: start,
    endDate: start,
    channel: "AIRBNB",
    propertyId: "p1",
    summary: null,
    ...overrides,
  };
}

describe("CalendarView includes MONTHLY reservations", () => {
  beforeEach(() => {
    currentMockReservations = [];
    currentMockBlocks = [];
  });

  it("no descarta una reserva MONTHLY del contador de 'reservas activas'", async () => {
    currentMockReservations = [makeMonthlyRes()];
    render(
      <CalendarView
        initialReservations={[makeMonthlyRes()]}
        properties={[baseProperty]}
        clients={[baseClient]}
        plan="FREE"
      />
    );
    await new Promise((r) => setTimeout(r, 100));
    expect(screen.getByText(/1 reservas activas/)).toBeDefined();
  });

  it("una reserva MONTHLY + un bloqueo externo que exceden unitsAvailable disparan la alarma de sobreventa", async () => {
    currentMockReservations = [makeMonthlyRes()];
    currentMockBlocks = [makeBlock()];
    render(
      <CalendarView
        initialReservations={[makeMonthlyRes()]}
        initialExternalBlocks={[makeBlock()]}
        initialShowExternalBlocks={true}
        properties={[baseProperty]}
        clients={[baseClient]}
        plan="PRO"
      />
    );
    await new Promise((r) => setTimeout(r, 100));
    expect(screen.getByText(/Sobreventa en/)).toBeDefined();
  });

  it("sin la reserva MONTHLY (solo el bloqueo), NO hay sobreventa — confirma que es la mensual la que la dispara", async () => {
    currentMockReservations = [];
    currentMockBlocks = [makeBlock()];
    render(
      <CalendarView
        initialReservations={[]}
        initialExternalBlocks={[makeBlock()]}
        initialShowExternalBlocks={true}
        properties={[baseProperty]}
        clients={[baseClient]}
        plan="PRO"
      />
    );
    await new Promise((r) => setTimeout(r, 100));
    expect(screen.queryByText(/Sobreventa en/)).toBeNull();
  });

  // Regresión: el banner solo cuenta días DEL MES VISIBLE.
  //
  // `computeOverbookedDays` recorre el rango completo de cada reserva, y las que
  // se traen son las que INTERSECTAN el mes, no las que caben en él. Dos reservas
  // que se solapan fuera del mes visible generaban días que el banner contaba pero
  // el timeline no podía marcar (solo dibuja los días del mes). Medido antes del
  // recorte, con una mensual del mes actual hasta 3 meses después más una diaria
  // que se estira al mes siguiente sobre 1 unidad: el banner decía "23 días"
  // cuando en el mes visible había 3.
  //
  // El caso era posible desde antes con diarias multi-mes, pero se volvió
  // frecuente y mucho más grande al incluir las MONTHLY.
  it("no cuenta días de sobreventa que caen fuera del mes visible", async () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const lastDay = new Date(year, month + 1, 0).getDate();
    const mesVisible = `${year}-${pad(month + 1)}`;

    // Mensual: desde el mes visible hasta 3 meses después.
    const finLejano = new Date(year, month + 3, 28);
    const mensual = makeMonthlyRes({
      id: "r-larga",
      startDate: `${year}-${pad(month + 1)}-01`,
      endDate: `${finLejano.getFullYear()}-${pad(finLejano.getMonth() + 1)}-28`,
    });
    // Diaria: arranca los últimos 3 días del mes visible y se estira al siguiente.
    const finDiaria = new Date(year, month + 1, 20);
    const diaria = makeMonthlyRes({
      id: "r-diaria",
      billingType: "DAILY",
      startDate: `${year}-${pad(month + 1)}-${pad(lastDay - 2)}`,
      endDate: `${finDiaria.getFullYear()}-${pad(finDiaria.getMonth() + 1)}-20`,
    });

    currentMockReservations = [mensual, diaria];
    currentMockBlocks = [];
    render(
      <CalendarView
        initialReservations={[mensual, diaria]}
        initialExternalBlocks={[]}
        initialShowExternalBlocks={true}
        properties={[baseProperty]}
        clients={[baseClient]}
        plan="PRO"
      />
    );
    await new Promise((r) => setTimeout(r, 100));

    // Se solapan los últimos 3 días del mes visible y ~20 días del siguiente.
    // Solo los 3 del mes visible pueden marcarse en el timeline.
    const banner = screen.getByText(/Sobreventa en/);
    expect(banner.textContent).toMatch(/Sobreventa en 3 días/);
    expect(mesVisible).toBeTruthy();
  });
});
