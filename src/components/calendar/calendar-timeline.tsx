"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths, startOfWeek, endOfWeek } from "date-fns";
import { es } from "date-fns/locale/es";
import { ChevronLeft, ChevronRight, Calendar, Home, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { channelColors } from "@/lib/calendar/channel-colors";
import { computeScrollLeftForToday } from "@/lib/calendar/scroll";
import type { OverbookedDay } from "@/lib/calendar/conflicts";
import {
  assignTimelineLanes,
  getDayOffset,
  laneTop,
  timelineRowHeight,
  externalBlocksRowTop,
} from "@/lib/calendar/lanes";
import { getNights } from "@/components/reservations/reservation-status";
import { getInclusiveMonths } from "@/lib/reservation-dates";

interface Payment {
  id: string;
  amount: string;
  status: string;
  method: string;
  paymentType?: string | null;
  deletedAt?: string | null;
}

interface Property {
  id: string;
  name: string;
  color?: string;
}

interface Client {
  id: string;
  name: string;
  email: string;
}

interface Reservation {
  id: string;
  propertyId: string;
  clientId: string;
  startDate: string;
  endDate: string;
  billingType: string;
  unitsBooked: number;
  totalPrice: string;
  status: string;
  bookingAirbnb: boolean;
  notes: string | null;
  property: Property;
  client: Client;
  payments: Payment[];
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" | "success"; icon: React.ComponentType<{ className?: string }> }> = {
  PENDING: { label: "Pendiente", variant: "secondary", icon: AlertCircle },
  CONFIRMED: { label: "Confirmada", variant: "success", icon: CheckCircle2 },
  CANCELLED: { label: "Cancelada", variant: "destructive", icon: XCircle },
  COMPLETED: { label: "Completada", variant: "outline", icon: CheckCircle2 },
};

function formatPrice(price: string | number): string {
  return new Intl.NumberFormat("CLP", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(price));
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("es-CL", {
    day: "numeric",
    month: "short",
  });
}

function parseCalendarDate(dateString: string): Date {
  const [year, month, day] = dateString.slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day);
}

function isReservationEnded(res: Reservation): boolean {
  const end = parseCalendarDate(res.endDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return end < today || res.status === "COMPLETED";
}

function isReservationActive(res: Reservation): boolean {
  if (res.status === "CANCELLED") return false;
  const start = parseCalendarDate(res.startDate);
  const end = parseCalendarDate(res.endDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return start <= today && end >= today;
}

function getReservationsInDay(reservations: Reservation[], date: Date): Reservation[] {
  return reservations.filter((res) => {
    const start = parseCalendarDate(res.startDate);
    const end = parseCalendarDate(res.endDate);
    return date >= start && date <= end;
  });
}


interface CalendarDayCellProps {
  date: Date;
  currentMonth: Date;
  reservations: Reservation[];
  onSelectReservation: (id: string) => void;
  variant?: "minimal" | "comfortable" | "spacious";
}

export function CalendarDayCell({ date, currentMonth, reservations, onSelectReservation, variant = "comfortable" }: CalendarDayCellProps) {
  const dayReservations = getReservationsInDay(reservations, date);
  const isCurrentMonth = isSameMonth(date, currentMonth);
  const isToday = isSameDay(date, new Date());

  const padding = variant === "minimal" ? "p-1" : variant === "comfortable" ? "p-2" : "p-3";
  const textSize = variant === "minimal" ? "text-xs" : variant === "comfortable" ? "text-sm" : "text-base";

  if (dayReservations.length === 0) {
    return (
      <div className={`h-full min-h-24 border border-border ${padding} ${!isCurrentMonth ? "bg-muted/40" : ""}`}>
        <div className={`font-medium ${isToday ? "bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center" : "text-muted-foreground"} ${textSize}`}>
          {format(date, "d")}
        </div>
      </div>
    );
  }

  return (
    <div className={`h-full min-h-24 border border-border ${padding} ${!isCurrentMonth ? "bg-muted/40" : ""}`}>
      <div className={`font-medium mb-1 ${isToday ? "bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center" : "text-muted-foreground"} ${textSize}`}>
        {format(date, "d")}
      </div>
      <div className="space-y-1">
        {dayReservations.slice(0, variant === "spacious" ? 5 : variant === "comfortable" ? 3 : 2).map((res) => (
          <button
            key={res.id}
            onClick={() => onSelectReservation(res.id)}
            className={`w-full text-left rounded-md px-2 py-0.5 text-xs transition-all hover:scale-[1.02] ${
              res.status === "CANCELLED"
                ? "bg-muted text-muted-foreground line-through"
                : res.status === "COMPLETED"
                ? "bg-muted text-muted-foreground"
                : "text-white"
            }`}
            style={{
              backgroundColor: res.status === "CANCELLED" || res.status === "COMPLETED" ? undefined : "var(--brand-secondary)",
            }}
          >
            <span className="truncate block">{res.client.name}</span>
          </button>
        ))}
        {dayReservations.length > (variant === "spacious" ? 5 : variant === "comfortable" ? 3 : 2) && (
          <div className="text-xs text-muted-foreground pl-2">+{dayReservations.length - (variant === "spacious" ? 5 : 3)} más</div>
        )}
      </div>
    </div>
  );
}

interface CalendarMonthGridProps {
  reservations: Reservation[];
  currentMonth: Date;
  onSelectReservation: (id: string) => void;
  onMonthChange: (date: Date) => void;
  variant?: "minimal" | "comfortable" | "spacious";
}

export function CalendarMonthGrid({ reservations, currentMonth, onSelectReservation, onMonthChange, variant = "comfortable" }: CalendarMonthGridProps) {
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const weekDays = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

  const headerHeight = variant === "minimal" ? "h-8" : variant === "comfortable" ? "h-10" : "h-12";
  const dayCellMinHeight = variant === "minimal" ? "min-h-16" : variant === "comfortable" ? "min-h-24" : "min-h-32";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold capitalize">
          {format(currentMonth, "MMMM yyyy", { locale: es })}
        </h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => onMonthChange(subMonths(currentMonth, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => onMonthChange(new Date())}>
            Hoy
          </Button>
          <Button variant="outline" size="icon" onClick={() => onMonthChange(addMonths(currentMonth, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7">
        {weekDays.map((day) => (
          <div key={day} className={`${headerHeight} flex items-center justify-center font-medium text-muted-foreground text-sm border-b border-border`}>
            {day}
          </div>
        ))}
        {days.map((day, index) => (
          <div key={index} className={dayCellMinHeight}>
            <CalendarDayCell
              date={day}
              currentMonth={currentMonth}
              reservations={reservations}
              onSelectReservation={onSelectReservation}
              variant={variant}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

import type { CalendarExternalBlock } from "@/lib/actions/reservations";

function channelDotClass(channel: CalendarExternalBlock["channel"]): string {
  return channelColors[channel].dotClass;
}

function channelLabel(channel: CalendarExternalBlock["channel"]): string {
  switch (channel) {
    case "AIRBNB": return "A";
    case "BOOKING_COM": return "B";
    case "VRBO": return "V";
    case "OTHER": return "?";
  }
}

export function CalendarTimeline({ reservations, externalBlocks = [], overbookedDays = [], currentMonth, onSelectReservation, selectedPropertyId, properties }: {
  reservations: Reservation[];
  externalBlocks?: CalendarExternalBlock[];
  /** Días de sobreventa por propiedad — ver `computeOverbookedDays`. */
  overbookedDays?: OverbookedDay[];
  currentMonth: Date;
  onSelectReservation: (id: string) => void;
  selectedPropertyId?: string;
  properties?: Property[];
}) {
  // Derivados de `overbookedDays` para lookups O(1): uno para el dot del header
  // (marca el día si CUALQUIER propiedad está sobrevendida) y otro para la celda
  // de la fila específica de la propiedad afectada (`propertyId|date`).
  const overbookedDateKeys = useMemo(
    () => new Set(overbookedDays.map((d) => d.date)),
    [overbookedDays],
  );
  const overbookedCellKeys = useMemo(
    () => new Set(overbookedDays.map((d) => `${d.propertyId}|${d.date}`)),
    [overbookedDays],
  );
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  // Clave (yyyy-MM) del mes ya posicionado en "hoy" por el auto-scroll de abajo.
  // Evita re-scrollear en cada resize/medición mientras el usuario navega el
  // mismo mes (ver efecto de auto-scroll más abajo).
  const scrolledMonthKeyRef = useRef<string | null>(null);
  const [timelineViewportWidth, setTimelineViewportWidth] = useState(0);
  const [scrollState, setScrollState] = useState({ canScrollLeft: false, canScrollRight: false });
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const today = new Date();
  const propertyColumnWidth = timelineViewportWidth > 0 && timelineViewportWidth < 640 ? 156 : 224;
  const minDayWidth = 42;
  const dayWidth = Math.max(
    minDayWidth,
    timelineViewportWidth > propertyColumnWidth
      ? (timelineViewportWidth - propertyColumnWidth) / days.length
      : minDayWidth
  );
  const timelineWidth = propertyColumnWidth + days.length * dayWidth;
  // Misma noción de "hoy" que resalta la columna del header/fila más abajo
  // (isSameDay(day, today)) — el auto-scroll apunta exactamente a esa columna.
  const todayIndex = days.findIndex((day) => isSameDay(day, today));
  const monthKey = format(monthStart, "yyyy-MM");

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const updateScrollState = () => {
      setScrollState({
        canScrollLeft: container.scrollLeft > 1,
        canScrollRight: container.scrollLeft + container.clientWidth < container.scrollWidth - 1,
      });
    };

    const measure = () => {
      setTimelineViewportWidth(container.clientWidth);
      updateScrollState();
    };
    measure();
    container.addEventListener("scroll", updateScrollState, { passive: true });

    if (typeof ResizeObserver === "undefined") {
      return () => container.removeEventListener("scroll", updateScrollState);
    }

    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => {
      observer.disconnect();
      container.removeEventListener("scroll", updateScrollState);
    };
  }, [days.length, propertyColumnWidth]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const frame = window.requestAnimationFrame(() => {
      setScrollState({
        canScrollLeft: container.scrollLeft > 1,
        canScrollRight: container.scrollLeft + container.clientWidth < container.scrollWidth - 1,
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [timelineWidth]);

  // Auto-scroll a "hoy" al montar y cuando cambia el mes mostrado — no en cada
  // resize (guard vía scrolledMonthKeyRef) para no pelear con el usuario mientras
  // navega. Espera a que timelineViewportWidth tenga una medición real (>0): antes
  // de eso dayWidth cae al mínimo (42px) por defecto y el offset calculado sería
  // incorrecto. Sin animación (asignación directa) — Calm Water Rule (DESIGN.md).
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    if (timelineViewportWidth <= 0) return;
    if (scrolledMonthKeyRef.current === monthKey) return;

    container.scrollLeft = computeScrollLeftForToday({
      todayIndex: todayIndex === -1 ? null : todayIndex,
      dayWidth,
      propertyColumnWidth,
      clientWidth: timelineViewportWidth,
      contentWidth: timelineWidth,
    });
    scrolledMonthKeyRef.current = monthKey;
  }, [timelineViewportWidth, todayIndex, dayWidth, propertyColumnWidth, timelineWidth, monthKey]);

  const activeReservations = reservations.filter((res) => {
    const start = parseCalendarDate(res.startDate);
    const end = parseCalendarDate(res.endDate);
    return start <= monthEnd && end >= monthStart;
  });

  const groupedByProperty = activeReservations.reduce((acc, res) => {
    if (!acc[res.propertyId]) {
      acc[res.propertyId] = {
        property: res.property,
        reservations: [],
      };
    }
    acc[res.propertyId].reservations.push(res);
    return acc;
  }, {} as Record<string, { property: Property; reservations: Reservation[] }>);

  const propertyGroups = Object.values(groupedByProperty).sort((a, b) =>
    a.property.name.localeCompare(b.property.name)
  );

  return (
    <div className="relative overflow-hidden rounded-xl border border-t-2 border-t-primary bg-card">
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-y-0 left-0 z-40 w-8 bg-gradient-to-r from-card to-transparent transition-opacity duration-100 ${scrollState.canScrollLeft ? "opacity-100" : "opacity-0"}`}
        />
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-y-0 right-0 z-40 w-8 bg-gradient-to-l from-card to-transparent transition-opacity duration-100 ${scrollState.canScrollRight ? "opacity-100" : "opacity-0"}`}
        />
        <div ref={scrollContainerRef} className="overflow-x-auto timeline-scroll [scrollbar-gutter:stable]">
          <div className="min-w-max" role="grid" aria-label="Timeline de ocupación por propiedad y día" style={{ width: timelineWidth }}>
            <div className="sticky top-0 z-20 flex border-b bg-card/95 backdrop-blur supports-[backdrop-filter:blur(0px)]:bg-card/80" role="row">
              <div
                className="sticky left-0 z-30 flex shrink-0 items-center border-r bg-card/95 px-3 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground backdrop-blur sm:px-4"
                role="columnheader"
                style={{ width: propertyColumnWidth }}
              >
                Propiedad
              </div>
              {days.map((day) => {
                const dayKey = format(day, "yyyy-MM-dd");
                const isOverbooked = overbookedDateKeys.has(dayKey);
                const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                const isToday = isSameDay(day, today);
                return (
                  <div
                    key={day.toISOString()}
                    className={`relative shrink-0 border-r border-border/60 px-1 py-2 text-center ${isToday ? "bg-primary/10" : isWeekend ? "bg-secondary" : ""}`}
                    role="columnheader"
                    style={{ width: dayWidth }}
                  >
                    {isOverbooked && (
                      <span
                        className="absolute right-0.5 top-0.5 size-1.5 rounded-full bg-warning"
                        title="Sobreventa en al menos una propiedad este día"
                        aria-hidden="true"
                      />
                    )}
                    <div className={`mx-auto flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${isToday ? "bg-primary text-primary-foreground" : "text-foreground"}`}>
                      {format(day, "d")}
                    </div>
                    <div className={`mt-1.5 text-[10px] font-bold uppercase tracking-wider ${isToday ? "text-primary" : "text-muted-foreground"}`}>
                      {format(day, "EEE", { locale: es }).slice(0, 3)}
                    </div>
                  </div>
                );
              })}
            </div>

          {propertyGroups.length === 0 ? (
            <div className="flex min-h-40 items-center justify-center px-6 py-8 text-center">
              <div className="max-w-sm rounded-2xl border bg-background/80 p-6">
                <Calendar className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                <h3 className="font-semibold">
                  {selectedPropertyId && selectedPropertyId !== "all"
                    ? `Sin reservas en ${properties?.find((p) => p.id === selectedPropertyId)?.name ?? "esta propiedad"} este mes`
                    : "Sin reservas este mes"}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Cuando existan reservas, apareceran como barras por propiedad y rango de fechas.
                </p>
              </div>
            </div>
          ) : (
            propertyGroups.map(({ property, reservations: propReservations }) => {
              // Lane stacking: cada reserva va al primer carril libre en vez de
              // apilarse todas en el mismo `top`. Sin esto, reservas simultáneas
              // de la misma propiedad se dibujan una encima de otra y quedan
              // inclickeables. Ver `src/lib/calendar/lanes.ts`.
              const { entries: timelineReservations, laneCount } = assignTimelineLanes(
                propReservations,
                monthStart,
                days.length
              );

              // External blocks for this property in this month
              const propertyBlocks = externalBlocks
                .filter((b) => b.propertyId === property.id)
                .filter((b) => {
                  const start = parseCalendarDate(b.startDate);
                  const end = parseCalendarDate(b.endDate);
                  return start <= monthEnd && end >= monthStart;
                });

              const hasExternalBlocks = propertyBlocks.length > 0;
              const totalRowHeight = timelineRowHeight(laneCount, hasExternalBlocks);
              const externalRowTop = externalBlocksRowTop(laneCount);

              return (
                <div key={property.id} className="flex border-b border-border/60 last:border-b-0" role="row">
                  <div
                    className="sticky left-0 z-10 flex shrink-0 items-center border-r border-border/60 bg-card/95 px-3 py-3 backdrop-blur sm:px-4"
                    role="rowheader"
                    style={{ width: propertyColumnWidth }}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold leading-snug">{property.name}</span>
                      </div>
                      <div className="mt-1 hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex sm:gap-2">
                        <Home className="h-3 w-3 shrink-0" />
                        {propReservations.length} {propReservations.length === 1 ? "reserva" : "reservas"}
                      </div>
                    </div>
                  </div>
                  <div className="relative bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px)]" role="gridcell" style={{ width: days.length * dayWidth, height: totalRowHeight, backgroundSize: `${dayWidth}px 100%` }}>
                    {days.map((day, dayIndex) => {
                      const dayKey = format(day, "yyyy-MM-dd");
                      const cellIsToday = isSameDay(day, today);
                      const cellIsOverbooked = overbookedCellKeys.has(`${property.id}|${dayKey}`);
                      if (!cellIsToday && !cellIsOverbooked) return null;
                      return (
                        <div
                          key={day.toISOString()}
                          className="absolute top-0 h-full"
                          style={{ left: dayIndex * dayWidth, width: dayWidth }}
                        >
                          {cellIsToday && (
                            <div className="absolute inset-0 bg-primary/5 ring-1 ring-inset ring-primary/10" />
                          )}
                          {/* Sobreventa: fill + ring ámbar (`warning`), visualmente distinto
                              del tint teal de "hoy" — ambos pueden coexistir el mismo día. */}
                          {cellIsOverbooked && (
                            <div
                              className="absolute inset-0 bg-warning/15 ring-1 ring-inset ring-warning/50"
                              title="Sobreventa: unidades consumidas superan la disponibilidad"
                              aria-hidden="true"
                            />
                          )}
                        </div>
                      );
                    })}
                    {timelineReservations.map(({ item: res, leftOffset, duration, lane }) => {
                      const status = statusConfig[res.status] || statusConfig.PENDING;
                      const StatusIcon = status.icon;
                      const isCancelled = res.status === "CANCELLED";
                      const ended = isReservationEnded(res);
                      const active = !isCancelled && !ended && isReservationActive(res);

// Status → bar color mapping (per DESIGN.md Status Color Doctrine):
//   - CONFIRMED active  → solid primary (Verdigris)
//   - CONFIRMED upcoming → primary/10 tint (upcoming reservation, no salience)
//   - PENDING             → warning/10 tint (Amber Hour = "saldo pendiente" — DESIGN.md:209)
//   - CANCELLED           → destructive bg with line-through
//   - COMPLETED (ended)   → muted bg + line-through (terminal, faded)
//
// PENDING vs CONFIRMED-upcoming differentiation: ambas son "no iniciadas" pero PENDING
// carga peso semántico (dinero pendiente). Mismo bg-tint, distinto accent token.
                      // Dos dimensiones ortogonales, no una escalera:
                      //   HUE   = estado de pago  (warning = debe / success = pagada)
                      //   PESO  = temporalidad    (sólido = en curso / tinte = futura)
                      //
                      // Antes `active` se evaluaba ANTES de `PENDING`, y como
                      // `isReservationActive` solo excluye canceladas, una reserva con
                      // saldo pendiente que ya empezó se pintaba con el sólido de
                      // "confirmada": idéntica a una pagada. El único rastro que quedaba
                      // era el ícono ámbar sobre verde, medido en 1.11:1 — invisible.
                      // Ahora el estado de pago elige el tono y la temporalidad el peso,
                      // así que ninguna de las dos se come a la otra.
                      //
                      // CONFIRMED usa `success`, no `primary`: la Status Color Doctrine
                      // (DESIGN.md) mapea CONFIRMED → success, que además es lo que ya
                      // dice la leyenda. `primary` no tiene compañero `-text` legible,
                      // que es la razón de fondo por la que el tinte quedaba en 2.09:1.
                      //
                      // Los tintes usan `-text` y no el token de relleno, por la
                      // Fill-vs-Text Rule. Cancelada pasa de sólido a tinte: en sólido
                      // medía 3.76:1 y además una reserva cancelada no necesita gritar.
                      // INTERIM: la barra de CONFIRMED en curso queda con `primary`
                      // sólido, sin tocar. Migrarla a `success` (que es lo que manda
                      // la Status Color Doctrine) empeoraba su contraste en oscuro de
                      // 2.17:1 a 1.66:1, porque en oscuro `--success-foreground` es
                      // `oklch(0.85)` sobre un relleno `oklch(0.70)`: claro sobre claro.
                      // Ningún token existente sirve para texto sobre relleno en AMBOS
                      // temas —el relleno tiene lightness media en los dos— así que los
                      // sólidos necesitan trabajo de tokens y se resuelven aparte. Acá
                      // solo se toma lo que no regresiona.
                      const isPending = res.status === "PENDING";
                      const barClass = isCancelled
                        ? "border-destructive/30 bg-destructive/10 text-destructive-text line-through"
                        : ended
                        ? "border-border bg-muted text-muted-foreground line-through decoration-muted-foreground/60"
                        : isPending
                        ? active
                          // Tinte + borde a full en vez de relleno: el borde es elemento
                          // gráfico (umbral 3:1) y distingue "en curso" sin poner texto
                          // encima de un relleno, que es donde se cae el contraste.
                          ? "border-warning bg-warning/10 text-warning-text"
                          : "border-warning/30 bg-warning/10 text-warning-text"
                        : active
                        ? "border-primary/30 bg-primary text-primary-foreground"
                        : "border-success/20 bg-success/10 text-success-text";

                      // El ícono hereda el mismo par tono/peso que la barra: sobre un
                      // relleno va el `-foreground`, sobre un tinte va el `-text`.
                      // Antes el ícono de PENDING era `text-warning` (token de relleno)
                      // y, con el bug de arriba, terminaba ámbar sobre verde sólido:
                      // 1.11:1 en claro, 1.16:1 en oscuro.
                      const iconColorClass = isCancelled
                        ? "text-destructive-text"
                        : ended
                        ? "text-muted-foreground"
                        : isPending
                        ? "text-warning-text"
                        : active
                        ? "text-success-foreground" // sin cambios: sobre el sólido primary mide 5.65:1
                        : "text-success-text";

                      const isMonthly = res.billingType === "MONTHLY";

                      // Badge de duración — adapts to bar bg for color cohesion.
                      // MONTHLY muestra "Nm" (cuotas mensuales), no "Nn" (noches):
                      // una mensual se cobra por mes fijo, no por noche (CONTEXT.md
                      // "Precio"), así que contar noches en la barra sugeriría una
                      // unidad de facturación que no es la real — un número grande
                      // y plausible pero engañoso (ej. "90n" para una reserva de 3
                      // cuotas). "Nm" usa `getInclusiveMonths`, el mismo cálculo con
                      // el que se deriva el precio y con el que ya se diferencia
                      // MONTHLY en `ReservationPreviewDialog` ("X meses" vs "X
                      // noches") — mismo lenguaje visual, sin inventar un componente
                      // nuevo ni tocar el color (Status Color Doctrine sigue
                      // codificando solo estado).
                      // El chip sigue el mismo par tono/peso que la barra y el ícono.
                      // `bg-white/20` se fue: sobre un tinte claro aclaraba el chip
                      // hasta desaparecer, y arrastraba los tokens de relleno como
                      // color de texto igual que el resto.
                      const badgeClass = isCancelled
                        ? "bg-destructive/15 text-destructive-text"
                        : ended
                        ? "bg-foreground/10 text-muted-foreground"
                        : isPending
                        ? "bg-warning/20 text-warning-text"
                        : active
                        ? "bg-white/20 text-primary-foreground" // sin cambios, va sobre el sólido
                        : "bg-success/20 text-success-text";

                      // Progressive disclosure del contenido según el ancho disponible.
                      // Barras estrechas (<90px): ocultan chip de duración (noches/meses).
                      // Barras muy estrechas (<60px): ocultan también el icono (solo nombre).
                      // Barras mínimas (<36px): ocultan todo excepto el dot de status.
                      const barWidthPx = Math.max(duration * dayWidth - 8, 34);
                      const showDurationBadge = barWidthPx >= 90;
                      const showStatusIcon = barWidthPx >= 60;
                      const showClientName = barWidthPx >= 36;
                      const durationLabel = isMonthly
                        ? `${getInclusiveMonths(res.startDate, res.endDate)} meses`
                        : `${getNights(res.startDate, res.endDate)} noches`;
                      const ariaLabel = [
                        res.client.name,
                        statusConfig[res.status]?.label ?? res.status,
                        durationLabel,
                        `${formatDate(res.startDate)} a ${formatDate(res.endDate)}`,
                      ].join(", ");

                      return (
                        <button
                          key={res.id}
                          onClick={() => onSelectReservation(res.id)}
                          aria-label={ariaLabel}
                          className={`group absolute flex h-8 items-center gap-1.5 overflow-hidden rounded-md border px-2 text-left text-xs transition-all hover:z-20 focus-visible:z-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:gap-2 sm:px-3 ${barClass}`}
                          style={{
                            left: `${leftOffset * dayWidth + 4}px`,
                            top: `${laneTop(lane)}px`,
                            width: `${barWidthPx}px`,
                          }}
                          title={ariaLabel}
                        >
                          {showStatusIcon && (
                            <StatusIcon
                              aria-hidden="true"
                              className={`h-3.5 w-3.5 shrink-0 opacity-90 ${iconColorClass}`}
                            />
                          )}
                          {showClientName && (
                            <span className="min-w-0 flex-1 truncate font-semibold">{res.client.name}</span>
                          )}
                          {!showClientName && (
                            // Dot único cuando la barra es demasiado estrecha para texto
                            <span
                              aria-hidden="true"
                              className={`mx-auto h-1.5 w-1.5 shrink-0 rounded-full ${iconColorClass}`}
                            />
                          )}
                          {showDurationBadge && (
                            <span aria-hidden="true" className={`hidden shrink-0 rounded-sm px-1.5 py-0.5 font-medium sm:inline-flex ${badgeClass}`}>
                              {isMonthly ? `${getInclusiveMonths(res.startDate, res.endDate)}m` : `${getNights(res.startDate, res.endDate)}n`}
                            </span>
                          )}
                        </button>
                      );
                    })}

                    {/* External blocks sub-row */}
                    {propertyBlocks.length > 0 && propertyBlocks.map((block) => {
                      const start = parseCalendarDate(block.startDate);
                      const end = parseCalendarDate(block.endDate);
                      const leftOffset = Math.max(0, getDayOffset(start, monthStart));
                      const rightOffset = Math.min(days.length - 1, getDayOffset(end, monthStart));
                      const duration = rightOffset - leftOffset + 1;
                      const blockWidthPx = Math.max(duration * dayWidth - 8, 34);
                      const showChannelLabel = blockWidthPx >= 70;
                      const channelName = block.channel === "AIRBNB" ? "Airbnb" : block.channel === "BOOKING_COM" ? "Booking.com" : block.channel === "VRBO" ? "VRBO" : "Otro canal";
                      return (
                        <div
                          key={block.id}
                          className="absolute flex h-6 cursor-default items-center gap-1.5 overflow-hidden rounded-md border border-dashed border-foreground/40 bg-foreground/[0.04] px-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground backdrop-blur-sm"
                          style={{
                            left: `${leftOffset * dayWidth + 4}px`,
                            top: `${externalRowTop}px`,
                            width: `${blockWidthPx}px`,
                          }}
                          title={`${channelName} — No disponible`}
                        >
                          <span aria-hidden="true" className={`h-2.5 w-2.5 shrink-0 rounded-full ${channelDotClass(block.channel)}`} />
                          {showChannelLabel && <span className="truncate">{channelLabel(block.channel)}</span>}
                        </div>
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
  );
}

export function CalendarList({ reservations, currentMonth, onSelectReservation }: {
  reservations: Reservation[];
  currentMonth: Date;
  onSelectReservation: (id: string) => void;
}) {
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);

  const monthReservations = reservations.filter((res) => {
    const start = parseCalendarDate(res.startDate);
    const end = parseCalendarDate(res.endDate);
    return start <= monthEnd && end >= monthStart;
  }).sort((a, b) => parseCalendarDate(a.startDate).getTime() - parseCalendarDate(b.startDate).getTime());

  if (monthReservations.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Calendar className="h-12 w-12 mx-auto mb-4" />
        <p>No hay reservas en este mes</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {monthReservations.map((res) => {
        const status = statusConfig[res.status] || statusConfig.PENDING;
        const StatusIcon = status.icon;
        const nights = getNights(res.startDate, res.endDate);

        return (
          <button
            key={res.id}
            onClick={() => onSelectReservation(res.id)}
            className="w-full text-left group flex items-center gap-4 rounded-xl border border-border/50 bg-card p-4 transition-all duration-200 hover:border-foreground/20"
          >
            <div
              className="h-12 w-12 shrink-0 rounded-xl flex items-center justify-center text-white font-semibold text-lg"
              style={{ backgroundColor: "var(--brand-secondary)" }}
            >
              {format(parseCalendarDate(res.startDate), "d")}
            </div>

            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold text-foreground truncate">
                  {res.client.name}
                </h3>
                <StatusIcon className={`h-4 w-4 shrink-0 ${status.variant === "destructive" ? "text-destructive-text" : status.variant === "success" ? "text-success" : "text-muted-foreground"}`} />
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Home className="h-3 w-3" />
                  {res.property.name}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {nights} noches
                </span>
              </div>
            </div>

            <div className="text-right shrink-0">
              <p className="font-bold text-foreground">{formatPrice(res.totalPrice)}</p>
              <p className="text-xs text-muted-foreground">
                {formatDate(res.startDate)} - {formatDate(res.endDate)}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

export function CalendarWeekView({ reservations, onSelectReservation }: {
  reservations: Reservation[];
  currentMonth: Date;
  onSelectReservation: (id: string) => void;
}) {
  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const weekReservations = reservations.filter((res) => {
    const start = parseCalendarDate(res.startDate);
    const end = parseCalendarDate(res.endDate);
    return start <= weekEnd && end >= weekStart;
  });

  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">
        Semana del {format(weekStart, "d")} al {format(weekEnd, "d MMM", { locale: es })}
      </h2>

      <div className="overflow-x-auto">
        <div className="min-w-2xl">
          <div className="grid grid-cols-8 border-b border-border">
            <div className="p-2 text-sm text-muted-foreground">Hora</div>
            {days.map((day) => (
              <div key={day.toISOString()} className={`p-2 text-center text-sm font-medium ${isSameDay(day, today) ? "bg-primary/10" : ""}`}>
                <div className="text-xs text-muted-foreground">{format(day, "EEE", { locale: es })}</div>
                <div className={isSameDay(day, today) ? "bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center mx-auto mt-1" : ""}>
                  {format(day, "d")}
                </div>
              </div>
            ))}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {hours.map((hour) => (
              <div key={hour} className="grid grid-cols-8 border-b border-border/60">
                <div className="p-2 text-xs text-muted-foreground">
                  {hour.toString().padStart(2, "0")}:00
                </div>
                {days.map((day) => {
                  const dayReservations = weekReservations.filter((res) => {
                    const start = parseCalendarDate(res.startDate);
                    const end = parseCalendarDate(res.endDate);
                    return isSameDay(day, start) || isSameDay(day, end) || (day > start && day < end);
                  });

                  return (
                    <div key={`${day.toISOString()}-${hour}`} className="relative p-1 border-l border-border/60 min-h-12">
                      {dayReservations
                        .filter((res) => {
                          const start = parseCalendarDate(res.startDate);
                          const end = parseCalendarDate(res.endDate);
                          const resStartHour = start.getHours();
                          const resEndHour = end.getHours();
                          return isSameDay(day, start) ? resStartHour <= hour && resStartHour + 1 > hour :
                                 isSameDay(day, end) ? resEndHour >= hour && resEndHour < hour + 1 :
                                 hour >= resStartHour && hour < resEndHour;
                        })
                        .map((res) => (
                          <button
                            key={res.id}
                            onClick={() => onSelectReservation(res.id)}
                            className="w-full text-left text-xs rounded px-1 py-0.5 text-white mb-1 truncate"
style={{ backgroundColor: "var(--brand-secondary)" }}
                          >
                            {res.client.name}
                          </button>
                        ))}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
