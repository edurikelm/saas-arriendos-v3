/**
 * Wrapper sobre `fetch` con AbortSignal.timeout para todas las llamadas
 * outbound a Mercado Pago.
 *
 * Doc MP: webhook espera respuesta en 22s. Si llegamos tarde, MP re-intenta
 * 8 veces. Por eso abortamos preventivamente a los 5s.
 */
export async function mpFetch(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = 5_000,
): Promise<Response> {
  return fetch(url, {
    ...options,
    signal: AbortSignal.timeout(timeoutMs),
  });
}

/**
 * Formatea Date como ISO 8601 con offset UTC (e.g., "2026-08-11T15:30:00.000-04:00").
 * Doc MP espera ISO 8601 con offset, no 'Z' sufijo.
 *
 * @example
 * toMercadoPagoIso8601(new Date("2026-08-11T19:30:00Z")) → "2026-08-11T15:30:00.000-04:00"
 */
export function toMercadoPagoIso8601(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  const ms = String(date.getMilliseconds()).padStart(3, '0');

  // Get the timezone offset in minutes (e.g., -240 for UTC-4)
  const tzOffsetMinutes = date.getTimezoneOffset();
  // Convert to ±HH:MM format
  const absOffset = Math.abs(tzOffsetMinutes);
  const tzHours = String(Math.floor(absOffset / 60)).padStart(2, '0');
  const tzMinutes = String(absOffset % 60).padStart(2, '0');
  const tzSign = tzOffsetMinutes <= 0 ? '+' : '-';

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${ms}${tzSign}${tzHours}:${tzMinutes}`;
}
