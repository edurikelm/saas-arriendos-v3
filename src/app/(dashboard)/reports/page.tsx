"use client";

import { useState, useEffect } from "react";
import { BarChart3, TrendingUp, Building2, Users, Calendar, DollarSign } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { getDashboardStats, getRevenueReport, getOccupancyReport, getYearlySummary } from "@/lib/actions/reports";
import type { DashboardStats, RevenueReport, OccupancyReport } from "@/lib/actions/reports";

export default function ReportsPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [revenueData, setRevenueData] = useState<RevenueReport[]>([]);
  const [occupancyData, setOccupancyData] = useState<OccupancyReport[]>([]);
  const [yearlySummary, setYearlySummary] = useState<any>(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [selectedYear]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsData, revenue, occupancy, yearly] = await Promise.all([
        getDashboardStats(),
        getRevenueReport({ months: 12, year: parseInt(selectedYear) }),
        getOccupancyReport(),
        getYearlySummary(parseInt(selectedYear)),
      ]);

      setStats(statsData);
      setRevenueData(revenue);
      setOccupancyData(occupancy);
      setYearlySummary(yearly);
    } catch (error) {
      console.error("Error fetching reports:", error);
    } finally {
      setLoading(false);
    }
  };

  const maxRevenue = Math.max(...revenueData.map((r) => r.totalRevenue), 1);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Reportes</h1>
            <p className="text-sm text-muted-foreground">
              Estadísticas y análisis de tu negocio
            </p>
          </div>
        </div>
        <Select value={selectedYear} onValueChange={(v) => setSelectedYear(v || new Date().getFullYear().toString())}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Año" />
          </SelectTrigger>
          <SelectContent>
            {[2024, 2025, 2026].map((year) => (
              <SelectItem key={year} value={year.toString()}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex h-96 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Ingresos por Mes
                </CardTitle>
                <CardDescription>
                  Evolución de ingresos en los últimos 12 meses
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {revenueData.map((item, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <span className="w-16 text-sm text-muted-foreground">{item.month}</span>
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

          {yearlySummary && (
            <Card>
              <CardHeader>
                <CardTitle>Resumen Anual {selectedYear}</CardTitle>
                <CardDescription>
                  Total de {yearlySummary.totalPayments} pagos registrados
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6 md:grid-cols-3">
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