import Link from "next/link";
import { Plus, Wallet, Clock, CalendarCheck, TrendingUp } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { KpiCard } from "@/components/ui/kpi-card";
import { DataTable } from "@/components/ui/data-table";
import { classifyCollectionAlerts } from "@/lib/alerts/collection-alerts";
import { getProperties } from "@/lib/actions/properties";
import { getReservations } from "@/lib/actions/reservations";
import { getReservationPaidAmount } from "@/lib/payments/calculations";
import { ReservationPill } from "@/components/reservations/reservation-pill";
import { OccupancyStrip } from "@/components/calendar/occupancy-strip";
import { DashboardCobranzaList, type CobranzaItem } from "./_components/dashboard-cobranza-list";

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

function daysBetween(from: Date, dateString: string): number {
  return Math.ceil((new Date(dateString).getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addDays(d: Date, n: number): Date {
  const result = new Date(d);
  result.setDate(result.getDate() + n);
  return result;
}

function getReservationStatusPill(
  reservation: Reservation,
  today: Date
): { tone: "success" | "info" | "neutral"; label: string } {
  const start = new Date(reservation.startDate);
  const end = new Date(reservation.endDate);
  if (reservation.status === "CANCELLED") return { tone: "neutral", label: "Cancelada" };
  if (reservation.status === "COMPLETED") return { tone: "neutral", label: "Finalizada" };
  if (start <= today && end >= today) return { tone: "success", label: "Activa" };
  if (start > today) return { tone: "info", label: "Próxima" };
  return { tone: "neutral", label: "Finalizada" };
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

  const allPayments = data.reservations.flatMap((r) =>
    r.payments.filter((p) => !p.deletedAt).map((p) => ({ ...p, reservation: r }))
  );

  // KPI 1: Ingresos Mensuales — suma de pagos COMPLETED con paidAt en el mes actual
  const monthStart = startOfMonth(today);
  const prevMonthStart = startOfMonth(addDays(monthStart, -1));
  const monthlyIncome = allPayments
    .filter(
      (p) =>
        p.status === "COMPLETED" &&
        p.paidAt &&
        new Date(p.paidAt) >= monthStart
    )
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const prevMonthIncome = allPayments
    .filter(
      (p) =>
        p.status === "COMPLETED" &&
        p.paidAt &&
        new Date(p.paidAt) >= prevMonthStart &&
        new Date(p.paidAt) < monthStart
    )
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const incomeChangePct =
    prevMonthIncome > 0
      ? Math.round(((monthlyIncome - prevMonthIncome) / prevMonthIncome) * 100)
      : monthlyIncome > 0
        ? 100
        : 0;
  const incomeChangeText =
    incomeChangePct > 0
      ? `+${incomeChangePct}% vs mes anterior`
      : incomeChangePct < 0
        ? `${incomeChangePct}% vs mes anterior`
        : "Sin cambio vs mes anterior";
  const incomeChangeVariant: "positive" | "warning" | "neutral" =
    incomeChangePct > 0 ? "positive" : incomeChangePct < 0 ? "warning" : "neutral";

  // KPI 2: Pagos Pendientes — count de PENDING + X vencidos
  const pendingPaymentsList = allPayments.filter((p) => p.status === "PENDING");
  const overdueCount = pendingPaymentsList.filter(
    (p) => p.dueDate && new Date(p.dueDate) < today
  ).length;

  // KPI 3: Próximas Reservas — count + X para esta semana (≤7 días)
  const next7Days = upcomingReservations.filter(
    (reservation) => daysBetween(today, reservation.startDate) <= 7
  ).length;

  // KPI 4: Ocupación
  const totalUnits = data.properties.reduce((sum, property) => sum + property.unitsAvailable, 0);
  const occupiedUnits = activeReservations.reduce(
    (sum, reservation) => sum + reservation.unitsBooked,
    0
  );
  const occupancyRate = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;

  // Cobranza: items derivados de collectionAlerts (vencidos + proximos7Dias ordenados)
  const collectionAlerts = classifyCollectionAlerts(
    data.reservations.flatMap((reservation) =>
      reservation.payments.map((payment) => ({
        id: payment.id,
        status: payment.status,
        paymentType: payment.paymentType ?? null,
        method: payment.method,
        amount: Number(payment.amount),
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

  const cobranzaItems: CobranzaItem[] = [
    ...collectionAlerts.vencidos.map<CobranzaItem>((alert) => ({
      reservationId: alert.reservationId,
      clientName: alert.clientName,
      amount: alert.amount,
      dueDate: alert.dueDate ? new Date(alert.dueDate) : null,
      isOverdue: true,
      propertyName: alert.propertyName,
    })),
    ...collectionAlerts.proximos7Dias.map<CobranzaItem>((alert) => ({
      reservationId: alert.reservationId,
      clientName: alert.clientName,
      amount: alert.amount,
      dueDate: alert.dueDate ? new Date(alert.dueDate) : null,
      isOverdue: false,
      propertyName: alert.propertyName,
    })),
  ].slice(0, 4);

  // Tabla Reservas Diarias: solo reservas DAILY (mezcla activas + próximas, top 6)
  const tableReservations = [...activeReservations, ...upcomingReservations]
    .filter((reservation) => reservation.billingType === "DAILY")
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
    .slice(0, 6);

  return (
    <div className="space-y-6 pb-10">
      {/* 1. Page header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Dashboard</h1>
          <p className="text-xs text-muted-foreground">Vista consolidada del estado operativo</p>
        </div>
        <Link href="/reservations/new" className={buttonVariants({ size: "sm" })}>
          <Plus className="h-3.5 w-3.5" />
          Nueva Reserva
        </Link>
      </div>

      {/* 2. KPI Grid (4 cards estilo Stitch) */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Ingresos Mensuales"
          value={formatCLP(monthlyIncome)}
          icon={Wallet}
          tone="success"
          indicator={{ text: incomeChangeText, variant: incomeChangeVariant }}
        />
        <KpiCard
          label="Pagos Pendientes"
          value={pendingPaymentsList.length}
          icon={Clock}
          tone={overdueCount > 0 ? "warning" : "default"}
          indicator={
            overdueCount > 0
              ? { text: `${overdueCount} vencidos`, variant: "warning" }
              : { text: "Al día", variant: "neutral" }
          }
        />
        <KpiCard
          label="Próximas Reservas"
          value={upcomingReservations.length}
          icon={CalendarCheck}
          tone="default"
          indicator={
            next7Days > 0
              ? { text: `${next7Days} para esta semana`, variant: "neutral" }
              : { text: "Sin check-ins próximos", variant: "neutral" }
          }
        />
        <KpiCard
          label="Ocupación Actual"
          value={`${occupancyRate}%`}
          icon={TrendingUp}
          tone="default"
          progressBar={{ value: occupancyRate }}
        />
      </section>

      {/* 3. 3-col grid: Reservas (table) + Cobranza (list) */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Reservas table — col-span-2 */}
        <div className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Reservas Diarias
            </h2>
            <Link href="/reservations" className="text-[10px] font-bold uppercase text-primary hover:underline">
              Ver todas
            </Link>
          </div>
          <DataTable
            headers={[
              "Propiedad",
              "Cliente",
              "Estancia",
              "Llegada/Salida",
              "Estado",
              { label: "Monto Total", align: "right" },
            ]}
            caption="Reservas diarias"
            emptyState={
              <p className="text-sm text-muted-foreground">Sin reservas para mostrar</p>
            }
          >
            {tableReservations.map((reservation) => {
              const start = new Date(reservation.startDate);
              const end = new Date(reservation.endDate);
              const isActive = start <= today && end >= today;
              const nights = getNights(reservation.startDate, reservation.endDate);
              const remainingDays = isActive
                ? daysBetween(today, reservation.endDate)
                : daysBetween(today, reservation.startDate);
              const arrivalLabel = isActive
                ? `Finaliza en ${remainingDays} ${remainingDays === 1 ? "día" : "días"}`
                : `Llega en ${remainingDays} ${remainingDays === 1 ? "día" : "días"}`;

              return (
                <tr key={reservation.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-6 py-4 text-xs font-bold text-foreground">{reservation.property.name}</td>
                  <td className="px-6 py-4 text-xs text-muted-foreground">{reservation.client.name}</td>
                  <td className="px-6 py-4">
                    <div className="whitespace-nowrap text-xs font-bold text-primary">
                      {formatDate(reservation.startDate)} - {formatDate(reservation.endDate)}
                    </div>
                    <div className="mt-1">
                      <span className="inline-flex rounded bg-muted px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-tight text-muted-foreground">
                        {nights} noches
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-xs text-muted-foreground">{arrivalLabel}</td>
                  <td className="px-6 py-4">
                    {(() => {
                      const pill = getReservationStatusPill(reservation, today);
                      return <ReservationPill tone={pill.tone} label={pill.label} />;
                    })()}
                  </td>
                  <td className="px-6 py-4 text-right text-xs font-bold text-foreground">
                    {formatCLP(Number(reservation.totalPrice))}
                  </td>
                </tr>
              );
            })}
          </DataTable>
        </div>

        {/* Cobranza list — col-1 */}
        <DashboardCobranzaList items={cobranzaItems} />
      </section>

      {/* 4. Calendario de ocupación — full width */}
      <OccupancyStrip reservations={data.reservations} properties={data.properties} days={14} />
    </div>
  );
}