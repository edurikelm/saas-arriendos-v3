"use client";

import { useEffect, useRef, useState } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths, startOfWeek, endOfWeek } from "date-fns";
import { es } from "date-fns/locale/es";
import { ChevronLeft, ChevronRight, Calendar, Home, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { channelColors } from "@/lib/calendar/channel-colors";
import { getBarTextColor } from "@/lib/calendar/bar-text-color";
import { getNights } from "@/components/reservations/reservation-status";

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

type TimelineReservation = {
  res: Reservation;
  leftOffset: number;
  duration: number;
};

function getDayOffset(date: Date, monthStart: Date): number {
  return Math.floor((date.getTime() - monthStart.getTime()) / (1000 * 60 * 60 * 24));
}

function assignTimelineLanes(
  reservations: Reservation[],
  monthStart: Date,
  monthLength: number
): TimelineReservation[] {
  return reservations.map((res) => {
    const start = parseCalendarDate(res.startDate);
    const end = parseCalendarDate(res.endDate);
    const leftOffset = Math.max(0, getDayOffset(start, monthStart));
    const rightOffset = Math.min(monthLength - 1, getDayOffset(end, monthStart));
    const duration = rightOffset - leftOffset + 1;

    return {
      res,
      leftOffset,
      duration,
    };
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

export function CalendarTimeline({ reservations, externalBlocks = [], conflicts = new Set(), currentMonth, onSelectReservation, selectedPropertyId, properties }: {
  reservations: Reservation[];
  externalBlocks?: CalendarExternalBlock[];
  conflicts?: Set<string>;
  currentMonth: Date;
  onSelectReservation: (id: string) => void;
  selectedPropertyId?: string;
  properties?: Property[];
}) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
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
                const hasConflict = conflicts.has(dayKey);
                return (
                  <div
                    key={day.toISOString()}
                    className={`relative shrink-0 border-r border-border/60 px-1 py-2 text-center ${isSameDay(day, today) ? "bg-primary/10" : ""}`}
                    role="columnheader"
                    style={{ width: dayWidth }}
                  >
                    {hasConflict && (
                      <span
                        className="absolute right-0.5 top-0.5 size-1.5 rounded-full bg-warning"
                        aria-hidden="true"
                      />
                    )}
                    <div className={`mx-auto flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${isSameDay(day, today) ? "bg-primary text-primary-foreground" : "text-foreground"}`}>
                      {format(day, "d")}
                    </div>
                    <div className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
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
                    : "Sin reservas diarias este mes"}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Cuando existan reservas, apareceran como barras por propiedad y rango de fechas.
                </p>
              </div>
            </div>
          ) : (
            propertyGroups.map(({ property, reservations: propReservations }) => {
              const sortedReservations = [...propReservations].sort((a, b) =>
                parseCalendarDate(a.startDate).getTime() - parseCalendarDate(b.startDate).getTime()
              );
              const timelineReservations = assignTimelineLanes(sortedReservations, monthStart, days.length);

              // External blocks for this property in this month
              const propertyBlocks = externalBlocks
                .filter((b) => b.propertyId === property.id)
                .filter((b) => {
                  const start = parseCalendarDate(b.startDate);
                  const end = parseCalendarDate(b.endDate);
                  return start <= monthEnd && end >= monthStart;
                });

              const ROW_HEIGHT = 76;
              const EXT_ROW_HEIGHT = 32;
              const totalRowHeight = ROW_HEIGHT + (propertyBlocks.length > 0 ? EXT_ROW_HEIGHT : 0);

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
                        {sortedReservations.length} {sortedReservations.length === 1 ? "reserva" : "reservas"}
                      </div>
                    </div>
                  </div>
                  <div className="relative bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px)]" role="gridcell" style={{ width: days.length * dayWidth, height: totalRowHeight, backgroundSize: `${dayWidth}px 100%` }}>
                    {days.map((day, dayIndex) => isSameDay(day, today) ? (
                      <div
                        key={day.toISOString()}
                        className="absolute top-0 h-full bg-primary/5 ring-1 ring-inset ring-primary/10"
                        style={{ left: dayIndex * dayWidth, width: dayWidth }}
                      />
                    ) : null)}
                    {timelineReservations.map(({ res, leftOffset, duration }) => {
                      const status = statusConfig[res.status] || statusConfig.PENDING;
                      const StatusIcon = status.icon;
                      const isCancelled = res.status === "CANCELLED";
                      const ended = isReservationEnded(res);
                      const active = !isCancelled && !ended && isReservationActive(res);

                      // Stitch-style alternation: active (solid property.color) vs upcoming (property.color/10)
                      // property.color is user-set; luminance helper ensures WCAG AA text contrast (4.5:1).
                      const barTextColor = getBarTextColor(res.property.color);
                      const barClass = isCancelled
                        ? "border-border bg-muted text-muted-foreground line-through"
                        : ended
                        ? "border-border bg-muted text-muted-foreground opacity-75 line-through decoration-muted-foreground/60"
                        : active
                        ? `border-[var(--brand-secondary)] ${barTextColor}`
                        : `border-[var(--brand-secondary)]/20 ${barTextColor}`;

                      return (
                        <button
                          key={res.id}
                          onClick={() => onSelectReservation(res.id)}
                          className={`group absolute flex h-8 items-center gap-1.5 overflow-hidden rounded-md border px-2 text-left text-xs transition-all hover:z-20 focus-visible:z-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:gap-2 sm:px-3 ${barClass}`}
                          style={{
                            left: `${leftOffset * dayWidth + 4}px`,
                            top: "12px",
                            width: `${Math.max(duration * dayWidth - 8, 34)}px`,
                            backgroundColor: isCancelled || ended
                              ? undefined
                              : active
                              ? res.property.color || "var(--brand-secondary)"
                              : res.property.color
                              ? `${res.property.color}1a` // 10% opacity hex
                              : "var(--brand-secondary)",
                            borderColor: isCancelled || ended
                              ? undefined
                              : active
                              ? res.property.color || "var(--brand-secondary)"
                              : res.property.color
                              ? `${res.property.color}33` // 20% opacity hex
                              : "var(--brand-secondary)",
                          }}
                          title={`${res.client.name} - ${formatDate(res.startDate)} a ${formatDate(res.endDate)}`}
                        >
                          <StatusIcon className="h-3.5 w-3.5 shrink-0 opacity-90" />
                          <span className="min-w-0 flex-1 truncate font-semibold">{res.client.name}</span>
                          <span className="hidden shrink-0 rounded-sm bg-white/20 px-1.5 py-0.5 font-medium text-foreground sm:inline-flex">
                            {getNights(res.startDate, res.endDate)}n
                          </span>
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
                      return (
                        <div
                          key={block.id}
                          className="absolute flex h-5 cursor-default items-center gap-1 overflow-hidden rounded-md border border-dashed border-foreground/40 bg-foreground/[0.04] px-1.5 text-[10px] font-medium text-muted-foreground backdrop-blur-sm"
                          style={{
                            left: `${leftOffset * dayWidth + 4}px`,
                            top: "56px",
                            width: `${Math.max(duration * dayWidth - 8, 34)}px`,
                          }}
                          title={`${block.channel === "AIRBNB" ? "Airbnb" : block.channel === "BOOKING_COM" ? "Booking.com" : block.channel === "VRBO" ? "VRBO" : "Otro canal"} — Not available`}
                        >
                          <span className={`h-2 w-2 rounded-full ${channelDotClass(block.channel)}`} />
                          <span>{channelLabel(block.channel)}</span>
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
                <StatusIcon className={`h-4 w-4 shrink-0 ${status.variant === "destructive" ? "text-destructive" : status.variant === "success" ? "text-success" : "text-muted-foreground"}`} />
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
