/**
 * Tests para lifecycle.ts — applySubscriptionEvent y applyPlanChange.
 *
 * Patrón: todos los mocks dentro de UN vi.hoisted para que vi.mock pueda
 * accederlos cuando es hoisted al top del archivo.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Subscription, SubscriptionEvent } from "@prisma/client";

// ────────────────────────────────────────────────────────────────────────────
// Mocks — TODOS dentro de un solo vi.hoisted
// ────────────────────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  subscriptionFindUnique: vi.fn<() => Promise<Subscription | null>>(),
  subscriptionFindFirst: vi.fn<() => Promise<Subscription | null>>(),
  subscriptionCreate: vi.fn<() => Promise<Subscription>>(),
  subscriptionUpdate: vi.fn<() => Promise<Subscription>>(),
  subscriptionEventCreate: vi.fn<() => Promise<SubscriptionEvent>>(),
  userProfileFindUnique: vi.fn<() => Promise<{ plan: string | null } | null>>(),
  userProfileUpdate: vi.fn<() => Promise<never>>(),
  adminActionLogCreate: vi.fn<() => Promise<never>>(),
  recordSubscriptionNotification: vi.fn<() => Promise<void>>(),
  // $transaction ejecuta el callback pasando un tx mockeado que comparte los mismos mocks
  // (porque el código del lifecycle usa tx.subscription.update etc. cuando está en tx)
  $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) =>
    cb({
      subscription: {
        findUnique: mocks.subscriptionFindUnique,
        findFirst: mocks.subscriptionFindFirst,
        create: mocks.subscriptionCreate,
        update: mocks.subscriptionUpdate,
      },
      subscriptionEvent: { create: mocks.subscriptionEventCreate },
      userProfile: {
        findUnique: mocks.userProfileFindUnique,
        update: mocks.userProfileUpdate,
      },
      adminActionLog: { create: mocks.adminActionLogCreate },
    }),
  ),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    subscription: {
      findUnique: mocks.subscriptionFindUnique,
      findFirst: mocks.subscriptionFindFirst,
      create: mocks.subscriptionCreate,
      update: mocks.subscriptionUpdate,
    },
    subscriptionEvent: {
      create: mocks.subscriptionEventCreate,
    },
    userProfile: {
      findUnique: mocks.userProfileFindUnique,
      update: mocks.userProfileUpdate,
    },
    adminActionLog: {
      create: mocks.adminActionLogCreate,
    },
    $transaction: mocks.$transaction,
  },
}));

vi.mock("@/lib/notifications/subscription-events", () => ({
  recordSubscriptionNotification: mocks.recordSubscriptionNotification,
}));

// ────────────────────────────────────────────────────────────────────────────
// Imports — después de los mocks
// ────────────────────────────────────────────────────────────────────────────

import {
  applySubscriptionEvent,
  applyPlanChange,
  getCurrentSubscription,
} from "../lifecycle";

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

/** Fake Subscription con defaults sensatos */
const fakeSub = (overrides: Partial<Record<string, unknown>> = {}): Subscription =>
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
  } as unknown as Subscription);

beforeEach(() => {
  vi.clearAllMocks();
  // Por defecto, recordSubscriptionNotification retorna Promise resuelta
  mocks.recordSubscriptionNotification.mockResolvedValue(undefined);
});

// ────────────────────────────────────────────────────────────────────────────
// applySubscriptionEvent — type: "created"
// ────────────────────────────────────────────────────────────────────────────

describe('applySubscriptionEvent({ type: "created" })', () => {
  it("crea Subscription PENDING con datos correctos", async () => {
    const newSub = fakeSub({ id: "sub-new", status: "PENDING" });
    mocks.subscriptionFindFirst.mockResolvedValue(null);
    mocks.subscriptionCreate.mockResolvedValue(newSub);
    mocks.subscriptionEventCreate.mockResolvedValue({} as SubscriptionEvent);

    const result = await applySubscriptionEvent({
      type: "created",
      userId: "user-1",
      payload: { email: "test@test.com" },
    });

    expect(result.subscription.status).toBe("PENDING");
    expect(result.subscription.plan).toBe("PRO");
    expect(mocks.subscriptionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        plan: "PRO",
        status: "PENDING",
        amount: expect.anything(),
        currency: "CLP",
      }),
    });
    expect(mocks.subscriptionEventCreate).toHaveBeenCalledWith({
      data: {
        subscriptionId: "sub-new",
        type: "created",
        payload: expect.anything(),
      },
    });
  });

  it("cuando ya existe active subscription: throw", async () => {
    mocks.subscriptionFindFirst.mockResolvedValue(fakeSub({ status: "AUTHORIZED" }));

    await expect(
      applySubscriptionEvent({ type: "created", userId: "user-1" }),
    ).rejects.toThrow("User already has an active subscription");
  });

  it("requiere userId para tipo created", async () => {
    await expect(
      applySubscriptionEvent({ type: "created" } as never),
    ).rejects.toThrow("userId es requerido");
  });
});

// ────────────────────────────────────────────────────────────────────────────
// applySubscriptionEvent — type: "authorized" (PENDING → AUTHORIZED)
// ────────────────────────────────────────────────────────────────────────────

describe('applySubscriptionEvent({ type: "authorized" })', () => {
  it("PENDING → AUTHORIZED + dispara applyPlanChange(FREE → PRO)", async () => {
    const pendingSub = fakeSub({ status: "PENDING" });
    const authorizedSub = fakeSub({ id: "sub-1", status: "AUTHORIZED" });

    mocks.subscriptionFindUnique.mockResolvedValue(pendingSub);
    mocks.subscriptionUpdate.mockResolvedValue(authorizedSub);
    mocks.subscriptionEventCreate.mockResolvedValue({} as SubscriptionEvent);
    mocks.userProfileFindUnique.mockResolvedValue({ plan: "FREE" });
    mocks.userProfileUpdate.mockResolvedValue({} as never);
    mocks.adminActionLogCreate.mockResolvedValue({} as never);

    const result = await applySubscriptionEvent({
      type: "authorized",
      subscriptionId: "sub-1",
      payload: { startDate: "2025-01-01", endDate: "2025-02-01" },
    });

    expect(result.subscription.status).toBe("AUTHORIZED");
    expect(result.planChange).toEqual({
      from: "FREE",
      to: "PRO",
      source: "subscription_lifecycle",
    });
    expect(mocks.subscriptionUpdate).toHaveBeenCalledWith({
      where: { id: "sub-1" },
      data: expect.objectContaining({ status: "AUTHORIZED" }),
    });
  });

  it("cuando ya está AUTHORIZED: idempotente, registra duplicate, NO error", async () => {
    const authorizedSub = fakeSub({ status: "AUTHORIZED" });
    mocks.subscriptionFindUnique.mockResolvedValue(authorizedSub);
    mocks.subscriptionEventCreate.mockResolvedValue({} as SubscriptionEvent);

    const result = await applySubscriptionEvent({
      type: "authorized",
      subscriptionId: "sub-1",
    });

    expect(result.subscription.status).toBe("AUTHORIZED");
    expect(mocks.subscriptionEventCreate).toHaveBeenCalledWith({
      data: {
        subscriptionId: "sub-1",
        type: "duplicate",
        payload: undefined,
      },
    });
    expect(mocks.subscriptionUpdate).not.toHaveBeenCalled();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// applySubscriptionEvent — type: "cancelled" / "owner_cancel"
// ────────────────────────────────────────────────────────────────────────────

describe('applySubscriptionEvent({ type: "cancelled" })', () => {
  it("AUTHORIZED → CANCELLED, plan NO cambia", async () => {
    const authorizedSub = fakeSub({ status: "AUTHORIZED" });
    const cancelledSub = fakeSub({ status: "CANCELLED" });

    mocks.subscriptionFindUnique.mockResolvedValue(authorizedSub);
    mocks.subscriptionUpdate.mockResolvedValue(cancelledSub);
    mocks.subscriptionEventCreate.mockResolvedValue({} as SubscriptionEvent);

    const result = await applySubscriptionEvent({
      type: "cancelled",
      subscriptionId: "sub-1",
      payload: { reason: "too_expensive" },
    });

    expect(result.subscription.status).toBe("CANCELLED");
    expect(result.planChange).toBeUndefined();
    expect(mocks.userProfileUpdate).not.toHaveBeenCalled();
  });

  it("AUTHORIZED → CANCELLED cuando ya está CANCELLED: idempotente, registra duplicate", async () => {
    const cancelledSub = fakeSub({ status: "CANCELLED" });
    mocks.subscriptionFindUnique.mockResolvedValue(cancelledSub);
    mocks.subscriptionEventCreate.mockResolvedValue({} as SubscriptionEvent);

    const result = await applySubscriptionEvent({
      type: "cancelled",
      subscriptionId: "sub-1",
    });

    expect(result.subscription.status).toBe("CANCELLED");
    expect(mocks.subscriptionEventCreate).toHaveBeenCalledWith({
      data: {
        subscriptionId: "sub-1",
        type: "duplicate",
        payload: undefined,
      },
    });
    expect(mocks.subscriptionUpdate).not.toHaveBeenCalled();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// applySubscriptionEvent — type: "expired" (PRO → FREE)
// ────────────────────────────────────────────────────────────────────────────

describe('applySubscriptionEvent({ type: "expired" })', () => {
  it("AUTHORIZED → EXPIRED + dispara applyPlanChange(PRO → FREE)", async () => {
    const authorizedSub = fakeSub({ status: "AUTHORIZED", plan: "PRO" });
    const expiredSub = fakeSub({ status: "EXPIRED", plan: "PRO" });

    mocks.subscriptionFindUnique.mockResolvedValue(authorizedSub);
    mocks.subscriptionUpdate.mockResolvedValue(expiredSub);
    mocks.subscriptionEventCreate.mockResolvedValue({} as SubscriptionEvent);
    mocks.userProfileFindUnique.mockResolvedValue({ plan: "PRO" });
    mocks.userProfileUpdate.mockResolvedValue({} as never);
    mocks.adminActionLogCreate.mockResolvedValue({} as never);

    const result = await applySubscriptionEvent({
      type: "expired",
      subscriptionId: "sub-1",
    });

    expect(result.subscription.status).toBe("EXPIRED");
    expect(result.planChange).toEqual({
      from: "PRO",
      to: "FREE",
      source: "subscription_lifecycle",
    });
  });
});

// ────────────────────────────────────────────────────────────────────────────
// applySubscriptionEvent — type: "failed" (PRO → FREE)
// ────────────────────────────────────────────────────────────────────────────

describe('applySubscriptionEvent({ type: "failed" })', () => {
  it("AUTHORIZED → FAILED + dispara applyPlanChange(PRO → FREE)", async () => {
    const authorizedSub = fakeSub({ status: "AUTHORIZED", plan: "PRO" });
    const failedSub = fakeSub({ status: "FAILED", plan: "PRO" });

    mocks.subscriptionFindUnique.mockResolvedValue(authorizedSub);
    mocks.subscriptionUpdate.mockResolvedValue(failedSub);
    mocks.subscriptionEventCreate.mockResolvedValue({} as SubscriptionEvent);
    mocks.userProfileFindUnique.mockResolvedValue({ plan: "PRO" });
    mocks.userProfileUpdate.mockResolvedValue({} as never);
    mocks.adminActionLogCreate.mockResolvedValue({} as never);

    const result = await applySubscriptionEvent({
      type: "failed",
      subscriptionId: "sub-1",
    });

    expect(result.subscription.status).toBe("FAILED");
    expect(result.planChange).toEqual({
      from: "PRO",
      to: "FREE",
      source: "subscription_lifecycle",
    });
  });
});

// ────────────────────────────────────────────────────────────────────────────
// applySubscriptionEvent — type: "renewed"
// ────────────────────────────────────────────────────────────────────────────

describe('applySubscriptionEvent({ type: "renewed" })', () => {
  it("mantiene AUTHORIZED, actualiza fechas, registra event, NO plan change", async () => {
    const authorizedSub = fakeSub({ status: "AUTHORIZED" });
    mocks.subscriptionFindUnique.mockResolvedValue(authorizedSub);
    mocks.subscriptionUpdate.mockResolvedValue(authorizedSub);
    mocks.subscriptionEventCreate.mockResolvedValue({} as SubscriptionEvent);

    const result = await applySubscriptionEvent({
      type: "renewed",
      subscriptionId: "sub-1",
      payload: {
        startDate: "2025-02-01",
        endDate: "2025-03-01",
        nextPaymentDate: "2025-03-01",
      },
    });

    expect(result.subscription.status).toBe("AUTHORIZED");
    expect(result.planChange).toBeUndefined();
    expect(mocks.subscriptionUpdate).toHaveBeenCalledWith({
      where: { id: "sub-1" },
      data: expect.objectContaining({
        currentPeriodStart: expect.any(Date),
        currentPeriodEnd: expect.any(Date),
        nextPaymentDate: expect.any(Date),
      }),
    });
    expect(mocks.subscriptionEventCreate).toHaveBeenCalledWith({
      data: {
        subscriptionId: "sub-1",
        type: "renewed",
        payload: expect.anything(),
      },
    });
  });
});

// ────────────────────────────────────────────────────────────────────────────
// applySubscriptionEvent — type: "payment_failed"
// ────────────────────────────────────────────────────────────────────────────

describe('applySubscriptionEvent({ type: "payment_failed" })', () => {
  it("mantiene AUTHORIZED, registra event, NO plan change", async () => {
    const authorizedSub = fakeSub({ status: "AUTHORIZED" });
    mocks.subscriptionFindUnique.mockResolvedValue(authorizedSub);
    mocks.subscriptionEventCreate.mockResolvedValue({} as SubscriptionEvent);

    const result = await applySubscriptionEvent({
      type: "payment_failed",
      subscriptionId: "sub-1",
      payload: { retryCount: 2 },
    });

    expect(result.subscription.status).toBe("AUTHORIZED");
    expect(result.planChange).toBeUndefined();
    expect(mocks.subscriptionUpdate).not.toHaveBeenCalled();
    expect(mocks.subscriptionEventCreate).toHaveBeenCalledWith({
      data: {
        subscriptionId: "sub-1",
        type: "payment_failed",
        payload: expect.anything(),
      },
    });
  });
});

// ────────────────────────────────────────────────────────────────────────────
// applyPlanChange
// ────────────────────────────────────────────────────────────────────────────

describe("applyPlanChange", () => {
  it('source "subscription_lifecycle": crea AdminActionLog PLAN_CHANGED_AUTO', async () => {
    mocks.userProfileFindUnique.mockResolvedValue({ plan: "FREE" });
    mocks.userProfileUpdate.mockResolvedValue({} as never);
    mocks.adminActionLogCreate.mockResolvedValue({} as never);

    const result = await applyPlanChange({
      userId: "user-1",
      newPlan: "PRO",
      source: "subscription_lifecycle",
      subscriptionId: "sub-1",
    });

    expect(result).toEqual({
      from: "FREE",
      to: "PRO",
      source: "subscription_lifecycle",
    });
    expect(mocks.adminActionLogCreate).toHaveBeenCalledWith({
      data: {
        adminId: "system", // cambio automático del sistema
        targetId: "user-1",
        action: "PLAN_CHANGED_AUTO",
        details: JSON.stringify({
          source: "subscription_lifecycle",
          subscriptionId: "sub-1",
          fromPlan: "FREE",
          toPlan: "PRO",
        }),
      },
    });
  });

  it('source "admin_manual": crea AdminActionLog PLAN_CHANGED_MANUAL', async () => {
    mocks.userProfileFindUnique.mockResolvedValue({ plan: "PRO" });
    mocks.userProfileUpdate.mockResolvedValue({} as never);
    mocks.adminActionLogCreate.mockResolvedValue({} as never);

    const result = await applyPlanChange({
      userId: "user-1",
      newPlan: "FREE",
      source: "admin_manual",
    });

    expect(result).toEqual({
      from: "PRO",
      to: "FREE",
      source: "admin_manual",
    });
    expect(mocks.adminActionLogCreate).toHaveBeenCalledWith({
      data: {
        adminId: "system", // fallback cuando adminId no se pasa explícito
        targetId: "user-1",
        action: "PLAN_CHANGED_MANUAL",
        details: JSON.stringify({
          fromPlan: "PRO",
          toPlan: "FREE",
        }),
      },
    });
  });

  it("cuando currentPlan === newPlan: no actualiza, no crea log", async () => {
    mocks.userProfileFindUnique.mockResolvedValue({ plan: "PRO" });

    const result = await applyPlanChange({
      userId: "user-1",
      newPlan: "PRO",
      source: "subscription_lifecycle",
    });

    expect(result).toEqual({
      from: "PRO",
      to: "PRO",
      source: "subscription_lifecycle",
    });
    expect(mocks.userProfileUpdate).not.toHaveBeenCalled();
    expect(mocks.adminActionLogCreate).not.toHaveBeenCalled();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Notification hook — recordSubscriptionNotification calls
// ────────────────────────────────────────────────────────────────────────────

describe("applySubscriptionEvent notification hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.recordSubscriptionNotification.mockResolvedValue(undefined);
  });

  it("authorized (FREE→PRO) calls recordSubscriptionNotification with SUBSCRIPTION_ACTIVATED", async () => {
    const pendingSub = fakeSub({ status: "PENDING" });
    const authorizedSub = fakeSub({ id: "sub-1", status: "AUTHORIZED" });

    mocks.subscriptionFindUnique.mockResolvedValue(pendingSub);
    mocks.subscriptionUpdate.mockResolvedValue(authorizedSub);
    mocks.subscriptionEventCreate.mockResolvedValue({} as SubscriptionEvent);
    mocks.userProfileFindUnique.mockResolvedValue({ plan: "FREE" });
    mocks.userProfileUpdate.mockResolvedValue({} as never);
    mocks.adminActionLogCreate.mockResolvedValue({} as never);

    await applySubscriptionEvent({
      type: "authorized",
      subscriptionId: "sub-1",
    });

    expect(mocks.recordSubscriptionNotification).toHaveBeenCalledWith({
      userId: "user-1",
      type: "SUBSCRIPTION_ACTIVATED",
      subscriptionId: "sub-1",
    });
  });

  it("expired (PRO→FREE) calls recordSubscriptionNotification with SUBSCRIPTION_EXPIRED", async () => {
    const authorizedSub = fakeSub({ id: "sub-1", status: "AUTHORIZED" });
    const expiredSub = fakeSub({ id: "sub-1", status: "EXPIRED" });

    mocks.subscriptionFindUnique.mockResolvedValue(authorizedSub);
    mocks.subscriptionUpdate.mockResolvedValue(expiredSub);
    mocks.subscriptionEventCreate.mockResolvedValue({} as SubscriptionEvent);
    mocks.userProfileFindUnique.mockResolvedValue({ plan: "PRO" });
    mocks.userProfileUpdate.mockResolvedValue({} as never);
    mocks.adminActionLogCreate.mockResolvedValue({} as never);

    await applySubscriptionEvent({
      type: "expired",
      subscriptionId: "sub-1",
    });

    expect(mocks.recordSubscriptionNotification).toHaveBeenCalledWith({
      userId: "user-1",
      type: "SUBSCRIPTION_EXPIRED",
      subscriptionId: "sub-1",
    });
  });

  it("when plan does NOT change (duplicate event), does NOT call notification", async () => {
    // Already AUTHORIZED — event is idempotent, no plan change
    const authorizedSub = fakeSub({ id: "sub-1", status: "AUTHORIZED" });

    mocks.subscriptionFindUnique.mockResolvedValue(authorizedSub);
    mocks.subscriptionEventCreate.mockResolvedValue({} as SubscriptionEvent);

    await applySubscriptionEvent({
      type: "authorized",
      subscriptionId: "sub-1",
    });

    // planChange is undefined because currentPlan === newPlan (both PRO)
    expect(mocks.recordSubscriptionNotification).not.toHaveBeenCalled();
  });

  it("if recordSubscriptionNotification throws, the main event still succeeds (best-effort)", async () => {
    const pendingSub = fakeSub({ status: "PENDING" });
    const authorizedSub = fakeSub({ id: "sub-1", status: "AUTHORIZED" });

    mocks.subscriptionFindUnique.mockResolvedValue(pendingSub);
    mocks.subscriptionUpdate.mockResolvedValue(authorizedSub);
    mocks.subscriptionEventCreate.mockResolvedValue({} as SubscriptionEvent);
    mocks.userProfileFindUnique.mockResolvedValue({ plan: "FREE" });
    mocks.userProfileUpdate.mockResolvedValue({} as never);
    mocks.adminActionLogCreate.mockResolvedValue({} as never);
    // Notification throws — should not affect the main result
    mocks.recordSubscriptionNotification.mockRejectedValue(
      new Error("Notification service down"),
    );

    // Should NOT throw even though notification fails
    const result = await applySubscriptionEvent({
      type: "authorized",
      subscriptionId: "sub-1",
    });

    expect(result.subscription.status).toBe("AUTHORIZED");
    expect(result.planChange?.to).toBe("PRO");
  });
});

// ────────────────────────────────────────────────────────────────────────────
// getCurrentSubscription
// ────────────────────────────────────────────────────────────────────────────

describe("getCurrentSubscription", () => {
  it("delega a getActiveSubscription con el adapter", async () => {
    const sub = fakeSub({ status: "AUTHORIZED" });
    mocks.subscriptionFindFirst.mockResolvedValue(sub);

    const result = await getCurrentSubscription("user-1");

    expect(result).toBe(sub);
    expect(mocks.subscriptionFindFirst).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        status: { in: ["PENDING", "AUTHORIZED", "PAUSED"] },
      },
    });
  });

  it("retorna null si no hay subscription activa", async () => {
    mocks.subscriptionFindFirst.mockResolvedValue(null);

    const result = await getCurrentSubscription("user-no-sub");

    expect(result).toBeNull();
  });
});
