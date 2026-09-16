import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SessionUser } from "@/lib/auth/session";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    property: { findMany: vi.fn() },
    reservation: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/auth/session", () => ({
  getSession: vi.fn(),
}));

const ownerSession: SessionUser = {
  userId: "owner-1",
  role: "OWNER",
  plan: "PRO",
  email: "owner@test.com",
};

/**
 * `getDecisionSummary` recibe el rango como días `YYYY-MM-DD` (ADR-0038): el
 * navegador sabe qué día eligió, el servidor no.
 */
describe("getDecisionSummary — rango por días", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { getSession } = await import("@/lib/auth/session");
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(getSession).mockResolvedValue(ownerSession);
    vi.mocked(prisma.property.findMany).mockResolvedValue([
      { id: "prop-1", name: "Cabaña", unitsAvailable: 1 },
    ] as never);
  });

  it("cuenta un pago de las 22:30 del 31 de agosto en agosto y no en septiembre", async () => {
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(prisma.reservation.findMany).mockResolvedValue([
      {
        id: "res-1",
        propertyId: "prop-1",
        billingType: "DAILY",
        status: "CONFIRMED",
        startDate: new Date("2026-08-30T15:00:00.000Z"),
        endDate: new Date("2026-08-31T15:00:00.000Z"),
        totalPrice: 100_000,
        unitsBooked: 1,
        payments: [
          {
            id: "pay-1",
            amount: 100_000,
            status: "COMPLETED",
            paymentType: "RESERVATION",
            method: "MERCADO_PAGO",
            paidAt: new Date("2026-09-01T02:30:00.000Z"), // 31 ago 22:30 en Santiago
            deletedAt: null,
            dueDate: null,
          },
        ],
      },
    ] as never);

    const { getDecisionSummary } = await import("@/lib/actions/reports");

    const september = await getDecisionSummary({ rangeStartKey: "2026-09-01", rangeEndKey: "2026-09-30" });
    expect(september?.collectedCash).toBe(0);
    expect(september?.cash.byMonth.map((m) => m.monthKey)).toEqual(["2026-09"]);
    // 30 noches: el borde final es el día 30, no el 1 de octubre.
    expect(september?.capacityNightUnits).toBe(30);

    const august = await getDecisionSummary({ rangeStartKey: "2026-08-01", rangeEndKey: "2026-08-31" });
    expect(august?.collectedCash).toBe(100_000);
    expect(august?.cash.byMonth).toEqual([
      { monthKey: "2026-08", collectedCash: 100_000, paymentCount: 1, cancelledCash: 0 },
    ]);
    expect(august?.cash.byMethod).toEqual({ MERCADO_PAGO: 100_000 });
  });

  it.each([
    ["vacía", ""],
    ["con hora", "2026-09-01T00:00:00.000Z"],
    ["con texto extra", "2026-09-01x"],
    ["de un día que no existe", "2026-02-30"],
    ["de un mes que no existe", "2026-13-01"],
  ])("devuelve null con una clave %s, sin consultar la base", async (_label, badKey) => {
    const { prisma } = await import("@/lib/db/prisma");
    const { getDecisionSummary } = await import("@/lib/actions/reports");

    expect(await getDecisionSummary({ rangeStartKey: badKey, rangeEndKey: "2026-09-30" })).toBeNull();
    expect(await getDecisionSummary({ rangeStartKey: "2026-09-01", rangeEndKey: badKey })).toBeNull();
    expect(prisma.property.findMany).not.toHaveBeenCalled();
  });
});
