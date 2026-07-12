/**
 * Queries Prisma de Payment centralizadas como seam canónico.
 *
 * Regla de dominio (CONTEXT.md):
 * - `paymentType: RESERVATION` cuenta para el saldo del arriendo.
 * - `paymentType: EXTRA` es cobro independiente (multa, limpieza). NO cuenta para saldo.
 * - Pagos soft-deleted (`deletedAt: not null`) se excluyen siempre (auditoría).
 *
 * Decisión de KPI (revenue / "cobrado en el mes"):
 * - **Se usa `paidAt`** (cash basis: cuándo entró el dinero).
 * - Histórico: `src/lib/actions/reports.ts` usaba `createdAt` (accrual basis: cuándo
 *   se creó el record). Migrado a `paidAt` en este seam para alinear con
 *   `getPaymentsKpis` en `src/lib/actions/payments.ts` (más reciente, finan-
 *   ciero-correcto para owners que preguntan "¿cuánto entró este mes?").
 * - Filtros aceptan `from`/`to` opcionales; si no se pasan, se devuelve el agregado total.
 *
 * Patrón de adapter:
 * - Todos los helpers aceptan un `adapter` opcional (`Prisma.TransactionClient |
 *   typeof prisma`) para participar en `$transaction` del caller.
 * - Si se omite, se usa el cliente global `prisma` (modo no transaccional).
 * - Mismo patrón que `lib/reservations/confirmation.ts`.
 */

import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";
import type { Payment } from "@prisma/client";

export type QueryAdapter = Prisma.TransactionClient | typeof prisma;

// ────────────────────────────────────────────────────────────────────────────
// Patrón A — Lookup por ID / mercadoPagoId (con include opcional)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Busca un Payment por ID incluyendo reservation + client.
 * Excluye soft-deleted automáticamente.
 *
 * @param includeClient si false, omite `client` (default true).
 * @param includeProperty si true, agrega `reservation.property` (necesario en
 *        el webhook de MP). Default false.
 */
export async function getPaymentById(
  paymentId: string,
  options: { includeClient?: boolean; includeProperty?: boolean } = {},
  adapter: QueryAdapter = prisma,
): Promise<Payment | null> {
  const { includeClient = true, includeProperty = false } = options;
  return adapter.payment.findFirst({
    where: { id: paymentId, deletedAt: null },
    include: {
      reservation: {
        include: {
          client: includeClient,
          ...(includeProperty ? { property: true } : {}),
        },
      },
    },
  });
}

/**
 * Busca un Payment por `mercadoPagoId` (preference_id) con reservation + client.
 * Excluye soft-deleted. Usado en el webhook de MP cuando no hay paymentId hint.
 */
export async function getPaymentByMercadoPagoId(
  mercadoPagoId: string,
  options: { includeClient?: boolean } = {},
  adapter: QueryAdapter = prisma,
): Promise<Payment | null> {
  const { includeClient = true } = options;
  return adapter.payment.findFirst({
    where: { mercadoPagoId, deletedAt: null },
    include: {
      reservation: {
        include: {
          client: includeClient,
        },
      },
    },
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Patrón B — findMany para pagos de una reserva
// ────────────────────────────────────────────────────────────────────────────

/**
 * Todos los pagos activos (no soft-deleted) de una reserva, sin filtro de status.
 * Usado como input a `getReservationPaidAmount` y similares.
 */
export async function getAllPaymentsForReservation(
  reservationId: string,
  adapter: QueryAdapter = prisma,
): Promise<Payment[]> {
  return adapter.payment.findMany({
    where: { reservationId, deletedAt: null },
  });
}

/**
 * Pagos que cuentan para el cálculo de saldo del arriendo:
 * status COMPLETED | PENDING, paymentType RESERVATION (no EXTRA), no soft-deleted.
 * Usado en `confirmReservationIfPaid`.
 */
export async function getActivePaymentsForReservation(
  reservationId: string,
  adapter: QueryAdapter = prisma,
): Promise<Payment[]> {
  return adapter.payment.findMany({
    where: {
      reservationId,
      status: { in: ["COMPLETED", "PENDING"] },
      deletedAt: null,
    },
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Patrón C — Aggregates para KPIs (revenue por owner)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Suma de pagos COMPLETED + RESERVATION para un owner en un rango de fechas
 * (usa `paidAt` como filtro de fecha — cash basis; ver JSDoc del archivo).
 *
 * Si no se pasa `from` ni `to`, devuelve el total histórico.
 */
export async function sumCompletedPaymentsForOwner(
  userId: string,
  options: { from?: Date; to?: Date } = {},
  adapter: QueryAdapter = prisma,
): Promise<number> {
  const { from, to } = options;
  const result = await adapter.payment.aggregate({
    where: {
      status: "COMPLETED",
      paymentType: "RESERVATION",
      paidAt: {
        ...(from ? { gte: from } : {}),
        ...(to ? { lte: to } : {}),
      },
      deletedAt: null,
      reservation: { userId },
    },
    _sum: { amount: true },
  });
  return Number(result._sum.amount ?? 0);
}

/**
 * Suma de pagos PENDING + RESERVATION para un owner (sin filtro de fecha).
 */
export async function sumPendingPaymentsForOwner(
  userId: string,
  adapter: QueryAdapter = prisma,
): Promise<number> {
  const result = await adapter.payment.aggregate({
    where: {
      status: "PENDING",
      paymentType: "RESERVATION",
      deletedAt: null,
      reservation: { userId },
    },
    _sum: { amount: true },
  });
  return Number(result._sum.amount ?? 0);
}

/**
 * Conteo de pagos PENDING + RESERVATION para un owner.
 */
export async function countPendingPaymentsForOwner(
  userId: string,
  adapter: QueryAdapter = prisma,
): Promise<number> {
  return adapter.payment.count({
    where: {
      status: "PENDING",
      paymentType: "RESERVATION",
      deletedAt: null,
      reservation: { userId },
    },
  });
}

/**
 * Suma de pagos COMPLETED de TODOS los owners (sin filtro de userId).
 * Filtrado solo por status — usado por SUPER_ADMIN para métricas globales.
 */
export async function sumCompletedPaymentsAll(
  adapter: QueryAdapter = prisma,
): Promise<number> {
  const result = await adapter.payment.aggregate({
    where: { status: "COMPLETED" },
    _sum: { amount: true },
  });
  return Number(result._sum.amount ?? 0);
}

// ────────────────────────────────────────────────────────────────────────────
// Patrón D — Status updates (mark payment as COMPLETED / FAILED / revert)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Marca un payment como COMPLETED.
 *
 * Acepta campos opcionales: `paidAt` (default: now), `mercadoPagoId`,
 * `receiptUrl`. El caller es responsable de pasar los campos relevantes
 * según el método (MP webhook vs manual).
 */
export async function markPaymentCompleted(
  paymentId: string,
  data: {
    paidAt?: Date;
    mercadoPagoId?: string;
    receiptUrl?: string;
  } = {},
  adapter: QueryAdapter = prisma,
): Promise<Payment> {
  return adapter.payment.update({
    where: { id: paymentId },
    data: {
      status: "COMPLETED",
      paidAt: data.paidAt ?? new Date(),
      ...(data.mercadoPagoId ? { mercadoPagoId: data.mercadoPagoId } : {}),
      ...(data.receiptUrl ? { receiptUrl: data.receiptUrl } : {}),
    },
  });
}

/**
 * Marca un payment con status explícito (PENDING | FAILED).
 *
 * NO setea paidAt (asume que el pago nunca estuvo COMPLETED o que se está
 * marcando como fallido desde un estado terminal).
 */
export async function markPaymentStatus(
  paymentId: string,
  status: "PENDING" | "FAILED",
  data: { mercadoPagoId?: string; receiptUrl?: string } = {},
  adapter: QueryAdapter = prisma,
): Promise<Payment> {
  return adapter.payment.update({
    where: { id: paymentId },
    data: {
      status,
      ...(data.mercadoPagoId ? { mercadoPagoId: data.mercadoPagoId } : {}),
      ...(data.receiptUrl ? { receiptUrl: data.receiptUrl } : {}),
    },
  });
}

/**
 * Revierte un payment a PENDING (limpia paidAt).
 *
 * Útil cuando un pago fue marcado COMPLETED por error o cuando se revierte
 * la confirmación tras una falla de MP.
 */
export async function revertPaymentToPending(
  paymentId: string,
  adapter: QueryAdapter = prisma,
): Promise<Payment> {
  return adapter.payment.update({
    where: { id: paymentId },
    data: {
      status: "PENDING",
      paidAt: null,
    },
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Patrón E — Counters (verificar completitud de pagos de una reserva)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Cuenta pagos COMPLETED (no soft-deleted) de una reserva.
 *
 * Usado por `deleteReservation` para bloquear borrado si hay ≥1 pago
 * completado (preservación de auditoría financiera).
 */
export async function countCompletedPaymentsForReservation(
  reservationId: string,
  adapter: QueryAdapter = prisma,
): Promise<number> {
  return adapter.payment.count({
    where: {
      reservationId,
      status: "COMPLETED",
      deletedAt: null,
    },
  });
}
