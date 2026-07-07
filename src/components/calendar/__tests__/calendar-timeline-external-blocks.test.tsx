import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { CalendarTimeline } from "../calendar-timeline";
import type { CalendarExternalBlock } from "@/lib/actions/reservations";

const currentMonth = new Date("2025-06-15");

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
  startDate: "2025-06-05",
  endDate: "2025-06-10",
  billingType: "DAILY" as const,
  unitsBooked: 1,
  totalPrice: "300000",
  status: "CONFIRMED",
  bookingAirbnb: false,
  notes: null,
  property: baseProperty,
  client: baseClient,
  payments: [],
};

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

function makeRes(overrides: Partial<typeof baseReservation> = {}) {
  return { ...baseReservation, ...overrides };
}

describe("CalendarTimeline external blocks", () => {
  it("renders sub-row for external blocks below main property row", () => {
    const { container } = render(
      <CalendarTimeline
        reservations={[makeRes()]}
        externalBlocks={[makeBlock()]}
        currentMonth={currentMonth}
        onSelectReservation={() => {}}
      />
    );
    // Look for dashed border elements (external block bars)
    const blocks = container.querySelectorAll(".border-dashed");
    expect(blocks.length).toBeGreaterThan(0);
  });

  it("does not render external block sub-row when externalBlocks is empty", () => {
    const { container } = render(
      <CalendarTimeline
        reservations={[makeRes()]}
        externalBlocks={[]}
        currentMonth={currentMonth}
        onSelectReservation={() => {}}
      />
    );
    const blocks = container.querySelectorAll(".border-dashed");
    expect(blocks.length).toBe(0);
  });

  it("renders external blocks for specific property only", () => {
    const { container } = render(
      <CalendarTimeline
        reservations={[
          makeRes({ propertyId: "p1" }),
          makeRes({ id: "r2", propertyId: "p2", property: { ...baseProperty, id: "p2", name: "Depto" } }),
        ]}
        externalBlocks={[
          makeBlock({ propertyId: "p1" }),
          makeBlock({ id: "b2", propertyId: "p2", channel: "BOOKING_COM" }),
        ]}
        currentMonth={currentMonth}
        onSelectReservation={() => {}}
      />
    );
    // Should have 2 external block bars (one per property)
    const blocks = container.querySelectorAll(".border-dashed");
    expect(blocks.length).toBeGreaterThanOrEqual(2);
  });

  it("shows channel letter chip A for Airbnb", () => {
    const { container } = render(
      <CalendarTimeline
        reservations={[makeRes()]}
        externalBlocks={[makeBlock({ channel: "AIRBNB" })]}
        currentMonth={currentMonth}
        onSelectReservation={() => {}}
      />
    );
    const chip = Array.from(container.querySelectorAll(".border-dashed")).find((el) =>
      el.textContent?.includes("A")
    );
    expect(chip).toBeDefined();
  });

  it("shows channel letter chip B for Booking.com", () => {
    const { container } = render(
      <CalendarTimeline
        reservations={[makeRes()]}
        externalBlocks={[makeBlock({ channel: "BOOKING_COM" })]}
        currentMonth={currentMonth}
        onSelectReservation={() => {}}
      />
    );
    const chip = Array.from(container.querySelectorAll(".border-dashed")).find((el) =>
      el.textContent?.includes("B")
    );
    expect(chip).toBeDefined();
  });

  it("renders block with tooltip about channel availability", () => {
    const { container } = render(
      <CalendarTimeline
        reservations={[makeRes()]}
        externalBlocks={[makeBlock({ channel: "AIRBNB" })]}
        currentMonth={currentMonth}
        onSelectReservation={() => {}}
      />
    );
    const block = container.querySelector(".border-dashed");
    expect(block).toBeDefined();
    const title = block?.getAttribute("title");
    expect(title).toContain("Airbnb");
  });
});
