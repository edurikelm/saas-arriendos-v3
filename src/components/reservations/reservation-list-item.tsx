"use client";

import { formatDate, formatPrice } from "./reservations-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Eye, Pencil, Ban, Trash2 } from "lucide-react";
import { getReservationPaidAmount } from "@/lib/payments/calculations";
import type { Reservation } from "@/components/reservations/types";

const statusLabels: Record<string, { label: string; variant: "success" | "warning" | "destructive" | "secondary" }> = {
  PENDING: { label: "Pendiente", variant: "warning" },
  CONFIRMED: { label: "Confirmada", variant: "success" },
  CANCELLED: { label: "Cancelada", variant: "destructive" },
  COMPLETED: { label: "Completada", variant: "secondary" },
};

interface ReservationListItemProps {
  reservation: Reservation;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onView: (reservation: Reservation) => void;
  onEdit: (reservation: Reservation) => void;
  onCancel: (id: string) => void;
  onDelete: (id: string) => void;
}

export function ReservationListItem({
  reservation,
  isSelected,
  onToggleSelect,
  onView,
  onEdit,
  onCancel,
  onDelete,
}: ReservationListItemProps) {
  const status = statusLabels[reservation.status] || statusLabels.PENDING;
  const paidAmount = getReservationPaidAmount(reservation.payments);
  const pendingAmountVal = Number(reservation.totalPrice) - paidAmount;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">{reservation.property.name}</CardTitle>
            <CardDescription>
              {reservation.client.name} · {reservation.client.email}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => onToggleSelect(reservation.id)}
              aria-label={`Seleccionar reserva de ${reservation.client.name}`}
            />
            <Badge variant={status.variant}>{status.label}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Fechas</p>
            <p className="font-medium">
              {formatDate(reservation.startDate)} - {formatDate(reservation.endDate)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Tipo</p>
            <p className="font-medium">
              {reservation.billingType === "DAILY" ? "Diario" : "Mensual"}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Unidades</p>
            <p className="font-medium">{reservation.unitsBooked}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Total</p>
            <p className="font-medium">{formatPrice(reservation.totalPrice)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Pagado</p>
            <p className="font-medium">{formatPrice(paidAmount)}</p>
            {pendingAmountVal > 0 && (
              <Badge variant="warning" className="mt-1">
                {formatPrice(pendingAmountVal)} pendiente
              </Badge>
            )}
          </div>
        </div>

        {reservation.notes && (
          <p className="mt-3 text-sm text-muted-foreground">
            <span className="font-medium">Notas:</span> {reservation.notes}
          </p>
        )}

        <div className="flex items-center gap-2 mt-4">
          <Button variant="outline" size="sm" onClick={() => onView(reservation)}>
            <Eye className="h-4 w-4 mr-1" />
            Ver
          </Button>
          <Button variant="outline" size="sm" onClick={() => onEdit(reservation)}>
            <Pencil className="h-4 w-4 mr-1" />
            Editar
          </Button>
          {reservation.status !== "CANCELLED" && reservation.status !== "COMPLETED" && (
            <Button variant="outline" size="sm" onClick={() => onCancel(reservation.id)}>
              <Ban className="h-4 w-4 mr-1" />
              Cancelar
            </Button>
          )}
          {(reservation.status === "CANCELLED" || reservation.status === "COMPLETED") && (
            <Button variant="destructive" size="sm" onClick={() => onDelete(reservation.id)}>
              <Trash2 className="h-4 w-4 mr-1" />
              Eliminar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
