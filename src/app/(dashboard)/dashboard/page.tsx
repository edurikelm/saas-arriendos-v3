/**
 * PROTOTYPE — Dashboard UI variants for /dashboard
 * Question: "¿Qué debería mostrar el dashboard principal?"
 * Three structurally different layouts, switchable via ?variant=
 *
 * Variants:
 * - A: "Stitch Design" — Basado en diseño de Stitch: KPIs + tabla reservas + actividad + cards promo
 * - B: "Stats First" — Métricas principales arriba, mini-listas debajo
 * - C: "Compact List" — Lista compacta con más información por fila
 */

import { Suspense } from "react";
import { getReservations } from "@/lib/actions/reservations";
import { getProperties } from "@/lib/actions/properties";
import { getClients } from "@/lib/actions/clients";
import { DashboardPrototypeSwitcher } from "@/components/dashboard/dashboard-prototype-switcher";
import { MoreHorizontal, TrendingUp, TrendingDown, CheckCircle2, Clock, XCircle, AlertCircle } from "lucide-react";

interface Property {
  id: string;
  name: string;
  unitsAvailable: number;
  dailyPrice: string;
  monthlyPrice: string | null;
  mainImage: string | null;
  color: string;
}

interface Client {
  id: string;
  name: string;
  email: string;
  phone: string | null;
}

interface Payment {
  id: string;
  amount: string;
  status: string;
  method: string;
  paidAt: string | null;
  deletedAt: string | null;
}

interface Reservation {
  id: string;
  propertyId: string;
  clientId: string;
  startDate: string;
  endDate: string;
  billingType: string;
  unitsBooked: number;
  totalPrice: string;
  status: string;
  notes: string | null;
  createdAt: string;
  property: Property;
  client: Client;
  payments: Payment[];
}

function getNights(startDate: string, endDate: string): number {
  const diff = new Date(endDate).getTime() - new Date(startDate).getTime();
  return Math.round(diff / (1000 * 60 * 60 * 24)) + 1;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("es-CL", {
    day: "numeric",
    month: "short",
  });
}

function formatFullDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("es-CL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatCLP(amount: number): string {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function getPaidAmount(payments: Payment[]): number {
  return payments
    .filter((p) => p.status === "COMPLETED" && !p.deletedAt)
    .reduce((sum, p) => sum + Number(p.amount), 0);
}

function getStatusBadge(
  status: string
): { label: string; variant: "default" | "secondary" | "destructive" | "outline"; color: string; bg: string; icon?: string } {
  const badges: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; color: string; bg: string; icon?: string }> = {
    PENDING: { label: "Pendiente", variant: "secondary", color: "text-amber-700 dark:text-amber-300", bg: "bg-amber-50 dark:bg-amber-950/30", icon: "⏳" },
    CONFIRMED: { label: "Confirmada", variant: "default", color: "text-emerald-700 dark:text-emerald-300", bg: "bg-emerald-50 dark:bg-emerald-950/30", icon: "✓" },
    CANCELLED: { label: "Cancelada", variant: "destructive", color: "text-red-700 dark:text-red-300", bg: "bg-red-50 dark:bg-red-950/30", icon: "✕" },
    COMPLETED: { label: "Completada", variant: "outline", color: "text-slate-700 dark:text-slate-300", bg: "bg-slate-100 dark:bg-slate-800", icon: "✓✓" },
  };
  return badges[status] || { label: status, variant: "outline", color: "text-slate-700 dark:text-slate-300", bg: "bg-slate-100 dark:bg-slate-800" };
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function timeAgo(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 60) return `Hace ${diffMins} min`;
  if (diffHours < 24) return `Hace ${diffHours}h`;
  if (diffDays < 7) return `Hace ${diffDays}d`;
  return formatDate(dateString);
}

// === VARIANT A: Stitch Design ===
function VariantA({
  reservations,
  properties,
}: {
  reservations: Reservation[];
  properties: Property[];
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const activeReservations = reservations.filter((r) => {
    const start = new Date(r.startDate);
    const end = new Date(r.endDate);
    return start <= today && end >= today && r.status !== "CANCELLED";
  });

  const upcomingReservations = reservations
    .filter((r) => {
      const start = new Date(r.startDate);
      return start > today && r.status !== "CANCELLED";
    })
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

  const next7Days = upcomingReservations.filter((r) => {
    const start = new Date(r.startDate);
    const diffDays = Math.ceil((start.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays <= 7;
  });

  const totalRevenue = reservations
    .filter((r) => r.payments.some((p) => p.status === "COMPLETED" && !p.deletedAt))
    .reduce((sum, r) => sum + getPaidAmount(r.payments), 0);

  const thisWeekCheckins = next7Days.length;

  const totalUnits = properties.reduce((sum, p) => sum + p.unitsAvailable, 0);
  const occupiedUnits = activeReservations.reduce((sum, r) => sum + r.unitsBooked, 0);
  const occupancyRate = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;

  // Recent activity simulation (sorted by createdAt)
  const recentActivity = [...reservations]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5)
    .map((r) => {
      const hasPayment = r.payments.some((p) => p.status === "COMPLETED");
      return {
        id: r.id,
        type: hasPayment ? "payment" : "reservation",
        description: hasPayment
          ? `Pago recibido de ${r.client.name}`
          : `Nueva reserva: ${r.property.name}`,
        timestamp: r.createdAt,
        property: r.property.name,
        client: r.client.name,
      };
    });

  // Featured property (first with image)
  const featuredProperty = properties.find((p) => p.mainImage) || properties[0];

  return (
    <div className="space-y-6">
      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Reservations */}
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow dark:bg-card">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Reservas Activas</p>
              <p className="text-3xl font-bold mt-2 text-foreground">{activeReservations.length}</p>
              <div className="flex items-center gap-1 mt-3">
                <TrendingUp className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">+2 esta semana</span>
              </div>
            </div>
            <div className="h-12 w-12 rounded-lg bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </div>

        {/* Upcoming Check-ins */}
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Próximos Check-ins</p>
              <p className="text-3xl font-bold mt-2 text-foreground">{thisWeekCheckins}</p>
              <p className="text-xs text-muted-foreground mt-3">Próximos 7 días</p>
            </div>
            <div className="h-12 w-12 rounded-lg bg-purple-50 dark:bg-purple-950/30 flex items-center justify-center flex-shrink-0">
              <Clock className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
        </div>

        {/* Occupancy Rate */}
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Ocupación</p>
              <p className="text-3xl font-bold mt-2 text-foreground">{occupancyRate}%</p>
              <div className="mt-3 space-y-2">
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-500 rounded-full transition-all"
                    style={{ width: `${occupancyRate}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">{occupiedUnits} de {totalUnits} unidades</p>
              </div>
            </div>
          </div>
        </div>

        {/* Monthly Income - Highlighted */}
        <div className="bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--primary)_/_0.8)] rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow text-primary-foreground border border-primary/20">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-xs font-medium opacity-90 uppercase tracking-wide">Ingresos del Mes</p>
              <p className="text-2xl font-bold mt-2">{formatCLP(totalRevenue)}</p>
              <div className="flex items-center gap-1 mt-3">
                <TrendingUp className="h-3 w-3" />
                <span className="text-xs font-medium">+15% vs mes anterior</span>
              </div>
            </div>
            <div className="h-12 w-12 rounded-lg bg-white/15 flex items-center justify-center flex-shrink-0">
              <TrendingUp className="h-6 w-6" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Column - Upcoming Reservations Table (spans 2 columns) */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b bg-muted/40 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Próximas Reservas</h3>
            <span className="text-xs text-muted-foreground font-medium">{upcomingReservations.length} reservas</span>
          </div>
          <div className="divide-y">
            {upcomingReservations.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">
                No hay reservas próximas
              </div>
            ) : (
              upcomingReservations.slice(0, 5).map((res) => {
                const status = getStatusBadge(res.status);
                const daysUntil = Math.ceil(
                  (new Date(res.startDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
                );
                return (
                  <div key={res.id} className="px-4 py-3 flex items-center gap-3 hover:bg-muted/30 transition-colors">
                    {/* Avatar */}
                    <div
                      className="h-9 w-9 rounded-lg flex items-center justify-center text-white font-semibold text-xs flex-shrink-0"
                      style={{ backgroundColor: res.property.color }}
                    >
                      {getInitials(res.client.name)}
                    </div>

                    {/* Client & Property Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{res.client.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{res.property.name}</p>
                    </div>

                    {/* Check-in Date */}
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-medium text-foreground">{formatDate(res.startDate)}</p>
                      <p className="text-xs text-muted-foreground">{getNights(res.startDate, res.endDate)} noches</p>
                    </div>

                    {/* Status Badge */}
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium flex-shrink-0 ${status.bg} ${status.color}`}>
                      {status.icon && <span>{status.icon}</span>}
                      {status.label}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column - Activity Feed + Featured Property */}
        <div className="space-y-6">
          {/* Recent Activity Feed */}
          <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b bg-muted/40">
              <h3 className="text-sm font-semibold text-foreground">Actividad Reciente</h3>
            </div>
            <div className="p-3 space-y-3">
              {recentActivity.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground text-xs">
                  Sin actividad reciente
                </div>
              ) : (
                recentActivity.map((activity, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      activity.type === "payment" ? "bg-emerald-50 dark:bg-emerald-950/30" : "bg-blue-50 dark:bg-blue-950/30"
                    }`}>
                      {activity.type === "payment" ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-foreground truncate font-medium">{activity.description}</p>
                      <p className="text-xs text-muted-foreground">{timeAgo(activity.timestamp)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Featured Property Card */}
          {featuredProperty && (
            <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
              {featuredProperty.mainImage && (
                <div className="h-28 bg-muted overflow-hidden">
                  <img
                    src={featuredProperty.mainImage}
                    alt={featuredProperty.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div className="p-4">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">Destacada</p>
                <h4 className="text-sm font-semibold text-foreground">{featuredProperty.name}</h4>
                <p className="text-xs text-muted-foreground mt-2">
                  {featuredProperty.unitsAvailable} unidades disponibles
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Row - Promo & Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Quick Links & Promo */}
        <div className="bg-gradient-to-br from-[hsl(var(--primary)_/_0.95)] to-[hsl(var(--primary)_/_0.85)] dark:from-[hsl(var(--primary))] dark:to-[hsl(var(--primary)_/_0.9)] rounded-xl p-6 text-primary-foreground border border-primary/30 shadow-sm">
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold text-base">Optimiza tu gestión</h4>
              <p className="text-sm opacity-90 mt-1">
                Accede a herramientas avanzadas para maximizar tus ingresos
              </p>
            </div>
            <button className="w-full px-4 py-2 bg-white dark:bg-slate-900 text-primary dark:text-primary rounded-lg text-sm font-medium hover:bg-primary-foreground/90 transition-colors">
              Explorar Herramientas
            </button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="bg-card border border-border rounded-xl shadow-sm p-6">
          <h4 className="text-sm font-semibold text-foreground mb-4">Resumen Rápido</h4>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground font-medium">Propiedades</span>
              <span className="text-base font-semibold text-foreground">{properties.length}</span>
            </div>
            <div className="h-px bg-border" />
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground font-medium">Clientes Únicos</span>
              <span className="text-base font-semibold text-foreground">{new Set(reservations.map(r => r.clientId)).size}</span>
            </div>
            <div className="h-px bg-border" />
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground font-medium">Por Cobrar</span>
              <span className="text-base font-semibold text-amber-600 dark:text-amber-400">
                {formatCLP(
                  reservations
                    .filter((r) => r.status !== "CANCELLED")
                    .reduce((sum, r) => sum + (Number(r.totalPrice) - getPaidAmount(r.payments)), 0)
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Support Card */}
        <div className="bg-card border border-border rounded-xl shadow-sm p-6">
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-semibold text-foreground">¿Necesitas Ayuda?</h4>
              <p className="text-xs text-muted-foreground mt-1">
                Nuestro equipo está disponible para ti
              </p>
            </div>
            <button className="w-full px-4 py-2 border border-border text-foreground text-sm font-medium rounded-lg hover:bg-muted transition-colors">
              Contactar Soporte
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// === VARIANT B: Stats First ===
function VariantB({
  reservations,
  properties,
}: {
  reservations: Reservation[];
  properties: Property[];
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const activeReservations = reservations.filter((r) => {
    const start = new Date(r.startDate);
    const end = new Date(r.endDate);
    return start <= today && end >= today && r.status !== "CANCELLED";
  });

  const upcomingReservations = reservations
    .filter((r) => {
      const start = new Date(r.startDate);
      return start > today && r.status !== "CANCELLED";
    })
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

  const totalRevenue = reservations.reduce((sum, r) => {
    return sum + r.payments.filter((p) => p.status === "COMPLETED" && !p.deletedAt).reduce((s, p) => s + Number(p.amount), 0);
  }, 0);

  const pendingRevenue = reservations.reduce((sum, r) => {
    const paid = r.payments.filter((p) => p.status === "COMPLETED" && !p.deletedAt).reduce((s, p) => s + Number(p.amount), 0);
    return sum + (Number(r.totalPrice) - paid);
  }, 0);

  return (
    <div className="space-y-8">
      {/* Big Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="col-span-2 lg:col-span-1 rounded-2xl bg-gradient-to-br from-primary to-primary/60 p-6 text-primary-foreground">
          <p className="text-sm opacity-80">Ingresos Totales</p>
          <p className="text-3xl font-bold mt-1">{formatCLP(totalRevenue)}</p>
          <p className="text-sm opacity-80 mt-2">{reservations.length} arriendos</p>
        </div>
        <div className="col-span-1 rounded-2xl bg-green-500/10 p-6">
          <p className="text-sm text-muted-foreground">Activos Ahora</p>
          <p className="text-3xl font-bold text-green-600">{activeReservations.length}</p>
          <div className="mt-2 space-y-1">
            {activeReservations.slice(0, 2).map((r) => (
              <p key={r.id} className="text-xs truncate">{r.property.name} - {r.client.name}</p>
            ))}
            {activeReservations.length > 2 && (
              <p className="text-xs text-muted-foreground">+{activeReservations.length - 2} más</p>
            )}
          </div>
        </div>
        <div className="col-span-1 rounded-2xl bg-blue-500/10 p-6">
          <p className="text-sm text-muted-foreground">Por Cobrar</p>
          <p className="text-3xl font-bold text-blue-600">{formatCLP(pendingRevenue)}</p>
          <p className="text-xs text-muted-foreground mt-2">
            {reservations.filter((r) => {
              const paid = getPaidAmount(r.payments);
              return paid < Number(r.totalPrice) && r.status !== "CANCELLED";
            }).length} arriendos con saldo
          </p>
        </div>
        <div className="col-span-2 lg:col-span-1 rounded-2xl bg-orange-500/10 p-6">
          <p className="text-sm text-muted-foreground">Propiedades</p>
          <p className="text-3xl font-bold text-orange-600">{properties.length}</p>
          <p className="text-xs text-muted-foreground mt-2">
            {properties.reduce((sum, p) => sum + p.unitsAvailable, 0)} unidades disponibles
          </p>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Active Section */}
        <div className="rounded-xl border bg-card">
          <div className="border-b px-4 py-3 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-green-500" />
            <h3 className="font-semibold">Arriendos Activos</h3>
            <span className="ml-auto text-sm text-muted-foreground">{activeReservations.length}</span>
          </div>
          <div className="divide-y">
            {activeReservations.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">Sin arriendos activos</div>
            ) : (
              activeReservations.map((res) => {
                const paid = getPaidAmount(res.payments);
                const pending = Number(res.totalPrice) - paid;
                return (
                  <div key={res.id} className="p-4 flex items-center gap-4">
                    <div
                      className="h-10 w-10 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                      style={{ backgroundColor: res.property.color }}
                    >
                      {res.property.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{res.property.name}</p>
                      <p className="text-sm text-muted-foreground truncate">{res.client.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{formatDate(res.endDate)}</p>
                      <p className="text-xs text-muted-foreground">
                        {getNights(res.startDate, res.endDate)} noches
                      </p>
                    </div>
                    {pending > 0 && (
                      <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full">
                        {formatCLP(pending)}
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Upcoming Section */}
        <div className="rounded-xl border bg-card">
          <div className="border-b px-4 py-3 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-blue-500" />
            <h3 className="font-semibold">Próximos Arriendos</h3>
            <span className="ml-auto text-sm text-muted-foreground">{upcomingReservations.length}</span>
          </div>
          <div className="divide-y">
            {upcomingReservations.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">Sin arriendos próximos</div>
            ) : (
              upcomingReservations.slice(0, 5).map((res) => {
                const daysUntil = Math.ceil(
                  (new Date(res.startDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
                );
                return (
                  <div key={res.id} className="p-4 flex items-center gap-4">
                    <div
                      className="h-10 w-10 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                      style={{ backgroundColor: res.property.color }}
                    >
                      {res.property.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{res.property.name}</p>
                      <p className="text-sm text-muted-foreground truncate">{res.client.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{formatDate(res.startDate)}</p>
                      <p className="text-xs text-blue-600 font-medium">
                        {daysUntil <= 7 ? `En ${daysUntil}d` : formatDate(res.startDate)}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// === VARIANT D: Modern Stitch Style ===
function VariantD({
  reservations,
  properties,
}: {
  reservations: Reservation[];
  properties: Property[];
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const activeReservations = reservations.filter((r) => {
    const start = new Date(r.startDate);
    const end = new Date(r.endDate);
    return start <= today && end >= today && r.status !== "CANCELLED";
  });

  const upcomingReservations = reservations
    .filter((r) => {
      const start = new Date(r.startDate);
      return start > today && r.status !== "CANCELLED";
    })
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

  const recentPayments = reservations
    .flatMap((r) =>
      r.payments
        .filter((p) => p.status === "COMPLETED" && !p.deletedAt)
        .map((p) => ({ ...p, reservation: r }))
    )
    .sort((a, b) => new Date(b.paidAt || "").getTime() - new Date(a.paidAt || "").getTime())
    .slice(0, 4);

  const pendingPayments = reservations
    .flatMap((r) => {
      const paid = getPaidAmount(r.payments);
      const pending = Number(r.totalPrice) - paid;
      if (pending > 0) {
        return { reservation: r, pending };
      }
      return [];
    })
    .slice(0, 5);

  const totalUnits = properties.reduce((sum, p) => sum + p.unitsAvailable, 0);
  const occupiedUnits = activeReservations.reduce((sum, r) => sum + r.unitsBooked, 0);
  const occupancyRate = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Top Section - Key Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase">Activos Ahora</p>
          <p className="text-2xl font-bold text-foreground mt-1">{activeReservations.length}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase">Próximos (7d)</p>
          <p className="text-2xl font-bold text-foreground mt-1">
            {upcomingReservations.filter((r) => {
              const diff = (new Date(r.startDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
              return diff <= 7;
            }).length}
          </p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase">Ocupación</p>
          <p className="text-2xl font-bold text-foreground mt-1">{occupancyRate}%</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase">Por Cobrar</p>
          <p className="text-lg font-bold text-amber-600 dark:text-amber-400 mt-1">
            {formatCLP(pendingPayments.reduce((sum, p) => sum + p.pending, 0))}
          </p>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Column - Upcoming Timeline */}
        <div className="lg:col-span-2 space-y-6">
          {/* Upcoming Reservations Timeline */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b bg-muted/40">
              <h3 className="text-sm font-semibold text-foreground">Próximas Reservas</h3>
            </div>
            <div className="divide-y">
              {upcomingReservations.slice(0, 6).map((res, idx) => {
                const daysUntil = Math.ceil(
                  (new Date(res.startDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
                );
                const nights = getNights(res.startDate, res.endDate);
                const status = getStatusBadge(res.status);

                return (
                  <div key={res.id} className="px-4 py-4 flex items-center gap-4 hover:bg-muted/30 transition-colors group">
                    {/* Timeline Dot */}
                    <div className="flex flex-col items-center gap-1 flex-shrink-0">
                      <div
                        className="h-3 w-3 rounded-full border-2 border-foreground"
                        style={{ backgroundColor: res.property.color }}
                      />
                      {idx < upcomingReservations.length - 1 && (
                        <div className="h-8 w-0.5 bg-border" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-foreground">{res.client.name}</p>
                          <p className="text-xs text-muted-foreground">{res.property.name}</p>
                        </div>
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium flex-shrink-0 ${status.bg} ${status.color}`}>
                          {daysUntil <= 7 ? `En ${daysUntil}d` : formatDate(res.startDate)}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span>{formatDate(res.startDate)} → {formatDate(res.endDate)}</span>
                        <span>•</span>
                        <span>{nights} noches</span>
                        <span>•</span>
                        <span className="font-medium text-foreground">{formatCLP(Number(res.totalPrice))}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Active Reservations */}
          {activeReservations.length > 0 && (
            <div className="bg-card border border-emerald-200 dark:border-emerald-800 rounded-lg overflow-hidden bg-emerald-50/50 dark:bg-emerald-950/20">
              <div className="px-4 py-3 border-b border-emerald-200 dark:border-emerald-800 bg-emerald-100/50 dark:bg-emerald-950/40">
                <h3 className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">En Curso Ahora</h3>
              </div>
              <div className="divide-y divide-emerald-200 dark:divide-emerald-800">
                {activeReservations.map((res) => {
                  const endDate = new Date(res.endDate);
                  const daysRemaining = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

                  return (
                    <div key={res.id} className="px-4 py-3 flex items-center gap-3">
                      <div
                        className="h-8 w-8 rounded-lg flex items-center justify-center text-white font-semibold text-xs flex-shrink-0"
                        style={{ backgroundColor: res.property.color }}
                      >
                        {getInitials(res.client.name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{res.client.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{res.property.name}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">Termina en {daysRemaining}d</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar - Payments & Quick Info */}
        <div className="space-y-6">
          {/* Recent Payments */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b bg-muted/40">
              <h3 className="text-sm font-semibold text-foreground">Pagos Recientes</h3>
            </div>
            <div className="divide-y">
              {recentPayments.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground text-xs">
                  Sin pagos recientes
                </div>
              ) : (
                recentPayments.map((p) => (
                  <div key={p.id} className="px-4 py-3 flex items-start gap-3">
                    <div className="h-8 w-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/30 flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">
                        {p.reservation.client.name}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatCLP(Number(p.amount))}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Pending Payments */}
          <div className="bg-card border border-amber-200 dark:border-amber-800 rounded-lg overflow-hidden bg-amber-50/50 dark:bg-amber-950/20">
            <div className="px-4 py-3 border-b border-amber-200 dark:border-amber-800 bg-amber-100/50 dark:bg-amber-950/40">
              <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-100">Pendiente de Pago</h3>
            </div>
            <div className="divide-y divide-amber-200 dark:divide-amber-800 max-h-72 overflow-y-auto">
              {pendingPayments.length === 0 ? (
                <div className="p-4 text-center text-amber-700 dark:text-amber-300 text-xs font-medium">
                  ¡Todo pagado! 🎉
                </div>
              ) : (
                pendingPayments.map((item) => (
                  <div key={item.reservation.id} className="px-4 py-3">
                    <p className="text-xs font-medium text-foreground truncate">{item.reservation.client.name}</p>
                    <p className="text-xs text-muted-foreground">{item.reservation.property.name}</p>
                    <p className="text-sm font-semibold text-amber-700 dark:text-amber-300 mt-1">
                      {formatCLP(item.pending)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <button className="w-full px-4 py-2 bg-[hsl(var(--primary))] text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
            + Nueva Reserva
          </button>
        </div>
      </div>
    </div>
  );
}

function VariantC({
  reservations,
  properties,
}: {
  reservations: Reservation[];
  properties: Property[];
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const groupedReservations = {
    active: reservations.filter((r) => {
      const start = new Date(r.startDate);
      const end = new Date(r.endDate);
      return start <= today && end >= today && r.status !== "CANCELLED";
    }),
    upcoming: reservations
      .filter((r) => {
        const start = new Date(r.startDate);
        return start > today && r.status !== "CANCELLED";
      })
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()),
    pending: reservations.filter((r) => r.status === "PENDING"),
    completed: reservations.filter((r) => r.status === "COMPLETED"),
  };

  return (
    <div className="space-y-6">
      {/* Quick Stats Bar */}
      <div className="flex items-center gap-6 p-4 bg-muted/50 rounded-lg overflow-x-auto">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold">{reservations.length}</span>
          <span className="text-sm text-muted-foreground">Total</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-green-500" />
          <span className="text-2xl font-bold">{groupedReservations.active.length}</span>
          <span className="text-sm text-muted-foreground">Activos</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-blue-500" />
          <span className="text-2xl font-bold">{groupedReservations.upcoming.length}</span>
          <span className="text-sm text-muted-foreground">Próximos</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-yellow-500" />
          <span className="text-2xl font-bold">{groupedReservations.pending.length}</span>
          <span className="text-sm text-muted-foreground">Pendientes</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-gray-400" />
          <span className="text-2xl font-bold">{groupedReservations.completed.length}</span>
          <span className="text-sm text-muted-foreground">Completados</span>
        </div>
      </div>

      {/* Reservation Tables */}
      <div className="space-y-8">
        {/* Active & Upcoming Combined */}
        {(groupedReservations.active.length > 0 || groupedReservations.upcoming.length > 0) && (
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="border-b px-4 py-3 bg-muted/30">
              <h3 className="font-semibold">Arriendos Activos y Próximos</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left p-3 font-medium">Propiedad</th>
                    <th className="text-left p-3 font-medium">Cliente</th>
                    <th className="text-left p-3 font-medium">Check-in</th>
                    <th className="text-left p-3 font-medium">Check-out</th>
                    <th className="text-left p-3 font-medium">Noches</th>
                    <th className="text-left p-3 font-medium">Tipo</th>
                    <th className="text-right p-3 font-medium">Total</th>
                    <th className="text-right p-3 font-medium">Pagado</th>
                    <th className="text-right p-3 font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {[...groupedReservations.active, ...groupedReservations.upcoming].map((res) => {
                    const isActive = groupedReservations.active.some((r) => r.id === res.id);
                    const paid = getPaidAmount(res.payments);
                    const pending = Number(res.totalPrice) - paid;
                    const status = getStatusBadge(res.status);

                    return (
                      <tr key={res.id} className={isActive ? "bg-green-50/50" : ""}>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <div
                              className="h-3 w-3 rounded-full"
                              style={{ backgroundColor: res.property.color }}
                            />
                            <span className="font-medium">{res.property.name}</span>
                          </div>
                        </td>
                        <td className="p-3 text-muted-foreground">{res.client.name}</td>
                        <td className="p-3">{formatDate(res.startDate)}</td>
                        <td className="p-3">{formatDate(res.endDate)}</td>
                        <td className="p-3 text-center">{getNights(res.startDate, res.endDate)}</td>
                        <td className="p-3">
                          <span className="text-xs bg-muted px-2 py-1 rounded">
                            {res.billingType === "DAILY" ? "Diario" : "Mensual"}
                          </span>
                        </td>
                        <td className="p-3 text-right font-medium">{formatCLP(Number(res.totalPrice))}</td>
                        <td className="p-3 text-right">
                          <span className="text-green-600">{formatCLP(paid)}</span>
                          {pending > 0 && (
                            <span className="text-orange-600 block text-xs">{formatCLP(pending)} pte</span>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          <span
                            className={`inline-flex h-5 items-center rounded-full px-2 text-xs font-medium ${
                              status.variant === "default" ? "bg-primary text-primary-foreground" :
                              status.variant === "secondary" ? "bg-secondary text-secondary-foreground" :
                              status.variant === "destructive" ? "bg-destructive/10 text-destructive" :
                              "border"
                            }`}
                          >
                            {status.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Pending Reservations */}
        {groupedReservations.pending.length > 0 && (
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="border-b px-4 py-3 bg-yellow-50/50">
              <h3 className="font-semibold text-yellow-800">Reservas Pendientes de Confirmación</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <tbody className="divide-y">
                  {groupedReservations.pending.map((res) => {
                    const paid = getPaidAmount(res.payments);
                    return (
                      <tr key={res.id}>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <div
                              className="h-3 w-3 rounded-full"
                              style={{ backgroundColor: res.property.color }}
                            />
                            <span className="font-medium">{res.property.name}</span>
                          </div>
                        </td>
                        <td className="p-3 text-muted-foreground">{res.client.name}</td>
                        <td className="p-3">{formatDate(res.startDate)}</td>
                        <td className="p-3">{formatDate(res.endDate)}</td>
                        <td className="p-3 text-right font-medium">{formatCLP(Number(res.totalPrice))}</td>
                        <td className="p-3 text-right">
                          <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
                            Pendiente
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Empty State */}
        {reservations.length === 0 && (
          <div className="text-center py-16 border-2 border-dashed rounded-xl">
            <p className="text-lg font-medium">No hay reservas</p>
            <p className="text-muted-foreground mt-1">Crea tu primera reserva para ver el dashboard</p>
          </div>
        )}
      </div>
    </div>
  );
}

// === MAIN PAGE ===
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ variant?: string }>;
}) {
  const params = await searchParams;
  const variant = params.variant ?? "D";

  const [reservations, properties, clients] = await Promise.all([
    getReservations(),
    getProperties(),
    getClients(),
  ]);

  const data = {
    reservations: reservations as unknown as Reservation[],
    properties: properties as unknown as Property[],
    clients: clients as unknown as Client[],
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Resumen de tus propiedades y arriendos
        </p>
      </div>

      {variant === "A" && <VariantA {...data} />}
      {variant === "B" && <VariantB {...data} />}
      {variant === "C" && <VariantC {...data} />}
      {(variant === "D" || variant === undefined) && <VariantD {...data} />}

      {process.env.NODE_ENV !== "production" && (
        <Suspense fallback={null}>
          <DashboardPrototypeSwitcher currentVariant={variant} />
        </Suspense>
      )}
    </div>
  );
}