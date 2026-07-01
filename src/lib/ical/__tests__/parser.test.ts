import { describe, it, expect } from "vitest";
import { parseIcal } from "../parser";

const FIXTURE_SIMPLE_ICAL = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//ES
BEGIN:VEVENT
UID:event-1@example.com
DTSTART:20260715T120000Z
DTEND:20260718T120000Z
SUMMARY:Reserva Example
END:VEVENT
END:VCALENDAR`;

const FIXTURE_ALL_DAY = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//ES
BEGIN:VEVENT
UID:event-2@example.com
DTSTART:20260715
DTEND:20260718
SUMMARY:Reserva All Day
END:VEVENT
END:VCALENDAR`;

const FIXTURE_MULTIPLE_EVENTS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//ES
BEGIN:VEVENT
UID:event-3@example.com
DTSTART:20260720T140000Z
DTEND:20260722T110000Z
SUMMARY:Evento 1
END:VEVENT
BEGIN:VEVENT
UID:event-4@example.com
DTSTART:20260801
DTEND:20260805
SUMMARY:Evento 2 All Day
END:VEVENT
END:VCALENDAR`;

const FIXTURE_NO_VCALENDAR = `BEGIN:VEVENT
UID:event@example.com
DTSTART:20250115
DTEND:20250118
SUMMARY:Invalid
END:VEVENT`;

const FIXTURE_FUTURE_EVENT = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//ES
BEGIN:VEVENT
UID:future-event@example.com
DTSTART:20300115T120000Z
DTEND:20300118T120000Z
SUMMARY:Evento Futuro
END:VEVENT
END:VCALENDAR`;

describe("parseIcal", () => {
  describe("basic parsing", () => {
    it("parsea VEVENT simple con fechas UTC", () => {
      const result = parseIcal(FIXTURE_SIMPLE_ICAL);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.events).toHaveLength(1);
        expect(result.events[0].uid).toBe("event-1@example.com");
        expect(result.events[0].summary).toBe("Reserva Example");
      }
    });

    it("parsea evento all-day con DTEND exclusivo (resta 1 día)", () => {
      const result = parseIcal(FIXTURE_ALL_DAY);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.events).toHaveLength(1);
        expect(result.events[0].uid).toBe("event-2@example.com");
        expect(result.events[0].summary).toBe("Reserva All Day");
        // DTEND: Jul 18, internal end should be Jul 17 (exclusive)
        const endDate = result.events[0].endDate;
        expect(endDate.getDate()).toBe(17);
        expect(endDate.getMonth()).toBe(6); // July
      }
    });

    it("parsea múltiples VEVENTs", () => {
      const result = parseIcal(FIXTURE_MULTIPLE_EVENTS);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.events).toHaveLength(2);
        expect(result.events[0].uid).toBe("event-3@example.com");
        expect(result.events[1].uid).toBe("event-4@example.com");
      }
    });

    it("retorna INVALID_ICAL cuando falta BEGIN:VCALENDAR", () => {
      const result = parseIcal(FIXTURE_NO_VCALENDAR);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.kind).toBe("INVALID_ICAL");
      }
    });

    it("filtra eventos fuera de ventana [-30d, +18m]", () => {
      const now = new Date("2026-01-01");
      const result = parseIcal(FIXTURE_FUTURE_EVENT, { now });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.events).toHaveLength(0);
      }
    });
  });

  describe("edge cases", () => {
    it("maneja líneas con unfold (espacio en continuación)", () => {
      const folded = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:event-folded@example.com
SUMMARY:Reserva con descri
 pción larga
DTSTART:20260715
DTEND:20260718
END:VEVENT
END:VCALENDAR`;
      const result = parseIcal(folded);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.events).toHaveLength(1);
        expect(result.events[0].summary).toBe("Reserva con descripción larga");
      }
    });

    it("parsea evento sin DTEND (usa startDate como endDate)", () => {
      const noEnd = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:no-end@example.com
DTSTART:20260715T120000Z
SUMMARY:Sin DTEND
END:VEVENT
END:VCALENDAR`;
      const result = parseIcal(noEnd);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.events).toHaveLength(1);
        expect(result.events[0].endDate.getTime()).toBe(result.events[0].startDate.getTime());
      }
    });

    it("parsea evento sin SUMMARY", () => {
      const noSummary = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:no-summary@example.com
DTSTART:20260715
DTEND:20260718
END:VEVENT
END:VCALENDAR`;
      const result = parseIcal(noSummary);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.events).toHaveLength(1);
        expect(result.events[0].summary).toBeUndefined();
      }
    });
  });
});
