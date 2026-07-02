/**
 * In-app notification channel.
 *
 * Persists a Notification row. Idempotent: if notificationKey already exists,
 * returns { ok: true, notificationId, deduplicated: true } without creating
 * a duplicate (the @unique constraint on notificationKey enforces this).
 */

import { prisma } from "@/lib/db/prisma";
import type {
  NotificationChannel,
  NotificationIntent,
  NotificationRecipient,
  DispatchResult,
} from "./channel";

export class InAppChannel implements NotificationChannel {
  readonly name = "in-app" as const;

  async dispatch(
    intent: NotificationIntent,
    _recipient: NotificationRecipient,
  ): Promise<DispatchResult> {
    try {
      // Check for existing notification with this key (dedup)
      const existing = await prisma.notification.findUnique({
        where: { notificationKey: intent.notificationKey },
      });

      if (existing) {
        return {
          ok: true,
          notificationId: existing.id,
          deduplicated: true,
        };
      }

      // Create new notification
      const notification = await prisma.notification.create({
        data: {
          notificationKey: intent.notificationKey,
          userId: intent.userId,
          type: intent.type,
          title: intent.title,
          body: intent.body,
          link: intent.link ?? null,
        },
      });

      return {
        ok: true,
        notificationId: notification.id,
        deduplicated: false,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return { ok: false, error: message };
    }
  }
}

export const inAppChannel = new InAppChannel();
