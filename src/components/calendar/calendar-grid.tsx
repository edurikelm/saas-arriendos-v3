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
} from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CalendarReservation } from "@/lib/actions/calendar";

interface CalendarGridProps {
  reservations: CalendarReservation[];
  onSelectReservation?: (id: string) => void;
  onDateClick?: (date: Date) => void;
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

  const reservationsByDate = useMemo(() => {
    const map = new Map<string, CalendarReservation[]>();

    reservations.forEach((res) => {
      const start = parseISO(res.startDate.toISOString());
      const end = parseISO(res.endDate.toISOString());
      const totalDays = differenceInDays(end, start) + 1;

      for (let i = 0; i < totalDays; i++) {
        const date = new Date(start);
        date.setDate(date.getDate() + i);
        const dateKey = format(date, "yyyy-MM-dd");

        if (!map.has(dateKey)) {
          map.set(dateKey, []);
        }
        map.get(dateKey)!.push(res);
      }
    });

    return map;
  }, [reservations]);

  const navigateMonth = (direction: "prev" | "next") => {
    setCurrentDate((prev) =>
      direction === "prev" ? subMonths(prev, 1) : addMonths(prev, 1)
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">
          {format(currentDate, "MMMM yyyy", { locale: es }).toUpperCase()}
        </h2>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={() => navigateMonth("prev")}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={() => setCurrentDate(new Date())}>
            HOY
          </Button>
          <Button variant="outline" size="icon" onClick={() => navigateMonth("next")}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px bg-border">
        {["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"].map((day) => (
          <div
            key={day}
            className="bg-muted p-2 text-center text-sm font-medium text-muted-foreground"
          >
            {day}
          </div>
        ))}

        {days.map((day) => {
          const dateKey = format(day, "yyyy-MM-dd");
          const dayReservations = reservationsByDate.get(dateKey) || [];
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isToday = isSameDay(day, new Date());

          return (
            <div
              key={dateKey}
              className={`
                min-h-24 bg-background p-1 transition-colors hover:bg-muted/50
                ${!isCurrentMonth ? "text-muted-foreground opacity-50" : ""}
              `}
              onClick={() => onDateClick?.(day)}
            >
              <div
                className={`
                  mb-1 flex h-7 w-7 items-center justify-center rounded-full text-sm
                  ${isToday ? "bg-primary text-primary-foreground font-bold" : ""}
                `}
              >
                {format(day, "d")}
              </div>

              <div className="space-y-1">
                {dayReservations.slice(0, 3).map((res) => (
                  <div
                    key={`${res.id}-${dateKey}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectReservation?.(res.id);
                    }}
                    className={`
                      cursor-pointer truncate rounded px-1 py-0.5 text-xs font-medium
                      transition-colors hover:opacity-80
                      ${res.status === "CONFIRMED" ? "bg-green-100 text-green-800" : ""}
                      ${res.status === "PENDING" ? "bg-yellow-100 text-yellow-800" : ""}
                      ${res.status === "CANCELLED" ? "bg-red-100 text-red-800" : ""}
                      ${res.status === "COMPLETED" ? "bg-blue-100 text-blue-800" : ""}
                    `}
                    title={`${res.property.name} - ${res.client.name}`}
                  >
                    {res.property.name}
                  </div>
                ))}

                {dayReservations.length > 3 && (
                  <div className="text-xs text-muted-foreground">
                    +{dayReservations.length - 3} más
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}