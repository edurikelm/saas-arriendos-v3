/**
 * Tests para subscription-downgrade.ts — softStopExternalCalendars y su
 * integración en applySubscriptionEvent.
 *
 * Patrón: TODOS los mocks dentro de UN vi.hoisted para que vi.mock pueda
 * accederlos cuando es hoisted al top del archivo.
 * Este es el mismo patrón que lifecycle.test.ts.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Subscription, SubscriptionEvent } from "@prisma/client";
import type { DowngradeSnapshot } from "../subscription-downgrade";

// ────────────────────────────────────────────────────────────────────────────
// Mocks — TODOS dentro de un solo vi.hoisted
// ────────────────────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => {
  // Crear los vi.fn() primero
  const subscriptionFindUnique = vi.fn<() => Promise<Subscription | null>>();
  const subscriptionUpdate = vi.fn<() => Promise<Subscription>>();
  const subscriptionEventCreate = vi.fn<() => Promise<SubscriptionEvent>>();
  const userProfileFindUnique = vi.fn<() => Promise<{ plan: string | null } | null>>();
  const userProfileUpdate = vi.fn<() => Promise<never>>();
  const adminActionLogCreate = vi.fn<() => Promise<never>>();
  const recordSubscriptionNotification = vi.fn<() => Promise<void>>();
  const externalCalendarUpdateManyAndReturn = vi.fn(() => Promise.resolve([]));
  const externalChannelBlockUpdateManyAndReturn = vi.fn(() => Promise.resolve([]));

  // $transaction comparte las mismas referencias de mocks
  const $transaction = vi.fn().mockImplementation(
    async (cb: (tx: Record<string, Record<string, unknown>>) => Promise<unknown>) =>
      cb({
        subscription: {
          findUnique: subscriptionFindUnique,
          update: subscriptionUpdate,
        },
        subscriptionEvent: { create: subscriptionEventCreate },
        userProfile: {
          findUnique: userProfileFindUnique,
          update: userProfileUpdate,
        },
        adminActionLog: { create: adminActionLogCreate },
        externalCalendar: {
          updateManyAndReturn: externalCalendarUpdateManyAndReturn,
        },
        externalChannelBlock: {
          updateManyAndReturn: externalChannelBlockUpdateManyAndReturn,
        },
      }),
  );

  return {
    subscriptionFindUnique,
    subscriptionUpdate,
    subscriptionEventCreate,
    userProfileFindUnique,
    userProfileUpdate,
    adminActionLogCreate,
    recordSubscriptionNotification,
    externalCalendarUpdateManyAndReturn,
    externalChannelBlockUpdateManyAndReturn,
    $transaction,
  };
});

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    subscription: {
      findUnique: mocks.subscriptionFindUnique,
      update: mocks.subscriptionUpdate,
    },
    subscriptionEvent: { create: mocks.subscriptionEventCreate },
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
    $transaction: mocks.$transaction,
  },
}));

vi.mock("@/lib/notifications/subscription-events", () => ({
  recordSubscriptionNotification: mocks.recordSubscriptionNotification,
}));

// ────────────────────────────────────────────────────────────────────────────
// Imports — DESPUÉS de los mocks
// ────────────────────────────────────────────────────────────────────────────

import { softStopExternalCalendars } from "../subscription-downgrade";
import { applySubscriptionEvent } from "../lifecycle";

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
  mocks.recordSubscriptionNotification.mockResolvedValue(undefined);
  mocks.externalCalendarUpdateManyAndReturn.mockReset();
  mocks.externalChannelBlockUpdateManyAndReturn.mockReset();
});

// ────────────────────────────────────────────────────────────────────────────
// softStopExternalCalendars — unit tests (con adapter fake)
// ────────────────────────────────────────────────────────────────────────────

describe("softStopExternalCalendars", () => {
  // Tier 1 #1: softStopExternalCalendars con adapter fake retorna snapshot correcto
  it("con adapter fake: retorna snapshot correcto con los IDs afectados", async () => {
    const fakeAdapter = {
      externalCalendar: {
        updateManyAndReturn: vi.fn().mockResolvedValue([
          { id: "cal-1" },
          { id: "cal-2" },
        ]),
      },
      externalChannelBlock: {
        updateManyAndReturn: vi.fn().mockResolvedValue([{ id: "block-1" }]),
      },
    };

    const snapshot = await softStopExternalCalendars(
      "user-1",
      fakeAdapter as unknown as Parameters<typeof softStopExternalCalendars>[1],
    );

    expect(snapshot.externalCalendarIds).toEqual(["cal-1", "cal-2"]);
    expect(snapshot.externalBlockIds).toEqual(["block-1"]);
    expect(
      (
        fakeAdapter.externalCalendar.updateManyAndReturn as ReturnType<typeof vi.fn>
      ).mock.calls[0],
    ).toMatchObject([
      {
        where: { userId: "user-1", isActive: true },
        data: { isActive: false },
        select: { id: true },
      },
    ]);
    expect(
      (
        fakeAdapter.externalChannelBlock.updateManyAndReturn as ReturnType<typeof vi.fn>
      ).mock.calls[0],
    ).toMatchObject([
      {
        where: { status: "ACTIVE", property: { userId: "user-1" } },
        data: { status: "INACTIVE" },
        select: { id: true },
      },
    ]);
  });

  // Tier 1 #2: no abre $transaction propia con adapter mockeado
  it("con adapter mockeado: no abre $transaction propia", async () => {
    const fakeAdapter = {
      externalCalendar: {
        updateManyAndReturn: vi.fn().mockResolvedValue([]),
      },
      externalChannelBlock: {
        updateManyAndReturn: vi.fn().mockResolvedValue([]),
      },
    };

    // El adapter NO tiene $transaction
    await softStopExternalCalendars(
      "user-1",
      fakeAdapter as unknown as Parameters<typeof softStopExternalCalendars>[1],
    );

    expect(
      (
        fakeAdapter.externalCalendar.updateManyAndReturn as ReturnType<typeof vi.fn>
      ).mock.calls.length,
    ).toBeGreaterThanOrEqual(1);
    expect(
      (
        fakeAdapter.externalChannelBlock.updateManyAndReturn as ReturnType<typeof vi.fn>
      ).mock.calls.length,
    ).toBeGreaterThanOrEqual(1);
  });

  // Tier 2 #8: owner sin calendarios → snapshot vacío
  it("owner sin calendarios ni bloques: snapshot es { externalCalendarIds: [], externalBlockIds: [] }", async () => {
    const fakeAdapter = {
      externalCalendar: {
        updateManyAndReturn: vi.fn().mockResolvedValue([]),
      },
      externalChannelBlock: {
        updateManyAndReturn: vi.fn().mockResolvedValue([]),
      },
    };

    const snapshot = await softStopExternalCalendars(
      "user-no-resources",
      fakeAdapter as unknown as Parameters<typeof softStopExternalCalendars>[1],
    );

    expect(snapshot.externalCalendarIds).toEqual([]);
    expect(snapshot.externalBlockIds).toEqual([]);
  });

  // Tier 2: idempotencia — segundo llamado no rompe
  it("idempotente: segundo llamado con recursos ya inactivos retorna snapshot vacío", async () => {
    const fakeAdapter = {
      externalCalendar: {
        updateManyAndReturn: vi
          .fn()
          .mockResolvedValueOnce([{ id: "cal-1" }])
          .mockResolvedValueOnce([]),
      },
      externalChannelBlock: {
        updateManyAndReturn: vi
          .fn()
          .mockResolvedValueOnce([{ id: "block-1" }])
          .mockResolvedValueOnce([]),
      },
    };

    const snap1 = await softStopExternalCalendars(
      "user-1",
      fakeAdapter as unknown as Parameters<typeof softStopExternalCalendars>[1],
    );
    expect(snap1.externalCalendarIds).toEqual(["cal-1"]);
    expect(snap1.externalBlockIds).toEqual(["block-1"]);

    const snap2 = await softStopExternalCalendars(
      "user-1",
      fakeAdapter as unknown as Parameters<typeof softStopExternalCalendars>[1],
    );
    expect(snap2.externalCalendarIds).toEqual([]);
    expect(snap2.externalBlockIds).toEqual([]);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// applySubscriptionEvent({ type: "expired" }) — integration tests
// ────────────────────────────────────────────────────────────────────────────

describe('applySubscriptionEvent({ type: "expired" })', () => {
  // Tier 1 #4: rollback — throw en softStopExternalCalendars → userProfile.update NO se llama
  // La integración completa con applySubscriptionEvent está cubierta en lifecycle.test.ts.
  // Aquí solo verificamos que el rechazo de softStopExternalCalendars se propaga correctamente.
  it("rollback: throw en softStopExternalCalendars → userProfile.update NO se llama", async () => {
    const authorizedSub = fakeSub({ status: "AUTHORIZED", plan: "PRO" });

    mocks.subscriptionFindUnique.mockResolvedValue(authorizedSub);
    mocks.subscriptionUpdate.mockResolvedValue(authorizedSub);
    mocks.subscriptionEventCreate.mockResolvedValue({} as SubscriptionEvent);
    mocks.externalCalendarUpdateManyAndReturn.mockRejectedValue(
      new Error("DB error on calendars"),
    );

    await expect(
      applySubscriptionEvent({ type: "expired", subscriptionId: "sub-1" }),
    ).rejects.toThrow("DB error on calendars");

    // subscription.update YA fue llamado antes de softStopExternalCalendars
    expect(mocks.subscriptionUpdate).toHaveBeenCalled();
    // userProfile NO fue actualizado porque la tx hizo rollback
    expect(mocks.userProfileUpdate).not.toHaveBeenCalled();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// applySubscriptionEvent — idempotencia y tipos restantes
// ────────────────────────────────────────────────────────────────────────────

describe("applySubscriptionEvent idempotencia", () => {
  // Tier 2 #6: idempotencia — segundo expired es duplicate, no ejecuta soft-stop
  it("segundo expired es duplicate, no ejecuta soft-stop ni snapshot nuevo", async () => {
    const authorizedSub = fakeSub({ status: "AUTHORIZED", plan: "PRO" });
    const expiredSub = fakeSub({ status: "EXPIRED", plan: "PRO" });

    mocks.subscriptionFindUnique.mockResolvedValue(authorizedSub);
    mocks.subscriptionUpdate.mockResolvedValue(expiredSub);
    mocks.subscriptionEventCreate.mockResolvedValue({} as SubscriptionEvent);
    mocks.userProfileFindUnique.mockResolvedValue({ plan: "PRO" });
    mocks.userProfileUpdate.mockResolvedValue({} as never);
    mocks.adminActionLogCreate.mockResolvedValue({} as never);
    mocks.externalCalendarUpdateManyAndReturn.mockResolvedValue([{ id: "cal-1" }] as never);
    mocks.externalChannelBlockUpdateManyAndReturn.mockResolvedValue([] as never);

    await applySubscriptionEvent({ type: "expired", subscriptionId: "sub-1" });

    // Segunda llamada: ya EXPIRED → duplicate
    mocks.subscriptionFindUnique.mockResolvedValue(expiredSub);
    mocks.subscriptionEventCreate.mockResolvedValue({} as SubscriptionEvent);
    mocks.externalCalendarUpdateManyAndReturn.mockClear();
    mocks.externalChannelBlockUpdateManyAndReturn.mockClear();

    const result2 = await applySubscriptionEvent({
      type: "expired",
      subscriptionId: "sub-1",
    });

    expect(result2.subscription.status).toBe("EXPIRED");
    // El evento creado es "duplicate", no "expired"
    expect(mocks.subscriptionEventCreate).toHaveBeenLastCalledWith({
      data: expect.objectContaining({
        subscriptionId: "sub-1",
        type: "duplicate",
      }),
    });
    // soft-stop NO se ejecutó en el segundo llamado
    expect(mocks.externalCalendarUpdateManyAndReturn).not.toHaveBeenCalled();
  });

  // Tier 2 #9: cancelled NO ejecuta soft-stop
  it("cancelled: NO ejecuta soft-stop (snapshot ausente en payload)", async () => {
    const authorizedSub = fakeSub({ status: "AUTHORIZED", plan: "PRO" });
    const cancelledSub = fakeSub({ status: "CANCELLED", plan: "PRO" });

    mocks.subscriptionFindUnique.mockResolvedValue(authorizedSub);
    mocks.subscriptionUpdate.mockResolvedValue(cancelledSub);
    mocks.subscriptionEventCreate.mockResolvedValue({} as SubscriptionEvent);
    mocks.externalCalendarUpdateManyAndReturn.mockResolvedValue([{ id: "cal-1" }] as never);
    mocks.externalChannelBlockUpdateManyAndReturn.mockResolvedValue([] as never);

    await applySubscriptionEvent({ type: "cancelled", subscriptionId: "sub-1" });

    // soft-stop NO fue llamado
    expect(mocks.externalCalendarUpdateManyAndReturn).not.toHaveBeenCalled();

    // El payload del evento NO contiene downgradeSnapshot
    expect(mocks.subscriptionEventCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: "cancelled",
        payload: expect.not.objectContaining({
          downgradeSnapshot: expect.anything(),
        }),
      }),
    });
  });

  // Tier 2 #10: authorized NO ejecuta soft-stop
  it("authorized: NO ejecuta soft-stop", async () => {
    const pendingSub = fakeSub({ status: "PENDING", plan: "PRO" });
    const authorizedSub = fakeSub({ status: "AUTHORIZED", plan: "PRO" });

    mocks.subscriptionFindUnique.mockResolvedValue(pendingSub);
    mocks.subscriptionUpdate.mockResolvedValue(authorizedSub);
    mocks.subscriptionEventCreate.mockResolvedValue({} as SubscriptionEvent);
    mocks.userProfileFindUnique.mockResolvedValue({ plan: "FREE" });
    mocks.userProfileUpdate.mockResolvedValue({} as never);
    mocks.adminActionLogCreate.mockResolvedValue({} as never);
    mocks.externalCalendarUpdateManyAndReturn.mockResolvedValue([{ id: "cal-1" }] as never);
    mocks.externalChannelBlockUpdateManyAndReturn.mockResolvedValue([] as never);

    await applySubscriptionEvent({ type: "authorized", subscriptionId: "sub-1" });

    // soft-stop NO fue llamado para authorized
    expect(mocks.externalCalendarUpdateManyAndReturn).not.toHaveBeenCalled();

    // El payload del evento NO contiene downgradeSnapshot
    expect(mocks.subscriptionEventCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: "authorized",
        payload: expect.not.objectContaining({
          downgradeSnapshot: expect.anything(),
        }),
      }),
    });
  });

  // Tier 2 #11: renewed NO ejecuta soft-stop
  it("renewed: NO ejecuta soft-stop", async () => {
    const authorizedSub = fakeSub({ status: "AUTHORIZED", plan: "PRO" });

    mocks.subscriptionFindUnique.mockResolvedValue(authorizedSub);
    mocks.subscriptionUpdate.mockResolvedValue(authorizedSub);
    mocks.subscriptionEventCreate.mockResolvedValue({} as SubscriptionEvent);
    mocks.externalCalendarUpdateManyAndReturn.mockResolvedValue([{ id: "cal-1" }] as never);
    mocks.externalChannelBlockUpdateManyAndReturn.mockResolvedValue([] as never);

    await applySubscriptionEvent({
      type: "renewed",
      subscriptionId: "sub-1",
      payload: { startDate: "2025-02-01", endDate: "2025-03-01" },
    });

    expect(mocks.externalCalendarUpdateManyAndReturn).not.toHaveBeenCalled();

    expect(mocks.subscriptionEventCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: "renewed",
        payload: expect.not.objectContaining({
          downgradeSnapshot: expect.anything(),
        }),
      }),
    });
  });
});
