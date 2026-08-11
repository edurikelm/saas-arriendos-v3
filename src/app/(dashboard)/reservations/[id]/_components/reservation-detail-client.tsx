"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Calendar,
  ChevronLeft,
  Home,
  Pencil,
  Ban,
  Wallet,
  Hash,
  Tag,
  User,
  StickyNote,
  FileText,
  Settings2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "sonner";
import { cancelReservation } from "@/lib/actions/reservations";
import { formatDate } from "@/components/reservations/reservations-utils";
import { ReservationPill, type PillTone } from "@/components/reservations/reservation-pill";
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
    createdAt: string;
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

function formatRelativeDay(dateString: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateString);
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.round((today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Hoy";
  if (diffDays === 1) return "Ayer";
  if (diffDays < 7) return `Hace ${diffDays} días`;
  if (diffDays < 30) return `Hace ${Math.floor(diffDays / 7)} sem`;
  if (diffDays < 365) return `Hace ${Math.floor(diffDays / 30)} meses`;
  return `Hace ${Math.floor(diffDays / 365)} año${Math.floor(diffDays / 365) === 1 ? "" : "s"}`;
}

function getTemporalStatus(
  startDate: string,
  endDate: string,
  billingType: string,
  status: string,
): { label: string; sublabel?: string; tone: PillTone } {
  if (status === "CANCELLED") return { label: "Cancelada", tone: "destructive" };
  if (status === "COMPLETED") return { label: "Finalizada", tone: "neutral" };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (today < start) {
    const daysUntil = Math.ceil((start.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return { label: "Próxima", sublabel: `En ${daysUntil} días`, tone: "info" };
  }
  if (today > end) return { label: "Finalizada", tone: "neutral" };

  if (billingType === "MONTHLY") {
    const monthsLeft = Math.ceil(
      (end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24 * 30),
    );
    return { label: "Activa", sublabel: `${monthsLeft} meses restantes`, tone: "success" };
  }
  const nightsLeft = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return { label: "Activa", sublabel: `${nightsLeft} noches restantes`, tone: "success" };
}

const FIELD_ICONS: Record<string, LucideIcon> = {
  startDate: Calendar,
  endDate: Calendar,
  totalPrice: Wallet,
  unitsBooked: Hash,
  status: Tag,
  propertyId: Home,
  clientId: User,
  notes: StickyNote,
  billingType: FileText,
};

function getFieldIcon(field: string): LucideIcon {
  return FIELD_ICONS[field] ?? Settings2;
}

function FieldLabel({ field }: { field: string }) {
  const labels: Record<string, string> = {
    startDate: "Check-in",
    endDate: "Check-out",
    totalPrice: "Precio total",
    unitsBooked: "Unidades",
    status: "Estado",
    propertyId: "Propiedad",
    clientId: "Cliente",
    notes: "Notas",
    billingType: "Cobro",
  };
  return <span className="font-medium text-foreground">{labels[field] ?? field}</span>;
}

function ChangeTimeline({ changes }: { changes: ReservationChange[] }) {
  if (changes.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        Sin cambios registrados.
      </p>
    );
  }

  return (
    <ol className="relative space-y-4">
      {changes.map((change, idx) => {
        const Icon = getFieldIcon(change.field);
        const isLast = idx === changes.length - 1;
        return (
          <li key={change.id} className="relative pl-7">
            {/* Connector line */}
            {!isLast && (
              <span
                aria-hidden="true"
                className="absolute left-[11px] top-7 bottom-[-16px] w-px bg-border"
              />
            )}
            {/* Icon dot */}
            <span
              aria-hidden="true"
              className="absolute left-0 top-0 flex size-6 items-center justify-center rounded-full bg-muted text-muted-foreground ring-2 ring-card"
            >
              <Icon className="size-3" />
            </span>
            {/* Content */}
            <div className="flex flex-col gap-0.5">
              <div className="flex items-baseline justify-between gap-2">
                <FieldLabel field={change.field} />
                <time
                  dateTime={change.createdAt}
                  title={formatFullDate(change.createdAt)}
                  className="text-[10px] text-muted-foreground tabular-nums shrink-0"
                >
                  {formatRelativeDay(change.createdAt)}
                </time>
              </div>
              {(change.oldValue || change.newValue) && (
                <p className="text-xs text-muted-foreground leading-relaxed break-words">
                  {change.oldValue && (
                    <span className="line-through opacity-70">{change.oldValue}</span>
                  )}
                  {change.oldValue && change.newValue && (
                    <span className="mx-1.5 text-muted-foreground/60">→</span>
                  )}
                  {change.newValue && (
                    <span className="text-foreground font-medium">{change.newValue}</span>
                  )}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
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

  const temporal = getTemporalStatus(
    reservation.startDate,
    reservation.endDate,
    reservation.billingType,
    reservation.status,
  );

  const isEditable = reservation.status !== "CANCELLED" && reservation.status !== "COMPLETED";

  return (
    <div className="p-4 sm:p-6">
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_360px] gap-6">
        {/* ─── LEFT COLUMN ───────────────────────────────────────────── */}
        <div className="space-y-6 min-w-0">
          {/* Header — single identity block (back + avatar + text-stack + actions) */}
          <header className="flex flex-col gap-3 sm:flex-row sm:items-start">
            {/* Identity group: back + avatar + text-stack */}
            <div className="flex items-start gap-3 min-w-0 flex-1">
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

              {/* Text-stack: kicker → h1 → contact → metadata (one cohesive identity) */}
              <div className="min-w-0 flex-1">
                {/* Kicker: reservation ID + temporal status */}
                <div className="flex items-center gap-2 mb-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Reserva {reservation.id.slice(-6).toUpperCase()}
                  </p>
                  <ReservationPill tone={temporal.tone} label={temporal.label} />
                </div>

                {/* Primary title */}
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight truncate">
                  {reservation.client.name}
                </h1>

                {/* Contact line */}
                <p className="text-xs text-muted-foreground truncate mt-1">
                  <span>{reservation.client.email}</span>
                  {reservation.client.phone && (
                    <>
                      <span className="mx-1.5 text-muted-foreground/50" aria-hidden="true">·</span>
                      <span>{reservation.client.phone}</span>
                    </>
                  )}
                </p>

                {/* Reservation context — naturally aligned with h1 (no pl hack) */}
                <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
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
                  {temporal.sublabel && (
                    <>
                      <Sep />
                      <span className="text-muted-foreground">{temporal.sublabel}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Actions — anchored top-right on desktop, full-width below on mobile */}
            {isEditable && (
              <div className="flex items-center gap-2 sm:shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 sm:flex-none"
                  onClick={() => setShowEditForm(true)}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Editar
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  className="flex-1 sm:flex-none"
                  onClick={() => setShowCancelConfirm(true)}
                >
                  <Ban className="mr-2 h-4 w-4" />
                  Cancelar
                </Button>
              </div>
            )}
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

          {/* Sección 3: Notas */}
          {reservation.notes && (
            <section>
              <h2 className="text-sm font-bold text-foreground mb-3">Notas</h2>
              <Card>
                <CardContent className="p-4 sm:p-5">
                  <p className="text-sm text-foreground whitespace-pre-wrap">{reservation.notes}</p>
                </CardContent>
              </Card>
            </section>
          )}
        </div>

        {/* ─── RIGHT COLUMN (sticky aside) ──────────────────────────── */}
        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          {/* Resumen card */}
          <Card>
            <CardContent className="p-5 space-y-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Resumen
                </p>
              </div>
              <dl className="space-y-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">ID</dt>
                  <dd className="font-mono text-xs text-foreground/70">
                    {reservation.id.slice(-8).toUpperCase()}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Creada</dt>
                  <dd className="text-foreground tabular-nums text-xs">
                    {formatDate(reservation.createdAt)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Fuente</dt>
                  <dd className="text-foreground">
                    {reservation.bookingAirbnb ? "Airbnb" : "Directo"}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Cliente</dt>
                  <dd className="text-foreground truncate max-w-[160px]" title={reservation.client.name}>
                    {reservation.client.name}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Propiedad</dt>
                  <dd className="text-foreground truncate max-w-[160px]" title={reservation.property.name}>
                    {reservation.property.name}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          {/* Historial de cambios — siempre visible */}
          <Card>
            <CardContent className="p-5">
              <div className="flex items-baseline justify-between mb-4">
                <h2 className="text-sm font-bold text-foreground">Historial de cambios</h2>
                {reservation.changes.length > 0 && (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground tabular-nums">
                    {reservation.changes.length}
                  </span>
                )}
              </div>
              <ChangeTimeline changes={reservation.changes} />
            </CardContent>
          </Card>
        </aside>
      </div>

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
