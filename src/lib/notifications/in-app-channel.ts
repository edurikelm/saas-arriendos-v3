/**
 * In-app notification channel.
 *
 * Persists a Notification row. Idempotent: if notificationKey already exists,
 * returns { ok: true, notificationId, deduplicated: true } without creating
 * a duplicate (the @unique constraint on notificationKey enforces this).
 *
 * Uses findUnique+create (not upsert) to accurately report the deduplicated
 * flag. The unique constraint on notificationKey guarantees no duplicates even
 * if two concurrent dispatches race — the second create() call will throw a
 * unique-constraint error, which is caught and handled as deduplication.
 *
 * See ADR-0021 for full architecture documentation.
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

      // Create new notification. If a concurrent dispatch already created it
      // (race), the unique constraint on notificationKey will throw a
      // P2002 error — we catch it below and treat it as deduplication.
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
    } catch (err: unknown) {
      // Handle P2002 unique constraint violation (concurrent race on notificationKey)
      if (
        typeof err === "object" &&
        err !== null &&
        "code" in err &&
        (err as { code: string }).code === "P2002"
      ) {
        // Another concurrent request created this notification first.
        // Fetch it and return as deduplicated.
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
      }
      const message = err instanceof Error ? err.message : "Unknown error";
      return { ok: false, error: message };
    }
  }
}

export const inAppChannel = new InAppChannel();
