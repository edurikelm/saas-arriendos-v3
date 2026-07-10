import Link from "next/link";
import {
  Users,
  Building2,
  Wallet,
  LifeBuoy,
  UserPlus,
  AlertCircle,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/components/ui/kpi-card";
import { DataTable } from "@/components/ui/data-table";
import {
  getDashboardStats,
  getRecentOwners,
  getSystemActivity,
  type SystemActivityItem,
} from "@/lib/actions/super-admin";
import { cn } from "@/lib/utils";

const formatCLP = (amount: number) =>
  new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
  }).format(amount);

const formatCompactCLP = (amount: number) => {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return formatCLP(amount);
};

function timeAgo(date: Date | string): string {
  const now = Date.now();
  const then = new Date(date).getTime();
  const seconds = Math.floor((now - then) / 1000);

  if (seconds < 60) return "hace un momento";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `hace ${days} d`;
  return new Date(date).toLocaleDateString("es-CL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatRegistrationDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("es-CL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const activityVisuals: Record<
  SystemActivityItem["type"],
  { icon: LucideIcon; container: string }
> = {
  OWNER_REGISTERED: { icon: UserPlus, container: "bg-primary/10 text-primary" },
  SUPPORT_TICKET: { icon: LifeBuoy, container: "bg-warning/10 text-warning" },
  PAYMENT_COMPLETED: { icon: Wallet, container: "bg-info/10 text-info" },
};

function activityVisual(item: SystemActivityItem) {
  if (item.type === "SUPPORT_TICKET" && item.priority === "HIGH") {
    return { icon: AlertCircle, container: "bg-destructive/10 text-destructive" };
  }
  return activityVisuals[item.type];
}

export default async function AdminDashboardPage() {
  const [stats, recentOwners, activity] = await Promise.all([
    getDashboardStats(),
    getRecentOwners(6),
    getSystemActivity(6),
  ]);

  if (!stats) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">No autorizado</p>
      </div>
    );
  }

  const isGrowthPositive = stats.growthPercentage > 0;
  const hasPendingTickets = stats.pendingSupportTickets > 0;

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-bold text-foreground">Panel de Control Global</h1>
          <p className="text-xs text-muted-foreground">
            Métricas clave y supervisión del rendimiento del ecosistema
          </p>
        </div>
        <Link
          href="/admin/users"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          <Users className="mr-2 size-4" />
          Ver usuarios
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Total de Propiedades"
          value={stats.totalProperties.toString()}
          icon={Building2}
          tone="default"
          sublabel="En todo el ecosistema"
        />
        <KpiCard
          label="Propietarios Activos"
          value={stats.totalOwners.toString()}
          icon={Users}
          tone="info"
          sublabel={`${stats.ownersThisMonth} nuevos este mes`}
          indicator={
            isGrowthPositive
              ? {
                  text: `+${stats.growthPercentage}% vs mes anterior`,
                  variant: "positive",
                }
              : undefined
          }
        />
        <KpiCard
          label="Ingresos Globales"
          value={formatCompactCLP(stats.totalRevenue)}
          icon={Wallet}
          tone="success"
          sublabel="Pagos completados"
        />
        <KpiCard
          label="Tickets de Soporte"
          value={stats.pendingSupportTickets.toString()}
          icon={LifeBuoy}
          tone={hasPendingTickets ? "destructive" : "default"}
          sublabel="Pendientes de atención"
        />
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent Owners (Left 2/3) */}
        <div className="space-y-3 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-foreground">
              Últimos Propietarios Registrados
            </h2>
            <Link
              href="/admin/users"
              className="text-[10px] font-bold uppercase tracking-wider text-primary hover:underline"
            >
              Ver todas
            </Link>
          </div>
          <DataTable
            headers={[
              "Propietario",
              "Empresa",
              { label: "Propiedades", align: "center" },
              { label: "Reservas", align: "center" },
              "Plan",
              { label: "Fecha Registro", align: "right" },
            ]}
            caption="Últimos propietarios registrados"
            emptyState={
              <>
                No hay propietarios registrados. Cuando se registren nuevos
                propietarios aparecerán aquí.
              </>
            }
          >
            {recentOwners.map((owner) => (
              <tr
                key={owner.id}
                className="border-b last:border-0 transition-colors hover:bg-muted/30"
              >
                <td className="px-6 py-4">
                  <div className="flex flex-col">
                    <span className="font-bold text-foreground">
                      {owner.name || owner.email}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {owner.email}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 text-foreground">
                  {owner.companyName || (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-6 py-4 text-center font-bold text-primary tabular-nums">
                  {owner._count.properties}
                </td>
                <td className="px-6 py-4 text-center text-muted-foreground tabular-nums">
                  {owner._count.reservations}
                </td>
                <td className="px-6 py-4">
                  <Badge
                    variant={
                      owner.plan === "PRO"
                        ? "info"
                        : owner.plan === "FREE"
                          ? "secondary"
                          : "warning"
                    }
                    className="rounded-md font-medium"
                  >
                    {owner.plan || "SIN PLAN"}
                  </Badge>
                </td>
                <td className="px-6 py-4 text-right font-medium text-foreground tabular-nums">
                  {formatRegistrationDate(owner.createdAt)}
                </td>
              </tr>
            ))}
          </DataTable>
        </div>

        {/* Recent Activity (Right 1/3) */}
        <Card className="flex h-full flex-col lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm">Actividad Reciente del Sistema</CardTitle>
          </CardHeader>
          <CardContent className="flex-1">
            {activity.length === 0 ? (
              <p className="py-8 text-center text-xs text-muted-foreground">
                Sin actividad reciente
              </p>
            ) : (
              <div className="space-y-6">
                {activity.map((item, idx) => {
                  const { icon: Icon, container } = activityVisual(item);
                  const isLast = idx === activity.length - 1;
                  return (
                    <div key={item.id} className="relative flex gap-3">
                      {!isLast && (
                        <div className="absolute bottom-[-24px] left-4 top-8 w-px bg-border" />
                      )}
                      <div
                        className={cn(
                          "z-10 flex size-8 shrink-0 items-center justify-center rounded-full",
                          container
                        )}
                      >
                        <Icon className="size-4" />
                      </div>
                      <div className="pt-0.5">
                        <p className="text-xs font-bold text-foreground">{item.title}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {item.description}
                        </p>
                        <span className="mt-1 block text-[9px] font-bold uppercase tracking-tight text-muted-foreground">
                          {timeAgo(item.createdAt)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
