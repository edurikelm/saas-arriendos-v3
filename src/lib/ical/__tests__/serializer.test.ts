import { describe, it, expect } from "vitest";
import { serializeIcal } from "../serializer";
import { parseIcal } from "../parser";

describe("serializeIcal", () => {
  describe("basic serialization", () => {
    it("genera VCALENDAR con headers requeridos", () => {
      const result = serializeIcal({ events: [], calendarName: "Test" });
      expect(result).toContain("BEGIN:VCALENDAR");
      expect(result).toContain("VERSION:2.0");
      expect(result).toContain("PRODID:-//RentalPro//Export//EN");
      expect(result).toContain("CALSCALE:GREGORIAN");
      expect(result).toContain("METHOD:PUBLISH");
      expect(result).toContain("END:VCALENDAR");
    });

    it("incluye X-WR-CALNAME con el nombre del calendario", () => {
      const result = serializeIcal({ events: [], calendarName: "Mi Calendario" });
      expect(result).toContain("X-WR-CALNAME:Mi Calendario");
    });

    it("maneja calendario vacío (sin eventos)", () => {
      const result = serializeIcal({ events: [], calendarName: "Vacío" });
      expect(result).toContain("BEGIN:VCALENDAR");
      expect(result).toContain("END:VCALENDAR");
      expect(result).not.toContain("BEGIN:VEVENT");
    });
  });

  describe("event serialization", () => {
    it("serializa evento con todos los campos", () => {
      const events = [
        {
          uid: "event-1",
          startDate: new Date("2026-07-15"),
          endDate: new Date("2026-07-17"), // Last night = Jul 17
          summary: "Reserva Test",
        },
      ];
      const result = serializeIcal({ events, calendarName: "Test" });

      expect(result).toContain("BEGIN:VEVENT");
      expect(result).toContain("UID:event-1@rentalpro");
      expect(result).toContain("DTSTART;VALUE=DATE:20260715");
      // DTEND exclusive: endDate + 1 = Jul 18
      expect(result).toContain("DTEND;VALUE=DATE:20260718");
      expect(result).toContain("SUMMARY:Reserva Test");
      expect(result).toContain("END:VEVENT");
    });

    it("serializa evento sin summary", () => {
      const events = [
        {
          uid: "event-2",
          startDate: new Date("2026-08-01"),
          endDate: new Date("2026-08-05"),
        },
      ];
      const result = serializeIcal({ events, calendarName: "Test" });

      expect(result).toContain("UID:event-2@rentalpro");
      expect(result).not.toContain("SUMMARY:");
    });

    it("serializa múltiples eventos", () => {
      const events = [
        {
          uid: "event-a",
          startDate: new Date("2026-07-20"),
          endDate: new Date("2026-07-22"),
          summary: "Evento A",
        },
        {
          uid: "event-b",
          startDate: new Date("2026-08-01"),
          endDate: new Date("2026-08-05"),
          summary: "Evento B",
        },
      ];
      const result = serializeIcal({ events, calendarName: "Test" });

      expect(result).toContain("BEGIN:VEVENT");
      expect(result).toContain("UID:event-a@rentalpro");
      expect(result).toContain("UID:event-b@rentalpro");
      expect(result).toContain("END:VEVENT");
      // Two events = two VEVENT blocks
      const eventMatches = result.match(/BEGIN:VEVENT/g);
      expect(eventMatches?.length).toBe(2);
    });
  });

  describe("RFC 5545 compliance", () => {
    it("usa CRLF line endings", () => {
      const result = serializeIcal({ events: [], calendarName: "Test" });
      expect(result).toContain("\r\n");
    });

    it("escapa comas en SUMMARY", () => {
      const events = [
        {
          uid: "event-1",
          startDate: new Date("2026-07-15"),
          endDate: new Date("2026-07-17"),
          summary: "Hotel Suite, Habitación Doble",
        },
      ];
      const result = serializeIcal({ events, calendarName: "Test" });

      expect(result).toContain("SUMMARY:Hotel Suite\\, Habitación Doble");
      expect(result).not.toContain("SUMMARY:Hotel Suite, Habitación");
    });

    it("escapa punto y coma en SUMMARY", () => {
      const events = [
        {
          uid: "event-1",
          startDate: new Date("2026-07-15"),
          endDate: new Date("2026-07-17"),
          summary: "Bloqueo: motivo; razón",
        },
      ];
      const result = serializeIcal({ events, calendarName: "Test" });

      // Colon after "Bloqueo" is NOT escaped (RFC 5545 doesn't require it inside value)
      // Only semicolon needs escaping
      expect(result).toContain("SUMMARY:Bloqueo: motivo\\; razón");
    });

    it("escapa newlines en SUMMARY", () => {
      const events = [
        {
          uid: "event-1",
          startDate: new Date("2026-07-15"),
          endDate: new Date("2026-07-17"),
          summary: "Línea 1\nLínea 2",
        },
      ];
      const result = serializeIcal({ events, calendarName: "Test" });

      expect(result).toContain("SUMMARY:Línea 1\\nLínea 2");
      expect(result).not.toContain("Línea 1\nLínea 2");
    });
  });

  describe("round-trip with parser", () => {
    it("parse → serialize → parse yields same events", () => {
      const originalEvents = [
        {
          uid: "roundtrip-1",
          startDate: new Date("2026-07-15"),
          endDate: new Date("2026-07-17"), // 2 nights
          summary: "Test Roundtrip",
        },
        {
          uid: "roundtrip-2",
          startDate: new Date("2026-08-01"),
          endDate: new Date("2026-08-05"), // 4 nights
          summary: "Another Event",
        },
      ];

      // Serialize
      const icalText = serializeIcal({
        events: originalEvents,
        calendarName: "Roundtrip Test",
      });

      // Parse back
      const parseResult = parseIcal(icalText, { now: new Date("2026-06-01") });

      expect(parseResult.ok).toBe(true);
      if (parseResult.ok) {
        expect(parseResult.events).toHaveLength(2);

        // Check first event (sorted by startDate)
        const parsed1 = parseResult.events[0];
        expect(parsed1.uid).toBe("roundtrip-1@rentalpro");
        expect(parsed1.startDate.getFullYear()).toBe(2026);
        expect(parsed1.startDate.getMonth()).toBe(6); // July (0-indexed)
        expect(parsed1.startDate.getDate()).toBe(15);
        expect(parsed1.endDate.getDate()).toBe(17); // Exclusive DTEND → internal endDate
        expect(parsed1.summary).toBe("Test Roundtrip");

        // Check second event
        const parsed2 = parseResult.events[1];
        expect(parsed2.uid).toBe("roundtrip-2@rentalpro");
        expect(parsed2.startDate.getDate()).toBe(1);
        expect(parsed2.endDate.getDate()).toBe(5);
        expect(parsed2.summary).toBe("Another Event");
      }
    });

    it("all-day block with exclusive DTEND semantics", () => {
      const events = [
        {
          uid: "block-1",
          startDate: new Date("2026-07-15"), // Check-in Jul 15
          endDate: new Date("2026-07-18"), // Last night Jul 17 → endDate internal
        },
      ];

      const icalText = serializeIcal({ events, calendarName: "Block Test" });
      const parseResult = parseIcal(icalText, { now: new Date("2026-06-01") });

      expect(parseResult.ok).toBe(true);
      if (parseResult.ok) {
        const parsed = parseResult.events[0];
        // Parser: DTEND=Jul 19 (exclusive) → internal endDate = Jul 18
        // Wait, our events have endDate=Jul 18, so DTEND = Jul 19
        // Parser: DTEND Jul 19 → internal endDate = Jul 18
        // So parsed.endDate should be Jul 18, same as original
        expect(parsed.endDate.getDate()).toBe(18);
      }
    });
  });
});
