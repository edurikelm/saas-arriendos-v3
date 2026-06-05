import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SessionUser } from "@/lib/actions/auth";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    adminActionLog: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    userProfile: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/actions/auth", () => ({
  getSession: vi.fn(),
}));

const superAdminSession: SessionUser = {
  userId: "admin-1",
  role: "SUPER_ADMIN",
  plan: "PRO",
  email: "admin@test.com",
  status: "ACTIVE",
};

describe("logAdminAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("is exported from lib/actions/admin-actions", async () => {
    const { logAdminAction } = await import("@/lib/actions/admin-actions");
    expect(logAdminAction).toBeDefined();
    expect(typeof logAdminAction).toBe("function");
  });

  it("creates an AdminActionLog entry with targetId, action, and details", async () => {
    const { getSession } = await import("@/lib/actions/auth");
    const { prisma } = await import("@/lib/db/prisma");
    const { logAdminAction } = await import("@/lib/actions/admin-actions");

    vi.mocked(getSession).mockResolvedValue(superAdminSession);
    vi.mocked(prisma.userProfile.findUnique).mockResolvedValue({
      id: "admin-1",
      role: "SUPER_ADMIN",
    } as any);
    vi.mocked(prisma.adminActionLog.create).mockResolvedValue({
      id: "log-1",
      adminId: "admin-1",
      targetId: "owner-123",
      action: "PLAN_CHANGED",
      details: JSON.stringify({ before: "FREE", after: "PRO" }),
      createdAt: new Date(),
    } as any);

    await logAdminAction({
      targetId: "owner-123",
      action: "PLAN_CHANGED",
      details: { before: "FREE", after: "PRO" },
    });

    expect(prisma.adminActionLog.create).toHaveBeenCalledWith({
      data: {
        adminId: "admin-1",
        targetId: "owner-123",
        action: "PLAN_CHANGED",
        details: JSON.stringify({ before: "FREE", after: "PRO" }),
      },
    });
  });

  it("returns early if no session", async () => {
    const { getSession } = await import("@/lib/actions/auth");
    const { prisma } = await import("@/lib/db/prisma");
    const { logAdminAction } = await import("@/lib/actions/admin-actions");

    vi.mocked(getSession).mockResolvedValue(null);

    await logAdminAction({
      targetId: "owner-123",
      action: "PLAN_CHANGED",
      details: {},
    });

    expect(prisma.adminActionLog.create).not.toHaveBeenCalled();
  });

  it("handles null details gracefully", async () => {
    const { getSession } = await import("@/lib/actions/auth");
    const { prisma } = await import("@/lib/db/prisma");
    const { logAdminAction } = await import("@/lib/actions/admin-actions");

    vi.mocked(getSession).mockResolvedValue(superAdminSession);
    vi.mocked(prisma.userProfile.findUnique).mockResolvedValue({
      id: "admin-1",
      role: "SUPER_ADMIN",
    } as any);
    vi.mocked(prisma.adminActionLog.create).mockResolvedValue({
      id: "log-1",
      adminId: "admin-1",
      targetId: "owner-123",
      action: "CREATED",
      details: null,
      createdAt: new Date(),
    } as any);

    await logAdminAction({
      targetId: "owner-123",
      action: "CREATED",
    });

    expect(prisma.adminActionLog.create).toHaveBeenCalledWith({
      data: {
        adminId: "admin-1",
        targetId: "owner-123",
        action: "CREATED",
        details: null,
      },
    });
  });
});

describe("getAdminActionLogs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("is exported from lib/actions/admin-actions", async () => {
    const { getAdminActionLogs } = await import("@/lib/actions/admin-actions");
    expect(getAdminActionLogs).toBeDefined();
    expect(typeof getAdminActionLogs).toBe("function");
  });

  it("fetches logs for a given targetId", async () => {
    const { getSession } = await import("@/lib/actions/auth");
    const { prisma } = await import("@/lib/db/prisma");
    const { getAdminActionLogs } = await import("@/lib/actions/admin-actions");

    vi.mocked(getSession).mockResolvedValue(superAdminSession);
    vi.mocked(prisma.userProfile.findUnique).mockResolvedValue({
      id: "admin-1",
      role: "SUPER_ADMIN",
    } as any);

    const mockLogs = [
      {
        id: "log-1",
        adminId: "admin-1",
        targetId: "owner-123",
        action: "PLAN_CHANGED",
        details: JSON.stringify({ before: "FREE", after: "PRO" }),
        createdAt: new Date("2025-01-15"),
        admin: { id: "admin-1", name: "Admin User", email: "admin@test.com" },
      },
    ];

    vi.mocked(prisma.adminActionLog.findMany).mockResolvedValue(mockLogs as any);

    const result = await getAdminActionLogs("owner-123");

    expect(prisma.adminActionLog.findMany).toHaveBeenCalledWith({
      where: { targetId: "owner-123" },
      include: {
        admin: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    expect(result).toHaveLength(1);
    expect(result![0].action).toBe("PLAN_CHANGED");
  });

  it("returns null if not super admin", async () => {
    const { getSession } = await import("@/lib/actions/auth");
    const { prisma } = await import("@/lib/db/prisma");
    const { getAdminActionLogs } = await import("@/lib/actions/admin-actions");

    vi.mocked(getSession).mockResolvedValue({
      userId: "user-1",
      role: "OWNER",
      plan: "FREE",
      email: "owner@test.com",
      status: "ACTIVE",
    });
    vi.mocked(prisma.userProfile.findUnique).mockResolvedValue({
      id: "user-1",
      role: "OWNER",
    } as any);

    const result = await getAdminActionLogs("owner-123");

    expect(result).toBeNull();
    expect(prisma.adminActionLog.findMany).not.toHaveBeenCalled();
  });
});

describe("AdminActionLog types", () => {
  it("ActionLogEntry has required fields", async () => {
    const { getSession } = await import("@/lib/actions/auth");
    const { prisma } = await import("@/lib/db/prisma");
    const { getAdminActionLogs } = await import("@/lib/actions/admin-actions");

    vi.mocked(getSession).mockResolvedValue(superAdminSession);
    vi.mocked(prisma.userProfile.findUnique).mockResolvedValue({
      id: "admin-1",
      role: "SUPER_ADMIN",
    } as any);

    vi.mocked(prisma.adminActionLog.findMany).mockResolvedValue([
      {
        id: "log-1",
        adminId: "admin-1",
        targetId: "owner-123",
        action: "PLAN_CHANGED",
        details: JSON.stringify({ before: "FREE", after: "PRO" }),
        createdAt: new Date("2025-01-15"),
        admin: { id: "admin-1", name: "Admin User", email: "admin@test.com" },
      },
    ] as any);

    const result = await getAdminActionLogs("owner-123");

    expect(result).toBeDefined();
    expect(result).toHaveLength(1);
    const log = result![0];
    expect(log.id).toBeDefined();
    expect(log.action).toBeDefined();
    expect(log.createdAt).toBeDefined();
    expect(log.admin).toBeDefined();
    expect(log.admin.name).toBe("Admin User");
  });
});
