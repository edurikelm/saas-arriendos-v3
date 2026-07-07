import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  CalendarTimeline,
  CalendarMonthGrid,
  ReservationDetailDialog,
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

describe("ReservationDetailDialog pills", () => {
  function renderDialog(overrides: Partial<typeof baseReservation> = {}) {
    return render(
      <ReservationDetailDialog
        reservation={makeRes(overrides)}
        onClose={() => {}}
      />
    );
  }

  it("renders the billing-type pill (DAILY) with a rectangular radius", () => {
    renderDialog({ billingType: "DAILY" });
    const dailyPill = screen
      .getByText("Tarifa diaria")
      .closest("div") as HTMLElement | null;
    expect(dailyPill).toBeTruthy();
    expect(dailyPill!.className).not.toMatch(/rounded-full/);
    expect(dailyPill!.className).toMatch(/rounded/);
  });

  it("renders the billing-type pill (MONTHLY) with a rectangular radius", () => {
    renderDialog({ billingType: "MONTHLY" });
    const monthlyPill = screen
      .getByText("Tarifa mensual")
      .closest("div") as HTMLElement | null;
    expect(monthlyPill).toBeTruthy();
    expect(monthlyPill!.className).not.toMatch(/rounded-full/);
    expect(monthlyPill!.className).toMatch(/rounded/);
  });

  it("renders the booking-source pill (Airbnb) with a rectangular radius", () => {
    renderDialog({ bookingAirbnb: true });
    const airbnbPill = screen
      .getByText("Booking Airbnb")
      .closest("div") as HTMLElement | null;
    expect(airbnbPill).toBeTruthy();
    expect(airbnbPill!.className).not.toMatch(/rounded-full/);
    expect(airbnbPill!.className).toMatch(/rounded/);
  });

  it("renders the booking-source pill (Direct) with a rectangular radius", () => {
    renderDialog({ bookingAirbnb: false });
    const directPill = screen
      .getByText("Directo")
      .closest("div") as HTMLElement | null;
    expect(directPill).toBeTruthy();
    expect(directPill!.className).not.toMatch(/rounded-full/);
    expect(directPill!.className).toMatch(/rounded/);
  });
});
