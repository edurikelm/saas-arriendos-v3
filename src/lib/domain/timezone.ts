/**
 * Business timezone helpers for RentalPro.
 *
 * All business dates (due dates, payment reminders, availability calculations)
 * are interpreted in wall-time America/Santiago. This module consolidates
 * the timezone constant and helper functions per ADR-0020.
 *
 * ADR-0020: https://github.com/edurikelm/saas-arriendos-v3/blob/master/docs/adr/0020-business-dates-timezone.md
 */

export const BUSINESS_TIME_ZONE = "America/Santiago";

/**
 * Returns the date key (YYYY-MM-DD) for a given Date in the specified timezone.
 * Uses Intl.DateTimeFormat with "en-CA" locale which produces YYYY-MM-DD format.
 */
export function getDateKeyInTz(date: Date | string, tz: string = BUSINESS_TIME_ZONE): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(d);
}

/**
 * Converts a dateKey (YYYY-MM-DD) to a day index (days since Unix epoch).
 * Uses UTC to avoid timezone offsets.
 */
export function dateKeyToDayIndex(dateKey: string): number {
  const [year, month, day] = dateKey.split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86400000);
}

/**
 * Calculates full integer days between targetDate and now, both interpreted in tz.
 * Returns negative values if targetDate is in the past.
 *
 * Example: if now is March 5 and targetDate is March 8, returns 3.
 */
export function daysFromNowInBusinessTz(
  targetDate: Date | string,
  now: Date = new Date(),
  tz: string = BUSINESS_TIME_ZONE,
): number {
  const target = typeof targetDate === "string" ? new Date(targetDate) : targetDate;
  const targetKey = getDateKeyInTz(target, tz);
  const nowKey = getDateKeyInTz(now, tz);

  return dateKeyToDayIndex(targetKey) - dateKeyToDayIndex(nowKey);
}

/**
 * Returns true if both dates fall on the same calendar day in the given timezone.
 */
export function isSameBusinessDay(
  a: Date | string,
  b: Date | string,
  tz: string = BUSINESS_TIME_ZONE,
): boolean {
  const dateA = typeof a === "string" ? new Date(a) : a;
  const dateB = typeof b === "string" ? new Date(b) : b;

  return getDateKeyInTz(dateA, tz) === getDateKeyInTz(dateB, tz);
}

/**
 * Returns the first day of the current calendar month in America/Santiago wall-time,
 * formatted as YYYY-MM-01.
 */
export function startOfMonthInSantiago(): string {
  const today = getDateKeyInTz(new Date());
  return today.slice(0, 7) + "-01";
}
