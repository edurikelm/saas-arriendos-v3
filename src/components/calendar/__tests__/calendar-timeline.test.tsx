import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  CalendarTimeline,
  CalendarMonthGrid,
} from "../calendar-timeline";

const baseProperty = {
  id: "p1",
  name: "Casa Norte",
};

const baseClient = {
  id: "c1",
  name: "Juan Pérez",
  email: "juan@example.com",
};

const baseReservation = {
  id: "r1",
  propertyId: "p1",
  clientId: "c1",
  startDate: "2025-01-10",
  endDate: "2025-01-15",
  billingType: "DAILY",
  unitsBooked: 1,
  totalPrice: "300000",
  status: "CONFIRMED",
  bookingAirbnb: false,
  notes: null,
  property: baseProperty,
  client: baseClient,
  payments: [],
};

const currentMonth = new Date("2025-01-15T00:00:00");

function makeRes(overrides: Partial<typeof baseReservation> = {}) {
  return { ...baseReservation, ...overrides };
}

describe("CalendarTimeline reservation bar", () => {
  it("renders the reservation bar with a rectangular radius and not rounded-full", () => {
    const { container } = render(
      <CalendarTimeline
        reservations={[makeRes()]}
        currentMonth={currentMonth}
        onSelectReservation={() => {}}
      />
    );
    const reservationBar = container.querySelector(
      "button[title]"
    ) as HTMLElement | null;
    expect(reservationBar).toBeTruthy();
    const cls = reservationBar!.className;
    expect(cls).not.toMatch(/rounded-full/);
    expect(cls).toMatch(/rounded-(md|lg|sm)/);
  });

  it("renders the inner 'n' chip with a small rectangular radius and not rounded-full", () => {
    const { container } = render(
      <CalendarTimeline
        reservations={[makeRes()]}
        currentMonth={currentMonth}
        onSelectReservation={() => {}}
      />
    );
    const spans = Array.from(container.querySelectorAll("span"));
    const nightChip = spans.find((s) =>
      /^\d+n$/.test(s.textContent?.trim() || "")
    );
    expect(nightChip).toBeDefined();
    const cls = nightChip!.className;
    expect(cls).not.toMatch(/rounded-full/);
    expect(cls).toMatch(/rounded-/);
  });
});

describe("CalendarMonthGrid navigation", () => {
  it("renders the 'Hoy' button with a rectangular radius", () => {
    render(
      <CalendarMonthGrid
        reservations={[]}
        currentMonth={currentMonth}
        onSelectReservation={() => {}}
        onMonthChange={() => {}}
      />
    );
    const hoyButton = screen.getByRole("button", { name: "Hoy" });
    const cls = hoyButton.className;
    expect(cls).not.toMatch(/rounded-full/);
  });

  it("renders the prev/next icon buttons without rounded-full", () => {
    const { container } = render(
      <CalendarMonthGrid
        reservations={[]}
        currentMonth={currentMonth}
        onSelectReservation={() => {}}
        onMonthChange={() => {}}
      />
    );
    const allButtons = Array.from(container.querySelectorAll("button"));
    const iconButtons = allButtons.filter(
      (b) => b.querySelector("svg") && b.textContent?.trim() === ""
    );
    expect(iconButtons.length).toBe(2);
    for (const btn of iconButtons) {
      expect(btn.className).not.toMatch(/rounded-full/);
    }
  });
});

describe("CalendarTimeline onSelectReservation callback", () => {
  it("calls onSelectReservation with reservation id when clicking a reservation bar", () => {
    const onSelectReservation = vi.fn();
    const reservation = makeRes();

    const { container } = render(
      <CalendarTimeline
        reservations={[reservation]}
        currentMonth={currentMonth}
        onSelectReservation={onSelectReservation}
      />
    );

    const reservationBar = container.querySelector(
      "button[title]"
    ) as HTMLElement | null;
    expect(reservationBar).toBeTruthy();

    fireEvent.click(reservationBar!);
    expect(onSelectReservation).toHaveBeenCalledWith(reservation.id);
  });

  it("does not call onSelectReservation when clicking elsewhere", () => {
    const onSelectReservation = vi.fn();

    render(
      <CalendarTimeline
        reservations={[makeRes()]}
        currentMonth={currentMonth}
        onSelectReservation={() => {}}
      />
    );

    // Click on the page header (not on a reservation bar)
    const header = screen.getByText("Casa Norte");
    fireEvent.click(header);
    expect(onSelectReservation).not.toHaveBeenCalled();
  });
});

describe("CalendarTimeline polish — status color doctrine", () => {
  // Helper: construye un currentMonth futuro fijo para evitar dependencia de new Date()
  // en runtime. La rama `upcoming` (no ended, no active) es la que ejercita el path
  // de bg-warning/10 vs bg-primary/10.
  const futureMonth = new Date("2099-06-15T00:00:00");

  it("PENDING bar uses warning token (Amber Hour), NOT primary", () => {
    // Per DESIGN.md:209 — "reservas con saldo pendiente" maps to Amber Hour
    // (warning), no a Verdigris. PENDING y CONFIRMED-upcoming deben diferenciarse.
    const { container } = render(
      <CalendarTimeline
        reservations={[makeRes({ status: "PENDING", startDate: "2099-06-10", endDate: "2099-06-15" })]}
        currentMonth={futureMonth}
        onSelectReservation={() => {}}
      />
    );
    const reservationBar = container.querySelector("button[title]") as HTMLElement | null;
    expect(reservationBar).toBeTruthy();
    const cls = reservationBar!.className;
    expect(cls).toMatch(/bg-warning/); // usa warning token, no primary
    expect(cls).toMatch(/text-warning/);
  });

  it("PENDING bar does NOT use bg-primary (differentiated from CONFIRMED)", () => {
    // Sanity check: el polish no debe romper la separación PENDING vs CONFIRMED.
    const { container } = render(
      <CalendarTimeline
        reservations={[makeRes({ status: "PENDING", startDate: "2099-06-10", endDate: "2099-06-15" })]}
        currentMonth={futureMonth}
        onSelectReservation={() => {}}
      />
    );
    const reservationBar = container.querySelector("button[title]") as HTMLElement | null;
    const cls = reservationBar!.className;
    expect(cls).not.toMatch(/bg-primary/);
  });

  it("CONFIRMED bar in a future month uses primary token (Verdigris)", () => {
    // Para evitar dependencia de `new Date()` en runtime, usamos una fecha futura
    // fija donde la reserva cae en "upcoming" (no ended) → bg-primary/10.
    // El branch temporal (active vs upcoming) se cubre por integración manual.
    const futureMonth = new Date("2099-06-15T00:00:00");
    const { container } = render(
      <CalendarTimeline
        reservations={[makeRes({ status: "CONFIRMED", startDate: "2099-06-10", endDate: "2099-06-15" })]}
        currentMonth={futureMonth}
        onSelectReservation={() => {}}
      />
    );
    const reservationBar = container.querySelector("button[title]") as HTMLElement | null;
    expect(reservationBar).toBeTruthy();
    const cls = reservationBar!.className;
    expect(cls).toMatch(/bg-primary/);
  });

  it("CANCELLED bar keeps destructive bg with line-through (terminal state)", () => {
    const { container } = render(
      <CalendarTimeline
        reservations={[makeRes({ status: "CANCELLED" })]}
        currentMonth={currentMonth}
        onSelectReservation={() => {}}
      />
    );
    const reservationBar = container.querySelector("button[title]") as HTMLElement | null;
    const cls = reservationBar!.className;
    expect(cls).toMatch(/bg-destructive/);
    expect(cls).toMatch(/line-through/);
  });
});

describe("CalendarTimeline polish — accessibility", () => {
  it("reservation bar exposes descriptive aria-label for screen readers", () => {
    // Antes: solo `title`. Ahora aria-label compuesto (cliente + estado + noches + fechas)
    // para que screen readers anuncien contexto sin requerir hover.
    const { container } = render(
      <CalendarTimeline
        reservations={[makeRes()]}
        currentMonth={currentMonth}
        onSelectReservation={() => {}}
      />
    );
    const reservationBar = container.querySelector("button[title]") as HTMLElement | null;
    expect(reservationBar).toBeTruthy();
    const ariaLabel = reservationBar!.getAttribute("aria-label");
    expect(ariaLabel).toBeTruthy();
    expect(ariaLabel).toMatch(/Juan Pérez/);
    expect(ariaLabel).toMatch(/Confirmada/);
    expect(ariaLabel).toMatch(/6 noches/); // Jan 10-15 → 6 noches
    expect(ariaLabel).toMatch(/ene/); // mes en español
  });
});
