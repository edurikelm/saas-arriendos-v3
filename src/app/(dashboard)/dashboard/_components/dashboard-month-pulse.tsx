import { BedDouble, Wallet } from "lucide-react";
import { KpiCard } from "@/components/ui/kpi-card";
import { formatCLP } from "@/lib/format/currency";
import type { DashboardMonthPulse as DashboardMonthPulseData } from "@/lib/dashboard/summary";
import { capitalize, monthName } from "./day-labels";

interface DashboardMonthPulseProps {
  month: DashboardMonthPulseData;
}

/**
 * El mes en curso, en dos cifras: lo cobrado y la ocupación.
 *
 * Reemplaza a los cuatro KPIs del inicio anterior. "Pagos pendientes" y
 * "Próximas reservas" repetían lo que ya dicen "Por cobrar" y la agenda, y
 * "Ocupación actual" lo dice el tablero de propiedades. Estas dos son las
 * únicas cifras de la página sin sección propia.
 *
 * La comparación de lo cobrado es contra el MISMO tramo del mes anterior, y
 * en monto, no en porcentaje: contra el mes anterior completo, cada comienzo
 * de mes marcaba una caída que no existía, y un "-90%" a mitad de semana es
 * justo la urgencia inventada que el producto evita.
 */
export function DashboardMonthPulse({ month }: DashboardMonthPulseProps) {
  const currentMonth = capitalize(monthName(month.monthKey));
  const previousMonth = monthName(month.previousMonthKey);

  return (
    <section aria-labelledby="mes-heading" className="flex h-full flex-col">
      <div className="mb-4">
        <h2
          id="mes-heading"
          className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground"
        >
          {currentMonth}
        </h2>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1">
        <KpiCard
          label="Cobrado"
          value={formatCLP(month.collected)}
          icon={Wallet}
          sublabel={`Al ${month.previousCutoffDay} de ${previousMonth}: ${formatCLP(month.collectedPreviousSamePeriod)}`}
        />
        <KpiCard
          label="Ocupación del mes"
          value={`${month.occupancyRate}%`}
          icon={BedDouble}
          progressBar={{ value: month.occupancyRate }}
          sublabel={`${month.occupiedNightUnits} de ${month.capacityNightUnits} noches`}
        />
      </div>
    </section>
  );
}
