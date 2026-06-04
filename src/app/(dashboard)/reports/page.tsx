"use client";

import { useState, useEffect, useMemo } from "react";
import { BarChart3, TrendingUp, Building2, Users, Calendar, DollarSign, Download, FileSpreadsheet, FileText } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { getDashboardStats, getRevenueReport, getOccupancyReport, getYearlySummary, getReservationsReport, getCollectionReport } from "@/lib/actions/reports";
import type { DashboardStats, RevenueReport, OccupancyReport } from "@/lib/actions/reports";
import type { CollectionReportRow } from "@/lib/actions/reports-collection";
import { Pagination } from "@/components/ui/pagination";
import type { PaginatedResponse } from "@/types/pagination";
import { getProperties } from "@/lib/actions/properties";
import { exportToExcel, exportToPDF, type ReservationDetail, type PropertySummary } from "@/lib/export-utils";
import { startOfMonth, endOfMonth, subMonths, format } from "date-fns";
import { es } from "date-fns/locale/es";

type QuickRange = "current_month" | "prev_month" | "last_3" | "last_6" | "all" | "custom";

const QUICK_RANGES: { value: QuickRange; label: string }[] = [
  { value: "current_month", label: "Mes actual" },
  { value: "prev_month", label: "Mes anterior" },
  { value: "last_3", label: "Últimos 3 meses" },
  { value: "last_6", label: "Últimos 6 meses" },
  { value: "all", label: "Todos" },
  { value: "custom", label: "Personalizado" },
];

interface Property { id: string; name: string; }
interface SessionInfo { plan: string | null; }

export default function ReportsPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [revenueData, setRevenueData] = useState<RevenueReport[]>([]);
  const [occupancyData, setOccupancyData] = useState<OccupancyReport[]>([]);
  const [yearlySummary, setYearlySummary] = useState<any>(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [loading, setLoading] = useState(true);
  const [quickRange, setQuickRange] = useState<QuickRange>("current_month");
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const [customRange, setCustomRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });
  const [selectedProperty, setSelectedProperty] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [properties, setProperties] = useState<Property[]>([]);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [reservationDetails, setReservationDetails] = useState<ReservationDetail[]>([]);
  const [exportLoading, setExportLoading] = useState(false);
  const [collectionRows, setCollectionRows] = useState<CollectionReportRow[]>([]);
  const [collectionBillingType, setCollectionBillingType] = useState<"GENERAL" | "DAILY" | "MONTHLY">("GENERAL");
  const [collectionClientId, setCollectionClientId] = useState<string>("all");
  const [collectionDebtStatus, setCollectionDebtStatus] = useState<"ACTIVE" | "ALL" | "OVERDUE" | "UPCOMING" | "PAID">("ACTIVE");
  const [collectionDueRange, setCollectionDueRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });
  const [collectionPage, setCollectionPage] = useState(1);
  const [collectionTotal, setCollectionTotal] = useState(0);
  const [collectionTotalPages, setCollectionTotalPages] = useState(0);
  const [collectionLimit, setCollectionLimit] = useState(10);

  useEffect(() => {
    const loadInitial = async () => {
      const [props, sessionData] = await Promise.all([
        getProperties(),
        (await import("@/lib/actions/auth")).getSession(),
      ]);
      setProperties(props);
      setSession(sessionData);
    };
    loadInitial();
  }, []);

  useEffect(() => {
    fetchData();
  }, [selectedYear, quickRange, dateRange, selectedProperty, selectedStatus, collectionBillingType, collectionClientId, collectionDebtStatus, collectionDueRange, collectionPage]);

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
    if (quickRange === "all") {
      return { from: undefined, to: undefined };
    }
    if (quickRange === "custom" && customRange.from && customRange.to) {
      return { from: customRange.from, to: customRange.to };
    }
    return { from: startOfMonth(now), to: endOfMonth(now) };
  }, [quickRange, customRange]);

  useEffect(() => {
    if (quickRange !== "custom") return;
    if (!customRange.from || !customRange.to) return;
    setDateRange({ from: customRange.from, to: customRange.to });
  }, [customRange, quickRange]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsData, revenue, occupancy, yearly, reservations, collection] = await Promise.all([
        getDashboardStats(),
        getRevenueReport({
          months: effectiveDateRange.from ? undefined : 12,
          year: effectiveDateRange.from ? undefined : parseInt(selectedYear),
          startDate: effectiveDateRange.from || undefined,
          endDate: effectiveDateRange.to || undefined,
        }),
        getOccupancyReport({
          propertyId: selectedProperty !== "all" ? selectedProperty : undefined,
          startDate: effectiveDateRange.from || undefined,
          endDate: effectiveDateRange.to || undefined,
        }),
        getYearlySummary(effectiveDateRange.from ? undefined : parseInt(selectedYear)),
        getReservationsReport({
          propertyId: selectedProperty !== "all" ? selectedProperty : undefined,
          status: selectedStatus !== "all" ? selectedStatus : undefined,
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
      ]);

      setStats(statsData);
      setRevenueData(revenue || []);
      setOccupancyData(occupancy || []);
      setYearlySummary(yearly);
      setReservationDetails((reservations || []).map((r: any) => ({
        id: r.id,
        propertyName: r.propertyName,
        clientName: r.clientName,
        clientEmail: r.clientEmail,
        startDate: new Date(r.startDate),
        endDate: new Date(r.endDate),
        totalPrice: Number(r.totalPrice),
        status: r.status,
        paymentStatus: r.paymentStatus,
        createdAt: new Date(r.createdAt),
      })));
      if (collection && "data" in collection) {
        setCollectionRows(collection.data);
        setCollectionTotal(collection.total);
        setCollectionTotalPages(collection.totalPages);
      } else {
        setCollectionRows(collection || []);
      }
    } catch (error) {
      console.error("Error fetching reports:", error);
    } finally {
      setLoading(false);
    }
  };

  const maxRevenue = Math.max(...revenueData.map((r) => r.totalRevenue), 1);

  const groupedByProperty = useMemo(() => {
    const map = new Map<string, PropertySummary>();
    reservationDetails.forEach((r) => {
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
  }, [reservationDetails]);

  const isFreePlan = session?.plan === "FREE";

  const collectionClients = useMemo(() => {
    const map = new Map<string, string>();
    collectionRows.forEach((row) => map.set(row.clientId, row.clientName));
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [collectionRows]);

  const handleQuickRangeChange = (value: QuickRange) => {
    if (isFreePlan && value !== "current_month") {
      return;
    }
    setQuickRange(value);
    if (value === "custom") return;
    const now = new Date();
    if (value === "current_month") {
      setDateRange({ from: startOfMonth(now), to: endOfMonth(now) });
    } else if (value === "prev_month") {
      const prev = subMonths(now, 1);
      setDateRange({ from: startOfMonth(prev), to: endOfMonth(prev) });
    } else if (value === "last_3") {
      setDateRange({ from: startOfMonth(subMonths(now, 2)), to: endOfMonth(now) });
    } else if (value === "last_6") {
      setDateRange({ from: startOfMonth(subMonths(now, 5)), to: endOfMonth(now) });
    } else {
      setDateRange({ from: undefined, to: undefined });
    }
  };

  const handleExcelExport = async () => {
    setExportLoading(true);
    try {
      exportToExcel(reservationDetails, groupedByProperty, effectiveDateRange.from ? effectiveDateRange : null);
    } finally {
      setExportLoading(false);
    }
  };

  const handlePDFExport = async () => {
    setExportLoading(true);
    try {
      exportToPDF(reservationDetails, groupedByProperty, effectiveDateRange.from ? effectiveDateRange : null);
    } finally {
      setExportLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Reportes</h1>
            <p className="text-sm text-muted-foreground">
              Estadísticas y análisis de tu negocio
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExcelExport} disabled={exportLoading || reservationDetails.length === 0}>
            <FileSpreadsheet className="size-4 mr-1" />
            Excel
          </Button>
          <Button variant="outline" size="sm" onClick={handlePDFExport} disabled={exportLoading || reservationDetails.length === 0}>
            <FileText className="size-4 mr-1" />
            PDF
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
                    disabled={isFreePlan && range.value !== "current_month" && range.value !== "custom"}
                    className="text-xs"
                  >
                    {range.label}
                    {isFreePlan && range.value !== "current_month" && range.value !== "custom" && (
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
              <label className="text-xs text-muted-foreground">Estado reserva</label>
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
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground">Año</label>
              <Select value={selectedYear} onValueChange={(v) => setSelectedYear(v || new Date().getFullYear().toString())}>
                <SelectTrigger className="w-full sm:w-32">
                  <SelectValue placeholder="Año" />
                </SelectTrigger>
                <SelectContent>
                  {[2024, 2025, 2026].map((year) => (
                    <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
              </div>
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
            </CardContent>
      </Card>

      {loading ? (
        <div className="flex h-96 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Propiedades</CardTitle>
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.totalProperties || 0}</div>
                <p className="text-xs text-muted-foreground">registradas</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Clientes</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.totalClients || 0}</div>
                <p className="text-xs text-muted-foreground">registrados</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Reservas Activas</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.activeReservations || 0}</div>
                <p className="text-xs text-muted-foreground">en curso</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Ingresos del Mes</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {Number(stats?.monthlyRevenue || 0).toLocaleString("CLP")}
                </div>
                <p className="text-xs text-muted-foreground">este mes</p>
              </CardContent>
            </Card>
          </div>

          {groupedByProperty.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Resumen por Propiedad
                </CardTitle>
                <CardDescription>
                  Subtotales de ingresos, reservas y noches
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {groupedByProperty.map((item) => (
                    <div key={item.propertyName} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div>
                        <p className="font-medium">{item.propertyName}</p>
                        <p className="text-sm text-muted-foreground">
                          {item.totalReservations} reservas · {item.totalNights} noches
                        </p>
                      </div>
                      <div className="text-right space-y-1">
                        <p className="font-medium text-primary">
                          {item.totalRevenue.toLocaleString("CLP")}
                        </p>
                        <div className="flex gap-4 text-xs text-muted-foreground">
                          <span>Pagado: {item.paidRevenue.toLocaleString("CLP")}</span>
                          <span>Pendiente: {item.pendingRevenue.toLocaleString("CLP")}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center justify-between p-3 bg-primary/10 rounded-lg font-semibold border-2 border-primary/20">
                    <span>TOTAL</span>
                    <div className="text-right">
                      <p className="text-primary">
                        {groupedByProperty.reduce((acc, s) => acc + s.totalRevenue, 0).toLocaleString("CLP")}
                      </p>
                      <p className="text-xs text-muted-foreground font-normal">
                        {groupedByProperty.reduce((acc, s) => acc + s.totalReservations, 0)} reservas ·{" "}
                        {groupedByProperty.reduce((acc, s) => acc + s.totalNights, 0)} noches
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Ingresos por Mes
                </CardTitle>
                <CardDescription>
                  Evolución de ingresos {effectiveDateRange.from ? `(${format(effectiveDateRange.from, "PP", { locale: es })} - ${format(effectiveDateRange.to!, "PP", { locale: es })})` : "últimos 12 meses"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {revenueData.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Sin datos</p>
                ) : (
                  <div className="space-y-3">
                    {revenueData.map((item, index) => (
                      <div key={index} className="flex items-center gap-3">
                        <span className="w-20 text-sm text-muted-foreground">{item.month}</span>
                        <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${(item.totalRevenue / maxRevenue) * 100}%` }}
                          />
                        </div>
                        <span className="w-28 text-right text-sm font-medium">
                          {item.totalRevenue.toLocaleString("CLP")}
                        </span>
                        <Badge variant="secondary" className="w-16 text-center">
                          {item.reservationCount}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

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

          <Card>
            <CardHeader>
              <CardTitle>Reporte de Cobranza</CardTitle>
              <CardDescription>
                Deuda activa por reserva con arriendo y extras separados
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
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

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="py-2 pr-3">Propiedad</th>
                      <th className="py-2 pr-3">Cliente</th>
                      <th className="py-2 pr-3">Tipo</th>
                      <th className="py-2 pr-3">Estado reserva</th>
                      <th className="py-2 pr-3">Total arriendo</th>
                      <th className="py-2 pr-3">Pagado</th>
                      <th className="py-2 pr-3">Pendiente</th>
                      <th className="py-2 pr-3">Vencido</th>
                      <th className="py-2 pr-3">Próx. vencimiento</th>
                      <th className="py-2 pr-3">Extras pagados</th>
                      <th className="py-2 pr-3">Extras pendientes</th>
                      <th className="py-2 pr-3">Total por cobrar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {collectionRows.length === 0 ? (
                      <tr>
                        <td className="py-6 text-center text-muted-foreground" colSpan={12}>
                          Sin reservas para los filtros seleccionados
                        </td>
                      </tr>
                    ) : (
                      collectionRows.map((row) => (
                        <tr key={row.reservationId} className="border-b last:border-0">
                          <td className="py-2 pr-3">{row.propertyName}</td>
                          <td className="py-2 pr-3">{row.clientName}</td>
                          <td className="py-2 pr-3">{row.billingType === "DAILY" ? "Diario" : "Mensual"}</td>
                          <td className="py-2 pr-3">{row.reservationStatus}</td>
                          <td className="py-2 pr-3">{row.totalRent.toLocaleString("CLP")}</td>
                          <td className="py-2 pr-3">{row.paid.toLocaleString("CLP")}</td>
                          <td className="py-2 pr-3">{row.pending.toLocaleString("CLP")}</td>
                          <td className="py-2 pr-3">{row.overdue.toLocaleString("CLP")}</td>
                          <td className="py-2 pr-3">{row.nextDueDate ? format(row.nextDueDate, "dd-MM-yyyy") : "-"}</td>
                          <td className="py-2 pr-3">{row.extrasPaid.toLocaleString("CLP")}</td>
                          <td className="py-2 pr-3">{row.extrasPending.toLocaleString("CLP")}</td>
                          <td className="py-2 pr-3 font-medium">{row.totalToCollect.toLocaleString("CLP")}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {yearlySummary && (
            <Card>
              <CardHeader>
                <CardTitle>Resumen Anual {selectedYear}</CardTitle>
                <CardDescription>
                  Total de {yearlySummary.totalPayments} pagos registrados
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6 grid-cols-1 sm:grid-cols-3">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-primary">
                      {yearlySummary.totalRevenue.toLocaleString("CLP")}
                    </p>
                    <p className="text-sm text-muted-foreground">ingresos totales</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-2">Por método de pago</p>
                    <div className="space-y-1">
                      {Object.entries(yearlySummary.byMethod).map(([method, amount]) => (
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
                      {yearlySummary.byMonth.map((amount: number, index: number) => (
                        <div
                          key={index}
                          className="flex-1 bg-primary rounded-t"
                          style={{
                            height: `${maxRevenue > 0 ? (amount / maxRevenue) * 100 : 0}%`,
                            minHeight: amount > 0 ? "4px" : "0",
                          }}
                          title={`${["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"][index]}: ${amount.toLocaleString("CLP")}`}
                        />
                      ))}
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
