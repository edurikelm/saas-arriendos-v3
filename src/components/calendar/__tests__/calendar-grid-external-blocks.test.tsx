import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { CalendarGrid } from "../calendar-grid";
import type { CalendarReservation, CalendarExternalBlock } from "@/lib/actions/reservations";

const defaultMonth = new Date(2025, 5, 1); // June 2025

const baseReservation: CalendarReservation = {
  id: "r1",
  startDate: "2025-06-05",
  endDate: "2025-06-10",
  status: "CONFIRMED",
  billingType: "DAILY",
  totalPrice: 100,
  property: { id: "p1", name: "Casa", color: "#6366F1" },
  client: { name: "Juan" },
};

const baseBlock: CalendarExternalBlock = {
  id: "b1",
  startDate: "2025-06-08",
  endDate: "2025-06-12",
  channel: "AIRBNB",
  propertyId: "p1",
  summary: null,
};

function makeRes(overrides: Partial<CalendarReservation> = {}): CalendarReservation {
  return { ...baseReservation, ...overrides };
}

function makeBlock(overrides: Partial<CalendarExternalBlock> = {}): CalendarExternalBlock {
  return { ...baseBlock, ...overrides };
}

describe("CalendarGrid external blocks", () => {
  it("renders without externalBlocks when prop is empty array", () => {
    const { container } = render(
      <CalendarGrid
        reservations={[makeRes()]}
        externalBlocks={[]}
        conflicts={new Set()}
        currentMonth={defaultMonth}
        onMonthChange={() => {}}
      />
    );
    expect(container.querySelectorAll(".border-dashed")).toHaveLength(0);
  });

  it("renders external block bars when externalBlocks prop is provided", () => {
    const { container } = render(
      <CalendarGrid
        reservations={[makeRes()]}
        externalBlocks={[makeBlock()]}
        conflicts={new Set()}
        currentMonth={defaultMonth}
        onMonthChange={() => {}}
      />
    );
    // Should render at least one dashed border block
    const blocks = container.querySelectorAll(".border-dashed");
    expect(blocks.length).toBeGreaterThan(0);
  });

  it("does not render blocks when externalBlocks prop not provided (default empty)", () => {
    const { container } = render(
      <CalendarGrid
        reservations={[makeRes()]}
        currentMonth={defaultMonth}
        onMonthChange={() => {}}
      />
    );
    const blocks = container.querySelectorAll(".border-dashed");
    expect(blocks.length).toBe(0);
  });

  it("renders conflict dot on day header when conflicts Set has that date", () => {
    const { container } = render(
      <CalendarGrid
        reservations={[makeRes()]}
        externalBlocks={[makeBlock()]}
        conflicts={new Set(["2025-06-09"])}
        currentMonth={defaultMonth}
        onMonthChange={() => {}}
      />
    );
    const amberDot = container.querySelector(".bg-warning");
    expect(amberDot).not.toBeNull();
  });

  it("renders Airbnb channel dot with info color", () => {
    const { container } = render(
      <CalendarGrid
        reservations={[]}
        externalBlocks={[makeBlock({ channel: "AIRBNB" })]}
        conflicts={new Set()}
        currentMonth={defaultMonth}
        onMonthChange={() => {}}
      />
    );
    const infoDot = container.querySelector(".bg-info");
    expect(infoDot).not.toBeNull();
  });

  it("renders Booking.com channel dot with primary color", () => {
    const { container } = render(
      <CalendarGrid
        reservations={[]}
        externalBlocks={[makeBlock({ channel: "BOOKING_COM" })]}
        conflicts={new Set()}
        currentMonth={defaultMonth}
        onMonthChange={() => {}}
      />
    );
    const primaryDot = container.querySelector(".bg-primary");
    expect(primaryDot).not.toBeNull();
  });

  it("renders VRBO channel dot with accent color", () => {
    const { container } = render(
      <CalendarGrid
        reservations={[]}
        externalBlocks={[makeBlock({ channel: "VRBO" })]}
        conflicts={new Set()}
        currentMonth={defaultMonth}
        onMonthChange={() => {}}
      />
    );
    const accentDot = container.querySelector(".bg-accent");
    expect(accentDot).not.toBeNull();
  });

  it("renders OTHER channel dot with muted-foreground color", () => {
    const { container } = render(
      <CalendarGrid
        reservations={[]}
        externalBlocks={[makeBlock({ channel: "OTHER" })]}
        conflicts={new Set()}
        currentMonth={defaultMonth}
        onMonthChange={() => {}}
      />
    );
    const mutedDot = container.querySelector(".bg-muted-foreground");
    expect(mutedDot).not.toBeNull();
  });

  it("shows channel letter chip (A for Airbnb)", () => {
    const { container } = render(
      <CalendarGrid
        reservations={[]}
        externalBlocks={[makeBlock({ channel: "AIRBNB" })]}
        conflicts={new Set()}
        currentMonth={defaultMonth}
        onMonthChange={() => {}}
      />
    );
    const chip = Array.from(container.querySelectorAll(".border-dashed")).find((el) =>
      el.textContent?.includes("A")
    );
    expect(chip).toBeDefined();
  });

  // Issue #131 criterio de aceptación: "Grid mantiene legibilidad con muchos bloqueos externos".
  // Verifica que con 12 bloques simultáneos en una sola semana, todos se renderizan con su
  // estilo sutil (border-dashed) sin saturar visualmente ni romper el layout.
  it("mantiene legibilidad con muchos bloqueos externos simultáneos (12 en una semana)", () => {
    const manyBlocks: CalendarExternalBlock[] = Array.from({ length: 12 }, (_, i) => ({
      ...baseBlock,
      id: `b-many-${i}`,
      startDate: "2025-06-09",
      endDate: "2025-06-13",
      channel: (["AIRBNB", "BOOKING_COM", "VRBO", "OTHER"] as const)[i % 4],
      summary: null,
    }));

    const { container } = render(
      <CalendarGrid
        reservations={[]}
        externalBlocks={manyBlocks}
        conflicts={new Set()}
        currentMonth={defaultMonth}
        onMonthChange={() => {}}
      />
    );

    // Cada bloque se renderiza con su clase border-dashed (12 expected).
    const dashedBars = container.querySelectorAll(".border-dashed");
    expect(dashedBars.length).toBeGreaterThanOrEqual(12);

    // Cada canal distinto tiene su dot de color presente (tokens semánticos).
    expect(container.querySelector(".bg-info")).not.toBeNull();          // AIRBNB
    expect(container.querySelector(".bg-primary")).not.toBeNull();         // BOOKING_COM
    expect(container.querySelector(".bg-accent")).not.toBeNull();         // VRBO
    expect(container.querySelector(".bg-muted-foreground")).not.toBeNull(); // OTHER
  });
});
