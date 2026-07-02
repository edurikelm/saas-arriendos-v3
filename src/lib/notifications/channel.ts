/**
 * NotificationChannel abstraction.
 *
 * Defines the interface for dispatching notifications via different channels
 * (in-app, email, etc.). Each channel implements the same contract: given an
 * intent and a recipient, dispatch and return a deterministic result.
 *
 * The channel is responsible for deduplication via notificationKey.
 * See ADR-0021 for full architecture documentation.
 */

export type NotificationChannelName = "in-app" | "email";

/**
 * Input to dispatch: describes the notification to be sent.
 * notificationKey drives deduplication at the channel level.
 */
export interface NotificationIntent {
  notificationKey: string;
  type: "RESERVATION_CREATED" | "RESERVATION_CANCELLED" | "PAYMENT_RECEIVED" | "PAYMENT_REMINDER" | "PAYMENT_FAILED";
  title: string;
  body: string;
  link?: string;
  userId: string;
}

/**
 * The recipient of a notification.
 */
export interface NotificationRecipient {
  userId: string;
  email: string;
  name?: string;
}

/**
 * Result of a dispatch attempt. Discriminated union:
 * - { ok: true, notificationId } — notification created
 * - { ok: true, skipped: "email-disabled" | "no-api-key" } — skipped intentionally
 * - { ok: false, error: string } — unexpected failure
 */
export type DispatchResult =
  | { ok: true; notificationId: string; deduplicated?: boolean }
  | { ok: true; skipped: "email-disabled" | "no-api-key" }
  | { ok: false; error: string };

/**
 * A notification delivery channel.
 */
export interface NotificationChannel {
  readonly name: NotificationChannelName;
  dispatch(intent: NotificationIntent, recipient: NotificationRecipient): Promise<DispatchResult>;
}
