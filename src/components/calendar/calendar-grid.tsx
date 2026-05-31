"use client";

import { useState, useMemo, type CSSProperties, type ReactNode } from "react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  differenceInDays,
  getDay,
} from "date-fns";
import { es } from "date-fns/locale";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CalendarReservation } from "@/lib/actions/reservations";

function getContrastColor(hexColor: string): string {
  const hex = hexColor.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? "#000000" : "#FFFFFF";
}

function isReservationEnded(res: CalendarReservation): boolean {
  const end = parseCalendarDate(res.endDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return end < today || res.status === "COMPLETED";
}

function getReservationColor(res: CalendarReservation): string {
  return res.property.color || "#6366F1";
}

function parseCalendarDate(dateString: string): Date {
  const [year, month, day] = dateString.slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day);
}

interface CalendarGridProps {
  reservations: CalendarReservation[];
  onSelectReservation?: (id: string) => void;
  onDateClick?: (date: Date) => void;
  headerActions?: ReactNode;
}

function getWeeks(days: Date[]): Date[][] {
  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }
  return weeks;
}

interface WeekReservation {
  res: CalendarReservation;
  startCol: number;
  span: number;
  lane: number;
}

function assignLanes(weekReservations: WeekReservation[]): WeekReservation[] {
  const lanes: { endCol: number }[] = [];
  weekReservations.sort((a, b) => a.startCol - b.startCol);

  for (const wr of weekReservations) {
    let assigned = false;
    for (let i = 0; i < lanes.length; i++) {
      if (lanes[i].endCol <= wr.startCol) {
        lanes[i] = { endCol: wr.startCol + wr.span };
        wr.lane = i;
        assigned = true;
        break;
      }
    }
    if (!assigned) {
      wr.lane = lanes.length;
      lanes.push({ endCol: wr.startCol + wr.span });
    }
  }

  return weekReservations;
}

export function CalendarGrid({
  reservations,
  onSelectReservation,
  onDateClick,
  headerActions,
}: CalendarGridProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(() => new Set());
  const [hoveredWeek, setHoveredWeek] = useState<number | null>(null);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  const weeks = getWeeks(days);

  const navigateMonth = (direction: "prev" | "next") => {
    setCurrentDate((prev) =>
      direction === "prev" ? subMonths(prev, 1) : addMonths(prev, 1)
    );
  };

  const weeksData = useMemo(() => {
    return weeks.map((week) => {
      const weekStart = week[0];
      const weekEnd = week[6];

      const intersecting = reservations.filter((res) => {
        const start = parseCalendarDate(res.startDate);
        const end = parseCalendarDate(res.endDate);
        return start <= weekEnd && end >= weekStart;
      });

      const wrs: WeekReservation[] = intersecting.map((res) => {
        const start = parseCalendarDate(res.startDate);
        const end = parseCalendarDate(res.endDate);

        const firstVisibleDay = start < weekStart ? weekStart : start;
        const lastVisibleDay = end > weekEnd ? weekEnd : end;

        const startCol = getDay(firstVisibleDay);
        const span = differenceInDays(lastVisibleDay, firstVisibleDay) + 1;

        return {
          res,
          startCol,
          span,
          lane: 0,
        };
      });

      const withLanes = assignLanes(wrs);

      return {
        week,
        weekReservations: withLanes,
        numLanes:
          withLanes.length > 0
            ? Math.max(...withLanes.map((w) => w.lane)) + 1
            : 0,
      };
    });
  }, [weeks, reservations]);

  const maxVisibleLanes = 2;

  const toggleExpandedWeek = (weekIndex: number) => {
    setExpandedWeeks((prev) => {
      const next = new Set(prev);
      if (next.has(weekIndex)) {
        next.delete(weekIndex);
      } else {
        next.add(weekIndex);
      }
      return next;
    });
  };

  return (
    <div className="space-y-2 lg:flex lg:h-full lg:min-h-0 lg:flex-col lg:space-y-3">
      <div className="grid gap-2 sm:gap-3 lg:grid-cols-[1fr_auto_1fr] lg:items-end">
        <div className="min-w-0 leading-tight">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground sm:text-xs">
            Calendario mensual de reservas diarias
          </p>
          <h2 className="text-lg font-bold capitalize tracking-tight sm:text-2xl">
            {format(currentDate, "MMMM yyyy", { locale: es })}
          </h2>
        </div>
        <div className="flex w-fit items-center gap-1 rounded-full border bg-background/80 p-0.5 shadow-sm sm:gap-2 sm:p-1 lg:justify-self-center">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-full sm:h-8 sm:w-8"
            onClick={() => navigateMonth("prev")}
          >
            <ChevronLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="h-7 rounded-full px-2.5 text-xs sm:h-8 sm:px-4"
            onClick={() => setCurrentDate(new Date())}
          >
            Hoy
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-full sm:h-8 sm:w-8"
            onClick={() => navigateMonth("next")}
          >
            <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </Button>
        </div>
        {headerActions && (
          <div className="flex flex-wrap items-center gap-2 lg:justify-self-end">
            {headerActions}
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border bg-gradient-to-br from-background via-background to-muted/30 shadow-sm lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
        {/* Header de días */}
        <div className="grid grid-cols-7 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          {["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"].map((day) => (
            <div
              key={day}
              className="border-r px-1 py-1.5 text-center text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground last:border-r-0 sm:py-2 sm:text-[10px] md:py-2.5 md:text-xs"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Semanas */}
        <div className="grid grid-cols-1 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
          {weeksData.map(({ week, weekReservations, numLanes }, weekIndex) => {
            const isExpanded = expandedWeeks.has(weekIndex);
            const isHovered = hoveredWeek === weekIndex;
            const shouldExpand = isExpanded || isHovered;
            const visibleReservations = shouldExpand
              ? weekReservations
              : weekReservations.filter((wr) => wr.lane < maxVisibleLanes);
            const hiddenReservations = weekReservations.filter((wr) => wr.lane >= maxVisibleLanes);
            const hiddenCount = hiddenReservations.length;

            return (
              <div
                key={weekIndex}
                className={`relative grid grid-cols-7 overflow-hidden bg-background transition-[min-height] ${
                  weekIndex < weeksData.length - 1 ? "border-b border-border" : ""
                }`}
                style={{
                  minHeight: shouldExpand
                    ? `${56 + numLanes * 30}px`
                    : `${56 + Math.min(numLanes, maxVisibleLanes) * 30}px`,
                } as CSSProperties}
                onMouseEnter={() => setHoveredWeek(weekIndex)}
                onMouseLeave={() => setHoveredWeek(null)}
              >
              {week.map((day) => {
                const dateKey = format(day, "yyyy-MM-dd");
                const isCurrentMonth = isSameMonth(day, currentDate);
                const isToday = isSameDay(day, new Date());

                return (
                  <div
                    key={dateKey}
                    className={`group h-full min-h-9 border-r bg-background/75 p-1 transition-colors last:border-r-0 hover:bg-muted/40 sm:min-h-10 sm:p-1.5 md:min-h-12 lg:min-h-0 ${
                      !isCurrentMonth
                        ? "bg-muted/25 text-muted-foreground"
                        : ""
                    }`}
                    onClick={() => onDateClick?.(day)}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <div
                        className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold transition-transform group-hover:scale-105 sm:h-6 sm:w-6 sm:text-xs md:h-7 md:w-7 md:text-sm ${
                          isToday
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : isCurrentMonth
                              ? "text-foreground"
                              : "text-muted-foreground"
                        }`}
                      >
                        {format(day, "d")}
                      </div>
                      {isToday && (
                        <span className="hidden rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-primary md:inline-flex">
                          Hoy
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}

              {visibleReservations.map((wr) => {
                const ended = isReservationEnded(wr.res);
                const color = getReservationColor(wr.res);
                return (
                  <button
                    key={`${wr.res.id}-${weekIndex}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectReservation?.(wr.res.id);
                    }}
                    className={`absolute z-10 flex h-6 cursor-pointer items-center gap-1 overflow-hidden rounded-full border px-1.5 text-left text-[10px] font-semibold shadow-sm transition-all hover:z-20 hover:-translate-y-0.5 hover:shadow-lg focus-visible:z-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-6 sm:gap-1.5 sm:px-2 sm:text-xs ${
                      ended
                        ? "border-border bg-muted text-muted-foreground opacity-75 line-through decoration-muted-foreground/60"
                        : "border-white/25"
                    }`}
                    style={{
                      left: `${(wr.startCol / 7) * 100}%`,
                      top: `${32 + wr.lane * 28}px`,
                      width: `calc(${(wr.span / 7) * 100}% - 4px)`,
                      backgroundColor: ended ? undefined : color,
                      color: ended ? undefined : getContrastColor(color),
                    }}
                    title={`${wr.res.client.name} - ${wr.res.property.name}`}
                  >
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full sm:h-2 sm:w-2 ${ended ? "opacity-60" : "ring-1 ring-white/40 sm:ring-2"}`}
                      style={{ backgroundColor: color }}
                    />
                    <span className="truncate">
                      {wr.res.client.name} - {wr.res.property.name}
                    </span>
                  </button>
                );
              })}

              {hiddenCount > 0 && !shouldExpand && (
                <div className="absolute bottom-1 right-1 z-20 flex items-center gap-1.5 sm:bottom-1.5 sm:right-1.5">
                  <div className="flex -space-x-1">
                    {hiddenReservations.slice(0, 4).map((wr, idx) => {
                      const color = getReservationColor(wr.res);
                      return (
                        <span
                          key={idx}
                          className="h-4 w-4 rounded-full border-2 border-background shadow-sm transition-transform hover:scale-110 hover:z-10"
                          style={{ backgroundColor: color }}
                          title={`${wr.res.client.name} - ${wr.res.property.name}`}
                        />
                      );
                    })}
                    {hiddenCount > 4 && (
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-muted text-[8px] font-bold text-muted-foreground">
                        +{hiddenCount - 4}
                      </span>
                    )}
                  </div>
                  <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold text-primary">
                    +{hiddenCount}
                  </span>
                </div>
              )}

              {(hiddenCount > 0 || isExpanded) && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    toggleExpandedWeek(weekIndex);
                  }}
                  className="absolute bottom-1 left-1 z-20 flex items-center gap-1 rounded-full border border-border/50 bg-background/90 px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground backdrop-blur-sm transition-all hover:bg-muted hover:text-foreground sm:bottom-1.5 sm:left-1.5 sm:px-2 sm:text-[10px]"
                >
                  {isExpanded ? (
                    <>
                      <span className="hidden sm:inline">Colapsar</span>
                      <span className="sm:hidden">−</span>
                    </>
                  ) : (
                    <>
                      <span className="hidden sm:inline">Expandir</span>
                      <span className="sm:hidden">+</span>
                    </>
                  )}
                </button>
              )}
            </div>
            );
          })}
        </div>

        {reservations.length === 0 && (
          <div className="flex min-h-56 items-center justify-center border-t px-6 py-12 text-center">
            <div className="max-w-sm rounded-2xl border bg-background/80 p-6 shadow-sm">
              <Calendar className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
              <h3 className="font-semibold">Sin reservas diarias este mes</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Las reservas activas aparecerán con color sólido; las pasadas quedan apagadas y tachadas.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
