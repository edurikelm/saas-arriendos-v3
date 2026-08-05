"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, Pencil, Ban } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "sonner";
import { cancelReservation } from "@/lib/actions/reservations";
import { formatDate } from "@/components/reservations/reservations-utils";
import { ReservationForm } from "@/components/reservations/reservation-form";
import { ReservationDocumentsPanel } from "@/components/reservations/reservation-documents-panel";
import { PaymentsSection } from "./payments-section";

interface ReservationChange {
  id: string;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
}

interface Payment {
  id: string;
  installmentIndex?: number | null;
  amount: string;
  dueDate?: string | null;
  status: string;
  method: string;
  initPoint?: string | null;
  expiresAt?: string | null;
  paidAt?: string | null;
  deletedAt?: string | null;
  receiptUrl?: string | null;
  paymentType?: string | null;
  title?: string | null;
  description?: string | null;
  overdueDays?: number | null;
  installmentLabel?: string | null;
}

interface Property {
  id: string;
  name: string;
  color?: string;
  unitsAvailable?: number;
  dailyPrice?: string;
  monthlyPrice?: string | null | undefined;
  type?: string;
  amenities?: string[];
  mainImage?: string | null;
  images?: string[];
}

interface Client {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  rut?: string | null;
  notes?: string | null;
}

interface ReservationDetailClientProps {
  reservation: {
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
    changes: ReservationChange[];
  };
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

function getNights(startDate: string, endDate: string): number {
  const diff = new Date(endDate).getTime() - new Date(startDate).getTime();
  return Math.round(diff / (1000 * 60 * 60 * 24)) + 1;
}

function formatFullDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("es-CL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function ReservationDetailClient({ reservation }: ReservationDetailClientProps) {
  const [showEditForm, setShowEditForm] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const handleCancel = async () => {
    const result = await cancelReservation(reservation.id, "cancelled_by_user");
    if (result?.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Reserva cancelada");
    setShowCancelConfirm(false);
    // Refresh the page to show updated state
    window.location.reload();
  };

  const nights = reservation.billingType === "MONTHLY"
    ? Math.round((new Date(reservation.endDate).getTime() - new Date(reservation.startDate).getTime()) / (1000 * 60 * 60 * 24 * 30))
    : getNights(reservation.startDate, reservation.endDate);

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-5xl">
      {/* Header — person + metadata row */}
      <header className="space-y-3">
        {/* Row 1: Person (avatar + name + email) + actions */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <Link
              href="/reservations"
              className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
              aria-label="Volver a reservas"
            >
              <ChevronLeft className="size-4" />
            </Link>
            <div
              className="size-10 shrink-0 rounded-full bg-primary/10 ring-1 ring-foreground/10 flex items-center justify-center text-primary font-bold text-sm"
              aria-hidden="true"
            >
              {getInitials(reservation.client.name)}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Reserva {reservation.id.slice(-6).toUpperCase()}
              </p>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate">
                {reservation.client.name}
              </h1>
              <p className="text-xs text-muted-foreground truncate">
                <span>{reservation.client.email}</span>
                {reservation.client.phone && (
                  <>
                    <span className="mx-1.5 text-muted-foreground/50" aria-hidden="true">·</span>
                    <span>{reservation.client.phone}</span>
                  </>
                )}
              </p>
            </div>
          </div>
          {/* Desktop actions — inline next to person */}
          <div className="hidden sm:flex items-center gap-2 shrink-0 self-start">
            {reservation.status !== "CANCELLED" && reservation.status !== "COMPLETED" && (
              <>
                <Button variant="outline" size="sm" onClick={() => setShowEditForm(true)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Editar
                </Button>
                <Button variant="destructive" size="sm" onClick={() => setShowCancelConfirm(true)}>
                  <Ban className="mr-2 h-4 w-4" />
                  Cancelar
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Mobile actions — stacked below person, full width */}
        <div className="flex sm:hidden items-center gap-2 pl-[52px]">
          {reservation.status !== "CANCELLED" && reservation.status !== "COMPLETED" && (
            <>
              <Button variant="outline" size="sm" className="flex-1" onClick={() => setShowEditForm(true)}>
                <Pencil className="mr-2 h-4 w-4" />
                Editar
              </Button>
              <Button variant="destructive" size="sm" className="flex-1" onClick={() => setShowCancelConfirm(true)}>
                <Ban className="mr-2 h-4 w-4" />
                Cancelar
              </Button>
            </>
          )}
        </div>

        {/* Row 2: Metadata — single line, wraps on narrow viewports */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pl-[52px] text-sm">
          <span className="inline-flex items-center gap-2">
            <span
              className="size-2.5 shrink-0 rounded-sm"
              style={{ backgroundColor: reservation.property.color || "var(--primary)" }}
              aria-hidden="true"
            />
            <span className="font-bold text-foreground">{reservation.property.name}</span>
          </span>
          <Sep />
          <span className="text-foreground tabular-nums">
            {formatDate(reservation.startDate)} → {formatDate(reservation.endDate)}
          </span>
          <Sep />
          <span className="text-muted-foreground">
            {reservation.billingType === "MONTHLY" ? `${nights} meses` : `${nights} noches`} · {reservation.unitsBooked} {reservation.unitsBooked === 1 ? "unidad" : "unidades"}
          </span>
          <Sep />
          <span className="text-foreground">
            {reservation.bookingAirbnb ? "Airbnb" : "Directo"}
            <span className="text-muted-foreground"> / {reservation.billingType === "MONTHLY" ? "Mensual" : "Diario"}</span>
          </span>
        </div>
      </header>

      {/* Sección 1: Pagos */}
      <section>
        <h2 className="text-sm font-bold text-foreground mb-3">Detalle de pagos</h2>
        <PaymentsSection
          reservationId={reservation.id}
          totalPrice={reservation.totalPrice}
          billingType={reservation.billingType}
          status={reservation.status}
          payments={reservation.payments}
          client={reservation.client}
          propertyName={reservation.property.name}
        />
      </section>

      {/* Sección 2: Documentos (solo MONTHLY) */}
      {reservation.billingType === "MONTHLY" && (
        <section>
          <h2 className="text-sm font-bold text-foreground mb-3">Documentos</h2>
          <Card>
            <CardContent className="p-4 sm:p-6">
              <ReservationDocumentsPanel reservationId={reservation.id} />
            </CardContent>
          </Card>
        </section>
      )}

      {/* Sección 3: Historial de cambios */}
      <section>
        <details className="group">
          <summary className="flex items-center justify-between cursor-pointer list-none text-sm font-bold text-foreground mb-3">
            <span>Historial de cambios</span>
            <span className="text-muted-foreground group-open:rotate-180 transition-transform">
              ▼
            </span>
          </summary>
          <Card>
            <CardContent className="p-4 sm:p-6">
              {reservation.changes.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay cambios registrados.</p>
              ) : (
                <div className="space-y-3">
                  {reservation.changes.map((change) => (
                    <div key={change.id} className="text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">{change.field}</span>
                        {change.oldValue && (
                          <>
                            <span className="text-muted-foreground">:</span>
                            <span className="text-muted-foreground line-through">
                              {change.oldValue}
                            </span>
                          </>
                        )}
                        {change.oldValue && change.newValue && (
                          <span className="text-muted-foreground">→</span>
                        )}
                        {change.newValue && (
                          <span className="text-foreground font-medium">
                            {change.newValue}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatFullDate(change.createdAt)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </details>
      </section>

      {/* Sección 4: Notas */}
      {reservation.notes && (
        <section>
          <Card>
            <CardContent className="p-4 sm:p-5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Notas
              </p>
              <p className="text-sm text-foreground whitespace-pre-wrap">{reservation.notes}</p>
            </CardContent>
          </Card>
        </section>
      )}

      {/* Edit Form Modal */}
      <Dialog open={showEditForm} onOpenChange={setShowEditForm}>
        <DialogContent className="w-[95vw] max-w-2xl gap-0 p-0 overflow-hidden" showCloseButton={false}>
          <DialogHeader className="border-b border-border px-5 py-4 flex-row items-center justify-between gap-2 space-y-0">
            <DialogTitle>Editar Reserva</DialogTitle>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setShowEditForm(false)}
              aria-label="Cerrar"
              className="text-muted-foreground hover:text-foreground -mr-2"
            >
              ✕
            </Button>
          </DialogHeader>
          <div className="p-5">
            <ReservationForm
              properties={[{
                id: reservation.property.id,
                name: reservation.property.name,
                unitsAvailable: reservation.property.unitsAvailable || 1,
                dailyPrice: reservation.property.dailyPrice || "0",
                monthlyPrice: reservation.property.monthlyPrice ?? null,
              }]}
              clients={[{
                id: reservation.client.id,
                name: reservation.client.name,
                email: reservation.client.email,
              }]}
              initialData={{
                propertyId: reservation.property.id,
                clientId: reservation.client.id,
                startDate: new Date(reservation.startDate),
                endDate: new Date(reservation.endDate),
                billingType: reservation.billingType as "DAILY" | "MONTHLY",
                unitsBooked: reservation.unitsBooked,
                bookingAirbnb: reservation.bookingAirbnb,
                notes: reservation.notes || "",
              }}
              onSubmit={async (data) => {
                const { updateReservation } = await import("@/lib/actions/reservations");
                const result = await updateReservation(reservation.id, data);
                if (result?.error) {
                  toast.error(result.error);
                  return;
                }
                toast.success("Reserva actualizada");
                setShowEditForm(false);
                window.location.reload();
              }}
              onCancel={() => setShowEditForm(false)}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Cancel Confirm */}
      <ConfirmDialog
        open={showCancelConfirm}
        onOpenChange={setShowCancelConfirm}
        title="Cancelar reserva"
        description="La reserva quedará cancelada, pero se mantendrán los pagos completados como registro financiero."
        confirmLabel="Cancelar reserva"
        cancelLabel="Volver"
        onConfirm={handleCancel}
      />
    </div>
  );
}

function Sep() {
  return <span aria-hidden="true" className="text-muted-foreground/40">·</span>;
}
