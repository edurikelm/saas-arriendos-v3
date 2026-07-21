/**
 * Tests para subscription-events.ts — recordSubscriptionNotification.
 *
 * Patrón: mocks de canales y prisma con vi.hoisted para que vi.mock
 * pueda accederlos cuando es hoisted al top del archivo.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

// ────────────────────────────────────────────────────────────────────────────
// Mocks — dentro de vi.hoisted para acceso correcto de vi.mock
// ────────────────────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  userProfileFindUnique: vi.fn(),
  inAppDispatch: vi.fn(),
  emailDispatch: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    userProfile: {
      findUnique: mocks.userProfileFindUnique,
    },
  },
}));

vi.mock("@/lib/notifications/in-app-channel", () => ({
  inAppChannel: { dispatch: mocks.inAppDispatch },
}));

vi.mock("@/lib/notifications/email-channel", () => ({
  emailChannel: { dispatch: mocks.emailDispatch },
}));

// ────────────────────────────────────────────────────────────────────────────
// Imports — después de los mocks
// ────────────────────────────────────────────────────────────────────────────

import { recordSubscriptionNotification } from "../subscription-events";

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

const mockUser = {
  id: "user-1",
  email: "owner@test.com",
  name: "Carlos",
  plan: "PRO" as const,
  role: "OWNER" as const,
  password: "hashed",
  createdAt: new Date(),
  updatedAt: new Date(),
  status: "ACTIVE",
  notificationsEmailEnabled: true,
  timezone: "America/Santiago",
  locale: "es-CL",
};

function setupSuccessfulDispatch() {
  mocks.inAppDispatch.mockResolvedValue({
    ok: true,
    notificationId: "notif-1",
    deduplicated: false,
  });
  mocks.emailDispatch.mockResolvedValue({
    ok: true,
    notificationId: "notif-1",
    deduplicated: false,
  });
}

function setupUserFound() {
  mocks.userProfileFindUnique.mockResolvedValue(mockUser);
}

// ────────────────────────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────────────────────────

describe("recordSubscriptionNotification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  // ── Test 1: SUBSCRIPTION_ACTIVATED llama recordDomainEvent con type correcto ──
  it("SUBSCRIPTION_ACTIVATED calls inAppChannel with correct type", async () => {
    setupUserFound();
    setupSuccessfulDispatch();

    await recordSubscriptionNotification({
      userId: "user-1",
      type: "SUBSCRIPTION_ACTIVATED",
      subscriptionId: "sub-123",
    });

    expect(mocks.inAppDispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: "SUBSCRIPTION_ACTIVATED" }),
      expect.any(Object),
    );
  });

  // ── Test 2: SUBSCRIPTION_CANCELLED llama recordDomainEvent con type correcto ──
  it("SUBSCRIPTION_CANCELLED calls inAppChannel with correct type", async () => {
    setupUserFound();
    setupSuccessfulDispatch();

    await recordSubscriptionNotification({
      userId: "user-1",
      type: "SUBSCRIPTION_CANCELLED",
      subscriptionId: "sub-456",
    });

    expect(mocks.inAppDispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: "SUBSCRIPTION_CANCELLED" }),
      expect.any(Object),
    );
  });

  // ── Test 3: SUBSCRIPTION_EXPIRED llama recordDomainEvent con type correcto ──
  it("SUBSCRIPTION_EXPIRED calls inAppChannel with correct type", async () => {
    setupUserFound();
    setupSuccessfulDispatch();

    await recordSubscriptionNotification({
      userId: "user-1",
      type: "SUBSCRIPTION_EXPIRED",
      subscriptionId: "sub-789",
    });

    expect(mocks.inAppDispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: "SUBSCRIPTION_EXPIRED" }),
      expect.any(Object),
    );
  });

  // ── Test 4: notificationKey tiene formato idempotente ──
  it("notificationKey follows idempotent format ${type.toLowerCase()}:${subscriptionId}", async () => {
    setupUserFound();
    setupSuccessfulDispatch();

    await recordSubscriptionNotification({
      userId: "user-1",
      type: "SUBSCRIPTION_ACTIVATED",
      subscriptionId: "sub-abc",
    });

    expect(mocks.inAppDispatch).toHaveBeenCalledWith(
      expect.objectContaining({ notificationKey: "subscription_activated:sub-abc" }),
      expect.any(Object),
    );
  });

  // ── Test 5: cada tipo tiene título y body correctos (snapshot) ──
  it("SUBSCRIPTION_ACTIVATED has correct title and body", async () => {
    setupUserFound();
    setupSuccessfulDispatch();

    await recordSubscriptionNotification({
      userId: "user-1",
      type: "SUBSCRIPTION_ACTIVATED",
      subscriptionId: "sub-123",
    });

    const [intent] = mocks.inAppDispatch.mock.calls[0];
    expect(intent.title).toBe("Tu plan PRO está activo");
    expect(intent.body).toBe(
      "Ahora tienes acceso a iCal, documentos de reserva y propiedades ilimitadas.",
    );
  });

  it("SUBSCRIPTION_CANCELLED has correct title and body", async () => {
    setupUserFound();
    setupSuccessfulDispatch();

    await recordSubscriptionNotification({
      userId: "user-1",
      type: "SUBSCRIPTION_CANCELLED",
      subscriptionId: "sub-456",
    });

    const [intent] = mocks.inAppDispatch.mock.calls[0];
    expect(intent.title).toBe("Suscripción PRO cancelada");
    expect(intent.body).toBe(
      "Tu plan seguirá activo hasta el fin del período pagado. Después bajarás a FREE automáticamente.",
    );
  });

  it("SUBSCRIPTION_EXPIRED has correct title and body", async () => {
    setupUserFound();
    setupSuccessfulDispatch();

    await recordSubscriptionNotification({
      userId: "user-1",
      type: "SUBSCRIPTION_EXPIRED",
      subscriptionId: "sub-789",
    });

    const [intent] = mocks.inAppDispatch.mock.calls[0];
    expect(intent.title).toBe("Tu plan bajó a FREE");
    expect(intent.body).toBe(
      "Las funciones PRO (iCal, documentos, propiedades ilimitadas) ya no están disponibles.",
    );
  });

  // ── Test 6: link a /settings/billing ──
  it("link is /settings/billing", async () => {
    setupUserFound();
    setupSuccessfulDispatch();

    await recordSubscriptionNotification({
      userId: "user-1",
      type: "SUBSCRIPTION_ACTIVATED",
      subscriptionId: "sub-123",
    });

    const [intent] = mocks.inAppDispatch.mock.calls[0];
    expect(intent.link).toBe("/settings/billing");
  });

  // ── Test 7: si user no existe, no llama dispatch y no lanza ──
  it("if user not found, does not call dispatch and does not throw", async () => {
    mocks.userProfileFindUnique.mockResolvedValue(null);

    await expect(
      recordSubscriptionNotification({
        userId: "unknown-user",
        type: "SUBSCRIPTION_ACTIVATED",
        subscriptionId: "sub-123",
      }),
    ).resolves.toBeUndefined();

    expect(mocks.inAppDispatch).not.toHaveBeenCalled();
    expect(mocks.emailDispatch).not.toHaveBeenCalled();
  });

  // ── Test 8: si recordDomainEvent lanza error, el helper propaga el error ──
  it("if inAppChannel.dispatch throws, the helper propagates the error", async () => {
    setupUserFound();
    mocks.inAppDispatch.mockRejectedValue(new Error("DB error"));

    await expect(
      recordSubscriptionNotification({
        userId: "user-1",
        type: "SUBSCRIPTION_ACTIVATED",
        subscriptionId: "sub-123",
      }),
    ).rejects.toThrow("DB error");
  });
});
