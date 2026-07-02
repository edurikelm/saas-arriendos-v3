/**
 * Pure helper: computes which notifications are unread for a user.
 *
 * Mirrors the pattern from src/lib/support/unread.ts.
 *
 * A notification is unread for a user if:
 * 1. The user has NOT read it (no NotificationRead row exists), OR
 * 2. The notification was created AFTER the user's lastReadAt
 */

export interface NotificationForUnread {
  id: string;
  createdAt: Date;
}

export interface LastReadEntry {
  notificationId: string;
  lastReadAt: Date;
}

/**
 * Given a list of notifications and a map of last-read timestamps per notification,
 * returns the set of notification IDs that are unread.
 */
export function computeHasUnread(
  notifications: NotificationForUnread[],
  lastReadByNotification: Map<string, LastReadEntry> | LastReadEntry[],
): Set<string> {
  const lastReadMap =
    lastReadByNotification instanceof Map
      ? lastReadByNotification
      : new Map(lastReadByNotification.map((r) => [r.notificationId, r]));

  const unread = new Set<string>();

  for (const notif of notifications) {
    const readEntry = lastReadMap.get(notif.id);

    if (!readEntry) {
      // Never read → unread
      unread.add(notif.id);
    } else if (notif.createdAt > readEntry.lastReadAt) {
      // Read before notification was created → unread
      unread.add(notif.id);
    }
  }

  return unread;
}
