/**
 * Tests para server actions de admin subscription management.
 *
 * Patrón: vi.hoisted + vi.mock para Prisma, guards, session y next/cache.
 * Espejo de src/lib/actions/__tests__/subscriptions.test.ts y admin-support.test.ts.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SessionUser } from "@/lib/auth/session";

// ────────────────────────────────────────────────────────────────────────────
// vi.hoisted — mocks elevados para estar disponibles en factories
// ────────────────────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  // Prisma
  subscriptionFindFirst: vi.fn(),
  subscriptionFindUnique: vi.fn(),
  subscriptionUpdate: vi.fn(),
  subscriptionEventCreate: vi.fn(),
  adminActionLogCreate: vi.fn(),
  userProfileFindUnique: vi.fn(),
  $transaction: vi.fn(async (cb) =>
    cb({
      subscription: {
        findUnique: mocks.subscriptionFindUnique,
        findFirst: mocks.subscriptionFindFirst,
        update: mocks.subscriptionUpdate,
      },
      subscriptionEvent: { create: mocks.subscriptionEventCreate },
      userProfile: {
        findUnique: mocks.userProfileFindUnique,
      },
      adminActionLog: { create: mocks.adminActionLogCreate },
    }),
  ),
  // Session / Guards
  requireSuperAdmin: vi.fn(),
  getSession: vi.fn(),
  getSuperAdminSession: vi.fn(),
  // next/cache
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    subscription: {
      findFirst: mocks.subscriptionFindFirst,
      findUnique: mocks.subscriptionFindFirst,
      update: mocks.subscriptionUpdate,
    },
    subscriptionEvent: {
      create: mocks.subscriptionEventCreate,
    },
    adminActionLog: {
      create: mocks.adminActionLogCreate,
    },
    userProfile: {
      findUnique: mocks.userProfileFindUnique,
    },
    $transaction: mocks.$transaction,
  },
}));

vi.mock("@/lib/auth/guards", () => ({
  requireSuperAdmin: mocks.requireSuperAdmin,
}));

vi.mock("@/lib/auth/session", () => ({
  getSession: mocks.getSession,
  getSuperAdminSession: mocks.getSuperAdminSession,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("@/lib/subscriptions/lifecycle", () => ({
  applySubscriptionEvent: vi.fn(),
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
    status: "AUTHORIZED",
    mpPreapprovalId: "mp-preapproval-123",
    mpPlanId: "mp-plan-123",
    currentPeriodStart: new Date("2026-06-01"),
    currentPeriodEnd: new Date("2026-07-01"),
    nextPaymentDate: new Date("2026-07-01"),
    amount: 9990,
    currency: "CLP",
    frequency: 1,
    frequencyType: "months",
    startedAt: new Date("2026-06-01"),
    cancelledAt: null,
    cancellationReason: null,
    createdAt: new Date("2026-06-01"),
    updatedAt: new Date("2026-06-01"),
    ...overrides,
  } as MockSub);

const adminSession: SessionUser = {
  userId: "admin-1",
  role: "SUPER_ADMIN",
  plan: null,
  email: "admin@test.com",
};

// ────────────────────────────────────────────────────────────────────────────
// Imports — después de los mocks
// ────────────────────────────────────────────────────────────────────────────

import { applySubscriptionEvent } from "@/lib/subscriptions/lifecycle";
import { adminCancelSubscription } from "../admin-subscriptions";

const mockApplySubscriptionEvent = applySubscriptionEvent as ReturnType<typeof vi.fn>;

// ────────────────────────────────────────────────────────────────────────────
// Setup
// ────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireSuperAdmin.mockResolvedValue(adminSession);
  mocks.getSession.mockResolvedValue(adminSession);
});

// ────────────────────────────────────────────────────────────────────────────
// adminCancelSubscription
// ────────────────────────────────────────────────────────────────────────────

describe("adminCancelSubscription", () => {
  // ── 1. Auth guard ─────────────────────────────────────────

  it("lanza error (redirect) cuando no es SUPER_ADMIN", async () => {
    mocks.requireSuperAdmin.mockRejectedValueOnce(new Error("Redirected to /dashboard"));

    await expect(
      adminCancelSubscription({ userId: "clxxxxxxxxxxxxxxxxxxxxxxxx", reason: "Test reason" }),
    ).rejects.toThrow("Redirected to /dashboard");
  });

  // ── 2. Carga subscription y llama applySubscriptionEvent ─

  it("carga la subscription del user y llama applySubscriptionEvent con admin_cancel", async () => {
    const authorizedSub = mockSub({ status: "AUTHORIZED" });
    mocks.subscriptionFindFirst.mockResolvedValue(authorizedSub);
    mockApplySubscriptionEvent.mockResolvedValue({
      subscription: mockSub({ status: "CANCELLED" }),
    });
    mocks.adminActionLogCreate.mockResolvedValue({});

    const result = await adminCancelSubscription({
      userId: "clxxxxxxxxxxxxxxxxxxxxxxxx",
      reason: " owner dispute",
    });

    expect(result.success).toBe(true);
    expect(result.subscriptionId).toBe("sub-1");
    expect(mockApplySubscriptionEvent).toHaveBeenCalledWith({
      type: "admin_cancel",
      subscriptionId: "sub-1",
      payload: {
        reason: "owner dispute", // trim() se aplica en el schema
        adminId: "admin-1",
      },
    });
  });

  // ── 3. Registra AdminActionLog ──────────────────────────

  it("registra AdminActionLog con action SUBSCRIPTION_CANCELLED_ADMIN", async () => {
    const authorizedSub = mockSub({ status: "AUTHORIZED" });
    mocks.subscriptionFindFirst.mockResolvedValue(authorizedSub);
    mockApplySubscriptionEvent.mockResolvedValue({
      subscription: mockSub({ status: "CANCELLED" }),
    });
    mocks.adminActionLogCreate.mockResolvedValue({});

    await adminCancelSubscription({
      userId: "clxxxxxxxxxxxxxxxxxxxxxxxx",
      reason: "Fraude detectado",
    });

    expect(mocks.adminActionLogCreate).toHaveBeenCalledWith({
      data: {
        adminId: "admin-1",
        targetId: "clxxxxxxxxxxxxxxxxxxxxxxxx",
        action: "SUBSCRIPTION_CANCELLED_ADMIN",
        details: JSON.stringify({
          subscriptionId: "sub-1",
          reason: "Fraude detectado",
          adminId: "admin-1",
        }),
      },
    });
  });

  // ── 4. Error si no hay subscription ────────────────────

  it("lanza error si el owner no tiene subscription activa", async () => {
    mocks.subscriptionFindFirst.mockResolvedValue(null);

    await expect(
      adminCancelSubscription({ userId: "clnnnnnnnnnnnnnnnnnnnnnnn", reason: "Test" }),
    ).rejects.toThrow("Este owner no tiene una suscripción activa");
  });

  // ── 5. Error si status no es AUTHORIZED ni PAUSED ─────

  it("lanza error si la subscription no está en AUTHORIZED o PAUSED", async () => {
    mocks.subscriptionFindFirst.mockResolvedValue(mockSub({ status: "EXPIRED" }));

    await expect(
      adminCancelSubscription({ userId: "clxxxxxxxxxxxxxxxxxxxxxxxx", reason: "Test" }),
    ).rejects.toThrow(/Solo se pueden cancelar suscripciones en estado AUTHORIZED o PAUSED/);
  });

  it("lanza error si la subscription está en status CANCELLED", async () => {
    mocks.subscriptionFindFirst.mockResolvedValue(mockSub({ status: "CANCELLED" }));

    await expect(
      adminCancelSubscription({ userId: "clxxxxxxxxxxxxxxxxxxxxxxxx", reason: "Test" }),
    ).rejects.toThrow(/Solo se pueden cancelar suscripciones en estado AUTHORIZED o PAUSED/);
  });

  it("permite cancelar subscription en estado PAUSED", async () => {
    const pausedSub = mockSub({ status: "PAUSED" });
    mocks.subscriptionFindFirst.mockResolvedValue(pausedSub);
    mockApplySubscriptionEvent.mockResolvedValue({
      subscription: mockSub({ status: "CANCELLED" }),
    });
    mocks.adminActionLogCreate.mockResolvedValue({});

    const result = await adminCancelSubscription({
      userId: "clxxxxxxxxxxxxxxxxxxxxxxxx",
      reason: "Owner requested",
    });

    expect(result.success).toBe(true);
    expect(mockApplySubscriptionEvent).toHaveBeenCalledWith({
      type: "admin_cancel",
      subscriptionId: "sub-1",
      payload: expect.objectContaining({ reason: "Owner requested" }),
    });
  });

  // ── 6. Validación Zod: reason vacío ───────────────────

  it("lanza error Zod si reason está vacío", async () => {
    mocks.subscriptionFindFirst.mockResolvedValue(mockSub({ status: "AUTHORIZED" }));

    await expect(
      adminCancelSubscription({ userId: "clxxxxxxxxxxxxxxxxxxxxxxxx", reason: "" }),
    ).rejects.toThrow();
  });

  it("lanza error Zod si reason solo tiene espacios", async () => {
    mocks.subscriptionFindFirst.mockResolvedValue(mockSub({ status: "AUTHORIZED" }));

    await expect(
      adminCancelSubscription({ userId: "clxxxxxxxxxxxxxxxxxxxxxxxx", reason: "   " }),
    ).rejects.toThrow();
  });

  // ── 7. Revalidación ────────────────────────────────────

  it("llama revalidatePath con la ruta del owner", async () => {
    const authorizedSub = mockSub({ status: "AUTHORIZED" });
    mocks.subscriptionFindFirst.mockResolvedValue(authorizedSub);
    mockApplySubscriptionEvent.mockResolvedValue({
      subscription: mockSub({ status: "CANCELLED" }),
    });
    mocks.adminActionLogCreate.mockResolvedValue({});

    await adminCancelSubscription({
      userId: "clxxxxxxxxxxxxxxxxxxxxxxxx",
      reason: "Test",
    });

    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/users/clxxxxxxxxxxxxxxxxxxxxxxxx");
  });
});
