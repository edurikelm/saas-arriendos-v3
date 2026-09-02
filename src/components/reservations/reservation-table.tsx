"use client";

import { MoreVertical, Eye, Pencil, Ban, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { DataTable } from "@/components/ui/data-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getInclusiveMonths } from "@/lib/reservation-dates";
import { getReservationPaidAmount } from "@/lib/payments/calculations";
import { dateKeyToDayIndex } from "@/lib/domain/timezone";
import type { Reservation } from "./types";
import { formatDate, formatPrice } from "./reservations-utils";
import { ReservationPill, reservationPillDotClass, type PillTone } from "./reservation-pill";
import { getReservationTone, getTemporalStatus } from "./reservation-status";

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[part.length - 1] || part[0])
    .join("")
    .toUpperCase();
}

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

function getPaymentTone(paidAmount: number, totalPrice: number): PillTone {
  if (paidAmount >= totalPrice && totalPrice > 0) return "success";
  if (paidAmount > 0) return "warning";
  return "destructive";
}

export function ReservationTable({ reservations, onEdit, onCancel, onDelete }: {
  reservations: Reservation[];
  onEdit?: (id: string) => void;
  onCancel?: (id: string) => void;
  onDelete?: (id: string) => void;
}) {
  const router = useRouter();
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
            "Finanzas",
            "Tipo",
            { label: "Acciones", align: "right" },
          ]}
        >
          {sorted.map((res) => {
            const paidAmount = getReservationPaidAmount(res.payments);
            const totalPrice = Number(res.totalPrice);
            const temporal = getTemporalStatus(res.startDate, res.endDate, res.billingType, res.status);
            const stateTone = getReservationTone(res.status, res.startDate, res.endDate);
            const paymentTone = getPaymentTone(paidAmount, totalPrice);
            const duration = res.billingType === "MONTHLY" ? `${getMonths(res.startDate, res.endDate)} meses` : `${getNights(res.startDate, res.endDate)} noches`;

            const finLabel = paymentTone === "success"
              ? "Saldado"
              : paymentTone === "warning"
                ? formatPrice(totalPrice - paidAmount)
                : formatPrice(totalPrice);
            const finSubtext = paymentTone === "success"
              ? res.status === "COMPLETED"
                ? `${formatPrice(paidAmount)} completado`
                : `${formatPrice(paidAmount)} pagado`
              : paymentTone === "warning"
                ? `Restante de ${formatPrice(totalPrice)}`
                : res.status === "CANCELLED"
                  ? "Pendiente de pago"
                  : "Sin abonos";

            return (
              <tr key={res.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                {/* Huésped */}
                <td className="px-6 py-5">
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
                <td className="px-6 py-5 text-xs font-medium text-foreground">
                  {res.property.name}
                </td>
                {/* Estado */}
                <td className="px-6 py-5 align-middle">
                  <div className="flex flex-col items-start gap-1">
                    <ReservationPill tone={stateTone} label={temporal.label} />
                    {temporal.sublabel && (
                      <span className="text-[9px] text-muted-foreground">{temporal.sublabel}</span>
                    )}
                  </div>
                </td>
                {/* Estancia */}
                <td className="px-6 py-5">
                  <div className="text-xs text-foreground font-medium whitespace-nowrap tabular-nums">
                    {formatDate(res.startDate)} - {formatDate(res.endDate)}
                  </div>
                  <div className="mt-0.5">
                    <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-tight">{duration}</span>
                  </div>
                </td>
                {/* Finanzas */}
                <td className="px-6 py-5">
                  <div className="flex items-stretch gap-3">
<div className={`w-0.5 rounded-full ${reservationPillDotClass[paymentTone]}`} />
                    <div className="flex flex-col">
                      <p className={`text-xs font-bold tabular-nums ${paymentTone === "success" ? "text-success" : paymentTone === "warning" ? "text-foreground" : "text-destructive-text"}`}>
                        {finLabel}
                      </p>
                      <p className="text-[10px] text-muted-foreground tabular-nums">{finSubtext}</p>
                    </div>
                  </div>
                </td>
                {/* Tipo */}
                <td className="px-6 py-5">
                  <div className="flex justify-start">
                    <span className="inline-flex px-2 py-0.5 rounded bg-muted text-muted-foreground text-[9px] font-bold uppercase">
                      {res.billingType === "DAILY" ? "Diaria" : "Mensual"}
                    </span>
                  </div>
                </td>
                {/* Acciones */}
                <td className="px-6 py-5 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      className="inline-flex size-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      aria-label="Más acciones"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => router.push(`/reservations/${res.id}`)}>
                        <Eye className="mr-1.5 h-4 w-4" />
                        Ver
                      </DropdownMenuItem>
                      {onEdit && (
                        <DropdownMenuItem onClick={() => onEdit(res.id)}>
                          <Pencil className="mr-1.5 h-4 w-4" />
                          Editar
                        </DropdownMenuItem>
                      )}
                      {(res.status === "PENDING" || res.status === "CONFIRMED") && onCancel && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => onCancel(res.id)}
                          >
                            <Ban className="mr-1.5 h-4 w-4" />
                            Cancelar
                          </DropdownMenuItem>
                        </>
                      )}
                      {(res.status === "CANCELLED" || res.status === "COMPLETED") && onDelete && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => onDelete(res.id)}
                          >
                            <Trash2 className="mr-1.5 h-4 w-4" />
                            Eliminar
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            );
          })}
        </DataTable>
      </div>
    </div>
  );
}
