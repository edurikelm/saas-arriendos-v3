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
 * - Color de pills: alterna `bg-primary` sólido y `border-primary/20 bg-primary/10`
 *   entre filas pares/impares (patrón Stitch). Distinto del Timeline, que usa
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

function dayLetter(d: Date): string {
  return d
    .toLocaleDateString("es-CL", { weekday: "short", timeZone: "America/Santiago" })
    .charAt(0)
    .toUpperCase();
}

export function OccupancyStrip({
  reservations,
  properties,
  days = 14,
  maxProperties = 6,
  title = "Calendario de ocupación",
  today,
  reservationLinkBase = "/reservations",
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

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {title}
        </h2>
        <span className="text-[10px] font-bold text-foreground tabular-nums">
          {formatDayShort(calendarStart)} {formatMonthShort(calendarStart)} —{" "}
          {formatDayShort(calendarEnd)} {formatMonthShort(calendarEnd)}
        </span>
      </div>
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
              calendarProperties.map((property, propertyIdx) => {
                const propReservations = calendarReservations.filter(
                  (r) => r.propertyId === property.id
                );
                // Alternar variantes de teal por fila (par = sólido bg-primary, impar = claro bg-primary/10).
                // Patrón Stitch: row 1/3 sólido, row 2/4 claro.
                const isAltRow = propertyIdx % 2 === 1;
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
                      {/* Reservation pills */}
                      {propReservations.map((reservation) => {
                        const rStart = new Date(reservation.startDate);
                        const rEnd = new Date(reservation.endDate);
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
                              isAltRow
                                ? "border border-primary/20 bg-primary/10"
                                : "bg-primary"
                            }`}
                            style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                          >
                            <div className="flex flex-col items-center gap-0.5 overflow-hidden">
                              <span
                                className={`truncate text-[10px] font-bold ${
                                  isAltRow ? "text-primary" : "text-primary-foreground"
                                }`}
                              >
                                {reservation.client.name}
                              </span>
                              <span
                                className={`text-[8px] font-bold uppercase tracking-tighter ${
                                  isAltRow
                                    ? "text-primary/80"
                                    : "text-primary-foreground/90"
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
  );
}
