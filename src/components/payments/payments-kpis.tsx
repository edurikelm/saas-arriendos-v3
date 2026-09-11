import { KpiCard } from "@/components/ui/kpi-card";
import { Wallet, Clock, AlertTriangle, Receipt } from "lucide-react";
import { formatCLP } from "@/lib/format/currency";

interface PaymentsKpisProps {
  kpis: {
    cobrado: number;
    pendiente: number;
    pendienteCount: number;
    vencido: number;
    vencidoCount: number;
    total: number;
    totalCount: number;
  };
  /** Hay algún filtro activo: cambia el alcance que declaran los sublabels. */
  filtered?: boolean;
}

function pagos(n: number): string {
  return `${n} ${n === 1 ? "pago" : "pagos"}`;
}

export function PaymentsKpis({ kpis, filtered = false }: PaymentsKpisProps) {
  // Las cuatro cifras salen del mismo `where` que la tabla, así que suman entre
  // sí y describen lo que se está mirando. El sublabel lo dice en palabras,
  // porque una cifra que cambia al filtrar sin anunciarlo es justo lo que hacía
  // dudar de la anterior.
  const alcance = filtered ? "En el filtro actual" : "Histórico";

  return (
    // Cuatro columnas en escritorio y 2x2 en móvil, igual que dashboard,
    // calendar y reports. Antes eran tres a cualquier ancho: a 375px cada card
    // quedaba en 101px, el icono trae `shrink-0` y se salía hasta 29px, y
    // "$2.340.000" no entraba en su propia card.
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      <KpiCard
        label="Cobrado"
        value={formatCLP(kpis.cobrado)}
        icon={Wallet}
        tone="success"
        density="compact"
        sublabel={alcance}
      />
      <KpiCard
        label="Pendiente de cobro"
        value={formatCLP(kpis.pendiente)}
        icon={Clock}
        tone="warning"
        density="compact"
        sublabel={pagos(kpis.pendienteCount)}
      />
      <KpiCard
        label="Vencido"
        value={formatCLP(kpis.vencido)}
        icon={AlertTriangle}
        // `destructive` solo cuando hay algo vencido. En cero, pintarlo de rojo
        // convierte una buena noticia en alarma.
        tone={kpis.vencido > 0 ? "destructive" : "default"}
        density="compact"
        sublabel={pagos(kpis.vencidoCount)}
      />
      <KpiCard
        label="Total"
        value={formatCLP(kpis.total)}
        icon={Receipt}
        tone="default"
        density="compact"
        sublabel={pagos(kpis.totalCount)}
      />
    </div>
  );
}
