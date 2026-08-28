"use client";

import Link from "next/link";
import { Building2 } from "lucide-react";
import { useState } from "react";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import {
  BUSINESS_TIME_ZONE,
  dateKeyToDayIndex,
  getDateKeyInTz,
} from "@/lib/domain/timezone";
import { getReservationTone, getNights } from "@/components/reservations/reservation-status";

/**
 * OccupancyStrip — Server Component compartido que renderiza una vista compacta
 * de ocupación por propiedad × días (estilo Stitch Ocean Breeze).
 *
 * Usado por `/dashboard` para mostrar la franja de ocupación al final de la página.
 * NO reemplaza al `CalendarTimeline` de `/calendar` (que es Client Component,
 * tiene month navigation, external blocks y tratamiento visual distinto).
 *
 * **Responsabilidad**: dibujar la grilla + pills de reservas. NO hace data fetching.
 *
 * **Reglas de uso**:
 * - Reservaciones pasadas: solo `DAILY` + no `CANCELLED` (filtrado interno).
 * - Propiedades: solo las que tienen reservas en el rango, hasta `maxProperties`.
 * - Pills clickeables: navegan a `${reservationLinkBase}?reservationId=${id}`.
 * - Color de pills: las reservas **activas** (en curso) usan `bg-primary`
 *   sólido; las **próximas** (aún no iniciadas) usan
 *   `border-primary/20 bg-primary/10`. Distinto del Timeline, que usa
 *   `brand-secondary` (decisión visual separada, NO migrar).
 */
interface Property {
  id: string;
  name: string;
  unitsAvailable?: number;
}

interface Reservation {
  id: string;
  propertyId: string;
  startDate: string;
  endDate: string;
  billingType: string;
  status: string;
  client: { id: string; name: string };
  property: Property;
}

interface OccupancyStripProps {
  /** Reservaciones a mostrar. Se filtran internamente a DAILY + no CANCELLED que solapen el rango. */
  reservations: Reservation[];
  /** Todas las propiedades disponibles. Solo se muestran las que tienen reservas en rango (hasta `maxProperties`). */
  properties: Property[];
  /** Cantidad de días desde `today` a renderizar en desktop. Default: 14. */
  days?: number;
  /** Cantidad de días en mobile (<640px). Default: 7. Override para tests. */
  daysMobile?: number;
  /** Máximo de propiedades a renderizar. Default: 6. */
  maxProperties?: number;
  /** Título del header. Default: "Calendario de ocupación". */
  title?: string;
  /** Fecha de referencia para el inicio del rango. Default: `new Date()`. Override para tests. */
  today?: Date;
  /** Base de la URL para los pills de reserva. Default: `/reservations`. */
  reservationLinkBase?: string;
  /**
   * Si se provee, el título se renderiza como bloque standalone AFUERA del card,
   * junto con un link "Ver todas" que apunta a esta URL (alineado con el patrón
   * canónico de `/dashboard` sección "Próximas reservas"). Si se omite, el título
   * se mantiene dentro del card (back-compat).
   */
  viewAllHref?: string;
  /** Label del link "Ver todas". Default: "Ver todas". */
  viewAllLabel?: string;
}

const WEEKEND_DAY_OF_WEEK = new Set([0, 6]); // Sun, Sat

const RANGE_OPTIONS = [7, 14, 30] as const;
type RangeOption = (typeof RANGE_OPTIONS)[number];

function addDays(d: Date, n: number): Date {
  const result = new Date(d);
  result.setDate(result.getDate() + n);
  return result;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Extrae el dateKey (`YYYY-MM-DD`) en `America/Santiago` de un Date o string
 * ISO. El string ISO del backend es UTC midnight — se interpreta como
 * date-only del dominio, no como el "día anterior" en SCL.
 */
function toDateKey(value: Date | string): string {
  if (typeof value === "string") {
    const m = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return value.slice(0, 10);
  }
  return getDateKeyInTz(value, BUSINESS_TIME_ZONE);
}

/**
 * Diferencia en días calendario entre dos dateKeys. Reemplaza al patrón
 * `Math.ceil((new Date(b) - new Date(a)) / día)` que era timezone-frágil.
 */
function dayIndexDiff(fromKey: string, toKey: string): number {
  return dateKeyToDayIndex(toKey) - dateKeyToDayIndex(fromKey);
}

function formatDayShort(d: Date): string {
  return d.toLocaleDateString("es-CL", { day: "numeric", timeZone: "America/Santiago" });
}

function formatMonthShort(d: Date): string {
  return d
    .toLocaleDateString("es-CL", { month: "short", timeZone: "America/Santiago" })
    .replace(".", "");
}

function formatWeekday(d: Date): string {
  return d.toLocaleDateString("es-CL", { weekday: "long", timeZone: "America/Santiago" });
}

function dayLetter(d: Date): string {
  return d
    .toLocaleDateString("es-CL", { weekday: "short", timeZone: "America/Santiago" })
    .charAt(0)
    .toUpperCase();
}

/**
 * Construye la línea descriptiva del header: día de semana del primer día y
 * fecha del último. Solo fechas — el conteo de días lo muestra el toggle
 * (7D/14D/30D) y el mes es implícito en las fechas (cross-month se ve solo:
 * "Miércoles 30 Ago — Viernes 5 Sept").
 */
function buildRangeLabel(start: Date, end: Date): string {
  const startWeekday = formatWeekday(start);
  const endWeekday = formatWeekday(end);
  return `${startWeekday} ${formatDayShort(start)} ${formatMonthShort(start)} — ${endWeekday} ${formatDayShort(end)} ${formatMonthShort(end)}`;
}

export function OccupancyStrip({
  reservations,
  properties,
  days = 14,
  daysMobile = 7,
  maxProperties = 6,
  title = "Calendario de ocupación",
  today,
  reservationLinkBase = "/reservations",
  viewAllHref,
  viewAllLabel = "Ver todas",
}: OccupancyStripProps) {
  // Responsive: reduce el rango en mobile (<640px) para evitar scroll horizontal.
  const isMobile = useMediaQuery("(max-width: 639px)");
  // Toggle solo disponible en desktop; mobile mantiene el rango compacto para caber.
  const [userRange, setUserRange] = useState<RangeOption>(days as RangeOption);
  const effectiveDays = isMobile ? daysMobile : userRange;
  // Ancho mínimo: 56px por día + 156px columna sticky de propiedad (mobile) | 224px (desktop).
  const propertyColumnWidth = isMobile ? 156 : 224;
  const minWidthPx = effectiveDays * 56 + propertyColumnWidth;

  const ref = today ?? new Date();
  // `ref` se mantiene como Date para formateo (formatDayShort etc.).
  // Para comparaciones day-level usamos `refKey` en wall-time SCL (ADR-0020),
  // lo cual evita el bug de timezone donde `new Date(startDate)` (UTC midnight)
  // no se comparaba correctamente contra `ref` (local midnight) en zonas UTC+.
  const refKey = getDateKeyInTz(ref, BUSINESS_TIME_ZONE);
  // calendarStart/End como dateKey para comparaciones day-level.
  const calendarStartKey = refKey;
  const calendarEndKey = dateKeyToDayIndex(refKey)
    ? getDateKeyInTz(addDays(ref, effectiveDays - 1), BUSINESS_TIME_ZONE)
    : refKey;

  const calendarStart = ref;
  const calendarEnd = addDays(ref, effectiveDays - 1);
  const calendarDays: Date[] = Array.from({ length: effectiveDays }, (_, i) => addDays(ref, i));

  // Índice del día de hoy dentro del rango. -1 si hoy está fuera del rango.
  const todayIndex = calendarDays.findIndex((day) => isSameDay(day, ref));

  const calendarReservations = reservations.filter((reservation) => {
    if (reservation.status === "CANCELLED" || reservation.billingType !== "DAILY") {
      return false;
    }
    // Comparación por dateKey (timezone-safe).
    const startKey = toDateKey(reservation.startDate);
    const endKey = toDateKey(reservation.endDate);
    return startKey <= calendarEndKey && endKey >= calendarStartKey;
  });

  const calendarProperties = properties
    .filter((property) =>
      calendarReservations.some((reservation) => reservation.propertyId === property.id)
    )
    .slice(0, maxProperties);

  const rangeLabel = buildRangeLabel(calendarStart, calendarEnd);

  // Summary: noches reservadas vs disponibles en el rango.
  // La capacidad considera unitsAvailable de cada propiedad (default 1 para compat).
  const totalUnits = properties.reduce(
    (sum, property) => sum + (property.unitsAvailable ?? 1),
    0
  );
  const totalAvailableNights = totalUnits * effectiveDays;
  const totalBookedNights = calendarReservations.reduce((sum, reservation) => {
    const startKey = toDateKey(reservation.startDate);
    const endKey = toDateKey(reservation.endDate);
    // Clip al rango visible del calendario (todo por dateKey).
    const visStartKey = startKey < calendarStartKey ? calendarStartKey : startKey;
    const visEndKey = endKey > calendarEndKey ? calendarEndKey : endKey;
    // Convención "Última Noche" (CONTEXT.md): end_date es la última noche, no
    // el día de check-out → cálculo inclusivo end-start+1.
    const nights = Math.max(0, dayIndexDiff(visStartKey, visEndKey) + 1);
    return sum + nights;
  }, 0);
  const occupancyPct =
    totalAvailableNights > 0 ? Math.round((totalBookedNights / totalAvailableNights) * 100) : 0;

  // Posición de la línea anchor de "hoy" en píxeles dentro del inner container.
  const todayAnchorLeft = `calc(${propertyColumnWidth}px + (${Math.max(0, todayIndex)} / ${effectiveDays}) * (100% - ${propertyColumnWidth}px))`;

  return (
    <div>
      {viewAllHref && (
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {title}
            </h2>
            <p className="mt-1 text-[10px] font-medium capitalize text-foreground/70">
              {rangeLabel}
            </p>
            <p className="mt-1 text-[10px] font-medium tabular-nums text-foreground/70">
              <span className="font-bold text-foreground">{totalBookedNights}</span>
              {" de "}
              {totalAvailableNights}
              {" noches · "}
              <span className="font-bold text-foreground">{occupancyPct}%</span>
              {" de ocupación"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {!isMobile && (
              <div className="flex items-center gap-1 rounded-full border border-border bg-muted p-1">
                {RANGE_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setUserRange(option)}
                    aria-pressed={userRange === option}
                    className={cn(
                      "rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors",
                      userRange === option
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {option}d
                  </button>
                ))}
              </div>
            )}
            <Link
              href={viewAllHref}
              className="shrink-0 text-[10px] font-bold uppercase text-primary hover:underline"
            >
              {viewAllLabel}
            </Link>
          </div>
        </div>
      )}
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        {viewAllHref ? null : (
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {title}
            </h2>
            <span className="text-[10px] font-bold text-foreground tabular-nums">
              {formatDayShort(calendarStart)} {formatMonthShort(calendarStart)} —{" "}
              {formatDayShort(calendarEnd)} {formatMonthShort(calendarEnd)}
            </span>
          </div>
        )}
        <div className="overflow-x-auto">
        <div style={{ minWidth: `${minWidthPx}px`, position: "relative" }}>
          {/* Today anchor line — vertical que recorre la grilla marcando el día actual.
              pointer-events-none para no bloquear clicks en pills. */}
          {todayIndex >= 0 && (
            <div
              className="pointer-events-none absolute top-0 bottom-0 z-10 w-[1.5px] bg-primary"
              style={{ left: todayAnchorLeft }}
              aria-hidden="true"
            />
          )}
          {/* Day headers */}
          <div className="flex border-b border-border bg-muted">
            <div className="sticky left-0 z-10 flex w-[156px] shrink-0 items-center border-r border-border bg-muted px-3 py-3 sm:w-[224px] sm:px-4">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Propiedad
              </span>
            </div>
            <div
              className="grid flex-1"
              style={{ gridTemplateColumns: `repeat(${effectiveDays}, minmax(0, 1fr))` }}
            >
              {calendarDays.map((day) => {
                const isWeekend = WEEKEND_DAY_OF_WEEK.has(day.getDay());
                const isToday = isSameDay(day, ref);
                return (
                  <div
                    key={day.toISOString()}
                    className={`border-r border-border px-1 py-3 text-center last:border-r-0 ${
                      isToday ? "bg-primary/10" : isWeekend ? "bg-muted" : ""
                    }`}
                  >
                    {isToday ? (
                      <>
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary align-middle text-[10px] font-bold text-primary-foreground">
                          {formatDayShort(day)}
                        </span>
                        <span className="text-[10px] font-bold text-muted-foreground">
                          {" "}
                          {dayLetter(day)}
                        </span>
                      </>
                    ) : (
                      <span className="text-[10px] font-bold text-muted-foreground">
                        {formatDayShort(day)} {dayLetter(day)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          {/* Property rows */}
          <div className="divide-y divide-border">
            {calendarProperties.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
                <Building2 className="size-5 text-muted-foreground" aria-hidden="true" />
                <p className="text-xs font-bold text-foreground">
                  {properties.length === 0
                    ? "Sin propiedades registradas"
                    : "Sin reservas en este rango"}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {properties.length === 0 ? (
                    <>
                      Agrega tu primera propiedad en{" "}
                      <Link href="/properties" className="font-bold text-primary hover:underline">
                        /properties
                      </Link>{" "}
                      para ver su ocupación aquí.
                    </>
                  ) : (
                    "Ninguna propiedad tiene reservas en las fechas visibles."
                  )}
                </p>
              </div>
            ) : (
              calendarProperties.map((property) => {
                const propReservations = calendarReservations.filter(
                  (r) => r.propertyId === property.id
                );
                return (
                  <div
                    key={property.id}
                    className="group flex h-14 transition-colors hover:bg-muted/40"
                  >
                    <div className="sticky left-0 z-10 flex w-[156px] shrink-0 items-center border-r border-border bg-card px-3 group-hover:bg-muted/40 sm:w-[224px] sm:px-4">
                      <span className="truncate text-xs font-bold text-foreground">
                        {property.name}
                      </span>
                    </div>
                    <div
                      className="relative flex-1"
                      style={{ gridTemplateColumns: `repeat(${effectiveDays}, minmax(0, 1fr))` }}
                    >
                      {/* Grid background — empty cells representing slots where events load */}
                      <div
                        className="pointer-events-none absolute inset-0 grid"
                        style={{ gridTemplateColumns: `repeat(${effectiveDays}, minmax(0, 1fr))` }}
                      >
                        {calendarDays.map((day) => {
                          const isWeekend = WEEKEND_DAY_OF_WEEK.has(day.getDay());
                          const isToday = isSameDay(day, ref);
                          return (
                            <div
                              key={`slot-${day.toISOString()}`}
                              className={`border-r border-border/60 last:border-r-0 ${
                                isToday
                                  ? "bg-primary/5"
                                  : isWeekend
                                    ? "bg-muted/40"
                                    : "bg-muted/10"
                              }`}
                            />
                          );
                        })}
                      </div>
                      {/* Reservation pills */}
                      {propReservations.map((reservation) => {
                        // Comparación por dateKey (timezone-safe) per ADR-0020.
                        // Antes: `rStart <= ref && rEnd >= ref` con UTC midnight vs
                        // local midnight — en zonas UTC+1, una reserva con
                        // start_date = hoy caía como "no activa" cuando debería estarlo.
                        const startKey = toDateKey(reservation.startDate);
                        const endKey = toDateKey(reservation.endDate);
                        const isActive =
                          getReservationTone(reservation.status, reservation.startDate, reservation.endDate, ref) === "success";
                        const visStartKey = startKey < calendarStartKey ? calendarStartKey : startKey;
                        const visEndKey = endKey > calendarEndKey ? calendarEndKey : endKey;
                        const startOffset = Math.max(0, dayIndexDiff(calendarStartKey, visStartKey));
                        const duration = Math.max(1, dayIndexDiff(visStartKey, visEndKey) + 1);
                        const leftPct = (startOffset / effectiveDays) * 100;
                        const widthPct = (duration / effectiveDays) * 100;
                        const nights = getNights(reservation.startDate, reservation.endDate);
                        return (
                          <Link
                            key={reservation.id}
                            href={`${reservationLinkBase}?reservationId=${reservation.id}`}
                            className={`absolute top-3 bottom-3 z-0 flex cursor-pointer items-center justify-center overflow-hidden rounded px-3 transition-all hover:brightness-95 ${
                              isActive
                                ? "bg-primary"
                                : "border border-primary/20 bg-primary/10"
                            }`}
                            style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                          >
                            <div className="flex flex-col items-center gap-0.5 overflow-hidden">
                              <span
                                className={`truncate text-[10px] font-bold ${
                                  isActive ? "text-primary-foreground" : "text-primary"
                                }`}
                              >
                                {reservation.client.name}
                              </span>
                              <span
                                className={`text-[8px] font-bold uppercase tracking-tighter ${
                                  isActive
                                    ? "text-primary-foreground/90"
                                    : "text-primary/80"
                                }`}
                              >
                                {nights} noches
                              </span>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}
