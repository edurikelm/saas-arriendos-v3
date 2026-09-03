import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  subscription: {
    findMany: vi.fn(),
  },
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: mockPrisma }));

const mockApplySubscriptionEvent = vi.fn();
vi.mock("@/lib/subscriptions/lifecycle", () => ({
  applySubscriptionEvent: mockApplySubscriptionEvent,
}));

const mockRevalidateAfterPlanChange = vi.fn();
vi.mock("@/lib/subscriptions/revalidate-plan", () => ({
  revalidateAfterPlanChange: mockRevalidateAfterPlanChange,
}));

function buildSubRow(overrides: { id?: string; status?: string; currentPeriodEnd?: Date } = {}) {
  const now = new Date();
  const {
    id = "sub-1",
    status = "AUTHORIZED",
    currentPeriodEnd = new Date(now.getTime() - 86400000), // yesterday
  } = overrides;
  return { id, status, currentPeriodEnd };
}

async function getHandler() {
  const mod = await import("../route");
  return mod.GET;
}

async function callRoute(auth: string | null) {
  const GET = await getHandler();
  const req = new Request(
    "http://localhost/api/cron/subscriptions/expired-check",
    { method: "GET", headers: auth ? { authorization: auth } : {} },
  );
  return GET(req);
}

describe("auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("retorna 401 sin SUBSCRIPTIONS_CRON_SECRET configurado", async () => {
    vi.stubEnv("SUBSCRIPTIONS_CRON_SECRET", "");
    mockPrisma.subscription.findMany.mockResolvedValue([]);
    const res = await callRoute(null);
    expect(res.status).toBe(401);
  });

  it("retorna 401 sin header authorization", async () => {
    vi.stubEnv("SUBSCRIPTIONS_CRON_SECRET", "correct-secret");
    mockPrisma.subscription.findMany.mockResolvedValue([]);
    const res = await callRoute(null);
    expect(res.status).toBe(401);
  });

  it("retorna 401 con secret incorrecto", async () => {
    vi.stubEnv("SUBSCRIPTIONS_CRON_SECRET", "correct-secret");
    mockPrisma.subscription.findMany.mockResolvedValue([]);
    const res = await callRoute("Bearer wrong-secret");
    expect(res.status).toBe(401);
  });

  it("retorna 200 con secret correcto", async () => {
    vi.stubEnv("SUBSCRIPTIONS_CRON_SECRET", "correct-secret");
    mockPrisma.subscription.findMany.mockResolvedValue([]);
    const res = await callRoute("Bearer correct-secret");
    expect(res.status).toBe(200);
  });
});

describe("happy path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("subscription AUTHORIZED con currentPeriodEnd < now → llama applySubscriptionEvent(expired_check)", async () => {
    vi.stubEnv("SUBSCRIPTIONS_CRON_SECRET", "correct-secret");
    mockPrisma.subscription.findMany.mockResolvedValue([
      buildSubRow({ id: "sub-auth-1", status: "AUTHORIZED" }) as never,
    ]);
    mockApplySubscriptionEvent.mockResolvedValue({ subscription: {} } as never);

    const res = await callRoute("Bearer correct-secret");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.processed).toBe(1);
    expect(body.byStatus.AUTHORIZED).toBe(1);
    expect(mockApplySubscriptionEvent).toHaveBeenCalledTimes(1);
    expect(mockApplySubscriptionEvent).toHaveBeenCalledWith({
      type: "expired_check",
      subscriptionId: "sub-auth-1",
      payload: { source: "cron", previousStatus: "AUTHORIZED" },
    });
  });

  it("subscription CANCELLED con currentPeriodEnd < now → procesa correctamente", async () => {
    vi.stubEnv("SUBSCRIPTIONS_CRON_SECRET", "correct-secret");
    mockPrisma.subscription.findMany.mockResolvedValue([
      buildSubRow({ id: "sub-cancelled-1", status: "CANCELLED" }) as never,
    ]);
    mockApplySubscriptionEvent.mockResolvedValue({ subscription: {} } as never);

    const res = await callRoute("Bearer correct-secret");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.processed).toBe(1);
    expect(body.byStatus.CANCELLED).toBe(1);
    expect(mockApplySubscriptionEvent).toHaveBeenCalledWith({
      type: "expired_check",
      subscriptionId: "sub-cancelled-1",
      payload: { source: "cron", previousStatus: "CANCELLED" },
    });
  });
});

describe("idempotencia", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("segunda corrida no procesa las ya EXPIRED porque el findMany las excluye por status", async () => {
    vi.stubEnv("SUBSCRIPTIONS_CRON_SECRET", "correct-secret");
    // Primera corrida: la subscription está AUTHORIZED → se procesa
    mockPrisma.subscription.findMany
      .mockResolvedValueOnce([
        buildSubRow({ id: "sub-1", status: "AUTHORIZED" }) as never,
      ])
      // Segunda corrida: la misma subscription ya está EXPIRED → NO aparece en candidates
      .mockResolvedValueOnce([]);
    mockApplySubscriptionEvent.mockResolvedValue({ subscription: {} } as never);

    const res1 = await callRoute("Bearer correct-secret");
    expect((await res1.json()).processed).toBe(1);

    const res2 = await callRoute("Bearer correct-secret");
    expect((await res2.json()).processed).toBe(0);
    // Solo se llamó 1 vez (la segunda vez no hay candidates que procesar)
    expect(mockApplySubscriptionEvent).toHaveBeenCalledTimes(1);
  });
});

describe("failure isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("si una subscription falla, las demás siguen procesándose", async () => {
    vi.stubEnv("SUBSCRIPTIONS_CRON_SECRET", "correct-secret");
    mockPrisma.subscription.findMany.mockResolvedValue([
      buildSubRow({ id: "sub-1", status: "AUTHORIZED" }) as never,
      buildSubRow({ id: "sub-2", status: "AUTHORIZED" }) as never,
      buildSubRow({ id: "sub-3", status: "CANCELLED" }) as never,
    ]);
    // sub-1 succeeds, sub-2 fails, sub-3 succeeds
    mockApplySubscriptionEvent
      .mockResolvedValueOnce({ subscription: {} } as never)
      .mockRejectedValueOnce(new Error("DB constraint violation"))
      .mockResolvedValueOnce({ subscription: {} } as never);

    const res = await callRoute("Bearer correct-secret");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.processed).toBe(2);
    expect(body.errors).toHaveLength(1);
    expect(body.errors[0]).toContain("sub-2");
  });
});

describe("edge cases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("lista vacía de candidates → retorna processed: 0, errors: []", async () => {
    vi.stubEnv("SUBSCRIPTIONS_CRON_SECRET", "correct-secret");
    mockPrisma.subscription.findMany.mockResolvedValue([]);

    const res = await callRoute("Bearer correct-secret");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.processed).toBe(0);
    expect(body.errors).toEqual([]);
    expect(mockApplySubscriptionEvent).not.toHaveBeenCalled();
  });
});

// El cron es el unico camino de downgrade que corre sin que el owner haga
// nada, asi que si no invalida la cache el sidebar puede quedar mostrando PRO
// indefinidamente — hasta que el owner haga una recarga completa por casualidad.
describe("invalidacion de cache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.stubEnv("SUBSCRIPTIONS_CRON_SECRET", "correct-secret");
  });

  it("con downgrades en el batch: revalida UNA vez, no una por candidato", async () => {
    mockPrisma.subscription.findMany.mockResolvedValue([
      buildSubRow({ id: "sub-1", status: "AUTHORIZED" }) as never,
      buildSubRow({ id: "sub-2", status: "CANCELLED" }) as never,
    ]);
    mockApplySubscriptionEvent.mockResolvedValue({
      subscription: {},
      planChange: { from: "PRO", to: "FREE", source: "subscription_lifecycle" },
    } as never);

    const res = await callRoute("Bearer correct-secret");

    expect(res.status).toBe(200);
    expect(mockApplySubscriptionEvent).toHaveBeenCalledTimes(2);
    expect(mockRevalidateAfterPlanChange).toHaveBeenCalledTimes(1);
  });

  it("sin cambios de plan en el batch: no revalida", async () => {
    mockPrisma.subscription.findMany.mockResolvedValue([
      buildSubRow({ id: "sub-1", status: "AUTHORIZED" }) as never,
    ]);
    // La subscription cambia de status pero el plan ya estaba en FREE.
    mockApplySubscriptionEvent.mockResolvedValue({
      subscription: {},
      planChange: { from: "FREE", to: "FREE", source: "subscription_lifecycle" },
    } as never);

    await callRoute("Bearer correct-secret");

    expect(mockRevalidateAfterPlanChange).not.toHaveBeenCalled();
  });
});
