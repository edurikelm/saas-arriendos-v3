"use client";

import { useState } from "react";
import { Calendar, Clock, User, Home, CreditCard, MapPin, CheckCircle2, XCircle, AlertCircle, ChevronRight, ArrowUpDown, Filter, MoreHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { getPaymentStatus } from "@/lib/reservation-payment";

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
  return new Intl.NumberFormat("CLP", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(price));
}

function getNights(startDate: string, endDate: string): number {
  const diff = new Date(endDate).getTime() - new Date(startDate).getTime();
  return Math.round(diff / (1000 * 60 * 60 * 24)) + 1;
}

function getMonths(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  return months >= 1 ? months : 1;
}

function getTemporalStatus(startDate: string, endDate: string): { label: string; variant: "default" | "secondary" | "outline" | "destructive"; color: string } {
  const today = new Date();
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (today < start) return { label: "Próxima", variant: "secondary", color: "#3B82F6" };
  if (today > end) return { label: "Finalizada", variant: "outline", color: "#6B7280" };
  return { label: "Activa", variant: "default", color: "#10B981" };
}

interface ReservationCardBaseProps {
  reservation: Reservation;
  onEdit?: () => void;
  onView?: () => void;
  onCancel?: () => void;
  onDelete?: () => void;
}

export function ReservationCardMinimal({ reservation, onEdit, onView, onCancel, onDelete }: ReservationCardBaseProps) {
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
              <Badge variant={status.variant} className="text-xs">
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
  const status = statusConfig[reservation.status] || statusConfig.PENDING;
  const StatusIcon = status.icon;
  const nights = getNights(reservation.startDate, reservation.endDate);

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
  const paidAmount = reservation.payments
    .filter((p) => p.status === "COMPLETED")
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const pendingAmount = Number(reservation.totalPrice) - paidAmount;

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-stone-200/50 dark:border-stone-800/50 bg-stone-50 dark:bg-stone-900 transition-all duration-500 hover:shadow-2xl">
      <div className="grid grid-cols-[1fr_auto] gap-6 p-6">
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
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-stone-100 dark:bg-stone-800">
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
  const status = statusConfig[reservation.status] || statusConfig.PENDING;
  const StatusIcon = status.icon;
  const nights = getNights(reservation.startDate, reservation.endDate);
  const startDate = new Date(reservation.startDate);
  const endDate = new Date(reservation.endDate);
  const today = new Date();

  const isUpcoming = startDate > today;
  const isActive = startDate <= today && endDate >= today;
  const isPast = endDate < today;

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
            <Badge variant={status.variant} className="shrink-0">
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
        <Badge variant={status.variant} className="text-xs py-0">
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

export function ReservationTable({ reservations, onEdit, onView, onCancel, onDelete }: {
  reservations: Reservation[];
  onEdit?: (id: string) => void;
  onView?: (id: string) => void;
  onCancel?: (id: string) => void;
  onDelete?: (id: string) => void;
}) {
  const [sortField, setSortField] = useState<"startDate" | "totalPrice" | "client">("startDate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const sorted = [...reservations].sort((a, b) => {
    let cmp = 0;
    if (sortField === "startDate") {
      cmp = new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
    } else if (sortField === "totalPrice") {
      cmp = Number(a.totalPrice) - Number(b.totalPrice);
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
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800">
            <tr>
              <th className="text-left p-4 font-medium text-zinc-600 dark:text-zinc-400">
                <button
                  onClick={() => toggleSort("client")}
                  className="flex items-center gap-1 hover:text-zinc-900 dark:hover:text-zinc-100"
                >
                  Cliente
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="text-left p-4 font-medium text-zinc-600 dark:text-zinc-400">Propiedad</th>
              <th className="text-left p-4 font-medium text-zinc-600 dark:text-zinc-400">Fechas</th>
              <th className="text-left p-4 font-medium text-zinc-600 dark:text-zinc-400">Tipo</th>
              <th className="text-right p-4 font-medium text-zinc-600 dark:text-zinc-400">
                <button
                  onClick={() => toggleSort("totalPrice")}
                  className="flex items-center gap-1 ml-auto hover:text-zinc-900 dark:hover:text-zinc-100"
                >
                  Total
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="text-center p-4 font-medium text-zinc-600 dark:text-zinc-400">Estado</th>
              <th className="text-center p-4 font-medium text-zinc-600 dark:text-zinc-400">Pago</th>
              <th className="text-right p-4 font-medium text-zinc-600 dark:text-zinc-400">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {sorted.map((res) => {
              const status = statusConfig[res.status] || statusConfig.PENDING;
              const paidAmount = res.payments
                .filter((p) => p.status === "COMPLETED")
                .reduce((sum, p) => sum + Number(p.amount), 0);
              const totalPrice = Number(res.totalPrice);
              let paymentColor = "#EF4444";
              if (paidAmount === totalPrice && totalPrice > 0) {
                paymentColor = "#10B981";
              } else if (paidAmount > 0) {
                paymentColor = "#F59E0B";
              }
              const paymentStatus = getPaymentStatus({
                paidAmount,
                totalPrice,
                status: res.status,
              });
              return (
                <tr key={res.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-medium shrink-0"
                        style={{ backgroundColor: res.property.color || "#6366F1" }}
                      >
                        {res.client.name[0]}
                      </div>
                      <div>
                        <p className="font-medium text-zinc-900 dark:text-zinc-100">{res.client.name}</p>
                        <p className="text-xs text-zinc-500">{res.client.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: res.property.color }}
                      />
                      <span className="text-zinc-700 dark:text-zinc-300">{res.property.name}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="text-zinc-600 dark:text-zinc-400">
                      <span>{formatDate(res.startDate)}</span>
                      <span className="mx-1 text-zinc-300">→</span>
                      <span>{formatDate(res.endDate)}</span>
                      <span className="ml-1 text-xs text-zinc-400">({res.billingType === "MONTHLY" ? `${getMonths(res.startDate, res.endDate)} meses` : `${getNights(res.startDate, res.endDate)} noches`})</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className={`text-xs px-2 py-1 rounded-full ${res.billingType === "DAILY" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" : "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"}`}>
                      {res.billingType === "DAILY" ? "Diario" : "Mensual"}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                      {formatPrice(res.totalPrice)}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    {(() => {
                      const temporal = getTemporalStatus(res.startDate, res.endDate);
                      return (
                        <div className="flex items-center justify-center gap-1.5">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: temporal.color }}
                          />
                          <Badge variant={temporal.variant} className="text-xs">
                            {temporal.label}
                          </Badge>
                        </div>
                      );
                    })()}
                  </td>
                  <td className="p-4 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <span
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: paymentStatus.color }}
                        title={paymentStatus.tooltip}
                      />
                      <Badge variant={paymentStatus.variant} className="text-xs">
                        {paymentStatus.label}
                      </Badge>
                    </div>
                  </td>
                  <td className="p-4 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger className="cursor-pointer rounded-md p-1.5 hover:bg-muted transition-colors">
                        <MoreHorizontal className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {onView && (
                          <DropdownMenuItem onClick={() => onView(res.id)}>
                            Ver
                          </DropdownMenuItem>
                        )}
                        {onEdit && (
                          <DropdownMenuItem onClick={() => onEdit(res.id)}>
                            Editar
                          </DropdownMenuItem>
                        )}
                        {onDelete && (
                          <DropdownMenuItem variant="destructive" onClick={() => onDelete(res.id)}>
                            Eliminar
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
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
                <Badge variant={status.variant} className="text-xs shrink-0">
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