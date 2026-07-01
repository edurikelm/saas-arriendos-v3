/**
 * Helpers para calcular el saldo del arriendo de una reserva.
 *
 * Regla de dominio (CONTEXT.md):
 * - `paymentType: RESERVATION` corresponde al arriendo (cuenta para el saldo).
 * - `paymentType: EXTRA` es un cobro independiente (multa, limpieza extra, etc.)
 *   que NO afecta el `totalPrice` y NO cuenta en el saldo del arriendo.
 * - Pagos soft-deleted (`deletedAt` no nulo) se excluyen siempre (auditoría).
 * - Si `paymentType` es `null` o `undefined`, se trata como `RESERVATION`
 *   (alineado con `paymentSchema` default en `src/lib/validations/payment.ts`).
 */

/**
 * Tipo mínimo-compatible con cualquier shape de Payment usado en vistas.
 * Acepta tanto strings serializados desde server (clientes) como Decimals
 * o numbers en otros contextos.
 */
export type PaymentLike = {
  amount?: string | number | null;
  status?: string | null;
  paymentType?: string | null;
  deletedAt?: string | Date | null;
};

/**
 * Suma de pagos que cuentan para el saldo del arriendo.
 *
 * Criterios (todos):
 * - `status === "COMPLETED"`
 * - `deletedAt` nulo o undefined (soft-deleted se excluye)
 * - `paymentType !== "EXTRA"` (undefined/null cuenta como RESERVATION)
 */
export function getReservationPaidAmount(payments: PaymentLike[]): number {
  return payments
    .filter(
      (p) =>
        p.status === "COMPLETED" &&
        !p.deletedAt &&
        (p.paymentType ?? "RESERVATION") !== "EXTRA",
    )
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);
}

/**
 * Pendiente del arriendo = max(totalPrice - paid, 0).
 * Nunca retorna negativo (caso overpaid → 0).
 */
export function getReservationPendingAmount(
  payments: PaymentLike[],
  totalPrice: number,
): number {
  return Math.max(Number(totalPrice || 0) - getReservationPaidAmount(payments), 0);
}
