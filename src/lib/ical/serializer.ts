export type IcalEvent = {
  uid: string;
  startDate: Date;
  endDate: Date;
  summary?: string;
};

export type SerializeIcalOptions = {
  events: IcalEvent[];
  calendarName: string;
};

/**
 * Serializes events to iCal format (RFC 5545).
 *
 * IMPORTANT - Round-trip semantics:
 * Our parser treats DTEND as EXCLUSIVE (Airbnb/Booking convention):
 *   - Parser: DTEND=Jul 18 → internal endDate = Jul 17 (last night)
 * Therefore, for export to preserve round-trip:
 *   - DTEND = endDate + 1 day
 *
 * Example: A reservation with internal endDate=Jul 17 (last night Jul 16-17)
 * exports DTEND=Jul 18, which parser will read as endDate=Jul 17. ✓
 *
 * Date handling: Uses UTC methods to avoid timezone issues when server
 * is in a different timezone than the property's local date.
 */
function formatDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

/**
 * Formats a date for DTSTAMP (UTC timestamp).
 */
function formatTimestamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/**
 * Escapes special characters in iCal text fields per RFC 5545.
 * Characters that need escaping: backslash, newline, comma, semicolon
 */
function escapeText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

/**
 * Folds a line per RFC 5545 (lines > 75 octets should be folded).
 * Uses CRLF + space as the fold marker.
 */
function foldLine(line: string): string {
  const maxLength = 75;
  if (line.length <= maxLength) {
    return line;
  }

  const result: string[] = [];
  let remaining = line;

  while (remaining.length > maxLength) {
    result.push(remaining.slice(0, maxLength));
    remaining = " " + remaining.slice(maxLength);
  }
  result.push(remaining);

  return result.join("\r\n");
}

/**
 * Serializes events to iCal format string.
 * Uses CRLF line endings and folds long lines per RFC 5545.
 */
export function serializeIcal({ events, calendarName }: SerializeIcalOptions): string {
  const lines: string[] = [];

  // Calendar header
  lines.push("BEGIN:VCALENDAR");
  lines.push("VERSION:2.0");
  lines.push("PRODID:-//RentalPro//Export//EN");
  lines.push("CALSCALE:GREGORIAN");
  lines.push("METHOD:PUBLISH");
  lines.push(foldLine(`X-WR-CALNAME:${escapeText(calendarName)}`));

  // Events
  for (const event of events) {
    lines.push("BEGIN:VEVENT");

    // UID: use the provided uid with @rentalpro suffix
    lines.push(`UID:${event.uid}@rentalpro`);

    // DTSTAMP: current UTC time
    lines.push(`DTSTAMP:${formatTimestamp(new Date())}`);

    // DTSTART: all-day format (DATE value)
    // For startDate, we use it as-is since it represents the check-in day
    lines.push(`DTSTART;VALUE=DATE:${formatDate(event.startDate)}`);

    // DTEND: all-day format, EXCLUSIVE (endDate + 1 day for round-trip with parser)
    // Use UTC to avoid timezone shifts
    const endDatePlusOne = new Date(Date.UTC(
      event.endDate.getUTCFullYear(),
      event.endDate.getUTCMonth(),
      event.endDate.getUTCDate() + 1
    ));
    lines.push(`DTEND;VALUE=DATE:${formatDate(endDatePlusOne)}`);

    // SUMMARY: escaped
    if (event.summary) {
      lines.push(`SUMMARY:${escapeText(event.summary)}`);
    }

    lines.push("END:VEVENT");
  }

  // Calendar footer
  lines.push("END:VCALENDAR");

  // Join with CRLF
  return lines.join("\r\n") + "\r\n";
}
