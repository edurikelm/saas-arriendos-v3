"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { FileSpreadsheet, Download, TrendingUp, PieChart, AlertTriangle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { cn } from "@/lib/utils";
import {
  getDecisionSummary,
  getOutstandingSnapshot,
  getReservationsReportForExport,
  getReservationsReportCount,
  type OutstandingSnapshot,
  type ReservationReport,
} from "@/lib/actions/reports";
import type { AgingSummary } from "@/lib/reports/collection";
import type { ReportDecisionSummary } from "@/lib/reports/decision-summary";
import { exportToExcel, exportToPDF, type ReservationDetail, type PropertySummary } from "@/lib/export-utils";
import { PeriodResultKpis } from "@/components/reports/period-result-kpis";
import { MonthlyCashChart } from "@/components/reports/monthly-cash-chart";
import { BillingTypeSplit } from "@/components/reports/billing-type-split";
import { AgingBucketsPanel } from "@/components/reports/aging-buckets-panel";
import { TopClientDebtorsList } from "@/components/reports/top-client-debtors-list";
import { PropertySummaryTable } from "@/components/reports/property-summary-table";
import { startOfMonth, endOfMonth, subMonths, startOfYear } from "date-fns";
import { isReportsRangeAllowed } from "@/lib/reports/kpis";
import { addDaysToDateKey, nightsBetweenDateOnly, nowKeyInBusinessTz } from "@/lib/domain/timezone";
import { computeTrend, computeGroupedByPropertyFromSummary } from "@/lib/reports/trend";
import { formatPeriodRangeLabel } from "@/lib/reports/format";

/** Tramos vacíos para el primer render si `getOutstandingSnapshot` no devolvió datos (sin sesión). */
const EMPTY_AGING: AgingSummary = { buckets: [], totalDue: 0, totalOverdue: 0 };

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

export interface ReportsClientProps {
  initialSnapshot: OutstandingSnapshot | null;
  initialProperties: Property[];
  initialSession: SessionInfo;
  initialDecisionSummary: ReportDecisionSummary | null;
}

export function ReportsClient({
  initialSnapshot,
  initialProperties,
  initialSession,
  initialDecisionSummary,
}: ReportsClientProps) {
  const [decisionSummary, setDecisionSummary] = useState<ReportDecisionSummary | null>(initialDecisionSummary);
  const [decisionSummaryPrev, setDecisionSummaryPrev] = useState<ReportDecisionSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [exportRowCount, setExportRowCount] = useState<number | null>(null);

  const [snapshot, setSnapshot] = useState<OutstandingSnapshot | null>(initialSnapshot);
  const [collectionLoading, setCollectionLoading] = useState(false);

  const [quickRange, setQuickRange] = useState<QuickRange>("current_month");
  const [customRange, setCustomRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });
  const [selectedProperty, setSelectedProperty] = useState<string>("all");
  const [properties] = useState<Property[]>(initialProperties);
  const [exportLoading, setExportLoading] = useState(false);

  const isFreePlan = initialSession?.plan === "FREE";

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
      return { from: startOfYear(now), to: now };
    }
    if (quickRange === "custom" && customRange.from && customRange.to) {
      return { from: customRange.from, to: customRange.to };
    }
    return { from: startOfMonth(now), to: endOfMonth(now) };
  }, [quickRange, customRange]);

  /** Previous period range — only for exact-range quick ranges, not for custom. */
  const previousDateRange = useMemo((): { from: Date; to: Date } | null => {
    if (quickRange === "custom") return null;
    const now = new Date();
    if (quickRange === "current_month") {
      const prev = subMonths(now, 1);
      return { from: startOfMonth(prev), to: endOfMonth(prev) };
    }
    if (quickRange === "prev_month") {
      const prev = subMonths(now, 2);
      return { from: startOfMonth(prev), to: endOfMonth(prev) };
    }
    if (quickRange === "last_3") {
      const rangeEnd = subMonths(now, 1);
      return { from: startOfMonth(subMonths(rangeEnd, 2)), to: endOfMonth(rangeEnd) };
    }
    if (quickRange === "last_6") {
      const rangeEnd = subMonths(now, 1);
      return { from: startOfMonth(subMonths(rangeEnd, 5)), to: endOfMonth(rangeEnd) };
    }
    if (quickRange === "year_to_date") {
      const prevYear = now.getFullYear() - 1;
      return { from: startOfYear(new Date(prevYear, 0, 1)), to: new Date(prevYear, now.getMonth(), now.getDate()) };
    }
    return null;
  }, [quickRange]);

  // ── Fetch 1: resumen del período (decisionSummary + anterior + conteo de exportación) ──
  const fetchSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const propertyId = selectedProperty !== "all" ? selectedProperty : undefined;
      const [decision, decisionPrev, rowCount] = await Promise.all([
        getDecisionSummary({
          rangeStart: effectiveDateRange.from || undefined,
          rangeEnd: effectiveDateRange.to || undefined,
          propertyId,
        }),
        previousDateRange
          ? getDecisionSummary({ rangeStart: previousDateRange.from, rangeEnd: previousDateRange.to, propertyId })
          : Promise.resolve(null),
        getReservationsReportCount({
          propertyId,
          startDate: effectiveDateRange.from || undefined,
          endDate: effectiveDateRange.to || undefined,
        }),
      ]);
      setDecisionSummary(decision);
      setDecisionSummaryPrev(decisionPrev);
      setExportRowCount(rowCount);
    } catch (error) {
      console.error("Error fetching reports summary:", error);
    } finally {
      setSummaryLoading(false);
    }
  }, [effectiveDateRange, previousDateRange, selectedProperty]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetching
    fetchSummary();
  }, [fetchSummary]);

  // ── Fetch 2: agregados de cobranza — foto del PRESENTE, independiente del rango ──
  const fetchCollection = useCallback(async () => {
    setCollectionLoading(true);
    try {
      const result = await getOutstandingSnapshot({
        propertyId: selectedProperty !== "all" ? selectedProperty : undefined,
      });
      setSnapshot(result);
    } catch (error) {
      console.error("Error fetching collection data:", error);
    } finally {
      setCollectionLoading(false);
    }
  }, [selectedProperty]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetching
    fetchCollection();
  }, [fetchCollection]);

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
      entry.totalNights += nightsBetweenDateOnly(r.startDate, r.endDate);
      entry.totalRevenue = (entry.totalRevenue ?? 0) + r.totalPrice;
      if (r.paymentStatus === "COMPLETED") entry.paidRevenue += r.totalPrice;
      else entry.pendingRevenue += r.totalPrice;
    });
    return Array.from(map.values());
  }

  // P1: trend for "Cobrado" KPI vs previous period
  const revenueTrend = useMemo(() => {
    if (!decisionSummary || !previousDateRange) return null;
    if (!decisionSummaryPrev) return null; // first render or no data for prev period
    return computeTrend(decisionSummary.collectedCash, decisionSummaryPrev.collectedCash);
  }, [decisionSummary, decisionSummaryPrev, previousDateRange]);

  const aging = snapshot?.aging ?? EMPTY_AGING;
  const topDebtors = snapshot?.topDebtors ?? [];
  const overdueCount = useMemo(
    () => aging.buckets.filter((b) => b.key !== "DUE_SOON").reduce((sum, b) => sum + b.count, 0),
    [aging],
  );

  const paymentsOverdueHref = useMemo(() => {
    // El destino debe ser EXACTAMENTE lo que el número de "vencidos" promete:
    // cuotas RESERVATION (no EXTRA) con `dueDate` estrictamente anterior a hoy.
    // `dateTo` = el día ANTERIOR a hoy (no hoy), porque `/payments` filtra
    // `dueDate <= dateOnlyEnd(dateTo)` (inclusive) y lo que vence hoy ya cuenta
    // como "vence hoy" (DUE_SOON), no como vencido.
    const params = new URLSearchParams({
      status: "PENDING",
      dateField: "vencimiento",
      dateTo: addDaysToDateKey(nowKeyInBusinessTz(), -1),
      paymentType: "RESERVATION",
    });
    if (selectedProperty !== "all") params.set("propertyId", selectedProperty);
    return `/payments?${params.toString()}`;
  }, [selectedProperty]);

  const handleQuickRangeChange = (value: QuickRange) => {
    if (!isReportsRangeAllowed(initialSession.plan, value)) return;
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

  /**
   * Fix del control muerto: antes, elegir fechas en el calendario no hacía
   * nada salvo que `quickRange` ya fuera "custom" (imposible de alcanzar
   * desde el propio calendario, que es el único lugar que activa "custom").
   * Ahora elegir fechas activa "Personalizado" en el mismo gesto.
   */
  const handleCustomRangeChange = (d: { from: Date | undefined; to: Date | undefined }) => {
    if (!isReportsRangeAllowed(initialSession.plan, "custom")) return;
    setCustomRange(d);
    setQuickRange("custom");
  };

  const runExport = async (kind: "excel" | "pdf") => {
    setExportLoading(true);
    try {
      const reservations = await getReservationsReportForExport({
        propertyId: selectedProperty !== "all" ? selectedProperty : undefined,
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
      const grouped = decisionSummary
        ? computeGroupedByPropertyFromSummary(decisionSummary)
        : computeGroupedByProperty(details);
      const cashByMethod = decisionSummary?.cash.byMethod;
      if (kind === "excel") {
        exportToExcel(details, grouped, effectiveDateRange.from ? effectiveDateRange : null, cashByMethod);
      } else {
        exportToPDF(details, grouped, effectiveDateRange.from ? effectiveDateRange : null, cashByMethod);
      }
    } catch (error) {
      console.error(`Error exporting ${kind}:`, error);
      alert(`Error al exportar ${kind === "excel" ? "Excel" : "PDF"}. Intenta de nuevo.`);
    } finally {
      setExportLoading(false);
    }
  };

  const propertyCount = decisionSummary?.byProperty.length ?? properties.length;
  const periodLabel = effectiveDateRange.from && effectiveDateRange.to
    ? formatPeriodRangeLabel(effectiveDateRange.from, effectiveDateRange.to)
    : "";

  return (
    <div className="space-y-8">
      {/* ─── Encabezado: título, alcance factual, y los controles que gobiernan todo lo visible ─── */}
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold leading-tight">Cierre de período</h1>
          <p className="text-sm text-muted-foreground tabular-nums">
            {periodLabel} · {propertyCount} {propertyCount === 1 ? "propiedad" : "propiedades"}
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <div role="group" aria-label="Rango rápido" className="flex flex-wrap gap-2">
            {QUICK_RANGES.map((range) => {
              const isAllowed = isReportsRangeAllowed(initialSession.plan, range.value);
              const isActive = quickRange === range.value;
              return (
                <Button
                  key={range.value}
                  variant={isActive ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleQuickRangeChange(range.value)}
                  disabled={!isAllowed}
                  aria-pressed={isActive}
                  aria-label={!isAllowed ? `${range.label} — disponible solo en plan PRO` : undefined}
                  className="text-xs"
                >
                  {range.label}
                  {!isAllowed && <span aria-hidden="true" className="ml-1 opacity-70">🔒</span>}
                </Button>
              );
            })}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            {!isFreePlan && (
              <DateRangePicker date={customRange} onDateChange={handleCustomRangeChange} label="Personalizado" />
            )}

            <Select value={selectedProperty} onValueChange={(value) => setSelectedProperty(value || "all")}>
              <SelectTrigger aria-label="Propiedad" className="w-full sm:w-56">
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

          {isFreePlan && (
            <p className="text-xs text-muted-foreground">
              Plan FREE: solo mes actual. Haz upgrade a PRO.
            </p>
          )}
        </div>
      </div>

      {/* ─── Sección 1: Resultado del período ─── */}
      <section aria-labelledby="reports-period-result-heading" className="space-y-4">
        <h2 id="reports-period-result-heading" className="text-xs font-bold text-foreground uppercase tracking-wider">
          Resultado del período
        </h2>

        {/*
          El live-region es un nodo propio y chico, separado del contenedor
          visual: si "role=status" envolviera todo el subárbol, cada cambio
          de contenido (montos, barras) haría que el lector de pantalla
          re-anuncie TODO el texto visible en vez de solo "actualizando".
        */}
        <span role="status" aria-live="polite" className="sr-only">
          {summaryLoading ? "Actualizando resultado del período…" : "Resultado del período actualizado"}
        </span>
        <div className={cn("space-y-6 transition-opacity", summaryLoading && "opacity-60")}>
          <PeriodResultKpis
            collectedCash={decisionSummary?.collectedCash ?? 0}
            accruedRevenue={decisionSummary?.accruedRevenue ?? 0}
            revenueTrend={revenueTrend}
          />

          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="text-primary size-4" aria-hidden="true" />
              <h3 className="text-[10px] font-bold text-foreground uppercase tracking-wider">
                Cobrado por mes
              </h3>
            </div>
            <MonthlyCashChart byMonth={decisionSummary?.cash?.byMonth ?? []} />
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <PieChart className="text-primary size-4" aria-hidden="true" />
              <h3 className="text-[10px] font-bold text-foreground uppercase tracking-wider">
                Reparto diario / mensual
              </h3>
            </div>
            <BillingTypeSplit
              dailyCash={decisionSummary?.byBillingType.DAILY.collectedCash ?? 0}
              monthlyCash={decisionSummary?.byBillingType.MONTHLY.collectedCash ?? 0}
            />
          </div>

          <PropertySummaryTable rows={decisionSummary?.byProperty ?? []} />
        </div>
      </section>

      {/* ─── Sección 2: Dónde está la plata que falta (foto del presente) ─── */}
      <section aria-labelledby="reports-outstanding-heading" className="space-y-3">
        <div>
          <h2 id="reports-outstanding-heading" className="text-xs font-bold text-foreground uppercase tracking-wider">
            Dónde está la plata que falta
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Foto del presente — no cambia con el rango de fechas de arriba. Muestra la deuda activa hoy.
          </p>
        </div>

        <span role="status" aria-live="polite" className="sr-only">
          {collectionLoading ? "Actualizando deuda activa…" : "Deuda activa actualizada"}
        </span>
        <div className={cn("grid grid-cols-1 lg:grid-cols-2 gap-4 transition-opacity", collectionLoading && "opacity-60")}>
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="size-4 text-warning-text" aria-hidden="true" />
              <h3 className="text-[10px] font-bold text-foreground uppercase tracking-wider">
                Antigüedad de la deuda
              </h3>
            </div>
            <AgingBucketsPanel buckets={aging.buckets} />
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="size-4 text-destructive-text" aria-hidden="true" />
              <h3 className="text-[10px] font-bold text-foreground uppercase tracking-wider">
                Top deudores
              </h3>
            </div>
            <TopClientDebtorsList debtors={topDebtors} />
          </div>
        </div>

        <div>
          {overdueCount > 0 ? (
            <Link href={paymentsOverdueHref} className="text-xs font-bold text-primary hover:underline">
              Ver los {overdueCount} {overdueCount === 1 ? "cobro vencido" : "cobros vencidos"} en Pagos
            </Link>
          ) : (
            <p className="text-xs text-muted-foreground">Sin cobros vencidos.</p>
          )}
        </div>
      </section>

      {/* ─── Sección 3: Llevarse el período ─── */}
      <section aria-labelledby="reports-export-heading" className="space-y-3">
        <h2 id="reports-export-heading" className="text-xs font-bold text-foreground uppercase tracking-wider">
          Llevarse el período
        </h2>
        <div className="rounded-lg border border-border bg-card p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <p className="text-xs text-muted-foreground flex-1">
            {exportRowCount === null
              ? "Calculando cuántas reservas incluye el período…"
              : `${exportRowCount} ${exportRowCount === 1 ? "reserva" : "reservas"} del período seleccionado.`}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => runExport("excel")} disabled={exportLoading || exportRowCount === 0}>
              <FileSpreadsheet className="size-4 mr-1" aria-hidden="true" />
              Excel{exportRowCount !== null ? ` (${exportRowCount})` : ""}
            </Button>
            <Button size="sm" onClick={() => runExport("pdf")} disabled={exportLoading || exportRowCount === 0}>
              <Download className="size-4 mr-1" aria-hidden="true" />
              PDF{exportRowCount !== null ? ` (${exportRowCount})` : ""}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
