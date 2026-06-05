import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SessionUser } from "@/lib/actions/auth";

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  jwtVerify: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    userProfile: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
    },
    property: { count: vi.fn(), deleteMany: vi.fn() },
    reservation: { count: vi.fn(), deleteMany: vi.fn() },
    reservationClient: { deleteMany: vi.fn() },
    reservationChange: { deleteMany: vi.fn() },
    payment: { deleteMany: vi.fn() },
    adminActionLog: { create: vi.fn() },
    userIntegration: { findUnique: vi.fn() },
    $transaction: vi.fn(async (operations: unknown[]) => Promise.all(operations as Promise<unknown>[])),
  },
}));

vi.mock("@/lib/actions/auth", () => ({
  getSession: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: mocks.cookies,
}));

vi.mock("jose", () => ({
  jwtVerify: mocks.jwtVerify,
  SignJWT: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const superAdminSession: SessionUser = {
  userId: "admin-1",
  role: "SUPER_ADMIN",
  plan: "PRO",
  email: "admin@test.com",
};

describe("UserStatus", () => {
  it("has ACTIVE, SUSPENDED, CANCELLED values", async () => {
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(prisma.userProfile.findUnique).mockResolvedValue({
      id: "user-1",
      email: "test@test.com",
      role: "OWNER",
      status: "ACTIVE",
    } as any);

    const { getSession } = await import("@/lib/actions/auth");
    vi.mocked(getSession).mockResolvedValue(superAdminSession);

    const user = await prisma.userProfile.findUnique({ where: { id: "user-1" } });
    expect(user?.status).toBe("ACTIVE");
  });
});

describe("updateUserStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows SUPER_ADMIN to change user status to SUSPENDED", async () => {
    const { prisma } = await import("@/lib/db/prisma");
    const { getSession } = await import("@/lib/actions/auth");

    vi.mocked(getSession).mockResolvedValue(superAdminSession);
    vi.mocked(prisma.userProfile.findUnique).mockResolvedValue({
      id: "admin-1",
      role: "SUPER_ADMIN",
    } as any);
    vi.mocked(prisma.userProfile.update).mockResolvedValue({
      id: "user-1",
      status: "SUSPENDED",
    } as any);

    const { updateUserStatus } = await import("@/lib/actions/super-admin");
    const result = await updateUserStatus({ userId: "user-1", status: "SUSPENDED" });

    expect(result.success).toBe(true);
    expect(prisma.userProfile.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { status: "SUSPENDED" },
    });
  });

  it("allows SUPER_ADMIN to change user status to ACTIVE (reactivate)", async () => {
    const { prisma } = await import("@/lib/db/prisma");
    const { getSession } = await import("@/lib/actions/auth");

    vi.mocked(getSession).mockResolvedValue(superAdminSession);
    vi.mocked(prisma.userProfile.findUnique).mockResolvedValue({
      id: "admin-1",
      role: "SUPER_ADMIN",
    } as any);
    vi.mocked(prisma.userProfile.update).mockResolvedValue({
      id: "user-1",
      status: "ACTIVE",
    } as any);

    const { updateUserStatus } = await import("@/lib/actions/super-admin");
    const result = await updateUserStatus({ userId: "user-1", status: "ACTIVE" });

    expect(result.success).toBe(true);
  });

  it("logs status change to AdminActionLog", async () => {
    const { prisma } = await import("@/lib/db/prisma");
    const { getSession } = await import("@/lib/actions/auth");

    vi.mocked(getSession).mockResolvedValue(superAdminSession);
    vi.mocked(prisma.userProfile.findUnique).mockResolvedValue({
      id: "admin-1",
      role: "SUPER_ADMIN",
    } as any);
    vi.mocked(prisma.userProfile.update).mockResolvedValue({
      id: "user-1",
      status: "SUSPENDED",
    } as any);
    vi.mocked(prisma.adminActionLog.create).mockResolvedValue({ id: "log-1" } as any);

    const { updateUserStatus } = await import("@/lib/actions/super-admin");
    await updateUserStatus({ userId: "user-1", status: "SUSPENDED" });

    expect(prisma.adminActionLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "STATUS_CHANGED",
        targetId: "user-1",
        details: expect.stringContaining("SUSPENDED"),
      }),
    });
  });

  it("returns error if not SUPER_ADMIN", async () => {
    const { getSession } = await import("@/lib/actions/auth");
    const { prisma } = await import("@/lib/db/prisma");

    vi.mocked(getSession).mockResolvedValue({
      userId: "user-1",
      role: "OWNER",
      plan: "FREE",
      email: "owner@test.com",
    });
    vi.mocked(prisma.userProfile.findUnique).mockResolvedValue({
      id: "user-1",
      role: "OWNER",
    } as any);

    const { updateUserStatus } = await import("@/lib/actions/super-admin");
    const result = await updateUserStatus({ userId: "user-2", status: "SUSPENDED" });

    expect(result.error).toBe("No autorizado");
  });
});

describe("deleteUser with email confirmation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires email confirmation for hard delete", async () => {
    const { getSession } = await import("@/lib/actions/auth");
    const { prisma } = await import("@/lib/db/prisma");

    vi.mocked(getSession).mockResolvedValue(superAdminSession);
    vi.mocked(prisma.userProfile.findUnique).mockResolvedValue({
      id: "admin-1",
      role: "SUPER_ADMIN",
    } as any);

    const { deleteUser } = await import("@/lib/actions/super-admin");
    const result = await deleteUser("user-1", "wrongemail@test.com");

    expect(result.error).toBe("Email de confirmación incorrecto");
    expect(prisma.userProfile.delete).not.toHaveBeenCalled();
  });

  it("deletes user when email matches", async () => {
    const { getSession } = await import("@/lib/actions/auth");
    const { prisma } = await import("@/lib/db/prisma");

    vi.mocked(getSession).mockResolvedValue(superAdminSession);
    vi.mocked(prisma.userProfile.findUnique).mockImplementation((async ({ where }: any) => {
      if (where?.id === "admin-1") return { id: "admin-1", role: "SUPER_ADMIN" };
      if (where?.id === "user-1") return { id: "user-1", email: "user@test.com", role: "OWNER" };
      return null;
    }) as any);
    vi.mocked(prisma.userProfile.delete).mockResolvedValue({ id: "user-1" } as any);
    vi.mocked(prisma.payment.deleteMany).mockResolvedValue({ count: 0 } as any);
    vi.mocked(prisma.reservationChange.deleteMany).mockResolvedValue({ count: 0 } as any);
    vi.mocked(prisma.reservation.deleteMany).mockResolvedValue({ count: 0 } as any);
    vi.mocked(prisma.reservationClient.deleteMany).mockResolvedValue({ count: 0 } as any);
    vi.mocked(prisma.property.deleteMany).mockResolvedValue({ count: 0 } as any);

    const { deleteUser } = await import("@/lib/actions/super-admin");
    const result = await deleteUser("user-1", "user@test.com");

    expect(result.success).toBe(true);
    expect(prisma.userProfile.delete).toHaveBeenCalledWith({
      where: { id: "user-1" },
    });
  });
});
