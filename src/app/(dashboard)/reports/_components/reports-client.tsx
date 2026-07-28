"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { BarChart3, Calendar, FileSpreadsheet, Download, Wallet, Building2, AlertCircle, AlertTriangle, TrendingUp } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { getDashboardStats, getOccupancyReport, getCollectionReport, getDecisionSummary } from "@/lib/actions/reports";
import { getReservationsReportForExport } from "@/lib/actions/reports";
import type { DashboardStats, OccupancyReport, ReservationReport } from "@/lib/actions/reports";
import type { CollectionReportRow } from "@/lib/reports/collection";
import type { ReportDecisionSummary } from "@/lib/reports/decision-summary";
import { getCollectionDueLabel, getCollectionStatus } from "@/lib/reports/collection";
import { Pagination } from "@/components/ui/pagination";
import { DataTable } from "@/components/ui/data-table";
import { exportToExcel, exportToPDF, type ReservationDetail, type PropertySummary } from "@/lib/export-utils";
import { KpiCard } from "@/components/ui/kpi-card";
import { ModelDistributionCard } from "@/components/reports/model-distribution-card";
import { PropertySummaryTable } from "@/components/reports/property-summary-table";
import { startOfMonth, endOfMonth, subMonths, startOfYear, format } from "date-fns";
import { es } from "date-fns/locale/es";
import { isReportsRangeAllowed, portfolioOccupancyDenominator } from "@/lib/reports/kpis";

type QuickRange = "current_month" | "prev_month" | "last_3" | "last_6" | "year_to_date" | "custom";

const QUICK_RANGES: { value: QuickRange; label: string }[] = [
  { value: "current_month", label: "Mes actual" },
  { value: "prev_month", label: "Mes anterior" },
  { value: "last_3", label: "Últimos 3 meses" },
  { value: "last_6", label: "Últimos 6 meses" },
  { value: "year_to_date", label: "Año actual" },
  { value: "custom", label: "Personalizado" },
];

interface Property { id: string; name: string; unitsAvailable: number; }
interface SessionInfo { plan: string | null; }

const clpFormatter = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});
function formatCLP(amount: number): string {
  return clpFormatter.format(amount);
}

/** Converts "2026-01" → "Ene 2026" using Intl.DateTimeFormat (no date-fns/tz dependency). */
function monthKeyLabel(monthKey: string): string {
  // Parse YYYY-MM using UTC to avoid timezone shifts
  const [year, month] = monthKey.split("-").map(Number);
  // month is 1-indexed; Date months are 0-indexed
  const date = new Date(Date.UTC(year, month - 1, 1, 12, 0, 0));
  return new Intl.DateTimeFormat("es-CL", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export interface ReportsClientProps {
  initialStats: DashboardStats;
  initialOccupancyData: OccupancyReport[];
  initialCollectionRows: CollectionReportRow[];
  initialCollectionTotal: number;
  initialCollectionTotalPages: number;
  initialCollectionTotals: { totalToCollect: number; totalOverdue: number; pendingInvoices: number };
  initialProperties: Property[];
  initialSession: SessionInfo;
  initialDecisionSummary: ReportDecisionSummary | null;
}

export function ReportsClient({
  initialStats,
  initialOccupancyData,
  initialCollectionRows,
  initialCollectionTotal,
  initialCollectionTotalPages,
  initialCollectionTotals,
  initialProperties,
  initialSession,
  initialDecisionSummary,
}: ReportsClientProps) {
  const [decisionSummary, setDecisionSummary] = useState<ReportDecisionSummary | null>(initialDecisionSummary);
  const [stats, setStats] = useState<DashboardStats | null>(initialStats);
  const [occupancyData, setOccupancyData] = useState<OccupancyReport[]>(initialOccupancyData);
  const [loading, setLoading] = useState(false);
  const [quickRange, setQuickRange] = useState<QuickRange>("current_month");
  const [customRange, setCustomRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });
  const [selectedProperty, setSelectedProperty] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [properties, setProperties] = useState<Property[]>(initialProperties);
  const [session, setSession] = useState<SessionInfo | null>(initialSession);
  const [exportLoading, setExportLoading] = useState(false);
  const [collectionRows, setCollectionRows] = useState<CollectionReportRow[]>(initialCollectionRows);
  const [collectionBillingType, setCollectionBillingType] = useState<"GENERAL" | "DAILY" | "MONTHLY">("GENERAL");
  const [collectionClientId, setCollectionClientId] = useState<string>("all");
  const [collectionDebtStatus, setCollectionDebtStatus] = useState<"ACTIVE" | "ALL" | "OVERDUE" | "UPCOMING" | "PAID">("ACTIVE");
  const [collectionDueRange, setCollectionDueRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });
  const [collectionPage, setCollectionPage] = useState(1);
  const [collectionTotal, setCollectionTotal] = useState(initialCollectionTotal);
  const [collectionTotalPages, setCollectionTotalPages] = useState(initialCollectionTotalPages);
  const [collectionLimit, setCollectionLimit] = useState(10);
  // Totales de colección del servidor (conjunto completo, no paginado)
  const [collectionTotals, setCollectionTotals] = useState(initialCollectionTotals);

  const effectiveDateRange = useMemo(() => {
    const now = new Date();
    if (quickRange === "current_month") {
      return { from: startOfMonth(now), to: endOfMonth(now) };
    }
    if (quickRange === "prev_month") {
      const prev = subMonths(now, 1);
      return { from: startOfMonth(prev), to: endOfMonth(prev) };
    }
    if (quickRange === "last_3") {
      return { from: startOfMonth(subMonths(now, 2)), to: endOfMonth(now) };
    }
    if (quickRange === "last_6") {
      return { from: startOfMonth(subMonths(now, 5)), to: endOfMonth(now) };
    }
    if (quickRange === "year_to_date") {
      // Año actual desde 1 enero hasta hoy
      return { from: startOfYear(now), to: now };
    }
    if (quickRange === "custom" && customRange.from && customRange.to) {
      return { from: customRange.from, to: customRange.to };
    }
    return { from: startOfMonth(now), to: endOfMonth(now) };
  }, [quickRange, customRange]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsData, occupancy, collection, decision] = await Promise.all([
        getDashboardStats({ propertyId: selectedProperty !== "all" ? selectedProperty : undefined }),
        getOccupancyReport({
          propertyId: selectedProperty !== "all" ? selectedProperty : undefined,
          startDate: effectiveDateRange.from || undefined,
          endDate: effectiveDateRange.to || undefined,
        }),
        getCollectionReport({
          propertyId: selectedProperty !== "all" ? selectedProperty : undefined,
          billingType: collectionBillingType,
          clientId: collectionClientId !== "all" ? collectionClientId : undefined,
          debtStatus: collectionDebtStatus,
          dueDateFrom: collectionDueRange.from,
          dueDateTo: collectionDueRange.to,
          page: collectionPage,
          limit: collectionLimit,
        }),
        getDecisionSummary({
          rangeStart: effectiveDateRange.from || undefined,
          rangeEnd: effectiveDateRange.to || undefined,
          propertyId: selectedProperty !== "all" ? selectedProperty : undefined,
        }),
      ]);

      setStats(statsData);
      setOccupancyData(occupancy || []);
      if (collection && "data" in collection) {
        setCollectionRows(collection.data);
        setCollectionTotal(collection.total);
        setCollectionTotalPages(collection.totalPages);
        // Usar totales del servidor (conjunto completo, no la página)
        if ("totals" in collection) {
          setCollectionTotals(collection.totals);
        }
      } else {
        setCollectionRows(collection || []);
      }
      setDecisionSummary(decision);
    } catch (error) {
      console.error("Error fetching reports:", error);
    } finally {
      setLoading(false);
    }
  }, [effectiveDateRange, selectedProperty, selectedStatus, collectionBillingType, collectionClientId, collectionDebtStatus, collectionDueRange, collectionPage, collectionLimit]);

  // Trigger fetch when filters change (not on initial mount — server pre-computed data is used)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetching
    fetchData();
  }, [fetchData]);

  // maxRevenue removed — bar chart and duplicate revenue card deleted (ADR-0030)

  /** Pure helper: group reservation details by property for export. */
  function computeGroupedByProperty(details: ReservationDetail[]): PropertySummary[] {
    const map = new Map<string, PropertySummary>();
    details.forEach((r) => {
      if (!map.has(r.propertyName)) {
        map.set(r.propertyName, {
          propertyName: r.propertyName,
          totalReservations: 0,
          totalNights: 0,
          totalRevenue: 0,
          paidRevenue: 0,
          pendingRevenue: 0,
        });
      }
      const entry = map.get(r.propertyName)!;
      entry.totalReservations += 1;
      entry.totalNights += Math.ceil(
        (r.endDate.getTime() - r.startDate.getTime()) / (1000 * 60 * 60 * 24)
      ) + 1;
      entry.totalRevenue += r.totalPrice;
      if (r.paymentStatus === "COMPLETED") entry.paidRevenue += r.totalPrice;
      else entry.pendingRevenue += r.totalPrice;
    });
    return Array.from(map.values());
  }

  // ── Billing type metrics derived from decisionSummary (ADR-0029) ──
  // Cash share % is calculated over decisionSummary.collectedCash (total portfolio cash)
  const billingTypeMetrics = useMemo(() => {
    if (!decisionSummary) return null;
    const daily = decisionSummary.byBillingType.DAILY;
    const monthly = decisionSummary.byBillingType.MONTHLY;
    const totalCollected = decisionSummary.collectedCash;
    const dailyPct = totalCollected > 0 ? Math.round((daily.collectedCash / totalCollected) * 100) : 0;
    return { daily, monthly, totalCollected, dailyPct };
  }, [decisionSummary]);

  const isFreePlan = session?.plan === "FREE";

  const collectionClients = useMemo(() => {
    const map = new Map<string, string>();
    collectionRows.forEach((row) => map.set(row.clientId, row.clientName));
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [collectionRows]);

  const handleQuickRangeChange = (value: QuickRange) => {
    // Plan FREE: solo mes actual, incluyendo rango personalizado
    if (!isReportsRangeAllowed(initialSession.plan, value)) {
      return;
    }
    setQuickRange(value);
    if (value === "custom") return;
    const now = new Date();
    if (value === "current_month") {
      setCustomRange({ from: startOfMonth(now), to: endOfMonth(now) });
    } else if (value === "prev_month") {
      const prev = subMonths(now, 1);
      setCustomRange({ from: startOfMonth(prev), to: endOfMonth(prev) });
    } else if (value === "last_3") {
      setCustomRange({ from: startOfMonth(subMonths(now, 2)), to: endOfMonth(now) });
    } else if (value === "last_6") {
      setCustomRange({ from: startOfMonth(subMonths(now, 5)), to: endOfMonth(now) });
    } else if (value === "year_to_date") {
      setCustomRange({ from: startOfYear(now), to: now });
    } else {
      setCustomRange({ from: undefined, to: undefined });
    }
  };

  const handleExcelExport = async () => {
    setExportLoading(true);
    try {
      // On-demand: fetch with current filters (ADR-0030 — no SSR/refresh)
      const reservations = await getReservationsReportForExport({
        propertyId: selectedProperty !== "all" ? selectedProperty : undefined,
        status: selectedStatus !== "all" ? selectedStatus : undefined,
        startDate: effectiveDateRange.from || undefined,
        endDate: effectiveDateRange.to || undefined,
      });
      const details: ReservationDetail[] = (reservations || []).map((r: ReservationReport) => ({
        id: r.id,
        propertyName: r.propertyName,
        clientName: r.clientName,
        clientEmail: r.clientEmail,
        startDate: new Date(r.startDate),
        endDate: new Date(r.endDate),
        totalPrice: Number(r.totalPrice),
        status: r.status,
        paymentStatus: r.paymentStatus,
        billingType: r.billingType,
        createdAt: new Date(r.createdAt),
      }));
      const grouped = computeGroupedByProperty(details);
      exportToExcel(details, grouped, effectiveDateRange.from ? effectiveDateRange : null);
    } finally {
      setExportLoading(false);
    }
  };

  const handlePDFExport = async () => {
    setExportLoading(true);
    try {
      // On-demand: fetch with current filters (ADR-0030 — no SSR/refresh)
      const reservations = await getReservationsReportForExport({
        propertyId: selectedProperty !== "all" ? selectedProperty : undefined,
        status: selectedStatus !== "all" ? selectedStatus : undefined,
        startDate: effectiveDateRange.from || undefined,
        endDate: effectiveDateRange.to || undefined,
      });
      const details: ReservationDetail[] = (reservations || []).map((r: ReservationReport) => ({
        id: r.id,
        propertyName: r.propertyName,
        clientName: r.clientName,
        clientEmail: r.clientEmail,
        startDate: new Date(r.startDate),
        endDate: new Date(r.endDate),
        totalPrice: Number(r.totalPrice),
        status: r.status,
        paymentStatus: r.paymentStatus,
        billingType: r.billingType,
        createdAt: new Date(r.createdAt),
      }));
      const grouped = computeGroupedByProperty(details);
      exportToPDF(details, grouped, effectiveDateRange.from ? effectiveDateRange : null);
    } finally {
      setExportLoading(false);
    }
  };

  // KPI Ingresos cobrados: use decisionSummary.collectedCash (cash collected in range)
  const totalRevenue = decisionSummary?.collectedCash ?? 0;

  // KPI Ocupación: from decisionSummary (ADR-0029, date-only, full scope)
  // Fallback to legacy occupancyData computation if decisionSummary not yet loaded.
  const totalNights = decisionSummary?.occupiedNightUnits
    ?? occupancyData.reduce((acc, p) => acc + p.totalNights, 0);
  const maxPossibleNights = decisionSummary?.capacityNightUnits
    ?? (portfolioOccupancyDenominator(
      initialProperties,
      selectedProperty !== "all" ? selectedProperty : undefined,
    ) * 31);
  const occupancyRate = decisionSummary?.occupancyRate
    ?? (maxPossibleNights > 0 && totalNights > 0
      ? Math.min(100, Math.round((totalNights / maxPossibleNights) * 100))
      : 0);

  // Usar totales del servidor (conjunto completo, no paginado) para los KPIs de cobranza
  const totalToCollect = collectionTotals.totalToCollect;
  const pendingInvoices = collectionTotals.pendingInvoices;
  const totalOverdue = collectionTotals.totalOverdue;

  const occupancySublabel = useMemo(() => {
    if (occupancyRate === 0) return "Sin datos de ocupación";
    if (occupancyRate >= 85) return "Alta demanda";
    if (occupancyRate >= 60) return "Demanda estable";
    if (occupancyRate >= 30) return "Demanda moderada";
    return "Baja demanda";
  }, [occupancyRate]);

  const rangeLabel = (() => {
    if (effectiveDateRange.from && effectiveDateRange.to) {
      return `${format(effectiveDateRange.from, "dd MMM, yyyy", { locale: es })} - ${format(effectiveDateRange.to, "dd MMM, yyyy", { locale: es })}`;
    }
    if (quickRange === "year_to_date") {
      return `${format(startOfYear(new Date()), "dd MMM, yyyy", { locale: es })} - ${format(new Date(), "dd MMM, yyyy", { locale: es })}`;
    }
    return "Mes actual";
  })();

  const formattedRevenue = typeof totalRevenue === "number" && !isNaN(totalRevenue)
    ? `$${totalRevenue.toLocaleString("CLP")}`
    : "$0";
  const formattedOccupancy = occupancyRate > 0 ? `${occupancyRate}%` : "—";
  const formattedToCollect = totalToCollect > 0 ? `$${totalToCollect.toLocaleString("CLP")}` : "—";
  const formattedOverdue = totalOverdue > 0 ? `$${totalOverdue.toLocaleString("CLP")}` : "—";

  return (
    <div className="space-y-6">
      {/* ─── Nuevo Header: Resumen Ejecutivo de Gestión ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold leading-tight">Resumen Ejecutivo de Gestión</h1>
          <p className="text-sm text-muted-foreground">Análisis estratégico y estado de cobranza</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Date range pill — label informativo, no clickeable */}
          <div className="hidden lg:flex items-center bg-card border border-border rounded px-3 py-1.5 gap-2">
            <Calendar className="size-4 text-muted-foreground" />
            <span className="text-xs font-medium text-foreground">{rangeLabel}</span>
          </div>
          {/* Excel (outline, izquierda del PDF) */}
          <Button variant="outline" size="sm" onClick={handleExcelExport} disabled={exportLoading}>
            <FileSpreadsheet className="size-4 mr-1" />
            Excel
          </Button>
          {/* Exportar PDF (primary) */}
          <Button size="sm" onClick={handlePDFExport} disabled={exportLoading}>
            <Download className="size-4 mr-1" />
            Exportar PDF
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground">Rango rápido</label>
              <div className="flex flex-wrap gap-2">
                {QUICK_RANGES.map((range) => (
                  <Button
                    key={range.value}
                    variant={quickRange === range.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleQuickRangeChange(range.value)}
                    disabled={!isReportsRangeAllowed(initialSession.plan, range.value)}
                    className="text-xs"
                  >
                    {range.label}
                    {!isReportsRangeAllowed(initialSession.plan, range.value) && (
                      <span className="ml-1 opacity-70">🔒</span>
                    )}
                  </Button>
                ))}
              </div>
              {isFreePlan && (
                <p className="text-xs text-muted-foreground mt-1">
                  Plan FREE: solo mes actual. Haz upgrade a PRO.
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground">Rango personalizado</label>
              <DateRangePicker
                date={customRange}
                onDateChange={(d) => {
                  if (quickRange === "custom") {
                    setCustomRange(d);
                  }
                }}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground">Propiedad</label>
              <Select value={selectedProperty} onValueChange={(value) => setSelectedProperty(value || "all")}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las propiedades</SelectItem>
                  {properties.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground">Estado de Reservas (detalle/exportación)</label>
              <Select value={selectedStatus} onValueChange={(v) => v && setSelectedStatus(v)}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="PENDING">Pendiente</SelectItem>
                  <SelectItem value="CONFIRMED">Confirmada</SelectItem>
                  <SelectItem value="COMPLETED">Completada</SelectItem>
                  <SelectItem value="CANCELLED">Cancelada</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">No modifica el resumen financiero-operativo.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex h-96 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : (
        <>
          {/* ─── 4 KPIs Ejecutivos ─── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              label="Ingresos cobrados"
              value={formattedRevenue}
              icon={Wallet}
              tone="success"
            />
            <KpiCard
              label={selectedProperty === "all" ? "Ocupación del portafolio" : "Ocupación de la propiedad"}
              value={formattedOccupancy}
              icon={Building2}
              tone="default"
            />
            <KpiCard
              label="Total por Cobrar"
              value={formattedToCollect}
              icon={AlertCircle}
              tone={totalToCollect > 0 ? "warning" : "default"}
            />
            <KpiCard
              label="Cobros Vencidos"
              value={formattedOverdue}
              icon={AlertTriangle}
              tone={totalOverdue > 0 ? "destructive" : "default"}
              indicator={
                totalOverdue > 0
                  ? { text: "Acción requerida", variant: "warning" }
                  : undefined
              }
            />
          </div>

          {decisionSummary && billingTypeMetrics && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <ModelDistributionCard
                  title="Modelo de Negocio: Diario"
                  description="Ingresos por estancias cortas"
                  collectedCash={billingTypeMetrics.daily.collectedCash}
                  cashSharePercentage={billingTypeMetrics.dailyPct}
                  reservationCount={billingTypeMetrics.daily.reservationCount}
                  outstandingBalance={billingTypeMetrics.daily.outstandingBalance}
                  occupancyRate={billingTypeMetrics.daily.occupancyRate}
                  occupiedNightUnits={billingTypeMetrics.daily.occupiedNightUnits}
                  capacityNightUnits={billingTypeMetrics.daily.capacityNightUnits}
                  cancelledCash={billingTypeMetrics.daily.collectedCashFromCancelledReservations}
                  variant="primary"
                />
                <ModelDistributionCard
                  title="Modelo de Negocio: Mensual"
                  description="Ingresos por contratos de larga duración"
                  collectedCash={billingTypeMetrics.monthly.collectedCash}
                  cashSharePercentage={100 - billingTypeMetrics.dailyPct}
                  reservationCount={billingTypeMetrics.monthly.reservationCount}
                  outstandingBalance={billingTypeMetrics.monthly.outstandingBalance}
                  occupancyRate={billingTypeMetrics.monthly.occupancyRate}
                  occupiedNightUnits={billingTypeMetrics.monthly.occupiedNightUnits}
                  capacityNightUnits={billingTypeMetrics.monthly.capacityNightUnits}
                  cancelledCash={billingTypeMetrics.monthly.collectedCashFromCancelledReservations}
                  variant="secondary"
                />
              </div>
            )}

          {/* Nota: la ocupación incluye Reservas internas. Los Bloqueos de Canal Externo no están incluidos. */}
          <div className="flex items-center gap-2">
            <p className="text-[10px] text-muted-foreground italic">
              La ocupación incluye Reservas internas. Los Bloqueos de Canal Externo no están incluidos.
            </p>
          </div>

          <PropertySummaryTable rows={decisionSummary?.byProperty ?? []} />

          {decisionSummary && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="text-primary size-5" />
                <h2 className="text-xs font-bold text-foreground uppercase tracking-wider">
                  Ingresos cobrados por mes
                </h2>
              </div>
              <p className="text-sm text-muted-foreground">
                Cash de arriendo en el rango seleccionado, agrupado por mes calendario.
              </p>
              <DataTable
                headers={[
                  "Mes",
                  { label: "Cobrado de arriendo", align: "right" },
                  { label: "Pagos", align: "right" },
                  { label: "Canceladas", align: "right" },
                ]}
                emptyState={<p className="text-sm text-muted-foreground">Sin datos de cash en el rango</p>}
              >
                {(decisionSummary?.cash?.byMonth ?? []).map((m) => (
                  <tr key={m.monthKey} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-foreground">{monthKeyLabel(m.monthKey)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-foreground font-medium">
                      {formatCLP(m.collectedCash)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                      {m.paymentCount}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                      {m.cancelledCash > 0 ? formatCLP(m.cancelledCash) : "—"}
                    </td>
                  </tr>
                ))}
              </DataTable>
            </div>
          )}

          <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Ocupación por Propiedad
                </CardTitle>
                <CardDescription>
                  Reservas y noches por propiedad
                </CardDescription>
              </CardHeader>
              <CardContent>
                {occupancyData.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Sin datos de ocupación
                  </p>
                ) : (
                  <div className="space-y-4">
                    {occupancyData.map((item) => (
                      <div key={item.propertyId} className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{item.propertyName}</p>
                          <p className="text-sm text-muted-foreground">
                            {item.totalReservations} reservas · {item.totalNights} noches
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">
                            {item.totalRevenue.toLocaleString("CLP")}
                          </p>
                          <p className="text-xs text-muted-foreground">ingresos</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="mb-4 flex items-center gap-2">
            <Wallet className="text-primary size-5" />
            <h2 className="text-xs font-bold text-foreground uppercase tracking-wider">
              Reporte de Cobranza Detallado
            </h2>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-4">
            <Select value={collectionBillingType} onValueChange={(value) => {
              setCollectionBillingType((value ?? "GENERAL") as "GENERAL" | "DAILY" | "MONTHLY");
              setCollectionPage(1);
            }}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="Tipo arriendo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="GENERAL">General</SelectItem>
                <SelectItem value="DAILY">Diario</SelectItem>
                <SelectItem value="MONTHLY">Mensual</SelectItem>
              </SelectContent>
            </Select>

            <Select value={collectionClientId} onValueChange={(value) => {
              setCollectionClientId(value ?? "all");
              setCollectionPage(1);
            }}>
              <SelectTrigger className="w-full sm:w-52">
                <SelectValue placeholder="Cliente" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los clientes</SelectItem>
                {collectionClients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={collectionDebtStatus} onValueChange={(value) => {
              setCollectionDebtStatus((value ?? "ACTIVE") as "ACTIVE" | "ALL" | "OVERDUE" | "UPCOMING" | "PAID");
              setCollectionPage(1);
            }}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="Estado deuda" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">Deuda activa</SelectItem>
                <SelectItem value="OVERDUE">Vencida</SelectItem>
                <SelectItem value="UPCOMING">Por vencer</SelectItem>
                <SelectItem value="PAID">Pagada</SelectItem>
                <SelectItem value="ALL">Todos</SelectItem>
              </SelectContent>
            </Select>

            <DateRangePicker date={collectionDueRange} onDateChange={(d) => {
              setCollectionDueRange(d);
              setCollectionPage(1);
            }} />
          </div>

          <DataTable
            headers={[
              "Cliente",
              "Propiedad",
              "Vencimiento",
              { label: "Monto a cobrar", align: "right" },
              "Estado",
            ]}
            caption="Reporte de cobranza detallado"
            emptyState={
              <p className="text-sm text-muted-foreground">
                Sin reservas para los filtros seleccionados
              </p>
            }
          >
            {collectionRows.map((row) => {
              const status = getCollectionStatus(row);
              const billingLabel = row.billingType === "DAILY" ? "Diario" : "Mensual";

              const isPaid = status.status === "PAID";
              const rentAmount = row.overdue > 0
                ? row.overdue
                : row.nextInstallmentAmount;
              const amountToShow = isPaid ? 0 : rentAmount + row.extrasPending;
              const showExtrasBreakdown =
                !isPaid && row.extrasPending > 0 && amountToShow > row.extrasPending;

              return (
                <tr key={row.reservationId} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground leading-tight">{row.clientName}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      #{row.reservationId.slice(0, 8)} · {billingLabel}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-foreground">{row.propertyName}</td>
                  <td className="px-4 py-3 text-foreground">
                    {getCollectionDueLabel(row.nextDueDate)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {isPaid ? (
                      <span className="text-muted-foreground tabular-nums">—</span>
                    ) : (
                      <>
                        <div className="text-sm font-bold tabular-nums text-foreground">
                          {formatCLP(amountToShow)}
                        </div>
                        {showExtrasBreakdown && (
                          <div className="text-[10px] text-muted-foreground mt-0.5 tabular-nums">
                            + {formatCLP(row.extrasPending)} extras
                          </div>
                        )}
                      </>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </td>
                </tr>
              );
            })}
          </DataTable>

          {collectionTotal > collectionLimit && (
            <Pagination
              page={collectionPage}
              totalPages={collectionTotalPages}
              total={collectionTotal}
              limit={collectionLimit}
              onPageChange={setCollectionPage}
              onLimitChange={setCollectionLimit}
            />
          )}

          {decisionSummary?.cash?.annual && (
            <Card>
              <CardHeader>
                <CardTitle>Resumen Anual {decisionSummary.cash.annual.year}</CardTitle>
                <CardDescription>
                  Total de {decisionSummary.cash.annual.paymentCount} pagos registrados
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6 grid-cols-1 sm:grid-cols-3">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-primary">
                      {decisionSummary.cash.annual.totalCash.toLocaleString("CLP")}
                    </p>
                    <p className="text-sm text-muted-foreground">ingresos totales</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-2">Por método de pago</p>
                    <div className="space-y-1">
                      {Object.entries(decisionSummary.cash.annual.byMethod).map(([method, amount]) => (
                        <div key={method} className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{method}</span>
                          <span className="font-medium">{Number(amount).toLocaleString("CLP")}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-2">Distribución mensual</p>
                    <div className="flex items-end gap-1 h-20">
                      {decisionSummary.cash.annual.byMonth.map((monthEntry, index) => {
                        const maxMonthCash = Math.max(...decisionSummary.cash.annual.byMonth.map(m => m.collectedCash), 1);
                        return (
                          <div
                            key={index}
                            className="flex-1 bg-primary rounded-t"
                            style={{
                              height: `${(monthEntry.collectedCash / maxMonthCash) * 100}%`,
                              minHeight: monthEntry.collectedCash > 0 ? "4px" : "0",
                            }}
                            title={`${["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"][index]}: ${monthEntry.collectedCash.toLocaleString("CLP")}`}
                          />
                        );
                      })}
                    </div>
                    <div className="flex justify-between mt-1 text-xs text-muted-foreground">
                      <span>Ene</span>
                      <span>Dic</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
