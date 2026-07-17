import Link from "next/link";
import { cn } from "@/lib/utils";

export interface CobranzaItem {
  reservationId: string;
  clientName: string;
  amount: number;
  dueDate: Date | null;
  isOverdue: boolean;
  propertyName: string;
}

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
   * canónico de `/dashboard` sección "Reservas Diarias"). Si se omite, el título
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
            Cobranza Reservas Mensuales
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
              Cobranza Reservas Mensuales
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
                    {item.isOverdue ? (
                      <p className="text-[10px] font-bold text-destructive">
                        Vencido: {item.dueDate ? formatDate(item.dueDate) : "—"}
                      </p>
                    ) : (
                      <p className="text-[10px] text-muted-foreground">
                        Vence: {item.dueDate ? formatDate(item.dueDate) : "—"}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-foreground">{formatCLP(item.amount)}</p>
                    <span
                      className={cn(
                        "text-[9px] font-bold uppercase",
                        item.isOverdue ? "text-destructive" : "text-warning-foreground"
                      )}
                    >
                      {item.isOverdue ? "Vencido" : "Pendiente"}
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