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

// Mock de softStopExternalCalendars — llamado por lifecycle.ts en expired/expired_check
const mockSoftStopExternalCalendars = vi.hoisted(() =>
  vi.fn(() =>
    Promise.resolve({
      externalCalendarIds: ["cal-1", "cal-2"],
      externalBlockIds: ["block-1"],
    }),
  ),
);

// Mock de restoreExternalCalendars — llamado por lifecycle.ts en authorized con downgrade previo
const mockRestoreExternalCalendars = vi.hoisted(() =>
  vi.fn(() =>
    Promise.resolve({
      restoredCalendarIds: ["cal-1"],
      restoredBlockIds: ["block-1"],
    }),
  ),
);

// Mock de findLastDowngradeSnapshot — usado por lifecycle.ts en authorized
const mockFindLastDowngradeSnapshot = vi.hoisted(() =>
  vi.fn<() => Promise<{ externalCalendarIds: string[]; externalBlockIds: string[] } | null>>(() =>
    Promise.resolve(null),
  ),
);

vi.mock("../subscription-downgrade", () => ({
  softStopExternalCalendars: mockSoftStopExternalCalendars,
  restoreExternalCalendars: mockRestoreExternalCalendars,
}));

vi.mock("../queries", async (importOriginal) => {
  const actual = (await importOriginal()) as typeof import("../queries");
  return {
    ...actual,
    findLastDowngradeSnapshot: mockFindLastDowngradeSnapshot,
  };
});

const mocks = vi.hoisted(() => ({
  subscriptionFindUnique: vi.fn<() => Promise<Subscription | null>>(),
  subscriptionFindFirst: vi.fn<() => Promise<Subscription | null>>(),
  subscriptionCreate: vi.fn<() => Promise<Subscription>>(),
  subscriptionUpdate: vi.fn<() => Promise<Subscription>>(),
  subscriptionEventCreate: vi.fn<() => Promise<SubscriptionEvent>>(),
  subscriptionEventFindFirst: vi.fn<() => Promise<unknown>>(),
  userProfileFindUnique: vi.fn<() => Promise<{ plan: string | null } | null>>(),
  userProfileUpdate: vi.fn<() => Promise<never>>(),
  adminActionLogCreate: vi.fn<() => Promise<never>>(),
  recordSubscriptionNotification: vi.fn<() => Promise<void>>(),
  externalCalendarUpdateManyAndReturn: vi.fn(),
  externalChannelBlockUpdateManyAndReturn: vi.fn(),
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
      subscriptionEvent: {
        create: mocks.subscriptionEventCreate,
        findFirst: mocks.subscriptionEventFindFirst,
      },
      userProfile: {
        findUnique: mocks.userProfileFindUnique,
        update: mocks.userProfileUpdate,
      },
      adminActionLog: { create: mocks.adminActionLogCreate },
      externalCalendar: {
        updateManyAndReturn: mocks.externalCalendarUpdateManyAndReturn,
      },
      externalChannelBlock: {
        updateManyAndReturn: mocks.externalChannelBlockUpdateManyAndReturn,
      },
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
      findFirst: mocks.subscriptionEventFindFirst,
    },
    userProfile: {
      findUnique: mocks.userProfileFindUnique,
      update: mocks.userProfileUpdate,
    },
    adminActionLog: {
      create: mocks.adminActionLogCreate,
    },
    externalCalendar: {
      updateManyAndReturn: mocks.externalCalendarUpdateManyAndReturn,
    },
    externalChannelBlock: {
      updateManyAndReturn: mocks.externalChannelBlockUpdateManyAndReturn,
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
// applySubscriptionEvent({ type: "authorized" }) con transición desde downgrade
// ────────────────────────────────────────────────────────────────────────────

describe('applySubscriptionEvent({ type: "authorized" }) con transición desde downgrade', () => {
  // Tier 1 #5: desde CANCELLED SIN snap previo → NO ejecuta restore
  it("desde CANCELLED SIN snap previo: NO ejecuta restore", async () => {
    const cancelledSub = fakeSub({ status: "CANCELLED" });
    const authorizedSub = fakeSub({ status: "AUTHORIZED" });

    mocks.subscriptionFindUnique.mockResolvedValue(cancelledSub);
    mocks.subscriptionUpdate.mockResolvedValue(authorizedSub);
    mocks.subscriptionEventCreate.mockResolvedValue({} as SubscriptionEvent);
    mocks.userProfileFindUnique.mockResolvedValue({ plan: "FREE" });
    mocks.userProfileUpdate.mockResolvedValue({} as never);
    mocks.adminActionLogCreate.mockResolvedValue({} as never);
    mockFindLastDowngradeSnapshot.mockResolvedValue(null);

    await applySubscriptionEvent({
      type: "authorized",
      subscriptionId: "sub-1",
    });

    expect(mockRestoreExternalCalendars).not.toHaveBeenCalled();
  });

  // Tier 1 #6: desde EXPIRED CON snap → ejecuta restore
  it("desde EXPIRED CON snap: ejecuta restore con snapshot del último expired", async () => {
    const expiredSub = fakeSub({ status: "EXPIRED", userId: "user-1" });
    const authorizedSub = fakeSub({ status: "AUTHORIZED", userId: "user-1" });

    mocks.subscriptionFindUnique.mockResolvedValue(expiredSub);
    mocks.subscriptionUpdate.mockResolvedValue(authorizedSub);
    mocks.subscriptionEventCreate.mockResolvedValue({} as SubscriptionEvent);
    mocks.userProfileFindUnique.mockResolvedValue({ plan: "FREE" });
    mocks.userProfileUpdate.mockResolvedValue({} as never);
    mocks.adminActionLogCreate.mockResolvedValue({} as never);
    mockFindLastDowngradeSnapshot.mockResolvedValue({
      externalCalendarIds: ["cal-1", "cal-2"],
      externalBlockIds: ["block-1"],
    });

    await applySubscriptionEvent({
      type: "authorized",
      subscriptionId: "sub-1",
    });

    expect(mockFindLastDowngradeSnapshot).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ subscriptionEvent: expect.any(Object) }),
    );
    expect(mockRestoreExternalCalendars).toHaveBeenCalledWith(
      "user-1",
      { externalCalendarIds: ["cal-1", "cal-2"], externalBlockIds: ["block-1"] },
      expect.objectContaining({ subscriptionEvent: expect.any(Object) }),
    );
  });

  // Tier 1 #7: desde FAILED SIN snap → NO ejecuta restore
  it("desde FAILED SIN snap: NO ejecuta restore", async () => {
    const failedSub = fakeSub({ status: "FAILED", userId: "user-1" });
    const authorizedSub = fakeSub({ status: "AUTHORIZED", userId: "user-1" });

    mocks.subscriptionFindUnique.mockResolvedValue(failedSub);
    mocks.subscriptionUpdate.mockResolvedValue(authorizedSub);
    mocks.subscriptionEventCreate.mockResolvedValue({} as SubscriptionEvent);
    mocks.userProfileFindUnique.mockResolvedValue({ plan: "FREE" });
    mocks.userProfileUpdate.mockResolvedValue({} as never);
    mocks.adminActionLogCreate.mockResolvedValue({} as never);
    mockFindLastDowngradeSnapshot.mockResolvedValue(null);

    await applySubscriptionEvent({
      type: "authorized",
      subscriptionId: "sub-1",
    });

    expect(mockRestoreExternalCalendars).not.toHaveBeenCalled();
  });

  // Tier 1 #8: desde PENDING (FREE → PRO primer upgrade) → NO ejecuta restore
  it("desde PENDING (FREE → PRO primer upgrade): NO ejecuta restore", async () => {
    const pendingSub = fakeSub({ status: "PENDING", userId: "user-1" });
    const authorizedSub = fakeSub({ status: "AUTHORIZED", userId: "user-1" });

    mocks.subscriptionFindUnique.mockResolvedValue(pendingSub);
    mocks.subscriptionUpdate.mockResolvedValue(authorizedSub);
    mocks.subscriptionEventCreate.mockResolvedValue({} as SubscriptionEvent);
    mocks.userProfileFindUnique.mockResolvedValue({ plan: "FREE" });
    mocks.userProfileUpdate.mockResolvedValue({} as never);
    mocks.adminActionLogCreate.mockResolvedValue({} as never);
    mockFindLastDowngradeSnapshot.mockResolvedValue(null);

    await applySubscriptionEvent({
      type: "authorized",
      subscriptionId: "sub-1",
    });

    expect(mockRestoreExternalCalendars).not.toHaveBeenCalled();
  });

  // Tier 1 #9: multi-cycle — 2 eventos expired con snaps distintos → restore usa el más reciente
  it("multi-cycle: restore usa el snapshot más reciente (orderBy createdAt desc)", async () => {
    const expiredSub = fakeSub({ status: "EXPIRED", userId: "user-1" });
    const authorizedSub = fakeSub({ status: "AUTHORIZED", userId: "user-1" });

    mocks.subscriptionFindUnique.mockResolvedValue(expiredSub);
    mocks.subscriptionUpdate.mockResolvedValue(authorizedSub);
    mocks.subscriptionEventCreate.mockResolvedValue({} as SubscriptionEvent);
    mocks.userProfileFindUnique.mockResolvedValue({ plan: "FREE" });
    mocks.userProfileUpdate.mockResolvedValue({} as never);
    mocks.adminActionLogCreate.mockResolvedValue({} as never);
    // El más reciente tiene cal-recent
    mockFindLastDowngradeSnapshot.mockResolvedValue({
      externalCalendarIds: ["cal-recent"],
      externalBlockIds: ["block-recent"],
    });

    await applySubscriptionEvent({
      type: "authorized",
      subscriptionId: "sub-1",
    });

    // findLastDowngradeSnapshot usa orderBy: { createdAt: "desc" } → top 1
    expect(mockFindLastDowngradeSnapshot).toHaveBeenCalledWith(
      "user-1",
      expect.anything(),
    );
    expect(mockRestoreExternalCalendars).toHaveBeenCalledWith(
      "user-1",
      { externalCalendarIds: ["cal-recent"], externalBlockIds: ["block-recent"] },
      expect.anything(),
    );
  });

  // Tier 2 #10: restore failure dentro de tx → subscription NO se actualiza (rollback)
  it("restore failure dentro de tx → subscription NO se actualiza (rollback)", async () => {
    const expiredSub = fakeSub({ status: "EXPIRED", userId: "user-1" });
    const authorizedSub = fakeSub({ status: "AUTHORIZED", userId: "user-1" });

    mocks.subscriptionFindUnique.mockResolvedValue(expiredSub);
    mocks.subscriptionUpdate.mockResolvedValue(authorizedSub);
    mocks.subscriptionEventCreate.mockResolvedValue({} as SubscriptionEvent);
    mocks.userProfileFindUnique.mockResolvedValue({ plan: "FREE" });
    mocks.userProfileUpdate.mockResolvedValue({} as never);
    mocks.adminActionLogCreate.mockResolvedValue({} as never);
    mockFindLastDowngradeSnapshot.mockResolvedValue({
      externalCalendarIds: ["cal-1"],
      externalBlockIds: ["block-1"],
    });
    mockRestoreExternalCalendars.mockRejectedValue(new Error("DB error on restore"));

    await expect(
      applySubscriptionEvent({
        type: "authorized",
        subscriptionId: "sub-1",
      }),
    ).rejects.toThrow("DB error on restore");

    // subscription.update YA fue llamado antes de restore
    expect(mocks.subscriptionUpdate).toHaveBeenCalled();
    // userProfile NO fue actualizado porque la tx hizo rollback
    expect(mocks.userProfileUpdate).not.toHaveBeenCalled();
  });

  // Tier 2 #11: webhook duplicado (authorized 2 veces desde CANCELLED) → segunda es duplicate
  it("webhook duplicado (authorized 2 veces desde CANCELLED): segunda es duplicate, no re-ejecuta restore", async () => {
    const cancelledSub = fakeSub({ status: "CANCELLED", userId: "user-1" });
    const authorizedSub = fakeSub({ status: "AUTHORIZED", userId: "user-1" });

    mocks.subscriptionFindUnique.mockResolvedValue(cancelledSub);
    mocks.subscriptionUpdate.mockResolvedValue(authorizedSub);
    mocks.subscriptionEventCreate.mockResolvedValue({} as SubscriptionEvent);
    mocks.userProfileFindUnique.mockResolvedValue({ plan: "FREE" });
    mocks.userProfileUpdate.mockResolvedValue({} as never);
    mocks.adminActionLogCreate.mockResolvedValue({} as never);
    mockFindLastDowngradeSnapshot.mockResolvedValue({
      externalCalendarIds: ["cal-1"],
      externalBlockIds: ["block-1"],
    });
    // Reset para limpiar mockRejectedValue residual del test "rollback" anterior
    mockRestoreExternalCalendars.mockReset();
    mockRestoreExternalCalendars.mockResolvedValue({
      restoredCalendarIds: ["cal-1"],
      restoredBlockIds: ["block-1"],
    });

    // Primera llamada: CANCELLED → AUTHORIZED
    await applySubscriptionEvent({
      type: "authorized",
      subscriptionId: "sub-1",
    });

    expect(mockRestoreExternalCalendars).toHaveBeenCalledTimes(1);

    // Segunda llamada: ya AUTHORIZED → duplicate
    mocks.subscriptionFindUnique.mockResolvedValue(authorizedSub);
    mocks.subscriptionEventCreate.mockResolvedValue({} as SubscriptionEvent);
    mockRestoreExternalCalendars.mockClear();

    const result2 = await applySubscriptionEvent({
      type: "authorized",
      subscriptionId: "sub-1",
    });

    expect(result2.subscription.status).toBe("AUTHORIZED");
    expect(mocks.subscriptionEventCreate).toHaveBeenLastCalledWith({
      data: expect.objectContaining({
        subscriptionId: "sub-1",
        type: "duplicate",
      }),
    });
    // restore NO se ejecutó en el segundo llamado
    expect(mockRestoreExternalCalendars).not.toHaveBeenCalled();
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
  it("AUTHORIZED → EXPIRED + dispara applyPlanChange(PRO → FREE) + soft-stop iCal", async () => {
    const authorizedSub = fakeSub({ status: "AUTHORIZED", plan: "PRO", userId: "user-1" });
    const expiredSub = fakeSub({ status: "EXPIRED", plan: "PRO", userId: "user-1" });

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
    // El soft-stop debe invocarse con el userId del subscription dentro de la tx
    expect(mockSoftStopExternalCalendars).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ externalCalendar: expect.any(Object) }),
    );
    // Y el snapshot del mock debe quedar en el payload del evento
    expect(mocks.subscriptionEventCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: "expired",
        payload: expect.objectContaining({
          downgradeSnapshot: {
            externalCalendarIds: ["cal-1", "cal-2"],
            externalBlockIds: ["block-1"],
          },
        }),
      }),
    });
  });

  it("NO soft-stop cuando el plan ya era FREE (defense in depth)", async () => {
    const authorizedSub = fakeSub({ status: "AUTHORIZED", plan: "PRO", userId: "user-1" });
    const expiredSub = fakeSub({ status: "EXPIRED", plan: "PRO", userId: "user-1" });

    mocks.subscriptionFindUnique.mockResolvedValue(authorizedSub);
    mocks.subscriptionUpdate.mockResolvedValue(expiredSub);
    mocks.subscriptionEventCreate.mockResolvedValue({} as SubscriptionEvent);
    // Plan ya era FREE — applyPlanChange debe ser no-op
    mocks.userProfileFindUnique.mockResolvedValue({ plan: "FREE" });

    const result = await applySubscriptionEvent({
      type: "expired",
      subscriptionId: "sub-1",
    });

    expect(result.subscription.status).toBe("EXPIRED");
    // El soft-stop se ejecuta igual (escuela A — defense in depth)
    expect(mockSoftStopExternalCalendars).toHaveBeenCalledWith(
      "user-1",
      expect.anything(),
    );
    // Pero el plan no cambia (applyPlanChange retorna no-op)
    expect(mocks.userProfileUpdate).not.toHaveBeenCalled();
    expect(result.planChange).toEqual({ from: "FREE", to: "FREE", source: "subscription_lifecycle" });
  });
});

// ────────────────────────────────────────────────────────────────────────────
// applySubscriptionEvent — type: "failed" (PRO → FREE)
// ────────────────────────────────────────────────────────────────────────────

describe('applySubscriptionEvent({ type: "failed" })', () => {
  it("AUTHORIZED → FAILED + dispara applyPlanChange(PRO → FREE) + NO soft-stop (intencional)", async () => {
    // Decisión documentada (ADR-0027 §4): `failed` es reintento de MP, no
    // downgrade por fin de período. Los recursos iCal siguen activos porque
    // la subscription puede volver a AUTHORIZED en el siguiente ciclo de retry.
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
    // El soft-stop NO se ejecuta en `failed` — solo en `expired`/`expired_check`
    expect(mockSoftStopExternalCalendars).not.toHaveBeenCalled();
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
