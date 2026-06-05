"use client";

import { type ReactNode } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths, startOfWeek, endOfWeek } from "date-fns";
import { es } from "date-fns/locale/es";
import { ChevronLeft, ChevronRight, Calendar, Home, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Payment {
  id: string;
  amount: string;
  status: string;
  method: string;
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

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ComponentType<{ className?: string }> }> = {
  PENDING: { label: "Pendiente", variant: "secondary", icon: AlertCircle },
  CONFIRMED: { label: "Confirmada", variant: "default", icon: CheckCircle2 },
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

function getNights(startDate: string, endDate: string): number {
  const diff = parseCalendarDate(endDate).getTime() - parseCalendarDate(startDate).getTime();
  return Math.round(diff / (1000 * 60 * 60 * 24)) + 1;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("es-CL", {
    day: "numeric",
    month: "short",
  });
}

function formatFullDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("es-CL", {
    day: "numeric",
    month: "short",
    year: "numeric",
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
      <div className={`h-full min-h-24 border border-zinc-100 dark:border-zinc-800 ${padding} ${!isCurrentMonth ? "bg-zinc-50 dark:bg-zinc-900/50" : ""}`}>
        <div className={`font-medium ${isToday ? "bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center" : "text-muted-foreground"} ${textSize}`}>
          {format(date, "d")}
        </div>
      </div>
    );
  }

  return (
    <div className={`h-full min-h-24 border border-zinc-100 dark:border-zinc-800 ${padding} ${!isCurrentMonth ? "bg-zinc-50 dark:bg-zinc-900/50" : ""}`}>
      <div className={`font-medium mb-1 ${isToday ? "bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center" : "text-muted-foreground"} ${textSize}`}>
        {format(date, "d")}
      </div>
      <div className="space-y-1">
        {dayReservations.slice(0, variant === "spacious" ? 5 : variant === "comfortable" ? 3 : 2).map((res) => (
          <button
            key={res.id}
            onClick={() => onSelectReservation(res.id)}
            className={`w-full text-left rounded-md px-2 py-0.5 text-xs transition-all hover:scale-[1.02] hover:shadow-md ${
              res.status === "CANCELLED"
                ? "bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500 line-through"
                : res.status === "COMPLETED"
                ? "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                : "text-white"
            }`}
            style={{
              backgroundColor: res.status === "CANCELLED" || res.status === "COMPLETED" ? undefined : (res.property.color || "#6366F1"),
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
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const weekDays = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

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
          <div key={day} className={`${headerHeight} flex items-center justify-center font-medium text-muted-foreground text-sm border-b border-zinc-200 dark:border-zinc-800`}>
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

export function CalendarTimeline({ reservations, currentMonth, onSelectReservation, onMonthChange, headerActions }: {
  reservations: Reservation[];
  currentMonth: Date;
  onSelectReservation: (id: string) => void;
  onMonthChange: (date: Date) => void;
  headerActions?: ReactNode;
}) {
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const today = new Date();
  const dayWidth = 42;

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
    <div className="space-y-3">
      <div className="grid gap-3 lg:grid-cols-[1fr_auto_1fr] lg:items-end">
        <div className="min-w-0 leading-tight">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Timeline de ocupacion
          </p>
          <h2 className="text-2xl font-bold capitalize tracking-tight">
            {format(currentMonth, "MMMM yyyy", { locale: es })}
          </h2>
        </div>
        <div className="flex w-fit items-center gap-2 rounded-lg border bg-background/80 p-1 shadow-sm lg:justify-self-center">
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => onMonthChange(subMonths(currentMonth, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="secondary" size="sm" className="h-8 rounded-lg px-4" onClick={() => onMonthChange(new Date())}>
            Hoy
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => onMonthChange(addMonths(currentMonth, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        {headerActions && (
          <div className="flex flex-wrap items-center gap-2 lg:justify-self-end">
            {headerActions}
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border bg-gradient-to-br from-background via-background to-muted/30 shadow-sm">
        <div className="overflow-x-auto">
          <div className="min-w-max" style={{ width: 224 + days.length * dayWidth }}>
            <div className="sticky top-0 z-20 flex border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
              <div className="sticky left-0 z-30 flex w-56 shrink-0 items-center border-r bg-background/95 px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground backdrop-blur">
                Propiedad
              </div>
              {days.map((day) => (
                <div
                  key={day.toISOString()}
                  className={`shrink-0 border-r px-1 py-2 text-center ${isSameDay(day, today) ? "bg-primary/10" : ""}`}
                  style={{ width: dayWidth }}
                >
                  <div className={`mx-auto flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${isSameDay(day, today) ? "bg-primary text-primary-foreground shadow-sm" : "text-foreground"}`}>
                    {format(day, "d")}
                  </div>
                  <div className="mt-0.5 text-[10px] font-medium uppercase text-muted-foreground">
                    {format(day, "EEE", { locale: es }).slice(0, 3)}
                  </div>
                </div>
              ))}
            </div>

          {propertyGroups.length === 0 ? (
            <div className="flex min-h-56 items-center justify-center px-6 py-12 text-center">
              <div className="max-w-sm rounded-2xl border bg-background/80 p-6 shadow-sm">
                <Calendar className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                <h3 className="font-semibold">Sin reservas diarias este mes</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Cuando existan reservas, apareceran como barras por propiedad y rango de fechas.
                </p>
              </div>
            </div>
          ) : (
            propertyGroups.map(({ property, reservations: propReservations }) => {
              const sortedReservations = [...propReservations].sort((a, b) =>
                new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
              );
              const rowHeight = Math.max(76, sortedReservations.length * 34 + 22);

              return (
                <div key={property.id} className="flex border-b last:border-b-0">
                  <div className="sticky left-0 z-10 flex w-56 shrink-0 items-center border-r bg-background/95 px-4 py-3 backdrop-blur">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full shadow-sm ring-4 ring-muted" style={{ backgroundColor: property.color || "#6366F1" }} />
                        <span className="truncate text-sm font-semibold">{property.name}</span>
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        <Home className="h-3 w-3" />
                        {sortedReservations.length} {sortedReservations.length === 1 ? "reserva" : "reservas"}
                      </div>
                    </div>
                  </div>
                  <div className="relative bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px)]" style={{ width: days.length * dayWidth, height: rowHeight, backgroundSize: `${dayWidth}px 100%` }}>
                    {days.map((day, dayIndex) => isSameDay(day, today) ? (
                      <div
                        key={day.toISOString()}
                        className="absolute top-0 h-full bg-primary/5 ring-1 ring-inset ring-primary/10"
                        style={{ left: dayIndex * dayWidth, width: dayWidth }}
                      />
                    ) : null)}
                    {sortedReservations.map((res, index) => {
                      const start = parseCalendarDate(res.startDate);
                      const end = parseCalendarDate(res.endDate);
                      const leftOffset = start < monthStart ? 0 : Math.floor((start.getTime() - monthStart.getTime()) / (1000 * 60 * 60 * 24));
                      const duration = Math.min(
                        Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1,
                        days.length - leftOffset
                      );
                      const status = statusConfig[res.status] || statusConfig.PENDING;
                      const StatusIcon = status.icon;
                      const isCancelled = res.status === "CANCELLED";
                      const ended = isReservationEnded(res);

                      return (
                        <button
                          key={res.id}
                          onClick={() => onSelectReservation(res.id)}
                          className={`group absolute flex h-8 items-center gap-2 overflow-hidden rounded-md border px-3 text-left text-xs shadow-sm transition-all hover:z-20 hover:-translate-y-0.5 hover:shadow-lg focus-visible:z-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                            isCancelled
                              ? "border-border bg-muted text-muted-foreground line-through"
                              : ended
                                ? "border-border bg-muted text-muted-foreground opacity-75 line-through decoration-muted-foreground/60"
                                : "border-white/25 text-white"
                          }`}
                          style={{
                            left: `${leftOffset * dayWidth + 4}px`,
                            top: `${12 + index * 34}px`,
                            width: `${Math.max(duration * dayWidth - 8, 34)}px`,
                            backgroundColor: isCancelled || ended ? undefined : res.property.color || "#6366F1",
                          }}
                          title={`${res.client.name} - ${formatDate(res.startDate)} a ${formatDate(res.endDate)}`}
                        >
                          <StatusIcon className="h-3.5 w-3.5 shrink-0 opacity-90" />
                          <span className="min-w-0 flex-1 truncate font-semibold">{res.client.name}</span>
                          <span className="hidden shrink-0 rounded-sm bg-black/10 px-1.5 py-0.5 font-medium sm:inline-flex">
                            {getNights(res.startDate, res.endDate)}n
                          </span>
                        </button>
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
            className="w-full text-left group flex items-center gap-4 rounded-xl border border-zinc-200/50 dark:border-zinc-800/50 bg-white dark:bg-zinc-950 p-4 transition-all duration-200 hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-lg hover:shadow-black/5"
          >
            <div
              className="h-12 w-12 shrink-0 rounded-xl flex items-center justify-center text-white font-semibold text-lg"
              style={{ backgroundColor: res.property.color || "#6366F1" }}
            >
              {format(parseCalendarDate(res.startDate), "d")}
            </div>

            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                  {res.client.name}
                </h3>
                <StatusIcon className={`h-4 w-4 shrink-0 ${status.variant === "destructive" ? "text-destructive" : status.variant === "default" ? "text-green-600" : "text-muted-foreground"}`} />
              </div>
              <div className="flex items-center gap-3 text-xs text-zinc-500">
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
              <p className="font-bold text-zinc-900 dark:text-zinc-100">{formatPrice(res.totalPrice)}</p>
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
  const weekStart = startOfWeek(today, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(today, { weekStartsOn: 0 });
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
          <div className="grid grid-cols-8 border-b border-zinc-200 dark:border-zinc-800">
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
              <div key={hour} className="grid grid-cols-8 border-b border-zinc-100 dark:border-zinc-800">
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
                    <div key={`${day.toISOString()}-${hour}`} className="relative p-1 border-l border-zinc-100 dark:border-zinc-800 min-h-12">
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
                            style={{ backgroundColor: res.property.color || "#6366F1" }}
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

export function ReservationDetailDialog({ reservation, onClose }: {
  reservation: Reservation;
  onClose: () => void;
}) {
  const status = statusConfig[reservation.status] || statusConfig.PENDING;
  const StatusIcon = status.icon;
  const paidAmount = reservation.payments
    .filter((p) => p.status === "COMPLETED")
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const pendingAmount = Number(reservation.totalPrice) - paidAmount;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Detalle de Reserva</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div
              className="h-12 w-12 rounded-xl flex items-center justify-center text-white font-semibold text-lg"
              style={{ backgroundColor: reservation.property.color || "#6366F1" }}
            >
              {reservation.property.name[0]}
            </div>
            <div>
              <h3 className="font-semibold text-lg">{reservation.client.name}</h3>
              <p className="text-sm text-muted-foreground">{reservation.client.email}</p>
            </div>
            <div className="ml-auto">
              <Badge variant={status.variant} className="text-sm">
                <StatusIcon className="h-4 w-4 mr-1" />
                {status.label}
              </Badge>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-xl">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Propiedad</p>
              <p className="font-medium">{reservation.property.name}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Check-in</p>
              <p className="font-medium">{formatFullDate(reservation.startDate)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Check-out</p>
              <p className="font-medium">
                {formatFullDate(reservation.endDate)}
                <span className="text-xs text-muted-foreground ml-1">
                  ({getNights(reservation.startDate, reservation.endDate)} noches)
                </span>
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Total</p>
              <p className="font-bold text-lg">{formatPrice(reservation.totalPrice)}</p>
            </div>
          </div>

          {pendingAmount > 0 && (
            <div className="flex items-center justify-between p-4 bg-orange-50 dark:bg-orange-900/20 rounded-xl">
              <div>
                <p className="text-sm font-medium text-orange-600 dark:text-orange-400">Pago pendiente</p>
                <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{formatPrice(pendingAmount)}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Pagado</p>
                <p className="font-medium text-green-600">{formatPrice(paidAmount)}</p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-4 text-sm">
            <div className={`px-3 py-1.5 rounded-md text-xs font-medium ${reservation.billingType === "DAILY" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" : "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"}`}>
              {reservation.billingType === "DAILY" ? "Tarifa diaria" : "Tarifa mensual"}
            </div>
            <div className={`px-3 py-1.5 rounded-md text-xs font-medium ${reservation.bookingAirbnb ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"}`}>
              {reservation.bookingAirbnb ? "Booking Airbnb" : "Directo"}
            </div>
            {reservation.unitsBooked > 1 && (
              <div className="px-3 py-1.5 rounded-md text-xs font-medium bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                {reservation.unitsBooked} unidades
              </div>
            )}
          </div>

          {reservation.notes && (
            <div className="p-4 bg-muted/50 rounded-xl">
              <p className="text-xs text-muted-foreground mb-1">Notas</p>
              <p className="text-sm">{reservation.notes}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
