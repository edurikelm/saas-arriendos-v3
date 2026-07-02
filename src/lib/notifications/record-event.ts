/**
 * Domain event recorder.
 *
 * Fires domain events to both InApp and Email channels sequentially
 * (InApp first, then Email) so that the in-app row is created before
 * EmailChannel tries to update its deliveredAt timestamp.
 *
 * Notifications are best-effort: failures are logged but never throw.
 * This ensures the caller (e.g. createReservation) always succeeds.
 *
 * See ADR-0021 §4 for error-handling policy.
 */

import { inAppChannel } from "./in-app-channel";
import { emailChannel } from "./email-channel";
import { renderNotification } from "./render-notification";
import type { NotificationRenderData } from "./render-notification";

export type DomainEvent =
  | {
      type: "RESERVATION_CREATED";
      reservationId: string;
      ownerId: string;
      ownerEmail: string;
      ownerName?: string;
      clientName: string;
      propertyName: string;
    };

export async function recordDomainEvent(event: DomainEvent): Promise<void> {
  try {
    if (event.type === "RESERVATION_CREATED") {
      const renderData: NotificationRenderData = {
        type: "RESERVATION_CREATED",
        reservationId: event.reservationId,
        clientName: event.clientName,
        propertyName: event.propertyName,
      };
      const rendered = renderNotification(renderData, "in-app");
      const intent = {
        notificationKey: `reservation-created:${event.reservationId}`,
        type: "RESERVATION_CREATED" as const,
        title: rendered.subject,
        body: rendered.text,
        link: `/reservations/${event.reservationId}`,
        userId: event.ownerId,
      };
      const recipient = {
        userId: event.ownerId,
        email: event.ownerEmail,
        name: event.ownerName,
      };

      // Sequential: InApp first, then Email (avoids race on notification.findUnique)
      const inAppResult = await inAppChannel.dispatch(intent, recipient);
      if (!inAppResult.ok) {
        console.error(`[Notifications][recordDomainEvent] InApp failed for ${event.type}`, inAppResult);
        return;
      }
      const emailResult = await emailChannel.dispatch(intent, recipient);
      if (!emailResult.ok && !("skipped" in emailResult)) {
        console.error(`[Notifications][recordDomainEvent] Email failed for ${event.type}`, emailResult);
      }
    }
  } catch (err) {
    // NEVER throw — notifications are best-effort (ADR-0021 §4)
    console.error("[Notifications][recordDomainEvent] Unexpected error", err);
  }
}
