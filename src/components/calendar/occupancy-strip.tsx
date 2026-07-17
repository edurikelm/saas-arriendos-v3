import Link from "next/link";

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
  /** Cantidad de días desde `today` a renderizar. Default: 14. */
  days?: number;
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
   * canónico de `/dashboard` sección "Reservas Diarias"). Si se omite, el título
   * se mantiene dentro del card (back-compat).
   */
  viewAllHref?: string;
  /** Label del link "Ver todas". Default: "Ver todas". */
  viewAllLabel?: string;
}

const WEEKEND_DAY_OF_WEEK = new Set([0, 6]); // Sun, Sat

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

function daysBetween(from: Date, dateString: string): number {
  return Math.ceil((new Date(dateString).getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

function getNights(startDate: string, endDate: string): number {
  const diff = new Date(endDate).getTime() - new Date(startDate).getTime();
  return Math.round(diff / (1000 * 60 * 60 * 24)) + 1;
}

function formatDayShort(d: Date): string {
  return d.toLocaleDateString("es-CL", { day: "numeric", timeZone: "America/Santiago" });
}

function formatMonthShort(d: Date): string {
  return d
    .toLocaleDateString("es-CL", { month: "short", timeZone: "America/Santiago" })
    .replace(".", "");
}

function formatMonthLong(d: Date): string {
  return d
    .toLocaleDateString("es-CL", { month: "long", timeZone: "America/Santiago" })
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
 * Construye la línea descriptiva del header: día de semana del primer día,
 * rango, mes(es) y total de días. Si el rango cruza meses, los muestra ambos
 * (ej: "agosto – septiembre 2026"). Si es del mismo mes, muestra solo uno
 * capitalizado (ej: "julio 2026").
 */
function buildRangeLabel(start: Date, end: Date, days: number): string {
  const startWeekday = formatWeekday(start);
  const endWeekday = formatWeekday(end);
  const sameMonth =
    start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  const monthLabel = sameMonth
    ? `${formatMonthLong(start)} ${start.getFullYear()}`
    : `${formatMonthLong(start)} – ${formatMonthLong(end)} ${end.getFullYear()}`;
  return `${startWeekday} ${formatDayShort(start)} ${formatMonthShort(start)} — ${endWeekday} ${formatDayShort(end)} ${formatMonthShort(end)} · ${days} días · ${monthLabel}`;
}

export function OccupancyStrip({
  reservations,
  properties,
  days = 14,
  maxProperties = 6,
  title = "Calendario de ocupación",
  today,
  reservationLinkBase = "/reservations",
  viewAllHref,
  viewAllLabel = "Ver todas",
}: OccupancyStripProps) {
  const ref = today ?? new Date();
  ref.setHours(0, 0, 0, 0);

  const calendarStart = ref;
  const calendarEnd = addDays(ref, days - 1);
  const calendarDays: Date[] = Array.from({ length: days }, (_, i) => addDays(ref, i));

  const calendarReservations = reservations.filter((reservation) => {
    const start = new Date(reservation.startDate);
    const end = new Date(reservation.endDate);
    return (
      start <= calendarEnd &&
      end >= calendarStart &&
      reservation.status !== "CANCELLED" &&
      reservation.billingType === "DAILY"
    );
  });

  const calendarProperties = properties
    .filter((property) =>
      calendarReservations.some((reservation) => reservation.propertyId === property.id)
    )
    .slice(0, maxProperties);

  const rangeLabel = buildRangeLabel(calendarStart, calendarEnd, days);

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
          </div>
          <Link
            href={viewAllHref}
            className="shrink-0 text-[10px] font-bold uppercase text-primary hover:underline"
          >
            {viewAllLabel}
          </Link>
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
        <div className="min-w-[1000px]">
          {/* Day headers */}
          <div className="flex border-b border-border bg-muted">
            <div className="sticky left-0 z-10 flex w-[156px] shrink-0 items-center border-r border-border bg-muted px-3 py-3 sm:w-[224px] sm:px-4">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Propiedad
              </span>
            </div>
            <div
              className="grid flex-1"
              style={{ gridTemplateColumns: `repeat(${days}, minmax(0, 1fr))` }}
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
              <div className="px-6 py-8 text-center text-xs text-muted-foreground">
                Sin propiedades registradas
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
                      style={{ gridTemplateColumns: `repeat(${days}, minmax(0, 1fr))` }}
                    >
                      {/* Grid background — empty cells representing slots where events load */}
                      <div
                        className="pointer-events-none absolute inset-0 grid"
                        style={{ gridTemplateColumns: `repeat(${days}, minmax(0, 1fr))` }}
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
                        const rStart = new Date(reservation.startDate);
                        const rEnd = new Date(reservation.endDate);
                        const isActive =
                          rStart <= ref &&
                          rEnd >= ref &&
                          reservation.status !== "CANCELLED";
                        const visibleStart = rStart < calendarStart ? calendarStart : rStart;
                        const visibleEnd = rEnd > calendarEnd ? calendarEnd : rEnd;
                        const startOffset = Math.max(
                          0,
                          daysBetween(calendarStart, visibleStart.toISOString())
                        );
                        const duration = daysBetween(visibleStart, visibleEnd.toISOString()) + 1;
                        const leftPct = (startOffset / days) * 100;
                        const widthPct = (duration / days) * 100;
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
