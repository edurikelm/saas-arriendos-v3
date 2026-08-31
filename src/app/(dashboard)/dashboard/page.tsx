import Link from "next/link";
import { Plus, Wallet, Clock, CalendarCheck, TrendingUp, AlertCircle, RefreshCw } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { KpiCard } from "@/components/ui/kpi-card";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getDashboardSummary } from "@/lib/actions/dashboard";
import type { DashboardSummary, DashboardUpcomingReservation } from "@/lib/dashboard/summary";
import {
  getCurrentSubscriptionAction,
  countOwnerUsage,
} from "@/lib/actions/subscriptions";
import { requireOwner } from "@/lib/auth/guards";
import { ReservationPill } from "@/components/reservations/reservation-pill";
import { getReservationTone, getTemporalStatus } from "@/components/reservations/reservation-status";
import { OccupancyStrip } from "@/components/calendar/occupancy-strip";
import { PlanAlertBanner } from "@/components/billing/plan-alert-banner";
import { DashboardCobranzaList, type CobranzaItem } from "./_components/dashboard-cobranza-list";
import { DashboardReservasTable } from "./_components/dashboard-reservas-table";

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

/**
 * Renderiza una fila (`<tr>`) de la tabla "Agenda de reservas". Compartida
 * entre las vistas "Próximas" (`upcomingReservations`) y "Activas"
 * (`activeReservations`) — ambas usan el mismo shape de fila
 * (`DashboardUpcomingReservation`), así que un solo renderer evita duplicar
 * la lógica de formato entre las dos vistas.
 */
function renderReservationRow(reservation: DashboardUpcomingReservation) {
  // `daysToStart`/`daysToEnd`/`isActive`/`isArrivingToday`/`nights` ya vienen
  // precalculados por `buildDashboardSummary` (wall-time SCL, ADR-0020).
  const { daysToStart, daysToEnd, isActive, isArrivingToday, nights, months, installmentAmount } =
    reservation;
  const isMonthly = reservation.billingType === "MONTHLY";
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
  // Aplicado directo al rango de fechas (columna "Fechas"): ya no existe
  // una columna "Llegada/Salida" separada — era redundante con el sublabel
  // de "Estado" ("Llega en 5 días" vs. "Próxima" + "En 5 días" decían lo
  // mismo dos veces).
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
  );
  const statusLabel = temporalStatus.label;
  const statusSublabel = temporalStatus.sublabel;
  const statusTone = getReservationTone(
    reservation.status,
    reservation.startDate,
    reservation.endDate,
  );

  return (
    <tr
      key={reservation.id}
      data-testid={isArrivingToday ? "reservation-arriving-today" : undefined}
      className="border-b last:border-0 hover:bg-muted/30 transition-colors"
    >
      <td className="px-4 py-3">
        <Link
          href={`/reservations/${reservation.id}`}
          className="text-xs font-bold text-foreground hover:text-primary hover:underline"
        >
          {reservation.propertyName}
        </Link>
      </td>
      <td className="px-4 py-3 text-xs font-bold text-foreground">
        {reservation.clientName}
      </td>
      <td className="px-4 py-3">
        <div className={cn("whitespace-nowrap text-xs tabular-nums", arrivalTone)}>
          {formatDate(reservation.startDate)} - {formatDate(reservation.endDate)}
        </div>
        <div className="mt-1">
          <span className="inline-flex rounded bg-muted px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-tight text-muted-foreground">
            {isMonthly ? `${months} meses` : `${nights} noches`}
          </span>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className="inline-flex rounded bg-muted px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-tight text-muted-foreground">
          {isMonthly ? "Mensual" : "Diaria"}
        </span>
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
      <td className="px-4 py-3 text-right">
        {isMonthly && installmentAmount !== null ? (
          <>
            <div className="text-[13.5px] font-bold text-foreground tabular-nums">
              {formatCLP(installmentAmount)}
            </div>
            <div className="text-[9px] text-muted-foreground">/mes</div>
          </>
        ) : (
          <div className="text-[13.5px] font-bold text-foreground tabular-nums">
            {formatCLP(reservation.totalPrice)}
          </div>
        )}
      </td>
    </tr>
  );
}

export default async function DashboardPage() {
  // Load principal data defensively. Si getDashboardSummary lanza (o retorna
  // null por sesión inválida), la página renderiza un fallback honesto en
  // vez de un Next.js error page.
  let dashboardSummary: DashboardSummary | null = null;
  let dataLoadError: string | null = null;

  // Plan/subscription + usage: cargados aparte para no acoplar el try/catch
  // principal. Si fallan (raro), el dashboard sigue renderizando sin banner —
  // un banner ausente no es un error funcional.
  let subscription: Awaited<ReturnType<typeof getCurrentSubscriptionAction>> = null;
  let usage: Awaited<ReturnType<typeof countOwnerUsage>> = {
    properties: 0,
    clients: 0,
    propertiesLimit: 3,
    clientsLimit: 5,
  };

  const session = await requireOwner();

  try {
    dashboardSummary = await getDashboardSummary();
    if (!dashboardSummary) {
      dataLoadError = "No pudimos verificar tu sesión.";
    }
  } catch (err) {
    console.error("[dashboard] failed to load initial data", err);
    dataLoadError = err instanceof Error ? err.message : "No pudimos cargar tus datos.";
  }

  try {
    const [sub, usageResult] = await Promise.all([
      getCurrentSubscriptionAction(),
      countOwnerUsage(session.userId),
    ]);
    subscription = sub;
    usage = usageResult;
  } catch (err) {
    console.error("[dashboard] failed to load plan/usage data", err);
    // No-op: seguimos con defaults; el banner no se renderiza (variante null).
  }

  // Fallback de error: el dashboard es el home diario — un white-screen destruye
  // confianza. Renderizamos un Card con mensaje claro + CTA reintentar / soporte.
  if (dataLoadError || !dashboardSummary) {
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
              {dataLoadError ?? "No pudimos cargar tus datos."}
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

  const { income, collection, upcoming, occupancy, upcomingReservations, activeReservations, collectionItems, occupancyStrip } =
    dashboardSummary;

  const cobranzaItems: CobranzaItem[] = collectionItems.map((item) => ({
    reservationId: item.reservationId,
    clientName: item.clientName,
    amount: item.amount,
    dueDate: item.dueDate ? new Date(item.dueDate) : null,
    daysFromToday: item.daysFromToday,
    bucket: item.bucket,
    propertyName: item.propertyName,
    overdueCount: item.overdueCount,
    dueSoonCount: item.dueSoonCount,
    dueSoonDaysFromToday: item.dueSoonDaysFromToday,
  }));

  // El card muestra el top `collectionLimit` (default 4), pero el footer
  // reporta el total real de vencido+hoy+próximos 7 días — mostrar la suma
  // de los items visibles mentiría cuando hay más cobros abiertos en esa
  // ventana. `collection.pendingCount`/`totalToCollect` NO sirven aquí:
  // cubren TODA deuda pendiente sin ventana de tiempo (incluye cobros a
  // 30+ días), que es un scope más amplio que lo que esta lista muestra.
  // `windowAmount`/`windowCount` vienen precalculados de `buildDashboardSummary`
  // (`@/lib/dashboard/summary`, `amountForRow`) — reemplaza el cálculo local
  // anterior (`overdueAmount + dueTodayAmount + upcoming7dAmount`), que
  // sub-contaba una reserva OVERDUE con cuotas adicionales por vencer dentro
  // de los 7 días (colapsaba varias cuotas MONTHLY en una sola fila).

  // Subtitle data-driven: prioriza la señal más accionable para el dueño.
  // El conteo de "cuotas vencidas" (no de reservas) viene de
  // `collection.overdueInstallmentsCount`, alineado con el banner de detalle
  // de reserva ("Tienes N cuotas vencidas").
  const subtitleText =
    collection.overdueCount > 0
      ? `Tienes ${collection.overdueInstallmentsCount} ${collection.overdueInstallmentsCount === 1 ? "cuota vencida" : "cuotas vencidas"} por ${formatCLP(collection.overdueAmount)}`
      : upcoming.next7Days > 0
        ? `Todo al día. ${upcoming.next7Days} ${upcoming.next7Days === 1 ? "check-in" : "check-ins"} esta semana.`
        : upcoming.total > 0
          ? `Todo al día. ${upcoming.total} ${upcoming.total === 1 ? "reserva en puerta" : "reservas en puerta"}.`
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

      {/* 1b. Plan alert banner — solo aparece si FREE cerca del límite
            o CANCELLED con período vigente. self-nulling en estado estable. */}
      <PlanAlertBanner subscription={subscription} usage={usage} />

      {/* 2. KPI Grid (4 cards estilo Stitch).
            Mobile: 2 columnas (2x2 grid) para reducir la altura antes de
            "Agenda de reservas", que es la sección accionable prioritaria
            del dashboard. Tablet/Desktop: 4 columnas. */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4 sm:gap-4">
        <KpiCard
          label="Ingresos Mensuales"
          value={formatCLP(income.currentMonth)}
          icon={Wallet}
          tone="success"
          indicator={{ text: income.delta.text, variant: income.delta.variant }}
        />
        <KpiCard
          label="Pagos Pendientes"
          value={collection.pendingCount}
          icon={Clock}
          tone={collection.overdueCount > 0 ? "warning" : "default"}
          indicator={
            collection.overdueCount > 0
              ? { text: `${collection.overdueInstallmentsCount} vencidos`, variant: "warning" }
              : { text: "Al día", variant: "neutral" }
          }
        />
        <KpiCard
          label="Próximas Reservas"
          value={upcoming.total}
          icon={CalendarCheck}
          tone="default"
          indicator={
            upcoming.next7Days > 0
              ? { text: `${upcoming.next7Days} para esta semana`, variant: "neutral" }
              : { text: "Sin check-ins próximos", variant: "neutral" }
          }
        />
        <KpiCard
          label="Ocupación Actual"
          value={`${occupancy.rate}%`}
          icon={TrendingUp}
          tone="default"
          progressBar={{ value: occupancy.rate }}
        />
      </section>

      {/* 3. 2-col grid (desktop): Agenda de reservas (table) + Cobros pendientes (list).
             Cambiamos de 3-col (col-span-2 + col-span-1) a 2-col (col-span-3 + col-span-1)
             porque la tabla de 6 columnas necesita más ancho que el col-span-2 original
             ofrecía (~640px). En mobile (col-span-1) la sidebar cae debajo de la tabla. */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        {/* Agenda de reservas table — col-span-3 */}
        <div className="lg:col-span-3">
          <DashboardReservasTable
            title="Agenda de reservas"
            viewAllHref="/reservations"
            proximas={upcomingReservations.map(renderReservationRow)}
            activas={activeReservations.map(renderReservationRow)}
            emptyProximas={
              <div className="flex flex-col items-center gap-2 text-center">
                <CalendarCheck className="size-5 text-muted-foreground" aria-hidden="true" />
                <p className="text-xs font-bold text-foreground">Sin reservas próximas</p>
                <p className="text-[10px] text-muted-foreground">
                  No hay reservas por llegar en los próximos días. Revisa el
                  detalle completo en{" "}
                  <Link href="/reservations" className="font-bold text-primary hover:underline">
                    /reservations
                  </Link>
                  .
                </p>
              </div>
            }
            emptyActivas={
              <div className="flex flex-col items-center gap-2 text-center">
                <CalendarCheck className="size-5 text-muted-foreground" aria-hidden="true" />
                <p className="text-xs font-bold text-foreground">Sin reservas activas</p>
                <p className="text-[10px] text-muted-foreground">
                  No hay reservas en curso hoy. Revisa el detalle completo en{" "}
                  <Link href="/reservations" className="font-bold text-primary hover:underline">
                    /reservations
                  </Link>
                  .
                </p>
              </div>
            }
          />
        </div>

        {/* Cobranza list — col-1 */}
        <DashboardCobranzaList
          items={cobranzaItems}
          viewAllHref="/payments"
          totalAmount={collection.windowAmount}
          totalCount={collection.windowCount}
        />
      </section>

      {/* 4. Calendario de ocupación — full width */}
      <OccupancyStrip
        reservations={occupancyStrip.reservations}
        properties={occupancyStrip.properties}
        days={14}
        viewAllHref="/calendar"
      />
    </div>
  );
}
