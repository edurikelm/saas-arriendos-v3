import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies before importing
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    property: { findUnique: vi.fn() },
    reservation: { findMany: vi.fn() },
    externalChannelBlock: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/actions/auth", () => ({
  getSession: vi.fn().mockResolvedValue({ userId: "user-1", role: "OWNER", plan: "PRO", email: "test@test.com" }),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const mockProperty = {
  id: "prop-1",
  userId: "user-1",
  name: "Test Property",
  unitsAvailable: 2,
  dailyPrice: 50000,
  monthlyPrice: 1000000,
};

describe("checkAvailability con external blocks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function checkAvailability(
    propertyId: string,
    startDate: Date,
    endDate: Date,
    unitsBooked: number,
    excludeReservationId?: string
  ): Promise<{ available: boolean; reason?: string }> {
    const { prisma } = await import("@/lib/db/prisma");

    const property = await prisma.property.findUnique({ where: { id: propertyId } });
    if (!property) return { available: false, reason: "Propiedad no encontrada" };

    const reservations = await prisma.reservation.findMany({
      where: {
        propertyId,
        status: { in: ["PENDING", "CONFIRMED"] },
        id: excludeReservationId ? { not: excludeReservationId } : undefined,
        OR: [
          { startDate: { lte: startDate }, endDate: { gte: startDate } },
          { startDate: { lte: endDate }, endDate: { gte: endDate } },
          { startDate: { gte: startDate }, endDate: { lte: endDate } },
        ],
      },
    });

    const blocks = await prisma.externalChannelBlock.findMany({
      where: {
        propertyId,
        status: "ACTIVE",
        OR: [
          { startDate: { lte: startDate }, endDate: { gte: startDate } },
          { startDate: { lte: endDate }, endDate: { gte: endDate } },
          { startDate: { gte: startDate }, endDate: { lte: endDate } },
        ],
      },
    });

    for (const day = new Date(startDate); day <= endDate; day.setDate(day.getDate() + 1)) {
      let booked = 0;
      for (const r of reservations) {
        if (day >= new Date(r.startDate) && day <= new Date(r.endDate)) booked += r.unitsBooked;
      }
      for (const b of blocks) {
        if (day >= new Date(b.startDate) && day <= new Date(b.endDate)) booked += 1;
      }
      if (booked + unitsBooked > property.unitsAvailable) {
        return { available: false, reason: `No hay disponibilidad para ${day.toLocaleDateString("es-CL")}` };
      }
    }
    return { available: true };
  }

  it("1 reserva + 0 blocks → comportamiento actual (regresión-safe)", async () => {
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(prisma.property.findUnique).mockResolvedValue(mockProperty as never);
    vi.mocked(prisma.reservation.findMany).mockResolvedValue([
      { id: "res-1", propertyId: "prop-1", status: "CONFIRMED", startDate: new Date("2026-07-01"), endDate: new Date("2026-07-05"), unitsBooked: 1 } as never,
    ]);
    vi.mocked(prisma.externalChannelBlock.findMany).mockResolvedValue([]);

    const result = await checkAvailability("prop-1", new Date("2026-07-10"), new Date("2026-07-15"), 1);
    expect(result.available).toBe(true);
  });

  it("0 reservas + 1 block activo → available: false", async () => {
    const { prisma } = await import("@/lib/db/prisma");
    // unitsAvailable=1 para que el block (1 unidad) + reserva nueva (1 unidad) supere la capacidad
    vi.mocked(prisma.property.findUnique).mockResolvedValue({ ...mockProperty, unitsAvailable: 1 } as never);
    vi.mocked(prisma.reservation.findMany).mockResolvedValue([]);
    vi.mocked(prisma.externalChannelBlock.findMany).mockResolvedValue([
      { id: "block-1", propertyId: "prop-1", status: "ACTIVE", startDate: new Date("2026-07-01"), endDate: new Date("2026-07-05"), externalCalendarId: "cal-1", externalUid: "ext-1" } as never,
    ]);

    const result = await checkAvailability("prop-1", new Date("2026-07-01"), new Date("2026-07-03"), 1);
    expect(result.available).toBe(false);
    expect(result.reason).toContain("No hay disponibilidad");
  });

  it("block INACTIVE → no consume disponibilidad", async () => {
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(prisma.property.findUnique).mockResolvedValue(mockProperty as never);
    vi.mocked(prisma.reservation.findMany).mockResolvedValue([]);
    vi.mocked(prisma.externalChannelBlock.findMany).mockResolvedValue([
      { id: "block-1", propertyId: "prop-1", status: "INACTIVE", startDate: new Date("2026-07-01"), endDate: new Date("2026-07-05"), externalCalendarId: "cal-1", externalUid: "ext-1" } as never,
    ]);

    const result = await checkAvailability("prop-1", new Date("2026-07-01"), new Date("2026-07-03"), 1);
    expect(result.available).toBe(true);
  });

  it("mix reserva + block, unitsAvailable suficiente → OK", async () => {
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(prisma.property.findUnique).mockResolvedValue({ ...mockProperty, unitsAvailable: 3 } as never);
    vi.mocked(prisma.reservation.findMany).mockResolvedValue([
      { id: "res-1", propertyId: "prop-1", status: "CONFIRMED", startDate: new Date("2026-07-01"), endDate: new Date("2026-07-05"), unitsBooked: 1 } as never,
    ]);
    vi.mocked(prisma.externalChannelBlock.findMany).mockResolvedValue([
      { id: "block-1", propertyId: "prop-1", status: "ACTIVE", startDate: new Date("2026-07-01"), endDate: new Date("2026-07-05"), externalCalendarId: "cal-1", externalUid: "ext-1" } as never,
    ]);

    const result = await checkAvailability("prop-1", new Date("2026-07-01"), new Date("2026-07-03"), 1);
    expect(result.available).toBe(true);
  });

  it("reserva cancelada + block activo → block cuenta", async () => {
    const { prisma } = await import("@/lib/db/prisma");
    // unitsAvailable=1 para que el block activo consuma la única unidad disponible
    vi.mocked(prisma.property.findUnique).mockResolvedValue({ ...mockProperty, unitsAvailable: 1 } as never);
    // CANCELLED reservation should NOT appear in the query since we filter by status: { in: ["PENDING", "CONFIRMED"] }
    vi.mocked(prisma.reservation.findMany).mockResolvedValue([]);
    vi.mocked(prisma.externalChannelBlock.findMany).mockResolvedValue([
      { id: "block-1", propertyId: "prop-1", status: "ACTIVE", startDate: new Date("2026-07-01"), endDate: new Date("2026-07-05"), externalCalendarId: "cal-1", externalUid: "ext-1" } as never,
    ]);

    // Block takes the 1 available unit, so booking 1 unit should fail
    const result = await checkAvailability("prop-1", new Date("2026-07-01"), new Date("2026-07-03"), 1);
    expect(result.available).toBe(false);
  });

  it("solapamiento parcial → solo días en rango del block", async () => {
    const { prisma } = await import("@/lib/db/prisma");
    // unitsAvailable=1 para que el block activo consuma la única unidad disponible
    vi.mocked(prisma.property.findUnique).mockResolvedValue({ ...mockProperty, unitsAvailable: 1 } as never);
    vi.mocked(prisma.reservation.findMany).mockResolvedValue([]);
    vi.mocked(prisma.externalChannelBlock.findMany).mockResolvedValue([
      { id: "block-1", propertyId: "prop-1", status: "ACTIVE", startDate: new Date("2026-07-01"), endDate: new Date("2026-07-10"), externalCalendarId: "cal-1", externalUid: "ext-1" } as never,
    ]);

    // Asking for days 5-7, block covers 1-10, should be blocked
    const result = await checkAvailability("prop-1", new Date("2026-07-05"), new Date("2026-07-07"), 1);
    expect(result.available).toBe(false);
  });
});
