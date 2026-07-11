/**
 * Lógica de transición PENDING → CONFIRMED para Reservas.
 *
 * Regla de dominio (CONTEXT.md):
 * - Una reserva pasa a `CONFIRMED` cuando la suma de `Payment` con
 *   `status: COMPLETED`, `paymentType: RESERVATION` (no `EXTRA`) y
 *   `deletedAt: null` alcanza `totalPrice`.
 * - Pagos `PENDING` o `paymentType: EXTRA` no participan en esta transición.
 * - Reservas `CANCELLED` o `COMPLETED` **no** deben transicionar a `CONFIRMED`
 *   automáticamente aunque tengan pagos: la transición es rechazada.
 *
 * Regla extraída de los 5 callsites en `src/lib/actions/payments.ts` donde
 * esta lógica vivía duplicada. Ahora es un único seam testeable.
 *
 * El helper acepta un `adapter` opcional para participar en `$transaction`
 * del caller (ver `Prisma.TransactionClient`). Si no se pasa, usa `prisma`
 * directo (modo no transaccional, comportamiento histórico).
 */

import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";
import {
  getReservationPaidAmount,
  type PaymentLike,
} from "@/lib/payments/calculations";

export type ConfirmationOutcome =
  | { status: "confirmed"; totalPaid: number; totalPrice: number }
  | { status: "already_confirmed"; totalPaid: number; totalPrice: number }
  | { status: "below_threshold"; totalPaid: number; totalPrice: number }
  | { status: "skipped_cancelled"; totalPaid: number; totalPrice: number }
  | { status: "skipped_completed"; totalPaid: number; totalPrice: number }
  | { status: "not_found" };

export type ConfirmationAdapter = Prisma.TransactionClient | typeof prisma;

/**
 * Evalúa si una Reserva debe pasar a `CONFIRMED` según sus Pagos.
 *
 * Comportamiento por estado actual de la Reserva:
 * - `PENDING` + `totalPaid >= totalPrice` → flip a CONFIRMED, retorna `{ status: "confirmed" }`.
 * - `PENDING` + `totalPaid < totalPrice` → no-op, retorna `{ status: "below_threshold" }`.
 * - `CONFIRMED` → no-op (idempotente para webhooks duplicados), retorna `{ status: "already_confirmed" }`.
 * - `CANCELLED` → no-op (no se debe auto-confirmar una reserva cancelada),
 *   retorna `{ status: "skipped_cancelled" }`.
 * - `COMPLETED` → no-op (la reserva ya terminó), retorna `{ status: "skipped_completed" }`.
 * - Reserva no encontrada → retorna `{ status: "not_found" }`.
 *
 * El adapter opcional permite que callers ya envueltos en `$transaction`
 * pasen su `tx` para que el `update` participe en la misma unidad atómica.
 * Si se omite, se usa el cliente global `prisma` (no transaccional).
 */
export async function confirmReservationIfPaid(
  reservationId: string,
  adapter: ConfirmationAdapter = prisma,
): Promise<ConfirmationOutcome> {
  const reservation = await adapter.reservation.findFirst({
    where: { id: reservationId },
    select: { id: true, status: true, totalPrice: true },
  });

  if (!reservation) {
    return { status: "not_found" };
  }

  const totalPrice = Number(reservation.totalPrice);

  const payments = await adapter.payment.findMany({
    where: {
      reservationId,
      status: { in: ["COMPLETED", "PENDING"] },
      deletedAt: null,
    },
  });

  const totalPaid = getReservationPaidAmount(
    payments as unknown as PaymentLike[],
  );

  switch (reservation.status) {
    case "CANCELLED":
      return { status: "skipped_cancelled", totalPaid, totalPrice };
    case "COMPLETED":
      return { status: "skipped_completed", totalPaid, totalPrice };
    case "CONFIRMED":
      return { status: "already_confirmed", totalPaid, totalPrice };
    case "PENDING":
      if (totalPaid >= totalPrice) {
        await adapter.reservation.update({
          where: { id: reservationId },
          data: { status: "CONFIRMED" },
        });
        return { status: "confirmed", totalPaid, totalPrice };
      }
      return { status: "below_threshold", totalPaid, totalPrice };
    default: {
      const _exhaustive: never = reservation.status;
      throw new Error(
        `Unhandled reservation status: ${String(_exhaustive)}`,
      );
    }
  }
}