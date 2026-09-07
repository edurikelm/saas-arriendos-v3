"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatDate, getInitials } from "./reservations-utils";
import type { Reservation } from "@/components/reservations/types";
import {
  formatStayProgress,
  getReservationTone,
  getStayProgress,
  getTemporalStatus,
} from "./reservation-status";
import { ReservationPill } from "./reservation-pill";
import { getFinanceDisplay } from "./reservation-finance";
import { ReservationActionsMenu } from "./reservation-actions-menu";

interface ReservationListItemProps {
  reservation: Reservation;
  onEdit: (reservation: Reservation) => void;
  onCancel: (id: string) => void;
  onDelete: (id: string) => void;
}

/**
 * Fila de reserva en móvil (<768px). Es una FILA dentro de un contenedor único,
 * no una card por reserva.
 *
 * Antes cada reserva era una `<Card>` de 294–346px: entraban 1,7 por pantalla y
 * ocho reservas pedían 2870px de scroll. La altura se iba en cosas que ya se
 * dicen en otro lado o que no necesitan estar siempre visibles — una barra de
 * tres botones (Ver / Editar / Cancelar), las etiquetas "Propiedad" / "Estancia"
 * / "Tipo" sobre cada dato, y el chip DIARIA/MENSUAL que repetía el sublabel de
 * duración. Con eso adentro de un ⋮ y los datos en tres líneas, la fila queda
 * cerca de 150px y entran ~5 por pantalla.
 *
 * Dos cosas más que cambian acá:
 * - **El pill recupera su sublabel.** La versión anterior mostraba "ACTIVA" a
 *   secas mientras desktop mostraba "ACTIVA / 7 noches", así que en el teléfono
 *   se perdía cuánto queda — justo el dato que se mira en movimiento.
 * - **Se va la barra de color de 4px del borde izquierdo.** Un borde lateral de
 *   color por encima de 1px es decoración: el estado ya lo dice el pill, con
 *   palabra y con tono, y sin gastar ancho en una pantalla de 375px.
 */
export function ReservationListItem({
  reservation,
  onEdit,
  onCancel,
  onDelete,
}: ReservationListItemProps) {
  const fin = getFinanceDisplay(reservation.payments, reservation.totalPrice, reservation.status, reservation.startDate);
  const temporal = getTemporalStatus(
    reservation.startDate,
    reservation.endDate,
    reservation.billingType,
    reservation.status,
  );
  const stateTone = getReservationTone(reservation.status, reservation.startDate, reservation.endDate);
  const duration = formatStayProgress(
    getStayProgress(
      reservation.startDate,
      reservation.endDate,
      reservation.billingType,
      reservation.status,
    ),
  );

  return (
    <div className="border-b border-border p-4 last:border-0">
      {/* Huésped + acciones */}
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
          {getInitials(reservation.client.name)}
        </div>
        <div className="min-w-0 flex-1">
          <Link
            href={`/reservations/${reservation.id}`}
            className="block truncate text-sm font-bold text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {reservation.client.name}
          </Link>
          {/* El nombre de la propiedad es lo de largo variable, así que es lo
              que se trunca; el progreso va `shrink-0` para no perderse. Con
              `truncate` en todo el párrafo, "noche 7 de 12" se cortaba en
              "noche 7 d…" justo en las propiedades de nombre largo. */}
          <p className="flex min-w-0 items-baseline gap-1 text-xs text-muted-foreground">
            <span className="truncate">{reservation.property.name}</span>
            <span className="shrink-0">· {duration}</span>
          </p>
        </div>
        <ReservationActionsMenu
          reservation={reservation}
          onEdit={() => onEdit(reservation)}
          onCancel={onCancel}
          onDelete={onDelete}
          className="-mr-1 inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        />
      </div>

      {/* Estado + estancia */}
      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <ReservationPill tone={stateTone} label={temporal.label} />
        {temporal.sublabel && (
          <span className="text-[10px] text-muted-foreground">{temporal.sublabel}</span>
        )}
        <span className="ml-auto whitespace-nowrap text-xs tabular-nums text-foreground">
          {formatDate(reservation.startDate)} – {formatDate(reservation.endDate)}
        </span>
      </div>

      {/* Por cobrar — misma magnitud que la columna de desktop. Acá lleva label
          propio: en la tabla el nombre de la magnitud lo pone el `<th>`, y una
          lista no tiene encabezado, así que el monto se quedaba sin nombre. */}
      <div className="mt-2 flex items-baseline justify-between gap-3">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Por cobrar
        </span>
        <span className="flex items-baseline gap-2 truncate">
          <span className="truncate text-[10px] tabular-nums text-muted-foreground">{fin.subtext}</span>
          <span className={cn("text-xs font-bold tabular-nums", fin.labelClassName)}>{fin.label}</span>
        </span>
      </div>

      {reservation.notes && (
        <p className="mt-2 line-clamp-1 text-xs text-muted-foreground">{reservation.notes}</p>
      )}
    </div>
  );
}
