/**
 * Email notification channel via Resend.
 *
 * Sends an email using the Resend API. Idempotent: skips if no API key is
 * configured (returns skipped result). The in-app row (created first by
 * InAppChannel) is updated with deliveredAt when the email is successfully sent.
 *
 * See ADR-0021 for full architecture documentation.
 */

import { Resend } from "resend";
import { prisma } from "@/lib/db/prisma";
import type {
  NotificationChannel,
  NotificationIntent,
  NotificationRecipient,
  DispatchResult,
} from "./channel";
import { renderNotification } from "./render-notification";
import type { NotificationRenderData } from "./render-notification";

export class EmailChannel implements NotificationChannel {
  readonly name = "email" as const;

  async dispatch(
    intent: NotificationIntent,
    recipient: NotificationRecipient,
  ): Promise<DispatchResult> {
    const apiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.RESEND_FROM_EMAIL;
    const fromName = process.env.RESEND_FROM_NAME ?? "RentalPro";

    // Check user email preference before any API calls
    const recipientPref = await prisma.userProfile.findUnique({
      where: { id: recipient.userId },
      select: { notificationsEmailEnabled: true },
    });
    if (recipientPref && recipientPref.notificationsEmailEnabled === false) {
      return { ok: true, skipped: "email-disabled" };
    }

    const renderData: NotificationRenderData = {
      type: intent.type,
      reservationId: intent.link?.startsWith("/reservations/") ? intent.link.split("/").pop() : undefined,
      paymentId: intent.link?.startsWith("/payments/") ? intent.link.split("/").pop() : undefined,
    };

    if (!apiKey || !fromEmail) {
      console.log(`[Notifications][email] No API key/from. Skipping. notificationKey=${intent.notificationKey} to=${recipient.email} subject="${intent.title}"`);
      return { ok: true, skipped: "no-api-key" };
    }

    const resend = new Resend(apiKey);
    const rendered = renderNotification(renderData, "email");

    try {
      const result = await resend.emails.send({
        from: `${fromName} <${fromEmail}>`,
        to: recipient.email,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
      });

      if (result.error) {
        console.error(`[Notifications][email] Resend API error. notificationKey=${intent.notificationKey}`, result.error);
        return { ok: false, error: result.error.message ?? "Resend API error" };
      }

      // Set deliveredAt on the in-app row (created by InAppChannel first)
      const existing = await prisma.notification.findUnique({
        where: { notificationKey: intent.notificationKey },
        select: { id: true, deliveredAt: true },
      });
      if (existing && !existing.deliveredAt) {
        await prisma.notification.update({
          where: { id: existing.id },
          data: { deliveredAt: new Date() },
        });
      } else if (!existing) {
        console.warn(`[Notifications][email] Notification row not found for ${intent.notificationKey}; skipping deliveredAt update`);
        return { ok: true, skipped: "no-api-key" }; // best-effort: skip silently
      }
      return { ok: true, notificationId: existing?.id ?? "", deduplicated: false };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown Resend error";
      console.error(`[Notifications][email] Send failed. notificationKey=${intent.notificationKey}`, message);
      return { ok: false, error: message };
    }
  }
}

export const emailChannel = new EmailChannel();
