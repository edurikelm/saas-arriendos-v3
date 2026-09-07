"use client";

import { DataTable } from "@/components/ui/data-table";
import { cn } from "@/lib/utils";
import { getInclusiveMonths } from "@/lib/reservation-dates";
import { dateKeyToDayIndex } from "@/lib/domain/timezone";
import type { Reservation } from "./types";
import { formatDate, getInitials } from "./reservations-utils";
import { ReservationPill } from "./reservation-pill";
import { getReservationTone, getTemporalStatus } from "./reservation-status";
import { getFinanceDisplay } from "./reservation-finance";
import { ReservationActionsMenu } from "./reservation-actions-menu";

/**
 * Padding + hover de cada celda. El hover vive en la celda y no en el `<tr>`
 * porque la columna de acciones es `sticky` y necesita fondo propio: con el
 * hover en la fila, la celda fija lo tapaba (o lo pintaba dos veces).
 */
const CELL = "px-6 py-5 bg-card group-hover:bg-muted/30 transition-colors";

/**
 * La columna de acciones se fija al borde derecho.
 *
 * Medido al ancho real de contenido de un laptop de 1280 (sidebar 256 +
 * padding 48 → 959px útiles): la tabla necesitaba 987px con los nombres cortos
 * que hay hoy en producción y 1062px con nombres de largo normal
 * ("Departamento Vista al Mar"). En el segundo caso el botón ⋮ quedaba entero
 * fuera de la zona visible, y como las filas no son clickeables (The Row
 * Isolation Rule) el scroll horizontal era el único camino a Ver / Editar /
 * Cancelar, sin nada que lo señalara. Fijándola, el menú es alcanzable a
 * cualquier ancho.
 */
const ACTIONS_CELL = "sticky right-0 z-10 border-l border-border";

function getNights(startDate: string, endDate: string): number {
  // start_date / end_date son date-only en el dominio (CONTEXT.md).
  // diff en días calendario (dateKeyToDayIndex usa UTC, evita drift por DST).
  const startKey = startDate.slice(0, 10);
  const endKey = endDate.slice(0, 10);
  return Math.max(1, dateKeyToDayIndex(endKey) - dateKeyToDayIndex(startKey) + 1);
}

function getMonths(startDate: string, endDate: string): number {
  return getInclusiveMonths(startDate, endDate);
}

export function ReservationTable({ reservations, onEdit, onCancel, onDelete }: {
  reservations: Reservation[];
  onEdit?: (id: string) => void;
  onCancel?: (id: string) => void;
  onDelete?: (id: string) => void;
}) {
  // Reservations arrive pre-sorted from the server (createdAt desc). No client-side sort UI.
  const sorted = reservations;

  return (
    <div className="space-y-4">
      <div className="hidden md:block">
        <DataTable
          headers={[
            "Huésped",
            "Propiedad",
            "Estado",
            "Estancia",
            // La columna dice qué magnitud contiene. "Finanzas" nombraba un tema,
            // no una cantidad, y por eso toleraba una cifra distinta en cada fila.
            { label: "Por cobrar", align: "right" },
            {
              label: "Acciones",
              align: "right",
              // La celda fija necesita fondo OPACO (si no, los `th` que pasan
              // por debajo al scrollear se transparentan a través). `bg-muted`
              // suelto se ve más oscuro que el resto del header, que es
              // `bg-muted/50` sobre la card: 243,244,246 contra 249,249,250.
              // `color-mix` de los mismos dos tokens da ese compuesto exacto,
              // ya opaco — sin hardcodear un color.
              className:
                "sticky right-0 z-20 border-l border-border bg-[color-mix(in_srgb,var(--muted)_50%,var(--card))]",
            },
          ]}
        >
          {sorted.map((res) => {
            const temporal = getTemporalStatus(res.startDate, res.endDate, res.billingType, res.status);
            const stateTone = getReservationTone(res.status, res.startDate, res.endDate);
            const fin = getFinanceDisplay(res.payments, res.totalPrice, res.status);
            // El sublabel ya distingue DAILY de MONTHLY ("12 noches" vs "3 meses")
            // y además dice cuánto dura. La columna "Tipo" repetía esa misma
            // distinción en 107px que la tabla no tenía.
            const duration = res.billingType === "MONTHLY"
              ? `${getMonths(res.startDate, res.endDate)} meses`
              : `${getNights(res.startDate, res.endDate)} noches`;

            return (
              <tr key={res.id} className="group border-b last:border-0">
                {/* Huésped */}
                <td className={CELL}>
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      {getInitials(res.client.name)}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-foreground">{res.client.name}</p>
                      <p className="truncate text-[10px] text-muted-foreground">{res.client.email}</p>
                    </div>
                  </div>
                </td>
                {/* Propiedad */}
                <td className={cn(CELL, "text-xs font-medium text-foreground")}>
                  {res.property.name}
                </td>
                {/* Estado */}
                <td className={cn(CELL, "align-middle")}>
                  <div className="flex flex-col items-start gap-1">
                    <ReservationPill tone={stateTone} label={temporal.label} />
                    {temporal.sublabel && (
                      <span className="text-[10px] text-muted-foreground">{temporal.sublabel}</span>
                    )}
                  </div>
                </td>
                {/* Estancia */}
                <td className={CELL}>
                  <div className="whitespace-nowrap text-xs font-medium tabular-nums text-foreground">
                    {formatDate(res.startDate)} – {formatDate(res.endDate)}
                  </div>
                  <div className="mt-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{duration}</span>
                  </div>
                </td>
                {/* Por cobrar — misma magnitud en todas las filas, alineada a la
                    derecha para que los dígitos se comparen en vertical. */}
                <td className={cn(CELL, "text-right")}>
                  <p className={cn("text-xs font-bold tabular-nums", fin.labelClassName)}>
                    {fin.label}
                  </p>
                  <p className="whitespace-nowrap text-[10px] tabular-nums text-muted-foreground">{fin.subtext}</p>
                </td>
                {/* Acciones */}
                <td className={cn(CELL, ACTIONS_CELL, "text-right")}>
                  <ReservationActionsMenu
                    reservation={res}
                    onEdit={onEdit}
                    onCancel={onCancel}
                    onDelete={onDelete}
                  />
                </td>
              </tr>
            );
          })}
        </DataTable>
      </div>
    </div>
  );
}
