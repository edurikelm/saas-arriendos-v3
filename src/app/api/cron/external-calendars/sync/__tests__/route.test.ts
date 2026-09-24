import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  externalCalendar: {
    findMany: vi.fn(),
  },
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: mockPrisma }));

const mockSyncExternalCalendarPipeline = vi.hoisted(() => vi.fn());
vi.mock("@/lib/ical/sync", () => ({
  syncExternalCalendarPipeline: mockSyncExternalCalendarPipeline,
}));

const DAY_MS = 24 * 60 * 60 * 1000;
const future = new Date(Date.now() + 90 * DAY_MS);
const past = new Date(Date.now() - 90 * DAY_MS);

type SubscriptionRow = {
  status: string;
  currentPeriodEnd: Date | null;
  mpPreapprovalId: string | null;
} | null;

// Helper para armar filas de ExternalCalendar con el owner anidado tal como
// lo selecciona el route real (planOverride + subscription, no la columna
// UserProfile.plan — ADR-0034).
function buildCalendarRow(overrides: {
  id?: string;
  userId?: string;
  planOverride?: string | null;
  subscription?: SubscriptionRow;
  isActive?: boolean;
} = {}) {
  const {
    id = "cal-1",
    userId = "user-1",
    planOverride = null,
    subscription = null,
    isActive = true,
  } = overrides;
  return {
    id,
    userId,
    isActive,
    user: { planOverride, subscription },
  };
}

async function getHandler() {
  const mod = await import("../route");
  return mod.POST;
}

async function callRoute(auth: string | null) {
  const POST = await getHandler();
  const req = new Request("http://localhost/api/cron/external-calendars/sync", {
    method: "POST",
    headers: auth ? { authorization: auth } : {},
  });
  return POST(req);
}

describe("POST /api/cron/external-calendars/sync — auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("retorna 401 sin ICAL_CRON_SECRET configurado", async () => {
    vi.stubEnv("ICAL_CRON_SECRET", "");
    mockPrisma.externalCalendar.findMany.mockResolvedValue([]);

    const res = await callRoute(null);
    expect(res.status).toBe(401);
  });

  it("retorna 401 con secret incorrecto", async () => {
    vi.stubEnv("ICAL_CRON_SECRET", "correct-secret");
    mockPrisma.externalCalendar.findMany.mockResolvedValue([]);

    const res = await callRoute("Bearer wrong-secret");
    expect(res.status).toBe(401);
  });
});

describe("POST /api/cron/external-calendars/sync — where shape (ADR-0034)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("selecciona isActive + planOverride/subscription, no la columna user.plan", async () => {
    vi.stubEnv("ICAL_CRON_SECRET", "correct-secret");
    mockPrisma.externalCalendar.findMany.mockResolvedValue([]);

    await callRoute("Bearer correct-secret");

    expect(mockPrisma.externalCalendar.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isActive: true },
        include: {
          user: {
            select: {
              planOverride: true,
              subscription: {
                select: { status: true, currentPeriodEnd: true, mpPreapprovalId: true },
              },
            },
          },
        },
      }),
    );

    // El where NO filtra por la columna denormalizada `plan` en Prisma —
    // el filtro de plan efectivo pasa a hacerse en memoria.
    const call = mockPrisma.externalCalendar.findMany.mock.calls[0][0];
    expect(call.where).not.toHaveProperty("user");
  });
});

describe("POST /api/cron/external-calendars/sync — filtro por plan efectivo (#188)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("planOverride PRO sin subscription → sincroniza (caso #188)", async () => {
    vi.stubEnv("ICAL_CRON_SECRET", "correct-secret");
    mockPrisma.externalCalendar.findMany.mockResolvedValue([
      buildCalendarRow({ id: "cal-1", planOverride: "PRO", subscription: null }),
    ]);
    mockSyncExternalCalendarPipeline.mockResolvedValue({ ok: true, count: 1 });

    const res = await callRoute("Bearer correct-secret");
    const body = await res.json();

    expect(mockSyncExternalCalendarPipeline).toHaveBeenCalledWith("cal-1");
    expect(body.synced).toBe(1);
    expect(body.skippedFree).toBe(0);
  });

  it("AUTHORIZED con currentPeriodEnd futuro → sincroniza", async () => {
    vi.stubEnv("ICAL_CRON_SECRET", "correct-secret");
    mockPrisma.externalCalendar.findMany.mockResolvedValue([
      buildCalendarRow({
        id: "cal-1",
        subscription: { status: "AUTHORIZED", currentPeriodEnd: future, mpPreapprovalId: "preapproval-1" },
      }),
    ]);
    mockSyncExternalCalendarPipeline.mockResolvedValue({ ok: true, count: 1 });

    const res = await callRoute("Bearer correct-secret");
    const body = await res.json();

    expect(mockSyncExternalCalendarPipeline).toHaveBeenCalledWith("cal-1");
    expect(body.synced).toBe(1);
    expect(body.skippedFree).toBe(0);
  });

  it("AUTHORIZED con currentPeriodEnd pasado → NO sincroniza", async () => {
    vi.stubEnv("ICAL_CRON_SECRET", "correct-secret");
    mockPrisma.externalCalendar.findMany.mockResolvedValue([
      buildCalendarRow({
        id: "cal-1",
        subscription: { status: "AUTHORIZED", currentPeriodEnd: past, mpPreapprovalId: "preapproval-1" },
      }),
    ]);

    const res = await callRoute("Bearer correct-secret");
    const body = await res.json();

    expect(mockSyncExternalCalendarPipeline).not.toHaveBeenCalled();
    expect(body.synced).toBe(0);
    expect(body.skippedFree).toBe(1);
  });

  it("CANCELLED con período todavía vigente → sincroniza", async () => {
    vi.stubEnv("ICAL_CRON_SECRET", "correct-secret");
    mockPrisma.externalCalendar.findMany.mockResolvedValue([
      buildCalendarRow({
        id: "cal-1",
        subscription: { status: "CANCELLED", currentPeriodEnd: future, mpPreapprovalId: "preapproval-1" },
      }),
    ]);
    mockSyncExternalCalendarPipeline.mockResolvedValue({ ok: true, count: 1 });

    const res = await callRoute("Bearer correct-secret");
    const body = await res.json();

    expect(mockSyncExternalCalendarPipeline).toHaveBeenCalledWith("cal-1");
    expect(body.synced).toBe(1);
  });

  it("sin subscription y sin override → NO sincroniza", async () => {
    vi.stubEnv("ICAL_CRON_SECRET", "correct-secret");
    mockPrisma.externalCalendar.findMany.mockResolvedValue([
      buildCalendarRow({ id: "cal-1", planOverride: null, subscription: null }),
    ]);

    const res = await callRoute("Bearer correct-secret");
    const body = await res.json();

    expect(mockSyncExternalCalendarPipeline).not.toHaveBeenCalled();
    expect(body.synced).toBe(0);
    expect(body.skippedFree).toBe(1);
  });

  it("mezcla de owners → solo los efectivamente PRO llegan al pipeline", async () => {
    vi.stubEnv("ICAL_CRON_SECRET", "correct-secret");
    mockPrisma.externalCalendar.findMany.mockResolvedValue([
      buildCalendarRow({ id: "cal-override-pro", planOverride: "PRO", subscription: null }),
      buildCalendarRow({
        id: "cal-auth-future",
        subscription: { status: "AUTHORIZED", currentPeriodEnd: future, mpPreapprovalId: "p-1" },
      }),
      buildCalendarRow({
        id: "cal-auth-past",
        subscription: { status: "AUTHORIZED", currentPeriodEnd: past, mpPreapprovalId: "p-2" },
      }),
      buildCalendarRow({
        id: "cal-cancelled-vigente",
        subscription: { status: "CANCELLED", currentPeriodEnd: future, mpPreapprovalId: "p-3" },
      }),
      buildCalendarRow({ id: "cal-sin-plan", planOverride: null, subscription: null }),
    ]);
    mockSyncExternalCalendarPipeline.mockResolvedValue({ ok: true, count: 1 });

    const res = await callRoute("Bearer correct-secret");
    const body = await res.json();

    expect(mockSyncExternalCalendarPipeline).toHaveBeenCalledTimes(3);
    expect(mockSyncExternalCalendarPipeline).toHaveBeenCalledWith("cal-override-pro");
    expect(mockSyncExternalCalendarPipeline).toHaveBeenCalledWith("cal-auth-future");
    expect(mockSyncExternalCalendarPipeline).toHaveBeenCalledWith("cal-cancelled-vigente");
    expect(mockSyncExternalCalendarPipeline).not.toHaveBeenCalledWith("cal-auth-past");
    expect(mockSyncExternalCalendarPipeline).not.toHaveBeenCalledWith("cal-sin-plan");
    expect(body.synced).toBe(3);
    expect(body.skippedFree).toBe(2);
  });
});

describe("POST /api/cron/external-calendars/sync — pipeline falla", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("pipeline falla en un calendario → cuenta en failed, no rompe el resto", async () => {
    vi.stubEnv("ICAL_CRON_SECRET", "correct-secret");
    mockPrisma.externalCalendar.findMany.mockResolvedValue([
      buildCalendarRow({ id: "cal-1", planOverride: "PRO" }),
      buildCalendarRow({ id: "cal-2", planOverride: "PRO" }),
    ]);
    mockSyncExternalCalendarPipeline
      .mockResolvedValueOnce({ ok: true, count: 5 })
      .mockResolvedValueOnce({ ok: false, error: "Fetch failed", kind: "FETCH_ERROR" });

    const res = await callRoute("Bearer correct-secret");
    const body = await res.json();

    expect(body.synced).toBe(1);
    expect(body.failed).toBe(1);
    expect(body.errors).toContain("Fetch failed");
  });
});
