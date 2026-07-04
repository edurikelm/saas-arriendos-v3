"use client";

import { formatPrice } from "./reservations-utils";
import { MetricCardInline } from "./reservations-metric-inline";

interface ReservationsKpiCardsProps {
  filteredCount: number;
  activeCount: number;
  totalPaid: number;
  pendingAmount: number;
  totalReserved: number;
}

export function ReservationsKpiCards({
  filteredCount,
  activeCount,
  totalPaid,
  pendingAmount,
  totalReserved,
}: ReservationsKpiCardsProps) {
  return (
    <div className="mb-6 grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4">
      <MetricCardInline
        label="Reservas filtradas"
        value={filteredCount.toLocaleString("es-CL")}
        sublabel={`${activeCount} activas o pendientes`}
        tone="info"
      />
      <MetricCardInline
        label="Cobrado"
        value={formatPrice(totalPaid)}
        sublabel="Pagos completados"
        tone="success"
      />
      <MetricCardInline
        label="Por cobrar"
        value={formatPrice(pendingAmount)}
        sublabel="Saldo de la selección"
        tone="warning"
      />
      <MetricCardInline
        label="Total reservado"
        value={formatPrice(totalReserved)}
        sublabel="Valor bruto"
        tone="neutral"
      />
    </div>
  );
}
