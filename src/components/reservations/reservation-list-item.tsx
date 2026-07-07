"use client";

import { formatDate, formatPrice } from "./reservations-utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Eye, Pencil, Ban, Trash2 } from "lucide-react";
import { getReservationPaidAmount } from "@/lib/payments/calculations";
import { getInclusiveMonths } from "@/lib/reservation-dates";
import type { Reservation } from "@/components/reservations/types";

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

function getReservationTone(status: string, startDate: string, endDate: string): "success" | "info" | "warning" | "destructive" | "neutral" {
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

function getPaymentTone(paidAmount: number, totalPrice: number): "success" | "warning" | "destructive" {
  if (paidAmount >= totalPrice && totalPrice > 0) return "success";
  if (paidAmount > 0) return "warning";
  return "destructive";
}

const pillToneClasses: Record<string, string> = {
  success: "border-success/20 bg-success/10 text-success",
  info: "border-info/20 bg-info/10 text-info",
  warning: "border-warning/25 bg-warning/10 text-warning",
  destructive: "border-destructive/25 bg-destructive/10 text-destructive",
  neutral: "border-muted bg-muted text-muted-foreground",
};

const dotClasses: Record<string, string> = {
  success: "bg-success",
  info: "bg-info",
  warning: "bg-warning",
  destructive: "bg-destructive",
  neutral: "bg-muted-foreground",
};

const verticalBarClasses: Record<string, string> = {
  success: "bg-success",
  info: "bg-info",
  warning: "bg-warning",
  destructive: "bg-destructive",
  neutral: "bg-muted-foreground",
};

interface ReservationListItemProps {
  reservation: Reservation;
  onView: (reservation: Reservation) => void;
  onEdit: (reservation: Reservation) => void;
  onCancel: (id: string) => void;
  onDelete: (id: string) => void;
}

export function ReservationListItem({
  reservation,
  onView,
  onEdit,
  onCancel,
  onDelete,
}: ReservationListItemProps) {
  const paidAmount = getReservationPaidAmount(reservation.payments);
  const totalPrice = Number(reservation.totalPrice);
  const paymentTone = getPaymentTone(paidAmount, totalPrice);
  const temporal = getTemporalStatus(reservation.startDate, reservation.endDate, reservation.billingType, reservation.status);
  const stateTone = getReservationTone(reservation.status, reservation.startDate, reservation.endDate);
  const duration = reservation.billingType === "MONTHLY"
    ? `${getMonths(reservation.startDate, reservation.endDate)} meses`
    : `${getNights(reservation.startDate, reservation.endDate)} noches`;

  const finLabel = paymentTone === "success"
    ? "Saldado"
    : paymentTone === "warning"
      ? formatPrice(totalPrice - paidAmount)
      : formatPrice(totalPrice);
  const finSubtext = paymentTone === "success"
    ? `${formatPrice(paidAmount)} pagado`
    : paymentTone === "warning"
      ? `Restante de ${formatPrice(totalPrice)}`
      : reservation.status === "CANCELLED"
        ? "Pendiente de pago"
        : "Sin abonos";

  return (
    <Card className="group relative overflow-hidden">
      <div className={`absolute inset-y-0 left-0 w-1 ${verticalBarClasses[stateTone]}`} />
      <CardHeader className="pb-3 pl-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
              {getInitials(reservation.client.name)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-foreground">{reservation.client.name}</p>
              <p className="truncate text-xs text-muted-foreground">{reservation.client.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[9px] font-bold uppercase ${pillToneClasses[stateTone]}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${dotClasses[stateTone]}`} />
              {temporal.label}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pl-4">
        <div className="flex flex-wrap items-start gap-4 text-sm">
          <div>
            <p className="text-muted-foreground text-xs">Propiedad</p>
            <p className="font-medium text-foreground">{reservation.property.name}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Estancia</p>
            <p className="font-medium text-foreground tabular-nums">
              {formatDate(reservation.startDate)} – {formatDate(reservation.endDate)}
            </p>
            <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-tight">{duration}</span>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Tipo</p>
            <span className="inline-flex px-2 py-0.5 rounded bg-muted text-muted-foreground text-[9px] font-bold uppercase">
              {reservation.billingType === "DAILY" ? "Diaria" : "Mensual"}
            </span>
          </div>
          <div className="flex items-stretch gap-2">
            <div className={`w-0.5 rounded-full ${verticalBarClasses[paymentTone]}`} />
            <div className="flex flex-col">
              <p className={`text-xs font-bold ${paymentTone === "success" ? "text-success" : paymentTone === "warning" ? "text-foreground" : "text-destructive"}`}>
                {finLabel}
              </p>
              <p className="text-[10px] text-muted-foreground">{finSubtext}</p>
            </div>
          </div>
        </div>

        {reservation.notes && (
          <p className="mt-3 text-sm text-muted-foreground">
            <span className="font-medium">Notas:</span> {reservation.notes}
          </p>
        )}

        <div className="flex items-center gap-2 mt-4">
          <Button variant="outline" size="sm" onClick={() => onView(reservation)}>
            <Eye className="h-4 w-4 mr-1" />
            Ver
          </Button>
          <Button variant="outline" size="sm" onClick={() => onEdit(reservation)}>
            <Pencil className="h-4 w-4 mr-1" />
            Editar
          </Button>
          {reservation.status !== "CANCELLED" && reservation.status !== "COMPLETED" && (
            <Button variant="outline" size="sm" onClick={() => onCancel(reservation.id)}>
              <Ban className="h-4 w-4 mr-1" />
              Cancelar
            </Button>
          )}
          {(reservation.status === "CANCELLED" || reservation.status === "COMPLETED") && (
            <Button variant="destructive" size="sm" onClick={() => onDelete(reservation.id)}>
              <Trash2 className="h-4 w-4 mr-1" />
              Eliminar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
