import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildExportEvents } from "../export";

const mockPrisma = vi.hoisted(() => ({
  reservation: {
    findMany: vi.fn(),
  },
  externalChannelBlock: {
    findMany: vi.fn(),
  },
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: mockPrisma }));

const mockReservations = [
  { id: "res-1", startDate: new Date("2026-07-15"), endDate: new Date("2026-07-18"), bookingAirbnb: false },
  { id: "res-2", startDate: new Date("2026-08-01"), endDate: new Date("2026-08-05"), bookingAirbnb: true },
];

const mockBlocksAllChannels = [
  { id: "block-1", startDate: new Date("2026-07-20"), endDate: new Date("2026-07-22"), summary: "Airbnb Block" },
  { id: "block-2", startDate: new Date("2026-08-10"), endDate: new Date("2026-08-12"), summary: "Booking Block" },
  { id: "block-3", startDate: new Date("2026-08-15"), endDate: new Date("2026-08-17"), summary: "VRBO Block" },
  { id: "block-4", startDate: new Date("2026-08-20"), endDate: new Date("2026-08-22"), summary: "Other Block" },
];

const mockBlocksNoAirbnb = mockBlocksAllChannels.filter(b => b.id !== "block-1");

describe("buildExportEvents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.reservation.findMany.mockResolvedValue(mockReservations);
    mockPrisma.externalChannelBlock.findMany.mockResolvedValue(mockBlocksAllChannels);
  });

  it("incluye todas las reservas siempre (domain-level)", async () => {
    const events = await buildExportEvents("prop-1", "AIRBNB");
    const reservationEvents = events.filter((e) => e.uid.startsWith("res-"));
    expect(reservationEvents).toHaveLength(2);
  });

  it("anti-eco: export AIRBNB excluye blocks Airbnb", async () => {
    mockPrisma.externalChannelBlock.findMany.mockResolvedValue(mockBlocksNoAirbnb);
    const events = await buildExportEvents("prop-1", "AIRBNB");
    const blockEvents = events.filter((e) => e.uid.startsWith("block-"));
    // block-1 (Airbnb) should be excluded
    expect(blockEvents.some((e) => e.uid === "block-block-1")).toBe(false);
    // Others should be included
    expect(blockEvents.some((e) => e.uid === "block-block-2")).toBe(true);
    expect(blockEvents.some((e) => e.uid === "block-block-3")).toBe(true);
    expect(blockEvents.some((e) => e.uid === "block-block-4")).toBe(true);
  });

  it("anti-eco: export BOOKING_COM excluye Booking", async () => {
    mockPrisma.externalChannelBlock.findMany.mockResolvedValue(mockBlocksAllChannels.filter(b => b.id !== "block-2"));
    const events = await buildExportEvents("prop-1", "BOOKING_COM");
    const blockEvents = events.filter((e) => e.uid.startsWith("block-"));
    expect(blockEvents.some((e) => e.uid === "block-block-2")).toBe(false);
    expect(blockEvents.some((e) => e.uid === "block-block-1")).toBe(true);
  });

  it("respetas ventanas de tiempo personalizadas", async () => {
    const windowStart = new Date("2026-08-01");
    const windowEnd = new Date("2026-08-31");
    await buildExportEvents("prop-1", "AIRBNB", windowStart, windowEnd);
    expect(mockPrisma.reservation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ endDate: { gte: windowStart }, startDate: { lte: windowEnd } }) })
    );
  });

  it("solo incluye reservas con status activos", async () => {
    await buildExportEvents("prop-1", "AIRBNB");
    expect(mockPrisma.reservation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: { in: ["PENDING", "CONFIRMED", "COMPLETED"] } }) })
    );
  });

  it("solo incluye blocks activos", async () => {
    await buildExportEvents("prop-1", "AIRBNB");
    expect(mockPrisma.externalChannelBlock.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: "ACTIVE" }) })
    );
  });

  it("summary de reserva es 'Reservado'", async () => {
    const events = await buildExportEvents("prop-1", "AIRBNB");
    const reservationEvents = events.filter((e) => e.uid.startsWith("res-"));
    reservationEvents.forEach((e) => { expect(e.summary).toBe("Reservado"); });
  });

  it("summary de block usa summary del bloque o 'Bloqueado'", async () => {
    mockPrisma.externalChannelBlock.findMany.mockResolvedValue([
      { id: "block-1", startDate: new Date("2026-07-20"), endDate: new Date("2026-07-22"), summary: "Airbnb Block" },
      { id: "block-no-summary", startDate: new Date("2026-09-01"), endDate: new Date("2026-09-03"), summary: null },
    ]);
    const events = await buildExportEvents("prop-1", "BOOKING_COM");
    const airbnbBlock = events.find((e) => e.uid === "block-block-1");
    expect(airbnbBlock?.summary).toBe("Airbnb Block");
    const noSummaryBlock = events.find((e) => e.uid === "block-block-no-summary");
    expect(noSummaryBlock?.summary).toBe("Bloqueado");
  });
});

describe("anti-eco matrix", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.reservation.findMany.mockResolvedValue([]);
  });

  it("export AIRBNB excluye blocks Airbnb", async () => {
    mockPrisma.externalChannelBlock.findMany.mockResolvedValue(mockBlocksNoAirbnb);
    const events = await buildExportEvents("prop-1", "AIRBNB");
    const blockUids = events.filter((e) => e.uid.startsWith("block-")).map((e) => e.uid);
    expect(blockUids).not.toContain("block-block-1");
    expect(blockUids).toContain("block-block-2");
    expect(blockUids).toContain("block-block-3");
    expect(blockUids).toContain("block-block-4");
  });

  it("export BOOKING_COM excluye blocks Booking", async () => {
    mockPrisma.externalChannelBlock.findMany.mockResolvedValue(mockBlocksAllChannels.filter(b => b.id !== "block-2"));
    const events = await buildExportEvents("prop-1", "BOOKING_COM");
    const blockUids = events.filter((e) => e.uid.startsWith("block-")).map((e) => e.uid);
    expect(blockUids).not.toContain("block-block-2");
    expect(blockUids).toContain("block-block-1");
  });

  it("export VRBO excluye blocks VRBO", async () => {
    mockPrisma.externalChannelBlock.findMany.mockResolvedValue(mockBlocksAllChannels.filter(b => b.id !== "block-3"));
    const events = await buildExportEvents("prop-1", "VRBO");
    const blockUids = events.filter((e) => e.uid.startsWith("block-")).map((e) => e.uid);
    expect(blockUids).not.toContain("block-block-3");
  });

  it("export OTHER excluye blocks Other", async () => {
    mockPrisma.externalChannelBlock.findMany.mockResolvedValue(mockBlocksAllChannels.filter(b => b.id !== "block-4"));
    const events = await buildExportEvents("prop-1", "OTHER");
    const blockUids = events.filter((e) => e.uid.startsWith("block-")).map((e) => e.uid);
    expect(blockUids).not.toContain("block-block-4");
  });
});
