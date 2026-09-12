import { Building2 } from "lucide-react";
import { DataTable } from "@/components/ui/data-table";
import { formatCLP } from "@/lib/format/currency";
import type { DecisionByPropertyEntry } from "@/lib/reports/decision-summary";

interface PropertySummaryTableProps {
  rows: DecisionByPropertyEntry[];
}

/**
 * Resumen por propiedad — versión adelgazada (cierre de período).
 *
 * Columnas: Propiedad · Cobrado · Pendiente · Ocupación · Reservas. Se
 * eliminaron "Modalidad" (no aporta a la decisión de cierre) y
 * "Unidades-noche" (es el denominador interno de Ocupación, no un dato que el
 * owner necesite leer aparte — ya viaja como tooltip/caption de esa columna).
 */
export function PropertySummaryTable({ rows }: PropertySummaryTableProps) {
  const headers = [
    "Propiedad",
    { label: "Cobrado", align: "right" as const },
    { label: "Pendiente", align: "right" as const },
    {
      label: "Ocupación",
      align: "right" as const,
    },
    { label: "Reservas", align: "center" as const },
  ];

  const totals = rows.reduce(
    (acc, row) => {
      acc.collectedCash += row.collectedCash;
      acc.outstandingBalance += row.outstandingBalance;
      acc.occupiedNightUnits += row.occupiedNightUnits;
      acc.capacityNightUnits += row.capacityNightUnits;
      acc.reservationCount += row.reservationCount;
      return acc;
    },
    { collectedCash: 0, outstandingBalance: 0, occupiedNightUnits: 0, capacityNightUnits: 0, reservationCount: 0 },
  );
  const totalOccupancyRate =
    totals.capacityNightUnits > 0
      ? Math.round((totals.occupiedNightUnits / totals.capacityNightUnits) * 100)
      : 0;

  return (
    <section aria-labelledby="reports-summary-heading" className="space-y-3">
      {/* Standalone header */}
      <div className="flex items-center gap-2">
        <Building2 className="text-primary size-5" aria-hidden="true" />
        <h2 id="reports-summary-heading" className="text-xs font-bold text-foreground uppercase tracking-wider">
          Resumen por propiedad
        </h2>
      </div>

      <DataTable
        headers={headers}
        caption="Resumen por propiedad — cobrado, pendiente, ocupación y reservas en el rango seleccionado. La ocupación incluye Reservas internas; los Bloqueos de Canal Externo no están incluidos."
        emptyState={
          <p className="text-sm text-muted-foreground">
            Sin propiedades en el rango seleccionado
          </p>
        }
        minWidth="560px"
      >
        {[
          ...rows.map((row) => {
            const cancelledCash = row.collectedCashFromCancelledReservations;
            return (
              <tr
                key={row.propertyId}
                className="border-b last:border-0 hover:bg-muted/30 transition-colors"
              >
                {/* Propiedad */}
                <td className="px-6 py-4">
                  <span className="font-medium text-foreground text-xs">
                    {row.propertyName}
                  </span>
                </td>

                {/* Cobrado (right) */}
                <td className="px-6 py-4 text-right">
                  <div className="font-bold text-foreground tabular-nums text-xs">
                    {formatCLP(row.collectedCash)}
                  </div>
                  {cancelledCash > 0 && (
                    <div className="text-[10px] text-muted-foreground tabular-nums">
                      +{formatCLP(cancelledCash)} canceladas
                    </div>
                  )}
                </td>

                {/* Pendiente (right) */}
                <td className="px-6 py-4 text-right">
                  <span className="tabular-nums text-xs text-muted-foreground">
                    {row.outstandingBalance > 0 ? formatCLP(row.outstandingBalance) : "—"}
                  </span>
                </td>

                {/* Ocupación (right) */}
                <td className="px-6 py-4 text-right" title={`${row.occupiedNightUnits.toLocaleString("es-CL")} / ${row.capacityNightUnits.toLocaleString("es-CL")} unidades-noche`}>
                  <div className="flex items-center justify-end gap-2">
                    <div className="w-16 bg-muted h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-primary h-1.5 rounded-full transition-all"
                        style={{ width: `${Math.min(100, Math.max(0, row.occupancyRate))}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-bold tabular-nums text-muted-foreground">
                      {row.occupancyRate}%
                    </span>
                  </div>
                </td>

                {/* Reservas (center) */}
                <td className="px-6 py-4 text-center">
                  <span className="tabular-nums text-xs font-medium text-muted-foreground">
                    {row.reservationCount}
                  </span>
                </td>
              </tr>
            );
          }),
          ...(rows.length > 0
            ? [
                <tr key="totals" className="border-t-2 border-border bg-muted/30 font-bold">
                  <td className="px-6 py-4 text-xs text-foreground">Total</td>
                  <td className="px-6 py-4 text-right tabular-nums text-xs text-foreground">
                    {formatCLP(totals.collectedCash)}
                  </td>
                  <td className="px-6 py-4 text-right tabular-nums text-xs text-foreground">
                    {totals.outstandingBalance > 0 ? formatCLP(totals.outstandingBalance) : "—"}
                  </td>
                  <td className="px-6 py-4 text-right tabular-nums text-[10px] text-foreground">
                    {totalOccupancyRate}%
                  </td>
                  <td className="px-6 py-4 text-center tabular-nums text-xs text-foreground">
                    {totals.reservationCount}
                  </td>
                </tr>,
              ]
            : []),
        ]}
      </DataTable>
    </section>
  );
}

export type { PropertySummaryTableProps };
