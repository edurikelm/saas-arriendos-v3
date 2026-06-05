"use client";

import { useState } from "react";
import { Calendar, Clock, User, CreditCard, CheckCircle2, XCircle, AlertCircle, ChevronRight, ArrowUpDown, MoreHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { getPaymentStatus } from "@/lib/reservation-payment";
import { getInclusiveMonths } from "@/lib/reservation-dates";

type PillTone = "green" | "blue" | "purple" | "amber" | "red" | "slate";

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
  createdAt: string;
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

const toneClassNames: Record<PillTone, string> = {
  green: "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
  blue: "border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-300",
  purple: "border-purple-500/20 bg-purple-500/10 text-purple-600 dark:text-purple-300",
  amber: "border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-300",
  red: "border-red-500/25 bg-red-500/10 text-red-600 dark:text-red-300",
  slate: "border-zinc-500/20 bg-zinc-500/10 text-zinc-600 dark:text-zinc-300",
};

const dotClassNames: Record<PillTone, string> = {
  green: "bg-emerald-500",
  blue: "bg-blue-500",
  purple: "bg-purple-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
  slate: "bg-zinc-500",
};

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

function formatPrice(price: string | number): string {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(price));
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function getNights(startDate: string, endDate: string): number {
  const diff = new Date(endDate).getTime() - new Date(startDate).getTime();
  return Math.round(diff / (1000 * 60 * 60 * 24)) + 1;
}

function getMonths(startDate: string, endDate: string): number {
  return getInclusiveMonths(startDate, endDate);
}

function getTemporalStatus(startDate: string, endDate: string, billingType: string, status?: string): { label: string; variant: "default" | "secondary" | "outline" | "destructive"; color: string; sublabel?: string } {
  if (status === "CANCELLED") return { label: "Cancelada", variant: "destructive", color: "#EF4444" };
  if (status === "COMPLETED") return { label: "Finalizada", variant: "outline", color: "#6B7280" };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (today < start) {
    const daysUntil = Math.ceil((start.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return { label: "Próxima", variant: "secondary", color: "#3B82F6", sublabel: `${daysUntil}d` };
  }
  if (today > end) return { label: "Finalizada", variant: "outline", color: "#6B7280" };
  if (billingType === "MONTHLY") {
    const monthsLeft = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24 * 30));
    return { label: "Activa", variant: "default", color: "#10B981", sublabel: `${monthsLeft} meses` };
  }
  const nightsLeft = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return { label: "Activa", variant: "default", color: "#10B981", sublabel: `${nightsLeft} noches` };
}

function getReservationTone(status: string, startDate: string, endDate: string): PillTone {
  if (status === "CANCELLED") return "red";
  if (status === "COMPLETED") return "slate";

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (today >= start && today <= end) return "green";
  if (today < start) return "blue";
  return "slate";
}

function getPaymentTone(paidAmount: number, totalPrice: number): PillTone {
  if (paidAmount >= totalPrice && totalPrice > 0) return "green";
  if (paidAmount > 0) return "amber";
  return "red";
}

function ReservationPill({ tone, label }: { tone: PillTone; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-semibold ${toneClassNames[tone]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dotClassNames[tone]}`} />
      {label}
    </span>
  );
}

function PaymentProgress({ paidAmount, totalPrice, tone }: { paidAmount: number; totalPrice: number; tone: PillTone }) {
  const progress = totalPrice > 0 ? Math.min(Math.max((paidAmount / totalPrice) * 100, 0), 100) : 0;

  return (
    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-200/70 dark:bg-zinc-800">
      <div
        className={`h-full rounded-full ${dotClassNames[tone]} transition-all duration-500`}
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

interface ReservationCardBaseProps {
  reservation: Reservation;
  onEdit?: () => void;
  onView?: () => void;
  onCancel?: () => void;
  onDelete?: () => void;
}

export function ReservationCardMinimal({ reservation, onEdit, onView, onCancel, onDelete }: ReservationCardBaseProps) {
  void onDelete;
  const status = statusConfig[reservation.status] || statusConfig.PENDING;
  const StatusIcon = status.icon;
  const paidAmount = reservation.payments
    .filter((p) => p.status === "COMPLETED")
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const pendingAmount = Number(reservation.totalPrice) - paidAmount;

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-zinc-200/50 dark:border-zinc-800/50 bg-white dark:bg-zinc-950 transition-all duration-500 hover:shadow-2xl hover:shadow-black/5 hover:-translate-y-1">
      <div className="flex">
        <div
          className="w-1 shrink-0"
          style={{ backgroundColor: reservation.property.color || "#6366F1" }}
        />

        <div className="flex-1 p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1 min-w-0">
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                {reservation.property.name}
              </h3>
              <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
                <User className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{reservation.client.name}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <StatusIcon className={`h-4 w-4 text-muted-foreground`} />
              <Badge variant={status.variant} className="text-xs rounded-md">
                {status.label}
              </Badge>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
              <Calendar className="h-4 w-4" />
              <span>
                {formatDate(reservation.startDate)} - {formatDate(reservation.endDate)}
              </span>
              <span className="text-zinc-400">({reservation.billingType === "MONTHLY" ? `${getMonths(reservation.startDate, reservation.endDate)} meses` : `${getNights(reservation.startDate, reservation.endDate)} noches`})</span>
            </div>
          </div>

          <div className="mt-4 flex items-end justify-between">
            <div className="space-y-1">
              <p className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                {formatPrice(reservation.totalPrice)}
              </p>
              {reservation.billingType === "DAILY" ? (
                <p className="text-xs text-zinc-500">por {getNights(reservation.startDate, reservation.endDate)} noches</p>
              ) : (
                <p className="text-xs text-zinc-500">precio mensual</p>
              )}
            </div>

            {pendingAmount > 0 && (
              <div className="text-right">
                <p className="text-xs text-green-600 dark:text-green-400">Pagado: {formatPrice(paidAmount)}</p>
                <p className="text-xs text-orange-600 dark:text-orange-400">Pendiente: {formatPrice(pendingAmount)}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="absolute right-4 top-4 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
        <div className="flex gap-1">
          {onView && (
            <Button size="icon-xs" variant="ghost" onClick={onView}>
              👁
            </Button>
          )}
          {onEdit && (
            <Button size="icon-xs" variant="ghost" onClick={onEdit}>
              ✎
            </Button>
          )}
          {(reservation.status === "PENDING" || reservation.status === "CONFIRMED") && onCancel && (
            <Button size="icon-xs" variant="ghost" onClick={onCancel}>
              ✕
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function ReservationCardCompact({ reservation, onEdit, onView, onCancel, onDelete }: ReservationCardBaseProps) {
  void onCancel;
  const status = statusConfig[reservation.status] || statusConfig.PENDING;
  const StatusIcon = status.icon;
  const nights = getNights(reservation.startDate, reservation.endDate);
  void onDelete;
  void StatusIcon;
  void nights;

  return (
    <div className="group flex items-center gap-4 rounded-xl border border-zinc-200/50 dark:border-zinc-800/50 bg-white dark:bg-zinc-950 p-4 transition-all duration-200 hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-lg hover:shadow-black/5">
      <div
        className="h-12 w-12 shrink-0 rounded-xl flex items-center justify-center text-white font-semibold text-lg"
        style={{ backgroundColor: reservation.property.color || "#6366F1" }}
      >
        {reservation.property.name[0]}
      </div>

      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">
            {reservation.property.name}
          </h3>
          <StatusIcon className={`h-4 w-4 shrink-0 ${status.variant === "destructive" ? "text-destructive" : status.variant === "default" ? "text-green-600" : "text-muted-foreground"}`} />
        </div>
        <div className="flex items-center gap-3 text-xs text-zinc-500">
          <span className="flex items-center gap-1">
            <User className="h-3 w-3" />
            {reservation.client.name}
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {reservation.billingType === "MONTHLY" ? `${getMonths(reservation.startDate, reservation.endDate)} meses` : `${getNights(reservation.startDate, reservation.endDate)} noches`}
          </span>
        </div>
      </div>

      <div className="text-right shrink-0">
        <p className="font-bold text-zinc-900 dark:text-zinc-100">{formatPrice(reservation.totalPrice)}</p>
        <p className="text-xs text-muted-foreground">{formatDate(reservation.startDate)}</p>
      </div>

      <div className="flex gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
        {onView && (
          <Button size="icon-xs" variant="ghost" onClick={onView}>
            👁
          </Button>
        )}
        {onEdit && (
          <Button size="icon-xs" variant="ghost" onClick={onEdit}>
            ✎
          </Button>
        )}
      </div>
    </div>
  );
}

export function ReservationCardEditorial({ reservation, onEdit, onView, onCancel, onDelete }: ReservationCardBaseProps) {
  const status = statusConfig[reservation.status] || statusConfig.PENDING;
  const StatusIcon = status.icon;
  const nights = getNights(reservation.startDate, reservation.endDate);
  const isUpcoming = new Date(reservation.startDate) > new Date();
  const isPast = new Date(reservation.endDate) < new Date();
  void onDelete;
  void StatusIcon;
  void nights;
  void isUpcoming;
  void isPast;
  const paidAmount = reservation.payments
    .filter((p) => p.status === "COMPLETED")
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const pendingAmount = Number(reservation.totalPrice) - paidAmount;

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-stone-200/50 dark:border-stone-800/50 bg-stone-50 dark:bg-stone-900 transition-all duration-500 hover:shadow-2xl">
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4 sm:gap-6 p-4 sm:p-6">
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-widest text-stone-500">
                {reservation.property.name}
              </p>
              <h3 className="font-serif text-2xl font-medium text-stone-900 dark:text-stone-100 mt-1">
                {reservation.client.name}
              </h3>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-stone-100 dark:bg-stone-800">
              <StatusIcon className="h-4 w-4 text-stone-600 dark:text-stone-400" />
              <span className="text-sm font-medium text-stone-700 dark:text-stone-300">
                {status.label}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-stone-200 dark:border-stone-800">
            <div>
              <p className="text-xs text-stone-500 mb-1">Check-in</p>
              <p className="font-medium text-stone-900 dark:text-stone-100">
                {formatFullDate(reservation.startDate)}
              </p>
            </div>
            <div>
              <p className="text-xs text-stone-500 mb-1">Check-out</p>
              <p className="font-medium text-stone-900 dark:text-stone-100">
                {formatFullDate(reservation.endDate)}
              </p>
            </div>
            <div>
              <p className="text-xs text-stone-500 mb-1">Duración</p>
              <p className="font-medium text-stone-900 dark:text-stone-100">
                {reservation.billingType === "MONTHLY" ? `${getMonths(reservation.startDate, reservation.endDate)} meses` : `${getNights(reservation.startDate, reservation.endDate)} noches`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 pt-2">
            <div className="flex items-center gap-2 text-sm text-stone-600 dark:text-stone-400">
              <CreditCard className="h-4 w-4" />
              <span>{reservation.billingType === "DAILY" ? "Tarifa diaria" : "Tarifa mensual"}</span>
            </div>
            {reservation.bookingAirbnb && (
              <Badge variant="outline" className="text-xs">Booking Airbnb</Badge>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end justify-between">
          <div className="text-right">
            <p className="text-3xl font-bold text-stone-900 dark:text-stone-100">
              {formatPrice(reservation.totalPrice)}
            </p>
            <p className="text-sm text-stone-500">total</p>
          </div>

          {pendingAmount > 0 && (
            <div className="mt-4 text-right">
              <p className="text-xs text-stone-500">Pagado</p>
              <p className="text-sm font-medium text-green-600">{formatPrice(paidAmount)}</p>
              <p className="text-xs text-orange-600 mt-1">Pendiente: {formatPrice(pendingAmount)}</p>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-stone-200 dark:border-stone-800 px-6 py-3 bg-stone-100/50 dark:bg-stone-800/50">
        <p className="text-xs text-stone-500 truncate max-w-50">
          {reservation.client.email}
        </p>
        <div className="flex gap-2">
          {onView && (
            <Button size="sm" variant="ghost" onClick={onView}>
              Ver
            </Button>
          )}
          {onEdit && (
            <Button size="sm" variant="ghost" onClick={onEdit}>
              Editar
            </Button>
          )}
          {(reservation.status === "PENDING" || reservation.status === "CONFIRMED") && onCancel && (
            <Button size="sm" variant="ghost" onClick={onCancel}>
              Cancelar
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function ReservationCardTimeline({ reservation, onEdit, onView, onCancel, onDelete }: ReservationCardBaseProps) {
  void onCancel;
  const status = statusConfig[reservation.status] || statusConfig.PENDING;
  const StatusIcon = status.icon;
  void onDelete;
  void StatusIcon;
  const nights = getNights(reservation.startDate, reservation.endDate);
  const startDate = new Date(reservation.startDate);
  const endDate = new Date(reservation.endDate);
  const today = new Date();

  const isUpcoming = startDate > today;
  const isActive = startDate <= today && endDate >= today;
  const isPast = endDate < today;
  void nights;
  void isUpcoming;
  void isActive;
  void isPast;

  return (
    <div className="group relative">
      <div className="absolute left-4 top-0 bottom-0 w-px bg-zinc-200 dark:bg-zinc-800" />

      <div className="relative flex gap-4 pb-6">
        <div
          className={`relative z-10 h-10 w-10 shrink-0 rounded-full flex items-center justify-center text-white font-semibold ${
            isActive ? "ring-4 ring-green-500/30" : ""
          }`}
          style={{ backgroundColor: reservation.property.color || "#6366F1" }}
        >
          {isActive ? (
            <div className="h-3 w-3 rounded-full bg-green-400 animate-pulse" />
          ) : (
            reservation.property.name[0]
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
                {reservation.property.name}
              </h3>
              <p className="text-sm text-zinc-500">{reservation.client.name}</p>
            </div>
            <Badge variant={status.variant} className="shrink-0 rounded-md">
              {status.label}
            </Badge>
          </div>

          <div className="mt-3 flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
              <Calendar className="h-4 w-4" />
              <span>{formatFullDate(reservation.startDate)}</span>
            </div>
            <ChevronRight className="h-4 w-4 text-zinc-300" />
            <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
              <Calendar className="h-4 w-4" />
              <span>{formatFullDate(reservation.endDate)}</span>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-zinc-500">
              <Clock className="h-3.5 w-3.5" />
<span>{reservation.billingType === "MONTHLY" ? `${getMonths(reservation.startDate, reservation.endDate)} meses` : `${getNights(reservation.startDate, reservation.endDate)} noches`}</span>
            </div>
            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {formatPrice(reservation.totalPrice)}
            </span>
          </div>

          <div className="mt-3 flex gap-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            {onView && (
              <Button size="sm" variant="outline" onClick={onView}>
                Ver
              </Button>
            )}
            {onEdit && (
              <Button size="sm" variant="outline" onClick={onEdit}>
                Editar
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ReservationCardKanban({ reservation, onEdit, onView, onCancel, onDelete }: ReservationCardBaseProps) {
  const status = statusConfig[reservation.status] || statusConfig.PENDING;
  const nights = getNights(reservation.startDate, reservation.endDate);
  void onCancel;
  void onDelete;
  void nights;

  return (
    <div className="group rounded-xl border border-zinc-200/50 dark:border-zinc-800/50 bg-white dark:bg-zinc-950 p-4 transition-all duration-200 hover:shadow-lg hover:shadow-black/5 hover:-translate-y-0.5 cursor-pointer"
      onClick={onView}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1 min-w-0">
          <h3 className="font-medium text-zinc-900 dark:text-zinc-100 text-sm truncate">
            {reservation.property.name}
          </h3>
          <p className="text-xs text-zinc-500 truncate">{reservation.client.name}</p>
        </div>
        <div
          className="h-2 w-2 rounded-full shrink-0 mt-1.5"
          style={{ backgroundColor: reservation.property.color || "#6366F1" }}
        />
      </div>

      <div className="mt-3 space-y-1.5 text-xs text-zinc-600 dark:text-zinc-400">
        <div className="flex items-center gap-1.5">
          <Calendar className="h-3 w-3" />
          <span>{formatDate(reservation.startDate)} - {formatDate(reservation.endDate)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="h-3 w-3" />
          <span>{nights} noches</span>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {formatPrice(reservation.totalPrice)}
        </span>
                <Badge variant={status.variant} className="text-xs py-0 rounded-md">
                  {status.label}
                </Badge>
      </div>

      <div className="mt-2 flex gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
        {onEdit && (
          <Button
            size="icon-xs"
            variant="ghost"
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
          >
            ✎
          </Button>
        )}
      </div>
    </div>
  );
}

function ReservationMobileCard({ reservation, onEdit, onView, onDelete }: {
  reservation: Reservation;
  onEdit?: (id: string) => void;
  onView?: (id: string) => void;
  onDelete?: (id: string) => void;
}) {
  const paidAmount = reservation.payments
    .filter((p) => p.status === "COMPLETED")
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const totalPrice = Number(reservation.totalPrice);
  const paymentStatus = getPaymentStatus({ paidAmount, totalPrice, status: reservation.status });
  const temporal = getTemporalStatus(reservation.startDate, reservation.endDate, reservation.billingType, reservation.status);
  const stateTone = getReservationTone(reservation.status, reservation.startDate, reservation.endDate);
  const paymentTone = getPaymentTone(paidAmount, totalPrice);
  const duration = reservation.billingType === "MONTHLY"
    ? `${getMonths(reservation.startDate, reservation.endDate)} meses`
    : `${getNights(reservation.startDate, reservation.endDate)} noches`;
  const runAfterMenuClose = (action: () => void) => {
    window.setTimeout(action, 0);
  };

  return (
    <article className="group relative overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-950/40 p-4 shadow-sm transition-all duration-300 hover:border-zinc-700 hover:bg-zinc-950/70">
      <div className={`absolute inset-y-0 left-0 w-1 ${dotClassNames[stateTone]}`} />
      <div className="flex items-start justify-between gap-3 pl-2">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white shadow-lg ring-2 ring-white/10"
            style={{ backgroundColor: reservation.property.color || "#6366F1" }}
          >
            {getInitials(reservation.client.name)}
          </div>
          <div className="min-w-0">
            <h3 className="truncate font-semibold text-zinc-100">{reservation.client.name}</h3>
            <p className="truncate text-xs text-zinc-500">{reservation.client.email}</p>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger className="rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-zinc-100">
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {onView && <DropdownMenuItem onClick={() => runAfterMenuClose(() => onView(reservation.id))}>Ver</DropdownMenuItem>}
            {onEdit && <DropdownMenuItem onClick={() => runAfterMenuClose(() => onEdit(reservation.id))}>Editar</DropdownMenuItem>}
            {onDelete && <DropdownMenuItem variant="destructive" onClick={() => runAfterMenuClose(() => onDelete(reservation.id))}>Eliminar</DropdownMenuItem>}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 pl-2 text-sm">
        <div>
          <p className="text-xs text-zinc-500">Propiedad</p>
          <p className="mt-1 flex items-center gap-2 font-medium text-zinc-200">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: reservation.property.color || "#6366F1" }} />
            {reservation.property.name}
          </p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">Total</p>
          <p className="mt-1 text-right font-bold tabular-nums text-zinc-100">{formatPrice(reservation.totalPrice)}</p>
        </div>
        <div className="col-span-2">
          <p className="text-xs text-zinc-500">Fechas</p>
          <p className="mt-1 font-medium text-zinc-200">{formatDate(reservation.startDate)} - {formatDate(reservation.endDate)}</p>
          <p className="text-xs text-zinc-500">{duration}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 pl-2">
        <ReservationPill tone={stateTone} label={temporal.label} />
        <ReservationPill tone={reservation.billingType === "DAILY" ? "blue" : "purple"} label={reservation.billingType === "DAILY" ? "Diario" : "Mensual"} />
        <ReservationPill tone={paymentTone} label={paymentStatus.label} />
      </div>

      <div className="mt-3 pl-2">
        <div className="flex items-center justify-between text-xs text-zinc-500">
          <span>Pagado</span>
          <span className="tabular-nums">{formatPrice(paidAmount)} / {formatPrice(totalPrice)}</span>
        </div>
        <PaymentProgress paidAmount={paidAmount} totalPrice={totalPrice} tone={paymentTone} />
      </div>
    </article>
  );
}

export function ReservationTable({ reservations, onEdit, onView, onCancel, onDelete }: {
  reservations: Reservation[];
  onEdit?: (id: string) => void;
  onView?: (id: string) => void;
  onCancel?: (id: string) => void;
  onDelete?: (id: string) => void;
}) {
  void onCancel;
  const [sortField, setSortField] = useState<"startDate" | "totalPrice" | "client" | "createdAt">("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const runAfterMenuClose = (action: () => void) => {
    window.setTimeout(action, 0);
  };

  const sorted = [...reservations].sort((a, b) => {
    let cmp = 0;
    if (sortField === "startDate") {
      cmp = new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
    } else if (sortField === "totalPrice") {
      cmp = Number(a.totalPrice) - Number(b.totalPrice);
    } else if (sortField === "createdAt") {
      cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    } else {
      cmp = a.client.name.localeCompare(b.client.name);
    }
    return sortDir === "asc" ? cmp : -cmp;
  });

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:hidden">
        {sorted.map((res) => (
          <ReservationMobileCard
            key={res.id}
            reservation={res}
            onView={onView}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </div>

      <div className="hidden rounded-2xl border border-zinc-200/70 bg-zinc-950/[0.02] p-2 shadow-sm dark:border-zinc-800/80 dark:bg-zinc-950/30 md:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1200px] border-separate border-spacing-y-2 text-sm">
          <thead className="sticky top-0 z-10 bg-zinc-100/90 backdrop-blur dark:bg-zinc-950/90">
            <tr>
              <th className="rounded-l-xl px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">
                <button
                  onClick={() => toggleSort("client")}
                  className="flex items-center gap-1 hover:text-zinc-900 dark:hover:text-zinc-100"
                >
                  Cliente
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">
                <button
                  onClick={() => toggleSort("createdAt")}
                  className="flex items-center gap-1 hover:text-zinc-900 dark:hover:text-zinc-100"
                >
                  Creación
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">Propiedad</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">Fechas</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">Tipo</th>
              <th className="px-4 py-3 text-right font-medium text-zinc-600 dark:text-zinc-400">
                <button
                  onClick={() => toggleSort("totalPrice")}
                  className="flex items-center gap-1 ml-auto hover:text-zinc-900 dark:hover:text-zinc-100"
                >
                  Total
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="px-4 py-3 text-center font-medium text-zinc-600 dark:text-zinc-400">Estado</th>
              <th className="px-4 py-3 text-center font-medium text-zinc-600 dark:text-zinc-400">Pago</th>
              <th className="rounded-r-xl px-4 py-3 text-right font-medium text-zinc-600 dark:text-zinc-400">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((res) => {
              const paidAmount = res.payments
                .filter((p) => p.status === "COMPLETED")
                .reduce((sum, p) => sum + Number(p.amount), 0);
              const totalPrice = Number(res.totalPrice);
              const paymentStatus = getPaymentStatus({
                paidAmount,
                totalPrice,
                status: res.status,
              });
              const temporal = getTemporalStatus(res.startDate, res.endDate, res.billingType, res.status);
              const stateTone = getReservationTone(res.status, res.startDate, res.endDate);
              const paymentTone = getPaymentTone(paidAmount, totalPrice);
              const duration = res.billingType === "MONTHLY" ? `${getMonths(res.startDate, res.endDate)} meses` : `${getNights(res.startDate, res.endDate)} noches`;
              return (
                <tr key={res.id} className="group relative transition-transform duration-200 hover:-translate-y-0.5">
                  <td className="relative rounded-l-xl border-y border-l border-zinc-200/70 bg-white p-4 shadow-sm transition-colors group-hover:bg-zinc-50 dark:border-zinc-800/80 dark:bg-zinc-950/40 dark:group-hover:bg-zinc-900/60">
                    <div className={`absolute inset-y-3 left-0 w-1 rounded-r-full ${dotClassNames[stateTone]}`} />
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white shadow-lg ring-2 ring-white/10"
                        style={{ backgroundColor: res.property.color || "#6366F1" }}
                      >
                        {getInitials(res.client.name)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-zinc-900 dark:text-zinc-100">{res.client.name}</p>
                        <p className="truncate text-xs text-zinc-500">{res.client.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="border-y border-zinc-200/70 bg-white p-4 text-sm text-zinc-500 shadow-sm transition-colors group-hover:bg-zinc-50 dark:border-zinc-800/80 dark:bg-zinc-950/40 dark:group-hover:bg-zinc-900/60">
                    {formatFullDate(res.createdAt)}
                  </td>
                  <td className="border-y border-zinc-200/70 bg-white p-4 shadow-sm transition-colors group-hover:bg-zinc-50 dark:border-zinc-800/80 dark:bg-zinc-950/40 dark:group-hover:bg-zinc-900/60">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2.5 w-2.5 rounded-full ring-2 ring-white/10"
                        style={{ backgroundColor: res.property.color || "#6366F1" }}
                      />
                      <span className="font-medium text-zinc-700 dark:text-zinc-300">{res.property.name}</span>
                    </div>
                  </td>
                  <td className="border-y border-zinc-200/70 bg-white p-4 shadow-sm transition-colors group-hover:bg-zinc-50 dark:border-zinc-800/80 dark:bg-zinc-950/40 dark:group-hover:bg-zinc-900/60">
                    <div className="space-y-0.5 text-zinc-700 dark:text-zinc-300">
                      <p className="font-medium">{formatDate(res.startDate)} - {formatDate(res.endDate)}</p>
                      <p className="text-xs text-zinc-500">{duration}</p>
                    </div>
                  </td>
                  <td className="border-y border-zinc-200/70 bg-white p-4 shadow-sm transition-colors group-hover:bg-zinc-50 dark:border-zinc-800/80 dark:bg-zinc-950/40 dark:group-hover:bg-zinc-900/60">
                    <ReservationPill tone={res.billingType === "DAILY" ? "blue" : "purple"} label={res.billingType === "DAILY" ? "Diario" : "Mensual"} />
                  </td>
                  <td className="border-y border-zinc-200/70 bg-white p-4 text-right shadow-sm transition-colors group-hover:bg-zinc-50 dark:border-zinc-800/80 dark:bg-zinc-950/40 dark:group-hover:bg-zinc-900/60">
                    <span className="font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
                      {formatPrice(res.totalPrice)}
                    </span>
                  </td>
                  <td className="border-y border-zinc-200/70 bg-white p-4 text-center shadow-sm transition-colors group-hover:bg-zinc-50 dark:border-zinc-800/80 dark:bg-zinc-950/40 dark:group-hover:bg-zinc-900/60">
                    <div className="flex flex-col items-center justify-center gap-1">
                      <ReservationPill tone={stateTone} label={temporal.label} />
                      {temporal.sublabel && (
                        <span className="text-xs text-zinc-500">{temporal.sublabel}</span>
                      )}
                    </div>
                  </td>
                  <td className="border-y border-zinc-200/70 bg-white p-4 text-center shadow-sm transition-colors group-hover:bg-zinc-50 dark:border-zinc-800/80 dark:bg-zinc-950/40 dark:group-hover:bg-zinc-900/60">
                    <div className="mx-auto w-36">
                      <ReservationPill tone={paymentTone} label={paymentStatus.label} />
                      <span className="mt-1 block text-xs tabular-nums text-muted-foreground">
                        {formatPrice(paidAmount)} / {formatPrice(totalPrice)}
                      </span>
                      <PaymentProgress paidAmount={paidAmount} totalPrice={totalPrice} tone={paymentTone} />
                    </div>
                  </td>
                  <td className="rounded-r-xl border-y border-r border-zinc-200/70 bg-white p-4 text-right shadow-sm transition-colors group-hover:bg-zinc-50 dark:border-zinc-800/80 dark:bg-zinc-950/40 dark:group-hover:bg-zinc-900/60">
                    <div className="flex items-center justify-end gap-1 opacity-70 transition-opacity group-hover:opacity-100">
                      <DropdownMenu>
                        <DropdownMenuTrigger className="cursor-pointer rounded-md p-1.5 transition-colors hover:bg-muted">
                          <MoreHorizontal className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {onView && <DropdownMenuItem onClick={() => runAfterMenuClose(() => onView(res.id))}>Ver detalle</DropdownMenuItem>}
                          {onEdit && <DropdownMenuItem onClick={() => runAfterMenuClose(() => onEdit(res.id))}>Editar reserva</DropdownMenuItem>}
                          {onDelete && (
                            <DropdownMenuItem variant="destructive" onClick={() => runAfterMenuClose(() => onDelete(res.id))}>
                              Eliminar
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}

export function ReservationTableCards({ reservations, onEdit, onView, onCancel, onDelete }: {
  reservations: Reservation[];
  onEdit?: (id: string) => void;
  onView?: (id: string) => void;
  onCancel?: (id: string) => void;
  onDelete?: (id: string) => void;
}) {
  void onCancel;
  void onDelete;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {reservations.map((res) => {
        const status = statusConfig[res.status] || statusConfig.PENDING;
        return (
          <div
            key={res.id}
            className="group rounded-xl border border-zinc-200/50 dark:border-zinc-800/50 bg-white dark:bg-zinc-950 overflow-hidden transition-all duration-200 hover:shadow-lg hover:shadow-black/5 hover:-translate-y-0.5"
          >
            <div className="h-1" style={{ backgroundColor: res.property.color || "#6366F1" }} />

            <div className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground truncate">{res.property.name}</p>
                  <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">{res.client.name}</h3>
                </div>
                <Badge variant={status.variant} className="text-xs shrink-0 rounded-md">
                  {status.label}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="space-y-1">
                  <p className="text-muted-foreground">Check-in</p>
                  <p className="font-medium text-zinc-900 dark:text-zinc-100">{formatFullDate(res.startDate)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground">Check-out</p>
                  <p className="font-medium text-zinc-900 dark:text-zinc-100">{formatFullDate(res.endDate)}</p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <div className="text-right">
                  <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{formatPrice(res.totalPrice)}</p>
                  <p className="text-xs text-muted-foreground">{res.billingType === "MONTHLY" ? `${getMonths(res.startDate, res.endDate)} meses` : `${getNights(res.startDate, res.endDate)} noches`}</p>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {onView && (
                    <Button size="icon-xs" variant="ghost" onClick={() => onView(res.id)}>
                      👁
                    </Button>
                  )}
                  {onEdit && (
                    <Button size="icon-xs" variant="ghost" onClick={() => onEdit(res.id)}>
                      ✎
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
