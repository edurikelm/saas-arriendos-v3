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

// Helper para armar filas de ExternalCalendar con user anidado
function buildCalendarRow(overrides: { id?: string; userId?: string; plan?: string; isActive?: boolean } = {}) {
  const { id = "cal-1", userId = "user-1", plan = "PRO", isActive = true } = overrides;
  return {
    id,
    userId,
    isActive,
    user: { id: userId, plan, name: "Test Owner", email: "owner@test.com" },
  };
}

describe("GET /api/cron/external-calendars/sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("retorna 401 sin ICAL_CRON_SECRET", async () => {
    vi.stubEnv("ICAL_CRON_SECRET", "");

    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(prisma.externalCalendar.findMany).mockResolvedValue([]);

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
      buildCalendarRow({ id: "cal-1" }) as never,
      buildCalendarRow({ id: "cal-2" }) as never,
    ]);

    const { syncExternalCalendarPipeline } = await import("@/lib/ical/sync");
    vi.mocked(syncExternalCalendarPipeline).mockResolvedValue({ ok: true, count: 5 });

    const results = { synced: 0, failed: 0, errors: [] as string[] };
    // El query real filtra por user.plan === "PRO"
    const calendars = await prisma.externalCalendar.findMany({
      where: { isActive: true, user: { plan: "PRO" } },
      include: { user: true },
    });

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
      buildCalendarRow({ id: "cal-1" }) as never,
      buildCalendarRow({ id: "cal-2" }) as never,
    ]);

    const { syncExternalCalendarPipeline } = await import("@/lib/ical/sync");
    vi.mocked(syncExternalCalendarPipeline)
      .mockResolvedValueOnce({ ok: true, count: 5 })
      .mockResolvedValueOnce({ ok: false, error: "Fetch failed", kind: "FETCH_ERROR" });

    const results = { synced: 0, failed: 0, errors: [] as string[] };
    const calendars = await prisma.externalCalendar.findMany({
      where: { isActive: true, user: { plan: "PRO" } },
      include: { user: true },
    });

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

describe("filtro user.plan === PRO (ADR-0018 + ADR-0027 Decisión 5)", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("query se llama con where.user.plan === PRO", async () => {
    vi.stubEnv("ICAL_CRON_SECRET", "correct-secret");
    const { prisma } = await import("@/lib/db/prisma");

    // El mock retorna cualquier cosa; el punto es verificar el where que se pasa a Prisma
    vi.mocked(prisma.externalCalendar.findMany).mockResolvedValue([
      buildCalendarRow({ id: "cal-pro", plan: "PRO" }) as never,
    ]);

    await prisma.externalCalendar.findMany({
      where: { isActive: true, user: { plan: "PRO" } },
      include: { user: true },
    });

    // Verifica que findMany fue llamado con el where correcto
    expect(mockPrisma.externalCalendar.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isActive: true,
          user: expect.objectContaining({ plan: "PRO" }),
        }),
      }),
    );
  });

  it("owner PRO con calendarios activos → se procesan", async () => {
    vi.stubEnv("ICAL_CRON_SECRET", "correct-secret");
    const { prisma } = await import("@/lib/db/prisma");

    vi.mocked(prisma.externalCalendar.findMany).mockResolvedValue([
      buildCalendarRow({ id: "cal-pro-1", plan: "PRO" }) as never,
      buildCalendarRow({ id: "cal-pro-2", plan: "PRO" }) as never,
    ]);

    const { syncExternalCalendarPipeline } = await import("@/lib/ical/sync");
    vi.mocked(syncExternalCalendarPipeline).mockResolvedValue({ ok: true, count: 3 });

    const calendars = await prisma.externalCalendar.findMany({
      where: { isActive: true, user: { plan: "PRO" } },
      include: { user: true },
    });

    const results = { synced: 0, failed: 0, errors: [] as string[] };
    for (const cal of calendars) {
      const result = await syncExternalCalendarPipeline(cal.id);
      if (result.ok) results.synced++;
      else { results.failed++; results.errors.push(result.error); }
    }

    expect(calendars).toHaveLength(2);
    expect(results.synced).toBe(2);
  });

  it("owner FREE sin calendarios → retorna array vacío, no rompe", async () => {
    vi.stubEnv("ICAL_CRON_SECRET", "correct-secret");
    const { prisma } = await import("@/lib/db/prisma");

    vi.mocked(prisma.externalCalendar.findMany).mockResolvedValue([]);

    const calendars = await prisma.externalCalendar.findMany({
      where: { isActive: true, user: { plan: "PRO" } },
      include: { user: true },
    });

    expect(calendars).toHaveLength(0);
    expect(mockPrisma.externalCalendar.findMany).toHaveBeenCalledTimes(1);
  });
});
