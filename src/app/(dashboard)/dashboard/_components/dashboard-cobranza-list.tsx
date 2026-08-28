import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { ReservationPill, type PillTone } from "@/components/reservations/reservation-pill";
import { cn } from "@/lib/utils";
import { formatDateOnly } from "@/lib/domain/timezone";

/**
 * Bucket de cobranza — alineado 1:1 con `DashboardCollectionBucket`
 * (`@/lib/dashboard/summary`). Redefinido localmente para no acoplar este
 * componente puramente presentacional al seam de dominio.
 *
 * Dos colores, no tres: `info` (per DESIGN.md, "próximos 7 días") describe
 * estados neutrales — duración DAILY/MONTHLY, próximo check-in — no dinero
 * pendiente de cobro. Un cobro que vence en 5 días sigue siendo una acción
 * pendiente, no un dato de contexto; pintarlo `info` lo hace leer como
 * no-urgente cuando en realidad solo es "menos urgente que hoy". La
 * distinción de urgencia entre "hoy" y "en N días" la carga el label y el
 * peso del texto de vencimiento, no el color de la pill:
 *   OVERDUE                 → destructive
 *   DUE_TODAY / UPCOMING_7D → warning
 */
export type CobranzaBucket = "OVERDUE" | "DUE_TODAY" | "UPCOMING_7D";

export interface CobranzaItem {
  reservationId: string;
  clientName: string;
  propertyName: string;
  amount: number;
  dueDate: Date | null;
  /** Días desde hoy hasta el vencimiento (negativo = vencido). `null` cuando no hay `dueDate`. */
  daysFromToday: number | null;
  bucket: CobranzaBucket;
  /**
   * Cantidad de cuotas vencidas detrás de esta fila (una fila = una
   * reserva, puede agrupar varias cuotas MONTHLY). `dueDate`/`daysFromToday`
   * ya describen la cuota vencida más temprana; este campo permite decir
   * "2 cuotas vencidas" en vez de "1 cobro vencido" cuando hay más de una.
   */
  overdueCount: number;
  /**
   * Cantidad de cuotas que vencen hoy o dentro de los próximos 7 días,
   * detrás de la cuota vencida más temprana ya representada por `dueDate`.
   */
  dueSoonCount: number;
  /**
   * Días hasta la cuota más temprana de `dueSoonCount`. `null` cuando
   * `dueSoonCount === 0` o cuando esa cuota no tiene `dueDate` atribuible
   * (degrada el sufijo a "+N por vencer" sin plazo).
   */
  dueSoonDaysFromToday: number | null;
}

const BUCKET_TONE: Record<CobranzaBucket, PillTone> = {
  OVERDUE: "destructive",
  DUE_TODAY: "warning",
  UPCOMING_7D: "warning",
};

const BUCKET_LABEL: Record<CobranzaBucket, string> = {
  OVERDUE: "Vencido",
  DUE_TODAY: "Vence hoy",
  UPCOMING_7D: "Pendiente",
};

/**
 * Color del texto de vencimiento. Usa `*-foreground` (el token legible sobre
 * card, oscuro en light / claro en dark) y NO `--warning`, que es el token de
 * relleno: a 0.78 de lightness sobre card blanco no alcanza contraste AA.
 */
const BUCKET_TEXT: Record<CobranzaBucket, string> = {
  OVERDUE: "text-destructive",
  DUE_TODAY: "text-warning-foreground",
  UPCOMING_7D: "text-muted-foreground",
};

function formatCLP(amount: number): string {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Plazo relativo de una cuota que vence dentro de la ventana de 7 días
 * (`0 <= days <= 7` por construcción de `dueSoon` en
 * `@/lib/reports/collection`): 0 → "hoy", 1 → "mañana", N → "en N días".
 *
 * Existe para que el segundo tramo de `dueLabel` comparta la misma escalera
 * que la rama sin vencidos, que ya resolvía esos dos casos. Sin ella el
 * sufijo salía como "vence en 0 días" / "vence en 1 días" — y no es un borde
 * raro: `generateMonthlyPayments` fija todos los `dueDate` al día 1, así que
 * ocurría cada día 1 y cada último día de mes.
 */
function plazoRelativo(days: number): string {
  if (days === 0) return "hoy";
  if (days === 1) return "mañana";
  return `en ${days} días`;
}

/**
 * Línea de vencimiento: relativo primero (accionable), absoluto después (verificable).
 * "Vence en 3 días · 1 sept" escanea mejor que "Vence: 1 sept", que obliga al dueño
 * a calcular la urgencia mentalmente.
 *
 * Una fila = una reserva, que puede agrupar varias cuotas MONTHLY impagas.
 * `daysFromToday`/`dueDate` siempre describen la cuota impaga MÁS temprana
 * (la vencida, si hay una); `overdueCount`/`dueSoonCount` revelan cuántas
 * cuotas más hay detrás, para no mentir con "1 cobro" cuando en realidad
 * son 2 vencidas + 1 por vencer.
 *
 * No-overdue (`overdueCount === 0`): comportamiento sin cambios respecto a
 * la versión anterior de este componente (bucket DUE_TODAY / UPCOMING_7D /
 * sin fecha).
 *
 * Overdue (`overdueCount >= 1`):
 *  - 1 cuota vencida  → "Venció hace N días" (igual que antes).
 *  - ≥2 cuotas vencidas → "N cuotas vencidas".
 *  - Segundo tramo: si hay cuotas por vencer dentro de 7 días, sufijo
 *    "+N vence/vencen en X días" (degrada a "+N por vencer" sin plazo si
 *    no hay `dueSoonDaysFromToday`); si no, la fecha absoluta de la cuota
 *    vencida más temprana ("desde <fecha>" cuando son ≥2 cuotas, para
 *    dejar claro que es el inicio del rango, no una fecha puntual).
 */
function dueLabel(item: {
  daysFromToday: number | null;
  dueDate: Date | null;
  overdueCount: number;
  dueSoonCount: number;
  dueSoonDaysFromToday: number | null;
}): string {
  const { daysFromToday, dueDate, overdueCount, dueSoonCount, dueSoonDaysFromToday } = item;

  if (daysFromToday === null) return "Sin fecha de vencimiento";

  if (overdueCount === 0) {
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

    return dueDate ? `${relative} · ${formatDateOnly(dueDate)}` : relative;
  }

  const firstSegment =
    overdueCount >= 2
      ? `${overdueCount} cuotas vencidas`
      : daysFromToday === -1
        ? "Venció ayer"
        : `Venció hace ${Math.abs(daysFromToday)} días`;

  let secondSegment: string | null = null;
  if (dueSoonCount > 0) {
    const verb = dueSoonCount > 1 ? "vencen" : "vence";
    secondSegment =
      dueSoonDaysFromToday !== null
        ? `+${dueSoonCount} ${verb} ${plazoRelativo(dueSoonDaysFromToday)}`
        : `+${dueSoonCount} por vencer`;
  } else if (dueDate) {
    secondSegment = overdueCount >= 2 ? `desde ${formatDateOnly(dueDate)}` : formatDateOnly(dueDate);
  }

  return secondSegment ? `${firstSegment} · ${secondSegment}` : firstSegment;
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
   * `items` viene truncado (top N por `collectionLimit`), así que derivarlo
   * de `items` mentiría cuando hay más cobros de los que caben. Si se omite,
   * se deriva de `items`.
   */
  totalAmount?: number;
  totalCount?: number;
}

/**
 * Compact cobranza sidebar for /dashboard. Shows up to N items ordered by
 * urgency (vencidos → vencen hoy → próximos 7 días), each with client,
 * propiedad, monto y vencimiento relativo. Cada fila es un link a la
 * reserva — la sección es una lista de pendientes, no un reporte de solo
 * lectura.
 *
 * Standalone primitive — no server data fetching; data is computed by
 * `getDashboardSummary` (`@/lib/dashboard/summary`) and passed as props.
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
    <section aria-labelledby="cobros-pendientes-heading" className="flex h-full flex-col">
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
      <div className="flex flex-1 flex-col overflow-hidden rounded-md border border-border bg-card">
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
          <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 py-10 text-center">
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
                    aria-label={`${item.clientName} — ${formatCLP(item.amount)} — ${BUCKET_LABEL[item.bucket]}`}
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
                        className={cn("mt-0.5 text-[10px] tabular-nums", BUCKET_TEXT[item.bucket])}
                      >
                        {dueLabel(item)}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <p className="text-xs font-bold text-foreground tabular-nums">
                        {formatCLP(item.amount)}
                      </p>
                      <ReservationPill
                        tone={BUCKET_TONE[item.bucket]}
                        label={BUCKET_LABEL[item.bucket]}
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
