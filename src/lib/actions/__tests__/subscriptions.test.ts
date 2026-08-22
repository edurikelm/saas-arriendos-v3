/**
 * Tests para server actions de subscriptions.
 *
 * Patrón: vi.hoisted + vi.mock para Prisma, session, gateway y next/cache.
 * Usa el mismo pattern que src/lib/actions/__tests__/payments.test.ts.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SessionUser } from "@/lib/auth/session";

// ────────────────────────────────────────────────────────────────────────────
// Mock helpers
// ────────────────────────────────────────────────────────────────────────────

// ────────────────────────────────────────────────────────────────────────────
// vi.hoisted — mocks elevados para estar disponibles en factories
// ────────────────────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  // Prisma
  subscriptionFindUnique: vi.fn(),
  subscriptionFindFirst: vi.fn(),
  subscriptionCreate: vi.fn(),
  subscriptionUpdate: vi.fn(),
  subscriptionDelete: vi.fn(),
  subscriptionEventCreate: vi.fn(),
  subscriptionEventFindFirst: vi.fn(),
  subscriptionEventDeleteMany: vi.fn(),
  propertyCount: vi.fn(),
  reservationClientCount: vi.fn(),
  userProfileFindUnique: vi.fn(),
  userProfileUpdate: vi.fn(),
  adminActionLogCreate: vi.fn(),
  // $transaction: ejecuta el callback pasando un tx que comparte los mismos mocks
  $transaction: vi.fn(async (cb) =>
    cb({
      subscription: {
        findUnique: mocks.subscriptionFindUnique,
        findFirst: mocks.subscriptionFindFirst,
        create: mocks.subscriptionCreate,
        update: mocks.subscriptionUpdate,
        delete: mocks.subscriptionDelete,
      },
      subscriptionEvent: {
        create: mocks.subscriptionEventCreate,
        findFirst: mocks.subscriptionEventFindFirst,
        deleteMany: mocks.subscriptionEventDeleteMany,
      },
      userProfile: {
        findUnique: mocks.userProfileFindUnique,
        update: mocks.userProfileUpdate,
      },
      adminActionLog: { create: mocks.adminActionLogCreate },
    }),
  ),
  // Session
  requireOwner: vi.fn(),
  // Gateway
  ensurePlan: vi.fn(),
  createPreapproval: vi.fn(),
  cancelPreapproval: vi.fn(),
  // next/cache
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    subscription: {
      findUnique: mocks.subscriptionFindUnique,
      findFirst: mocks.subscriptionFindFirst,
      create: mocks.subscriptionCreate,
      update: mocks.subscriptionUpdate,
      delete: mocks.subscriptionDelete,
    },
    subscriptionEvent: {
      create: mocks.subscriptionEventCreate,
      findFirst: mocks.subscriptionEventFindFirst,
      deleteMany: mocks.subscriptionEventDeleteMany,
    },
    userProfile: {
      findUnique: mocks.userProfileFindUnique,
      update: mocks.userProfileUpdate,
    },
    property: { count: mocks.propertyCount },
    reservationClient: { count: mocks.reservationClientCount },
    adminActionLog: { create: mocks.adminActionLogCreate },
    $transaction: mocks.$transaction,
  },
}));

vi.mock("@/lib/payment/pro-gateway", () => ({
  getProGateway: vi.fn(() => ({
    ensurePlan: mocks.ensurePlan,
    createPreapproval: mocks.createPreapproval,
    cancelPreapproval: mocks.cancelPreapproval,
  })),
}));

vi.mock("@/lib/auth/guards", () => ({
  requireOwner: mocks.requireOwner,
}));

vi.mock("@/lib/payment/pro-gateway", () => ({
  getProGateway: vi.fn(() => ({
    ensurePlan: mocks.ensurePlan,
    createPreapproval: mocks.createPreapproval,
  })),
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

// ────────────────────────────────────────────────────────────────────────────
// Types / helpers
// ────────────────────────────────────────────────────────────────────────────

type MockSub = {
  id: string;
  userId: string;
  plan: "PRO";
  status: "PENDING" | "AUTHORIZED" | "PAUSED" | "CANCELLED" | "EXPIRED" | "FAILED";
  mpPreapprovalId: string | null;
  mpPlanId: string | null;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  nextPaymentDate: Date | null;
  amount: number;
  currency: string;
  frequency: number;
  frequencyType: string;
  startedAt: Date;
  cancelledAt: Date | null;
  cancellationReason: string | null;
  createdAt: Date;
  updatedAt: Date;
};

const mockSub = (overrides: Partial<MockSub> = {}): MockSub =>
  ({
    id: "sub-1",
    userId: "user-1",
    plan: "PRO",
    status: "PENDING",
    mpPreapprovalId: null,
    mpPlanId: null,
    currentPeriodStart: null,
    currentPeriodEnd: null,
    nextPaymentDate: null,
    amount: 9990,
    currency: "CLP",
    frequency: 1,
    frequencyType: "months",
    startedAt: new Date(),
    cancelledAt: null,
    cancellationReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as MockSub);

const mockSession: SessionUser = {
  userId: "user-1",
  role: "OWNER",
  plan: "FREE",
  email: "owner@test.com",
};

// ────────────────────────────────────────────────────────────────────────────
// Imports — después de los mocks
// ────────────────────────────────────────────────────────────────────────────

import {
  startProUpgrade,
  cancelMySubscription,
  reactivateMySubscription,
  countOwnerUsage,
} from "../subscriptions";

// ────────────────────────────────────────────────────────────────────────────
// Setup
// ────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.resetAllMocks();
  mocks.requireOwner.mockResolvedValue(mockSession);
});

// ────────────────────────────────────────────────────────────────────────────
// startProUpgrade
// ────────────────────────────────────────────────────────────────────────────

describe("startProUpgrade", () => {
  it("cuando user no tiene subscription: llama gateway, crea subscription, retorna initPoint", async () => {
    mocks.subscriptionFindFirst.mockResolvedValue(null); // no hay active sub
    mocks.subscriptionCreate.mockResolvedValue(mockSub({ id: "sub-new", status: "PENDING" }));
    mocks.subscriptionEventCreate.mockResolvedValue({});
    mocks.ensurePlan.mockResolvedValue({ planId: "plan-123" });
    mocks.createPreapproval.mockResolvedValue({
      preapprovalId: "preapproval-123",
      initPoint: "https://mercadopago.com/init",
    });
    mocks.subscriptionUpdate.mockResolvedValue(mockSub({ id: "sub-new", mpPreapprovalId: "preapproval-123" }));

    const result = await startProUpgrade();

    expect(result.initPoint).toBe("https://mercadopago.com/init");
    expect(result.subscriptionId).toBe("sub-new");
    expect(mocks.ensurePlan).toHaveBeenCalled();
    expect(mocks.createPreapproval).toHaveBeenCalledWith({
      userId: "user-1",
      payerEmail: "owner@test.com",
      planId: "plan-123",
    });
    expect(mocks.subscriptionCreate).toHaveBeenCalled();
    expect(mocks.subscriptionUpdate).toHaveBeenCalledWith({
      where: { id: "sub-new" },
      data: expect.objectContaining({
        mpPreapprovalId: "preapproval-123",
        mpPlanId: "plan-123",
      }),
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/settings/billing");
  });

  it("cuando user ya tiene subscription AUTHORIZED: throw", async () => {
    mocks.subscriptionFindFirst.mockResolvedValue(mockSub({ status: "AUTHORIZED" }));

    await expect(startProUpgrade()).rejects.toThrow("Ya tienes PRO activo");
  });

  it("cuando user tiene CANCELLED no expirada: throw con fecha", async () => {
    const futureDate = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);
    mocks.subscriptionFindFirst.mockResolvedValue(
      mockSub({ status: "CANCELLED", currentPeriodEnd: futureDate }),
    );

    await expect(startProUpgrade()).rejects.toThrow(/sigue activa hasta/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// startProUpgrade — replace EXPIRED/FAILED
// ─────────────────────────────────────────────────────────────────────────────

describe("startProUpgrade — replace EXPIRED/FAILED", () => {
  // Helper para setup base de upgrade exitoso
  // Usa mockReturnValueOnce en vez de mockResolvedValue para evitar
  // contaminación entre tests (vi.clearAllMocks no limpia valores de retorno).
  const setupUpgradeSuccess = (existingSub: Partial<MockSub> = {}) => {
    const newSub = mockSub({ id: "sub-new", status: "PENDING" });
    mocks.subscriptionFindUnique.mockResolvedValueOnce(mockSub(existingSub));
    mocks.subscriptionEventDeleteMany.mockResolvedValueOnce({ count: 2 });
    mocks.subscriptionDelete.mockResolvedValueOnce(mockSub(existingSub));
    mocks.subscriptionCreate.mockResolvedValueOnce(newSub);
    mocks.subscriptionEventCreate.mockResolvedValueOnce({});
    mocks.ensurePlan.mockResolvedValueOnce({ planId: "plan-123" });
    mocks.createPreapproval.mockResolvedValueOnce({
      preapprovalId: "preapproval-123",
      initPoint: "https://mercadopago.com/init",
    });
    mocks.subscriptionUpdate.mockResolvedValueOnce(newSub);
    mocks.adminActionLogCreate.mockResolvedValueOnce({});
    return newSub;
  };

  it("EXPIRED → upgrade succeeds: delete events + delete old sub + create new PENDING", async () => {
    setupUpgradeSuccess({ id: "sub-old", status: "EXPIRED" });

    const result = await startProUpgrade();

    expect(result.subscriptionId).toBe("sub-new");
    // FK RESTRICT → primero se borran los eventos
    expect(mocks.subscriptionEventDeleteMany).toHaveBeenCalledWith({
      where: { subscriptionId: "sub-old" },
    });
    // Luego se borra la fila vieja
    expect(mocks.subscriptionDelete).toHaveBeenCalledWith({
      where: { id: "sub-old" },
    });
    // Nueva subscription creada
    expect(mocks.subscriptionCreate).toHaveBeenCalled();
    // AdminActionLog registrado
    expect(mocks.adminActionLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        adminId: "user-1",
        targetId: "user-1",
        action: "SUBSCRIPTION_REPLACED",
        details: expect.stringContaining("sub-old"),
      }),
    });
  });

  it("FAILED → upgrade succeeds: same as EXPIRED", async () => {
    setupUpgradeSuccess({ id: "sub-old", status: "FAILED" });

    const result = await startProUpgrade();

    expect(result.subscriptionId).toBe("sub-new");
    expect(mocks.subscriptionEventDeleteMany).toHaveBeenCalledWith({
      where: { subscriptionId: "sub-old" },
    });
    expect(mocks.subscriptionDelete).toHaveBeenCalledWith({
      where: { id: "sub-old" },
    });
  });

  it("AUTHORIZED → upgrade attempt blocks (regression)", async () => {
    mocks.subscriptionFindFirst.mockResolvedValue(
      mockSub({ status: "AUTHORIZED" }),
    );

    await expect(startProUpgrade()).rejects.toThrow("Ya tienes PRO activo");
    expect(mocks.subscriptionEventDeleteMany).not.toHaveBeenCalled();
    expect(mocks.subscriptionDelete).not.toHaveBeenCalled();
    expect(mocks.subscriptionCreate).not.toHaveBeenCalled();
  });

  it("PAUSED → upgrade attempt blocks (regression)", async () => {
    mocks.subscriptionFindFirst.mockResolvedValue(
      mockSub({ status: "PAUSED" }),
    );

    await expect(startProUpgrade()).rejects.toThrow("Ya tienes PRO activo");
    expect(mocks.subscriptionEventDeleteMany).not.toHaveBeenCalled();
    expect(mocks.subscriptionDelete).not.toHaveBeenCalled();
    expect(mocks.subscriptionCreate).not.toHaveBeenCalled();
  });

  it("CANCELLED-vigente → upgrade attempt blocks (regression)", async () => {
    const futureDate = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);
    mocks.subscriptionFindFirst.mockResolvedValue(
      mockSub({ status: "CANCELLED", currentPeriodEnd: futureDate }),
    );

    await expect(startProUpgrade()).rejects.toThrow(/sigue activa hasta/);
    expect(mocks.subscriptionEventDeleteMany).not.toHaveBeenCalled();
    expect(mocks.subscriptionDelete).not.toHaveBeenCalled();
    expect(mocks.subscriptionCreate).not.toHaveBeenCalled();
  });

  it("FREE puro → upgrade succeeds (regression)", async () => {
    // No existe subscription para el user
    mocks.subscriptionFindFirst.mockResolvedValue(null);
    mocks.subscriptionFindUnique.mockResolvedValue(null);
    mocks.subscriptionEventDeleteMany.mockResolvedValue({ count: 0 });
    mocks.subscriptionDelete.mockResolvedValue(null);
    mocks.subscriptionCreate.mockResolvedValue(mockSub({ id: "sub-new", status: "PENDING" }));
    mocks.subscriptionEventCreate.mockResolvedValue({});
    mocks.ensurePlan.mockResolvedValue({ planId: "plan-123" });
    mocks.createPreapproval.mockResolvedValue({
      preapprovalId: "preapproval-123",
      initPoint: "https://mercadopago.com/init",
    });
    mocks.subscriptionUpdate.mockResolvedValue(
      mockSub({ id: "sub-new", mpPreapprovalId: "preapproval-123" }),
    );
    // AdminActionLog NO debe llamarse cuando no hay reemplazo
    mocks.adminActionLogCreate.mockResolvedValue({});

    const result = await startProUpgrade();

    expect(result.subscriptionId).toBe("sub-new");
    expect(mocks.subscriptionEventDeleteMany).not.toHaveBeenCalled();
    expect(mocks.subscriptionDelete).not.toHaveBeenCalled();
    expect(mocks.adminActionLogCreate).not.toHaveBeenCalled();
  });

  it("Atomicidad: si applySubscriptionEvent falla, la subscription vieja sigue existiendo (rollback)", async () => {
    const oldSub = mockSub({ id: "sub-old", status: "EXPIRED" });
    mocks.subscriptionFindUnique.mockResolvedValue(oldSub);
    mocks.subscriptionEventDeleteMany.mockResolvedValue({ count: 2 });
    mocks.subscriptionDelete.mockResolvedValue(oldSub);
    // applySubscriptionEvent dentro de tx rechaza
    mocks.subscriptionCreate.mockRejectedValue(new Error("Unique constraint violation"));

    await expect(startProUpgrade()).rejects.toThrow("Unique constraint violation");
    // El delete de la vieja NO persistó porque estaba dentro del tx que abortó
    // ( mocks.subscriptionDelete fue llamado pero el tx hizo rollback )
    expect(mocks.subscriptionEventDeleteMany).toHaveBeenCalled();
    expect(mocks.subscriptionDelete).toHaveBeenCalled();
  });

  it("AdminActionLog SUBSCRIPTION_REPLACED contiene replacedSubscriptionId + newSubscriptionId en JSON", async () => {
    setupUpgradeSuccess({ id: "sub-old", status: "EXPIRED" });

    await startProUpgrade();

    expect(mocks.adminActionLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        adminId: "user-1",
        targetId: "user-1",
        action: "SUBSCRIPTION_REPLACED",
        details: expect.stringContaining("sub-old"),
      }),
    });
    const details = JSON.parse(
      mocks.adminActionLogCreate.mock.calls[0][0].data.details,
    );
    expect(details.replacedSubscriptionId).toBe("sub-old");
    expect(details.newSubscriptionId).toBe("sub-new");
    expect(details.reason).toBe("owner_reactivate_from_expired_or_failed");
  });

  it("Doble-click concurrente: re-check dentro de tx evita delete si la fila ya no existe", async () => {
    // Primer llamada: la fila existe → se borra
    // Segundo llamada (simulada): la fila ya no existe → re-check la encuentra null → skip delete
    const newSub = mockSub({ id: "sub-new", status: "PENDING" });

    // subscriptionFindUnique retorna null en la re-check dentro de tx
    // (la fila fue borrada por la primera llamada en el mismo test)
    mocks.subscriptionFindUnique
      .mockResolvedValueOnce(null) // pre-check (getCurrentSubscription) → no hay sub activa
      .mockResolvedValueOnce(null); // re-check dentro de tx → la fila ya no existe
    mocks.subscriptionEventDeleteMany.mockResolvedValue({ count: 0 });
    mocks.subscriptionDelete.mockResolvedValue(null);
    mocks.subscriptionCreate.mockResolvedValue(newSub);
    mocks.subscriptionEventCreate.mockResolvedValue({});
    mocks.ensurePlan.mockResolvedValue({ planId: "plan-123" });
    mocks.createPreapproval.mockResolvedValue({
      preapprovalId: "preapproval-123",
      initPoint: "https://mercadopago.com/init",
    });
    mocks.subscriptionUpdate.mockResolvedValue(newSub);

    const result = await startProUpgrade();

    expect(result.subscriptionId).toBe("sub-new");
    // No se intentó delete porque fresh === null dentro de tx
    expect(mocks.subscriptionDelete).not.toHaveBeenCalled();
    expect(mocks.subscriptionEventDeleteMany).not.toHaveBeenCalled();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// cancelMySubscription
// ────────────────────────────────────────────────────────────────────────────

describe("cancelMySubscription", () => {
  it('llama applySubscriptionEvent con type "owner_cancel", plan NO cambia', async () => {
    // subscriptionFindFirst = getCurrentSubscription (AUTHORIZED)
    // subscriptionFindUnique (1st call) = dentro de applySubscriptionEvent (AUTHORIZED antes de transición)
    // subscriptionUpdate = la transición CANCELLED
    // subscriptionFindUnique (2nd call) = para obtener currentPeriodEnd post-update
    const authorizedSub = mockSub({ status: "AUTHORIZED" });
    const cancelledSub = mockSub({
      status: "CANCELLED",
      cancelledAt: new Date(),
      currentPeriodEnd: new Date("2025-12-31"),
    });
    mocks.subscriptionFindFirst.mockResolvedValue(authorizedSub);
    mocks.subscriptionFindUnique
      .mockResolvedValueOnce(authorizedSub) // applySubscriptionEvent carga la sub
      .mockResolvedValueOnce(cancelledSub);  // cancelMySubscription obtiene currentPeriodEnd
    mocks.subscriptionUpdate.mockResolvedValue(cancelledSub);
    mocks.subscriptionEventCreate.mockResolvedValue({});

    const result = await cancelMySubscription("too_expensive");

    expect(result.success).toBe(true);
    expect(result.currentPeriodEnd).toEqual(expect.any(Date));
    expect(mocks.subscriptionEventCreate).toHaveBeenCalledWith({
      data: {
        subscriptionId: "sub-1",
        type: "owner_cancel",
        payload: { reason: "too_expensive", userId: "user-1" },
      },
    });
  });

  it("cuando no hay subscription: throw", async () => {
    mocks.subscriptionFindFirst.mockResolvedValue(null);

    await expect(cancelMySubscription()).rejects.toThrow(
      "No tienes una suscripción activa",
    );
  });

  it("cuando subscription no está AUTHORIZED/PAUSED: throw", async () => {
    mocks.subscriptionFindFirst.mockResolvedValue(mockSub({ status: "EXPIRED" }));

    await expect(cancelMySubscription()).rejects.toThrow(
      /No puedes cancelar.*EXPIRED/,
    );
  });
});

// ────────────────────────────────────────────────────────────────────────────
// reactivateMySubscription
// ────────────────────────────────────────────────────────────────────────────

describe("reactivateMySubscription", () => {
  it("CANCELLED + currentPeriodEnd > now: reactiva y retorna success", async () => {
    const futureDate = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);
    mocks.subscriptionFindFirst.mockResolvedValue(
      mockSub({ status: "CANCELLED", currentPeriodEnd: futureDate }),
    );
    // applySubscriptionEvent usa findUnique internamente
    mocks.subscriptionFindUnique.mockResolvedValue(
      mockSub({ status: "CANCELLED", currentPeriodEnd: futureDate }),
    );
    // El owner sigue PRO durante CANCELLED (período pagado), así que applyPlanChange
    // es no-op (currentPlan === newPlan === "PRO"). Mockear findUnique para que no falle.
    mocks.userProfileFindUnique.mockResolvedValue({ plan: "PRO" });
    mocks.subscriptionUpdate.mockResolvedValue(
      mockSub({ status: "AUTHORIZED", cancelledAt: null, cancellationReason: null }),
    );
    mocks.subscriptionEventCreate.mockResolvedValue({});

    const result = await reactivateMySubscription();

    expect(result.success).toBe(true);
    expect(result.subscription.status).toBe("AUTHORIZED");
    // Verifica que se llamó subscription.update con status AUTHORIZED y limpieza de cancellation
    expect(mocks.subscriptionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "sub-1" },
        data: expect.objectContaining({
          status: "AUTHORIZED",
          cancelledAt: null,
          cancellationReason: null,
        }),
      }),
    );
    // Plan no cambia (sigue PRO durante el período pagado), así que NO se llama userProfile.update
    expect(mocks.userProfileUpdate).not.toHaveBeenCalled();
    // Audit trail se registra via lifecycle
    expect(mocks.subscriptionEventCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          subscriptionId: "sub-1",
          type: "authorized",
        }),
      }),
    );
  });

  it("cuando no hay subscription: throw", async () => {
    mocks.subscriptionFindFirst.mockResolvedValue(null);

    await expect(reactivateMySubscription()).rejects.toThrow(
      "No tienes una suscripción para reactivar",
    );
  });

  it("cuando no está CANCELLED: throw", async () => {
    mocks.subscriptionFindFirst.mockResolvedValue(mockSub({ status: "AUTHORIZED" }));

    await expect(reactivateMySubscription()).rejects.toThrow(/Solo puedes reactivar/);
  });

  it("cuando CANCELLED + currentPeriodEnd <= now: throw", async () => {
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    mocks.subscriptionFindFirst.mockResolvedValue(
      mockSub({ status: "CANCELLED", currentPeriodEnd: pastDate }),
    );

    await expect(reactivateMySubscription()).rejects.toThrow(/ya expiró/);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// countOwnerUsage
// ────────────────────────────────────────────────────────────────────────────

describe("countOwnerUsage", () => {
  it("FREE: retorna límites 3/5", async () => {
    mocks.propertyCount.mockResolvedValue(2);
    mocks.reservationClientCount.mockResolvedValue(4);
    mocks.userProfileFindUnique.mockResolvedValue({ plan: "FREE" });

    const result = await countOwnerUsage("user-1");

    expect(result).toEqual({
      properties: 2,
      clients: 4,
      propertiesLimit: 3,
      clientsLimit: 5,
    });
  });

  it("PRO: retorna límites Infinity", async () => {
    mocks.propertyCount.mockResolvedValue(10);
    mocks.reservationClientCount.mockResolvedValue(50);
    mocks.userProfileFindUnique.mockResolvedValue({ plan: "PRO" });

    const result = await countOwnerUsage("user-1");

    expect(result).toEqual({
      properties: 10,
      clients: 50,
      propertiesLimit: Infinity,
      clientsLimit: Infinity,
    });
  });

  it("FREE sin plan en DB: asume FREE", async () => {
    mocks.propertyCount.mockResolvedValue(0);
    mocks.reservationClientCount.mockResolvedValue(0);
    mocks.userProfileFindUnique.mockResolvedValue(null);

    const result = await countOwnerUsage("user-new");

    expect(result.propertiesLimit).toBe(3);
    expect(result.clientsLimit).toBe(5);
  });
});
