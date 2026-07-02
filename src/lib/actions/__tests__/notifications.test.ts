import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SessionUser } from "@/lib/actions/auth";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    notification: {
      count: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    notificationRead: {
      upsert: vi.fn(),
    },
  },
}));

vi.mock("@/lib/actions/auth", () => ({
  getSession: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const ownerSession: SessionUser = {
  userId: "owner-1",
  role: "OWNER",
  plan: "FREE",
  email: "owner@test.com",
};

const adminSession: SessionUser = {
  userId: "admin-1",
  role: "SUPER_ADMIN",
  plan: "FREE",
  email: "admin@test.com",
};

describe("getUnreadNotificationCount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the count of unread notifications for the given user", async () => {
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(prisma.notification.count).mockResolvedValue(3);

    const { getUnreadNotificationCount } = await import("../notifications");
    const result = await getUnreadNotificationCount("owner-1");

    expect(result).toBe(3);
    expect(prisma.notification.count).toHaveBeenCalledWith({
      where: {
        userId: "owner-1",
        reads: { none: { userId: "owner-1" } },
      },
    });
  });

  it("returns 0 when user has no unread notifications", async () => {
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(prisma.notification.count).mockResolvedValue(0);

    const { getUnreadNotificationCount } = await import("../notifications");
    const result = await getUnreadNotificationCount("owner-1");

    expect(result).toBe(0);
  });
});

describe("markNotificationAsRead", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("upserts a NotificationRead record for the notification owner", async () => {
    const { getSession } = await import("@/lib/actions/auth");
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(getSession).mockResolvedValue(ownerSession);
    vi.mocked(prisma.notification.findUnique).mockResolvedValue({
      userId: "owner-1",
    } as any);
    vi.mocked(prisma.notificationRead.upsert).mockResolvedValue({
      id: "read-1",
      notificationId: "notif-1",
      userId: "owner-1",
      lastReadAt: new Date(),
    } as any);

    const { markNotificationAsRead } = await import("../notifications");
    const result = await markNotificationAsRead("notif-1", "owner-1");

    expect(result).toEqual({ success: true });
    expect(prisma.notificationRead.upsert).toHaveBeenCalledWith({
      where: { notificationId_userId: { notificationId: "notif-1", userId: "owner-1" } },
      update: { lastReadAt: expect.any(Date) },
      create: { notificationId: "notif-1", userId: "owner-1", lastReadAt: expect.any(Date) },
    });
  });

  it("allows SUPER_ADMIN to mark any notification as read", async () => {
    const { getSession } = await import("@/lib/actions/auth");
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(getSession).mockResolvedValue(adminSession);
    vi.mocked(prisma.notification.findUnique).mockResolvedValue({
      userId: "owner-1",
    } as any);
    vi.mocked(prisma.notificationRead.upsert).mockResolvedValue({
      id: "read-1",
      notificationId: "notif-1",
      userId: "admin-1",
      lastReadAt: new Date(),
    } as any);

    const { markNotificationAsRead } = await import("../notifications");
    const result = await markNotificationAsRead("notif-1", "admin-1");

    expect(result).toEqual({ success: true });
    expect(prisma.notificationRead.upsert).toHaveBeenCalled();
  });

  it("returns error when notification does not exist", async () => {
    const { getSession } = await import("@/lib/actions/auth");
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(getSession).mockResolvedValue(ownerSession);
    vi.mocked(prisma.notification.findUnique).mockResolvedValue(null);

    const { markNotificationAsRead } = await import("../notifications");
    const result = await markNotificationAsRead("notif-999", "owner-1");

    expect(result).toEqual({ error: "Notificación no encontrada" });
    expect(prisma.notificationRead.upsert).not.toHaveBeenCalled();
  });

  it("returns error when user does not own notification and is not admin", async () => {
    const { getSession } = await import("@/lib/actions/auth");
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(getSession).mockResolvedValue(ownerSession);
    vi.mocked(prisma.notification.findUnique).mockResolvedValue({
      userId: "other-owner",
    } as any);

    const { markNotificationAsRead } = await import("../notifications");
    const result = await markNotificationAsRead("notif-1", "owner-1");

    expect(result).toEqual({ error: "No autorizado" });
    expect(prisma.notificationRead.upsert).not.toHaveBeenCalled();
  });
});

describe("markAllNotificationsAsRead", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("upserts NotificationRead for all unread notifications", async () => {
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(prisma.notification.findMany).mockResolvedValue([
      { id: "notif-1" } as any,
      { id: "notif-2" } as any,
    ]);
    vi.mocked(prisma.notificationRead.upsert).mockResolvedValue({
      id: "read-1",
      notificationId: "notif-1",
      userId: "owner-1",
      lastReadAt: new Date(),
    } as any);

    const { markAllNotificationsAsRead } = await import("../notifications");
    const result = await markAllNotificationsAsRead("owner-1");

    expect(result).toEqual({ success: true });
    expect(prisma.notification.findMany).toHaveBeenCalledWith({
      where: { userId: "owner-1", reads: { none: { userId: "owner-1" } } },
      select: { id: true },
    });
    expect(prisma.notificationRead.upsert).toHaveBeenCalledTimes(2);
  });

  it("returns success when user has no unread notifications", async () => {
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(prisma.notification.findMany).mockResolvedValue([]);

    const { markAllNotificationsAsRead } = await import("../notifications");
    const result = await markAllNotificationsAsRead("owner-1");

    expect(result).toEqual({ success: true });
    expect(prisma.notificationRead.upsert).not.toHaveBeenCalled();
  });
});

describe("createTestNotification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a test notification for SUPER_ADMIN", async () => {
    const { getSession } = await import("@/lib/actions/auth");
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(getSession).mockResolvedValue(adminSession);
    vi.mocked(prisma.notification.create).mockResolvedValue({
      id: "notif-test-1",
      title: "Notificación de prueba",
      notificationKey: "test:dev:12345",
    } as any);

    const { createTestNotification } = await import("../notifications");
    const result = await createTestNotification();

    expect(result).toEqual({
      success: true,
      notification: {
        id: "notif-test-1",
        title: "Notificación de prueba",
        notificationKey: "test:dev:12345",
      },
    });
    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "admin-1",
          type: "RESERVATION_CREATED",
          title: "Notificación de prueba",
        }),
      }),
    );
  });

  it("returns error when user is not SUPER_ADMIN", async () => {
    const { getSession } = await import("@/lib/actions/auth");
    vi.mocked(getSession).mockResolvedValue(ownerSession);

    const { createTestNotification } = await import("../notifications");
    const result = await createTestNotification();

    expect(result).toEqual({ error: "No autorizado" });
  });

  it("returns error when user has no session", async () => {
    const { getSession } = await import("@/lib/actions/auth");
    vi.mocked(getSession).mockResolvedValue(null);

    const { createTestNotification } = await import("../notifications");
    const result = await createTestNotification();

    expect(result).toEqual({ error: "No autorizado" });
  });
});
