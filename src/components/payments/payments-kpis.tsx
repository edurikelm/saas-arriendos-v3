import { ExecutiveKpiCard } from "@/components/reports/executive-kpi-card";
import { formatCLP } from "@/lib/format/currency";

interface PaymentsKpisProps {
  kpis: {
    cobradoMes: number;
    pendiente: number;
    pendienteCount: number;
    proximos7DiasCount: number;
  };
}

export function PaymentsKpis({ kpis }: PaymentsKpisProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <ExecutiveKpiCard
        label="Cobrado este mes"
        value={formatCLP(kpis.cobradoMes)}
        tone="default"
      />
      <ExecutiveKpiCard
        label="Pendiente de cobro"
        value={formatCLP(kpis.pendiente)}
        sublabel={`${kpis.pendienteCount} ${kpis.pendienteCount === 1 ? "pago pendiente" : "pagos pendientes"}`}
        tone="warning"
      />
      <ExecutiveKpiCard
        label="Próximos vencimientos"
        value={kpis.proximos7DiasCount}
        sublabel="Próximos 7 días"
        tone="default"
      />
    </div>
  );
}
