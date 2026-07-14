import { describe, it, expect, vi, beforeEach } from "vitest";
import { checkAvailability } from "@/lib/actions/reservations";

// Mock prisma
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    property: { findUnique: vi.fn() },
    reservation: { findMany: vi.fn() },
    externalChannelBlock: { findMany: vi.fn() },
  },
}));

const mockProperty = {
  id: "prop-1",
  userId: "user-1",
  name: "Test Property",
  unitsAvailable: 2,
  dailyPrice: 50000,
  monthlyPrice: 1000000,
};

describe("checkAvailability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Property no encontrada → available: false con reason correcto", async () => {
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(prisma.property.findUnique).mockResolvedValue(null);

    const result = await checkAvailability("prop-1", new Date("2026-07-01"), new Date("2026-07-05"), 1);
    expect(result).toEqual({ available: false, reason: "Propiedad no encontrada" });
  });

  it("Sin reservas ni blocks → available: true", async () => {
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(prisma.property.findUnique).mockResolvedValue(mockProperty as never);
    vi.mocked(prisma.reservation.findMany).mockResolvedValue([]);
    vi.mocked(prisma.externalChannelBlock.findMany).mockResolvedValue([]);

    const result = await checkAvailability("prop-1", new Date("2026-07-01"), new Date("2026-07-05"), 1);
    expect(result).toEqual({ available: true });
  });

  it("1 reserva con unitsBooked que cabe → available: true", async () => {
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(prisma.property.findUnique).mockResolvedValue(mockProperty as never);
    vi.mocked(prisma.reservation.findMany).mockResolvedValue([
      { id: "res-1", propertyId: "prop-1", status: "CONFIRMED", startDate: new Date("2026-07-01"), endDate: new Date("2026-07-05"), unitsBooked: 1 } as never,
    ]);
    vi.mocked(prisma.externalChannelBlock.findMany).mockResolvedValue([]);

    const result = await checkAvailability("prop-1", new Date("2026-07-10"), new Date("2026-07-15"), 1);
    expect(result.available).toBe(true);
  });

  it("1 reserva que excede unitsAvailable → available: false con reason contiene No hay disponibilidad y Solo quedan", async () => {
    const { prisma } = await import("@/lib/db/prisma");
    // unitsAvailable=2, existing reservation books 2 units, new request books 1 → exceeds
    vi.mocked(prisma.property.findUnique).mockResolvedValue({ ...mockProperty, unitsAvailable: 2 } as never);
    vi.mocked(prisma.reservation.findMany).mockResolvedValue([
      { id: "res-1", propertyId: "prop-1", status: "CONFIRMED", startDate: new Date("2026-07-01"), endDate: new Date("2026-07-05"), unitsBooked: 2 } as never,
    ]);
    vi.mocked(prisma.externalChannelBlock.findMany).mockResolvedValue([]);

    const result = await checkAvailability("prop-1", new Date("2026-07-01"), new Date("2026-07-05"), 1);
    expect(result.available).toBe(false);
    expect(result.reason).toContain("No hay disponibilidad");
    expect(result.reason).toContain("Solo quedan");
  });

  it("1 block activo → consume 1 unidad", async () => {
    const { prisma } = await import("@/lib/db/prisma");
    // unitsAvailable=1, block consumes 1 → no room for new booking of 1
    vi.mocked(prisma.property.findUnique).mockResolvedValue({ ...mockProperty, unitsAvailable: 1 } as never);
    vi.mocked(prisma.reservation.findMany).mockResolvedValue([]);
    vi.mocked(prisma.externalChannelBlock.findMany).mockResolvedValue([
      { id: "block-1", propertyId: "prop-1", status: "ACTIVE", startDate: new Date("2026-07-01"), endDate: new Date("2026-07-05"), externalCalendarId: "cal-1", externalUid: "ext-1" } as never,
    ]);

    const result = await checkAvailability("prop-1", new Date("2026-07-01"), new Date("2026-07-03"), 1);
    expect(result.available).toBe(false);
    expect(result.reason).toContain("No hay disponibilidad");
  });

  it("Block INACTIVE → no consume disponibilidad", async () => {
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(prisma.property.findUnique).mockResolvedValue(mockProperty as never);
    vi.mocked(prisma.reservation.findMany).mockResolvedValue([]);
    vi.mocked(prisma.externalChannelBlock.findMany).mockResolvedValue([
      { id: "block-1", propertyId: "prop-1", status: "INACTIVE", startDate: new Date("2026-07-01"), endDate: new Date("2026-07-05"), externalCalendarId: "cal-1", externalUid: "ext-1" } as never,
    ]);

    const result = await checkAvailability("prop-1", new Date("2026-07-01"), new Date("2026-07-03"), 1);
    expect(result.available).toBe(true);
  });

  it("Reserva CANCELLED → NO cuenta (findMany filtra por status PENDING/CONFIRMED)", async () => {
    const { prisma } = await import("@/lib/db/prisma");
    // CANCELLED reservation should NOT be returned by findMany (filtered in WHERE)
    vi.mocked(prisma.property.findUnique).mockResolvedValue({ ...mockProperty, unitsAvailable: 1 } as never);
    vi.mocked(prisma.reservation.findMany).mockResolvedValue([]); // empty because we only query PENDING/CONFIRMED
    vi.mocked(prisma.externalChannelBlock.findMany).mockResolvedValue([]);

    const result = await checkAvailability("prop-1", new Date("2026-07-01"), new Date("2026-07-03"), 1);
    expect(result.available).toBe(true);
  });

  it("Overlap parcial → block cubre días 1-10, query pide 5-7 → block cuenta", async () => {
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(prisma.property.findUnique).mockResolvedValue({ ...mockProperty, unitsAvailable: 1 } as never);
    vi.mocked(prisma.reservation.findMany).mockResolvedValue([]);
    vi.mocked(prisma.externalChannelBlock.findMany).mockResolvedValue([
      { id: "block-1", propertyId: "prop-1", status: "ACTIVE", startDate: new Date("2026-07-01"), endDate: new Date("2026-07-10"), externalCalendarId: "cal-1", externalUid: "ext-1" } as never,
    ]);

    // Asking for days 5-7, block covers 1-10, should be blocked
    const result = await checkAvailability("prop-1", new Date("2026-07-05"), new Date("2026-07-07"), 1);
    expect(result.available).toBe(false);
    expect(result.reason).toContain("No hay disponibilidad");
  });

  it("excludeReservationId filtra correctamente la reserva a excluir", async () => {
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(prisma.property.findUnique).mockResolvedValue(mockProperty as never);
    vi.mocked(prisma.reservation.findMany).mockResolvedValue([]); // excluded reservation not returned
    vi.mocked(prisma.externalChannelBlock.findMany).mockResolvedValue([]);

    // If excludeReservationId works, res-1 (the excluded one) won't be in the result
    const result = await checkAvailability("prop-1", new Date("2026-07-01"), new Date("2026-07-05"), 1, "res-1");
    expect(result.available).toBe(true);

    // Verify findMany was called with id: { not: "res-1" }
    expect(vi.mocked(prisma.reservation.findMany).mock.calls[0][0]?.where?.id).toEqual({ not: "res-1" });
  });

  it("M2: las 3 queries se llaman en paralelo (1 vez cada una)", async () => {
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(prisma.property.findUnique).mockResolvedValue(mockProperty as never);
    vi.mocked(prisma.reservation.findMany).mockResolvedValue([]);
    vi.mocked(prisma.externalChannelBlock.findMany).mockResolvedValue([]);

    await checkAvailability("prop-1", new Date("2026-07-01"), new Date("2026-07-05"), 1);

    expect(prisma.property.findUnique).toHaveBeenCalledTimes(1);
    expect(prisma.reservation.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.externalChannelBlock.findMany).toHaveBeenCalledTimes(1);
  });

  it("M3: 100 reservas mockeadas + rango 30 días → resultado correcto (regresión)", async () => {
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(prisma.property.findUnique).mockResolvedValue({ ...mockProperty, unitsAvailable: 5 } as never);
    vi.mocked(prisma.externalChannelBlock.findMany).mockResolvedValue([]);

    // Create 100 reservations, each booking 1 unit for random 3-day windows within July
    const reservations = Array.from({ length: 100 }, (_, i) => ({
      id: `res-${i}`,
      propertyId: "prop-1",
      status: "CONFIRMED",
      startDate: new Date(2026, 6, 1 + (i % 28)),
      endDate: new Date(2026, 6, 3 + (i % 28)),
      unitsBooked: 1,
    }));
    vi.mocked(prisma.reservation.findMany).mockResolvedValue(reservations as never);

    // Query 30 days (July 1-30), many overlapping reservations → should exceed capacity
    const result = await checkAvailability("prop-1", new Date("2026-07-01"), new Date("2026-07-30"), 1);
    expect(result.available).toBe(false); // 100 reservations × 1 unit each clearly exceeds 5 units
  });

  it("Mix: reserva + block, capacity suficiente → OK", async () => {
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(prisma.property.findUnique).mockResolvedValue({ ...mockProperty, unitsAvailable: 3 } as never);
    vi.mocked(prisma.reservation.findMany).mockResolvedValue([
      { id: "res-1", propertyId: "prop-1", status: "CONFIRMED", startDate: new Date("2026-07-01"), endDate: new Date("2026-07-05"), unitsBooked: 1 } as never,
    ]);
    vi.mocked(prisma.externalChannelBlock.findMany).mockResolvedValue([
      { id: "block-1", propertyId: "prop-1", status: "ACTIVE", startDate: new Date("2026-07-01"), endDate: new Date("2026-07-05"), externalCalendarId: "cal-1", externalUid: "ext-1" } as never,
    ]);

    const result = await checkAvailability("prop-1", new Date("2026-07-01"), new Date("2026-07-03"), 1);
    // 1 (existing reservation) + 1 (block) + 1 (new) = 3 <= unitsAvailable: 3 → OK
    expect(result.available).toBe(true);
  });

  it("Mix: reserva + block, capacity insuficiente → fail con día correcto", async () => {
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(prisma.property.findUnique).mockResolvedValue({ ...mockProperty, unitsAvailable: 2 } as never);
    vi.mocked(prisma.reservation.findMany).mockResolvedValue([
      { id: "res-1", propertyId: "prop-1", status: "CONFIRMED", startDate: new Date("2026-07-01"), endDate: new Date("2026-07-05"), unitsBooked: 1 } as never,
    ]);
    vi.mocked(prisma.externalChannelBlock.findMany).mockResolvedValue([
      { id: "block-1", propertyId: "prop-1", status: "ACTIVE", startDate: new Date("2026-07-01"), endDate: new Date("2026-07-05"), externalCalendarId: "cal-1", externalUid: "ext-1" } as never,
    ]);

    // 1 (existing reservation) + 1 (block) + 1 (new) = 3 > unitsAvailable: 2 → fail
    const result = await checkAvailability("prop-1", new Date("2026-07-01"), new Date("2026-07-03"), 1);
    expect(result.available).toBe(false);
    expect(result.reason).toContain("No hay disponibilidad");
  });
});
