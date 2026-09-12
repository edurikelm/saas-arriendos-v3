import { formatCLP } from "@/lib/format/currency";
import { monthKeyLabel } from "@/lib/reports/format";
import type { MonthlyCollectedCash } from "@/lib/reports/revenue-series";

interface MonthlyCashChartProps {
  byMonth: MonthlyCollectedCash[];
}

/**
 * Barras de cobrado por mes calendario, dentro del rango seleccionado.
 *
 * El gráfico es puramente visual (barras + escala); la alternativa textual
 * completa vive en un `<ul>` `sr-only` para que un lector de pantalla reciba
 * los mismos datos sin depender de interpretar geometría (WCAG 1.1.1).
 */
export function MonthlyCashChart({ byMonth }: MonthlyCashChartProps) {
  if (byMonth.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Sin cobros registrados en el rango.</p>
    );
  }

  const max = Math.max(...byMonth.map((m) => m.collectedCash), 1);
  const maxEntry = byMonth.reduce((a, b) => (b.collectedCash > a.collectedCash ? b : a), byMonth[0]);

  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
        Máximo del rango: {formatCLP(maxEntry.collectedCash)} ({monthKeyLabel(maxEntry.monthKey)})
      </p>
      <div className="flex items-end gap-2 h-36" aria-hidden="true">
        {byMonth.map((m) => {
          const heightPct = max > 0 ? Math.max((m.collectedCash / max) * 100, m.collectedCash > 0 ? 4 : 0) : 0;
          return (
            <div key={m.monthKey} className="flex flex-1 min-w-0 flex-col items-center gap-1">
              <span className="text-[10px] tabular-nums text-foreground truncate max-w-full">
                {m.collectedCash > 0 ? formatCLP(m.collectedCash) : "—"}
              </span>
              <div className="w-full flex items-end h-24">
                <div
                  className="w-full rounded-t bg-primary"
                  style={{ height: `${heightPct}%` }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground">{monthKeyLabel(m.monthKey)}</span>
            </div>
          );
        })}
      </div>
      <ul className="sr-only">
        {byMonth.map((m) => (
          <li key={m.monthKey}>
            {monthKeyLabel(m.monthKey)}: {formatCLP(m.collectedCash)} cobrados en {m.paymentCount}{" "}
            {m.paymentCount === 1 ? "pago" : "pagos"}
          </li>
        ))}
      </ul>
    </div>
  );
}
