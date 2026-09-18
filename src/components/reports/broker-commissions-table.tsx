"use client";

import { useState } from "react";
import { ChevronRight, Handshake } from "lucide-react";
import { DataTable } from "@/components/ui/data-table";
import { formatCLP } from "@/lib/format/currency";
import { cn } from "@/lib/utils";
import type {
  BrokerCommissionRow,
  ReservationCommissionRow,
} from "@/lib/brokers/commission";

interface BrokerCommissionsTableProps {
  rows: BrokerCommissionRow[];
  reservationsByBroker: Record<string, ReservationCommissionRow[]>;
  totalCommission: number;
}

/** `10` → "10%", `8.5` → "8,5%". */
function formatRate(rate: number): string {
  return `${rate.toLocaleString("es-CL", { maximumFractionDigits: 2 })}%`;
}

/** "5 sept – 12 sept" desde dos claves `YYYY-MM-DD`. */
function formatStayRange(startKey: string, endKey: string): string {
  const label = (key: string) => {
    const [y, m, d] = key.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("es-CL", {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    });
  };
  return `${label(startKey)} – ${label(endKey)}`;
}

/**
 * Comisiones de captadores del período (ADR-0040 §7).
 *
 * Vive en la sección "Resultado del período" porque obedece al rango y a la
 * propiedad del encabezado, como exige ADR-0035. No descuenta nada de
 * "Cobrado": los ingresos siguen siendo brutos y esto se lee al lado.
 *
 * La columna "Cobrado" es la caja de las reservas CON captador, no la del
 * período completo, y el rótulo lo dice.
 */
export function BrokerCommissionsTable({
  rows,
  reservationsByBroker,
  totalCommission,
}: BrokerCommissionsTableProps) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const headers = [
    "Captador",
    { label: "Comisión", align: "right" as const },
    { label: "Cobrado de sus reservas", align: "right" as const },
    { label: "Reservas", align: "center" as const },
  ];

  const totalCollected = rows.reduce((total, row) => total + row.collectedAmount, 0);

  return (
    <section aria-labelledby="reports-commissions-heading" className="space-y-3">
      <div className="flex items-center gap-2">
        <Handshake className="text-primary size-5" aria-hidden="true" />
        <h2
          id="reports-commissions-heading"
          className="text-xs font-bold text-foreground uppercase tracking-wider"
        >
          Comisiones de captadores
        </h2>
      </div>

      <DataTable
        headers={headers}
        caption="Comisión devengada por captador sobre los pagos cobrados en el rango seleccionado. No se descuenta de Cobrado: los ingresos de esta página son brutos."
        emptyState={
          <p className="text-sm text-muted-foreground">
            Ninguna reserva con captador cobró en este período
          </p>
        }
        minWidth="620px"
      >
        {[
          ...rows.flatMap((row) => {
            const isOpen = expanded === row.brokerId;
            const detail = reservationsByBroker[row.brokerId] ?? [];

            return [
              <tr
                key={row.brokerId}
                className="border-b last:border-0 hover:bg-muted/30 transition-colors"
              >
                <td className="px-6 py-4">
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : row.brokerId)}
                    aria-expanded={isOpen}
                    className="flex items-center gap-1.5 text-left cursor-pointer"
                  >
                    <ChevronRight
                      className={cn(
                        "size-3.5 text-muted-foreground transition-transform",
                        isOpen && "rotate-90",
                      )}
                      aria-hidden="true"
                    />
                    <span className="font-medium text-foreground text-xs">
                      {row.brokerName}
                    </span>
                  </button>
                </td>

                <td className="px-6 py-4 text-right">
                  <span className="font-bold text-foreground tabular-nums text-xs">
                    {formatCLP(row.commission)}
                  </span>
                </td>

                <td className="px-6 py-4 text-right">
                  <span className="tabular-nums text-xs text-muted-foreground">
                    {formatCLP(row.collectedAmount)}
                  </span>
                </td>

                <td className="px-6 py-4 text-center">
                  <span className="tabular-nums text-xs font-medium text-muted-foreground">
                    {row.reservationCount}
                  </span>
                </td>
              </tr>,
              ...(isOpen
                ? detail.map((res) => (
                    <tr key={`${row.brokerId}-${res.reservationId}`} className="border-b bg-muted/20">
                      <td className="px-6 py-3 pl-12">
                        <p className="text-xs text-foreground">{res.clientName}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {res.propertyName} · {formatStayRange(res.startDateKey, res.endDateKey)}
                        </p>
                      </td>
                      <td className="px-6 py-3 text-right">
                        <span className="tabular-nums text-xs text-foreground">
                          {formatCLP(res.commission)}
                        </span>
                        <p className="text-[10px] text-muted-foreground tabular-nums">
                          {formatRate(res.commissionRate)}
                        </p>
                      </td>
                      <td className="px-6 py-3 text-right">
                        <span className="tabular-nums text-xs text-muted-foreground">
                          {formatCLP(res.collectedAmount)}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-center">
                        <span className="tabular-nums text-[10px] text-muted-foreground">
                          {res.paymentCount} {res.paymentCount === 1 ? "pago" : "pagos"}
                        </span>
                      </td>
                    </tr>
                  ))
                : []),
            ];
          }),
          ...(rows.length > 0
            ? [
                <tr key="totals" className="border-t-2 border-border bg-muted/30 font-bold">
                  <td className="px-6 py-4 text-xs text-foreground">Total</td>
                  <td className="px-6 py-4 text-right tabular-nums text-xs text-foreground">
                    {formatCLP(totalCommission)}
                  </td>
                  <td className="px-6 py-4 text-right tabular-nums text-xs text-foreground">
                    {formatCLP(totalCollected)}
                  </td>
                  <td className="px-6 py-4 text-center tabular-nums text-xs text-foreground">
                    {rows.reduce((total, row) => total + row.reservationCount, 0)}
                  </td>
                </tr>,
              ]
            : []),
        ]}
      </DataTable>
    </section>
  );
}

export type { BrokerCommissionsTableProps };
