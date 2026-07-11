"use server";

import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";

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
 * Marks a single notification as read for the current user (derived from session).
 * Authorization: user must own the notification or be SUPER_ADMIN.
 * Idempotent: re-calling does not duplicate.
 */
export async function markNotificationAsRead(
  notificationId: string,
): Promise<{ success: true } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "No autorizado" };

  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
    select: { userId: true },
  });

  if (!notification) return { error: "Notificación no encontrada" };

  if (notification.userId !== session.userId && session.role !== "SUPER_ADMIN") {
    return { error: "No autorizado" };
  }

  await prisma.notificationRead.upsert({
    where: { notificationId_userId: { notificationId, userId: session.userId } },
    update: { lastReadAt: new Date() },
    create: { notificationId, userId: session.userId, lastReadAt: new Date() },
  });

  revalidatePath("/", "layout");
  return { success: true };
}

/**
 * Marks all unread notifications as read for the current user (derived from session).
 * Bulk implementation: single createMany with skipDuplicates.
 */
export async function markAllNotificationsAsRead(): Promise<
  { success: true; count: number } | { error: string }
> {
  const session = await getSession();
  if (!session) return { error: "No autorizado" };

  const unread = await prisma.notification.findMany({
    where: { userId: session.userId, reads: { none: { userId: session.userId } } },
    select: { id: true },
  });

  if (unread.length === 0) {
    revalidatePath("/", "layout");
    return { success: true, count: 0 };
  }

  const now = new Date();
  await prisma.notificationRead.createMany({
    data: unread.map((n) => ({
      notificationId: n.id,
      userId: session.userId,
      lastReadAt: now,
    })),
    skipDuplicates: true,
  });

  revalidatePath("/", "layout");
  return { success: true, count: unread.length };
}

/**
 * Returns the most recent notifications for the current user.
 * Used by NotificationList (server component) to render the dropdown.
 */
export type RecentNotification = {
  id: string;
  title: string;
  body: string;
  link: string | null;
  type: string;
  createdAt: string;
  isRead: boolean;
};

export async function getRecentNotifications(limit = 10): Promise<RecentNotification[]> {
  const session = await getSession();
  if (!session) return [];

  const notifications = await prisma.notification.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      reads: {
        where: { userId: session.userId },
        select: { id: true },
      },
    },
  });

  return notifications.map((n) => ({
    id: n.id,
    title: n.title,
    body: n.body,
    link: n.link,
    type: n.type,
    createdAt: n.createdAt.toISOString(),
    isRead: n.reads.length > 0,
  }));
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

/**
 * Returns the current user's email notification preference.
 * Returns true (default safe) if no session.
 */
export async function getNotificationsEmailEnabled(): Promise<boolean> {
  const session = await getSession();
  if (!session) return true;

  const profile = await prisma.userProfile.findUnique({
    where: { id: session.userId },
    select: { notificationsEmailEnabled: true },
  });

  return profile?.notificationsEmailEnabled ?? true;
}

/**
 * Updates the current user's email notification preference.
 * Auth: session required; only own record can be updated.
 */
export async function setNotificationsEmailEnabled(
  enabled: boolean,
): Promise<{ success: true } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "No autorizado" };

  await prisma.userProfile.update({
    where: { id: session.userId },
    data: { notificationsEmailEnabled: enabled },
  });

  revalidatePath("/settings");
  return { success: true };
}

/**
 * Returns the current user's SMS notification preference.
 * Returns false (default safe) if no session.
 */
export async function getNotificationsSmsEnabled(): Promise<boolean> {
  const session = await getSession();
  if (!session) return false;

  const profile = await prisma.userProfile.findUnique({
    where: { id: session.userId },
    select: { notificationsSmsEnabled: true },
  });

  return profile?.notificationsSmsEnabled ?? false;
}

/**
 * Updates the current user's SMS notification preference.
 * Auth: session required; only own record can be updated.
 */
export async function setNotificationsSmsEnabled(
  enabled: boolean,
): Promise<{ success: true } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "No autorizado" };

  await prisma.userProfile.update({
    where: { id: session.userId },
    data: { notificationsSmsEnabled: enabled },
  });

  revalidatePath("/settings");
  return { success: true };
}
