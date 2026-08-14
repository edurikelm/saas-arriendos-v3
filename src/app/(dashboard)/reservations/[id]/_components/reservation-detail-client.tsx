"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDownToLine,
  ArrowRight,
  Ban,
  CalendarRange,
  ChevronLeft,
  DoorOpen,
  FileText,
  Home,
  MoreVertical,
  Pencil,
  StickyNote,
  Tag,
  User as UserIcon,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { cancelReservation } from "@/lib/actions/reservations";
import { ReservationPill, type PillTone } from "@/components/reservations/reservation-pill";
import { ReservationForm } from "@/components/reservations/reservation-form";
import { ReservationDocumentsPanel } from "@/components/reservations/reservation-documents-panel";
import {
  formatRelativeDay,
  getReservationTone,
  getTemporalStatus,
} from "@/components/reservations/reservation-status";
import { cn } from "@/lib/utils";
import { dateKeyToDayIndex } from "@/lib/domain/timezone";
import { getInclusiveMonths } from "@/lib/reservation-dates";
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
  const startKey = startDate.slice(0, 10);
  const endKey = endDate.slice(0, 10);
  return Math.max(1, dateKeyToDayIndex(endKey) - dateKeyToDayIndex(startKey) + 1);
}

function formatDayMonth(dateString: string): string {
  // date-only en el dominio → devolvemos "13 ago"
  const key = dateString.slice(0, 10);
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  return date.toLocaleDateString("es-CL", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

/** Devuelve solo el día del mes como string ("17") desde una fecha date-only. */
function getDayNumber(dateString: string): string {
  const key = dateString.slice(0, 10);
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  return date.toLocaleDateString("es-CL", {
    day: "numeric",
    timeZone: "UTC",
  });
}

/** Devuelve el mes abreviado ("ago") desde una fecha date-only. */
function getMonthShort(dateString: string): string {
  const key = dateString.slice(0, 10);
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  return date
    .toLocaleDateString("es-CL", {
      month: "short",
      timeZone: "UTC",
    })
    .replace(/\.$/, "");
}

function formatLongDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("es-CL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

const FIELD_ICONS: Record<string, LucideIcon> = {
  startDate: CalendarRange,
  endDate: CalendarRange,
  totalPrice: Wallet,
  unitsBooked: DoorOpen,
  status: Tag,
  propertyId: Home,
  clientId: UserIcon,
  notes: StickyNote,
  billingType: FileText,
};

function getFieldIcon(field: string): LucideIcon {
  return FIELD_ICONS[field] ?? Tag;
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

function formatWeekday(dateString: string): string {
  const key = dateString.slice(0, 10);
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  return date.toLocaleDateString("es-CL", { weekday: "long", timeZone: "UTC" });
}

// ─────────────────────────────────────────────────────────────────────────
// Change timeline (sidebar — rendered inside a collapsible <details>)
// ─────────────────────────────────────────────────────────────────────────

function ChangeTimeline({ changes }: { changes: ReservationChange[] }) {
  if (changes.length === 0) {
    return (
      <p className="text-xs text-muted-foreground py-3 text-center">
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
            {!isLast && (
              <span
                aria-hidden="true"
                className="absolute left-[11px] top-7 bottom-[-16px] w-px bg-border"
              />
            )}
            <span
              aria-hidden="true"
              className="absolute left-0 top-0 flex size-6 items-center justify-center rounded-full bg-muted text-muted-foreground ring-2 ring-card"
            >
              <Icon className="size-3" />
            </span>
            <div className="flex flex-col gap-0.5">
              <div className="flex items-baseline justify-between gap-2">
                <FieldLabel field={change.field} />
                <time
                  dateTime={change.createdAt}
                  title={formatLongDate(change.createdAt)}
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

// ─────────────────────────────────────────────────────────────────────────
// Reservation summary card (compact — sidebar right column, 320-340px)
// ─────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────
// Mobile reservation header — solo visible en mobile/tablet (<lg)
// Provee contexto inmediato (cliente + fechas) arriba sin esperar al scroll
// ─────────────────────────────────────────────────────────────────────────

function MobileReservationHeader({
  client,
  startDate,
  endDate,
  nights,
  billingType,
  temporal,
  temporalTone,
}: {
  client: Client;
  startDate: string;
  endDate: string;
  nights: number;
  billingType: string;
  temporal: { label: string; sublabel?: string | null };
  temporalTone: PillTone;
}) {
  const isMonthly = billingType === "MONTHLY";
  const durationLabel = isMonthly
    ? `${nights} ${nights === 1 ? "mes" : "meses"}`
    : `${nights} ${nights === 1 ? "noche" : "noches"}`;

  return (
    <div className="lg:hidden mb-6 rounded-lg ring-1 ring-border bg-card p-4">
      {/* Top row: avatar + name + email + status pill */}
      <div className="flex items-start gap-3 mb-3">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary"
          aria-hidden="true"
        >
          {getInitials(client.name)}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-base font-bold tracking-tight text-foreground leading-tight">
            {client.name}
          </h1>
          <p className="text-[10px] text-muted-foreground truncate mt-0.5">
            {client.email}
          </p>
        </div>
        <div className="shrink-0 pt-0.5">
          <ReservationPill tone={temporalTone} label={temporal.label} />
        </div>
      </div>

      {/* Dates row: icon + inline dates + duration */}
      <div className="flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1.5 min-w-0">
          <CalendarRange className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="font-bold text-foreground tabular-nums">
            {getDayNumber(startDate)} {getMonthShort(startDate)}
          </span>
          <ArrowRight className="size-3 shrink-0 text-muted-foreground/60" aria-hidden="true" />
          <span className="font-bold text-foreground tabular-nums">
            {getDayNumber(endDate)} {getMonthShort(endDate)}
          </span>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground shrink-0">
          {durationLabel}
        </span>
      </div>
    </div>
  );
}

function ReservationSummaryCard({
  client,
  startDate,
  endDate,
  billingType,
  nights,
  status,
  bookingAirbnb,
  unitsBooked,
  propertyName,
  propertyColor,
  temporal,
  temporalTone,
}: {
  client: Client;
  startDate: string;
  endDate: string;
  billingType: string;
  nights: number;
  status: string;
  bookingAirbnb: boolean;
  unitsBooked: number;
  propertyName: string;
  propertyColor: string;
  temporal: { label: string; sublabel?: string | null };
  temporalTone: PillTone;
}) {
  const isMonthly = billingType === "MONTHLY";
  const durationLabel = isMonthly
    ? `${nights} ${nights === 1 ? "mes" : "meses"}`
    : `${nights} ${nights === 1 ? "noche" : "noches"}`;

  const sourceLabel = bookingAirbnb ? "Airbnb" : "Directo";
  const billingLabel = billingType === "MONTHLY" ? "Mensual" : "Diario";

  // Tono del conector central según estado (semántico, sutil).
  const connectorTone =
    status === "CANCELLED"
      ? "bg-destructive/30"
      : status === "COMPLETED"
        ? "bg-muted-foreground/30"
        : "bg-primary/40";
  // Tono del ícono arrow que indica dirección temporal Desde → Hasta.
  const arrowTone =
    status === "CANCELLED"
      ? "text-destructive/60"
      : status === "COMPLETED"
        ? "text-muted-foreground/60"
        : "text-primary/70";

  return (
    <div className="rounded-lg ring-1 ring-border bg-card">
      <div className="p-4 space-y-4">
        {/* Eyebrow row: pill + sublabel */}
        <div className="flex flex-wrap items-center gap-1.5">
          <ReservationPill tone={temporalTone} label={temporal.label} />
          {temporal.sublabel && (
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              · {temporal.sublabel}
            </span>
          )}
        </div>

        {/* Identity: avatar + name + contact */}
        <div className="flex items-start gap-3">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary"
            aria-hidden="true"
          >
            {getInitials(client.name)}
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <h1 className="text-lg font-bold tracking-tight text-foreground leading-tight">
              {client.name}
            </h1>
            <div className="space-y-0.5">
              <a
                href={`mailto:${client.email}`}
                className="block text-xs text-muted-foreground hover:text-foreground transition-colors truncate"
              >
                {client.email}
              </a>
              {client.phone && (
                <a
                  href={`tel:${client.phone}`}
                  className="block text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {client.phone}
                </a>
              )}
              {client.rut && (
                <span className="block text-xs text-muted-foreground">
                  RUT {client.rut}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-border" />

        {/* Estancia — dual date tiles with prominent day number */}
        <div className="space-y-3">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Estancia
            </p>
            <span className="text-xs font-bold uppercase tracking-wider text-foreground tabular-nums">
              {durationLabel}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {/* Desde */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Desde
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-[1.75rem] font-bold text-foreground tabular-nums tracking-tight leading-none">
                  {getDayNumber(startDate)}
                </span>
                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-semibold text-foreground leading-none">
                    {getMonthShort(startDate)}
                  </span>
                  <span className="text-[10px] font-medium text-muted-foreground leading-none">
                    {formatWeekday(startDate).slice(0, 3)}
                  </span>
                </div>
              </div>
            </div>

            {/* Hasta */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Hasta
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-[1.75rem] font-bold text-foreground tabular-nums tracking-tight leading-none">
                  {getDayNumber(endDate)}
                </span>
                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-semibold text-foreground leading-none">
                    {getMonthShort(endDate)}
                  </span>
                  <span className="text-[10px] font-medium text-muted-foreground leading-none">
                    {formatWeekday(endDate).slice(0, 3)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Temporal direction arrow — al final del bloque de fechas */}
          <div className="flex items-center gap-2 pt-0.5">
            <div className={cn("h-px flex-1", connectorTone)} />
            <ArrowRight className={cn("size-3 shrink-0", arrowTone)} aria-hidden="true" />
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-border" />

        {/* Metadata chips */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5">
            <span
              className="size-2.5 shrink-0 rounded-sm"
              style={{ backgroundColor: propertyColor }}
              aria-hidden="true"
            />
            <span className="text-xs font-bold text-foreground">
              {propertyName}
            </span>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs text-muted-foreground">
            <DoorOpen className="size-3.5" aria-hidden="true" />
            <span className="tabular-nums">
              {unitsBooked} {unitsBooked === 1 ? "unidad" : "unidades"}
            </span>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs text-muted-foreground">
            <Tag className="size-3.5" aria-hidden="true" />
            <span>{sourceLabel}</span>
            <span className="text-muted-foreground/40" aria-hidden="true">
              /
            </span>
            <span>{billingLabel}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Reservation header / actions / layout principal
// ─────────────────────────────────────────────────────────────────────────

export function ReservationDetailClient({ reservation }: ReservationDetailClientProps) {
  const [showEditForm, setShowEditForm] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const router = useRouter();
  const refreshData = useCallback(() => router.refresh(), [router]);

  const handleCancel = async () => {
    const result = await cancelReservation(reservation.id, "cancelled_by_user");
    if (result?.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Reserva cancelada");
    setShowCancelConfirm(false);
    refreshData();
  };

  const nights = useMemo(
    () =>
      reservation.billingType === "MONTHLY"
        ? getInclusiveMonths(reservation.startDate, reservation.endDate)
        : getNights(reservation.startDate, reservation.endDate),
    [reservation.billingType, reservation.startDate, reservation.endDate],
  );

  const temporal = useMemo(
    () =>
      getTemporalStatus(
        reservation.startDate,
        reservation.endDate,
        reservation.billingType,
        reservation.status,
      ),
    [reservation.startDate, reservation.endDate, reservation.billingType, reservation.status],
  );

  const temporalTone: PillTone = useMemo(
    () =>
      getReservationTone(
        reservation.status,
        reservation.startDate,
        reservation.endDate,
      ),
    [reservation.status, reservation.startDate, reservation.endDate],
  );

  const isEditable = reservation.status !== "CANCELLED" && reservation.status !== "COMPLETED";
  const sourceLabel = reservation.bookingAirbnb ? "Airbnb" : "Directo";
  const billingLabel = reservation.billingType === "MONTHLY" ? "Mensual" : "Diario";
  const propertyColor = reservation.property.color || "var(--primary)";

  return (
    <div className="p-4 sm:p-6">
      {/* ─── TOP BAR: back + actions ─────────────────────────────────── */}
      <div className="mb-6 flex items-center justify-between gap-3">
        <Link
          href="/reservations"
          className={buttonVariants({ variant: "ghost", size: "sm", className: "gap-1.5 -ml-2 text-muted-foreground" })}
          aria-label="Volver a reservas"
        >
          <ChevronLeft className="size-4" />
          <span className="hidden sm:inline">Volver</span>
        </Link>

        {isEditable && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowEditForm(true)}
              className="gap-1.5"
            >
              <Pencil className="size-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Editar</span>
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowCancelConfirm(true)}
              className="gap-1.5"
            >
              <Ban className="size-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Cancelar</span>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger
                className="inline-flex size-7 cursor-pointer items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                aria-label="Más acciones"
              >
                <MoreVertical className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-48">
                <DropdownMenuItem onClick={() => setShowEditForm(true)}>
                  <Pencil className="mr-2 size-4" />
                  Editar reserva
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    navigator.clipboard
                      ?.writeText(window.location.href)
                      .then(() => toast.success("Enlace copiado"))
                      .catch(() => toast.error("No se pudo copiar"));
                  }}
                >
                  <ArrowDownToLine className="mr-2 size-4" />
                  Copiar enlace
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => setShowCancelConfirm(true)}
                >
                  <Ban className="mr-2 size-4" />
                  Cancelar reserva
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {/* Mobile header — solo visible en <lg, oculta en desktop donde
          el ReservationSummaryCard del sidebar ya provee este contexto */}
      <MobileReservationHeader
        client={reservation.client}
        startDate={reservation.startDate}
        endDate={reservation.endDate}
        nights={nights}
        billingType={reservation.billingType}
        temporal={temporal}
        temporalTone={temporalTone}
      />

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_340px] gap-6">
        {/* ─── LEFT COLUMN ────────────────────────────────────────────── */}
        <div className="space-y-6 min-w-0">
          {/* Sección 1: Pagos (prioridad — sin hero band encima) */}
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
                  <p className="text-sm text-foreground whitespace-pre-wrap">
                    {reservation.notes}
                  </p>
                </CardContent>
              </Card>
            </section>
          )}
        </div>

        {/* ─── RIGHT COLUMN ──────────────────────────────────────────── */}
        <aside className="lg:sticky lg:top-20 lg:self-start space-y-4">
          {/* ReservationSummaryCard — hero compactado para sidebar (solo desktop) */}
          <div className="hidden lg:block">
            <h2 className="text-sm font-bold text-foreground mb-3">Resumen</h2>
            <ReservationSummaryCard
              client={reservation.client}
              startDate={reservation.startDate}
              endDate={reservation.endDate}
              billingType={reservation.billingType}
              nights={nights}
              status={reservation.status}
              bookingAirbnb={reservation.bookingAirbnb}
              unitsBooked={reservation.unitsBooked}
              propertyName={reservation.property.name}
              propertyColor={propertyColor}
              temporal={temporal}
              temporalTone={temporalTone}
            />
          </div>

          {/* Historial de cambios — colapsable para no saturar la vista */}
          <details className="rounded-lg ring-1 ring-border">
            <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 select-none">
              <span className="text-sm font-bold text-foreground">Historial de cambios</span>
              <span className="flex items-center gap-2">
                {reservation.changes.length > 0 && (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground tabular-nums">
                    {reservation.changes.length}
                  </span>
                )}
                <ChevronLeft className="size-4 text-muted-foreground transition-transform duration-200 open:rotate-[-90deg]" />
              </span>
            </summary>
            <div className="border-t border-border px-4 py-3">
              <ChangeTimeline changes={reservation.changes} />
            </div>
          </details>
        </aside>
      </div>

      {/* ─── MODALS ──────────────────────────────────────────────────── */}
      <Dialog open={showEditForm} onOpenChange={setShowEditForm}>
        <DialogContent
          className="w-[95vw] max-w-2xl gap-0 p-0 overflow-hidden"
          showCloseButton={false}
        >
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
              properties={[
                {
                  id: reservation.property.id,
                  name: reservation.property.name,
                  unitsAvailable: reservation.property.unitsAvailable || 1,
                  dailyPrice: reservation.property.dailyPrice || "0",
                  monthlyPrice: reservation.property.monthlyPrice ?? null,
                },
              ]}
              clients={[
                {
                  id: reservation.client.id,
                  name: reservation.client.name,
                  email: reservation.client.email,
                },
              ]}
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
                refreshData();
              }}
              onCancel={() => setShowEditForm(false)}
            />
          </div>
        </DialogContent>
      </Dialog>

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
