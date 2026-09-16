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
    // Sin card propia: `KpiCard` ya trae su marco (DESIGN.md, Cards → Cuándo
    // NO usar). El título va al mismo tamaño que el de las otras secciones.
    <section aria-labelledby="mes-heading">
      <div className="mb-2 flex items-baseline justify-between gap-3 px-1">
        <h2 id="mes-heading" className="text-sm font-medium text-foreground">
          {currentMonth}
        </h2>
        <span className="text-[10px] tabular-nums text-muted-foreground">
          Día {month.dayOfMonth}
        </span>
      </div>
      {/* Lado a lado donde la columna da ~435px (2xl): apilados, los dos KPIs
          hacían de la columna del mes la más alta de las tres. A 1280px la
          columna mide ~310px y un KPI de 145px no alcanza para el monto. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1 2xl:grid-cols-2">
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
