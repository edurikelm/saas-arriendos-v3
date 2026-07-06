import Link from "next/link";
import {
  Shield,
  Users,
  Building2,
  DollarSign,
  Calendar,
  ArrowRight,
  Plus,
  TrendingUp,
  TrendingDown,
  UserPlus,
  Target,
  Activity,
  Sparkles,
  Mail,
  Clock,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MetricCard } from "@/components/ui/metric-card";
import { getDashboardStats, getRecentOwners } from "@/lib/actions/super-admin";
import { cn } from "@/lib/utils";

const formatCLP = (amount: number) =>
  new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
  }).format(amount);

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

function getInitials(email: string): string {
  const local = email.split("@")[0] ?? email;
  const parts = local.split(/[._-]/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return local.slice(0, 2).toUpperCase();
}

export default async function AdminDashboardPage() {
  const [stats, recentOwners] = await Promise.all([
    getDashboardStats(),
    getRecentOwners(5),
  ]);

  if (!stats) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">No autorizado</p>
      </div>
    );
  }

  const isGrowthPositive = stats.growthPercentage > 0;
  const isGrowthNeutral = stats.growthPercentage === 0;
  const isGrowthDown = stats.growthPercentage < 0;

  const primaryKpis = [
    {
      key: "owners",
      label: "Total Propietarios",
      value: stats.totalOwners.toString(),
      detail: "propietarios activos",
      icon: Users,
      tone: "neutral" as const,
    },
    {
      key: "properties",
      label: "Total Propiedades",
      value: stats.totalProperties.toString(),
      detail: "propiedades en el sistema",
      icon: Building2,
      tone: "info" as const,
    },
    {
      key: "reservations",
      label: "Reservas Totales",
      value: stats.totalReservations.toString(),
      detail: "reservas realizadas",
      icon: Calendar,
      tone: "warning" as const,
    },
    {
      key: "revenue",
      label: "Ingresos Totales",
      value: formatCLP(stats.totalRevenue),
      detail: "pagos completados",
      icon: DollarSign,
      tone: "success" as const,
    },
  ];

  return (
    <div className="space-y-6">
      <Card className="relative overflow-hidden border-border/60 bg-gradient-to-br from-card via-card to-primary/5">
        <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute -left-16 -bottom-16 h-48 w-48 rounded-full bg-violet-500/5 blur-3xl" />
        <CardContent className="relative p-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-violet-500/20 ring-1 ring-border">
                <Shield className="size-7 text-primary" />
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-heading text-2xl font-semibold tracking-tight">
                    Super Admin
                  </h1>
                  <span className="inline-flex items-center gap-1 rounded-md border border-primary/20 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    <Sparkles className="size-3" />
                    Panel de control
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Panel de gestión del sistema
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/admin/users"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                <Users className="mr-2 size-4" />
                Ver usuarios
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {primaryKpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <MetricCard
              key={kpi.key}
              title={kpi.label}
              value={kpi.value}
              detail={kpi.detail}
              icon={Icon}
              tone={kpi.tone}
            />
          );
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="relative overflow-hidden border-border/60">
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-info/10 text-info-foreground">
                    <Target className="size-4" />
                  </div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Conversión FREE→PRO
                  </p>
                </div>
                <p className="font-heading text-3xl font-semibold tracking-tight tabular-nums">
                  {stats.conversionPercentage}
                  <span className="ml-0.5 text-xl text-muted-foreground">%</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  de propietarios son PRO
                </p>
              </div>
            </div>
              <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-info transition-all"
                  style={{ width: `${Math.min(100, stats.conversionPercentage)}%` }}
                />
              </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-border/60">
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div
                    className={`flex size-8 items-center justify-center rounded-lg ${
                      isGrowthDown
                        ? "bg-destructive/10 text-destructive-foreground"
                        : isGrowthNeutral
                          ? "bg-secondary/10 text-secondary-foreground"
                          : "bg-success/10 text-success-foreground"
                    }`}
                  >
                    {isGrowthDown ? (
                      <TrendingDown className="size-4" />
                    ) : (
                      <TrendingUp className="size-4" />
                    )}
                  </div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Crecimiento Mensual
                  </p>
                </div>
                <p
                  className={`font-heading text-3xl font-semibold tracking-tight tabular-nums ${
                    isGrowthDown
                      ? "text-destructive"
                      : isGrowthPositive
                        ? "text-success"
                        : "text-foreground"
                  }`}
                >
                  {isGrowthPositive ? "+" : ""}
                  {stats.growthPercentage}
                  <span className="ml-0.5 text-xl text-muted-foreground">%</span>
                </p>
                <p className="text-xs text-muted-foreground">vs mes anterior</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-border/60 sm:col-span-2 md:col-span-1">
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-info/10 text-info-foreground">
                    <UserPlus className="size-4" />
                  </div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Nuevos Propietarios
                  </p>
                </div>
                <div className="flex items-baseline gap-3">
                  <p className="font-heading text-3xl font-semibold tracking-tight tabular-nums">
                    {stats.ownersThisMonth}
                  </p>
                  <span className="text-xs text-muted-foreground">
                    este mes
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Activity className="size-3" />
                  <span className="tabular-nums">{stats.ownersLastMonth}</span>
                  <span>el mes anterior</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <UserPlus className="size-4 text-muted-foreground" />
                  Propietarios Recientes
                </CardTitle>
                <CardDescription>
                  Últimos {recentOwners.length} propietarios registrados
                </CardDescription>
              </div>
              <Link
                href="/admin/users"
                className={cn(
                  buttonVariants({ variant: "ghost", size: "sm" }),
                  "text-muted-foreground"
                )}
              >
                Ver todos
                <ChevronRight className="ml-1 size-4" />
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {recentOwners.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/20 py-12 text-center">
                <Users className="mb-2 size-8 text-muted-foreground/50" />
                <p className="text-sm font-medium">No hay propietarios registrados</p>
                <p className="text-xs text-muted-foreground">
                  Cuando se registren nuevos propietarios aparecerán aquí
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {recentOwners.map((owner) => (
                  <Link
                    key={owner.id}
                    href={`/admin/users/${owner.id}`}
                    className="group flex items-center justify-between gap-3 rounded-lg p-3 transition-colors hover:bg-muted/40"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar size="default" className="ring-1 ring-border">
                        <AvatarFallback className="bg-gradient-to-br from-primary/15 to-violet-500/15 text-sm font-semibold text-foreground">
                          {getInitials(owner.email)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 space-y-0.5">
                        <p className="truncate text-sm font-medium">{owner.email}</p>
                        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Clock className="size-3 shrink-0" />
                          {timeAgo(owner.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <div className="hidden text-right sm:block">
                        <p className="text-sm font-medium tabular-nums">
                          {owner._count.properties}
                          <span className="ml-1 text-xs text-muted-foreground">
                            prop.
                          </span>
                        </p>
                        <p className="text-xs text-muted-foreground tabular-nums">
                          {owner._count.reservations} reservas
                        </p>
                      </div>
                      <Badge
                        variant={owner.plan === "PRO" ? "info" : owner.plan === "FREE" ? "secondary" : "warning"}
                        className="rounded-md font-medium"
                      >
                        {owner.plan === "PRO" && <Sparkles className="size-3" />}
                        {owner.plan || "SIN PLAN"}
                      </Badge>
                      <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="size-4 text-muted-foreground" />
              Acciones Rápidas
            </CardTitle>
            <CardDescription>Operaciones comunes del administrador</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5">
            <Link
              href="/admin/users"
              className={cn(
                buttonVariants({ className: "h-auto w-full justify-between p-4" })
              )}
            >
              <span className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-md bg-primary-foreground/15">
                  <Users className="size-4" />
                </span>
                <span className="text-left">
                  <span className="block text-sm font-medium">Gestionar Usuarios</span>
                  <span className="block text-xs opacity-80">
                    Ver y editar todos los propietarios
                  </span>
                </span>
              </span>
              <ArrowRight className="size-4 opacity-70" />
            </Link>
            <Link
              href="/admin/users"
              className={cn(
                buttonVariants({
                  variant: "outline",
                  className: "h-auto w-full justify-between p-4",
                })
              )}
            >
              <span className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-md bg-muted text-foreground">
                  <Plus className="size-4" />
                </span>
                <span className="text-left">
                  <span className="block text-sm font-medium">Crear Nuevo Propietario</span>
                  <span className="block text-xs text-muted-foreground">
                    Registrar un nuevo owner manualmente
                  </span>
                </span>
              </span>
              <ArrowRight className="size-4 text-muted-foreground" />
            </Link>

            <div className="mt-4 rounded-lg border bg-gradient-to-br from-muted/40 to-muted/0 p-4">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Mail className="size-3.5" />
                Resumen del sistema
              </div>
              <div className="mt-3 grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="font-heading text-lg font-semibold tabular-nums">
                    {stats.totalOwners}
                  </p>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Owners
                  </p>
                </div>
                <div>
                  <p className="font-heading text-lg font-semibold tabular-nums">
                    {stats.totalProperties}
                  </p>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Props
                  </p>
                </div>
                <div>
                  <p className="font-heading text-lg font-semibold tabular-nums">
                    {stats.totalReservations}
                  </p>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Reservas
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
