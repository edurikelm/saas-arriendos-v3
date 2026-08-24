import Link from "next/link";
import { Plus, Wallet, Clock, CalendarCheck, TrendingUp, AlertCircle, RefreshCw } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { KpiCard } from "@/components/ui/kpi-card";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getDashboardSummary } from "@/lib/actions/dashboard";
import type { DashboardSummary } from "@/lib/dashboard/summary";
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
 * Etiqueta relativa "Mañana"/"Pasado mañana"/"En N días" a partir de un
 * conteo de días ya calculado (wall-time SCL) por `buildDashboardSummary`.
 * Puramente presentacional — no recalcula fechas, solo formatea el número
 * que ya viene en `daysToStart`/`daysToEnd`. Réplica del wording de
 * `labelDaysUntilStart`/`labelDaysUntilEnd` (reservation-status.ts) sin
 * necesitar `now` en este Server Component.
 */
function relativeDayLabel(days: number): string {
  if (days <= 0) return "Hoy";
  if (days === 1) return "Mañana";
  if (days === 2) return "Pasado mañana";
  return `En ${days} días`;
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

  const { income, collection, upcoming, occupancy, upcomingReservations, collectionItems, occupancyStrip } =
    dashboardSummary;

  const cobranzaItems: CobranzaItem[] = collectionItems.map((item) => ({
    reservationId: item.reservationId,
    clientName: item.clientName,
    amount: item.amount,
    dueDate: item.dueDate ? new Date(item.dueDate) : null,
    bucket: item.bucket,
    propertyName: item.propertyName,
  }));

  // Subtitle data-driven: prioriza la señal más accionable para el dueño.
  const subtitleText =
    collection.overdueCount > 0
      ? `Tienes ${collection.overdueCount} ${collection.overdueCount === 1 ? "cobro vencido" : "cobros vencidos"} por ${formatCLP(collection.overdueAmount)}`
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
            Mobile: 2 columnas (2x2 grid) para reducir la altura antes de "Próximas
            reservas", que es la sección accionable prioritaria del dashboard.
            Tablet/Desktop: 4 columnas. */}
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
              ? { text: `${collection.overdueCount} vencidos`, variant: "warning" }
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
            {upcomingReservations.map((reservation) => {
              // `daysToStart`/`daysToEnd`/`isActive`/`isArrivingToday`/`nights` ya vienen
              // precalculados por `buildDashboardSummary` (wall-time SCL, ADR-0020).
              const { daysToStart, daysToEnd, isActive, isArrivingToday, nights } = reservation;
              const arrivalLabel = isArrivingToday
                ? "Llega hoy"
                : isActive
                  ? `Finaliza ${relativeDayLabel(daysToEnd)}`
                  : `Llega ${relativeDayLabel(daysToStart)}`;
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
                    <div className="flex flex-col gap-1">
                      <Link
                        href={`/reservations/${reservation.id}`}
                        className="text-xs font-bold text-foreground hover:text-primary hover:underline"
                      >
                        {reservation.propertyName}
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
                    {reservation.clientName}
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
                    {formatCLP(reservation.totalPrice)}
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
        reservations={occupancyStrip.reservations}
        properties={occupancyStrip.properties}
        days={14}
        viewAllHref="/calendar"
      />
    </div>
  );
}
