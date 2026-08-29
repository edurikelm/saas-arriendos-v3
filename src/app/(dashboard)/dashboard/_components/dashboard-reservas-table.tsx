import { DataTable } from "@/components/ui/data-table";
import type { ReactNode } from "react";

interface DashboardReservasTableProps {
  /** Filas del body (`<tr>` elements). Renderizadas dentro del `<tbody>`. */
  children: ReactNode;
  /** Empty state que se muestra cuando no hay filas. */
  emptyState: ReactNode;
  /** Caption accesible para SR. */
  caption?: string;
}

const HEADERS = [
  "Propiedad",
  "Cliente",
  "Fechas",
  "Estado",
  { label: "Monto Total", align: "right" as const },
];

/**
 * Wrapper del <DataTable> para la sección "Próximas reservas" del /dashboard.
 * Mismos headers en todos los viewports — la columna "Llegada/Salida" que
 * antes existía solo en desktop se eliminó (era redundante con el sublabel
 * de "Estado": "Llega en 5 días" vs. "Próxima" + "En 5 días" decían lo mismo
 * en dos columnas). Sin acento superior (`accentTop={false}`): el color
 * primary/warning ya lo usa la columna "Fechas" para dirección de llegada/
 * salida, y el borde teal por defecto de `DataTable` competía con esa señal.
 */
export function DashboardReservasTable({
  children,
  emptyState,
  caption,
}: DashboardReservasTableProps) {
  return (
    <DataTable headers={HEADERS} caption={caption} emptyState={emptyState} accentTop={false}>
      {children}
    </DataTable>
  );
}
