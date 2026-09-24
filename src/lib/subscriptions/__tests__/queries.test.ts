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
  findUnique: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    subscription: {
      findFirst: mocks.findFirst,
      findMany: mocks.findMany,
      findUnique: mocks.findUnique,
    },
    subscriptionEvent: {
      findFirst: mocks.findFirst,
      findMany: mocks.findMany,
    },
  },
}));

import {
  getActiveSubscription,
  getOwnerSubscription,
  getSubscriptionByPreapprovalId,
  getSubscriptionById,
  listSubscriptionEvents,
  findLastDowngradeSnapshot,
  hasSubscriptionEventForAuthorizedPayment,
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
// getOwnerSubscription
// ────────────────────────────────────────────────────────────────────────────

describe("getOwnerSubscription", () => {
  it("busca por userId con findUnique, sin filtrar por status", async () => {
    const fakeSub = { id: "sub-1", userId: "user-1", status: "CANCELLED" };
    mocks.findUnique.mockResolvedValue(fakeSub);

    const result = await getOwnerSubscription("user-1");

    expect(result).toBe(fakeSub);
    expect(mocks.findUnique).toHaveBeenCalledWith({
      where: { userId: "user-1" },
    });
  });

  it("devuelve la fila aunque esté EXPIRED/FAILED (a diferencia de getActiveSubscription)", async () => {
    const fakeSub = { id: "sub-1", userId: "user-1", status: "EXPIRED" };
    mocks.findUnique.mockResolvedValue(fakeSub);

    const result = await getOwnerSubscription("user-1");

    expect(result).toBe(fakeSub);
  });

  it("devuelve null si el owner nunca tuvo subscription", async () => {
    mocks.findUnique.mockResolvedValue(null);

    const result = await getOwnerSubscription("user-no-sub");

    expect(result).toBeNull();
  });

  it("usa el adapter pasado en vez de prisma global", async () => {
    const txAdapter = {
      subscription: {
        findUnique: vi.fn().mockResolvedValue({ id: "sub-tx" }),
      },
    } as any;

    const result = await getOwnerSubscription("user-1", txAdapter);

    expect(result).toEqual({ id: "sub-tx" });
    expect(txAdapter.subscription.findUnique).toHaveBeenCalled();
    expect(mocks.findUnique).not.toHaveBeenCalled();
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

// ────────────────────────────────────────────────────────────────────────────
// hasSubscriptionEventForAuthorizedPayment
// ────────────────────────────────────────────────────────────────────────────

describe("hasSubscriptionEventForAuthorizedPayment", () => {
  it("retorna true cuando existe un evento con el payloadKey y value dados", async () => {
    mocks.findFirst.mockResolvedValue({ id: "ev-1" });

    const result = await hasSubscriptionEventForAuthorizedPayment(
      "sub-1",
      "renewed",
      "mpAuthorizedPaymentId",
      "ap-123",
    );

    expect(result).toBe(true);
    expect(mocks.findFirst).toHaveBeenCalledWith({
      where: {
        subscriptionId: "sub-1",
        type: "renewed",
        payload: { path: ["mpAuthorizedPaymentId"], equals: "ap-123" },
      },
      select: { id: true },
    });
  });

  it("retorna false cuando no existe ningún evento coincidente", async () => {
    mocks.findFirst.mockResolvedValue(null);

    const result = await hasSubscriptionEventForAuthorizedPayment(
      "sub-1",
      "renewed",
      "mpAuthorizedPaymentId",
      "ap-999",
    );

    expect(result).toBe(false);
  });

  it("filtra por mpPaymentId cuando se pide para payment_failed", async () => {
    mocks.findFirst.mockResolvedValue({ id: "ev-2" });

    const result = await hasSubscriptionEventForAuthorizedPayment(
      "sub-2",
      "payment_failed",
      "mpPaymentId",
      "payment-456",
    );

    expect(result).toBe(true);
    expect(mocks.findFirst).toHaveBeenCalledWith({
      where: {
        subscriptionId: "sub-2",
        type: "payment_failed",
        payload: { path: ["mpPaymentId"], equals: "payment-456" },
      },
      select: { id: true },
    });
  });

  it("usa el adapter pasado en vez de prisma global", async () => {
    const txAdapter = {
      subscriptionEvent: {
        findFirst: vi.fn().mockResolvedValue({ id: "ev-tx" }),
      },
    } as any;

    const result = await hasSubscriptionEventForAuthorizedPayment(
      "sub-1",
      "renewed",
      "mpAuthorizedPaymentId",
      "ap-123",
      txAdapter,
    );

    expect(result).toBe(true);
    expect(txAdapter.subscriptionEvent.findFirst).toHaveBeenCalled();
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });
});
