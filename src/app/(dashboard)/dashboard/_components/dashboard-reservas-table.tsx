"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { DataTable } from "@/components/ui/data-table";
import { cn } from "@/lib/utils";

type ReservasView = "proximas" | "activas";

interface DashboardReservasTableProps {
  /** Título de la sección, renderizado como heading standalone (fuera del card). */
  title: string;
  /** Href del link "Ver todas". */
  viewAllHref: string;
  /** Filas (`<tr>`) de la vista "Próximas", ya renderizadas en el servidor. */
  proximas: ReactNode;
  /** Filas (`<tr>`) de la vista "Activas", ya renderizadas en el servidor. */
  activas: ReactNode;
  /** Empty state de la vista "Próximas". */
  emptyProximas: ReactNode;
  /** Empty state de la vista "Activas". */
  emptyActivas: ReactNode;
}

const HEADERS = [
  "Propiedad",
  "Cliente",
  "Fechas",
  "Tipo",
  "Estado",
  { label: "Monto", align: "right" as const },
];

const VIEW_OPTIONS: Array<{ value: ReservasView; label: string }> = [
  { value: "proximas", label: "Próximas" },
  { value: "activas", label: "Activas" },
];

/**
 * Wrapper del <DataTable> para la sección "Agenda de reservas" del /dashboard.
 *
 * Client Component (como `OccupancyStrip`): es dueño de su propio header,
 * con el toggle Próximas/Activas junto al link "Ver todas". `page.tsx`
 * (Server Component) sigue construyendo las filas — este componente solo
 * decide cuál slot (`proximas`/`activas`) montar. Patrón de slots de RSC:
 * pasar elementos ya renderizados como props evita serializar los datos o
 * duplicar la lógica de formato en el cliente.
 *
 * La vista coincide 1:1 con el pill de estado temporal de cada fila
 * (`getTemporalStatus`): "Próximas" = pill "Próxima", "Activas" = pill
 * "Activa" — nunca al revés.
 *
 * Diferencia deliberada con `OccupancyStrip`: ese oculta su toggle en
 * mobile (`!isMobile`). Acá el toggle se muestra siempre — es el control
 * principal de la sección, no un refinamiento opcional.
 *
 * Sin contadores en las etiquetas del toggle: las listas vienen topeadas por
 * `upcomingLimit`, así que un número ahí mentiría cuando hay más filas de
 * las que caben.
 */
export function DashboardReservasTable({
  title,
  viewAllHref,
  proximas,
  activas,
  emptyProximas,
  emptyActivas,
}: DashboardReservasTableProps) {
  const [view, setView] = useState<ReservasView>("proximas");
  const isProximas = view === "proximas";

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {title}
        </h2>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 rounded-full border border-border bg-muted p-1">
            {VIEW_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setView(option.value)}
                aria-pressed={view === option.value}
                className={cn(
                  "rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors",
                  view === option.value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
          <Link
            href={viewAllHref}
            className="shrink-0 text-[10px] font-bold uppercase text-primary hover:underline"
          >
            Ver todas
          </Link>
        </div>
      </div>
      <DataTable
        headers={HEADERS}
        caption={title}
        emptyState={isProximas ? emptyProximas : emptyActivas}
        accentTop={false}
        minWidth="720px"
      >
        {isProximas ? proximas : activas}
      </DataTable>
    </div>
  );
}
