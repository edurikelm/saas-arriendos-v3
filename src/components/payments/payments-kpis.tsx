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
    // `grid-cols-3` también en móvil dejaba cada card en 101px a 375px, y el
    // contenedor del icono trae `shrink-0`: no comprimía, se salía. Medido
    // antes del cambio, los iconos terminaban 1px, 7px y 29px fuera de su card,
    // el último contra el borde del viewport. El monto tampoco entraba —
    // "$2.340.000" mide 102px dentro de un card de 101px.
    //
    // Dos columnas es lo que usan las otras tres superficies con KPIs
    // (dashboard, calendar, reports). Como acá son tres cards y no cuatro, la
    // última ocupa la fila completa en vez de dejar un hueco.
    //
    // `density="compact"` esconde el icono bajo `sm` y lo restaura sin cambios
    // desde ahí, igual que en /calendar: con el ancho ya resuelto, el icono
    // pasa a competir con la cifra, que es el dato.
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
      <KpiCard
        label="Cobrado este mes"
        value={formatCLP(kpis.cobradoMes)}
        icon={Wallet}
        tone="success"
        density="compact"
      />
      <KpiCard
        label="Pendiente de cobro"
        value={formatCLP(kpis.pendiente)}
        icon={Clock}
        tone="warning"
        density="compact"
        sublabel={`${kpis.pendienteCount} ${kpis.pendienteCount === 1 ? "pago pendiente" : "pagos pendientes"}`}
      />
      <div className="col-span-2 sm:col-span-1">
        <KpiCard
          label="Próximos vencimientos"
          value={kpis.proximos7DiasCount}
          icon={AlertTriangle}
          tone="default"
          density="compact"
          sublabel="Próximos 7 días"
        />
      </div>
    </div>
  );
}
