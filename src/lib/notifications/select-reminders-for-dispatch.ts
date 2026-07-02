/**
 * Pure function: selects which payment reminders should be dispatched now.
 *
 * Implements the exact-day milestone rule per PRD-0003 and ADR-0021.
 *
 * Milestones (all computed in business timezone America/Santiago):
 * | Milestone      | Condition                                    | daysFromToday |
 * |----------------|----------------------------------------------|---------------|
 * | BEFORE_3_DAYS  | dueDate is exactly 3 days after now           | +3            |
 * | BEFORE_1_DAY   | dueDate is exactly 1 day after now            | +1            |
 * | DUE_TODAY      | dueDate is the same calendar day as now       | 0             |
 * | OVERDUE_1_DAY  | dueDate was exactly 1 day before now         | -1            |
 * | OVERDUE_3_DAYS | dueDate was exactly 3 days before now        | -3            |
 * | OVERDUE_7_DAYS | dueDate was exactly 7 days before now         | -7            |
 *
 * Only emits one reminder per (paymentId, milestone).
 * Deduplication is based on alreadySentKeys (notificationKeys already dispatched).
 */

import { daysFromNowInBusinessTz, BUSINESS_TIME_ZONE } from "@/lib/domain/timezone";

export const MILESTONE_VALUES = [
  "BEFORE_3_DAYS",
  "BEFORE_1_DAY",
  "DUE_TODAY",
  "OVERDUE_1_DAY",
  "OVERDUE_3_DAYS",
  "OVERDUE_7_DAYS",
] as const;

export type Milestone = (typeof MILESTONE_VALUES)[number];

export interface ReminderPayment {
  id: string;
  status: string;
  paymentType: string | null;
  dueDate: string | Date | null;
  reservation: {
    id: string;
    status: string;
    client: { name: string };
    property: { name: string };
  };
}

export interface ReminderCandidate {
  paymentId: string;
  reservationId: string;
  milestone: Milestone;
  notificationKey: string;
}

/**
 * Returns the milestone for a given daysFromToday value, or null if none matches.
 */
export function milestoneFromDays(daysFromToday: number): Milestone | null {
  switch (daysFromToday) {
    case 3:
      return "BEFORE_3_DAYS";
    case 1:
      return "BEFORE_1_DAY";
    case 0:
      return "DUE_TODAY";
    case -1:
      return "OVERDUE_1_DAY";
    case -3:
      return "OVERDUE_3_DAYS";
    case -7:
      return "OVERDUE_7_DAYS";
    default:
      return null;
  }
}

const ALLOWED_RESERVATION_STATUSES = new Set(["PENDING", "CONFIRMED"]);

/**
 * Selects reminder candidates to dispatch given a list of payments and the set
 * of notificationKeys already sent.
 *
 * @param payments - Active payments with their reservations (from Prisma)
 * @param now - Current timestamp (for testability; defaults to Date.now())
 * @param timezone - Business timezone (defaults to America/Santiago)
 * @param alreadySentKeys - Set of notificationKeys already dispatched
 */
export function selectRemindersForDispatch(
  payments: ReminderPayment[],
  now: Date = new Date(),
  timezone: string = BUSINESS_TIME_ZONE,
  alreadySentKeys: Set<string> = new Set(),
): ReminderCandidate[] {
  const candidates: ReminderCandidate[] = [];

  for (const payment of payments) {
    // Filter: only PENDING payments
    if (payment.status !== "PENDING") continue;

    // Filter: only RESERVATION payment type (not EXTRA)
    if (payment.paymentType !== "RESERVATION") continue;

    // Filter: reservation must be PENDING or CONFIRMED
    if (!ALLOWED_RESERVATION_STATUSES.has(payment.reservation.status)) continue;

    // Filter: must have a dueDate
    if (!payment.dueDate) continue;

    const daysFromToday = daysFromNowInBusinessTz(
      new Date(payment.dueDate),
      now,
      timezone,
    );

    const milestone = milestoneFromDays(daysFromToday);
    if (!milestone) continue;

    const notificationKey = `payment-reminder:${payment.id}:${milestone}`;

    // Deduplication: skip if already sent
    if (alreadySentKeys.has(notificationKey)) continue;

    candidates.push({
      paymentId: payment.id,
      reservationId: payment.reservation.id,
      milestone,
      notificationKey,
    });
  }

  return candidates;
}
