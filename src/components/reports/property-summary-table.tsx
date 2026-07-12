import { Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface PropertySummaryRow {
  propertyName: string;
  modality: "Diario" | "Mensual" | "Mixto";
  nightsOrDays: {
    nights?: number;
    days?: number;
    label: string;
  };
  revenue: number;
  occupancyRate: number;
  performance: number;
}

interface PropertySummaryTableProps {
  rows: PropertySummaryRow[];
}

export function PropertySummaryTable({ rows }: PropertySummaryTableProps) {
  if (rows.length === 0) return null;

  return (
    <div className="bg-card border border-border rounded overflow-hidden mb-6">
      <div className="px-4 py-4 border-b border-border flex justify-between items-center bg-muted/30">
        <div className="flex items-center gap-2">
          <Building2 className="text-primary size-5" />
          <h2 className="text-xs font-bold text-foreground uppercase tracking-wider">
            Resumen Operativo por Propiedad
          </h2>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-muted/50 border-b border-border">
            <tr className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              <th className="px-6 py-3">Propiedad</th>
              <th className="px-6 py-3">Modalidad</th>
              <th className="px-6 py-3">Noches/Días</th>
              <th className="px-6 py-3">Ingresos</th>
              <th className="px-6 py-3">Ocupación</th>
              <th className="px-6 py-3 text-right">Rendimiento</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-xs">
            {rows.map((row) => (
              <tr
                key={row.propertyName}
                className="hover:bg-muted/50 transition-colors"
              >
                <td className="px-6 py-4 font-medium text-foreground">
                  {row.propertyName}
                </td>
                <td className="px-6 py-4 text-muted-foreground">
                  {row.modality}
                </td>
                <td className="px-6 py-4">{row.nightsOrDays.label}</td>
                <td className="px-6 py-4 font-bold text-foreground tabular-nums">
                  ${row.revenue.toLocaleString("CLP")}
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <div className="w-16 bg-muted h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-primary h-1.5 rounded-full transition-all"
                        style={{ width: `${row.occupancyRate}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-bold tabular-nums">
                      {row.occupancyRate}%
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <span
                    className={cn(
                      "font-bold tabular-nums",
                      row.performance >= 0 ? "text-primary" : "text-destructive"
                    )}
                  >
                    {row.performance >= 0 ? "+" : ""}
                    {row.performance.toFixed(1)}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export type { PropertySummaryRow };
