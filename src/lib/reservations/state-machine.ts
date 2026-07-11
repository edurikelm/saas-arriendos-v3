/**
 * Máquina de estados de Reservation.
 *
 * Codifica las transiciones válidas del enum `ReservationStatus` y las
 * precondiciones asociadas (ej: COMPLETED requiere ≥1 pago RESERVATION
 * COMPLETED). Usada por `updateReservation` para rechazar cambios de
 * estado inválidos antes de escribirlos a DB.
 *
 * Reglas (CONTEXT.md + decisiones de diseño 2026-07-11):
 *
 * | from → to          | Permitido | Condición                              |
 * |--------------------|-----------|----------------------------------------|
 * | * → mismo          | ✅        | no-op                                  |
 * | PENDING → CONFIRMED | ✅       | siempre (override del owner)            |
 * | PENDING → COMPLETED | ❌       | debe pasar por CONFIRMED vía pago       |
 * | PENDING → CANCELLED | ✅*      | *permitido por la máquina; updateReservation bloquea para forzar cancelReservation() |
 * | CONFIRMED → PENDING | ✅       | downgrade                              |
 * | CONFIRMED → COMPLETED | ✅     | requiere ≥1 pago RESERVATION COMPLETED |
 * | CONFIRMED → CANCELLED | ✅*     | *mismo caso que PENDING → CANCELLED    |
 * | CANCELLED → *       | ❌       | estado terminal                         |
 * | COMPLETED → *       | ❌       | estado terminal                         |
 *
 * Las transiciones a CANCELLED son *válidas* a nivel de máquina, pero la
 * acción `updateReservation` las rechaza para forzar el uso de
 * `cancelReservation()` que sí ejecuta la limpieza de pagos PENDING. Esa
 * separación se mantiene acá: la máquina describe el dominio, la acción
 * describe su workflow de uso.
 */

export type ReservationStatus =
  | "PENDING"
  | "CONFIRMED"
  | "CANCELLED"
  | "COMPLETED";

export type TransitionContext = {
  from: ReservationStatus;
  to: ReservationStatus;
  /**
   * Cantidad de pagos con `paymentType: RESERVATION`, `status: COMPLETED`
   * y `deletedAt: null` para esta reserva. Necesario solo para
   * validar la transición a `COMPLETED`.
   */
  completedReservationPayments: number;
};

export type TransitionResult =
  | { ok: true }
  | { ok: false; reason: string };

export function canTransition(ctx: TransitionContext): TransitionResult {
  const { from, to, completedReservationPayments } = ctx;

  // No-op: mismo estado siempre permitido
  if (from === to) return { ok: true };

  // Estados terminales: nada puede transicionar fuera de ellos
  if (from === "CANCELLED") {
    return {
      ok: false,
      reason:
        "No se puede cambiar el estado de una reserva cancelada (estado terminal).",
    };
  }
  if (from === "COMPLETED") {
    return {
      ok: false,
      reason:
        "No se puede cambiar el estado de una reserva completada (estado terminal).",
    };
  }

  // from === "PENDING" | "CONFIRMED" (los no-terminales)
  switch (to) {
    case "CANCELLED":
      // Válido a nivel de máquina — la acción updateReservation
      // bloquea esta transición para forzar cancelReservation()
      // (que limpia pagos PENDING como side effect).
      return { ok: true };

    case "COMPLETED":
      if (from !== "CONFIRMED") {
        return {
          ok: false,
          reason: `Una reserva ${from} no puede pasar directamente a COMPLETED. Debe pasar por CONFIRMED primero.`,
        };
      }
      if (completedReservationPayments < 1) {
        return {
          ok: false,
          reason:
            "Para marcar como COMPLETED la reserva debe tener al menos 1 pago RESERVATION COMPLETED.",
        };
      }
      return { ok: true };

    case "CONFIRMED":
      // PENDING → CONFIRMED (override del owner; el helper
      // confirmReservationIfPaid también lo dispara automáticamente
      // cuando se alcanza totalPrice).
      return { ok: true };

    case "PENDING":
      // CONFIRMED → PENDING (downgrade).
      return { ok: true };

    default: {
      const _exhaustive: never = to;
      throw new Error(`Unhandled target status: ${String(_exhaustive)}`);
    }
  }
}