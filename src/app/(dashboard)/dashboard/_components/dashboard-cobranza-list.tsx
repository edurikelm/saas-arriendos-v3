import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { ReservationPill, type PillTone } from "@/components/reservations/reservation-pill";
import { cn } from "@/lib/utils";
import { formatDateOnly } from "@/lib/domain/timezone";

/**
 * Bucket de cobranza — alineado 1:1 con `DashboardCollectionBucket`
 * (`@/lib/dashboard/summary`). Redefinido localmente para no acoplar este
 * componente puramente presentacional al seam de dominio.
 */
export type CobranzaBucket = "OVERDUE" | "DUE_TODAY" | "UPCOMING_7D";

/**
 * Urgencia de un cobro. Dos colores, no tres: `info` (per DESIGN.md, "próximos
 * 7 días") describe estados neutrales — duración DAILY/MONTHLY, próximo
 * check-in — no dinero pendiente de cobro. Un cobro que vence en 5 días sigue
 * siendo una acción pendiente, no un dato de contexto; pintarlo `info` lo
 * hace leer como no-urgente cuando en realidad solo es "menos urgente que
 * hoy". La distinción de urgencia entre "hoy" y "en N días" la carga el
 * label y el peso del texto de vencimiento, no el color de la pill:
 *   VENCIDO                    → destructive
 *   VENCE HOY / próximos 7 días → warning
 *
 * Reemplaza al antiguo boolean `isOverdue`, que colapsaba "vence hoy" y
 * "vence en 7 días" en un único estado "Pendiente" pintado con `warning`
 * (mismo resultado de color, pero sin distinguir "hoy" en el label).
 */
export type CobranzaUrgency = "overdue" | "today" | "upcoming";

export interface CobranzaItem {
  reservationId: string;
  clientName: string;
  propertyName: string;
  amount: number;
  dueDate: Date | null;
  /** Días desde hoy hasta el vencimiento (negativo = vencido). Wall-time SCL per ADR-0020. */
  daysFromToday: number;
  urgency: CobranzaUrgency;
}

const URGENCY_TONE: Record<CobranzaUrgency, PillTone> = {
  overdue: "destructive",
  today: "warning",
  upcoming: "warning",
};

const URGENCY_LABEL: Record<CobranzaUrgency, string> = {
  overdue: "Vencido",
  today: "Vence hoy",
  upcoming: "Pendiente",
};

/**
 * Color del texto de vencimiento. Usa `*-foreground` (el token legible sobre
 * card, oscuro en light / claro en dark) y NO `--warning`, que es el token de
 * relleno: a 0.78 de lightness sobre card blanco no alcanza contraste AA.
 */
const URGENCY_TEXT: Record<CobranzaUrgency, string> = {
  overdue: "text-destructive",
  today: "text-warning-foreground",
  upcoming: "text-muted-foreground",
};

function formatCLP(amount: number): string {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(date: Date | null): string {
  return formatDateOnly(date, { day: "numeric", month: "short" });
}

/**
 * Línea de vencimiento: relativo primero (accionable), absoluto después (verificable).
 * "Vence en 3 días · 1 sept" escanea mejor que "Vence: 1 sept", que obliga al dueño
 * a calcular la urgencia mentalmente.
 */
function dueLabel(daysFromToday: number, dueDate: Date | null): string {
  const relative =
    daysFromToday < -1
      ? `Venció hace ${Math.abs(daysFromToday)} días`
      : daysFromToday === -1
        ? "Venció ayer"
        : daysFromToday === 0
          ? "Vence hoy"
          : daysFromToday === 1
            ? "Vence mañana"
            : `Vence en ${daysFromToday} días`;

  return dueDate ? `${relative} · ${formatDate(dueDate)}` : relative;
}

interface DashboardCobranzaListProps {
  items: CobranzaItem[];
  /**
   * Si se provee, el título se renderiza como bloque standalone AFUERA del card,
   * junto con un link "Ver todas" que apunta a esta URL (alineado con el patrón
   * canónico de `/dashboard` sección "Próximas reservas"). Si se omite, el título
   * se mantiene dentro del card (back-compat).
   */
  viewAllHref?: string;
  /** Label del link "Ver todas". Default: "Ver todas". */
  viewAllLabel?: string;
  /**
   * Total y cantidad de TODOS los cobros pendientes, no solo los visibles.
   * `items` viene truncado (top 4), así que derivarlo de `items` mentiría cuando
   * hay más cobros de los que caben. Si se omite, se deriva de `items`.
   */
  totalAmount?: number;
  totalCount?: number;
}

/**
 * Compact cobranza sidebar for /dashboard. Shows up to 4 items ordered by urgency
 * (vencidos → vencen hoy → próximos 7 días), each with client, propiedad, monto y
 * vencimiento relativo. Cada fila es un link a la reserva — la sección es una
 * lista de pendientes, no un reporte de solo lectura.
 *
 * Standalone primitive — no server data fetching; data is computed by the
 * dashboard page and passed as props.
 */
export function DashboardCobranzaList({
  items,
  viewAllHref,
  viewAllLabel = "Ver todas",
  totalAmount,
  totalCount,
}: DashboardCobranzaListProps) {
  const resolvedCount = totalCount ?? items.length;
  const resolvedTotal =
    totalAmount ?? items.reduce((sum, item) => sum + item.amount, 0);

  return (
    <section aria-labelledby="cobros-pendientes-heading">
      {viewAllHref && (
        <div className="mb-4 flex items-center justify-between">
          <h2
            id="cobros-pendientes-heading"
            className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground"
          >
            Cobros pendientes
          </h2>
          <Link
            href={viewAllHref}
            className="text-[10px] font-bold uppercase text-primary hover:underline"
          >
            {viewAllLabel}
          </Link>
        </div>
      )}
      <div className="flex flex-col overflow-hidden rounded-md border border-border bg-card">
        {viewAllHref ? null : (
          <div className="border-b border-border px-4 py-3">
            <h2
              id="cobros-pendientes-heading"
              className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground"
            >
              Cobros pendientes
            </h2>
          </div>
        )}
        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <CheckCircle2 className="size-5 text-success" aria-hidden="true" />
            <p className="text-xs font-bold text-foreground">Sin cobros pendientes</p>
            <p className="text-[10px] text-muted-foreground">
              No hay vencimientos en los próximos 7 días.
            </p>
          </div>
        ) : (
          <>
            <ul className="divide-y divide-border">
              {items.map((item, idx) => (
                <li key={`${item.reservationId}-${idx}`}>
                  <Link
                    href={`/reservations/${item.reservationId}`}
                    aria-label={`${item.clientName} — ${formatCLP(item.amount)} — ${URGENCY_LABEL[item.urgency]}`}
                    className="flex items-start justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold text-foreground">
                        {item.clientName}
                      </p>
                      <p className="truncate text-[10px] text-muted-foreground">
                        {item.propertyName}
                      </p>
                      <p
                        className={cn("mt-0.5 text-[10px] tabular-nums", URGENCY_TEXT[item.urgency])}
                      >
                        {dueLabel(item.daysFromToday, item.dueDate)}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <p className="text-xs font-bold text-foreground tabular-nums">
                        {formatCLP(item.amount)}
                      </p>
                      <ReservationPill
                        tone={URGENCY_TONE[item.urgency]}
                        label={URGENCY_LABEL[item.urgency]}
                      />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between gap-3 border-t border-border bg-muted/30 px-4 py-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Total · {resolvedCount} {resolvedCount === 1 ? "cobro" : "cobros"}
              </span>
              <span className="text-xs font-bold text-foreground tabular-nums">
                {formatCLP(resolvedTotal)}
              </span>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
