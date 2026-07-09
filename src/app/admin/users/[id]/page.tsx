import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  Users,
  Calendar,
  DollarSign,
  CreditCard,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  UserCircle,
  LayoutList,
  UserPlus,
  CalendarCheck,
  Receipt,
  Banknote,
  Link2,
  Ban,
  RotateCcw,
  XCircleIcon,
  Mail,
  CalendarDays,
  Sparkles,
  Home,
  UserCog,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MetricCard } from "@/components/ui/metric-card";
import { DataTable } from "@/components/ui/data-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getOwnerDetail } from "@/lib/actions/admin-users";
import { AdminOwnerNotes } from "@/components/admin/admin-owner-notes";
import { ActionHistory } from "@/components/admin/action-history";
import { updateUserStatus } from "@/lib/actions/super-admin";

interface PageProps {
  params: Promise<{ id: string }>;
}

function getInitials(name: string | null, email: string): string {
  if (name && name.trim()) {
    return name
      .split(" ")
      .filter(Boolean)
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }
  return email.slice(0, 2).toUpperCase();
}

/**
 * Maps user account status to semantic Badge variant.
 * ACTIVE → success, SUSPENDED → warning, CANCELLED → destructive
 */
function getStatusBadgeVariant(status: string): "success" | "warning" | "destructive" | "secondary" {
  switch (status) {
    case "ACTIVE":
      return "success";
    case "SUSPENDED":
      return "warning";
    case "CANCELLED":
      return "destructive";
    default:
      return "secondary";
  }
}

/**
 * Maps plan to semantic Badge variant.
 * PRO → info, FREE/null → secondary
 */
function getPlanBadgeVariant(plan: string | null): "info" | "secondary" | "warning" {
  if (plan === "PRO") return "info";
  if (plan === "FREE") return "secondary";
  return "warning";
}

/**
 * Maps status to color dot class for inline status indicators.
 */
function getStatusDotColor(status: string): string {
  switch (status) {
    case "ACTIVE":
      return "bg-success";
    case "SUSPENDED":
      return "bg-warning";
    case "CANCELLED":
      return "bg-destructive";
    default:
      return "bg-muted-foreground";
  }
}

export default async function AdminUserDetailPage({ params }: PageProps) {
  const { id } = await params;
  const data = await getOwnerDetail(id);

  if (!data) {
    notFound();
  }

  const { owner, stats, properties, reservations, payments } = data;

  const formatCLP = (amount: number) => {
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString("es-CL", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const isAtLimit = owner.plan === "FREE" && stats.properties >= stats.propertiesLimit;
  const propertyUsagePercent =
    owner.plan === "FREE" && stats.propertiesLimit > 0
      ? Math.min(100, Math.round((stats.properties / stats.propertiesLimit) * 100))
      : 0;

  const kpiCards = [
    {
      key: "properties",
      label: "Propiedades",
      value: stats.properties.toString(),
      detail: owner.plan === "FREE" ? `${stats.properties}/${stats.propertiesLimit} del plan FREE` : "Sin límite",
      icon: Building2,
      tone: "info" as const,
    },
    {
      key: "clients",
      label: "Clientes",
      value: stats.clients.toString(),
      detail: "Huéspedes registrados",
      icon: Users,
      tone: "neutral" as const,
    },
    {
      key: "reservations",
      label: "Reservas",
      value: stats.reservations.toString(),
      detail: "Reservas totales",
      icon: Calendar,
      tone: "warning" as const,
    },
    {
      key: "revenue",
      label: "Ingresos",
      value: formatCLP(stats.totalRevenue),
      detail: "Total facturado",
      icon: DollarSign,
      tone: "success" as const,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <Button variant="ghost" size="sm" render={<Link href="/admin/users" />}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver
        </Button>
        <div className="hidden text-xs text-muted-foreground sm:block">
          ID: <span className="font-mono text-foreground/70">{owner.id.slice(0, 8)}</span>
        </div>
      </div>

      <Card className="relative overflow-hidden border-border/60 bg-gradient-to-br from-card via-card to-muted/30">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/5 blur-3xl" />
        <div className="pointer-events-none absolute -left-12 -bottom-12 h-40 w-40 rounded-full bg-violet-500/5 blur-3xl" />
        <CardContent className="relative p-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-4">
              <Avatar size="lg" className="size-16 ring-2 ring-background">
                <AvatarFallback className="bg-gradient-to-br from-primary/20 to-violet-500/20 text-base font-semibold text-foreground">
                  {getInitials(owner.name, owner.email)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-heading text-2xl font-semibold tracking-tight text-balance">
                    {owner.name || "Sin nombre"}
                  </h1>
                  <span className="inline-flex items-center gap-1.5">
                    <span className={`size-1.5 rounded-full ${getStatusDotColor(owner.status)}`} />
                    <Badge variant={getStatusBadgeVariant(owner.status)} className="rounded-md">
                      {owner.status}
                    </Badge>
                  </span>
                  <Badge variant={getPlanBadgeVariant(owner.plan)} className="rounded-md">
                    {owner.plan === "PRO" && <Sparkles className="size-3" />}
                    {owner.plan || "FREE"}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <Mail className="size-3.5" />
                    {owner.email}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays className="size-3.5" />
                    Creado el {formatDate(owner.createdAt)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 lg:flex-shrink-0">
              {owner.status !== "ACTIVE" && (
                <form
                  action={async () => {
                    "use server";
                    await updateUserStatus({ userId: owner.id, status: "ACTIVE" });
                  }}
                >
                  <Button variant="default" size="sm" type="submit">
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Reactivar
                  </Button>
                </form>
              )}
              {owner.status !== "SUSPENDED" && (
                <form
                  action={async () => {
                    "use server";
                    await updateUserStatus({ userId: owner.id, status: "SUSPENDED" });
                  }}
                >
                  <Button variant="secondary" size="sm" type="submit">
                    <Ban className="h-4 w-4 mr-2" />
                    Suspender
                  </Button>
                </form>
              )}
              {owner.status !== "CANCELLED" && (
                <form
                  action={async () => {
                    "use server";
                    await updateUserStatus({ userId: owner.id, status: "CANCELLED" });
                  }}
                >
                  <Button variant="outline" size="sm" type="submit">
                    <XCircleIcon className="h-4 w-4 mr-2" />
                    Cancelar cuenta
                  </Button>
                </form>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((kpi) => {
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

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <UserCog className="size-4 text-muted-foreground" />
                  Información del Plan
                </CardTitle>
                <CardDescription>Plan actual y uso de recursos</CardDescription>
              </div>
              <Badge
                variant={getPlanBadgeVariant(owner.plan)}
                className="rounded-md font-medium"
              >
                {owner.plan === "PRO" && <Sparkles className="size-3" />}
                Plan {owner.plan || "FREE"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {owner.plan === "FREE" && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Uso de propiedades</span>
                  <span
                    className={`tabular-nums font-semibold ${
                      isAtLimit ? "text-destructive" : "text-foreground"
                    }`}
                  >
                    {stats.properties} / {stats.propertiesLimit}
                  </span>
                </div>
                <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full transition-all ${
                      isAtLimit
                        ? "bg-destructive"
                        : propertyUsagePercent >= 66
                          ? "bg-warning"
                          : "bg-primary"
                    }`}
                    style={{ width: `${propertyUsagePercent}%` }}
                  />
                </div>
                {isAtLimit && (
                  <div className="flex items-center gap-2 text-xs text-destructive">
                    <AlertTriangle className="size-3.5" />
                    Al límite del plan FREE — considera actualizar a PRO
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border bg-muted/30 p-3.5">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Users className="size-3.5" />
                  Total de clientes
                </div>
                <p className="mt-1 font-heading text-xl font-semibold tabular-nums">
                  {stats.clients}
                </p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3.5">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar className="size-3.5" />
                  Total de reservas
                </div>
                <p className="mt-1 font-heading text-xl font-semibold tabular-nums">
                  {stats.reservations}
                </p>
              </div>
            </div>

            <div className="rounded-lg border bg-card p-4">
              <div className="mb-3 flex items-center gap-2">
                <Link2 className="size-4 text-muted-foreground" />
                <span className="text-sm font-medium">Integración Mercado Pago</span>
              </div>
              {stats.hasMpIntegration ? (
                stats.isMpConnected ? (
                  <div className="flex items-start gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-success/10 text-success-foreground">
                      <CheckCircle2 className="size-5" />
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium text-success">
                        Conectado y activo
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Puede recibir pagos online de sus clientes
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-warning/10 text-warning-foreground">
                      <AlertTriangle className="size-5" />
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium text-warning">
                        Cuenta conectada pero inactiva
                      </p>
                      <p className="text-xs text-muted-foreground">
                        El propietario debe reactivar la integración
                      </p>
                    </div>
                  </div>
                )
              ) : (
                <div className="flex items-start gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive-foreground">
                    <XCircle className="size-5" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium text-destructive">
                      No configurado
                    </p>
                    <p className="text-xs text-muted-foreground">
                      El propietario no ha conectado Mercado Pago todavía
                    </p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="size-4 text-muted-foreground" />
              Resumen Financiero
            </CardTitle>
            <CardDescription>Estado de pagos</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Total facturado
              </p>
              <p className="mt-1 font-heading text-2xl font-semibold tabular-nums">
                {formatCLP(stats.totalRevenue)}
              </p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between rounded-md px-3 py-2 hover:bg-muted/50">
                <div className="flex items-center gap-2.5">
                  <span className="size-2 rounded-full bg-success" />
                  <span className="text-sm text-muted-foreground">Pagado</span>
                </div>
                <span className="font-semibold tabular-nums text-success">
                  {formatCLP(stats.paidAmount)}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-md px-3 py-2 hover:bg-muted/50">
                <div className="flex items-center gap-2.5">
                  <span className="size-2 rounded-full bg-warning" />
                  <span className="text-sm text-muted-foreground">Pendiente</span>
                </div>
                <span className="font-semibold tabular-nums text-warning">
                  {formatCLP(stats.pendingAmount)}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-md px-3 py-2 hover:bg-muted/50">
                <div className="flex items-center gap-2.5">
                  <span className="size-2 rounded-full bg-destructive" />
                  <span className="text-sm text-muted-foreground">Vencido</span>
                </div>
                <span className="font-semibold tabular-nums text-destructive">
                  {formatCLP(stats.overdueAmount)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="resumen" className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto flex-nowrap">
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="propiedades">Propiedades</TabsTrigger>
          <TabsTrigger value="reservas">Reservas</TabsTrigger>
          <TabsTrigger value="financiero">Financiero</TabsTrigger>
          <TabsTrigger value="notas">Notas internas</TabsTrigger>
          <TabsTrigger value="onboarding">Progreso</TabsTrigger>
        </TabsList>

        <TabsContent value="resumen" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Home className="size-4 text-muted-foreground" />
                Resumen de la cuenta
              </CardTitle>
              <CardDescription>Vista consolidada de la cuenta del propietario</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Plan actual</p>
                    <p className="mt-0.5 font-medium">{owner.plan || "FREE"}</p>
                  </div>
                  <Badge
                    variant={getPlanBadgeVariant(owner.plan)}
                    className="rounded-md font-medium"
                  >
                    {owner.plan || "FREE"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Estado de cuenta</p>
                    <p className="mt-0.5 font-medium">{owner.status}</p>
                  </div>
                  <span className="inline-flex items-center gap-1.5">
                    <span className={`size-1.5 rounded-full ${getStatusDotColor(owner.status)}`} />
                    <Badge variant={getStatusBadgeVariant(owner.status)} className="rounded-md">
                      {owner.status}
                    </Badge>
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Límite de propiedades</p>
                    <p className="mt-0.5 font-medium tabular-nums">
                      {stats.properties} / {stats.propertiesLimit}
                    </p>
                  </div>
                  {isAtLimit && <Badge variant="destructive">Al límite</Badge>}
                </div>
                <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Total de clientes</p>
                    <p className="mt-0.5 font-medium tabular-nums">{stats.clients}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Total de reservas</p>
                    <p className="mt-0.5 font-medium tabular-nums">{stats.reservations}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Fecha de registro</p>
                    <p className="mt-0.5 font-medium">{formatDate(owner.createdAt)}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="propiedades" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Propiedades ({properties.length})</CardTitle>
              <CardDescription>
                Listado de propiedades registradas por el propietario
              </CardDescription>
            </CardHeader>
            <CardContent>
              {properties.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/20 py-12 text-center">
                  <Building2 className="mb-2 size-8 text-muted-foreground/50" />
                  <p className="text-sm font-medium">No hay propiedades registradas</p>
                  <p className="text-xs text-muted-foreground">
                    El propietario aún no ha creado ninguna propiedad
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {properties.map((property) => (
                    <div
                      key={property.id}
                      className="group flex items-center justify-between rounded-lg border bg-card p-4 transition-colors hover:bg-muted/30"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="size-10 shrink-0 rounded-lg ring-2 ring-background"
                          style={{ backgroundColor: property.color }}
                        />
                        <div>
                          <p className="font-medium">{property.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {property.unitsAvailable} unidades · {formatCLP(Number(property.dailyPrice))}/noche
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className="tabular-nums">
                        {property._count.reservations} reservas
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reservas" className="mt-4">
          <div className="mb-4">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Reservas ({reservations.length})
            </h2>
            <p className="text-xs text-muted-foreground">Últimas reservas del propietario</p>
          </div>
          {reservations.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/20 py-12 text-center">
              <Calendar className="mb-2 size-8 text-muted-foreground/50" />
              <p className="text-sm font-medium">No hay reservas</p>
              <p className="text-xs text-muted-foreground">
                Las reservas del propietario aparecerán aquí
              </p>
            </div>
          ) : (
            <DataTable
              headers={["Cliente", "Propiedad", "Fechas", "Total", "Pagado", "Estado"]}
            >
              {reservations.map((reservation) => (
                <tr key={reservation.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{reservation.client.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {reservation.property.name}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground tabular-nums">
                    {formatDate(reservation.startDate)} - {formatDate(reservation.endDate)}
                  </td>
                  <td className="px-4 py-3 font-medium tabular-nums">
                    {formatCLP(Number(reservation.totalPrice))}
                  </td>
                  <td className="px-4 py-3 text-sm tabular-nums text-muted-foreground">
                    {formatCLP(reservation.paidAmount)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={
                        reservation.status === "CONFIRMED"
                          ? "default"
                          : reservation.status === "PENDING"
                            ? "secondary"
                            : "destructive"
                      }
                    >
                      {reservation.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </DataTable>
          )}
        </TabsContent>

        <TabsContent value="financiero" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Pagos ({payments.length})</CardTitle>
              <CardDescription>Historial reciente de pagos del propietario</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {payments.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/20 py-12 text-center">
                  <Receipt className="mb-2 size-8 text-muted-foreground/50" />
                  <p className="text-sm font-medium">No hay pagos</p>
                  <p className="text-xs text-muted-foreground">
                    Los pagos del propietario aparecerán aquí
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {payments.map((payment) => (
                    <div
                      key={payment.id}
                      className="flex items-center justify-between rounded-lg border bg-card p-4 transition-colors hover:bg-muted/30"
                    >
                      <div>
                        <p className="font-semibold tabular-nums">
                          {formatCLP(Number(payment.amount))}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {payment.method}
                          {payment.dueDate ? ` · Vence: ${formatDate(payment.dueDate)}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {payment.isOverdue && <Badge variant="destructive">Vencido</Badge>}
                        <Badge
                          variant={
                            payment.status === "COMPLETED"
                              ? "default"
                              : payment.status === "PENDING"
                                ? "secondary"
                                : "destructive"
                          }
                        >
                          {payment.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-6 rounded-lg border bg-gradient-to-br from-muted/40 to-muted/10 p-5">
                <h4 className="mb-4 font-medium">Resumen de Ingresos</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Pagado
                    </p>
                    <p className="mt-1 font-heading text-xl font-semibold tabular-nums text-success">
                      {formatCLP(stats.paidAmount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Pendiente
                    </p>
                    <p className="mt-1 font-heading text-xl font-semibold tabular-nums text-warning">
                      {formatCLP(stats.pendingAmount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Vencido
                    </p>
                    <p className="mt-1 font-heading text-xl font-semibold tabular-nums text-destructive">
                      {formatCLP(stats.overdueAmount)}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="onboarding" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LayoutList className="size-4 text-muted-foreground" />
                Progreso de Onboarding
              </CardTitle>
              <CardDescription>
                Seguimiento del proceso de activación del propietario
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  {
                    step: 1,
                    label: "Cuenta creada",
                    completed: !!owner.id,
                    icon: UserCircle,
                    description: "Perfil de usuario registrado",
                  },
                  {
                    step: 2,
                    label: "Primera propiedad",
                    completed: stats.properties > 0,
                    icon: Building2,
                    description: `${stats.properties} propiedad${stats.properties !== 1 ? "es" : ""} registrada${stats.properties !== 1 ? "s" : ""}`,
                  },
                  {
                    step: 3,
                    label: "Primer cliente",
                    completed: stats.clients > 0,
                    icon: UserPlus,
                    description: `${stats.clients} cliente${stats.clients !== 1 ? "s" : ""} agregado${stats.clients !== 1 ? "s" : ""}`,
                  },
                  {
                    step: 4,
                    label: "Primera reserva",
                    completed: stats.reservations > 0,
                    icon: CalendarCheck,
                    description: `${stats.reservations} reserva${stats.reservations !== 1 ? "s" : ""} creada${stats.reservations !== 1 ? "s" : ""}`,
                  },
                  {
                    step: 5,
                    label: "Primer pago",
                    completed: payments.length > 0,
                    icon: Receipt,
                    description: `${payments.length} pago${payments.length !== 1 ? "s" : ""} registrado${payments.length !== 1 ? "s" : ""}`,
                  },
                  {
                    step: 6,
                    label: "Primer pago completado",
                    completed: payments.some((p) => p.status === "COMPLETED" && p.paidAt),
                    icon: Banknote,
                    description: `${payments.filter((p) => p.status === "COMPLETED" && p.paidAt).length} pago${payments.filter((p) => p.status === "COMPLETED" && p.paidAt).length !== 1 ? "s" : ""} completado${payments.filter((p) => p.status === "COMPLETED" && p.paidAt).length !== 1 ? "s" : ""}`,
                  },
                  {
                    step: 7,
                    label: "Mercado Pago conectado",
                    completed: stats.isMpConnected,
                    icon: Link2,
                    description: stats.isMpConnected
                      ? "Integración activa"
                      : stats.hasMpIntegration
                        ? "Cuenta inactiva"
                        : "No configurado",
                  },
                ].map(({ step, label, completed, icon: Icon, description }) => (
                  <div
                    key={step}
                    className={`flex items-start gap-4 rounded-lg border p-4 transition-colors ${
                      completed
                        ? "border-success/20 bg-success/5"
                        : "bg-muted/20"
                    }`}
                  >
                    <div
                      className={`flex size-10 shrink-0 items-center justify-center rounded-full ${
                        completed
                          ? "bg-success/10 text-success-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {completed ? <CheckCircle2 className="size-5" /> : <Icon className="size-5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Paso {step}
                        </span>
                        <span className="font-medium">{label}</span>
                        {completed ? (
                          <Badge variant="success" className="rounded-md">
                            Completado
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="rounded-md">Pendiente</Badge>
                        )}
                      </div>
                      <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="historial" className="mt-4">
          <ActionHistory ownerId={id} />
        </TabsContent>

        <TabsContent value="notas" className="mt-4">
          <AdminOwnerNotes ownerId={id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
