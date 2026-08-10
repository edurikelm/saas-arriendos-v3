"use client";

import { DataTable } from "@/components/ui/data-table";
import { useMediaQuery } from "@/hooks/use-media-query";
import type { ReactNode } from "react";

interface DashboardReservasTableProps {
  /** Filas del body (`<tr>` elements). Renderizadas dentro del `<tbody>`. */
  children: ReactNode;
  /** Empty state que se muestra cuando no hay filas. */
  emptyState: ReactNode;
  /** Caption accesible para SR. */
  caption?: string;
}

/**
 * Wrapper Client Component del <DataTable> para la sección "Próximas reservas"
 * del /dashboard. Responsabilidad única: ocultar la columna "Llegada/Salida"
 * en mobile (<640px) para reducir el scroll horizontal en pantallas pequeñas.
 *
 * Mantiene los mismos headers y comportamiento en desktop. El render es
 * condicional al viewport detectado vía useMediaQuery.
 */
export function DashboardReservasTable({
  children,
  emptyState,
  caption,
}: DashboardReservasTableProps) {
  const isMobile = useMediaQuery("(max-width: 639px)");

  const headers = isMobile
    ? [
        "Propiedad",
        "Cliente",
        "Fechas",
        "Estado",
        { label: "Monto Total", align: "right" as const },
      ]
    : [
        "Propiedad",
        "Cliente",
        "Fechas",
        "Llegada/Salida",
        "Estado",
        { label: "Monto Total", align: "right" as const },
      ];

  return (
    <DataTable headers={headers} caption={caption} emptyState={emptyState}>
      {children}
    </DataTable>
  );
}
