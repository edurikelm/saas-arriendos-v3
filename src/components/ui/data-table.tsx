import * as React from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type DataTableHeaderAlign = "left" | "right" | "center";

export type DataTableHeader =
  | string
  | {
      label: string;
      align?: DataTableHeaderAlign;
      /**
       * Clases extra para ese `<th>`. Existe para que una columna se pueda
       * fijar al borde (`sticky right-0`) sin que el consumidor tenga que
       * reimplementar el primitive. La celda `<td>` correspondiente debe
       * llevar el mismo `sticky` y un fondo propio.
       */
      className?: string;
      /**
       * Clave de orden de esta columna, en el vocabulario de la VISTA. Con
       * `sortKey` y `onSortChange`, el `<th>` pasa a ser un botón.
       *
       * Solo tiene sentido en columnas cuya primera línea es UN campo. En una
       * fila a dos niveles hay celdas que agrupan varios datos, y ordenar por
       * "la columna" no querría decir nada.
       */
      sortKey?: string;
    };

export type DataTableSortDirection = "asc" | "desc";

export interface DataTableSort {
  key: string;
  dir: DataTableSortDirection;
}

interface DataTableProps {
  headers: DataTableHeader[];
  children?: React.ReactNode;
  emptyState?: React.ReactNode;
  caption?: string;
  className?: string;
  /** Minimum table width in any CSS unit (e.g. "640px"). Defaults to "640px" to enable
   * natural horizontal scroll on mobile viewports (e.g. 375px) without truncating
   * column content. */
  minWidth?: string;
  /**
   * Acento superior `border-t-2 border-t-primary` que distingue una tabla de
   * los demás cards del layout. Default `true` (comportamiento histórico).
   * Poner en `false` cuando la fila ya usa el color primary/warning para otra
   * cosa (p. ej. dirección de llegada/salida en `/dashboard`) — el acento
   * compite con esa señal en vez de sumarle jerarquía.
   */
  accentTop?: boolean;
  /** Orden activo, o `null` para el orden por defecto del caller. */
  sort?: DataTableSort | null;
  /**
   * Avisa el orden siguiente. El primitive resuelve el ciclo —ascendente,
   * descendente, apagado— para que no lo reimplemente cada tabla, y `null`
   * significa volver al orden por defecto.
   */
  onSortChange?: (next: DataTableSort | null) => void;
}

/** Ciclo de una columna: asc → desc → apagado. */
function nextSort(sortKey: string, current: DataTableSort | null | undefined): DataTableSort | null {
  if (current?.key !== sortKey) return { key: sortKey, dir: "asc" };
  if (current.dir === "asc") return { key: sortKey, dir: "desc" };
  return null;
}

function normalizeHeader(header: DataTableHeader): {
  label: string;
  align: DataTableHeaderAlign;
  className?: string;
  sortKey?: string;
} {
  if (typeof header === "string") {
    return { label: header, align: "left" };
  }
  return {
    label: header.label,
    align: header.align ?? "left",
    className: header.className,
    sortKey: header.sortKey,
  };
}

function alignClass(align: DataTableHeaderAlign): string {
  if (align === "right") return "text-right";
  if (align === "center") return "text-center";
  return "text-left";
}

export function DataTable({ headers, children, emptyState, caption, className, minWidth = "640px", accentTop = true, sort, onSortChange }: DataTableProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-md border bg-card",
        accentTop ? "border-t-2 border-t-primary border-border" : "border-border",
        className
      )}
    >
      <div className="overflow-x-auto">
        <table className="w-full" style={{ minWidth }}>
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead>
            <tr className="border-b bg-muted/50">
              {headers.map((header, idx) => {
                const { label, align, className: headerClassName, sortKey } = normalizeHeader(header);
                const sortable = Boolean(sortKey && onSortChange);
                const active = sortable && sort?.key === sortKey ? sort : null;
                // `aria-sort` va en el `<th>`, no en el botón: es la CELDA la
                // que está ordenada. Las columnas no ordenables lo omiten —
                // "none" declararía que participan del orden y no lo hacen.
                const ariaSort = !sortable
                  ? undefined
                  : active
                    ? active.dir === "asc"
                      ? "ascending"
                      : "descending"
                    : "none";

                return (
                  <th
                    key={`${label}-${idx}`}
                    scope="col"
                    aria-sort={ariaSort}
                    className={cn(
                      "px-6 py-4 align-middle text-[10px] font-bold uppercase tracking-wider text-muted-foreground",
                      alignClass(align),
                      headerClassName
                    )}
                  >
                    {sortable ? (
                      <button
                        type="button"
                        onClick={() => onSortChange?.(nextSort(sortKey!, sort))}
                        // El nombre accesible arranca por la etiqueta visible,
                        // y el resto dice qué hace el click (WCAG 2.5.3).
                        aria-label={`${label}: ${
                          active?.dir === "asc"
                            ? "ordenar descendente"
                            : active
                              ? "quitar el orden"
                              : "ordenar ascendente"
                        }`}
                        className={cn(
                          "inline-flex items-center gap-1 rounded transition-colors hover:text-foreground",
                          // Hereda el uppercase y el tracking del `th`: el botón
                          // no debe verse distinto de una cabecera cualquiera.
                          active && "text-foreground",
                          align === "right" && "flex-row-reverse",
                        )}
                      >
                        <span>{label}</span>
                        {active ? (
                          active.dir === "asc" ? (
                            <ArrowUp className="size-3" aria-hidden="true" />
                          ) : (
                            <ArrowDown className="size-3" aria-hidden="true" />
                          )
                        ) : (
                          <ChevronsUpDown className="size-3 opacity-40" aria-hidden="true" />
                        )}
                      </button>
                    ) : (
                      label
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="text-xs">
            {children}
            {(!children || (Array.isArray(children) && children.length === 0)) && emptyState ? (
              <tr>
                <td colSpan={headers.length} className="px-6 py-10 text-center align-middle text-sm text-muted-foreground">
                  {emptyState}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
