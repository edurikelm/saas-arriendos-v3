import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
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

/**
 * Compact cobranza sidebar for /dashboard. Shows up to 4 items split between
 * overdue (top) and upcoming 7 days (bottom), each with amount + due date.
 * Standalone primitive — no server data fetching; data is computed by the
 * dashboard page and passed as props.
 */
export function DashboardCobranzaList({ items }: { items: CobranzaItem[] }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Cobranza Reservas Mensuales
        </h2>
      </div>
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
      <div className="border-t border-border bg-muted p-4">
        <Link href="/payments" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-full")}>
          Gestionar Pagos
        </Link>
      </div>
    </div>
  );
}