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
  parseISO,
  differenceInDays,
  getDay,
} from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
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
  const end = parseISO(res.endDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return end < today || res.status === "COMPLETED";
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
        const start = parseISO(res.startDate);
        const end = parseISO(res.endDate);
        return start <= weekEnd && end >= weekStart;
      });

      const wrs: WeekReservation[] = intersecting.map((res) => {
        const start = parseISO(res.startDate);
        const end = parseISO(res.endDate);

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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base sm:text-xl font-semibold">
          {format(currentDate, "MMMM yyyy", { locale: es }).toUpperCase()}
        </h2>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigateMonth("prev")}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentDate(new Date())}
          >
            HOY
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigateMonth("next")}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="border border-border rounded-lg overflow-hidden">
        {/* Header de días */}
        <div className="grid grid-cols-7 gap-x-px bg-border">
          {["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"].map((day) => (
            <div
              key={day}
              className="bg-muted p-1 sm:p-2 text-center text-xs sm:text-sm font-medium text-muted-foreground border-b border-border"
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
              className={`relative grid grid-cols-7 gap-x-px bg-border ${
                weekIndex < weeksData.length - 1 ? "border-b border-border" : ""
              }`}
              style={{
                minHeight: numLanes > 0 ? `${96 + numLanes * 34}px` : undefined,
              }}
            >
              {week.map((day) => {
                const dateKey = format(day, "yyyy-MM-dd");
                const isCurrentMonth = isSameMonth(day, currentDate);
                const isToday = isSameDay(day, new Date());

                return (
                  <div
                    key={dateKey}
                    className={`bg-background p-1 transition-colors hover:bg-muted/50 min-h-12 sm:min-h-20 lg:min-h-24 h-full ${
                      !isCurrentMonth
                        ? "text-muted-foreground opacity-50"
                        : ""
                    }`}
                    onClick={() => onDateClick?.(day)}
                  >
                    <div
                      className={`mb-1 flex h-7 w-7 items-center justify-center rounded-full text-sm ${
                        isToday
                          ? "bg-primary text-primary-foreground font-bold"
                          : ""
                      }`}
                    >
                      {format(day, "d")}
                    </div>
                  </div>
                );
              })}

              {weekReservations.map((wr) => {
                const ended = isReservationEnded(wr.res);
                return (
                  <div
                    key={`${wr.res.id}-${weekIndex}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectReservation?.(wr.res.id);
                    }}
                    className={`absolute z-10 cursor-pointer rounded px-1.5 py-0.5 text-sm font-medium transition-colors hover:opacity-80 flex items-center h-8 ${
                      ended ? "opacity-40" : ""
                    }`}
                    style={{
                      left: `${(wr.startCol / 7) * 100}%`,
                      top: `${40 + wr.lane * 34}px`,
                      width: `${(wr.span / 7) * 100}%`,
                      backgroundColor: wr.res.property.color,
                      color: getContrastColor(wr.res.property.color),
                    }}
                    title={`${wr.res.client.name} - ${wr.res.property.name}`}
                  >
                    <span className="truncate">
                      {wr.res.client.name} - {wr.res.property.name}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
