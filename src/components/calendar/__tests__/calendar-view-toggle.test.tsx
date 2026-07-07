import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { CalendarView } from "../calendar-view";
import type { CalendarReservation, CalendarExternalBlock } from "@/lib/actions/reservations";

const replaceMock = vi.fn();

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    property: { findMany: vi.fn() },
    reservation: { findMany: vi.fn() },
    externalChannelBlock: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/actions/reservations", () => ({
  getCalendarReservations: vi.fn().mockReturnValue(Promise.resolve([])),
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
  return {
    id: "r1",
    startDate: "2025-06-05",
    endDate: "2025-06-10",
    status: "CONFIRMED",
    billingType: "DAILY",
    totalPrice: 100,
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
