"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDownToLine,
  Ban,
  CalendarRange,
  Check,
  ChevronLeft,
  DoorOpen,
  FileText,
  Home,
  Mail,
  MapPin,
  MoreVertical,
  Pencil,
  Phone,
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
import { formatDate } from "@/components/reservations/reservations-utils";
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

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  HOUSE: "Casa",
  APARTMENT: "Departamento",
  CABIN: "Cabaña",
  HOSTEL: "Hostel",
  HOTEL: "Hotel",
  OFFICE: "Oficina",
  COMMERCIAL: "Local comercial",
};

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

function formatPrice(amount: number | string): string {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(amount));
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

// ─────────────────────────────────────────────────────────────────────────
// Fechas de la estancia — card escaneable: check-in / check-out con duración
// ─────────────────────────────────────────────────────────────────────────

function formatWeekday(dateString: string): string {
  const key = dateString.slice(0, 10);
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  return date.toLocaleDateString("es-CL", { weekday: "long", timeZone: "UTC" });
}

function StaySection({
  startDate,
  endDate,
  billingType,
  nights,
  status,
}: {
  startDate: string;
  endDate: string;
  billingType: string;
  nights: number;
  status: string;
}) {
  const isMonthly = billingType === "MONTHLY";
  const durationLabel = isMonthly
    ? `${nights} ${nights === 1 ? "mes" : "meses"}`
    : `${nights} ${nights === 1 ? "noche" : "noches"}`;

  // Tono del divisor central según estado (semántico, sutil).
  const connectorTone =
    status === "CANCELLED"
      ? "bg-destructive/30"
      : status === "COMPLETED"
        ? "bg-muted-foreground/30"
        : "bg-primary/40";

  return (
    <div className="p-5">
      {/* Header: title + duration en la misma línea */}
      <div className="flex items-baseline justify-between gap-3 mb-4">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Estancia
        </p>
        <span className="text-xs font-bold uppercase tracking-wider text-foreground tabular-nums">
          {durationLabel}
        </span>
      </div>

      {/* Date range: check-in | connector | check-out */}
      <div className="grid grid-cols-[1fr_auto_1fr] gap-3 sm:gap-5 items-stretch">
        {/* Check-in */}
        <div className="flex flex-col">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Check-in
          </span>
          <span className="mt-1 text-2xl font-bold text-foreground tabular-nums leading-none">
            {formatDayMonth(startDate)}
          </span>
          <span className="mt-1 text-xs text-muted-foreground capitalize">
            {formatWeekday(startDate)}
          </span>
        </div>

        {/* Connector with dot — minimal visual link */}
        <div className="flex flex-col items-center justify-center pt-4">
          <div className="flex items-center">
            <div className={cn("h-px w-6 sm:w-8", connectorTone)} />
            <div className={cn("size-2 rounded-full mx-1", connectorTone.replace("/30", "/60").replace("/40", ""))} />
            <div className={cn("h-px w-6 sm:w-8", connectorTone)} />
          </div>
        </div>

        {/* Check-out */}
        <div className="flex flex-col items-end text-right">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Check-out
          </span>
          <span className="mt-1 text-2xl font-bold text-foreground tabular-nums leading-none">
            {formatDayMonth(endDate)}
          </span>
          <span className="mt-1 text-xs text-muted-foreground capitalize">
            {formatWeekday(endDate)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Snapshot de propiedad (sidebar)
// ─────────────────────────────────────────────────────────────────────────

function PropertySnapshot({ property }: { property: Property }) {
  const color = property.color || "var(--primary)";
  const typeLabel = property.type ? PROPERTY_TYPE_LABELS[property.type] ?? property.type : null;
  const price =
    property.dailyPrice && Number(property.dailyPrice) > 0
      ? `${formatPrice(property.dailyPrice)} / noche`
      : property.monthlyPrice && Number(property.monthlyPrice) > 0
        ? `${formatPrice(property.monthlyPrice)} / mes`
        : null;

  return (
    <Card className="ring-1 ring-foreground/10">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <span
            className="size-2.5 shrink-0 rounded-sm"
            style={{ backgroundColor: color }}
            aria-hidden="true"
          />
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Propiedad
          </p>
        </div>
        <h3 className="text-sm font-bold text-foreground line-clamp-1">{property.name}</h3>

        <div className="space-y-1.5 text-xs">
          {typeLabel && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <DoorOpen className="size-3.5 shrink-0" aria-hidden="true" />
              <span>{typeLabel}</span>
            </div>
          )}
          {typeof property.unitsAvailable === "number" && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
              <span>
                {property.unitsAvailable}{" "}
                {property.unitsAvailable === 1 ? "unidad" : "unidades"} disponibles
              </span>
            </div>
          )}
          {price && (
            <div className="flex items-center gap-2 font-mono text-foreground/80">
              <Wallet className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="tabular-nums">{price}</span>
            </div>
          )}
        </div>

        <Link
          href={`/properties/${property.id}`}
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "w-full justify-center text-xs",
          )}
        >
          Ver propiedad
        </Link>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Change timeline (sidebar)
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
  const reservationCode = reservation.id.slice(-6).toUpperCase();
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

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_340px] gap-6">
        {/* ─── LEFT COLUMN ────────────────────────────────────────────── */}
        <div className="space-y-6 min-w-0">
          {/* HERO BAND ────────────────────────────────────────────────── */}
          <Card className="ring-1 ring-foreground/10 p-0">
            <CardContent className="p-6 sm:p-8 space-y-6">
              {/* Eyebrow row: reservation code + status pill */}
              <div className="flex flex-wrap items-center gap-3">
                <ReservationPill tone={temporalTone} label={temporal.label} />
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Reserva {reservationCode}
                </span>
                {temporal.sublabel && (
                  <>
                    <span aria-hidden="true" className="text-muted-foreground/40">
                      ·
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      {temporal.sublabel}
                    </span>
                  </>
                )}
              </div>

              {/* Identity: avatar + name + contact */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary"
                  aria-hidden="true"
                >
                  {getInitials(reservation.client.name)}
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                    {reservation.client.name}
                  </h1>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <a
                      href={`mailto:${reservation.client.email}`}
                      className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors"
                    >
                      <Mail className="size-3.5" aria-hidden="true" />
                      <span className="truncate">{reservation.client.email}</span>
                    </a>
                    {reservation.client.phone && (
                      <a
                        href={`tel:${reservation.client.phone}`}
                        className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors"
                      >
                        <Phone className="size-3.5" aria-hidden="true" />
                        <span>{reservation.client.phone}</span>
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* Estancia: check-in / check-out con duración */}
              <div className="rounded-lg bg-muted/30 ring-1 ring-border overflow-hidden">
                <StaySection
                  startDate={reservation.startDate}
                  endDate={reservation.endDate}
                  billingType={reservation.billingType}
                  nights={nights}
                  status={reservation.status}
                />
              </div>

              {/* Metadata chips: property + units + source + billing */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5">
                  <span
                    className="size-2.5 shrink-0 rounded-sm"
                    style={{ backgroundColor: propertyColor }}
                    aria-hidden="true"
                  />
                  <span className="text-xs font-bold text-foreground">
                    {reservation.property.name}
                  </span>
                </div>
                <div className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs text-muted-foreground">
                  <DoorOpen className="size-3.5" aria-hidden="true" />
                  <span className="tabular-nums">
                    {reservation.unitsBooked}{" "}
                    {reservation.unitsBooked === 1 ? "unidad" : "unidades"}
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
            </CardContent>
          </Card>

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
                  <p className="text-sm text-foreground whitespace-pre-wrap">
                    {reservation.notes}
                  </p>
                </CardContent>
              </Card>
            </section>
          )}
        </div>

        {/* ─── RIGHT COLUMN ──────────────────────────────────────────── */}
        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <PropertySnapshot property={reservation.property} />

          {/* Reservation metadata (sin duplicar info del hero) */}
          <Card>
            <CardContent className="p-5 space-y-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Datos de la reserva
              </p>
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
                  <dt className="text-muted-foreground">Origen</dt>
                  <dd className="inline-flex items-center gap-1.5 text-foreground">
                    <Check className="size-3 text-success" aria-hidden="true" />
                    <span>{sourceLabel}</span>
                  </dd>
                </div>
                {reservation.client.rut && (
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-muted-foreground">RUT cliente</dt>
                    <dd className="font-mono text-xs text-foreground/70">
                      {reservation.client.rut}
                    </dd>
                  </div>
                )}
              </dl>
            </CardContent>
          </Card>

          {/* Historial de cambios */}
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
