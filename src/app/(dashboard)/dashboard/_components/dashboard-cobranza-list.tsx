import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Bucket de cobranza — alineado 1:1 con `DashboardCollectionBucket`
 * (`@/lib/dashboard/summary`). Redefinido localmente para no acoplar este
 * componente puramente presentacional al seam de dominio.
 */
export type CobranzaBucket = "OVERDUE" | "DUE_TODAY" | "UPCOMING_7D";

export interface CobranzaItem {
  reservationId: string;
  clientName: string;
  amount: number;
  dueDate: Date | null;
  bucket: CobranzaBucket;
  propertyName: string;
}

const BUCKET_LABEL: Record<CobranzaBucket, string> = {
  OVERDUE: "Vencido",
  DUE_TODAY: "Vence hoy",
  UPCOMING_7D: "Pendiente",
};

const BUCKET_PREFIX: Record<CobranzaBucket, string> = {
  OVERDUE: "Vencido",
  DUE_TODAY: "Vence",
  UPCOMING_7D: "Vence",
};

// Tono del label superior (nombre + fecha) por bucket.
const BUCKET_LABEL_CLASS: Record<CobranzaBucket, string> = {
  OVERDUE: "text-destructive",
  DUE_TODAY: "text-warning",
  UPCOMING_7D: "text-muted-foreground",
};

// Tono del badge inferior (derecha) por bucket. Mismo mapeo de tono que
// KpiCard usa para `warning`/`destructive` (kpi-card.tsx: valueToneClass).
const BUCKET_BADGE_CLASS: Record<CobranzaBucket, string> = {
  OVERDUE: "text-destructive",
  DUE_TODAY: "text-warning",
  UPCOMING_7D: "text-warning-foreground",
};

function formatCLP(amount: number): string {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("es-CL", {
    day: "numeric",
    month: "short",
    timeZone: "America/Santiago",
  });
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
}

/**
 * Compact cobranza sidebar for /dashboard. Shows up to 4 items split between
 * overdue (top) and upcoming 7 days (bottom), each with amount + due date.
 * Standalone primitive — no server data fetching; data is computed by the
 * dashboard page and passed as props.
 */
export function DashboardCobranzaList({
  items,
  viewAllHref,
  viewAllLabel = "Ver todas",
}: DashboardCobranzaListProps) {
  return (
    <div>
      {viewAllHref && (
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
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
      <div className="flex flex-col overflow-hidden rounded-lg border border-border bg-card">
        {viewAllHref ? null : (
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Cobros pendientes
            </h2>
          </div>
        )}
        <div className="flex-1 p-4">
          {items.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">Sin cobros pendientes</p>
          ) : (
            <ul className="space-y-5">
              {items.map((item, idx) => (
                <li key={`${item.reservationId}-${idx}`} className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-foreground">{item.clientName}</p>
                    <p
                      className={cn(
                        "text-[10px]",
                        item.bucket === "UPCOMING_7D" ? "" : "font-bold",
                        BUCKET_LABEL_CLASS[item.bucket]
                      )}
                    >
                      {BUCKET_PREFIX[item.bucket]}: {item.dueDate ? formatDate(item.dueDate) : "—"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-foreground">{formatCLP(item.amount)}</p>
                    <span
                      className={cn("text-[9px] font-bold uppercase", BUCKET_BADGE_CLASS[item.bucket])}
                    >
                      {BUCKET_LABEL[item.bucket]}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}