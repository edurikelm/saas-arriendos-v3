/**
 * Seam compartido para cálculo de estado temporal de reservas (Client Components).
 *
 * Centraliza la lógica que antes vivía duplicada en:
 * - src/components/reservations/reservation-table.tsx
 * - src/components/reservations/reservation-list-item.tsx
 * - src/app/(dashboard)/reservations/[id]/_components/reservation-detail-client.tsx
 *
 * **Decisión de timezone (ADR-0020):** todas las comparaciones se hacen por
 * día calendario en wall-time `America/Santiago`. El dominio modela
 * `start_date` / `end_date` como **fechas date-only** (no timestamps), per
 * CONTEXT.md. Cuando el backend serializa con `Date.toISOString()` produce
 * `YYYY-MM-DDT00:00:00.000Z` (UTC midnight), lo cual NO debe reinterpretarse
 * como "el día anterior en SCL" — la fecha date-only es lo que el dueño
 * seleccionó en el datepicker.
 *
 * **Por qué este seam existía como bug:** la lógica previa usaba
 * `new Date(startDate)` (que interpreta el ISO como UTC) contra
 * `today.setHours(0,0,0,0)` (que es medianoche **local** del navegador).
 * Cuando el navegador estaba en zona horaria positiva (UTC+0, UTC+1, etc.),
 * `today < start` se cumplía con 1 hora de desfase → "Próxima En 1 días"
 * para reservas que el dueño acababa de crear con `start_date = hoy`.
 *
 * Las funciones aceptan un `now` opcional para tests determinísticos.
 */

import {
  BUSINESS_TIME_ZONE,
  dateKeyToDayIndex,
  getDateKeyInTz,
} from "@/lib/domain/timezone";
import { getInclusiveMonths } from "@/lib/reservation-dates";
import type { PillTone } from "@/components/reservations/reservation-pill";

export type ReservationBillingType = "DAILY" | "MONTHLY";
export type ReservationLifecycleStatus =
  | "PENDING"
  | "CONFIRMED"
  | "CANCELLED"
  | "COMPLETED";

export interface TemporalStatus {
  label: string;
  sublabel?: string;
}

/**
 * Extrae la clave date-only (`YYYY-MM-DD`) de un string de fecha.
 *
 * El backend serializa `Reservation.startDate` con `Date.toISOString()`,
 * produciendo `YYYY-MM-DDT00:00:00.000Z`. Como `start_date` es date-only
 * en el dominio (CONTEXT.md), extraemos directamente los primeros 10
 * caracteres sin reinterpretar el componente horario como UTC.
 *
 * Si la fecha viene como ISO completo con hora distinta a midnight
 * (ej: `2026-08-11T15:30:00.000Z`), usamos `getDateKeyInTz` en
 * `America/Santiago` para mantener la consistencia con el resto del módulo.
 */
function parseDateKey(dateString: string): string {
  // Caso común: el backend emite YYYY-MM-DDT00:00:00.000Z → usar la parte date-only.
  if (/^\d{4}-\d{2}-\d{2}/.test(dateString)) {
    return dateString.slice(0, 10);
  }
  // Fallback para strings no estándar (poco probable): formatear en SCL.
  return getDateKeyInTz(dateString, BUSINESS_TIME_ZONE);
}

/**
 * Deriva el label + sublabel temporal ("Próxima / Activa / Finalizada / Cancelada")
 * desde fechas y estado de negocio, interpretando día calendario en `America/Santiago`.
 *
 * Reglas (todas evaluadas en wall-time SCL):
 * - status === "CANCELLED" → "Cancelada"
 * - status === "COMPLETED" → "Finalizada"
 * - endDate < today (SCL) → "Finalizada"
 * - startDate > today (SCL) → "Próxima" + sublabel relativo ("Hoy"/"Mañana"/"En N días")
 * - startDate <= today <= endDate → "Activa" + sublabel con noches o meses restantes
 */
export function getTemporalStatus(
  startDate: string,
  endDate: string,
  billingType: ReservationBillingType | string,
  status: ReservationLifecycleStatus | string,
  now: Date = new Date(),
): TemporalStatus {
  if (status === "CANCELLED") return { label: "Cancelada" };
  if (status === "COMPLETED") return { label: "Finalizada" };

  const startKey = parseDateKey(startDate);
  const endKey = parseDateKey(endDate);
  const todayKey = getDateKeyInTz(now, BUSINESS_TIME_ZONE);

  if (todayKey > endKey) return { label: "Finalizada" };

  if (todayKey < startKey) {
    const daysUntil = dateKeyToDayIndex(startKey) - dateKeyToDayIndex(todayKey);
    return { label: "Próxima", sublabel: relativeDaysLabel(daysUntil, "future") };
  }

  // today está dentro de [start, end]
  if (billingType === "MONTHLY") {
    const monthsLeft = monthsRemaining(todayKey, endKey);
    return {
      label: "Activa",
      sublabel: `${monthsLeft} ${pluralize(monthsLeft, "mes", "meses")}`,
    };
  }

  const nightsLeft = nightsRemaining(todayKey, endKey);
  return {
    label: "Activa",
    sublabel: `${nightsLeft} ${pluralize(nightsLeft, "noche", "noches")}`,
  };
}

/**
 * Deriva el tone (color semántico) del pill de estado temporal de la reserva.
 *
 * - CANCELLED → destructive
 * - COMPLETED → neutral
 * - active (today ∈ [start, end]) → success
 * - upcoming (today < start) → info
 * - past (today > end) → neutral (Finalizada)
 */
export function getReservationTone(
  status: ReservationLifecycleStatus | string,
  startDate: string,
  endDate: string,
  now: Date = new Date(),
): PillTone {
  if (status === "CANCELLED") return "destructive";
  if (status === "COMPLETED") return "neutral";

  const startKey = parseDateKey(startDate);
  const endKey = parseDateKey(endDate);
  const todayKey = getDateKeyInTz(now, BUSINESS_TIME_ZONE);

  if (todayKey >= startKey && todayKey <= endKey) return "success";
  if (todayKey < startKey) return "info";
  return "neutral";
}

/**
 * Formatea una fecha como etiqueta relativa en español: "Hoy", "Ayer",
 * "Hace N días", "Hace N sem", "Hace N meses", "Hace N año(s)".
 *
 * Para fechas futuras retorna "Mañana", "Pasado mañana", "En N días".
 */
export function formatRelativeDay(dateString: string, now: Date = new Date()): string {
  const targetKey = parseDateKey(dateString);
  const todayKey = getDateKeyInTz(now, BUSINESS_TIME_ZONE);

  if (targetKey === todayKey) return "Hoy";

  const days = dateKeyToDayIndex(targetKey) - dateKeyToDayIndex(todayKey);

  if (days === -1) return "Ayer";
  if (days < 0) {
    // pasado
    if (days > -7) return `Hace ${Math.abs(days)} ${pluralize(Math.abs(days), "día", "días")}`;
    if (days > -30) return `Hace ${Math.floor(Math.abs(days) / 7)} sem`;
    if (days > -365) return `Hace ${Math.floor(Math.abs(days) / 30)} meses`;
    const years = Math.floor(Math.abs(days) / 365);
    return `Hace ${years} ${years === 1 ? "año" : "años"}`;
  }

  // futuro
  return relativeDaysLabel(days, "future");
}

// ---------- helpers internos (puros) ----------

function relativeDaysLabel(days: number, direction: "future" | "past"): string {
  if (days === 0) return "Hoy";
  if (direction === "future") {
    if (days === 1) return "Mañana";
    if (days === 2) return "Pasado mañana";
    return `En ${days} ${pluralize(days, "día", "días")}`;
  }
  // past
  if (days === 1) return "Ayer";
  if (days === 2) return "Antier";
  return `Hace ${days} ${pluralize(days, "día", "días")}`;
}

function pluralize(count: number, singular: string, plural: string): string {
  return Math.abs(count) === 1 ? singular : plural;
}

/**
 * Noches restantes hasta el final de la estadía (inclusivo en `endDate`).
 *
 * Convención de dominio (CONTEXT.md): `end_date` es la última noche, NO el
 * día de check-out. Una reserva del 11 al 12 ago tiene 2 noches y la noche
 * del 12 todavía está "disponible" cuando hoy = 12 ago.
 *
 * Cálculo: `(end - today + 1)` — el `+1` refleja que `end_date` es la
 * "Última Noche" (CONTEXT.md), no el día de check-out. Si hoy = end,
 * queda 1 noche (la última); si hoy = start, queda el total de la estancia.
 *
 * Recibe `todayKey`/`endKey` ya normalizados en `America/Santiago`.
 */
function nightsRemaining(todayKey: string, endKey: string): number {
  return Math.max(0, dateKeyToDayIndex(endKey) - dateKeyToDayIndex(todayKey) + 1);
}

/**
 * Meses restantes de una reserva `MONTHLY`. Usa `getInclusiveMonths` (ya
 * alineado con la semántica de fechas date-only del dominio).
 *
 * Recibe `todayKey`/`endKey` ya normalizados en `America/Santiago`.
 */
function monthsRemaining(todayKey: string, endKey: string): number {
  if (todayKey > endKey) return 0;
  // getInclusiveMonths trabaja con dateKeys de YYYY-MM-DD; lo pasamos
  // como strings y el helper parsea los primeros 10 chars.
  return getInclusiveMonths(todayKey, endKey);
}

// =============================================================================
// Helpers públicos para el Dashboard y otras vistas que muestran conteos
// relativos ("Llega en N días", "Finaliza en N días") en wall-time SCL.
// =============================================================================

/**
 * Días calendario entre `hoy` (en `America/Santiago`) y la fecha date-only
 * de `startDate`, sin reinterpretar el componente horario del string.
 *
 * Retorna:
 * - positivo si la reserva empieza en el futuro (N días faltan)
 * - 0 si la reserva empieza hoy
 * - negativo si la reserva ya pasó (atrás N días)
 *
 * Usado por el Dashboard para "Llega en N días" en lugar del patrón frágil
 * `Math.ceil((new Date(startDate) - today) / día)` que era timezone-sensible.
 */
export function daysUntilStart(
  startDate: string,
  now: Date = new Date(),
): number {
  const startKey = parseDateKey(startDate);
  const todayKey = getDateKeyInTz(now, BUSINESS_TIME_ZONE);
  return dateKeyToDayIndex(startKey) - dateKeyToDayIndex(todayKey);
}

/**
 * Días calendario entre `hoy` (en `America/Santiago`) y `endDate`.
 * Convención "Última Noche": si hoy = endDate, retorna 0 (la última noche
 * está en curso), no 1.
 */
export function daysUntilEnd(
  endDate: string,
  now: Date = new Date(),
): number {
  const endKey = parseDateKey(endDate);
  const todayKey = getDateKeyInTz(now, BUSINESS_TIME_ZONE);
  return dateKeyToDayIndex(endKey) - dateKeyToDayIndex(todayKey);
}

/**
 * Versión robusta de `getNights` (duración total de la estancia) que respeta
 * la convención del dominio "Última Noche": `end_date` es la última noche,
 * no el día de check-out → `(end_date - start_date + 1)`.
 *
 * Acepta `string` (ISO o date-only) o `Date` (Date se interpreta por día
 * calendario en `America/Santiago`, no como UTC midnight).
 *
 * Reemplaza al patrón local `Math.round((new Date(end) - new Date(start)) / día) + 1`
 * que era frágil ante timezones extremos y no estaba alineado con `CONTEXT.md`.
 */
export function getNights(startDate: string | Date, endDate: string | Date): number {
  const startKey = parseDateKey(typeof startDate === "string" ? startDate : toDateKeyLocal(startDate));
  const endKey = parseDateKey(typeof endDate === "string" ? endDate : toDateKeyLocal(endDate));
  return Math.max(1, dateKeyToDayIndex(endKey) - dateKeyToDayIndex(startKey) + 1);
}

/**
 * Para inputs Date (no strings), extrae el dateKey (`YYYY-MM-DD`) en
 * wall-time `America/Santiago`. Necesario porque `parseDateKey` solo
 * maneja strings — un `Date` siempre se interpreta con su zona.
 */
function toDateKeyLocal(date: Date): string {
  return getDateKeyInTz(date, BUSINESS_TIME_ZONE);
}

/**
 * Etiqueta humana del tiempo relativo al inicio de una reserva:
 * - "Hoy" si startDate es hoy
 * - "Mañana" si es mañana
 * - "Pasado mañana" si es en 2 días
 * - "En N días" para N >= 3
 *
 * Reemplaza al patrón crudo del Dashboard "Llega en N día(s)".
 */
export function labelDaysUntilStart(
  startDate: string,
  now: Date = new Date(),
): string {
  const days = daysUntilStart(startDate, now);
  if (days <= 0) return "Hoy";
  return relativeDaysLabel(days, "future");
}

/**
 * Etiqueta humana del tiempo relativo al fin de una reserva activa.
 *
 * - "Hoy" si endDate es hoy (última noche en curso)
 * - "Mañana" si endDate es mañana
 * - "Pasado mañana" si es en 2 días
 * - "En N días" para N >= 3
 *
 * Para reservas pasadas (days < 0), retorna "Hace N días".
 */
export function labelDaysUntilEnd(
  endDate: string,
  now: Date = new Date(),
): string {
  const days = daysUntilEnd(endDate, now);
  if (days < 0) {
    const abs = Math.abs(days);
    if (abs === 1) return "Ayer";
    if (abs < 7) return `Hace ${abs} días`;
    if (abs < 30) return `Hace ${Math.floor(abs / 7)} sem`;
    return `Hace ${Math.floor(abs / 30)} meses`;
  }
  return relativeDaysLabel(days, "future");
}
