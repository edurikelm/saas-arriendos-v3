"use client";

import { MoreVertical, Eye, Pencil, Ban, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Reservation } from "./types";

/**
 * Menú de acciones de una reserva. Único para las dos vistas de la lista.
 *
 * La tarjeta móvil tenía una barra de tres botones (Ver / Editar / Cancelar)
 * que ocupaba 44px de alto por reserva mientras la tabla desktop ya resolvía lo
 * mismo con un ⋮. Con las acciones acá adentro, el móvil recupera esa altura y
 * las dos vistas ofrecen exactamente el mismo conjunto — antes divergían: en
 * móvil "Eliminar" era un botón destructivo siempre visible.
 */
export function ReservationActionsMenu({
  reservation,
  onEdit,
  onCancel,
  onDelete,
  className,
}: {
  reservation: Reservation;
  onEdit?: (id: string) => void;
  onCancel?: (id: string) => void;
  onDelete?: (id: string) => void;
  className?: string;
}) {
  const router = useRouter();
  const { id, status } = reservation;
  const cancelable = status === "PENDING" || status === "CONFIRMED";
  const deletable = status === "CANCELLED" || status === "COMPLETED";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={
          className ??
          "inline-flex size-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        }
        aria-label={`Acciones de la reserva de ${reservation.client.name}`}
      >
        <MoreVertical className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => router.push(`/reservations/${id}`)}>
          <Eye className="mr-1.5 h-4 w-4" />
          Ver
        </DropdownMenuItem>
        {onEdit && (
          <DropdownMenuItem onClick={() => onEdit(id)}>
            <Pencil className="mr-1.5 h-4 w-4" />
            Editar
          </DropdownMenuItem>
        )}
        {cancelable && onCancel && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => onCancel(id)}>
              <Ban className="mr-1.5 h-4 w-4" />
              Cancelar
            </DropdownMenuItem>
          </>
        )}
        {deletable && onDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => onDelete(id)}>
              <Trash2 className="mr-1.5 h-4 w-4" />
              Eliminar
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
