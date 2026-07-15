import Link from "next/link";
import { Plus, Wallet, Clock, CalendarCheck, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { KpiCard } from "@/components/ui/kpi-card";
import { DataTable } from "@/components/ui/data-table";
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

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatDayShort(d: Date): string {
  return d.toLocaleDateString("es-CL", { day: "numeric", timeZone: "America/Santiago" });
}

function formatMonthShort(d: Date): string {
  return d.toLocaleDateString("es-CL", { month: "short", timeZone: "America/Santiago" }).replace(".", "");
}

function dayLetter(d: Date): string {
  return d.toLocaleDateString("es-CL", { weekday: "short", timeZone: "America/Santiago" }).charAt(0).toUpperCase();
}

const CALENDAR_DAYS = 14;
const WEEKEND_DAY_OF_WEEK = new Set([0, 6]); // Sun, Sat

interface CobranzaItem {
  reservationId: string;
  clientName: string;
  amount: number;
  dueDate: Date | null;
  isOverdue: boolean;
  propertyName: string;
}

function ReservationStatusBadge({ reservation, today }: { reservation: Reservation; today: Date }) {
  const start = new Date(reservation.startDate);
  const isActive = start <= today && new Date(reservation.endDate) >= today;

  if (isActive) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded bg-primary/10 px-2 py-1 text-[10px] font-bold uppercase text-primary">
        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
        Activa
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded border border-info/20 bg-info/10 px-2 py-1 text-[10px] font-bold uppercase text-info-foreground">
      <span className="h-1.5 w-1.5 rounded-full bg-info" />
      Próxima
    </span>
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

  const allPayments = data.reservations.flatMap((r) =>
    r.payments.filter((p) => !p.deletedAt).map((p) => ({ ...p, reservation: r }))
  );

  // KPI 1: Ingresos Mensuales — suma de pagos COMPLETED con paidAt en el mes actual
  const monthStart = startOfMonth(today);
  const monthlyIncome = allPayments
    .filter(
      (p) =>
        p.status === "COMPLETED" &&
        p.paidAt &&
        new Date(p.paidAt) >= monthStart
    )
    .reduce((sum, p) => sum + Number(p.amount), 0);

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

  // Calendario: rango de 14 días desde hoy
  const calendarStart = today;
  const calendarEnd = addDays(today, CALENDAR_DAYS - 1);
  const calendarDays: Date[] = Array.from({ length: CALENDAR_DAYS }, (_, i) => addDays(today, i));

  // Reservas que se solapan con el rango (solo DAILY)
  const calendarReservations = data.reservations.filter((reservation) => {
    const start = new Date(reservation.startDate);
    const end = new Date(reservation.endDate);
    return (
      start <= calendarEnd &&
      end >= calendarStart &&
      reservation.status !== "CANCELLED" &&
      reservation.billingType === "DAILY"
    );
  });

  const calendarProperties = data.properties
    .filter((property) =>
      calendarReservations.some((reservation) => reservation.propertyId === property.id)
    )
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
          indicator={{ text: "+0%", variant: "positive" }}
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
                    <ReservationStatusBadge reservation={reservation} today={today} />
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
        <div className="flex flex-col overflow-hidden rounded-lg border border-border bg-card">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Cobranza Reservas Mensuales
            </h2>
          </div>
          <div className="flex-1 p-4">
            {cobranzaItems.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">Sin cobros pendientes</p>
            ) : (
              <ul className="space-y-5">
                {cobranzaItems.map((item, idx) => (
                  <li key={`${item.reservationId}-${idx}`} className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-foreground">{item.clientName}</p>
                      {item.isOverdue ? (
                        <p className="text-[10px] font-bold text-destructive">
                          Vencido: {item.dueDate ? formatDate(item.dueDate.toISOString()) : "—"}
                        </p>
                      ) : (
                        <p className="text-[10px] text-muted-foreground">
                          Vence: {item.dueDate ? formatDate(item.dueDate.toISOString()) : "—"}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-foreground">{formatCLP(item.amount)}</p>
                      <span
                        className={
                          item.isOverdue
                            ? "text-[9px] font-bold uppercase text-destructive"
                            : "text-[9px] font-bold uppercase text-warning-foreground"
                        }
                      >
                        {item.isOverdue ? "Vencido" : "Pendiente"}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="border-t border-border bg-muted p-4">
            <Link
              href="/payments"
              className="flex w-full items-center justify-center rounded border border-border bg-card py-2 text-[10px] font-bold uppercase text-foreground transition-colors hover:bg-muted"
            >
              Gestionar Pagos
            </Link>
          </div>
        </div>
      </section>

      {/* 4. Calendario de ocupación — full width */}
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Calendario de ocupación
          </h2>
          <span className="text-[10px] font-bold text-foreground tabular-nums">
            {formatDayShort(calendarStart)} {formatMonthShort(calendarStart)} — {formatDayShort(calendarEnd)}{" "}
            {formatMonthShort(calendarEnd)}
          </span>
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-[1000px]">
            {/* Day headers */}
            <div className="flex border-b border-border bg-muted">
              <div className="sticky left-0 z-10 flex w-48 shrink-0 items-center border-r border-border bg-muted px-4 py-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Propiedad</span>
              </div>
              <div className="grid flex-1" style={{ gridTemplateColumns: `repeat(${CALENDAR_DAYS}, minmax(0, 1fr))` }}>
                {calendarDays.map((day) => {
                  const isWeekend = WEEKEND_DAY_OF_WEEK.has(day.getDay());
                  return (
                    <div
                      key={day.toISOString()}
                      className={`border-r border-border px-1 py-3 text-center last:border-r-0 ${isWeekend ? "bg-muted" : ""}`}
                    >
                      <span className="text-[10px] font-bold text-muted-foreground">
                        {formatDayShort(day)} {dayLetter(day)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
            {/* Property rows */}
            <div className="divide-y divide-border">
              {calendarProperties.length === 0 ? (
                <div className="px-6 py-8 text-center text-xs text-muted-foreground">Sin propiedades registradas</div>
              ) : (
                calendarProperties.map((property, propertyIdx) => {
                  const propReservations = calendarReservations.filter((r) => r.propertyId === property.id);
                  // Alternar variantes de verde por fila (par = sólido, impar = claro).
                  // Patrón Stitch: row 1/3 sólido bg-primary, row 2/4 claro bg-primary/10.
                  const isAltRow = propertyIdx % 2 === 1;
                  return (
                    <div key={property.id} className="group flex h-14 transition-colors hover:bg-muted/40">
                      <div className="sticky left-0 z-10 flex w-48 shrink-0 items-center border-r border-border bg-card px-4 group-hover:bg-muted/40">
                        <span className="truncate text-xs font-bold text-foreground">{property.name}</span>
                      </div>
                      <div
                        className="relative flex-1"
                        style={{ gridTemplateColumns: `repeat(${CALENDAR_DAYS}, minmax(0, 1fr))` }}
                      >
                        {/* Weekend highlight columns */}
                        {calendarDays.map((day) => {
                          if (!WEEKEND_DAY_OF_WEEK.has(day.getDay())) return null;
                          return null; // highlight is on header only in Stitch — keep row clean
                        })}
                        {/* Reservation pills */}
                        {propReservations.map((reservation) => {
                          const rStart = new Date(reservation.startDate);
                          const rEnd = new Date(reservation.endDate);
                          const visibleStart = rStart < calendarStart ? calendarStart : rStart;
                          const visibleEnd = rEnd > calendarEnd ? calendarEnd : rEnd;
                          const startOffset = Math.max(0, daysBetween(calendarStart, visibleStart.toISOString()));
                          const duration = daysBetween(visibleStart, visibleEnd.toISOString()) + 1;
                          const leftPct = (startOffset / CALENDAR_DAYS) * 100;
                          const widthPct = (duration / CALENDAR_DAYS) * 100;
                          const nights = getNights(reservation.startDate, reservation.endDate);
                          return (
                            <Link
                              key={reservation.id}
                              href={`/reservations?reservationId=${reservation.id}`}
                              className={`absolute top-3 bottom-3 z-0 flex cursor-pointer items-center justify-center overflow-hidden rounded px-3 transition-all hover:brightness-95 ${
                                isAltRow
                                  ? "border border-primary/20 bg-primary/10"
                                  : "bg-primary"
                              }`}
                              style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                            >
                              <div className="flex flex-col items-center gap-0.5 overflow-hidden">
                                <span
                                  className={`truncate text-[10px] font-bold ${
                                    isAltRow ? "text-primary" : "text-primary-foreground"
                                  }`}
                                >
                                  {reservation.client.name}
                                </span>
                                <span
                                  className={`text-[8px] font-bold uppercase tracking-tighter ${
                                    isAltRow ? "text-primary/80" : "text-primary-foreground/90"
                                  }`}
                                >
                                  {nights} noches
                                </span>
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}