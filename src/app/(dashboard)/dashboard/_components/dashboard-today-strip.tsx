import { Fragment } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { DashboardToday } from "@/lib/dashboard/summary";

interface DashboardTodayStripProps {
  today: DashboardToday;
}

function pluralize(n: number, singular: string, plural: string): string {
  return n === 1 ? singular : plural;
}

/** "1 día" / "12 días". */
function daysLabel(n: number): string {
  return `${n} ${pluralize(n, "día", "días")}`;
}

/**
 * Plazo de término de contrato. El caso `0` es el MÁS urgente de la línea y
 * es justo el que peor se lee con la forma genérica ("vence en 0 días"), así
 * que tiene copy propio.
 */
function endingLabel(daysToEnd: number): string {
  return daysToEnd === 0 ? "vence hoy" : `vence en ${daysLabel(daysToEnd)}`;
}

/**
 * Antigüedad de la reserva PENDING más vieja. Misma razón que `endingLabel`:
 * "hace 0 días" es una forma que nadie usa para decir "hoy".
 */
function oldestPendingLabel(days: number): string {
  return days === 0 ? "la más antigua, de hoy" : `la más antigua, hace ${daysLabel(days)}`;
}

/** Máximo de vencimientos de contrato visibles antes del sufijo "+N más". */
const MAX_MONTHLY_ENDING_VISIBLE = 2;

/**
 * Franja "Hoy" del dashboard — agenda del día en una sola línea por
 * categoría (hallazgo E1, `docs/plans/dashboard-improvement-plan.md`).
 *
 * Server Component (sin estado, sin interactividad) — las acciones sobre
 * cada movimiento (WhatsApp / marcar pagado / copiar link) son el hallazgo
 * E2 y quedan fuera de alcance.
 *
 * Cada línea es auto-anulable: solo se renderiza si tiene contenido. Si
 * todas quedan vacías, se muestra un único fallback muted — el componente
 * nunca retorna `null` (a diferencia de `PlanAlertBanner`, que sí lo hace,
 * porque esta franja es la agenda diaria, no una alerta de cuenta).
 *
 * Peso visual de FRANJA (no `<Card>` con header) — mismo tratamiento que
 * `PlanAlertBanner` (`rounded-lg border ... px-3 py-2`, `text-xs`), pero con
 * fondo NEUTRAL (`bg-muted/30`), no `warning`: esto no es una alerta, es la
 * agenda del día. El único lugar donde se permite `warning` es la línea de
 * vencimientos de contrato, y solo por ítem cuando `daysToEnd <= 7`.
 */
export function DashboardTodayStrip({ today }: DashboardTodayStripProps) {
  const {
    arrivals,
    departures,
    inStayCount,
    pendingConfirmationCount,
    oldestPendingConfirmationDays,
    activeMonthlyContracts,
    monthlyEndingSoon,
  } = today;

  const isEmpty =
    arrivals.length === 0 &&
    departures.length === 0 &&
    inStayCount === 0 &&
    pendingConfirmationCount === 0 &&
    activeMonthlyContracts === 0 &&
    monthlyEndingSoon.length === 0;

  const visibleEndings = monthlyEndingSoon.slice(0, MAX_MONTHLY_ENDING_VISIBLE);
  const remainingEndings = monthlyEndingSoon.length - visibleEndings.length;

  return (
    <div
      role="status"
      className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 sm:flex-row sm:gap-3"
    >
      <span className="shrink-0 pt-0.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        Hoy
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        {isEmpty && (
          <p className="text-xs text-muted-foreground">Sin llegadas ni salidas hoy</p>
        )}

        {arrivals.length > 0 && (
          <p className="text-xs text-foreground">
            <span className="font-bold">
              {arrivals.length} {pluralize(arrivals.length, "llegada", "llegadas")}
            </span>
            {": "}
            {arrivals.map((m, i) => (
              <Fragment key={m.reservationId}>
                {i > 0 && ", "}
                <Link
                  href={`/reservations/${m.reservationId}`}
                  className="hover:text-primary hover:underline"
                >
                  {m.clientName} · {m.propertyName}
                </Link>
              </Fragment>
            ))}
          </p>
        )}

        {departures.length > 0 && (
          <p className="text-xs text-foreground">
            <span className="font-bold">
              {departures.length} {pluralize(departures.length, "salida", "salidas")}
            </span>
            {": "}
            {departures.map((m, i) => (
              <Fragment key={m.reservationId}>
                {i > 0 && ", "}
                <Link
                  href={`/reservations/${m.reservationId}`}
                  className="hover:text-primary hover:underline"
                >
                  {m.clientName} · {m.propertyName}
                </Link>
              </Fragment>
            ))}
          </p>
        )}

        {inStayCount > 0 && (
          <p className="text-xs text-foreground">
            {inStayCount} {pluralize(inStayCount, "estadía en curso", "estadías en curso")}
          </p>
        )}

        {pendingConfirmationCount > 0 && (
          <p className="text-xs text-foreground">
            {pendingConfirmationCount}{" "}
            {pluralize(pendingConfirmationCount, "reserva por confirmar", "reservas por confirmar")}
            {oldestPendingConfirmationDays !== null && (
              <span className="text-muted-foreground">
                {" "}
                ({oldestPendingLabel(oldestPendingConfirmationDays)})
              </span>
            )}
          </p>
        )}

        {activeMonthlyContracts > 0 && (
          <p className="text-xs text-muted-foreground">
            {activeMonthlyContracts}{" "}
            {pluralize(activeMonthlyContracts, "contrato mensual", "contratos mensuales")}
          </p>
        )}

        {monthlyEndingSoon.length > 0 && (
          <p className="text-xs text-foreground">
            <span className="font-bold">
              {monthlyEndingSoon.length}{" "}
              {pluralize(monthlyEndingSoon.length, "vencimiento de contrato", "vencimientos de contrato")}
            </span>
            {": "}
            {visibleEndings.map((m, i) => (
              <Fragment key={m.reservationId}>
                {i > 0 && ", "}
                <Link
                  href={`/reservations/${m.reservationId}`}
                  className={cn(
                    "hover:underline",
                    m.daysToEnd <= 7
                      ? "font-semibold text-warning hover:text-warning"
                      : "hover:text-primary",
                  )}
                >
                  {m.propertyName} · {endingLabel(m.daysToEnd)}
                </Link>
              </Fragment>
            ))}
            {remainingEndings > 0 && (
              <span className="text-muted-foreground"> +{remainingEndings} más</span>
            )}
          </p>
        )}
      </div>
    </div>
  );
}
