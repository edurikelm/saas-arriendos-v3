"use client";

import { useState } from "react";
import { MoreVertical, Eye, Pencil, Ban, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTable } from "@/components/ui/data-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getInclusiveMonths } from "@/lib/reservation-dates";
import { getReservationPaidAmount } from "@/lib/payments/calculations";
import type { Reservation } from "./types";
import { formatDate, formatPrice } from "./reservations-utils";

type PillTone = "success" | "info" | "info-strong" | "warning" | "destructive" | "neutral";

const toneClassNames: Record<PillTone, string> = {
  success: "border-success/20 bg-success/10 text-success",
  info: "border-info/20 bg-info/10 text-info",
  "info-strong": "border-info/30 bg-info/25 text-info",
  warning: "border-warning/25 bg-warning/10 text-warning",
  destructive: "border-destructive/25 bg-destructive/10 text-destructive",
  neutral: "border-muted bg-muted text-muted-foreground",
};

const dotClassNames: Record<PillTone, string> = {
  success: "bg-success",
  info: "bg-info",
  "info-strong": "bg-info",
  warning: "bg-warning",
  destructive: "bg-destructive",
  neutral: "bg-muted-foreground",
};

const verticalBarClassNames: Record<PillTone, string> = {
  success: "bg-success",
  info: "bg-info",
  "info-strong": "bg-info",
  warning: "bg-warning",
  destructive: "bg-destructive",
  neutral: "bg-muted-foreground",
};

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
    return { label: "Próxima", sublabel: `En ${daysUntil} días` };
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
    <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[9px] font-bold uppercase tracking-tight ${toneClassNames[tone]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dotClassNames[tone]}`} />
      {label}
    </span>
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
  const temporal = getTemporalStatus(reservation.startDate, reservation.endDate, reservation.billingType, reservation.status);
  const stateTone = getReservationTone(reservation.status, reservation.startDate, reservation.endDate);
  const paymentTone = getPaymentTone(paidAmount, totalPrice);
  const duration = reservation.billingType === "MONTHLY"
    ? `${getMonths(reservation.startDate, reservation.endDate)} meses`
    : `${getNights(reservation.startDate, reservation.endDate)} noches`;

  const finLabel = paymentTone === "success"
    ? "Saldado"
    : paymentTone === "warning"
      ? formatPrice(totalPrice - paidAmount)
      : "Pendiente";
  const finSubtext = paymentTone === "success"
    ? `${formatPrice(paidAmount)} pagado`
    : paymentTone === "warning"
      ? `Restante de ${formatPrice(totalPrice)}`
      : "Sin abonos";

  return (
    <article className="group relative overflow-hidden rounded-xl border border-border bg-card p-3.5 transition-all duration-300 hover:bg-accent">
      <div className={`absolute inset-y-0 left-0 w-1 ${dotClassNames[stateTone]}`} />
      <div className="flex items-start gap-3 pl-1.5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
          {getInitials(reservation.client.name)}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold text-foreground">{reservation.client.name}</h3>
              <p className="truncate text-xs text-muted-foreground">{reservation.property.name}</p>
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
      </div>

      <div className="mt-3 flex items-stretch gap-2 pl-1.5">
        <div className={`w-0.5 rounded-full ${verticalBarClassNames[paymentTone]}`} />
        <div className="flex flex-col">
          <p className={`text-xs font-bold ${paymentTone === "success" ? "text-success" : paymentTone === "warning" ? "text-foreground" : "text-destructive"}`}>{finLabel}</p>
          <p className="text-[10px] text-muted-foreground">{finSubtext}</p>
        </div>
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
          headers={["Huésped", "Propiedad", "Estado", "Estancia", "Finanzas", "Tipo", "Acciones"]}
        >
          {sorted.map((res) => {
            const paidAmount = getReservationPaidAmount(res.payments);
            const totalPrice = Number(res.totalPrice);
            const temporal = getTemporalStatus(res.startDate, res.endDate, res.billingType, res.status);
            const stateTone = getReservationTone(res.status, res.startDate, res.endDate);
            const paymentTone = getPaymentTone(paidAmount, totalPrice);
            const duration = res.billingType === "MONTHLY" ? `${getMonths(res.startDate, res.endDate)} meses` : `${getNights(res.startDate, res.endDate)} noches`;
            const isSelected = selectedIds?.has(res.id);

            const finLabel = paymentTone === "success"
              ? "Saldado"
              : paymentTone === "warning"
                ? formatPrice(totalPrice - paidAmount)
                : formatPrice(totalPrice);
            const finSubtext = paymentTone === "success"
              ? res.status === "COMPLETED"
                ? `${formatPrice(paidAmount)} completado`
                : `${formatPrice(paidAmount)} pagado`
              : paymentTone === "warning"
                ? `Restante de ${formatPrice(totalPrice)}`
                : res.status === "CANCELLED"
                  ? "Pendiente de pago"
                  : "Sin abonos";

            return (
              <tr key={res.id} className={`border-b last:border-0 hover:bg-muted/30 transition-colors ${isSelected ? "bg-muted/30" : ""}`}>
                {isSelectable && (
                  <td className="px-6 py-5 w-10">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => onToggleSelect!(res.id)}
                      aria-label={`Seleccionar reserva de ${res.client.name}`}
                    />
                  </td>
                )}
                {/* Huésped */}
                <td className="px-6 py-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      {getInitials(res.client.name)}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-foreground">{res.client.name}</p>
                      <p className="truncate text-[10px] text-muted-foreground">{res.client.email}</p>
                    </div>
                  </div>
                </td>
                {/* Propiedad */}
                <td className="px-6 py-5 text-xs font-medium text-foreground">
                  {res.property.name}
                </td>
                {/* Estado */}
                <td className="px-6 py-5">
                  <div className="flex flex-col gap-1">
                    <ReservationPill tone={stateTone} label={temporal.label} />
                    {temporal.sublabel && (
                      <span className="text-[9px] text-muted-foreground pl-1">{temporal.sublabel}</span>
                    )}
                  </div>
                </td>
                {/* Estancia */}
                <td className="px-6 py-5">
                  <div className="text-xs text-foreground font-medium whitespace-nowrap">
                    {formatDate(res.startDate)} - {formatDate(res.endDate)}
                  </div>
                  <div className="mt-0.5">
                    <span className="text-[9px] text-muted uppercase font-bold tracking-tight">{duration}</span>
                  </div>
                </td>
                {/* Finanzas */}
                <td className="px-6 py-5">
                  <div className="flex items-stretch gap-3">
                    <div className={`w-0.5 rounded-full ${verticalBarClassNames[paymentTone]}`} />
                    <div className="flex flex-col">
                      <p className={`text-xs font-bold ${paymentTone === "success" ? "text-success" : paymentTone === "warning" ? "text-foreground" : "text-destructive"}`}>
                        {finLabel}
                      </p>
                      <p className="text-[10px] text-muted-foreground">{finSubtext}</p>
                    </div>
                  </div>
                </td>
                {/* Tipo */}
                <td className="px-6 py-5">
                  <div className="flex justify-center">
                    <span className="inline-flex px-2 py-0.5 rounded bg-muted text-muted-foreground text-[9px] font-bold uppercase">
                      {res.billingType === "DAILY" ? "Diaria" : "Mensual"}
                    </span>
                  </div>
                </td>
                {/* Acciones */}
                <td className={`px-6 py-5 text-right ${isSelectable ? "w-20" : ""}`}>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      className="inline-flex size-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      aria-label="Más acciones"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {onView && (
                        <DropdownMenuItem onClick={() => onView(res.id)}>
                          <Eye className="mr-1.5 h-4 w-4" />
                          Ver
                        </DropdownMenuItem>
                      )}
                      {onEdit && (
                        <DropdownMenuItem onClick={() => onEdit(res.id)}>
                          <Pencil className="mr-1.5 h-4 w-4" />
                          Editar
                        </DropdownMenuItem>
                      )}
                      {(res.status === "PENDING" || res.status === "CONFIRMED") && onCancel && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => onCancel(res.id)}
                          >
                            <Ban className="mr-1.5 h-4 w-4" />
                            Cancelar
                          </DropdownMenuItem>
                        </>
                      )}
                      {(res.status === "CANCELLED" || res.status === "COMPLETED") && onDelete && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => onDelete(res.id)}
                          >
                            <Trash2 className="mr-1.5 h-4 w-4" />
                            Eliminar
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            );
          })}
        </DataTable>
      </div>
    </div>
  );
}
