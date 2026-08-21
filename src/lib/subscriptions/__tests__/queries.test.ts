import { describe, it, expect, vi, beforeEach } from "vitest";
import type { DowngradeSnapshot } from "../queries";

/**
 * Mock del adapter de Prisma. Cada test setea solo los métodos que el helper
 * bajo test invocará. Helpers de queries.ts aceptan cualquier adapter con la
 * misma shape (default `prisma` o `Prisma.TransactionClient`).
 *
 * vi.mock se eleva al top del archivo, por lo que los mocks también deben
 * elevarse vía `vi.hoisted` para estar disponibles en la factory.
 */
const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  findMany: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    subscription: {
      findFirst: mocks.findFirst,
      findMany: mocks.findMany,
    },
    subscriptionEvent: {
      findFirst: mocks.findFirst,
      findMany: mocks.findMany,
    },
  },
}));

import {
  getActiveSubscription,
  getSubscriptionByPreapprovalId,
  getSubscriptionById,
  listSubscriptionEvents,
  findLastDowngradeSnapshot,
} from "../queries";

beforeEach(() => {
  vi.clearAllMocks();
});

// ────────────────────────────────────────────────────────────────────────────
// getActiveSubscription
// ────────────────────────────────────────────────────────────────────────────

describe("getActiveSubscription", () => {
  it("busca por userId con status IN (PENDING, AUTHORIZED, PAUSED)", async () => {
    const fakeSub = { id: "sub-1", userId: "user-1", status: "AUTHORIZED" };
    mocks.findFirst.mockResolvedValue(fakeSub);

    const result = await getActiveSubscription("user-1");

    expect(result).toBe(fakeSub);
    expect(mocks.findFirst).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        status: { in: ["PENDING", "AUTHORIZED", "PAUSED"] },
      },
    });
  });

  it("devuelve null si no hay suscripción activa", async () => {
    mocks.findFirst.mockResolvedValue(null);

    const result = await getActiveSubscription("user-no-sub");

    expect(result).toBeNull();
  });

  it("usa el adapter pasado en vez de prisma global", async () => {
    mocks.findFirst.mockResolvedValue({ id: "sub-tx" });
    const txAdapter = {
      subscription: {
        findFirst: vi.fn().mockResolvedValue({ id: "sub-tx" }),
        findMany: mocks.findMany,
      },
    } as any;

    const result = await getActiveSubscription("user-1", txAdapter);

    expect(result).toEqual({ id: "sub-tx" });
    expect(txAdapter.subscription.findFirst).toHaveBeenCalled();
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// getSubscriptionByPreapprovalId
// ────────────────────────────────────────────────────────────────────────────

describe("getSubscriptionByPreapprovalId", () => {
  it("busca por mpPreapprovalId", async () => {
    const fakeSub = { id: "sub-1", mpPreapprovalId: "mp-preapproval-123" };
    mocks.findFirst.mockResolvedValue(fakeSub);

    const result = await getSubscriptionByPreapprovalId("mp-preapproval-123");

    expect(result).toBe(fakeSub);
    expect(mocks.findFirst).toHaveBeenCalledWith({
      where: { mpPreapprovalId: "mp-preapproval-123" },
    });
  });

  it("devuelve null si no encuentra", async () => {
    mocks.findFirst.mockResolvedValue(null);

    const result = await getSubscriptionByPreapprovalId("mp-not-found");

    expect(result).toBeNull();
  });

  it("usa el adapter pasado en vez de prisma global", async () => {
    mocks.findFirst.mockResolvedValue({ id: "sub-tx" });
    const txAdapter = {
      subscription: {
        findFirst: vi.fn().mockResolvedValue({ id: "sub-tx" }),
        findMany: mocks.findMany,
      },
    } as any;

    const result = await getSubscriptionByPreapprovalId("mp-preapproval-tx", txAdapter);

    expect(result).toEqual({ id: "sub-tx" });
    expect(txAdapter.subscription.findFirst).toHaveBeenCalled();
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// getSubscriptionById
// ────────────────────────────────────────────────────────────────────────────

describe("getSubscriptionById", () => {
  it("busca por id", async () => {
    const fakeSub = { id: "sub-123", status: "AUTHORIZED" };
    mocks.findFirst.mockResolvedValue(fakeSub);

    const result = await getSubscriptionById("sub-123");

    expect(result).toBe(fakeSub);
    expect(mocks.findFirst).toHaveBeenCalledWith({
      where: { id: "sub-123" },
    });
  });

  it("devuelve null si no encuentra", async () => {
    mocks.findFirst.mockResolvedValue(null);

    const result = await getSubscriptionById("sub-not-found");

    expect(result).toBeNull();
  });

  it("usa el adapter pasado en vez de prisma global", async () => {
    mocks.findFirst.mockResolvedValue({ id: "sub-tx" });
    const txAdapter = {
      subscription: {
        findFirst: vi.fn().mockResolvedValue({ id: "sub-tx" }),
        findMany: mocks.findMany,
      },
    } as any;

    const result = await getSubscriptionById("sub-1", txAdapter);

    expect(result).toEqual({ id: "sub-tx" });
    expect(txAdapter.subscription.findFirst).toHaveBeenCalled();
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// listSubscriptionEvents
// ────────────────────────────────────────────────────────────────────────────

describe("listSubscriptionEvents", () => {
  it("busca por subscriptionId y ordena por createdAt desc con limit", async () => {
    const fakeEvents = [
      { id: "ev-2", type: "authorized" },
      { id: "ev-1", type: "created" },
    ];
    mocks.findMany.mockResolvedValue(fakeEvents);

    const result = await listSubscriptionEvents("sub-1", 10);

    expect(result).toBe(fakeEvents);
    expect(mocks.findMany).toHaveBeenCalledWith({
      where: { subscriptionId: "sub-1" },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
  });

  it("usa limit por defecto de 50", async () => {
    mocks.findMany.mockResolvedValue([]);

    await listSubscriptionEvents("sub-1");

    expect(mocks.findMany).toHaveBeenCalledWith({
      where: { subscriptionId: "sub-1" },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  });

  it("devuelve array vacío si no hay eventos", async () => {
    mocks.findMany.mockResolvedValue([]);

    const result = await listSubscriptionEvents("sub-no-events");

    expect(result).toEqual([]);
  });

  it("usa el adapter pasado en vez de prisma global", async () => {
    mocks.findMany.mockResolvedValue([{ id: "ev-tx" }]);
    const txAdapter = {
      subscriptionEvent: {
        findMany: vi.fn().mockResolvedValue([{ id: "ev-tx" }]),
      },
    } as any;

    const result = await listSubscriptionEvents("sub-1", 5, txAdapter);

    expect(result).toEqual([{ id: "ev-tx" }]);
    expect(txAdapter.subscriptionEvent.findMany).toHaveBeenCalled();
    expect(mocks.findMany).not.toHaveBeenCalled();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Adapter pattern — los helpers aceptan un adapter custom
// ────────────────────────────────────────────────────────────────────────────

describe("adapter pattern", () => {
  it("getActiveSubscription usa adapter en vez de prisma global", async () => {
    mocks.findFirst.mockResolvedValue({ id: "sub-global" });
    const txAdapter = {
      subscription: {
        findFirst: vi.fn().mockResolvedValue({ id: "sub-tx" }),
        findMany: mocks.findMany,
      },
    } as any;

    const result = await getActiveSubscription("user-1", txAdapter);

    expect(result).toEqual({ id: "sub-tx" });
    expect(txAdapter.subscription.findFirst).toHaveBeenCalled();
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// findLastDowngradeSnapshot
// ────────────────────────────────────────────────────────────────────────────

describe("findLastDowngradeSnapshot", () => {
  // Tier 1 #5: retorna snapshot del último expired/expired_check
  it("retorna snapshot del último evento expired", async () => {
    const snapshot: DowngradeSnapshot = {
      externalCalendarIds: ["cal-1"],
      externalBlockIds: ["block-1"],
    };
    mocks.findFirst.mockResolvedValue({
      payload: { downgradeSnapshot: snapshot },
    });

    const result = await findLastDowngradeSnapshot("user-1");

    expect(result).toEqual(snapshot);
    expect(mocks.findFirst).toHaveBeenCalledWith({
      where: {
        type: { in: ["expired", "expired_check"] },
        payload: { not: expect.anything() },
        subscription: { userId: "user-1" },
      },
      orderBy: { createdAt: "desc" },
      select: { payload: true },
    });
  });

  // Tier 1 #6: retorna null si nunca hubo downgrade para el user
  it("retorna null si no hay eventos expired/expired_check", async () => {
    mocks.findFirst.mockResolvedValue(null);

    const result = await findLastDowngradeSnapshot("user-no-downgrade");

    expect(result).toBeNull();
  });

  // Tier 1 #7: filtra por subscription.userId (no por subscriptionId directa)
  it("usa join subscription.userId en el where", async () => {
    mocks.findFirst.mockResolvedValue(null);

    await findLastDowngradeSnapshot("user-1");

    expect(mocks.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        subscription: { userId: "user-1" },
      }),
      orderBy: { createdAt: "desc" },
      select: { payload: true },
    });
  });

  // Tier 1 #9: multi-cycle — retorna el más reciente
  it("multi-cycle: retorna el evento más reciente cuando hay varios expired", async () => {
    const recentSnapshot: DowngradeSnapshot = {
      externalCalendarIds: ["cal-recent"],
      externalBlockIds: ["block-recent"],
    };
    mocks.findFirst
      .mockResolvedValueOnce({
        // Primer llamado: evento más reciente
        payload: { downgradeSnapshot: recentSnapshot },
      });

    const result = await findLastDowngradeSnapshot("user-1");

    expect(result).toEqual(recentSnapshot);
    // orderBy createdAt desc + limit 1 → siempre el más reciente
    expect(mocks.findFirst).toHaveBeenCalledWith({
      where: {
        type: { in: ["expired", "expired_check"] },
        payload: { not: expect.anything() },
        subscription: { userId: "user-1" },
      },
      orderBy: { createdAt: "desc" },
      select: { payload: true },
    });
  });

  // Retorna null si el payload existe pero no tiene downgradeSnapshot
  it("retorna null si el payload no contiene downgradeSnapshot (evento legacy)", async () => {
    mocks.findFirst.mockResolvedValue({
      payload: { someOtherField: "value" },
    });

    const result = await findLastDowngradeSnapshot("user-1");

    expect(result).toBeNull();
  });

  // Retorna null si payload es JsonNull
  it("retorna null si payload es Prisma.JsonNull", async () => {
    mocks.findFirst.mockResolvedValue({
      payload: null,
    });

    const result = await findLastDowngradeSnapshot("user-1");

    expect(result).toBeNull();
  });

  // Usa el adapter pasado en vez de prisma global
  it("usa el adapter pasado en vez de prisma global", async () => {
    const txAdapter = {
      subscriptionEvent: {
        findFirst: vi.fn().mockResolvedValue({
          payload: { downgradeSnapshot: { externalCalendarIds: [], externalBlockIds: [] } },
        }),
      },
    } as any;

    const result = await findLastDowngradeSnapshot("user-1", txAdapter);

    expect(result).toEqual({ externalCalendarIds: [], externalBlockIds: [] });
    expect(txAdapter.subscriptionEvent.findFirst).toHaveBeenCalled();
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });
});
