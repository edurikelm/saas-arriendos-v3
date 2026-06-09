import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import {
  getContinuationRadiusClass,
  CalendarGrid,
  type WeekReservation,
} from "../calendar-grid";

const defaultMonth = new Date(2025, 0, 1);

function formatYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function makeWr(
  overrides: Partial<WeekReservation> = {}
): WeekReservation {
  return {
    res: {
      id: "r1",
      startDate: "2025-01-01",
      endDate: "2025-01-07",
      status: "CONFIRMED",
      billingType: "DAILY",
      totalPrice: 100,
      property: { id: "p1", name: "Casa", color: "#6366F1" },
      client: { name: "Juan" },
    },
    startCol: 0,
    span: 7,
    lane: 0,
    continuesFromPreviousWeek: false,
    continuesIntoNextWeek: false,
    ...overrides,
  };
}

describe("getContinuationRadiusClass", () => {
  it("uses a rectangular radius when the reservation does not continue into another week", () => {
    const cls = getContinuationRadiusClass(makeWr());
    expect(cls).not.toMatch(/rounded-full/);
    expect(cls).toMatch(/rounded-(md|lg)/);
  });

  it("uses a rectangular right edge when it continues from the previous week", () => {
    const cls = getContinuationRadiusClass(
      makeWr({ continuesFromPreviousWeek: true })
    );
    expect(cls).not.toMatch(/rounded-full/);
    expect(cls).toMatch(/rounded-l-/);
    expect(cls).toMatch(/rounded-r-/);
  });

  it("uses a rectangular left edge when it continues into the next week", () => {
    const cls = getContinuationRadiusClass(
      makeWr({ continuesIntoNextWeek: true })
    );
    expect(cls).not.toMatch(/rounded-full/);
    expect(cls).toMatch(/rounded-l-/);
    expect(cls).toMatch(/rounded-r-/);
  });

  it("uses the smallest rectangular radius when it continues on both sides", () => {
    const cls = getContinuationRadiusClass(
      makeWr({
        continuesFromPreviousWeek: true,
        continuesIntoNextWeek: true,
      })
    );
    expect(cls).not.toMatch(/rounded-full/);
    expect(cls).toMatch(/rounded/);
  });
});

describe("CalendarGrid controls", () => {
  function getNavSegment() {
    const hoyButton = screen.getByRole("button", { name: "Hoy" });
    return hoyButton.parentElement as HTMLElement;
  }

  it("renders the 'Hoy' button with rounded-lg (ADR-0016 primary control)", () => {
    render(<CalendarGrid reservations={[]} currentMonth={defaultMonth} onMonthChange={() => {}} />);
    const hoyButton = screen.getByRole("button", { name: "Hoy" });
    const cls = hoyButton.className;
    expect(cls).not.toMatch(/rounded-full/);
    expect(cls).not.toMatch(/\brounded-md\b/);
    expect(cls).toMatch(/\brounded-lg\b/);
  });

  it("renders the previous month icon button with rounded-lg (ADR-0016 primary control)", () => {
    render(<CalendarGrid reservations={[]} currentMonth={defaultMonth} onMonthChange={() => {}} />);
    const segment = getNavSegment();
    const buttons = within(segment).getAllByRole("button");
    const prevButton = buttons[0];
    expect(prevButton).toBeDefined();
    const cls = prevButton.className;
    expect(cls).not.toMatch(/rounded-full/);
    expect(cls).not.toMatch(/\brounded-md\b/);
    expect(cls).toMatch(/\brounded-lg\b/);
  });

  it("renders the next month icon button with rounded-lg (ADR-0016 primary control)", () => {
    render(<CalendarGrid reservations={[]} currentMonth={defaultMonth} onMonthChange={() => {}} />);
    const segment = getNavSegment();
    const buttons = within(segment).getAllByRole("button");
    const nextButton = buttons[buttons.length - 1];
    expect(nextButton).toBeDefined();
    const cls = nextButton.className;
    expect(cls).not.toMatch(/rounded-full/);
    expect(cls).not.toMatch(/\brounded-md\b/);
    expect(cls).toMatch(/\brounded-lg\b/);
  });

  it("renders the 'Expandir todas' button with rounded-lg (ADR-0016 primary control) when weeks are expandable", () => {
    const monday = new Date(2025, 0, 6);
    const iso = formatYmd(monday);
    const manyReservations = [0, 1, 2].map((i) => ({
      id: `r${i}`,
      startDate: iso,
      endDate: iso,
      status: "CONFIRMED",
      billingType: "DAILY",
      totalPrice: 100,
      property: { id: "p1", name: "Casa", color: "#6366F1" },
      client: { name: `Cliente ${i}` },
    }));
    const { container } = render(
      <CalendarGrid reservations={manyReservations} currentMonth={new Date(2025, 0, 1)} onMonthChange={() => {}} />
    );
    const buttons = Array.from(container.querySelectorAll("button"));
    const expandAll = buttons.find((b) =>
      b.textContent?.includes("Expandir todas")
    );
    if (!expandAll) {
      const titles = Array.from(container.querySelectorAll("[title]")).map(
        (el) => el.getAttribute("title")
      );
      const allText = container.textContent || "";
      throw new Error(
        `No 'Expandir todas' button found. Buttons: ${buttons.length}, titles: ${JSON.stringify(titles)}, has 'Expandir' in text: ${allText.includes("Expandir")}`
      );
    }
    const cls = expandAll.className;
    expect(cls).not.toMatch(/rounded-full/);
    expect(cls).not.toMatch(/\brounded-md\b/);
    expect(cls).toMatch(/\brounded-lg\b/);
  });

  it("renders the +N overflow badge when a week has hidden reservations", () => {
    const monday = new Date(2025, 0, 6);
    const iso = formatYmd(monday);
    const manyReservations = [0, 1, 2].map((i) => ({
      id: `r${i}`,
      startDate: iso,
      endDate: iso,
      status: "CONFIRMED",
      billingType: "DAILY",
      totalPrice: 100,
      property: { id: "p1", name: "Casa", color: "#6366F1" },
      client: { name: `Cliente ${i}` },
    }));
    const { container } = render(
      <CalendarGrid reservations={manyReservations} currentMonth={new Date(2025, 0, 1)} onMonthChange={() => {}} />
    );
    const badges = Array.from(container.querySelectorAll("div"));
    const plusBadge = badges.find((b) => b.textContent?.startsWith("+"));
    expect(plusBadge).toBeDefined();
  });

  it("renders the 'Hoy' label overlay chip on the current day with a rectangular radius", () => {
    const { container } = render(<CalendarGrid reservations={[]} currentMonth={new Date()} onMonthChange={() => {}} />);
    const spans = Array.from(container.querySelectorAll("span"));
    const hoyChip = spans.find(
      (s) => s.textContent?.trim() === "Hoy" && s.className.includes("uppercase")
    );
    expect(hoyChip).toBeDefined();
    const cls = hoyChip!.className;
    expect(cls).not.toMatch(/rounded-full/);
    expect(cls).toMatch(/rounded/);
  });

  it("keeps the current-day date marker circular (rounded-full)", () => {
    const { container } = render(<CalendarGrid reservations={[]} currentMonth={new Date()} onMonthChange={() => {}} />);
    const divs = Array.from(container.querySelectorAll("div"));
    const dayMarker = divs.find(
      (d) =>
        d.className.includes("rounded-full") &&
        d.className.includes("bg-primary") &&
        d.className.includes("text-primary-foreground")
    );
    expect(dayMarker).toBeDefined();
  });
});
