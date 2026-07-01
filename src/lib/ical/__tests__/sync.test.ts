import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  externalCalendar: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  externalChannelBlock: {
    findMany: vi.fn(),
    count: vi.fn(),
    upsert: vi.fn(),
    updateMany: vi.fn(),
  },
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: mockPrisma }));

const FIXTURE_ICAL = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:block-1@example.com
DTSTART:20260715
DTEND:20260718
SUMMARY:Bloqueo 1
END:VEVENT
BEGIN:VEVENT
UID:block-2@example.com
DTSTART:20260720
DTEND:20260725
SUMMARY:Bloqueo 2
END:VEVENT
END:VCALENDAR`;

const mockCalendar = {
  id: "cal-1",
  userId: "user-1",
  propertyId: "prop-1",
  channel: "AIRBNB" as const,
  name: "Test Calendar",
  feedUrl: "https://example.com/ical",
  isActive: true,
  lastSyncedAt: null,
  lastSyncError: null,
  lastSyncCount: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("syncExternalCalendarPipeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("retorna NOT_FOUND cuando el calendario no existe", async () => {
    mockPrisma.externalCalendar.findUnique.mockResolvedValue(null);

    const { syncExternalCalendarPipeline } = await import("../sync");
    const result = await syncExternalCalendarPipeline("nonexistent");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.kind).toBe("NOT_FOUND");
    }
  });

  it("retorna NOT_FOUND cuando el calendario no está activo", async () => {
    mockPrisma.externalCalendar.findUnique.mockResolvedValue({
      ...mockCalendar,
      isActive: false,
    });

    const { syncExternalCalendarPipeline } = await import("../sync");
    const result = await syncExternalCalendarPipeline("cal-1");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.kind).toBe("NOT_FOUND");
    }
  });

  it("upsert nuevo UID crea block ACTIVE", async () => {
    mockPrisma.externalCalendar.findUnique.mockResolvedValue(mockCalendar);
    mockPrisma.externalChannelBlock.findMany.mockResolvedValue([]);
    mockPrisma.externalChannelBlock.count.mockResolvedValue(2);
    mockPrisma.externalChannelBlock.upsert.mockImplementation(async ({ create }: { create: unknown }) => create as ReturnType<typeof mockPrisma.externalChannelBlock.upsert>);

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Map([["content-type", "text/calendar"]]),
      text: () => Promise.resolve(FIXTURE_ICAL),
    });
    vi.stubGlobal("fetch", mockFetch);

    const { syncExternalCalendarPipeline } = await import("../sync");
    const result = await syncExternalCalendarPipeline("cal-1");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.count).toBe(2);
    }
    expect(mockPrisma.externalChannelBlock.upsert).toHaveBeenCalledTimes(2);
  });

  it("UID que desaparece del feed → INACTIVE", async () => {
    mockPrisma.externalCalendar.findUnique.mockResolvedValue(mockCalendar);
    mockPrisma.externalChannelBlock.findMany.mockResolvedValue([
      { externalUid: "block-1@example.com" },
      { externalUid: "old-block@example.com" },
    ]);
    mockPrisma.externalChannelBlock.count.mockResolvedValue(1);
    mockPrisma.externalChannelBlock.updateMany.mockResolvedValue({ count: 1 } as never);

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Map([["content-type", "text/calendar"]]),
      text: () => Promise.resolve(FIXTURE_ICAL),
    });
    vi.stubGlobal("fetch", mockFetch);

    const { syncExternalCalendarPipeline } = await import("../sync");
    const result = await syncExternalCalendarPipeline("cal-1");

    expect(result.ok).toBe(true);
    expect(mockPrisma.externalChannelBlock.updateMany).toHaveBeenCalledWith({
      where: {
        externalCalendarId: "cal-1",
        externalUid: "old-block@example.com",
        status: "ACTIVE",
      },
      data: { status: "INACTIVE" },
    });
  });

  it("sync falla → lastSyncError populated, lastSyncedAt previo se conserva", async () => {
    const previousSync = new Date("2026-01-01T10:00:00Z");
    mockPrisma.externalCalendar.findUnique.mockResolvedValue({
      ...mockCalendar,
      lastSyncedAt: previousSync,
    });

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));

    const { syncExternalCalendarPipeline } = await import("../sync");
    const result = await syncExternalCalendarPipeline("cal-1");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.kind).toBe("FETCH_ERROR");
    }
    expect(mockPrisma.externalCalendar.update).toHaveBeenCalledWith({
      where: { id: "cal-1" },
      data: { lastSyncError: "Network error" },
    });
  });

  it("ventana filtra eventos", async () => {
    const futureIcal = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:future@example.com
DTSTART:20300115
DTEND:20300118
SUMMARY:Futuro
END:VEVENT
END:VCALENDAR`;

    const now = new Date("2026-01-01");
    const { parseIcal } = await import("../parser");
    const parseResult = parseIcal(futureIcal, { now });

    expect(parseResult.ok).toBe(true);
    if (parseResult.ok) {
      expect(parseResult.events).toHaveLength(0);
    }
  });
});
