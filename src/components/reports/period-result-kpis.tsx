import { Wallet, Receipt, Percent } from "lucide-react";
import { KpiCard } from "@/components/ui/kpi-card";
import { formatCLP } from "@/lib/format/currency";
import { computeCollectionRate } from "@/lib/reports/collection-rate";
import type { TrendResult } from "@/lib/reports/trend";

interface PeriodResultKpisProps {
  collectedCash: number;
  accruedRevenue: number;
  revenueTrend: TrendResult | null;
}

/**
 * Las 3 cifras de "Resultado del período" (cierre de período).
 *
 * La Tasa de cobranza compara DOS bases contables distintas a propósito
 * (caja del rango por `paidAt` vs. devengado del rango prorrateado) — puede
 * superar 100% con un prepago, y NO se clampea: el valor real se muestra tal
 * cual (ver ADR-0028 y `computeCollectionRate`). La nota bajo la cifra explica
 * la diferencia de bases en lenguaje llano — es obligatoria, no decorativa.
 */
export function PeriodResultKpis({ collectedCash, accruedRevenue, revenueTrend }: PeriodResultKpisProps) {
  const { pct } = computeCollectionRate(collectedCash, accruedRevenue);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
      <KpiCard
        label="Cobrado"
        value={formatCLP(collectedCash)}
        icon={Wallet}
        tone="success"
        indicator={
          revenueTrend && revenueTrend.direction !== null && revenueTrend.pct !== null
            ? {
                text:
                  revenueTrend.direction === "up"
                    ? `+${revenueTrend.pct}% vs período anterior`
                    : `${revenueTrend.pct}% vs período anterior`,
                variant: revenueTrend.direction === "up" ? "positive" : "warning",
              }
            : undefined
        }
      />
      <KpiCard label="Facturado del período" value={formatCLP(accruedRevenue)} icon={Receipt} tone="default" />
      <KpiCard
        label="Tasa de cobranza"
        value={pct === null ? "—" : `${pct}%`}
        icon={Percent}
        tone={pct !== null && pct >= 100 ? "success" : "default"}
        progressBar={pct !== null ? { value: pct } : undefined}
        sublabel="Caja recibida en el rango sobre lo que el rango generó. Un prepago puede pasarla de 100%."
      />
    </div>
  );
}
