"use client";

import { Mail, Phone, CalendarDays, FileText, ArrowRight } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { getReservationPendingAmount } from "@/lib/payments/calculations";
import { getInclusiveMonths } from "@/lib/reservation-dates";
import { getNights } from "@/components/reservations/reservation-status";
import type { Reservation } from "@/components/reservations/types";

interface ReservationPreviewDialogProps {
  reservation: Reservation;
  open: boolean;
  onClose: () => void;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info" }> = {
  PENDING: { label: "Pendiente", variant: "secondary" },
  CONFIRMED: { label: "Confirmada", variant: "success" },
  CANCELLED: { label: "Cancelada", variant: "destructive" },
  COMPLETED: { label: "Completada", variant: "info" },
};

function formatDate(dateString: string): string {
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

export function ReservationPreviewDialog({
  reservation,
  open,
  onClose,
}: ReservationPreviewDialogProps) {
  const status = statusConfig[reservation.status] || statusConfig.PENDING;
  const nights = reservation.billingType === "MONTHLY"
    ? getInclusiveMonths(reservation.startDate, reservation.endDate)
    : getNights(reservation.startDate, reservation.endDate);
  const pendingAmount = getReservationPendingAmount(reservation.payments, Number(reservation.totalPrice));

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent
        className="w-[95vw] max-w-2xl p-5 sm:p-6"
        showCloseButton={true}
      >
        {/* Header: avatar + client info + status badges */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-14 w-14 shrink-0 rounded-full bg-primary/10 ring-1 ring-foreground/10 flex items-center justify-center text-primary text-xl font-bold">
              {getInitials(reservation.client.name)}
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-bold text-foreground leading-tight truncate">
                {reservation.client.name}
              </h3>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-foreground">
                <a
                  href={`mailto:${reservation.client.email}`}
                  className="inline-flex items-center gap-1.5 hover:text-primary transition-colors"
                >
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="truncate max-w-[180px]">{reservation.client.email}</span>
                </a>
                {reservation.client.phone && (
                  <a
                    href={`tel:${reservation.client.phone}`}
                    className="inline-flex items-center gap-1.5 hover:text-primary transition-colors"
                  >
                    <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{reservation.client.phone}</span>
                  </a>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <Badge variant={status.variant} className="h-5 text-[10px] font-bold uppercase tracking-wider">
              {status.label}
            </Badge>
            {reservation.bookingAirbnb && (
              <Badge variant="outline" className="h-5 text-[10px] font-bold uppercase tracking-wider">
                Airbnb
              </Badge>
            )}
          </div>
        </div>

        {/* Grid 2-col: Property + Stay */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mb-6">
          {/* Property */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
              Propiedad
            </p>
            <div className="flex items-center gap-3">
              <div
                className="h-10 w-10 shrink-0 rounded-lg flex items-center justify-center text-white text-sm font-bold"
                style={{ backgroundColor: reservation.property.color || "var(--primary)" }}
              >
                {reservation.property.name[0]}
              </div>
              <p className="text-sm font-bold text-foreground truncate min-w-0">
                {reservation.property.name}
              </p>
            </div>
          </div>

          {/* Stay */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
              Estancia
            </p>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 shrink-0 rounded-lg bg-muted ring-1 ring-foreground/10 flex items-center justify-center text-muted-foreground">
                <CalendarDays className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-foreground">
                  {formatDate(reservation.startDate)} - {formatDate(reservation.endDate)}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {reservation.billingType === "MONTHLY"
                    ? `${nights} meses`
                    : `${nights} noches`}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Total + Pending if any */}
        <div className="mb-6">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
            Total
          </p>
          <p className="text-2xl font-bold text-foreground tabular-nums">
            {formatPrice(reservation.totalPrice)}
          </p>
          {pendingAmount > 0 && (
            <div className="mt-2 p-2 rounded bg-warning/10 ring-1 ring-warning/20">
              <p className="text-xs font-semibold text-warning">
                Pendiente: {formatPrice(pendingAmount)}
              </p>
            </div>
          )}
        </div>

        {/* Chips: BillingType, Source, Units */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <span className={cn(
            "px-3 py-1.5 rounded-md text-xs font-medium",
            reservation.billingType === "MONTHLY"
              ? "bg-info/10 text-info-foreground"
              : "bg-secondary text-secondary-foreground"
          )}>
            {reservation.billingType === "MONTHLY" ? "Mensual" : "Diario"}
          </span>
          <span className={cn(
            "px-3 py-1.5 rounded-md text-xs font-medium",
            reservation.bookingAirbnb
              ? "bg-success/10 text-success-foreground"
              : "bg-muted text-muted-foreground"
          )}>
            {reservation.bookingAirbnb ? "Airbnb" : "Directo"}
          </span>
          {reservation.unitsBooked > 1 && (
            <span className="px-3 py-1.5 rounded-md text-xs font-medium bg-muted text-muted-foreground">
              {reservation.unitsBooked} unidades
            </span>
          )}
        </div>

        {/* Notes if any */}
        {reservation.notes && (
          <div className="mb-6 p-3 rounded-md bg-muted/50 border border-border">
            <div className="flex items-center gap-2 mb-1">
              <FileText className="h-3 w-3 text-muted-foreground" />
              <p className="text-xs font-medium text-muted-foreground">Notas</p>
            </div>
            <p className="text-sm text-foreground whitespace-pre-wrap">{reservation.notes}</p>
          </div>
        )}

        {/* Footer CTA */}
        <Link
          href={`/reservations/${reservation.id}`}
          className={buttonVariants({ variant: "default", className: "w-full sm:w-auto" })}
        >
          Ver reserva completa
          <ArrowRight className="ml-2 size-4" />
        </Link>
      </DialogContent>
    </Dialog>
  );
}
