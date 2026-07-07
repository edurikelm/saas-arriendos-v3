"use client";

import { useState } from "react";
import { CheckCircle2, XCircle, AlertCircle, ArrowUpDown, Eye, Pencil, Ban, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTable } from "@/components/ui/data-table";
import { getPaymentStatus } from "@/lib/reservation-payment";
import { getInclusiveMonths } from "@/lib/reservation-dates";
import { getReservationPaidAmount } from "@/lib/payments/calculations";
import type { Reservation } from "./types";
import { formatDate, formatPrice } from "./reservations-utils";

type PillTone = "success" | "info" | "info-strong" | "warning" | "destructive" | "neutral";

const statusConfig: Record<string, { label: string; variant: "warning" | "success" | "destructive" | "secondary"; icon: React.ComponentType<{ className?: string }> }> = {
  PENDING: { label: "Pendiente", variant: "warning", icon: AlertCircle },
  CONFIRMED: { label: "Confirmada", variant: "success", icon: CheckCircle2 },
  CANCELLED: { label: "Cancelada", variant: "destructive", icon: XCircle },
  COMPLETED: { label: "Completada", variant: "secondary", icon: CheckCircle2 },
};

const toneClassNames: Record<PillTone, string> = {
  success: "border-success/20 bg-success/10 text-success",
  info: "border-info/20 bg-info/10 text-info-foreground",
  "info-strong": "border-info/30 bg-info/25 text-info-foreground",
  warning: "border-warning/25 bg-warning/10 text-warning-foreground",
  destructive: "border-destructive/25 bg-destructive/10 text-destructive",
  neutral: "border-muted bg-muted/60 text-muted-foreground",
};

const dotClassNames: Record<PillTone, string> = {
  success: "bg-success",
  info: "bg-info",
  "info-strong": "bg-info",
  warning: "bg-warning",
  destructive: "bg-destructive",
  neutral: "bg-muted-foreground",
};

function formatFullDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("es-CL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
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

function getTemporalStatus(startDate: string, endDate: string, billingType: string, status?: string): { label: string; sublabel?: string } {
  if (status === "CANCELLED") return { label: "Cancelada" };
  if (status === "COMPLETED") return { label: "Finalizada" };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (today < start) {
    const daysUntil = Math.ceil((start.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return { label: "Próxima", sublabel: `${daysUntil}d` };
  }
  if (today > end) return { label: "Finalizada" };
  if (billingType === "MONTHLY") {
    const monthsLeft = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24 * 30));
    return { label: "Activa", sublabel: `${monthsLeft} meses` };
  }
  const nightsLeft = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return { label: "Activa", sublabel: `${nightsLeft} noches` };
}

function getReservationTone(status: string, startDate: string, endDate: string): PillTone {
  if (status === "CANCELLED") return "destructive";
  if (status === "COMPLETED") return "neutral";

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (today >= start && today <= end) return "success";
  if (today < start) return "info";
  return "neutral";
}

function getPaymentTone(paidAmount: number, totalPrice: number): PillTone {
  if (paidAmount >= totalPrice && totalPrice > 0) return "success";
  if (paidAmount > 0) return "warning";
  return "destructive";
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
    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
      <div
        className={`h-full rounded-full ${dotClassNames[tone]} transition-all duration-500`}
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

function ReservationMobileCard({ reservation, onEdit, onView, onCancel, onDelete }: {
  reservation: Reservation;
  onEdit?: (id: string) => void;
  onView?: (id: string) => void;
  onCancel?: (id: string) => void;
  onDelete?: (id: string) => void;
}) {
  const paidAmount = getReservationPaidAmount(reservation.payments);
  const totalPrice = Number(reservation.totalPrice);
  const paymentStatus = getPaymentStatus({ paidAmount, totalPrice, status: reservation.status });
  const temporal = getTemporalStatus(reservation.startDate, reservation.endDate, reservation.billingType, reservation.status);
  const stateTone = getReservationTone(reservation.status, reservation.startDate, reservation.endDate);
  const paymentTone = getPaymentTone(paidAmount, totalPrice);
  const duration = reservation.billingType === "MONTHLY"
    ? `${getMonths(reservation.startDate, reservation.endDate)} meses`
    : `${getNights(reservation.startDate, reservation.endDate)} noches`;

  return (
    <article className="group relative overflow-hidden rounded-xl border border-border bg-card p-3.5 shadow-sm transition-all duration-300 hover:border-border hover:bg-accent">
      <div className={`absolute inset-y-0 left-0 w-1 ${dotClassNames[stateTone]}`} />
      <div className="flex items-start gap-3 pl-1.5">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
          style={{ backgroundColor: reservation.property.color || "var(--primary)" }}
        >
          {getInitials(reservation.client.name)}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold text-foreground">{reservation.client.name}</h3>
              <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: reservation.property.color || "var(--primary)" }} />
                <span className="truncate">{reservation.property.name}</span>
              </p>
            </div>
            <p className="shrink-0 text-right text-base font-bold tabular-nums text-foreground">{formatPrice(reservation.totalPrice)}</p>
          </div>
          <p className="text-xs text-muted-foreground">
            <span className="tabular-nums">{formatDate(reservation.startDate)} – {formatDate(reservation.endDate)}</span>
            <span className="text-muted-foreground"> · {duration}</span>
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5 pl-1.5">
        <ReservationPill tone={stateTone} label={temporal.label} />
        <ReservationPill tone={reservation.billingType === "DAILY" ? "info" : "info-strong"} label={reservation.billingType === "DAILY" ? "Diario" : "Mensual"} />
        <ReservationPill tone={paymentTone} label={paymentStatus.label} />
      </div>

      <div className="mt-3 pl-1.5">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Pagado</span>
          <span className="tabular-nums">{formatPrice(paidAmount)} / {formatPrice(totalPrice)}</span>
        </div>
        <PaymentProgress paidAmount={paidAmount} totalPrice={totalPrice} tone={paymentTone} />
      </div>

      <div className="mt-3 flex items-center justify-end gap-1 pl-1.5">
        {onView && (
          <Button size="icon" variant="ghost" className="size-8 text-muted-foreground hover:text-foreground" onClick={() => onView(reservation.id)} title="Ver">
            <Eye className="h-4 w-4" />
          </Button>
        )}
        {onEdit && (
          <Button size="icon" variant="ghost" className="size-8 text-muted-foreground hover:text-foreground" onClick={() => onEdit(reservation.id)} title="Editar">
            <Pencil className="h-4 w-4" />
          </Button>
        )}
        {(reservation.status === "PENDING" || reservation.status === "CONFIRMED") && onCancel && (
          <Button size="icon" variant="ghost" className="size-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" onClick={() => onCancel(reservation.id)} title="Cancelar">
            <Ban className="h-4 w-4" />
          </Button>
        )}
        {(reservation.status === "CANCELLED" || reservation.status === "COMPLETED") && onDelete && (
          <Button size="icon" variant="ghost" className="size-8 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => onDelete(reservation.id)} title="Eliminar">
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </article>
  );
}

export function ReservationTable({ reservations, onEdit, onView, onCancel, onDelete, selectedIds, onToggleSelect }: {
  reservations: Reservation[];
  onEdit?: (id: string) => void;
  onView?: (id: string) => void;
  onCancel?: (id: string) => void;
  onDelete?: (id: string) => void;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
}) {
  const isSelectable = Boolean(selectedIds && onToggleSelect);
  const [sortField, setSortField] = useState<"startDate" | "totalPrice" | "client" | "createdAt">("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

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
            onCancel={onCancel}
            onDelete={onDelete}
          />
        ))}
      </div>

      <div className="hidden md:block">
        <DataTable
          headers={["Cliente", "Creación", "Propiedad", "Fechas", "Tipo", "Total", "Estado", "Pago", "Acciones"]}
        >
          {sorted.map((res) => {
            const paidAmount = getReservationPaidAmount(res.payments);
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
            const isSelected = selectedIds?.has(res.id);
            return (
              <tr key={res.id} className={`border-b last:border-0 hover:bg-muted/30 transition-colors ${isSelected ? "bg-muted/30" : ""}`}>
                {isSelectable && (
                  <td className="px-3 py-3 w-10">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => onToggleSelect!(res.id)}
                      aria-label={`Seleccionar reserva de ${res.client.name}`}
                    />
                  </td>
                )}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                      style={{ backgroundColor: res.property.color || "var(--primary)" }}
                    >
                      {getInitials(res.client.name)}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{res.client.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{res.client.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {formatFullDate(res.createdAt)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: res.property.color || "var(--primary)" }}
                    />
                    <span className="font-medium">{res.property.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="space-y-0.5">
                    <p className="font-medium">{formatDate(res.startDate)} - {formatDate(res.endDate)}</p>
                    <p className="text-xs text-muted-foreground">{duration}</p>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <ReservationPill tone={res.billingType === "DAILY" ? "info" : "info-strong"} label={res.billingType === "DAILY" ? "Diario" : "Mensual"} />
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="font-bold tabular-nums">
                    {formatPrice(res.totalPrice)}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex flex-col items-center justify-center gap-1">
                    <ReservationPill tone={stateTone} label={temporal.label} />
                    {temporal.sublabel && (
                      <span className="text-xs text-muted-foreground">{temporal.sublabel}</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="mx-auto w-36">
                    <ReservationPill tone={paymentTone} label={paymentStatus.label} />
                    <span className="mt-1 block text-xs tabular-nums text-muted-foreground">
                      {formatPrice(paidAmount)} / {formatPrice(totalPrice)}
                    </span>
                    <PaymentProgress paidAmount={paidAmount} totalPrice={totalPrice} tone={paymentTone} />
                  </div>
                </td>
                <td className={`px-4 py-3 text-right ${isSelectable ? "w-32" : ""}`}>
                  <div className="flex items-center justify-end gap-1">
                    {onView && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-8"
                        onClick={() => onView(res.id)}
                        title="Ver"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    )}
                    {onEdit && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-8"
                        onClick={() => onEdit(res.id)}
                        title="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    {(res.status === "CANCELLED" || res.status === "COMPLETED") && onDelete && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => onDelete(res.id)}
                        title="Eliminar"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                    {(res.status === "PENDING" || res.status === "CONFIRMED") && onCancel && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-8 hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => onCancel(res.id)}
                        title="Cancelar"
                      >
                        <Ban className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </DataTable>
      </div>
    </div>
  );
}
