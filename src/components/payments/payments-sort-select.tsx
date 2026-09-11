"use client";

import { DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { FilterChip } from "@/components/ui/filter-chip";
import type { DataTableSort } from "@/components/ui/data-table";

/**
 * Selector de orden para la vista de lista (<768px).
 *
 * En escritorio el orden se pide clickeando la cabecera de la columna. La
 * lista no tiene cabeceras, así que sin esto el orden quedaba fijo en el por
 * defecto: un orden que llegara por la URL se respetaba, pero no había forma
 * de cambiarlo desde el teléfono.
 *
 * Cada opción es una combinación de columna y dirección, con la etiqueta que
 * describe el RESULTADO y no la mecánica. "Monto: mayor primero" dice lo que
 * va a pasar; "Monto descendente" obliga a traducir.
 */

interface SortOption {
  label: string;
  sort: DataTableSort | null;
}

export const PAYMENTS_SORT_OPTIONS: SortOption[] = [
  { label: "Más recientes", sort: null },
  { label: "Cliente A-Z", sort: { key: "cliente", dir: "asc" } },
  { label: "Cliente Z-A", sort: { key: "cliente", dir: "desc" } },
  { label: "Monto: mayor primero", sort: { key: "monto", dir: "desc" } },
  { label: "Monto: menor primero", sort: { key: "monto", dir: "asc" } },
  // El orden por estado sigue el enum de Postgres, que ordena por su orden de
  // DECLARACIÓN y no alfabéticamente: PENDING, COMPLETED, FAILED. Verificado
  // contra la base. Por eso las etiquetas nombran qué queda primero en vez de
  // prometer un "A-Z" que sería falso.
  { label: "Estado: pendientes primero", sort: { key: "estado", dir: "asc" } },
  { label: "Estado: fallidos primero", sort: { key: "estado", dir: "desc" } },
];

function sameSort(a: DataTableSort | null, b: DataTableSort | null): boolean {
  if (a === null || b === null) return a === b;
  return a.key === b.key && a.dir === b.dir;
}

export function PaymentsSortSelect({
  sort,
  onSortChange,
}: {
  sort: DataTableSort | null;
  onSortChange: (next: DataTableSort | null) => void;
}) {
  const active = PAYMENTS_SORT_OPTIONS.find((o) => sameSort(o.sort, sort));

  return (
    <FilterChip
      label="Orden"
      // El valor por defecto no enciende el chip ni ofrece limpiarlo: no hay
      // nada que quitar.
      value={sort ? sort.key : null}
      valueLabel={active?.label}
      valueMaxWidth="max-w-[160px]"
      clearAriaLabel="Volver al orden por defecto"
      onClear={() => onSortChange(null)}
    >
      <DropdownMenuContent align="start" className="ring-1 ring-foreground/10">
        {PAYMENTS_SORT_OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option.label}
            onClick={() => onSortChange(option.sort)}
            className={option === active ? "bg-accent" : ""}
          >
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </FilterChip>
  );
}
