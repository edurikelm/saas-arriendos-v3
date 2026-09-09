import { describe, expect, it, vi } from "vitest";
import {
  BUSINESS_TIME_ZONE,
  daysFromNowInBusinessTz,
  isSameBusinessDay,
  getDateKeyInTz,
  dateKeyToDayIndex,
  startOfMonthInSantiago,
  nowKeyInBusinessTz,
  isBeforeTodayInBusinessTz,
  isOverdueInBusinessTz,
  dateOnlyKey,
  startOfDayInTz,
  endOfDayInTz,
  daysFromTodayDateOnly,
  isOverdueDateOnly,
  formatDateOnly,
  formatInstant,
  nightsBetweenDateOnly,
} from "@/lib/domain/timezone";

describe("BUSINESS_TIME_ZONE", () => {
  it("is America/Santiago", () => {
    expect(BUSINESS_TIME_ZONE).toBe("America/Santiago");
  });
});

describe("getDateKeyInTz", () => {
  it("returns YYYY-MM-DD format in America/Santiago", () => {
    // July is winter in Chile (UTC-4)
    const date = new Date("2026-07-20T14:00:00.000Z"); // 14:00 UTC = 10:00 SCL (UTC-4)
    expect(getDateKeyInTz(date, "America/Santiago")).toBe("2026-07-20");
  });

  it("handles string input", () => {
    const result = getDateKeyInTz("2026-01-15T12:00:00.000Z", "America/Santiago");
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("dateKeyToDayIndex", () => {
  it("converts YYYY-MM-DD to days since epoch", () => {
    const idx = dateKeyToDayIndex("1970-01-01");
    expect(idx).toBe(0);
  });

  it("handles arbitrary dates", () => {
    const idx = dateKeyToDayIndex("2026-01-01");
    expect(typeof idx).toBe("number");
    expect(idx).toBeGreaterThan(20000);
  });
});

describe("daysFromNowInBusinessTz", () => {
  it("returns 0 when target is today", () => {
    // Use noon UTC to avoid any midnight boundary issues
    const now = new Date("2026-05-20T12:00:00.000Z");
    // May 20 noon UTC = May 20 08:00 SCL (winter) → same calendar day
    const target = new Date("2026-05-20T12:00:00.000Z");
    expect(daysFromNowInBusinessTz(target, now)).toBe(0);
  });

  it("returns positive days for future dates", () => {
    const now = new Date("2026-05-20T12:00:00.000Z"); // May 20 midday UTC
    const target = new Date("2026-05-23T12:00:00.000Z"); // May 23 midday UTC → May 23 SCL
    expect(daysFromNowInBusinessTz(target, now)).toBe(3);
  });

  it("returns negative days for past dates", () => {
    const now = new Date("2026-05-20T12:00:00.000Z");
    const target = new Date("2026-05-17T12:00:00.000Z"); // May 17 midday UTC → May 17 SCL
    expect(daysFromNowInBusinessTz(target, now)).toBe(-3);
  });

  it("handles string dates", () => {
    const now = new Date("2026-05-20T12:00:00.000Z");
    // May 20 to May 25 is 5 days apart
    expect(daysFromNowInBusinessTz("2026-05-25T12:00:00.000Z", now)).toBe(5);
  });

  it("accepts custom timezone override", () => {
    const now = new Date("2026-05-20T12:00:00.000Z");
    // In Tokyo (UTC+9), 12:00 UTC = 21:00 on May 20
    // Next day midnight UTC = previous day 09:00 Tokyo
    const target = new Date("2026-05-21T00:00:00.000Z"); // midnight UTC May 21 = 09:00 Tokyo May 21
    expect(daysFromNowInBusinessTz(target, now, "Asia/Tokyo")).toBe(1);
  });
});

describe("isSameBusinessDay", () => {
  it("returns true for same calendar day", () => {
    // May 20 midday UTC and evening UTC are both May 20 in SCL
    const a = new Date("2026-05-20T12:00:00.000Z"); // midday
    const b = new Date("2026-05-20T20:00:00.000Z"); // evening
    expect(isSameBusinessDay(a, b)).toBe(true);
  });

  it("returns false for different calendar days", () => {
    const a = new Date("2026-05-20T12:00:00.000Z"); // May 20
    const b = new Date("2026-05-21T12:00:00.000Z"); // May 21
    expect(isSameBusinessDay(a, b)).toBe(false);
  });

  it("handles string inputs", () => {
    expect(isSameBusinessDay("2026-05-20T12:00:00.000Z", "2026-05-20T12:00:00.000Z")).toBe(true);
    expect(isSameBusinessDay("2026-05-20T12:00:00.000Z", "2026-05-21T12:00:00.000Z")).toBe(false);
  });

  it("respects custom timezone", () => {
    const a = new Date("2026-05-20T12:00:00.000Z");
    const b = new Date("2026-05-21T00:00:00.000Z"); // May 21 00:00 UTC = May 21 09:00 Tokyo
    expect(isSameBusinessDay(a, b, "Asia/Tokyo")).toBe(false); // May 20 vs May 21 in Tokyo
  });
});

describe("startOfMonthInSantiago", () => {
  it("returns YYYY-MM-01 format", () => {
    const result = startOfMonthInSantiago();
    expect(result).toMatch(/^\d{4}-\d{2}-01$/);
  });

  it("uses America/Santiago timezone for month boundary", () => {
    const result = startOfMonthInSantiago();
    const [year, month] = result.split("-").map(Number);
    expect(month).toBeGreaterThanOrEqual(1);
    expect(month).toBeLessThanOrEqual(12);
    expect(year).toBeGreaterThan(2020);
  });
});

describe("nowKeyInBusinessTz", () => {
  it("returns YYYY-MM-DD format", () => {
    const key = nowKeyInBusinessTz();
    expect(key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("compares equal to getDateKeyInTz(new Date()) in America/Santiago", () => {
    // Propiedad clave: ambos helpers deben dar la misma fecha-calendario
    // para el mismo instante. Si divergen, hay bug en la implementación.
    const direct = getDateKeyInTz(new Date(), BUSINESS_TIME_ZONE);
    expect(nowKeyInBusinessTz()).toBe(direct);
  });

  it("interprets UTC midnight as the prior Santiago day in winter (UTC-4)", () => {
    // Julio = invierno Chile, UTC-4.
    // 2026-07-15 02:00 UTC = 2026-07-14 22:00 SCL → debería ser 2026-07-14.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-15T02:00:00.000Z"));
    expect(nowKeyInBusinessTz()).toBe("2026-07-14");
    vi.useRealTimers();
  });

  it("interprets UTC midnight as the next Santiago day in summer (UTC-3)", () => {
    // Enero = verano Chile, UTC-3.
    // 2026-01-15 03:00 UTC = 2026-01-15 00:00 SCL → debería ser 2026-01-15.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-15T03:00:00.000Z"));
    expect(nowKeyInBusinessTz()).toBe("2026-01-15");
    vi.useRealTimers();
  });
});

describe("isBeforeTodayInBusinessTz", () => {
  it("returns false for null/undefined dates", () => {
    expect(isBeforeTodayInBusinessTz(null)).toBe(false);
    expect(isBeforeTodayInBusinessTz(undefined)).toBe(false);
  });

  it("returns false for today", () => {
    const today = "2026-05-20";
    expect(isBeforeTodayInBusinessTz(`${today}T12:00:00.000Z`, today)).toBe(false);
  });

  it("returns true for yesterday", () => {
    const today = "2026-05-20";
    expect(isBeforeTodayInBusinessTz("2026-05-19T18:00:00.000Z", today)).toBe(true);
  });

  it("returns true for dates long ago", () => {
    const today = "2026-05-20";
    expect(isBeforeTodayInBusinessTz("2020-01-01T00:00:00.000Z", today)).toBe(true);
  });

  it("returns false for future dates", () => {
    const today = "2026-05-20";
    expect(isBeforeTodayInBusinessTz("2026-05-21T12:00:00.000Z", today)).toBe(false);
    expect(isBeforeTodayInBusinessTz("2027-01-01T00:00:00.000Z", today)).toBe(false);
  });

  it("uses wall-time zone — late UTC time on day N-1 can be 'today' in Santiago", () => {
    // 23:30 UTC del 2026-02-28 = 20:30 SCL del 2026-02-28 (mismo día).
    // Si today=2026-02-28, este timestamp NO es "before today".
    const today = "2026-02-28";
    expect(isBeforeTodayInBusinessTz("2026-02-28T23:30:00.000Z", today)).toBe(false);
  });

  it("respects the nowKey override for batch callsites", () => {
    const today = "2026-05-20";
    // Sin override, depends del system time — con override es determinístico.
    expect(isBeforeTodayInBusinessTz("2026-05-19T00:00:00.000Z", today)).toBe(true);
    expect(isBeforeTodayInBusinessTz("2026-05-21T00:00:00.000Z", today)).toBe(false);
  });
});

describe("isOverdueInBusinessTz", () => {
  it("is a semantic alias of isBeforeTodayInBusinessTz", () => {
    const today = "2026-05-20";
    const yesterday = "2026-05-19T15:00:00.000Z";
    const tomorrow = "2026-05-21T15:00:00.000Z";

    expect(isOverdueInBusinessTz(yesterday, today)).toBe(
      isBeforeTodayInBusinessTz(yesterday, today)
    );
    expect(isOverdueInBusinessTz(tomorrow, today)).toBe(
      isBeforeTodayInBusinessTz(tomorrow, today)
    );
  });

  it("returns false for null dueDate", () => {
    expect(isOverdueInBusinessTz(null, "2026-05-20")).toBe(false);
  });
});

describe("dateOnlyKey", () => {
  it("extracts YYYY-MM-DD from an ISO string without reinterpreting in a timezone", () => {
    expect(dateOnlyKey("2026-08-24T00:00:00.000Z")).toBe("2026-08-24");
    expect(dateOnlyKey("2026-08-24T23:00:00.000Z")).toBe("2026-08-24");
  });

  it("extracts the UTC calendar day from a Date instance", () => {
    expect(dateOnlyKey(new Date("2026-08-24T00:00:00.000Z"))).toBe("2026-08-24");
  });

  it("falls back to getDateKeyInTz for non-standard strings", () => {
    // No debería ocurrir con campos date-only reales del dominio, pero el
    // fallback evita reventar si llega un formato inesperado.
    expect(dateOnlyKey("Aug 24 2026 00:00:00 GMT+0000")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it(
    "invariante: midnight UTC y mediodia UTC del mismo dia calendario producen la misma key " +
      "(neutraliza la inconsistencia de escritura entre Reservation.startDate y Payment.dueDate)",
    () => {
      const midnight = dateOnlyKey("2026-08-24T00:00:00.000Z");
      const noon = dateOnlyKey("2026-08-24T12:00:00.000Z");
      expect(midnight).toBe(noon);
      expect(midnight).toBe("2026-08-24");
    }
  );
});

describe("daysFromTodayDateOnly", () => {
  it("returns 0 when the date-only field falls on today in SCL", () => {
    const now = new Date("2026-08-24T18:00:00.000Z"); // 14:00 SCL (winter, UTC-4)
    expect(daysFromTodayDateOnly("2026-08-24T00:00:00.000Z", now)).toBe(0);
  });

  it("does not reinterpret UTC-midnight dueDate as the prior SCL day", () => {
    // Este es exactamente el bug H1: dueDate a medianoche UTC NO debe leerse
    // como el dia anterior en SCL solo porque el instante cae temprano.
    const now = new Date("2026-08-24T03:00:00.000Z"); // 23:00 SCL del 23-ago (dia anterior en zona)
    expect(daysFromTodayDateOnly("2026-08-24T00:00:00.000Z", now)).toBe(1);
  });

  it(
    "invariante: midnight UTC y mediodia UTC del mismo dia calendario dan el mismo resultado",
    () => {
      const now = new Date("2026-08-24T18:00:00.000Z");
      const fromMidnight = daysFromTodayDateOnly("2026-08-24T00:00:00.000Z", now);
      const fromNoon = daysFromTodayDateOnly("2026-08-24T12:00:00.000Z", now);
      expect(fromMidnight).toBe(fromNoon);
    }
  );

  it("returns negative for a past date-only field", () => {
    const now = new Date("2026-08-24T18:00:00.000Z");
    expect(daysFromTodayDateOnly("2026-08-20T00:00:00.000Z", now)).toBe(-4);
  });
});

describe("isOverdueDateOnly", () => {
  it("returns false when the date-only field is today", () => {
    const nowKey = "2026-08-24";
    expect(isOverdueDateOnly("2026-08-24T00:00:00.000Z", nowKey)).toBe(false);
  });

  it("returns true when the date-only field is strictly before nowKey", () => {
    const nowKey = "2026-08-24";
    expect(isOverdueDateOnly("2026-08-23T00:00:00.000Z", nowKey)).toBe(true);
  });

  it("returns false for null/undefined", () => {
    expect(isOverdueDateOnly(null, "2026-08-24")).toBe(false);
    expect(isOverdueDateOnly(undefined, "2026-08-24")).toBe(false);
  });

  it("defaults nowKey to today in SCL when omitted", () => {
    const farPast = isOverdueDateOnly("2000-01-01T00:00:00.000Z");
    expect(farPast).toBe(true);
  });
});

describe("formatDateOnly", () => {
  it("formats a UTC-midnight dueDate to the correct calendar day in es-CL, regardless of process TZ", () => {
    // Bug H1 pattern: dueDate a medianoche UTC no debe mostrar el dia anterior.
    const result = formatDateOnly("2026-08-24T00:00:00.000Z", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    expect(result).toContain("24");
    expect(result).not.toContain("23");
  });

  it("matches the local formatShortDate pattern for day/month/year", () => {
    const result = formatDateOnly("2026-01-05T00:00:00.000Z", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    expect(result).toBe("5 ene 2026");
  });

  it("returns '—' for null/undefined", () => {
    expect(formatDateOnly(null)).toBe("—");
    expect(formatDateOnly(undefined)).toBe("—");
  });

  it("is stable across UTC-midnight and UTC-noon representations of the same calendar day", () => {
    const fromMidnight = formatDateOnly("2026-08-24T00:00:00.000Z", { day: "numeric", month: "short" });
    const fromNoon = formatDateOnly("2026-08-24T12:00:00.000Z", { day: "numeric", month: "short" });
    expect(fromMidnight).toBe(fromNoon);
  });

  it("returns '—' instead of throwing for an empty string or an unparseable date", () => {
    // Regression: antes de este guard, "" y "not-a-date" propagaban una
    // RangeError sin capturar hasta el caller (crash de client component).
    expect(formatDateOnly("")).toBe("—");
    expect(formatDateOnly("not-a-date")).toBe("—");
    expect(formatDateOnly(new Date("invalid"))).toBe("—");
  });

  it("forces UTC regardless of a conflicting timeZone passed in options", () => {
    const result = formatDateOnly(
      "2026-08-24T00:00:00.000Z",
      { day: "numeric", month: "short", timeZone: "Pacific/Kiritimati" } as Intl.DateTimeFormatOptions,
    );
    expect(result).toContain("24");
  });
});

describe("nightsBetweenDateOnly", () => {
  // Las fechas de la base estan ancladas a mediodia local, no a medianoche
  // (ver memoria "fechas-de-reserva-no-son-medianoche"): en verano chileno
  // (UTC-3) eso serializa a las 15:00Z; en invierno (UTC-4) a las 16:00Z.
  // Los anclajes de abajo replican exactamente ese patron para reproducir
  // el bug de division-por-86400000 sobre instantes reales.

  it("cruce de la transicion de abril (fin de horario de verano, dia de 25h): 2→8 abr 2026 = 7 noches", () => {
    // 2-abr aun en verano (UTC-3) → 15:00Z. 8-abr ya en invierno (UTC-4) → 16:00Z.
    const start = new Date("2026-04-02T15:00:00.000Z");
    const end = new Date("2026-04-08T16:00:00.000Z");
    expect(nightsBetweenDateOnly(start, end)).toBe(7);
  });

  it("cruce de la transicion de septiembre (inicio de horario de verano, dia de 23h): 4→8 sep 2026 = 5 noches", () => {
    // 4-sep aun en invierno (UTC-4) → 16:00Z. 8-sep ya en verano (UTC-3) → 15:00Z.
    const start = new Date("2026-09-04T16:00:00.000Z");
    const end = new Date("2026-09-08T15:00:00.000Z");
    expect(nightsBetweenDateOnly(start, end)).toBe(5);
  });

  it("mes completo de abril cruzando la transicion: 1→30 abr 2026 = 30 noches", () => {
    const start = new Date("2026-04-01T15:00:00.000Z"); // verano
    const end = new Date("2026-04-30T16:00:00.000Z"); // invierno
    expect(nightsBetweenDateOnly(start, end)).toBe(30);
  });

  it("start === end (mismo dia) = 1 noche", () => {
    const day = new Date("2026-04-15T16:00:00.000Z");
    expect(nightsBetweenDateOnly(day, day)).toBe(1);
  });

  it("control sin transicion de DST: 5→10 may 2026 (invierno completo) = 6 noches", () => {
    const start = new Date("2026-05-05T16:00:00.000Z");
    const end = new Date("2026-05-10T16:00:00.000Z");
    expect(nightsBetweenDateOnly(start, end)).toBe(6);
  });

  it("acepta strings date-only (YYYY-MM-DD), cruzando la transicion de abril", () => {
    expect(nightsBetweenDateOnly("2026-04-02", "2026-04-08")).toBe(7);
  });

  it("acepta strings ISO con hora, cruzando la transicion de abril", () => {
    expect(nightsBetweenDateOnly("2026-04-02T15:00:00.000Z", "2026-04-08T16:00:00.000Z")).toBe(7);
  });

  it("end anterior a start (input invalido) → fallback a 1 noche", () => {
    expect(nightsBetweenDateOnly("2026-04-08", "2026-04-02")).toBe(1);
  });
});

describe("formatInstant", () => {
  it("formats a paidAt instant in America/Santiago wall-time, not UTC calendar day", () => {
    // Repro exacto del reviewer: pago marcado a las 22:00 SCL del 24-ago se
    // persiste como 2026-08-25T02:00:00.000Z (ya es 25 en UTC). El resultado
    // debe seguir siendo 24-ago, el dia en que realmente ocurrio en SCL.
    const result = formatInstant("2026-08-25T02:00:00.000Z", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    expect(result).toContain("24");
    expect(result).not.toContain("25");
  });

  it("returns '—' for null/undefined/empty/unparseable", () => {
    expect(formatInstant(null)).toBe("—");
    expect(formatInstant(undefined)).toBe("—");
    expect(formatInstant("")).toBe("—");
    expect(formatInstant("not-a-date")).toBe("—");
  });
});

// Limites de dia como INSTANTES en la zona de negocio. Estos tests son
// significativos solo si valen igual corriendo el proceso en cualquier zona:
// el bug que los motivo (#270 / serie anual con 13 meses) existia justamente
// porque el rango se construia con `new Date(year, 0, 1)`, hora local del
// proceso, y coincidia con la de negocio solo cuando la suite corria en Chile.
describe("startOfDayInTz / endOfDayInTz", () => {
  const TZ = BUSINESS_TIME_ZONE;

  function todosLosDiasDe(year: number): string[] {
    const dias: string[] = [];
    const d = new Date(Date.UTC(year, 0, 1));
    while (d.getUTCFullYear() === year) {
      dias.push(d.toISOString().slice(0, 10));
      d.setUTCDate(d.getUTCDate() + 1);
    }
    return dias;
  }

  it("el inicio del dia cae dentro del dia pedido, y un ms antes es el dia anterior", () => {
    for (const key of ["2026-01-01", "2026-06-15", "2026-12-31"]) {
      const start = startOfDayInTz(key, TZ);
      expect(getDateKeyInTz(start, TZ)).toBe(key);
      expect(getDateKeyInTz(new Date(start.getTime() - 1), TZ)).not.toBe(key);
    }
  });

  it("el fin del dia cae dentro del dia pedido, y un ms despues es el dia siguiente", () => {
    for (const key of ["2026-01-01", "2026-06-15", "2026-12-31"]) {
      const end = endOfDayInTz(key, TZ);
      expect(getDateKeyInTz(end, TZ)).toBe(key);
      expect(getDateKeyInTz(new Date(end.getTime() + 1), TZ)).not.toBe(key);
    }
  });

  // Barrido de los 365 dias en vez de adivinar cuales son las transiciones:
  // si la primitiva se rompe en algun borde, aparece sin que haya que saber
  // de antemano donde esta.
  it("las invariantes valen para TODOS los dias del ano, transiciones incluidas", () => {
    const duraciones = new Set<number>();
    for (const key of todosLosDiasDe(2026)) {
      const start = startOfDayInTz(key, TZ);
      const end = endOfDayInTz(key, TZ);
      expect(getDateKeyInTz(start, TZ)).toBe(key);
      expect(getDateKeyInTz(end, TZ)).toBe(key);
      expect(getDateKeyInTz(new Date(start.getTime() - 1), TZ)).not.toBe(key);
      expect(getDateKeyInTz(new Date(end.getTime() + 1), TZ)).not.toBe(key);
      duraciones.add((end.getTime() + 1 - start.getTime()) / 3_600_000);
    }
    // Chile tiene dos cambios de hora al ano: un dia de 23h y otro de 25h.
    expect([...duraciones].sort((a, b) => a - b)).toEqual([23, 24, 25]);
  });

  it("el ano completo son exactamente 12 meses, no 13", () => {
    const start = startOfDayInTz("2026-01-01", TZ);
    const end = endOfDayInTz("2026-12-31", TZ);
    expect(getDateKeyInTz(start, TZ).slice(0, 7)).toBe("2026-01");
    expect(getDateKeyInTz(end, TZ).slice(0, 7)).toBe("2026-12");
  });

  it("un pago del 31-dic a las 22:00 en Santiago sigue siendo del 31-dic", () => {
    // 31-dic 22:00 SCL = 1-ene 01:00 UTC. Es el caso que `getFullYear()` del
    // proceso clasificaba en el ano siguiente al correr en UTC.
    const pago = new Date("2027-01-01T01:00:00.000Z");
    expect(getDateKeyInTz(pago, TZ)).toBe("2026-12-31");
    const end = endOfDayInTz("2026-12-31", TZ);
    expect(pago.getTime()).toBeLessThanOrEqual(end.getTime());
  });
});
