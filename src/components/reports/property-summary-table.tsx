import { Building2 } from "lucide-react";
import { DataTable } from "@/components/ui/data-table";
import type { DecisionByPropertyEntry, DecisionActivity } from "@/lib/reports/decision-summary";

interface PropertySummaryTableProps {
  rows: DecisionByPropertyEntry[];
}

const ACTIVITY_LABELS: Record<DecisionActivity, string> = {
  NONE: "Sin actividad",
  DAILY: "Diario",
  MONTHLY: "Mensual",
  MIXED: "Mixto",
};

function ModalityBadge({ activity }: { activity: DecisionActivity }) {
  return (
    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
      {ACTIVITY_LABELS[activity]}
    </span>
  );
}

export function PropertySummaryTable({ rows }: PropertySummaryTableProps) {
  const headers = [
    "Propiedad",
    "Modalidad",
    { label: "Cobrado", align: "right" as const },
    { label: "Saldo pendiente", align: "right" as const },
    { label: "Unidades-noche", align: "right" as const },
    { label: "Ocupación", align: "right" as const },
    { label: "Reservas", align: "center" as const },
  ];

  return (
    <div className="space-y-3">
      {/* Standalone header */}
      <div className="flex items-center gap-2">
        <Building2 className="text-primary size-5" aria-hidden="true" />
        <h2 id="reports-summary-heading" className="text-xs font-bold text-foreground uppercase tracking-wider">
          Resumen Operativo por Propiedad
        </h2>
      </div>

      <DataTable
        headers={headers}
        caption="Resumen Operativo por Propiedad — operación por propiedad en el rango seleccionado."
        emptyState={
          <p className="text-sm text-muted-foreground">
            Sin propiedades en el rango seleccionado
          </p>
        }
        minWidth="640px"
      >
        {rows.map((row) => {
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

              {/* Modalidad */}
              <td className="px-6 py-4">
                <ModalityBadge activity={row.activity} />
              </td>

              {/* Cobrado (right) */}
              <td className="px-6 py-4 text-right">
                <div className="font-bold text-foreground tabular-nums text-xs">
                  ${row.collectedCash.toLocaleString("CLP")}
                </div>
                {cancelledCash > 0 && (
                  <div className="text-[10px] text-muted-foreground tabular-nums">
                    +${cancelledCash.toLocaleString("CLP")} canceladas
                  </div>
                )}
              </td>

              {/* Saldo pendiente (right) */}
              <td className="px-6 py-4 text-right">
                <span className="tabular-nums text-xs text-muted-foreground">
                  {row.outstandingBalance > 0
                    ? `$${row.outstandingBalance.toLocaleString("CLP")}`
                    : "—"}
                </span>
              </td>

              {/* Unidades-noche (right) */}
              <td className="px-6 py-4 text-right">
                <span className="tabular-nums text-xs text-muted-foreground">
                  {row.occupiedNightUnits.toLocaleString("es-CL")}
                  {" / "}
                  {row.capacityNightUnits.toLocaleString("es-CL")}
                </span>
              </td>

              {/* Ocupación (right) */}
              <td className="px-6 py-4 text-right">
                <div className="flex items-center justify-end gap-2">
                  <div className="w-16 bg-muted h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-primary h-1.5 rounded-full transition-all"
                      style={{ width: `${row.occupancyRate}%` }}
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
        })}
      </DataTable>
    </div>
  );
}

export type { PropertySummaryTableProps };
