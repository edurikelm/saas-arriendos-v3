import { CheckCircle2 } from "lucide-react";
import { formatCLP } from "@/lib/format/currency";
import type { ClientDebtor } from "@/lib/reports/trend";

interface TopClientDebtorsListProps {
  debtors: ClientDebtor[];
}

const BILLING_LABEL: Record<ClientDebtor["billingType"], string> = {
  DAILY: "Diario",
  MONTHLY: "Mensual",
};

/**
 * Top deudores por cliente — foto del presente (no del rango seleccionado),
 * ver `selectTopClientDebtors`. Cada fila: cliente, propiedad de contexto,
 * tipo de arriendo, días de atraso y monto.
 */
export function TopClientDebtorsList({ debtors }: TopClientDebtorsListProps) {
  if (debtors.length === 0) {
    return (
      <div className="flex items-center gap-2 py-2">
        <CheckCircle2 className="size-4 text-success-text" aria-hidden="true" />
        <p className="text-xs text-muted-foreground">Sin deudores activos.</p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {debtors.map((debtor) => (
        <li key={debtor.clientId} className="flex items-center justify-between gap-3 py-2">
          <div className="min-w-0">
            <p className="truncate text-xs font-bold text-foreground">{debtor.clientName}</p>
            <p className="truncate text-[10px] text-muted-foreground">
              {debtor.propertyName} · {BILLING_LABEL[debtor.billingType]}
              {debtor.daysOverdue > 0 ? ` · ${debtor.daysOverdue} días de atraso` : ""}
            </p>
          </div>
          <span className="shrink-0 text-xs font-bold tabular-nums text-destructive-text">
            {formatCLP(debtor.amount)}
          </span>
        </li>
      ))}
    </ul>
  );
}
