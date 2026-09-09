/**
 * `getCalendarReservations` dejó de filtrar `billingType: "DAILY"` — una
 * reserva MONTHLY consume unidades igual que una DAILY (regla que ya aplica
 * `checkAvailability`), así que debe alimentar la alarma de sobreventa, la
 * ocupación y el revenue de `/calendar` (ver CONTEXT.md sección "Calendario").
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SessionUser } from "@/lib/auth/session";
import { Decimal } from "@prisma/client/runtime/client";

const mockPrisma = vi.hoisted(() => ({
  reservation: {
    findMany: vi.fn(),
  },
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: mockPrisma,
}));

vi.mock("@/lib/auth/session", () => ({
  getSession: vi.fn(),
}));

import { getSession } from "@/lib/auth/session";
import { getCalendarReservations } from "../reservations";

const mockSession: SessionUser = {
  userId: "user-1",
  role: "OWNER",
  plan: "PRO",
  email: "test@test.com",
};

function makeDbReservation(overrides: Record<string, unknown> = {}) {
  return {
    id: "r1",
    startDate: new Date("2026-09-05"),
    endDate: new Date("2026-09-10"),
    status: "CONFIRMED",
    billingType: "DAILY",
    totalPrice: new Decimal(100000),
    unitsBooked: 1,
    property: { id: "p1", name: "Casa", color: "brand-teal" },
    client: { name: "Juan" },
    ...overrides,
  };
}

describe("getCalendarReservations", () => {
  beforeEach(() => {
    vi.mocked(getSession).mockResolvedValue(mockSession);
    mockPrisma.reservation.findMany.mockReset();
  });

  it("no filtra por billingType en el where — trae DAILY y MONTHLY por igual", async () => {
    mockPrisma.reservation.findMany.mockResolvedValue([
      makeDbReservation({ id: "r-daily", billingType: "DAILY" }),
      makeDbReservation({ id: "r-monthly", billingType: "MONTHLY" }),
    ]);

    const result = await getCalendarReservations({ year: 2026, month: 9 });

    const whereArg = mockPrisma.reservation.findMany.mock.calls[0][0].where;
    expect(whereArg).not.toHaveProperty("billingType");

    expect(result.map((r) => r.billingType).sort()).toEqual(["DAILY", "MONTHLY"]);
    expect(result.find((r) => r.id === "r-monthly")).toBeDefined();
  });
});
