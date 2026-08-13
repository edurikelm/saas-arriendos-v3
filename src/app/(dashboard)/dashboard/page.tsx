import Link from "next/link";
import { Plus, Wallet, Clock, CalendarCheck, TrendingUp, AlertCircle, RefreshCw } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { KpiCard } from "@/components/ui/kpi-card";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { classifyCollectionAlerts } from "@/lib/alerts/collection-alerts";
import { getProperties } from "@/lib/actions/properties";
import { getReservations } from "@/lib/actions/reservations";
import { ReservationPill } from "@/components/reservations/reservation-pill";
import {
  daysUntilEnd,
  daysUntilStart,
  getNights,
  getReservationTone,
  getTemporalStatus,
  labelDaysUntilEnd,
  labelDaysUntilStart,
} from "@/components/reservations/reservation-status";
import { OccupancyStrip } from "@/components/calendar/occupancy-strip";
import { DashboardCobranzaList, type CobranzaItem } from "./_components/dashboard-cobranza-list";
import { DashboardReservasTable } from "./_components/dashboard-reservas-table";

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

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addDays(d: Date, n: number): Date {
  const result = new Date(d);
  result.setDate(result.getDate() + n);
  return result;
}

export default async function DashboardPage() {
  // Load principal data defensively. Si getReservations o getProperties lanzan,
  // la página renderiza un fallback honesto en vez de un Next.js error page.
  let reservations: Reservation[] = [];
  let properties: Property[] = [];
  let dataLoadError: string | null = null;

  try {
    const [reservationsResult, propertiesResult] = await Promise.all([
      getReservations(),
      getProperties(),
    ]);
    reservations = (reservationsResult as unknown as { data: Reservation[] }).data ?? [];
    properties = (propertiesResult as unknown as Property[]) ?? [];
  } catch (err) {
    console.error("[dashboard] failed to load initial data", err);
    dataLoadError = err instanceof Error ? err.message : "No pudimos cargar tus datos.";
  }

  const today = new Date();

  // Fallback de error: el dashboard es el home diario — un white-screen destruye
  // confianza. Renderizamos un Card con mensaje claro + CTA reintentar / soporte.
  if (dataLoadError) {
    return (
      <div className="space-y-6 pb-10">
        <div>
          <h1 className="text-xl font-bold text-foreground tracking-tight">Dashboard</h1>
          <p className="text-xs text-muted-foreground">Sin conexión con el servidor</p>
        </div>
        <Card className="ring-1 ring-foreground/10">
          <CardHeader>
            <div className="flex items-start gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-warning/10 text-warning">
                <AlertCircle className="size-4" />
              </div>
              <div className="space-y-1">
                <CardTitle>No pudimos cargar tus datos</CardTitle>
                <CardDescription>
                  Tus datos están seguros. Volvemos a intentar al recargar la página.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">
              {dataLoadError}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Link href="/dashboard" className={buttonVariants({ size: "sm" })}>
                <RefreshCw className="size-3.5" />
                Reintentar
              </Link>
              <Link href="/support" className={buttonVariants({ variant: "outline", size: "sm" })}>
                Contactar soporte
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const data = { reservations, properties };

  // activeReservations: hoy ∈ [start, end] (wall-time SCL per ADR-0020).
  // Antes el filtro usaba `new Date(startDate) <= today` (con `today` en local midnight),
  // lo cual era timezone-frágil: en zonas UTC+, una reserva con start_date = hoy
  // caía en upcomingReservations en lugar de activeReservations.
  const activeReservations = data.reservations
    .filter((reservation) => {
      if (reservation.status === "CANCELLED") return false;
      const daysToStart = daysUntilStart(reservation.startDate, today);
      const daysToEnd = daysUntilEnd(reservation.endDate, today);
      return daysToStart <= 0 && daysToEnd >= 0;
    })
    .sort((a, b) => daysUntilEnd(a.endDate, today) - daysUntilEnd(b.endDate, today));

  const upcomingReservations = data.reservations
    .filter((reservation) => {
      if (reservation.status === "CANCELLED") return false;
      return daysUntilStart(reservation.startDate, today) > 0;
    })
    .sort((a, b) => daysUntilStart(a.startDate, today) - daysUntilStart(b.startDate, today));

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
    (reservation) => daysUntilStart(reservation.startDate, today) <= 7
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

  // Tabla Próximas reservas: solo reservas DAILY (mezcla activas + próximas, top 6).
  // Las reservas MONTHLY no aparecen aquí — se gestionan en /reservations.
  //
  // Orden de filas (jerarquía descendente):
  //   1) Reservas que LLEGAN HOY (`daysToStart === 0`) — la señal más accionable
  //      del día; van arriba con highlight visual. Entre ellas, las que terminan
  //      antes primero (la atención puede ser check-in + check-out el mismo día).
  //   2) Reservas activas (`daysToStart < 0`, ya están en curso), ordenadas por
  //      fecha de salida ascendente (las que terminan antes primero).
  //   3) Reservas próximas (futuras), ordenadas por días faltantes ascendente.
  // Las comparaciones son en wall-time SCL per ADR-0020 — no se reinterpretan
  // fechas como UTC. Este sort es SOLO para la tabla — los KPIs
  // (activeReservations, upcomingReservations) siguen el cómputo original arriba.
  const tableReservations = [...activeReservations, ...upcomingReservations]
    .filter((reservation) => reservation.billingType === "DAILY")
    .map((reservation) => {
      const daysToStart = daysUntilStart(reservation.startDate, today);
      const daysToEnd = daysUntilEnd(reservation.endDate, today);
      const isActive = daysToStart <= 0 && daysToEnd >= 0;
      const isArrivingToday = daysToStart === 0;
      return { reservation, isActive, isArrivingToday, daysToStart, daysToEnd };
    })
    .sort((a, b) => {
      if (a.isArrivingToday !== b.isArrivingToday) {
        return a.isArrivingToday ? -1 : 1;
      }
      if (a.isArrivingToday && b.isArrivingToday) {
        // Entre las que llegan hoy, las que terminan antes primero (puede haber
        // check-out el mismo día).
        return a.daysToEnd - b.daysToEnd;
      }
      if (a.isActive !== b.isActive) {
        return a.isActive ? -1 : 1;
      }
      if (a.isActive && b.isActive) {
        return a.daysToEnd - b.daysToEnd;
      }
      return a.daysToStart - b.daysToStart;
    })
    .slice(0, 6)
    .map((entry) => entry.reservation);

  // Subtitle data-driven: prioriza la señal más accionable para el dueño.
  const overdueAmount = collectionAlerts.vencidos.reduce((sum, a) => sum + a.amount, 0);
  const subtitleText =
    overdueCount > 0
      ? `Tienes ${overdueCount} ${overdueCount === 1 ? "cobro vencido" : "cobros vencidos"} por ${formatCLP(overdueAmount)}`
      : next7Days > 0
        ? `Todo al día. ${next7Days} ${next7Days === 1 ? "check-in" : "check-ins"} esta semana.`
        : upcomingReservations.length > 0
          ? `Todo al día. ${upcomingReservations.length} ${upcomingReservations.length === 1 ? "reserva en puerta" : "reservas en puerta"}.`
          : "Sin reservas próximas. Crea una para empezar.";

  return (
    <div className="space-y-6 pb-10">
      {/* 1. Page header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground tracking-tight">Dashboard</h1>
          <p className="text-xs text-muted-foreground">{subtitleText}</p>
        </div>
        <Link href="/reservations?create=true" className={buttonVariants({ size: "sm" })}>
          <Plus className="h-3.5 w-3.5" />
          Nueva Reserva
        </Link>
      </div>

      {/* 2. KPI Grid (4 cards estilo Stitch).
            Mobile: 2 columnas (2x2 grid) para reducir la altura antes de "Próximas
            reservas", que es la sección accionable prioritaria del dashboard.
            Tablet/Desktop: 4 columnas. */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4 sm:gap-4">
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

      {/* 3. 2-col grid (desktop): Próximas reservas (table) + Cobros pendientes (list).
             Cambiamos de 3-col (col-span-2 + col-span-1) a 2-col (col-span-3 + col-span-1)
             porque la tabla de 6 columnas necesita más ancho que el col-span-2 original
             ofrecía (~640px). En mobile (col-span-1) la sidebar cae debajo de la tabla. */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        {/* Próximas reservas table — col-span-3 */}
        <div className="lg:col-span-3">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Próximas reservas
            </h2>
            <Link href="/reservations" className="text-[10px] font-bold uppercase text-primary hover:underline">
              Ver todas
            </Link>
          </div>
          <DashboardReservasTable
            caption="Próximas reservas"
            emptyState={
              <div className="py-6 text-center">
                <p className="text-sm text-muted-foreground">No hay reservas próximas.</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Las reservas mensuales se gestionan en{" "}
                  <Link href="/reservations" className="font-medium text-primary hover:underline">
                    /reservations
                  </Link>
                  .
                </p>
              </div>
            }
          >
            {tableReservations.map((reservation) => {
              // Per ADR-0020: status, days restantes y label se calculan en wall-time SCL.
              // Antes: `start <= today && end >= today` con `today` en local midnight
              // era timezone-frágil → reserva con start_date = hoy podía caer en
              // "Llega en 1 día" en zonas UTC+.
              const daysToStart = daysUntilStart(reservation.startDate, today);
              const daysToEnd = daysUntilEnd(reservation.endDate, today);
              const isActive = daysToStart <= 0 && daysToEnd >= 0;
              // "Llega hoy" = el huésped hace check-in HOY (start_date = hoy en SCL),
              // sin importar cuándo termina. Esto es operativamente distinto de
              // "Activa" (huésped ya está durmiendo) y es la señal más urgente para
              // el dueño: preparar check-in, llaves, limpieza. La lógica de
              // activeReservations / upcomingReservations arriba NO se altera — los
              // KPIs siguen considerando la reserva como activa (ocupa unidades hoy),
              // pero en la tabla la destacamos por encima del resto.
              const isArrivingToday = daysToStart === 0;
              const nights = getNights(reservation.startDate, reservation.endDate);
              const arrivalLabel = isArrivingToday
                ? "Llega hoy"
                : isActive
                  ? `Finaliza ${labelDaysUntilEnd(reservation.endDate, today)}`
                  : `Llega ${labelDaysUntilStart(reservation.startDate, today)}`;
              // Codificamos DOS dimensiones semánticas con atributos visuales distintos
              // para que el dueño pueda escanear tanto la dirección (llega vs sale)
              // como la urgencia (hoy vs pronto vs lejano) sin ambigüedad:
              //
              //   DIRECCIÓN → color
              //     llegadas (check-in)    → primary  (teal)
              //     salidas  (check-out)   → warning  (naranja)
              //
              //   URGENCIA → peso
              //     hoy                    → font-bold
              //     1-2 días               → font-medium
              //     ≥3 días                → normal   (sin bold/medium)
              //
              // Reutilizado por el <td> Llegada/Salida (desktop) y el mini-label bajo
              // el nombre de propiedad (mobile, cuando la columna está oculta).
              const arrivalTone = isArrivingToday
                ? "font-bold text-primary"
                : isActive
                  ? daysToEnd === 0
                    ? "font-bold text-warning"
                    : daysToEnd <= 2
                      ? "font-medium text-warning"
                      : "text-muted-foreground"
                  : daysToStart <= 2
                    ? "font-medium text-primary"
                    : "text-muted-foreground";
              const temporalStatus = getTemporalStatus(
                reservation.startDate,
                reservation.endDate,
                reservation.billingType,
                reservation.status,
                today,
              );
              const statusLabel = temporalStatus.label;
              const statusSublabel = temporalStatus.sublabel;
              const statusTone = getReservationTone(
                reservation.status,
                reservation.startDate,
                reservation.endDate,
                today,
              );

              return (
                <tr
                  key={reservation.id}
                  data-testid={isArrivingToday ? "reservation-arriving-today" : undefined}
                  className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <Link
                        href={`/reservations/${reservation.id}`}
                        className="text-xs font-bold text-foreground hover:text-primary hover:underline"
                      >
                        {reservation.property.name}
                      </Link>
                      {/* Mini-label mobile: muestra el mismo arrivalLabel que la columna
                          Llegada/Salida en desktop (que está oculta en <sm). El color
                          sigue arrivalTone, así la jerarquía de urgencia se conserva. */}
                      <span
                        className={cn(
                          "sm:hidden w-fit text-[10px] uppercase tracking-wider",
                          arrivalTone
                        )}
                        aria-label={arrivalLabel}
                      >
                        {arrivalLabel}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {reservation.client.name}
                  </td>
                  <td className="px-4 py-3">
                    <div className="whitespace-nowrap text-xs font-bold text-foreground tabular-nums">
                      {formatDate(reservation.startDate)} - {formatDate(reservation.endDate)}
                    </div>
                    <div className="mt-1">
                      <span className="inline-flex rounded bg-muted px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-tight text-muted-foreground">
                        {nights} noches
                      </span>
                    </div>
                  </td>
                  <td
                    className={cn(
                      "hidden sm:table-cell px-4 py-3 text-xs",
                      arrivalTone
                    )}
                  >
                    {arrivalLabel}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col items-start gap-1">
                      <ReservationPill tone={statusTone} label={statusLabel} />
                      {statusSublabel && (
                        <span className="text-[9px] text-muted-foreground">
                          {statusSublabel}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-xs font-bold text-foreground tabular-nums">
                    {formatCLP(Number(reservation.totalPrice))}
                  </td>
                </tr>
              );
            })}
          </DashboardReservasTable>
        </div>

        {/* Cobranza list — col-1 */}
        <DashboardCobranzaList items={cobranzaItems} viewAllHref="/payments" />
      </section>

      {/* 4. Calendario de ocupación — full width */}
      <OccupancyStrip
        reservations={data.reservations}
        properties={data.properties}
        days={14}
        viewAllHref="/calendar"
      />
    </div>
  );
}