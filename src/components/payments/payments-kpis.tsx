import { KpiCard } from "@/components/ui/kpi-card";
import { Wallet, Clock, AlertTriangle } from "lucide-react";
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
      <KpiCard
        label="Cobrado este mes"
        value={formatCLP(kpis.cobradoMes)}
        icon={Wallet}
        tone="success"
      />
      <KpiCard
        label="Pendiente de cobro"
        value={formatCLP(kpis.pendiente)}
        icon={Clock}
        tone="warning"
        sublabel={`${kpis.pendienteCount} ${kpis.pendienteCount === 1 ? "pago pendiente" : "pagos pendientes"}`}
      />
      <KpiCard
        label="Próximos vencimientos"
        value={kpis.proximos7DiasCount}
        icon={AlertTriangle}
        tone="default"
        sublabel="Próximos 7 días"
      />
    </div>
  );
}
