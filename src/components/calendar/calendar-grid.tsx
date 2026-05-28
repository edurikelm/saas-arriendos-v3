"use client";

import { useState, useMemo } from "react";
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
}: CalendarGridProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

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

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Calendario mensual
          </p>
          <h2 className="text-2xl font-bold capitalize tracking-tight">
            {format(currentDate, "MMMM yyyy", { locale: es })}
          </h2>
        </div>
        <div className="flex items-center gap-2 rounded-full border bg-background/80 p-1 shadow-sm">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full"
            onClick={() => navigateMonth("prev")}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="h-8 rounded-full px-4"
            onClick={() => setCurrentDate(new Date())}
          >
            Hoy
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full"
            onClick={() => navigateMonth("next")}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-gradient-to-br from-background via-background to-muted/30 shadow-sm">
        {/* Header de días */}
        <div className="grid grid-cols-7 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          {["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"].map((day) => (
            <div
              key={day}
              className="border-r px-1 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground last:border-r-0 sm:text-xs"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Semanas */}
        <div className="grid grid-cols-1">
          {weeksData.map(({ week, weekReservations, numLanes }, weekIndex) => (
            <div
              key={weekIndex}
              className={`relative grid grid-cols-7 ${
                weekIndex < weeksData.length - 1 ? "border-b border-border" : ""
              }`}
              style={{
                minHeight: numLanes > 0 ? `${108 + numLanes * 36}px` : undefined,
              }}
            >
              {week.map((day) => {
                const dateKey = format(day, "yyyy-MM-dd");
                const isCurrentMonth = isSameMonth(day, currentDate);
                const isToday = isSameDay(day, new Date());

                return (
                  <div
                    key={dateKey}
                    className={`group h-full min-h-12 border-r bg-background/75 p-1.5 transition-colors last:border-r-0 hover:bg-muted/40 sm:min-h-20 sm:p-2 lg:min-h-24 ${
                      !isCurrentMonth
                        ? "bg-muted/25 text-muted-foreground"
                        : ""
                    }`}
                    onClick={() => onDateClick?.(day)}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <div
                        className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold transition-transform group-hover:scale-105 ${
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
                        <span className="hidden rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary sm:inline-flex">
                          Hoy
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}

              {weekReservations.map((wr) => {
                const ended = isReservationEnded(wr.res);
                const color = getReservationColor(wr.res);
                return (
                  <button
                    key={`${wr.res.id}-${weekIndex}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectReservation?.(wr.res.id);
                    }}
                    className={`absolute z-10 flex h-8 cursor-pointer items-center gap-1.5 overflow-hidden rounded-full border px-2 text-left text-xs font-semibold shadow-sm transition-all hover:z-20 hover:-translate-y-0.5 hover:shadow-lg focus-visible:z-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm ${
                      ended
                        ? "border-border bg-muted text-muted-foreground opacity-75 line-through decoration-muted-foreground/60"
                        : "border-white/25"
                    }`}
                    style={{
                      left: `${(wr.startCol / 7) * 100}%`,
                      top: `${48 + wr.lane * 36}px`,
                      width: `calc(${(wr.span / 7) * 100}% - 6px)`,
                      backgroundColor: ended ? undefined : color,
                      color: ended ? undefined : getContrastColor(color),
                    }}
                    title={`${wr.res.client.name} - ${wr.res.property.name}`}
                  >
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${ended ? "opacity-60" : "ring-2 ring-white/40"}`}
                      style={{ backgroundColor: color }}
                    />
                    <span className="truncate">
                      {wr.res.client.name} - {wr.res.property.name}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
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
