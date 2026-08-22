"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { ChevronLeft, ChevronRight, Plus, Globe, AlertTriangle, Building2, CalendarCheck, Wallet, Eye, EyeOff } from "lucide-react";
import { CalendarLegend } from "@/components/calendar/calendar-legend";
import { addMonths, format, subMonths } from "date-fns";
import { es } from "date-fns/locale/es";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { KpiCard } from "@/components/ui/kpi-card";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarTimeline } from "@/components/calendar/calendar-timeline";
import { ReservationPreviewDialog } from "@/components/reservations/reservation-preview-dialog";
import { ReservationForm } from "@/components/reservations/reservation-form";
import type { Reservation } from "@/components/reservations/types";
import type { CalendarReservation, CalendarExternalBlock } from "@/lib/actions/reservations";
import type { ReservationInput } from "@/lib/validations/reservation";
import { createReservation, getCalendarReservations } from "@/lib/actions/reservations";
import { computeConflictDates } from "@/lib/calendar/conflicts";
import { nowKeyInBusinessTz } from "@/lib/domain/timezone";

function parseCalendarDate(dateString: string): Date {
  const [year, month, day] = dateString.slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatCLP(amount: number): string {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

interface Property {
  id: string;
  name: string;
  unitsAvailable: number;
  dailyPrice: string;
  monthlyPrice: string | null;
}

interface Client {
  id: string;
  name: string;
  email: string;
}

interface CalendarViewProps {
  initialReservations: CalendarReservation[];
  initialExternalBlocks?: CalendarExternalBlock[];
  initialShowExternalBlocks?: boolean;
  initialShowCancelled?: boolean;
  properties: Property[];
  clients: Client[];
  plan?: string;
}

export function CalendarView({
  initialReservations,
  initialExternalBlocks = [],
  initialShowExternalBlocks = false,
  initialShowCancelled = false,
  properties,
  clients,
  plan = "FREE",
}: CalendarViewProps) {
  const [reservations, setReservations] = useState<CalendarReservation[]>(initialReservations);
  const [externalBlocks, setExternalBlocks] = useState<CalendarExternalBlock[]>(initialExternalBlocks);
  const [showExternalBlocks, setShowExternalBlocks] = useState<boolean>(initialShowExternalBlocks);
  const [showCancelled, setShowCancelled] = useState<boolean>(initialShowCancelled);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("all");
  const [loading, setLoading] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const router = useRouter();
  const pathname = usePathname();
  const searchParamsHook = useSearchParams();

  const handleToggleExternalBlocks = useCallback(() => {
    const next = !showExternalBlocks;
    setShowExternalBlocks(next);
    const params = new URLSearchParams(searchParamsHook.toString());
    if (next) {
      params.set("showExternalBlocks", "1");
    } else {
      params.delete("showExternalBlocks");
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [showExternalBlocks, searchParamsHook, router, pathname]);

  // Toggle de canceladas — default oculto (modo Operate: lo inactivo reposa).
  // Persiste en URL (?showCancelled=1) para que el estado sobreviva a refresh
  // y se pueda compartir. Mismo patrón que handleToggleExternalBlocks.
  const handleToggleCancelled = useCallback(() => {
    const next = !showCancelled;
    setShowCancelled(next);
    const params = new URLSearchParams(searchParamsHook.toString());
    if (next) {
      params.set("showCancelled", "1");
    } else {
      params.delete("showCancelled");
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [showCancelled, searchParamsHook, router, pathname]);

  const fetchReservations = useCallback(async () => {
    setLoading(true);
    try {
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth() + 1;
      const data = await getCalendarReservations({
        year,
        month,
        propertyId: selectedPropertyId !== "all" ? selectedPropertyId : undefined,
      });
      setReservations(data);

      if (showExternalBlocks) {
        const { getCalendarExternalBlocks } = await import("@/lib/actions/reservations");
        const blocksData = await getCalendarExternalBlocks({
          year,
          month,
          propertyId: selectedPropertyId !== "all" ? selectedPropertyId : undefined,
        });
        setExternalBlocks(blocksData);
      } else {
        setExternalBlocks([]);
      }
    } catch (error) {
      console.error("Error fetching calendar data:", error);
    } finally {
      setLoading(false);
    }
  }, [selectedPropertyId, currentMonth, showExternalBlocks]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetching on dependency change
    fetchReservations();
  }, [selectedPropertyId, currentMonth, fetchReservations]);

  const handleSelectReservation = async (id: string) => {
    try {
      const res = await fetch(`/api/reservations/${id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedReservation(data);
      }
    } catch (error) {
      console.error("Error fetching reservation:", error);
    }
  };

  const handleCreateReservation = async (data: ReservationInput) => {
    const result = await createReservation(data);

    if (result && 'error' in result) {
      toast.error(result.error);
      return;
    }

    toast.success("Reserva creada correctamente");
    setCreateDialogOpen(false);
    fetchReservations();
  };

  const dailyReservations = reservations.filter((r) => r.billingType === "DAILY");

  // Canceladas ocultas por default (modo Operate: el timeline refleja estado vigente,
  // no archivo histórico). El toggle `showCancelled` permite verlas bajo demanda.
  // El conteo se calcula siempre (sin filtrar) para alimentar el sublabel "X canceladas
  // ocultas" y el contador del toggle.
  const cancelledCount = useMemo(
    () => dailyReservations.filter((r) => r.status === "CANCELLED").length,
    [dailyReservations],
  );
  const visibleDailyReservations = useMemo(
    () =>
      showCancelled
        ? dailyReservations
        : dailyReservations.filter((r) => r.status !== "CANCELLED"),
    [dailyReservations, showCancelled],
  );

  // Compute conflicts entre reservas VISIBLES y bloqueos externos. Cuando una reserva
  // cancelada se oculta del timeline, los días donde solo ella generaba conflicto con
  // un bloqueo externo dejan de marcarse con dot ámbar — coherente con que la cancelación
  // libera ese día y el bloqueo externo pasa a ser el ocupante real sin conflicto.
  const conflicts = useMemo(() => {
    if (!showExternalBlocks) return new Set<string>();
    return computeConflictDates(visibleDailyReservations, externalBlocks);
  }, [visibleDailyReservations, externalBlocks, showExternalBlocks]);

  // KPIs (Stitch "Calendario de Ocupación" — 4 cards)
  const monthStart = useMemo(() => new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1), [currentMonth]);
  const monthEnd = useMemo(() => new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0), [currentMonth]);
  // Note: today recomputes on every render (no deps), which is fine because this
  // component is used in Operate mode — users navigate fresh each session rather
  // than leaving the page open across midnight. A setInterval refresh is overkill.
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const calendarKpis = useMemo(() => {
    // P0-3 fix: filter by selectedPropertyId when not "all"
    const filteredReservations = selectedPropertyId === "all"
      ? dailyReservations
      : dailyReservations.filter((r) => r.property.id === selectedPropertyId);

    const activeThisMonth = filteredReservations.filter((r) => {
      if (r.status === "CANCELLED") return false;
      const start = parseCalendarDate(r.startDate);
      const end = parseCalendarDate(r.endDate);
      return start <= monthEnd && end >= monthStart;
    });

    // P0-2 fix: count unitsBooked instead of always +1 per reservation
    const occupiedUnits = activeThisMonth.reduce((sum, r) => sum + (r.unitsBooked ?? 1), 0);
    const totalUnits = selectedPropertyId === "all"
      ? properties.reduce((sum, p) => sum + p.unitsAvailable, 0)
      : (properties.find((p) => p.id === selectedPropertyId)?.unitsAvailable ?? 0);
    const occupancyRate = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;

    // Hoy en wall-time SCL (ADR-0020). Antes: `today.toISOString().slice(0, 10)`
    // reinterpretaba local midnight como UTC — en zonas UTC+, "Hoy" podía caer
    // en el día anterior en SCL, dejando `arrivalsToday`/`departuresToday` en 0
    // cuando había reservas que llegaban/salían ese día.
    const todayKey = nowKeyInBusinessTz();
    const arrivalsToday = filteredReservations.filter((r) => {
      if (r.status === "CANCELLED") return false;
      return r.startDate.slice(0, 10) === todayKey;
    }).length;
    const departuresToday = filteredReservations.filter((r) => {
      if (r.status === "CANCELLED") return false;
      return r.endDate.slice(0, 10) === todayKey;
    }).length;

    const projectedRevenue = activeThisMonth.reduce((sum, r) => sum + Number(r.totalPrice), 0);

    return {
      occupancyRate,
      arrivalsToday,
      departuresToday,
      projectedRevenue,
    };
  }, [dailyReservations, properties, selectedPropertyId, monthStart, monthEnd, today]);

  // Filter external blocks to selected property (if not "all")
  const visibleExternalBlocks = useMemo(() => {
    if (selectedPropertyId === "all") return externalBlocks;
    return externalBlocks.filter((b) => b.propertyId === selectedPropertyId);
  }, [externalBlocks, selectedPropertyId]);

  const headerActions = (
    <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
      <Button variant="default" onClick={() => setCreateDialogOpen(true)}>
        <Plus className="mr-2 h-4 w-4" />
        <span className="hidden sm:inline text-foreground">Nueva Reserva</span>
        <span className="sm:hidden text-foreground">Nueva</span>
      </Button>
      <Select value={selectedPropertyId} onValueChange={(v) => setSelectedPropertyId(v || "all")}>
        <SelectTrigger className="w-full min-w-0 sm:w-48" aria-label="Filtrar por propiedad">
          <SelectValue placeholder="Propiedades">
            {(value: string | null) => {
              if (!value || value === "all") return "Todas";
              return properties.find((p) => p.id === value)?.name ?? "Propiedades";
            }}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas</SelectItem>
          {properties.map((property) => (
            <SelectItem key={property.id} value={property.id}>
              {property.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {plan === "PRO" && (
        <Button
          variant="ghost"
          size="sm"
          aria-pressed={showExternalBlocks}
          aria-label="Mostrar bloqueos externos"
          onClick={handleToggleExternalBlocks}
          className={`h-8 rounded-md ${showExternalBlocks ? "bg-primary text-foreground" : "bg-transparent text-muted-foreground hover:text-foreground"}`}
        >
          <Globe className="mr-1.5 h-4 w-4" />
          Bloqueos
        </Button>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* 1. Page header (Stitch "Calendario de Ocupación") */}
      <div className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Calendario de Ocupación</h1>
          <p className="text-xs text-muted-foreground">
            Gestiona la disponibilidad de tus unidades en tiempo real.
          </p>
          {/* Sublabel: comunica cuántas canceladas están ocultas (solo cuando hay
              canceladas en el mes y el toggle está apagado). Evita que el owner se
              pregunte por qué el timeline no cuadra con "Ocupación Media".
              data-testid facilita el targeting en tests; aria-label es la versión
              accesible para screen readers. */}
          {cancelledCount > 0 && !showCancelled && (
            <p
              data-testid="cancelled-sublabel"
              aria-label={`${cancelledCount} reserva${cancelledCount === 1 ? "" : "s"} cancelada${cancelledCount === 1 ? "" : "s"} oculta${cancelledCount === 1 ? "" : "s"}`}
              className="mt-1 text-[10px] font-medium text-muted-foreground/80"
            >
              <span className="tabular-nums">{cancelledCount}</span>{" "}
              reserva{cancelledCount === 1 ? "" : "s"} cancelada{cancelledCount === 1 ? "" : "s"}{" "}
              oculta{cancelledCount === 1 ? "" : "s"} · activa el toggle para ver
            </p>
          )}
        </div>
      </div>

      {/* 2. KPI Grid (4 cards estilo Stitch).
            Mobile: 2 columnas (2x2 grid) para reducir altura antes del timeline,
            que es la sección accionable prioritaria del calendario. */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 sm:gap-4">
        <KpiCard
          label="Ocupación Media"
          value={`${calendarKpis.occupancyRate}%`}
          icon={Building2}
          tone={
            calendarKpis.occupancyRate >= 85
              ? "success"
              : calendarKpis.occupancyRate >= 50
              ? "default"
              : "warning"
          }
          indicator={
            calendarKpis.occupancyRate >= 85
              ? { text: "Alta demanda", variant: "positive" }
              : calendarKpis.occupancyRate >= 50
              ? { text: "Demanda media", variant: "neutral" }
              : { text: "Baja demanda", variant: "neutral" }
          }
          progressBar={{ value: calendarKpis.occupancyRate }}
        />
        <KpiCard
          label="Llegadas Hoy"
          value={calendarKpis.arrivalsToday}
          icon={CalendarCheck}
          tone="info"
          unit="Check-ins"
        />
        <KpiCard
          label="Salidas Hoy"
          value={calendarKpis.departuresToday}
          icon={CalendarCheck}
          tone="default"
          unit="Check-outs"
        />
        <KpiCard
          label="Revenue Proyectado"
          value={formatCLP(calendarKpis.projectedRevenue)}
          icon={Wallet}
          tone={calendarKpis.projectedRevenue > 0 ? "default" : "warning"}
          indicator={{
            text: `${dailyReservations.filter((r) => r.status !== "CANCELLED").length} reservas activas`,
            variant: "neutral",
          }}
        />
      </section>

      {/* 3. Controls bar — sin Card wrapper (sin envoltorio, controles en línea) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Sección izquierda: filtro del calendario */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex h-8 items-center overflow-hidden rounded-lg border">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-none border-r"
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              aria-label="Mes anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-[180px] px-4 py-1.5 text-center text-xs font-bold capitalize">
              {format(currentMonth, "MMMM yyyy", { locale: es })}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-none border-l"
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              aria-label="Mes siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Button
            variant="outline"
            size="default"
            className="h-8 px-3 text-[10px] font-bold uppercase tracking-wider"
            onClick={() => setCurrentMonth(new Date())}
          >
            Hoy
          </Button>
          {/* Toggle de canceladas — default oculto (modo Operate).
              Solo se muestra cuando hay canceladas en el mes; sin canceladas
              no hay nada que filtrar. Estado se persiste en URL. */}
          {cancelledCount > 0 && (
            <Button
              variant="ghost"
              size="default"
              aria-pressed={showCancelled}
              aria-label={
                showCancelled
                  ? "Ocultar reservas canceladas"
                  : `Mostrar ${cancelledCount} reserva${cancelledCount === 1 ? "" : "s"} cancelada${cancelledCount === 1 ? "" : "s"}`
              }
              onClick={handleToggleCancelled}
              className={`h-8 rounded-md border px-3 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                showCancelled
                  ? "border-destructive/30 bg-destructive/10 text-destructive"
                  : "border-border bg-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {showCancelled ? (
                <EyeOff className="mr-1.5 h-4 w-4" aria-hidden="true" />
              ) : (
                <Eye className="mr-1.5 h-4 w-4" aria-hidden="true" />
              )}
              <span className="tabular-nums">{cancelledCount}</span>
              <span className="hidden sm:inline">cancelada{cancelledCount === 1 ? "" : "s"}</span>
            </Button>
          )}
        </div>

        {/* Sección derecha: acciones */}
        <div className="flex flex-wrap items-center gap-2">
          {headerActions}
        </div>
      </div>

      {/* Legend row — always visible for bar states; channels visible when external blocks are toggled on */}
      <CalendarLegend showChannels={showExternalBlocks} />

      {/* 4. Timeline — sin Card wrapper (CalendarTimeline ya tiene su propio rounded-xl border) */}
      {loading ? (
        <div className="flex h-96 items-center justify-center rounded-xl border bg-card">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : (
        <>
          {showExternalBlocks && conflicts.size > 0 && (
            <div className="mb-4 flex items-start gap-3 rounded-xl border border-l-2 border-l-warning bg-warning/10 px-4 py-3 text-sm text-foreground">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">{conflicts.size} día(s) con conflicto Reserva + Bloqueo externo</p>
                <p className="text-xs">La reserva interna prevalece. Los días marcados tienen un punto ámbar.</p>
              </div>
            </div>
          )}
          <CalendarTimeline
            selectedPropertyId={selectedPropertyId}
            properties={properties}
            reservations={visibleDailyReservations.map((r) => ({
              ...r,
              propertyId: r.property.id,
              clientId: "",
              billingType: "DAILY" as const,
              unitsBooked: r.unitsBooked ?? 1,
              bookingAirbnb: false,
              notes: null,
              payments: [],
              startDate: r.startDate,
              endDate: r.endDate,
              totalPrice: String(r.totalPrice),
              property: {
                ...r.property,
              },
              client: {
                ...r.client,
                id: "",
                email: "",
              },
            }))}
            externalBlocks={showExternalBlocks ? visibleExternalBlocks : []}
            conflicts={conflicts}
            currentMonth={currentMonth}
            onSelectReservation={handleSelectReservation}
          />
        </>
      )}

      {selectedReservation && (
        <ReservationPreviewDialog
          reservation={selectedReservation}
          open={!!selectedReservation}
          onClose={() => setSelectedReservation(null)}
        />
      )}

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="w-[95vw] max-w-2xl gap-0 p-0">
          <DialogHeader className="border-b border-border/60 px-5 py-4 pr-12">
            <DialogTitle>Nueva Reserva</DialogTitle>
            <DialogDescription>
              Completa los datos principales de la estadía y confirma la reserva.
            </DialogDescription>
          </DialogHeader>
          <ReservationForm
            properties={properties}
            clients={clients}
            plan={plan as "FREE" | "PRO"}
            onSubmit={handleCreateReservation}
            onCancel={() => setCreateDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
