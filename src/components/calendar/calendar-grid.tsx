"use client";

import { useState, useMemo, useRef, useEffect, type CSSProperties, type ReactNode } from "react";
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
  getDay,
} from "date-fns";
import { es } from "date-fns/locale";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CalendarReservation } from "@/lib/actions/reservations";

const LANE_TOP_OFFSET = 32;
const LANE_TOP_STEP = 28;
const BASE_WEEK_HEIGHT = 56;
const COMPACT_LINE_H = 7;
const COMPACT_RAIL_PAD = 6;

function getMondayFirstDayIndex(date: Date): number {
  const day = getDay(date);
  return day === 0 ? 6 : day - 1;
}

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
  currentMonth: Date;
  onMonthChange: (date: Date) => void;
}

function getWeeks(days: Date[]): Date[][] {
  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }
  return weeks;
}

export interface WeekReservation {
  res: CalendarReservation;
  startCol: number;
  span: number;
  lane: number;
  continuesFromPreviousWeek: boolean;
  continuesIntoNextWeek: boolean;
}

export function getContinuationRadiusClass(wr: WeekReservation): string {
  if (wr.continuesFromPreviousWeek && wr.continuesIntoNextWeek) {
    return "rounded-sm";
  }

  if (wr.continuesFromPreviousWeek) {
    return "rounded-l-sm rounded-r-md";
  }

  if (wr.continuesIntoNextWeek) {
    return "rounded-l-md rounded-r-sm";
  }

  return "rounded-md";
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
  currentMonth,
  onMonthChange,
}: CalendarGridProps) {
  const [expandedGlobal, setExpandedGlobal] = useState(false);
  const [hoveredWeek, setHoveredWeek] = useState<number | null>(null);
  const [hoveredReservationId, setHoveredReservationId] = useState<string | null>(null);
  const [gridHeight, setGridHeight] = useState(0);
  const gridRef = useRef<HTMLDivElement>(null);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  const weeks = getWeeks(days);

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;

    const measure = () => setGridHeight(grid.clientHeight);
    measure();

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(measure);
    observer.observe(grid);
    return () => observer.disconnect();
  }, [weeks.length]);

  const navigateMonth = (direction: "prev" | "next") => {
    onMonthChange(
      direction === "prev" ? subMonths(currentMonth, 1) : addMonths(currentMonth, 1)
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

        const startCol = getMondayFirstDayIndex(firstVisibleDay);
        const span = getMondayFirstDayIndex(lastVisibleDay) - startCol + 1;

        return {
          res,
          startCol,
          span,
          lane: 0,
          continuesFromPreviousWeek: start < weekStart,
          continuesIntoNextWeek: end > weekEnd,
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

  const perWeekHeight = gridHeight > 0 && weeks.length > 0
    ? gridHeight / weeks.length
    : 0;
  const maxLanes = perWeekHeight > 0
    ? Math.max(1, Math.floor((perWeekHeight - LANE_TOP_OFFSET) / LANE_TOP_STEP))
    : 2;

  const expandableWeekIndexes = useMemo(() => {
    return weeksData.reduce<number[]>((indexes, weekData, weekIndex) => {
      if (weekData.weekReservations.some((wr) => wr.lane >= maxLanes)) {
        indexes.push(weekIndex);
      }
      return indexes;
    }, []);
  }, [weeksData, maxLanes]);

  const hasExpandableWeeks = expandableWeekIndexes.length > 0;
  const expandableWeekIndexSet = useMemo(
    () => new Set(expandableWeekIndexes),
    [expandableWeekIndexes]
  );

  const gridTemplateRows = useMemo(() => {
    if (expandedGlobal) return undefined;

    if (hoveredWeek !== null && expandableWeekIndexSet.has(hoveredWeek)) {
      return weeksData
        .map((weekData, weekIndex) => {
          if (weekIndex !== hoveredWeek) return "minmax(0, 1fr)";
          return `minmax(${BASE_WEEK_HEIGHT + weekData.numLanes * LANE_TOP_STEP}px, auto)`;
        })
        .join(" ");
    }

    return `repeat(${weeks.length}, minmax(0, 1fr))`;
  }, [expandableWeekIndexSet, expandedGlobal, hoveredWeek, weeks.length, weeksData]);

  const toggleAllExpandableWeeks = () => {
    setExpandedGlobal((prev) => !prev);
  };

  return (
    <div className="space-y-2 lg:flex lg:h-full lg:min-h-0 lg:flex-col lg:space-y-3">
      <div className="grid gap-2 sm:gap-3 lg:grid-cols-[1fr_auto_1fr] lg:items-end">
        <div className="min-w-0 leading-tight">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground sm:text-xs">
            Calendario mensual de reservas diarias
          </p>
          <h2 className="text-lg font-bold capitalize tracking-tight sm:text-2xl">
            {format(currentMonth, "MMMM yyyy", { locale: es })}
          </h2>
        </div>
        <div className="flex w-fit items-center gap-1 rounded-lg border bg-background/80 p-0.5 shadow-sm sm:gap-2 sm:p-1 lg:justify-self-center">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-lg sm:h-8 sm:w-8"
            onClick={() => navigateMonth("prev")}
          >
            <ChevronLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="h-7 rounded-lg px-2.5 text-xs sm:h-8 sm:px-4"
            onClick={() => onMonthChange(new Date())}
          >
            Hoy
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-lg sm:h-8 sm:w-8"
            onClick={() => navigateMonth("next")}
          >
            <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </Button>
        </div>
        {(hasExpandableWeeks || headerActions) && (
          <div className="flex flex-wrap items-center gap-2 lg:justify-self-end">
            {hasExpandableWeeks && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 rounded-lg px-3 text-xs"
                onClick={toggleAllExpandableWeeks}
              >
                {expandedGlobal ? "Colapsar todas" : "Expandir todas"}
              </Button>
            )}
            {headerActions}
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border bg-gradient-to-br from-background via-background to-muted/30 shadow-sm lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
        <div className="grid grid-cols-7 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((day) => (
            <div
              key={day}
              className="border-r px-1 py-1.5 text-center text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground last:border-r-0 sm:py-2 sm:text-[10px] md:py-2.5 md:text-xs"
            >
              {day}
            </div>
          ))}
        </div>
        <div
          ref={gridRef}
          className="grid grid-cols-1 lg:min-h-0 lg:flex-1 lg:overflow-y-auto"
          style={gridTemplateRows ? { gridTemplateRows } as CSSProperties : undefined}
        >
          {weeksData.map(({ week, weekReservations, numLanes }, weekIndex) => {
            const canHoverExpand = expandableWeekIndexSet.has(weekIndex);
            const shouldExpand = expandedGlobal || (canHoverExpand && hoveredWeek === weekIndex);
            const visibleReservations = shouldExpand
              ? weekReservations
              : weekReservations.filter((wr) => wr.lane < maxLanes);
            const hiddenCount = weekReservations.length - visibleReservations.length;

            return (
              <div
                key={weekIndex}
                className={`relative grid grid-cols-7 overflow-hidden bg-background ${
                  hoveredWeek === weekIndex ? "z-30" : ""
                } ${
                  weekIndex < weeksData.length - 1 ? "border-b border-border" : ""
                }`}
                style={
                  shouldExpand
                    ? { minHeight: `${BASE_WEEK_HEIGHT + numLanes * LANE_TOP_STEP}px` }
                    : undefined
                }
                onMouseEnter={() => {
                  if (canHoverExpand) setHoveredWeek(weekIndex);
                }}
                onMouseLeave={() => setHoveredWeek(null)}
              >
              {week.map((day) => {
                const dateKey = format(day, "yyyy-MM-dd");
                const isCurrentMonth = isSameMonth(day, currentMonth);
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
                        <span className="hidden rounded-md bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-primary md:inline-flex">
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
                const radiusClass = getContinuationRadiusClass(wr);
                const isReservationHovered = hoveredReservationId === wr.res.id;
                return (
                  <button
                    key={`${wr.res.id}-${weekIndex}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectReservation?.(wr.res.id);
                    }}
                    onMouseEnter={() => setHoveredReservationId(wr.res.id)}
                    onMouseLeave={() => setHoveredReservationId(null)}
                    onFocus={() => setHoveredReservationId(wr.res.id)}
                    onBlur={() => setHoveredReservationId(null)}
                    className={`absolute flex h-6 cursor-pointer items-center gap-1 overflow-hidden border px-1.5 text-left text-[10px] font-semibold shadow-sm transition-all hover:z-20 hover:-translate-y-0.5 hover:shadow-lg focus-visible:z-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-6 sm:gap-1.5 sm:px-2 sm:text-xs ${radiusClass} ${
                      isReservationHovered ? "z-20 -translate-y-0.5 shadow-lg" : "z-10"
                    } ${
                      ended
                        ? "border-border bg-muted text-muted-foreground opacity-75 line-through decoration-muted-foreground/60"
                        : "border-white/25"
                    }`}
                    style={{
                      left: `${(wr.startCol / 7) * 100}%`,
                      top: `${LANE_TOP_OFFSET + wr.lane * LANE_TOP_STEP}px`,
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
                <>
                  {weekReservations.slice(visibleReservations.length, visibleReservations.length + 3).map((wr, compactIndex) => {
                    const color = getReservationColor(wr.res);
                    const radiusClass = getContinuationRadiusClass(wr);
                    const isReservationHovered = hoveredReservationId === wr.res.id;
                    return (
                      <button
                        key={`${wr.res.id}-${weekIndex}-compact`}
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onSelectReservation?.(wr.res.id);
                        }}
                        onMouseEnter={() => setHoveredReservationId(wr.res.id)}
                        onMouseLeave={() => setHoveredReservationId(null)}
                        onFocus={() => setHoveredReservationId(wr.res.id)}
                        onBlur={() => setHoveredReservationId(null)}
                        className={`absolute cursor-pointer shadow-sm transition-all hover:z-20 hover:h-2 hover:opacity-100 focus-visible:z-30 focus-visible:h-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${radiusClass} ${
                          isReservationHovered ? "z-20 h-2 opacity-100" : "z-10 h-1.5 opacity-90"
                        }`}
                        style={{
                          left: `${(wr.startCol / 7) * 100}%`,
                          top: `${LANE_TOP_OFFSET + maxLanes * LANE_TOP_STEP + COMPACT_RAIL_PAD + compactIndex * COMPACT_LINE_H}px`,
                          width: `calc(${(wr.span / 7) * 100}% - 4px)`,
                          backgroundColor: color,
                        }}
                        aria-label={`${wr.res.client.name} - ${wr.res.property.name}`}
                        title={`${wr.res.client.name} - ${wr.res.property.name}`}
                      />
                    );
                  })}
                  <div
                    className="pointer-events-none absolute bottom-1 right-1 z-20 flex items-center gap-1 rounded-md border border-border/50 bg-background/90 px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground backdrop-blur-sm sm:px-2 sm:text-[10px]"
                  >
                    +{hiddenCount}
                  </div>
                </>
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
