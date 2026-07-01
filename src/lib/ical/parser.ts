export type ParsedIcalEvent = {
  uid: string;
  startDate: Date;
  endDate: Date;
  summary?: string;
};

export type ParseResult =
  | { ok: true; events: ParsedIcalEvent[] }
  | { ok: false; kind: "INVALID_ICAL" | "MALFORMED_VEVENT"; message: string };

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function isInWindow(date: Date, now: Date): boolean {
  const thirtyDaysAgo = addDays(now, -30);
  const eighteenMonthsLater = new Date(now);
  eighteenMonthsLater.setMonth(eighteenMonthsLater.getMonth() + 18);
  return date >= thirtyDaysAgo && date <= eighteenMonthsLater;
}

function parseIcalDate(value: string): Date | null {
  // All-day format: DTSTART:20250115 or DTSTART;VALUE=DATE:20250115
  const dateOnlyMatch = value.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }

  // Format with time: DTSTART:20250115T120000 or DTSTART:20250115T120000Z
  const dateTimeMatch = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/);
  if (dateTimeMatch) {
    const [, year, month, day, hour, minute, second, utc] = dateTimeMatch;
    if (utc === "Z") {
      return new Date(Date.UTC(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day),
        parseInt(hour),
        parseInt(minute),
        parseInt(second)
      ));
    }
    return new Date(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      parseInt(hour),
      parseInt(minute),
      parseInt(second)
    );
  }

  return null;
}

function unfoldLines(text: string): string {
  // RFC 5545: unfold lines - remove CRLF/LF followed by folding whitespace (space/tab)
  // The folding space (LWSP after CRLF) is not part of content, just a continuation marker
  return text.replace(/\r?\n[ \t]/g, "");
}

function parseVEvent(lines: string[], tz: string): ParsedIcalEvent | null {
  let uid: string | null = null;
  let dtstart: string | null = null;
  let dtend: string | null = null;
  let summary: string | null = null;

  // Combine continuation lines (lines starting with space/tab) with previous line
  const combinedLines: string[] = [];
  for (const line of lines) {
    if (line.startsWith(" ") || line.startsWith("\t")) {
      // Continuation of previous line - join with space
      if (combinedLines.length > 0) {
        combinedLines[combinedLines.length - 1] += " " + line.trim();
      }
    } else {
      combinedLines.push(line);
    }
  }

  for (const line of combinedLines) {
    if (line.startsWith("UID:")) {
      uid = line.substring(4).trim();
    } else if (line.startsWith("DTSTART")) {
      const colonIdx = line.indexOf(":");
      dtstart = line.substring(colonIdx + 1).trim();
    } else if (line.startsWith("DTEND")) {
      const colonIdx = line.indexOf(":");
      dtend = line.substring(colonIdx + 1).trim();
    } else if (line.startsWith("SUMMARY:")) {
      summary = line.substring(8).trim();
    }
  }

  if (!uid || !dtstart) {
    return null;
  }

  const startDate = parseIcalDate(dtstart);
  if (!startDate) {
    return null;
  }

  // DTEND is optional. If absent, default to same as start (single-day event)
  let endDate: Date;
  if (dtend) {
    const parsedEnd = parseIcalDate(dtend);
    if (!parsedEnd) {
      return null;
    }
    endDate = parsedEnd;
  } else {
    endDate = new Date(startDate);
  }

  // Check if this is an all-day event (no time component)
  const isAllDay = !dtstart.includes("T");

  if (isAllDay) {
    // All-day event: DTEND is exclusive in Airbnb/Booking convention
    // A booking from Jan 15 to Jan 18 means: arrive Jan 15, leave Jan 18 (3 nights)
    // DTEND of Jan 18 means last night is Jan 17, so internal end = DTEND - 1
    endDate = addDays(endDate, -1);
  } else if (tz === "America/Santiago") {
    // TZID timezone handling - for now we treat wall time as local
    // The timezone offset would need to be applied to convert to UTC
    // For simplicity, we use the wall time as-is and let the caller handle TZ conversion
  }

  return {
    uid,
    startDate,
    endDate,
    summary: summary || undefined,
  };
}

export function parseIcal(text: string, options?: { now?: Date; tz?: string }): ParseResult {
  const now = options?.now ?? new Date();
  const tz = options?.tz ?? "";

  const unfolded = unfoldLines(text);

  // Check for required BEGIN:VCALENDAR
  if (!unfolded.includes("BEGIN:VCALENDAR")) {
    return { ok: false, kind: "INVALID_ICAL", message: "Falta BEGIN:VCALENDAR" };
  }

  const events: ParsedIcalEvent[] = [];

  // Split into blocks
  const parts = unfolded.split(/(?=BEGIN:VEVENT)/);
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed.startsWith("BEGIN:VEVENT")) {
      continue;
    }

    const lines = trimmed.split(/\r?\n/);
    const parsed = parseVEvent(lines, tz);

    if (!parsed) {
      return { ok: false, kind: "MALFORMED_VEVENT", message: "VEVENT no pudo ser parseado" };
    }

    // Filter events outside the window
    if (!isInWindow(parsed.startDate, now) && !isInWindow(parsed.endDate, now)) {
      continue;
    }

    events.push(parsed);
  }

  return { ok: true, events };
}
