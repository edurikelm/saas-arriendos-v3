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
 * Clave de dia calendario (YYYY-MM-DD) de un campo DATE-ONLY del dominio
 * (Reservation.startDate/endDate, Payment.dueDate).
 *
 * NO reinterpreta el instante en zona: un date-only representa "el dia X",
 * no "un momento". Usar getDateKeyInTz sobre estos campos produce
 * off-by-one cuando el valor esta anclado a medianoche UTC.
 *
 * Para instantes reales (paidAt, createdAt) usar getDateKeyInTz.
 */
export function dateOnlyKey(date: Date | string): string {
  if (typeof date === "string") {
    return /^\d{4}-\d{2}-\d{2}/.test(date) ? date.slice(0, 10) : getDateKeyInTz(date);
  }
  return date.toISOString().slice(0, 10);
}

/**
 * Numero de noches entre dos campos DATE-ONLY del dominio (`Reservation.startDate`
 * / `endDate`), respetando la convencion "Ultima Noche": `end` es la ultima noche
 * que duerme el huesped (inclusiva), no el dia de check-out. `start === end` → 1 noche.
 *
 * Opera enteramente sobre claves `YYYY-MM-DD` (via `dateOnlyKey` + `dateKeyToDayIndex`),
 * inmune a DST: `Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1` sobre
 * `Date` reales se rompe en el dia de 25h del fin del horario de verano chileno
 * (abril) — la division dividida por 86400000 da `N + 0.04`, `Math.ceil` sube a
 * `N+1`, y el `+1` final produce una noche de mas. Este calculo evita esa division
 * por completo.
 *
 * `Date` se normaliza con `dateOnlyKey` (slice UTC de `toISOString()`), correcto
 * para campos leidos desde la base (anclados a mediodia local, lejos de medianoche).
 * Si el caller tiene un `Date` de wall-time local (ej. un date-picker en el
 * navegador), debe normalizarlo a su propia clave ANTES de llamar a esta funcion
 * — ver `getNights` en `src/components/reservations/reservation-status.ts`.
 */
export function nightsBetweenDateOnly(start: string | Date, end: string | Date): number {
  const startKey = dateOnlyKey(start);
  const endKey = dateOnlyKey(end);
  return Math.max(1, dateKeyToDayIndex(endKey) - dateKeyToDayIndex(startKey) + 1);
}

/**
 * Dias calendario entre un campo date-only y "hoy" en America/Santiago.
 * 0 = hoy, mayor a 0 = futuro, menor a 0 = pasado.
 *
 * Asimetria deliberada: el target se lee como dia calendario, `now` se lee
 * como wall-time SCL. Ese es el contrato correcto.
 */
export function daysFromTodayDateOnly(date: Date | string, now: Date = new Date()): number {
  return dateKeyToDayIndex(dateOnlyKey(date)) - dateKeyToDayIndex(getDateKeyInTz(now));
}

/** Campo date-only estrictamente anterior a hoy (SCL). */
export function isOverdueDateOnly(
  date: Date | string | null | undefined,
  nowKey?: string,
): boolean {
  if (date == null) return false;
  return dateOnlyKey(date) < (nowKey ?? nowKeyInBusinessTz());
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

/**
 * Returns the date key (YYYY-MM-DD) of "today" interpreted in
 * `America/Santiago` wall-time.
 *
 * Útil para comparaciones day-level (e.g. `payment.dueDate < nowKeyInBusinessTz()`)
 * donde usar `new Date()` directo daría resultados incorrectos por el offset UTC del
 * servidor (Vercel). Ver ADR-0020.
 *
 * Ejemplo: si el servidor retorna `2026-02-28T23:30:00.000Z` y la zona es Santiago
 * (UTC-3 en verano), `nowKeyInBusinessTz()` retorna `"2026-03-01"`, no `"2026-02-28"`.
 */
export function nowKeyInBusinessTz(): string {
  return getDateKeyInTz(new Date());
}

/**
 * Compara el día-calendario-en-zona de `date` contra hoy en `America/Santiago`
 * y retorna `true` si `date` es estrictamente anterior a hoy.
 *
 * Reemplaza la comparación directa `date < new Date()` que es frágil cuando el
 * servidor corre en una zona distinta a la de negocio (ej. Vercel usa UTC).
 *
 * Para fechas con hora (no date-only), el "día calendario" se interpreta en
 * wall-time `America/Santiago`, así que dos timestamps del mismo día local
 * nunca son "vencidos" entre sí.
 *
 * @param date - fecha a comparar (Date o string ISO)
 * @param nowKey - opcional, cache de `nowKeyInBusinessTz()` para evitar
 *   recalcular el "hoy" en cada llamada. Útil en loops sobre muchos pagos.
 */
export function isBeforeTodayInBusinessTz(
  date: Date | string | null | undefined,
  nowKey?: string,
): boolean {
  if (date == null) return false;
  const today = nowKey ?? nowKeyInBusinessTz();
  const dateKey = getDateKeyInTz(date);
  return dateKey < today;
}

/**
 * Alias semántico de `isBeforeTodayInBusinessTz` para uso en contexto de
 * `Payment.dueDate`. Indica si un pago con `dueDate` dado está vencido
 * considerando el día calendario en `America/Santiago` (ADR-0020).
 *
 * Migración sugerida desde código legacy:
 *
 *   // Antes (frágil — depende de la zona del servidor):
 *   const isOverdue = payment.dueDate < new Date();
 *
 *   // Después (zona-aware):
 *   const isOverdue = isOverdueInBusinessTz(payment.dueDate);
 */
export function isOverdueInBusinessTz(
  dueDate: Date | string | null | undefined,
  nowKey?: string,
): boolean {
  return isBeforeTodayInBusinessTz(dueDate, nowKey);
}

/**
 * Formatea un campo DATE-ONLY del dominio (Reservation.startDate/endDate,
 * Payment.dueDate) para mostrar al usuario, SIN reinterpretar zona horaria.
 *
 * Ancla al mediodia UTC del dia calendario y fuerza timeZone: "UTC" en el
 * formateo, asi el resultado es el mismo sin importar la zona del
 * navegador o del servidor. Para instantes reales (paidAt, createdAt) NO
 * usar esta funcion — su formateo en zona local/navegador es correcto.
 */
export function formatDateOnly(
  date: Date | string | null | undefined,
  options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" },
  locale: string = "es-CL",
): string {
  if (!date) return "—";
  try {
    const key = dateOnlyKey(date);
    const [y, m, d] = key.split("-").map(Number);
    if (!y || !m || !d) return "—";
    const anchor = new Date(Date.UTC(y, m - 1, d, 12));
    return anchor.toLocaleDateString(locale, { ...options, timeZone: "UTC" });
  } catch {
    return "—";
  }
}

/**
 * Formatea un INSTANTE real (Payment.paidAt, Reservation.createdAt) para
 * mostrar al usuario, en wall-time America/Santiago. A diferencia de
 * formatDateOnly, aqui SI corresponde reinterpretar la zona horaria — el
 * instante representa "un momento", no "un dia calendario".
 */
export function formatInstant(
  date: Date | string | null | undefined,
  options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" },
  locale: string = "es-CL",
): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(locale, { ...options, timeZone: BUSINESS_TIME_ZONE });
}
