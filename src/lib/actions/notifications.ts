"use server";

import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/actions/auth";

/**
 * Returns the count of unread notifications for the current user.
 * A notification is unread if there is no NotificationRead row for it.
 */
export async function getUnreadNotificationCount(userId: string): Promise<number> {
  const count = await prisma.notification.count({
    where: {
      userId,
      reads: {
        none: { userId },
      },
    },
  });
  return count;
}

/**
 * Marks a single notification as read for the current user.
 * Authorization: user must own the notification or be SUPER_ADMIN.
 */
export async function markNotificationAsRead(
  notificationId: string,
  userId: string,
): Promise<{ success: true } | { error: string }> {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
    select: { userId: true },
  });

  if (!notification) {
    return { error: "Notificación no encontrada" };
  }

  if (notification.userId !== userId) {
    const session = await getSession();
    if (!session || session.role !== "SUPER_ADMIN") {
      return { error: "No autorizado" };
    }
  }

  await prisma.notificationRead.upsert({
    where: {
      notificationId_userId: { notificationId, userId },
    },
    update: { lastReadAt: new Date() },
    create: { notificationId, userId, lastReadAt: new Date() },
  });

  return { success: true };
}

/**
 * Marks all unread notifications as read for the current user.
 */
export async function markAllNotificationsAsRead(
  userId: string,
): Promise<{ success: true } | { error: string }> {
  const unreadNotifications = await prisma.notification.findMany({
    where: {
      userId,
      reads: { none: { userId } },
    },
    select: { id: true },
  });

  const now = new Date();

  await Promise.all(
    unreadNotifications.map((n) =>
      prisma.notificationRead.upsert({
        where: { notificationId_userId: { notificationId: n.id, userId } },
        update: { lastReadAt: now },
        create: { notificationId: n.id, userId, lastReadAt: now },
      }),
    ),
  );

  return { success: true };
}

/**
 * Creates a test notification for manual testing.
 * Only accessible by SUPER_ADMIN.
 */
export async function createTestNotification(): Promise<
  | { success: true; notification: { id: string; title: string; notificationKey: string } }
  | { error: string }
> {
  const session = await getSession();
  if (!session || session.role !== "SUPER_ADMIN") {
    return { error: "No autorizado" };
  }

  const notification = await prisma.notification.create({
    data: {
      notificationKey: `test:dev:${Date.now()}`,
      userId: session.userId,
      type: "RESERVATION_CREATED",
      title: "Notificación de prueba",
      body: "Esta es una notificación de prueba creada manualmente.",
    },
    select: { id: true, title: true, notificationKey: true },
  });

  return { success: true, notification };
}
