import { format } from "date-fns";
import { es } from "date-fns/locale/es";

/**
 * Converts "2026-01" → "ene 2026" using Intl.DateTimeFormat (no date-fns/tz dependency).
 *
 * Mirrored (intentionally, for now) by the standalone test in
 * `src/lib/reports/__tests__/month-key-label.test.ts`, which predates this
 * module and asserts the same Intl call directly. Keep both in sync if the
 * format ever changes.
 */
export function monthKeyLabel(monthKey: string): string {
  // Parse YYYY-MM using UTC to avoid timezone shifts
  const [year, month] = monthKey.split("-").map(Number);
  // month is 1-indexed; Date months are 0-indexed
  const date = new Date(Date.UTC(year, month - 1, 1, 12, 0, 0));
  return new Intl.DateTimeFormat("es-CL", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/**
 * Etiqueta factual del rango de fechas para el encabezado de `/reports`.
 *
 * - Mismo mes calendario (from/to caen en el mismo mes y año) → "Septiembre 2026".
 * - Cualquier otro rango → "01 sep 2026 - 30 nov 2026".
 *
 * Pura — no depende de "hoy", solo del rango recibido.
 */
export function formatPeriodRangeLabel(from: Date, to: Date): string {
  const sameMonth = from.getFullYear() === to.getFullYear() && from.getMonth() === to.getMonth();
  if (sameMonth) {
    const label = format(from, "MMMM yyyy", { locale: es });
    return label.charAt(0).toUpperCase() + label.slice(1);
  }
  return `${format(from, "dd MMM yyyy", { locale: es })} - ${format(to, "dd MMM yyyy", { locale: es })}`;
}
