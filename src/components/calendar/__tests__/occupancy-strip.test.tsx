import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { OccupancyStrip } from "../occupancy-strip";

const property = { id: "p1", name: "Casa Norte" };
const client = { id: "c1", name: "Juan Pérez" };

function makeRes(overrides: {
  id?: string;
  startDate: string;
  endDate: string;
  status?: string;
}) {
  return {
    id: overrides.id ?? "r1",
    propertyId: "p1",
    startDate: overrides.startDate,
    endDate: overrides.endDate,
    billingType: "DAILY",
    status: overrides.status ?? "CONFIRMED",
    client,
    property,
  };
}

describe("OccupancyStrip pill colors", () => {
  const today = new Date("2026-07-17T00:00:00");

  it("renders active reservation (in course) with solid bg-primary", () => {
    const active = makeRes({
      id: "active",
      // 16 jul ≤ 17 jul ≤ 19 jul → activa
      startDate: "2026-07-16",
      endDate: "2026-07-19",
    });
    const { container } = render(
      <OccupancyStrip
        reservations={[active]}
        properties={[property]}
        days={14}
        today={today}
      />
    );
    const pill = container.querySelector('a[href*="reservationId=active"]');
    expect(pill).toBeTruthy();
    expect(pill!.className).toContain("bg-primary");
    expect(pill!.className).not.toContain("bg-primary/10");
    expect(pill!.className).not.toContain("border");
  });

  it("renders upcoming reservation (not yet started) with border + bg-primary/10", () => {
    const upcoming = makeRes({
      id: "upcoming",
      // 22 jul > 17 jul → próxima
      startDate: "2026-07-22",
      endDate: "2026-07-25",
    });
    const { container } = render(
      <OccupancyStrip
        reservations={[upcoming]}
        properties={[property]}
        days={14}
        today={today}
      />
    );
    const pill = container.querySelector('a[href*="reservationId=upcoming"]');
    expect(pill).toBeTruthy();
    expect(pill!.className).toContain("bg-primary/10");
    expect(pill!.className).toContain("border");
    expect(pill!.className).toContain("primary/20");
  });

  it("renders active and upcoming reservations with different colors", () => {
    const active = makeRes({
      id: "active",
      startDate: "2026-07-16",
      endDate: "2026-07-19",
    });
    const upcoming = makeRes({
      id: "upcoming",
      startDate: "2026-07-22",
      endDate: "2026-07-25",
    });
    const { container } = render(
      <OccupancyStrip
        reservations={[active, upcoming]}
        properties={[property]}
        days={14}
        today={today}
      />
    );
    const activePill = container.querySelector('a[href*="reservationId=active"]');
    const upcomingPill = container.querySelector('a[href*="reservationId=upcoming"]');
    expect(activePill).toBeTruthy();
    expect(upcomingPill).toBeTruthy();
    // Active usa bg-primary sólido; upcoming usa bg-primary/10 con border
    expect(activePill!.className).toMatch(/bg-primary($|\s)/);
    expect(upcomingPill!.className).toContain("bg-primary/10");
    expect(upcomingPill!.className).toContain("border");
  });

  it("uses primary-foreground text for active pills and primary text for upcoming pills", () => {
    const active = makeRes({
      id: "active",
      startDate: "2026-07-16",
      endDate: "2026-07-19",
    });
    const upcoming = makeRes({
      id: "upcoming",
      startDate: "2026-07-22",
      endDate: "2026-07-25",
    });
    const { container } = render(
      <OccupancyStrip
        reservations={[active, upcoming]}
        properties={[property]}
        days={14}
        today={today}
      />
    );
    const activeText = container.querySelector('a[href*="reservationId=active"] span');
    const upcomingText = container.querySelector('a[href*="reservationId=upcoming"] span');
    expect(activeText).toBeTruthy();
    expect(upcomingText).toBeTruthy();
    expect(activeText!.className).toContain("text-primary-foreground");
    expect(upcomingText!.className).toContain("text-primary");
  });
});
