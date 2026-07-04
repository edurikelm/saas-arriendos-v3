import Link from "next/link";
import {
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Home,
  TrendingUp,
} from "lucide-react";
import { CollectionAlertsSection } from "@/components/dashboard/collection-alerts-section";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MetricCard } from "@/components/ui/metric-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { classifyCollectionAlerts } from "@/lib/alerts/collection-alerts";
import { getProperties } from "@/lib/actions/properties";
import { getReservations } from "@/lib/actions/reservations";
import { getReservationPaidAmount } from "@/lib/payments/calculations";

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
  paymentType?: string | null;
  method: string;
  paidAt: string | null;
  deletedAt: string | null;
  dueDate?: string | null;
  initPoint?: string | null;
  expiresAt?: string | null;
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
    timeZone: "America/Santiago",
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

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function daysBetween(from: Date, dateString: string): number {
  return Math.ceil((new Date(dateString).getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    PENDING: "Pendiente",
    CONFIRMED: "Confirmada",
    CANCELLED: "Cancelada",
    COMPLETED: "Completada",
  };

  return labels[status] ?? status;
}

function getStatusBadgeVariant(status: string): "success" | "warning" | "destructive" | "secondary" {
  const map: Record<string, "success" | "warning" | "destructive" | "secondary"> = {
    PENDING: "warning",
    CONFIRMED: "success",
    CANCELLED: "destructive",
    COMPLETED: "secondary",
  };
  return map[status] ?? "secondary";
}

function ReservationRow({
  reservation,
  today,
  mode,
}: {
  reservation: Reservation;
  today: Date;
  mode: "active" | "upcoming";
}) {
  const remainingDays = mode === "active" ? daysBetween(today, reservation.endDate) : daysBetween(today, reservation.startDate);
  const paid = getReservationPaidAmount(reservation.payments);
  const pending = Math.max(Number(reservation.totalPrice) - paid, 0);

  return (
    <Link
      href={`/reservations?reservationId=${reservation.id}`}
      className="grid gap-3 rounded-xl border border-transparent p-3 transition-colors hover:border-border hover:bg-muted/40 sm:grid-cols-[1fr_auto]"
    >
      <div className="flex min-w-0 items-center gap-3">
        <div
          className="flex size-10 shrink-0 items-center justify-center rounded-xl text-sm font-semibold text-white shadow-sm"
          style={{ backgroundColor: reservation.property.color }}
        >
          {getInitials(reservation.client.name)}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-medium text-foreground">{reservation.client.name}</p>
            <Badge variant={getStatusBadgeVariant(reservation.status)} className="rounded-md">
              {getStatusLabel(reservation.status)}
            </Badge>
          </div>
          <p className="truncate text-sm text-muted-foreground">{reservation.property.name}</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 sm:justify-end sm:text-right">
        <div>
          <p className="text-sm font-medium text-foreground">
            {formatDate(reservation.startDate)} - {formatDate(reservation.endDate)}
          </p>
          <p className="text-xs text-muted-foreground">
            {getNights(reservation.startDate, reservation.endDate)} noches · {reservation.unitsBooked} unidad{reservation.unitsBooked === 1 ? "" : "es"}
          </p>
        </div>
        <div className="min-w-24">
          <p className={mode === "active" ? "text-sm font-semibold text-emerald-600 dark:text-emerald-300" : "text-sm font-semibold text-sky-600 dark:text-sky-300"}>
            {mode === "active" ? `Termina en ${remainingDays}d` : `En ${remainingDays}d`}
          </p>
          {pending > 0 && <p className="text-xs text-amber-600 dark:text-amber-300">{formatCLP(pending)} pte.</p>}
        </div>
      </div>
    </Link>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-xl border border-dashed p-8 text-center">
      <p className="font-medium text-foreground">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

export default async function DashboardPage() {
  const [reservationsResult, properties] = await Promise.all([
    getReservations(),
    getProperties(),
  ]);

  const data = {
    reservations: (reservationsResult as unknown as { data: Reservation[] }).data,
    properties: properties as unknown as Property[],
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const activeReservations = data.reservations
    .filter((reservation) => {
      const start = new Date(reservation.startDate);
      const end = new Date(reservation.endDate);
      return start <= today && end >= today && reservation.status !== "CANCELLED";
    })
    .sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime());

  const upcomingReservations = data.reservations
    .filter((reservation) => new Date(reservation.startDate) > today && reservation.status !== "CANCELLED")
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

  // Intencionalmente incluye EXTRAS: es vista de auditoría de cobros,
  // NO cálculo de saldo. Ver `src/lib/payments/calculations.ts` para saldo.
  const recentPayments = data.reservations
    .flatMap((reservation) =>
      reservation.payments
        .filter((payment) => payment.status === "COMPLETED" && !payment.deletedAt)
        .map((payment) => ({ ...payment, reservation }))
    )
    .sort((a, b) => new Date(b.paidAt || "").getTime() - new Date(a.paidAt || "").getTime())
    .slice(0, 5);

  const pendingPayments = data.reservations
    .flatMap((reservation) => {
      if (reservation.status === "CANCELLED") return [];

      const paid = getReservationPaidAmount(reservation.payments);
      const pending = Number(reservation.totalPrice) - paid;

      if (pending <= 0) return [];
      return [{ reservation, pending }];
    })
    .sort((a, b) => b.pending - a.pending);

  const saldosData = pendingPayments.map((item) => ({
    reservationId: item.reservation.id,
    reservation: {
      client: { name: item.reservation.client.name },
      property: { name: item.reservation.property.name },
    },
    pending: item.pending,
  }));

  const collectionAlerts = classifyCollectionAlerts(
    data.reservations.flatMap((reservation) =>
      reservation.payments.map((payment) => ({
        id: payment.id,
        status: payment.status,
        paymentType: payment.paymentType ?? null,
        method: payment.method,
        dueDate: payment.dueDate ?? null,
        initPoint: payment.initPoint ?? null,
        expiresAt: payment.expiresAt ?? null,
        reservation: {
          id: reservation.id,
          status: reservation.status,
          client: { name: reservation.client.name },
          property: { name: reservation.property.name },
        },
      }))
    )
  );

  const totalUnits = data.properties.reduce((sum, property) => sum + property.unitsAvailable, 0);
  const occupiedUnits = activeReservations.reduce((sum, reservation) => sum + reservation.unitsBooked, 0);
  const occupancyRate = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;
  const next7Days = upcomingReservations.filter((reservation) => daysBetween(today, reservation.startDate) <= 7).length;
  const pendingTotal = pendingPayments.reduce((sum, item) => sum + item.pending, 0);
  const completedTotal = data.reservations.reduce((sum, reservation) => sum + getReservationPaidAmount(reservation.payments), 0);

  // KPI tones
  const kpi1Tone = activeReservations.length > 0 ? "success" : "neutral";
  const kpi1Status = activeReservations.length > 0 ? "ok" : "neutral";

  const kpi2Tone = next7Days > 0 ? "info" : "neutral";
  const kpi2Status = next7Days > 0 ? "ok" : "neutral";

  const kpi3Tone = totalUnits === 0 ? "neutral" : occupancyRate < 70 ? "warning" : occupancyRate <= 85 ? "info" : "success";
  const kpi3Status = totalUnits === 0 ? "neutral" : occupancyRate >= 85 ? "ok" : occupancyRate >= 50 ? "warning" : "critical";

  const kpi4Tone = pendingTotal > 0 ? "destructive" : "neutral";
  const kpi4Status = pendingTotal > 0 ? "critical" : "ok";

  return (
    <div className="space-y-6 pb-10">
      {/* KPIs */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Activos ahora"
          value={activeReservations.length}
          detail={`${occupiedUnits} de ${totalUnits} unidades ocupadas`}
          icon={Home}
          tone={kpi1Tone}
          status={kpi1Status}
        />
        <MetricCard
          title="Próximos 7 días"
          value={next7Days}
          detail={`${upcomingReservations.length} reservas futuras`}
          icon={CalendarDays}
          tone={kpi2Tone}
          status={kpi2Status}
        />
        <MetricCard
          title="Ocupación"
          value={`${occupancyRate}%`}
          detail={`${data.properties.length} propiedades registradas`}
          icon={TrendingUp}
          tone={kpi3Tone}
          status={kpi3Status}
        />
        <MetricCard
          title="Por cobrar"
          value={formatCLP(pendingTotal)}
          detail={`${pendingPayments.length} reservas con saldo`}
          icon={CircleDollarSign}
          tone={kpi4Tone}
          status={kpi4Status}
        />
      </section>

      {/* Cobranza full-width */}
      <CollectionAlertsSection
        vencidos={collectionAlerts.vencidos}
        vencenHoy={collectionAlerts.vencenHoy}
        proximos7Dias={collectionAlerts.proximos7Dias}
        saldos={saldosData}
      />

      {/* 2-column layout: Reservas (tabs) | Resumen financiero + Pagos recientes */}
      <section className="grid gap-6 xl:grid-cols-2">
        {/* Reservas tabs */}
        <Card>
          <CardHeader className="border-b pb-4">
            <CardTitle>Reservas</CardTitle>
            <CardDescription>Reservas activas y próximas.</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <Tabs defaultValue="active" className="w-full">
              <TabsList variant="line" className="mb-4 w-full justify-start">
                <TabsTrigger value="active">
                  En curso
                  <Badge variant="secondary" className="ml-2">{activeReservations.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="upcoming">
                  Próximas
                  <Badge variant="secondary" className="ml-2">{upcomingReservations.length}</Badge>
                </TabsTrigger>
              </TabsList>
              <TabsContent value="active" className="space-y-2">
                {activeReservations.length === 0 ? (
                  <EmptyState title="Sin reservas activas" description="Cuando una estadía esté en curso aparecerá aquí." />
                ) : (
                  activeReservations.slice(0, 5).map((reservation) => (
                    <ReservationRow key={reservation.id} reservation={reservation} today={today} mode="active" />
                  ))
                )}
              </TabsContent>
              <TabsContent value="upcoming" className="space-y-2">
                {upcomingReservations.length === 0 ? (
                  <EmptyState title="Sin próximas reservas" description="No hay check-ins programados desde hoy." />
                ) : (
                  upcomingReservations.slice(0, 6).map((reservation) => (
                    <ReservationRow key={reservation.id} reservation={reservation} today={today} mode="upcoming" />
                  ))
                )}
              </TabsContent>
            </Tabs>
            <div className="mt-4">
              <Link href="/reservations" className={buttonVariants({ variant: "outline", size: "sm" })}>
                Ver todas las reservas
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Resumen financiero + Pagos recientes */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Resumen financiero</CardTitle>
              <CardDescription>
                Pagado versus saldo pendiente de reservas activas o futuras.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-success/10 p-4">
                  <p className="text-xs text-muted-foreground">Pagado</p>
                  <p className="mt-1 text-lg font-semibold text-success">{formatCLP(completedTotal)}</p>
                </div>
                <div className="rounded-2xl bg-warning/10 p-4">
                  <p className="text-xs text-muted-foreground">Pendiente</p>
                  <p className="mt-1 text-lg font-semibold text-warning-foreground">{formatCLP(pendingTotal)}</p>
                </div>
              </div>

              {/* Pagos recientes inside Resumen financiero */}
              <div>
                <p className="mb-2 text-sm font-medium text-foreground">Pagos recientes</p>
                {recentPayments.length === 0 ? (
                  <EmptyState title="Sin pagos recientes" description="Los pagos completados aparecerán aquí." />
                ) : (
                  <div className="space-y-2">
                    {recentPayments.map((payment) => (
                      <div key={payment.id} className="flex items-center gap-3 rounded-xl bg-muted/50 p-3">
                        <span className="flex size-9 items-center justify-center rounded-xl bg-success/10 text-success">
                          <CheckCircle2 className="size-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">{payment.reservation.client.name}</p>
                          <p className="truncate text-xs text-muted-foreground">{payment.reservation.property.name}</p>
                        </div>
                        <p className="text-sm font-semibold text-foreground">{formatCLP(Number(payment.amount))}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Link
                href="/reports"
                className={buttonVariants({ variant: "outline", className: "w-full" })}
              >
                Abrir reportes
              </Link>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
