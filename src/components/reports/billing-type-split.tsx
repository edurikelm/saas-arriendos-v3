import { formatCLP } from "@/lib/format/currency";

interface BillingTypeSplitProps {
  dailyCash: number;
  monthlyCash: number;
}

/**
 * Reparto Diario/Mensual del cobrado del período — UNA línea con barra
 * segmentada (monto + % de cada uno), reemplaza a las dos ModelDistributionCard.
 *
 * Mismo hue para ambos segmentos (`bg-primary` / `bg-primary/40`), distinguidos
 * por posición + label, no por un segundo color — igual convención que ya usa
 * `ModelDistributionCard` (ahora eliminado) para no introducir un canal
 * cromático nuevo. Ver DESIGN.md: "Diferencia DAILY vs MONTHLY por label, no
 * por color".
 */
export function BillingTypeSplit({ dailyCash, monthlyCash }: BillingTypeSplitProps) {
  const total = dailyCash + monthlyCash;
  const dailyPct = total > 0 ? Math.round((dailyCash / total) * 100) : 0;
  const monthlyPct = total > 0 ? 100 - dailyPct : 0;

  if (total <= 0) {
    return <p className="text-sm text-muted-foreground">Sin cobros registrados en el rango.</p>;
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-1.5">
        <span className="text-[10px] font-bold uppercase tracking-wider text-foreground">
          Diario · {formatCLP(dailyCash)} ({dailyPct}%)
        </span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Mensual · {formatCLP(monthlyCash)} ({monthlyPct}%)
        </span>
      </div>
      <div
        role="img"
        aria-label={`Cobrado diario: ${formatCLP(dailyCash)} (${dailyPct}%). Cobrado mensual: ${formatCLP(monthlyCash)} (${monthlyPct}%).`}
        className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted"
      >
        {dailyPct > 0 && <div className="h-full bg-primary" style={{ width: `${dailyPct}%` }} />}
        {monthlyPct > 0 && <div className="h-full bg-primary/40" style={{ width: `${monthlyPct}%` }} />}
      </div>
    </div>
  );
}
