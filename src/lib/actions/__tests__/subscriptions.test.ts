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
  fetchPreapproval: vi.fn(),
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
    fetchPreapproval: mocks.fetchPreapproval,
  })),
}));

vi.mock("@/lib/auth/guards", () => ({
  requireOwner: mocks.requireOwner,
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
  getCurrentSubscriptionAction,
  startProUpgrade,
  cancelMySubscription,
  countOwnerUsage,
} from "../subscriptions";

// ────────────────────────────────────────────────────────────────────────────
// Setup
// ────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.resetAllMocks();
  mocks.requireOwner.mockResolvedValue(mockSession);
  // Defaults: los mocks usados con .catch() en el código de producción
  // (prisma.subscription.delete, adminActionLog.create) necesitan retornar
  // Promise. Sin esto, vi.resetAllMocks() borra la implementación default
  // y .catch() falla con "Cannot read properties of undefined".
  mocks.subscriptionDelete.mockResolvedValue({} as never);
  mocks.adminActionLogCreate.mockResolvedValue({} as never);
});

// ────────────────────────────────────────────────────────────────────────────
// getCurrentSubscriptionAction
// ────────────────────────────────────────────────────────────────────────────

describe("getCurrentSubscriptionAction", () => {
  it("retorna una CANCELLED con período vigente (#195 ronda 2 — antes se filtraba a null)", async () => {
    const futureDate = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);
    const cancelled = mockSub({ status: "CANCELLED", currentPeriodEnd: futureDate });
    mocks.subscriptionFindUnique.mockResolvedValue(cancelled);

    const result = await getCurrentSubscriptionAction();

    expect(result).toEqual(cancelled);
    expect(mocks.subscriptionFindUnique).toHaveBeenCalledWith({
      where: { userId: "user-1" },
    });
  });

  it("retorna null si el owner nunca tuvo subscription", async () => {
    mocks.subscriptionFindUnique.mockResolvedValue(null);

    const result = await getCurrentSubscriptionAction();

    expect(result).toBeNull();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// startProUpgrade
// ────────────────────────────────────────────────────────────────────────────

describe("startProUpgrade", () => {
  it("cuando user no tiene subscription: llama gateway, crea subscription, retorna initPoint", async () => {
    // Pre-check (getCurrentSubscription) y re-check dentro de la tx (fresh)
    // leen por userId con findUnique — ambas llamadas retornan null.
    mocks.subscriptionFindUnique.mockResolvedValue(null);
    mocks.subscriptionFindFirst.mockResolvedValue(null); // getActiveSubscription dentro de "created"
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

  it("usa nextPaymentDate de MP para currentPeriodEnd cuando MP lo devuelve (#221)", async () => {
    // MP devuelve next_payment_date en el response de createPreapproval.
    // Ese valor debe llegar a Subscription.currentPeriodEnd y .nextPaymentDate
    // (no el placeholder hardcoded de +30d).
    const mpPeriodEnd = "2026-09-21T10:00:00.000-04:00";
    const mpPeriodStart = "2026-08-22T10:00:00.000-04:00";
    mocks.subscriptionFindUnique.mockResolvedValue(null); // pre-check + fresh
    mocks.subscriptionFindFirst.mockResolvedValue(null);
    mocks.subscriptionCreate.mockResolvedValue(mockSub({ id: "sub-new", status: "PENDING" }));
    mocks.subscriptionEventCreate.mockResolvedValue({});
    mocks.ensurePlan.mockResolvedValue({ planId: "plan-123" });
    mocks.createPreapproval.mockResolvedValue({
      preapprovalId: "preapproval-123",
      initPoint: "https://mercadopago.com/init",
      nextPaymentDate: mpPeriodEnd,
      autoRecurringStartDate: mpPeriodStart,
    });
    mocks.subscriptionUpdate.mockResolvedValue(mockSub({ id: "sub-new" }));

    await startProUpgrade();

    expect(mocks.subscriptionUpdate).toHaveBeenCalledWith({
      where: { id: "sub-new" },
      data: expect.objectContaining({
        mpPreapprovalId: "preapproval-123",
        mpPlanId: "plan-123",
        currentPeriodStart: new Date(mpPeriodStart),
        currentPeriodEnd: new Date(mpPeriodEnd),
        nextPaymentDate: new Date(mpPeriodEnd),
      }),
    });
  });

  it("usa +30d como placeholder cuando MP NO devuelve nextPaymentDate (#221 fallback)", async () => {
    // Caso raro / respuesta parcial: MP no incluye next_payment_date.
    // El +30d es solo placeholder hasta el primer webhook "authorized"
    // (que sobreescribe este valor en lifecycle.ts).
    const beforeCall = Date.now();
    mocks.subscriptionFindUnique.mockResolvedValue(null); // pre-check + fresh
    mocks.subscriptionFindFirst.mockResolvedValue(null);
    mocks.subscriptionCreate.mockResolvedValue(mockSub({ id: "sub-new", status: "PENDING" }));
    mocks.subscriptionEventCreate.mockResolvedValue({});
    mocks.ensurePlan.mockResolvedValue({ planId: "plan-123" });
    mocks.createPreapproval.mockResolvedValue({
      preapprovalId: "preapproval-123",
      initPoint: "https://mercadopago.com/init",
      // nextPaymentDate y autoRecurringStartDate explícitamente undefined
      nextPaymentDate: undefined,
      autoRecurringStartDate: undefined,
    });
    mocks.subscriptionUpdate.mockResolvedValue(mockSub({ id: "sub-new" }));

    await startProUpgrade();
    const afterCall = Date.now();

    const call = mocks.subscriptionUpdate.mock.calls.find(
      (c) => c[0]?.where?.id === "sub-new",
    );
    expect(call).toBeDefined();
    const data = call![0].data;
    const expectedMin = beforeCall + 30 * 24 * 60 * 60 * 1000;
    const expectedMax = afterCall + 30 * 24 * 60 * 60 * 1000;
    expect(data.currentPeriodEnd.getTime()).toBeGreaterThanOrEqual(expectedMin);
    expect(data.currentPeriodEnd.getTime()).toBeLessThanOrEqual(expectedMax);
    expect(data.nextPaymentDate.getTime()).toBe(data.currentPeriodEnd.getTime());
  });

  it("cuando user ya tiene subscription AUTHORIZED: throw", async () => {
    mocks.subscriptionFindUnique.mockResolvedValue(mockSub({ status: "AUTHORIZED" }));

    await expect(startProUpgrade()).rejects.toThrow("Ya tienes PRO activo");
  });

  it("cuando user tiene CANCELLED no expirada: throw con fecha", async () => {
    const futureDate = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);
    mocks.subscriptionFindUnique.mockResolvedValue(
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
    const existing = mockSub(existingSub);
    // Pre-check (getCurrentSubscription) y re-check dentro de la tx (fresh)
    // leen la misma fila via findUnique — dos llamadas, mismo resultado.
    mocks.subscriptionFindUnique
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce(existing);
    mocks.subscriptionEventDeleteMany.mockResolvedValueOnce({ count: 2 });
    mocks.subscriptionDelete.mockResolvedValueOnce(existing);
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

  // ── ensurePreviousPreapprovalStopped: defensa contra doble cobro ──────────
  // Una fila reemplazable (EXPIRED/FAILED/CANCELLED-expirada) puede seguir
  // teniendo un preapproval vivo en MP — p.ej. el cron `EXPIRED_CHECK` marcó
  // localmente EXPIRED sin que llegara el webhook de renovación. Antes de
  // reemplazar la fila y crear un preapproval nuevo, `startProUpgrade` debe
  // confirmar (y cancelar si hace falta) el preapproval anterior.

  it("preapproval anterior sigue vivo en MP (authorized) → lo cancela y luego reemplaza", async () => {
    const newSub = setupUpgradeSuccess({
      id: "sub-old",
      status: "EXPIRED",
      mpPreapprovalId: "mp-old-preapproval",
    });
    mocks.fetchPreapproval.mockResolvedValueOnce({
      id: "mp-old-preapproval",
      status: "authorized",
    });

    const result = await startProUpgrade();

    expect(mocks.fetchPreapproval).toHaveBeenCalledWith("mp-old-preapproval");
    expect(mocks.cancelPreapproval).toHaveBeenCalledWith("mp-old-preapproval");
    expect(result.subscriptionId).toBe(newSub.id);
    expect(mocks.subscriptionDelete).toHaveBeenCalledWith({
      where: { id: "sub-old" },
    });
  });

  it("preapproval anterior ya cancelado en MP → no llama cancelPreapproval, igual reemplaza", async () => {
    setupUpgradeSuccess({
      id: "sub-old",
      status: "FAILED",
      mpPreapprovalId: "mp-old-preapproval",
    });
    mocks.fetchPreapproval.mockResolvedValueOnce({
      id: "mp-old-preapproval",
      status: "cancelled",
    });

    const result = await startProUpgrade();

    expect(mocks.fetchPreapproval).toHaveBeenCalledWith("mp-old-preapproval");
    expect(mocks.cancelPreapproval).not.toHaveBeenCalled();
    expect(result.subscriptionId).toBe("sub-new");
    expect(mocks.subscriptionDelete).toHaveBeenCalledWith({
      where: { id: "sub-old" },
    });
  });

  it("fetchPreapproval falla → throw, no reemplaza ni crea preapproval nuevo", async () => {
    mocks.subscriptionFindUnique.mockResolvedValue(
      mockSub({ id: "sub-old", status: "EXPIRED", mpPreapprovalId: "mp-old-preapproval" }),
    );
    mocks.fetchPreapproval.mockRejectedValueOnce(new Error("MP timeout"));

    await expect(startProUpgrade()).rejects.toThrow(
      "No pudimos verificar tu suscripción anterior en Mercado Pago. Intenta de nuevo en unos minutos.",
    );

    expect(mocks.subscriptionEventDeleteMany).not.toHaveBeenCalled();
    expect(mocks.subscriptionDelete).not.toHaveBeenCalled();
    expect(mocks.subscriptionCreate).not.toHaveBeenCalled();
    expect(mocks.createPreapproval).not.toHaveBeenCalled();
  });

  it("cancelPreapproval falla → throw, no reemplaza ni crea preapproval nuevo", async () => {
    mocks.subscriptionFindUnique.mockResolvedValue(
      mockSub({ id: "sub-old", status: "EXPIRED", mpPreapprovalId: "mp-old-preapproval" }),
    );
    mocks.fetchPreapproval.mockResolvedValueOnce({
      id: "mp-old-preapproval",
      status: "authorized",
    });
    mocks.cancelPreapproval.mockRejectedValueOnce(new Error("MP down"));

    await expect(startProUpgrade()).rejects.toThrow(
      "No pudimos verificar tu suscripción anterior en Mercado Pago. Intenta de nuevo en unos minutos.",
    );

    expect(mocks.subscriptionEventDeleteMany).not.toHaveBeenCalled();
    expect(mocks.subscriptionDelete).not.toHaveBeenCalled();
    expect(mocks.subscriptionCreate).not.toHaveBeenCalled();
    expect(mocks.createPreapproval).not.toHaveBeenCalled();
  });

  it("fila reemplazable sin mpPreapprovalId → no llama a MP para verificar", async () => {
    setupUpgradeSuccess({ id: "sub-old", status: "EXPIRED", mpPreapprovalId: null });

    const result = await startProUpgrade();

    expect(result.subscriptionId).toBe("sub-new");
    expect(mocks.fetchPreapproval).not.toHaveBeenCalled();
    expect(mocks.cancelPreapproval).not.toHaveBeenCalled();
  });

  it("AUTHORIZED → upgrade attempt blocks (regression)", async () => {
    mocks.subscriptionFindUnique.mockResolvedValue(
      mockSub({ status: "AUTHORIZED" }),
    );

    await expect(startProUpgrade()).rejects.toThrow("Ya tienes PRO activo");
    expect(mocks.subscriptionEventDeleteMany).not.toHaveBeenCalled();
    expect(mocks.subscriptionDelete).not.toHaveBeenCalled();
    expect(mocks.subscriptionCreate).not.toHaveBeenCalled();
  });

  it("PAUSED → upgrade attempt blocks (regression)", async () => {
    mocks.subscriptionFindUnique.mockResolvedValue(
      mockSub({ status: "PAUSED" }),
    );

    await expect(startProUpgrade()).rejects.toThrow("Ya tienes PRO activo");
    expect(mocks.subscriptionEventDeleteMany).not.toHaveBeenCalled();
    expect(mocks.subscriptionDelete).not.toHaveBeenCalled();
    expect(mocks.subscriptionCreate).not.toHaveBeenCalled();
  });

  it("CANCELLED-vigente → upgrade attempt blocks (regression)", async () => {
    const futureDate = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);
    mocks.subscriptionFindUnique.mockResolvedValue(
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
    // Ambas lecturas por findUnique (pre-check fuera de tx y re-check "fresh"
    // dentro de la tx) ven null: ninguna otra request creó/dejó una fila.
    const newSub = mockSub({ id: "sub-new", status: "PENDING" });

    mocks.subscriptionFindUnique
      .mockResolvedValueOnce(null) // pre-check (getCurrentSubscription) → no hay sub
      .mockResolvedValueOnce(null); // re-check dentro de tx (fresh) → sigue sin existir
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

  it("Race: fresh dentro de la tx es CANCELLED vigente → error amigable, no P2002 (#195 ronda 2)", async () => {
    // El pre-check vio null (sin subscription), pero entre el pre-check y la
    // tx una request concurrente dejó una CANCELLED con período todavía
    // vigente (p.ej. otra pestaña completó el ciclo create→authorize→cancel).
    // El re-check "fresh" debe frenar con el mismo error amigable del
    // pre-check en vez de dejar que el create de abajo choque con
    // `userId @unique` (P2002).
    const futureDate = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);
    mocks.subscriptionFindUnique
      .mockResolvedValueOnce(null) // pre-check: no había nada
      .mockResolvedValueOnce(
        mockSub({ status: "CANCELLED", currentPeriodEnd: futureDate }),
      ); // re-check dentro de tx: la carrera ya dejó una fila vigente

    await expect(startProUpgrade()).rejects.toThrow(/sigue activa hasta/);
    expect(mocks.subscriptionEventDeleteMany).not.toHaveBeenCalled();
    expect(mocks.subscriptionDelete).not.toHaveBeenCalled();
    expect(mocks.subscriptionCreate).not.toHaveBeenCalled();
  });

  it("CANCELLED + currentPeriodEnd=null: replace (ADR-0034 deriva FREE, no hay período pagado que honrar)", async () => {
    // Dato legacy: sin currentPeriodEnd seteada. derivePlanFromSubscription
    // (ADR-0034) deriva FREE para CANCELLED+null porque no hay período pagado
    // que honrar — canStartUpgrade sigue esa misma regla (#195 ronda 2).
    const cancelledNull = mockSub({
      status: "CANCELLED",
      currentPeriodEnd: null,
      id: "sub-cancelled-null",
    });
    mocks.subscriptionFindUnique
      .mockResolvedValueOnce(cancelledNull) // pre-check
      .mockResolvedValueOnce(cancelledNull); // re-check dentro de tx (fresh)
    mocks.subscriptionEventDeleteMany.mockResolvedValue({ count: 1 });
    mocks.subscriptionDelete.mockResolvedValue(cancelledNull);
    mocks.subscriptionCreate.mockResolvedValue(
      mockSub({ id: "sub-new", status: "PENDING" }),
    );
    mocks.subscriptionUpdate.mockResolvedValue(
      mockSub({ id: "sub-new", status: "PENDING" }),
    );
    mocks.ensurePlan.mockResolvedValue({ planId: "plan-123" });
    mocks.createPreapproval.mockResolvedValue({
      preapprovalId: "preapproval-123",
      initPoint: "https://mp.example.com/init",
    });

    const result = await startProUpgrade();

    expect(result.subscriptionId).toBe("sub-new");
    expect(mocks.subscriptionDelete).toHaveBeenCalledWith({
      where: { id: "sub-cancelled-null" },
    });
  });

  it("CANCELLED + currentPeriodEnd en el pasado: replace (regresión post-fix)", async () => {
    // CANCELLED-expirado llega al tx; antes del fix esto causaba P2002.
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const cancelledExpired = mockSub({
      status: "CANCELLED",
      currentPeriodEnd: past,
      id: "sub-cancelled-expired",
    });
    // Pre-check (getCurrentSubscription) y re-check dentro de la tx (fresh)
    // leen la misma fila CANCELLED-expirada via findUnique.
    mocks.subscriptionFindUnique.mockResolvedValue(cancelledExpired);
    // getActiveSubscription dentro de "created" filtra PENDING/AUTHORIZED/PAUSED
    // — CANCELLED no calza → null (la fila vieja ya se borró en la tx igual).
    mocks.subscriptionFindFirst.mockResolvedValue(null);
    mocks.subscriptionCreate.mockResolvedValue(
      mockSub({ id: "sub-new", status: "PENDING" }),
    );
    mocks.subscriptionUpdate.mockResolvedValue(
      mockSub({ id: "sub-new", status: "PENDING" }),
    );
    mocks.ensurePlan.mockResolvedValue({ planId: "plan-123" });
    mocks.createPreapproval.mockResolvedValue({
      preapprovalId: "preapproval-123",
      initPoint: "https://mp.example.com/init",
    });

    const result = await startProUpgrade();
    expect(result.subscriptionId).toBe("sub-new");
    // El replace ocurrió: se borró la CANCELLED-expirado
    expect(mocks.subscriptionDelete).toHaveBeenCalledWith({ where: { id: "sub-cancelled-expired" } });
  });

  it("AdminActionLog failure post-tx NO afecta el return de startProUpgrade", async () => {
    // AdminActionLog es best-effort. Si falla, el owner sigue viendo su nueva subscription.
    const expired = mockSub({ id: "sub-old", status: "EXPIRED" });
    // Pre-check y re-check dentro de la tx leen la misma fila EXPIRED via findUnique.
    mocks.subscriptionFindUnique.mockResolvedValue(expired);
    // getActiveSubscription dentro de "created" filtra PENDING/AUTHORIZED/PAUSED
    // — EXPIRED no calza → null.
    mocks.subscriptionFindFirst.mockResolvedValue(null);
    mocks.subscriptionCreate.mockResolvedValue(
      mockSub({ id: "sub-new", status: "PENDING" }),
    );
    mocks.subscriptionUpdate.mockResolvedValue(
      mockSub({ id: "sub-new", status: "PENDING" }),
    );
    mocks.ensurePlan.mockResolvedValue({ planId: "plan-123" });
    mocks.createPreapproval.mockResolvedValue({
      preapprovalId: "preapproval-123",
      initPoint: "https://mp.example.com/init",
    });
    // Preapproval OK pero adminActionLog falla
    mocks.adminActionLogCreate.mockRejectedValue(new Error("Audit service down"));

    // No debe throw — el best-effort logging no aborta la acción principal
    const result = await startProUpgrade();
    expect(result.subscriptionId).toBe("sub-new");
    expect(result.initPoint).toBe("https://mp.example.com/init");
  });

  it("PENDING existente: bloquea con mensaje claro (no cae al tx)", async () => {
    // Segundo click del dueño mientras la PENDING inicial aún existe.
    mocks.subscriptionFindUnique.mockResolvedValue(
      mockSub({ status: "PENDING" }),
    );

    await expect(startProUpgrade()).rejects.toThrow(
      /pago PRO pendiente/i,
    );
    // No se intentó crear nada nuevo
    expect(mocks.subscriptionCreate).not.toHaveBeenCalled();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// cancelMySubscription
// ────────────────────────────────────────────────────────────────────────────

describe("cancelMySubscription", () => {
  it('llama applySubscriptionEvent con type "owner_cancel", plan NO cambia', async () => {
    // subscriptionFindUnique (1st call) = pre-check getCurrentSubscription (AUTHORIZED)
    // subscriptionFindUnique (2nd call) = dentro de applySubscriptionEvent (AUTHORIZED antes de transición)
    // subscriptionUpdate = la transición CANCELLED
    // subscriptionFindUnique (3rd call) = para obtener currentPeriodEnd post-update
    const authorizedSub = mockSub({ status: "AUTHORIZED" });
    const cancelledSub = mockSub({
      status: "CANCELLED",
      cancelledAt: new Date(),
      currentPeriodEnd: new Date("2025-12-31"),
    });
    mocks.subscriptionFindUnique
      .mockResolvedValueOnce(authorizedSub) // pre-check (getCurrentSubscription)
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
    // owner_cancel NO baja el plan: el owner sigue PRO hasta fin de periodo.
    // Asi que el badge del sidebar no tiene nada que re-renderizar, y el
    // arbol de layouts no se invalida — solo la pagina de billing, que si
    // cambia ("cancelada, vigente hasta X").
    expect(mocks.revalidatePath).not.toHaveBeenCalledWith("/", "layout");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/settings/billing");
  });

  it("cuando no hay subscription: throw", async () => {
    mocks.subscriptionFindUnique.mockResolvedValue(null);

    await expect(cancelMySubscription()).rejects.toThrow(
      "No tienes una suscripción activa",
    );
  });

  it("cuando subscription no está AUTHORIZED/PAUSED: throw", async () => {
    mocks.subscriptionFindUnique.mockResolvedValue(mockSub({ status: "EXPIRED" }));

    await expect(cancelMySubscription()).rejects.toThrow(
      /No puedes cancelar.*EXPIRED/,
    );
  });

  it("cuando subscription está CANCELLED (ya no AUTHORIZED/PAUSED): throw con el status real (#195 ronda 2)", async () => {
    // Antes del fix, getCurrentSubscription (via getActiveSubscription)
    // devolvía null para una CANCELLED y el error decía "No tienes una
    // suscripción activa" — engañoso si en realidad sí hay una fila, solo que
    // ya no es cancelable. Ahora getCurrentSubscription trae la fila y el
    // segundo check da el status real.
    mocks.subscriptionFindUnique.mockResolvedValue(
      mockSub({ status: "CANCELLED" }),
    );

    await expect(cancelMySubscription()).rejects.toThrow(
      /No puedes cancelar.*CANCELLED/,
    );
  });
});

// ────────────────────────────────────────────────────────────────────────────
// countOwnerUsage
// ────────────────────────────────────────────────────────────────────────────

describe("countOwnerUsage", () => {
  it("FREE: retorna límites 3/5", async () => {
    mocks.propertyCount.mockResolvedValue(2);
    mocks.reservationClientCount.mockResolvedValue(4);
    mocks.userProfileFindUnique.mockResolvedValue({ planOverride: null, subscription: null });

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
    mocks.userProfileFindUnique.mockResolvedValue({
      planOverride: null,
      subscription: { status: "AUTHORIZED", currentPeriodEnd: new Date("2099-01-01"), mpPreapprovalId: "pre-1" },
    });

    const result = await countOwnerUsage("user-1");

    expect(result).toEqual({
      properties: 10,
      clients: 50,
      propertiesLimit: Infinity,
      clientsLimit: Infinity,
    });
  });

  // El plan efectivo, no el cacheado: entre que vence el periodo y corre el
  // cron `expired-check` pueden pasar ~24h. Si este helper leyera
  // `UserProfile.plan` crudo, el banner del dashboard mostraria "sin limites"
  // mientras los gates ya bloquean por limite FREE.
  it("PRO con periodo vencido y cron sin correr: retorna limites FREE", async () => {
    mocks.propertyCount.mockResolvedValue(5);
    mocks.reservationClientCount.mockResolvedValue(9);
    mocks.userProfileFindUnique.mockResolvedValue({
      plan: "PRO",
      subscription: {
        status: "AUTHORIZED",
        currentPeriodEnd: new Date(Date.now() - 60 * 60 * 1000), // vencio hace 1h
        mpPreapprovalId: "pre-1",
      },
    });

    const result = await countOwnerUsage("user-1");

    expect(result.propertiesLimit).toBe(3);
    expect(result.clientsLimit).toBe(5);
    // El uso real se sigue reportando tal cual, aunque exceda el limite.
    expect(result.properties).toBe(5);
  });

  it("PRO con periodo vigente: mantiene limites Infinity", async () => {
    mocks.propertyCount.mockResolvedValue(10);
    mocks.reservationClientCount.mockResolvedValue(50);
    mocks.userProfileFindUnique.mockResolvedValue({
      plan: "PRO",
      subscription: {
        status: "AUTHORIZED",
        currentPeriodEnd: new Date(Date.now() + 24 * 60 * 60 * 1000),
        mpPreapprovalId: "pre-1",
      },
    });

    const result = await countOwnerUsage("user-1");

    expect(result.propertiesLimit).toBe(Infinity);
    expect(result.clientsLimit).toBe(Infinity);
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
