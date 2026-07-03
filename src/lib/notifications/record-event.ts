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
import type { NotificationIntent, NotificationRecipient } from "./channel";

export type DomainEvent =
  | {
      type: "RESERVATION_CREATED";
      reservationId: string;
      ownerId: string;
      ownerEmail: string;
      ownerName?: string;
      clientName: string;
      propertyName: string;
    }
  | {
      type: "PAYMENT_RECEIVED";
      paymentId: string;
      ownerId: string;
      ownerEmail: string;
      ownerName?: string;
      clientName: string;
      amount: string;
      method: "MERCADO_PAGO" | "CASH" | "TRANSFER";
      reservationId?: string;
    }
  | {
      type: "PAYMENT_REVERTED";
      paymentId: string;
      ownerId: string;
      ownerEmail: string;
      ownerName?: string;
      clientName: string;
      amount: string;
      reason?: string;
      reservationId?: string;
    }
  | {
      type: "PAYMENT_REMINDER";
      paymentId: string;
      milestone: string;
      ownerId: string;
      ownerEmail: string;
      ownerName?: string;
      clientName: string;
      amount: string;
      dueDate?: string;
      reservationId?: string;
    };

/** Maps milestone name to daysFromToday (inverse of milestoneFromDays in select-reminders-for-dispatch) */
const MILESTONE_TO_DAYS: Record<string, number> = {
  BEFORE_3_DAYS: 3,
  BEFORE_1_DAY: 1,
  DUE_TODAY: 0,
  OVERDUE_1_DAY: -1,
  OVERDUE_3_DAYS: -3,
  OVERDUE_7_DAYS: -7,
};

async function dispatchIntent(
  intent: NotificationIntent,
  recipient: NotificationRecipient,
): Promise<void> {
  const inAppResult = await inAppChannel.dispatch(intent, recipient);
  if (!inAppResult.ok) {
    console.error(`[Notifications][recordDomainEvent] InApp failed for ${intent.type}`, inAppResult);
    return;
  }
  const emailResult = await emailChannel.dispatch(intent, recipient);
  if (!emailResult.ok && !("skipped" in emailResult)) {
    console.error(`[Notifications][recordDomainEvent] Email failed for ${intent.type}`, emailResult);
  }
}

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
      const intent: NotificationIntent = {
        notificationKey: `reservation-created:${event.reservationId}`,
        type: "RESERVATION_CREATED",
        title: rendered.subject,
        body: rendered.text,
        link: `/reservations/${event.reservationId}`,
        userId: event.ownerId,
      };
      const recipient: NotificationRecipient = {
        userId: event.ownerId,
        email: event.ownerEmail,
        name: event.ownerName,
      };
      await dispatchIntent(intent, recipient);
    } else if (event.type === "PAYMENT_RECEIVED") {
      const renderData: NotificationRenderData = {
        type: "PAYMENT_RECEIVED",
        paymentId: event.paymentId,
        clientName: event.clientName,
        amount: event.amount,
      };
      const rendered = renderNotification(renderData, "in-app");
      const intent: NotificationIntent = {
        notificationKey: `payment-received:${event.paymentId}`,
        type: "PAYMENT_RECEIVED",
        title: rendered.subject,
        body: rendered.text,
        link: `/payments/${event.paymentId}`,
        userId: event.ownerId,
      };
      const recipient: NotificationRecipient = {
        userId: event.ownerId,
        email: event.ownerEmail,
        name: event.ownerName,
      };
      await dispatchIntent(intent, recipient);
    } else if (event.type === "PAYMENT_REVERTED") {
      const renderData: NotificationRenderData = {
        type: "PAYMENT_REVERTED",
        paymentId: event.paymentId,
        clientName: event.clientName,
        amount: event.amount,
        reason: event.reason,
      };
      const rendered = renderNotification(renderData, "in-app");
      const intent: NotificationIntent = {
        notificationKey: `payment-reverted:${event.paymentId}`,
        type: "PAYMENT_REVERTED",
        title: rendered.subject,
        body: rendered.text,
        link: `/payments/${event.paymentId}`,
        userId: event.ownerId,
      };
      const recipient: NotificationRecipient = {
        userId: event.ownerId,
        email: event.ownerEmail,
        name: event.ownerName,
      };
      await dispatchIntent(intent, recipient);
    } else if (event.type === "PAYMENT_REMINDER") {
      const daysFromToday = MILESTONE_TO_DAYS[event.milestone] ?? 0;
      const renderData: NotificationRenderData = {
        type: "PAYMENT_REMINDER",
        paymentId: event.paymentId,
        clientName: event.clientName,
        amount: event.amount,
        dueDate: event.dueDate,
        milestone: event.milestone,
        daysFromToday,
      };
      const rendered = renderNotification(renderData, "in-app");
      const intent: NotificationIntent = {
        notificationKey: `payment-reminder:${event.paymentId}:${event.milestone}`,
        type: "PAYMENT_REMINDER",
        title: rendered.subject,
        body: rendered.text,
        link: `/payments/${event.paymentId}`,
        userId: event.ownerId,
      };
      const recipient: NotificationRecipient = {
        userId: event.ownerId,
        email: event.ownerEmail,
        name: event.ownerName,
      };
      await dispatchIntent(intent, recipient);
    }
  } catch (err) {
    // NEVER throw — notifications are best-effort (ADR-0021 §4)
    console.error("[Notifications][recordDomainEvent] Unexpected error", err);
  }
}
