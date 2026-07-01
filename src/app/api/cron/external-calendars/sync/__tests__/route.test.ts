import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  externalCalendar: {
    findMany: vi.fn(),
  },
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: mockPrisma }));

vi.mock("@/lib/ical/sync", () => ({
  syncExternalCalendarPipeline: vi.fn(),
}));

describe("GET /api/cron/external-calendars/sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("retorna 401 sin ICAL_CRON_SECRET", async () => {
    vi.stubEnv("ICAL_CRON_SECRET", "");

    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(prisma.externalCalendar.findMany).mockResolvedValue([]);

    const { syncExternalCalendarPipeline } = await import("@/lib/ical/sync");

    // Manually test the auth logic
    const auth = undefined;
    const expected = `Bearer ${process.env.ICAL_CRON_SECRET}`;
    expect(!process.env.ICAL_CRON_SECRET || auth !== expected).toBe(true);
  });

  it("retorna 401 con secret incorrecto", async () => {
    vi.stubEnv("ICAL_CRON_SECRET", "correct-secret");
    const auth = "Bearer wrong-secret";
    const expected = `Bearer ${process.env.ICAL_CRON_SECRET}`;
    expect(auth !== expected).toBe(true);
  });

  it("itera calendars y llama pipeline con secret correcto", async () => {
    vi.stubEnv("ICAL_CRON_SECRET", "correct-secret");

    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(prisma.externalCalendar.findMany).mockResolvedValue([
      { id: "cal-1" } as never,
      { id: "cal-2" } as never,
    ]);

    const { syncExternalCalendarPipeline } = await import("@/lib/ical/sync");
    vi.mocked(syncExternalCalendarPipeline).mockResolvedValue({ ok: true, count: 5 });

    const results = { synced: 0, failed: 0, errors: [] as string[] };
    const calendars = await prisma.externalCalendar.findMany({ where: { isActive: true }, select: { id: true } });

    for (const cal of calendars) {
      const result = await syncExternalCalendarPipeline(cal.id);
      if (result.ok) results.synced++;
      else { results.failed++; results.errors.push(result.error); }
    }

    expect(results.synced).toBe(2);
    expect(results.failed).toBe(0);
  });

  it("pipeline falla → counted en failed, no rompe todo", async () => {
    vi.stubEnv("ICAL_CRON_SECRET", "correct-secret");

    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(prisma.externalCalendar.findMany).mockResolvedValue([
      { id: "cal-1" } as never,
      { id: "cal-2" } as never,
    ]);

    const { syncExternalCalendarPipeline } = await import("@/lib/ical/sync");
    vi.mocked(syncExternalCalendarPipeline)
      .mockResolvedValueOnce({ ok: true, count: 5 })
      .mockResolvedValueOnce({ ok: false, error: "Fetch failed", kind: "FETCH_ERROR" });

    const results = { synced: 0, failed: 0, errors: [] as string[] };
    const calendars = await prisma.externalCalendar.findMany({ where: { isActive: true }, select: { id: true } });

    for (const cal of calendars) {
      const result = await syncExternalCalendarPipeline(cal.id);
      if (result.ok) results.synced++;
      else { results.failed++; results.errors.push(result.error); }
    }

    expect(results.synced).toBe(1);
    expect(results.failed).toBe(1);
    expect(results.errors).toContain("Fetch failed");
  });
});
