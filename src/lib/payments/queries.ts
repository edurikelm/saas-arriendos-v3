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
// Tipo inferido (sin anotación explícita) — Prisma devuelve el tipo correcto
// con relations gracias a `include`.
export function getPaymentById(
  paymentId: string,
  options: { includeClient?: boolean; includeProperty?: boolean } = {},
  adapter: QueryAdapter = prisma,
) {
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
 * Busca un Payment por `mercadoPagoId` (preference_id) con reservation
 * preload. Excluye soft-deleted. Usado en el webhook de MP cuando no hay
 * paymentId hint.
 *
 * Por defecto NO incluye `client` (los callers del webhook solo necesitan
 * `reservation.userId`). Pasa `includeClient: true` si necesitas client.
 */
export function getPaymentByMercadoPagoId(
  mercadoPagoId: string,
  options: { includeClient?: boolean } = {},
  adapter: QueryAdapter = prisma,
) {
  const { includeClient = false } = options;
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
 *
 * @param options.orderBy opcional — ej: `{ createdAt: 'desc' }`.
 */
export async function getAllPaymentsForReservation(
  reservationId: string,
  options: { orderBy?: Prisma.PaymentOrderByWithRelationInput } = {},
  adapter: QueryAdapter = prisma,
): Promise<Payment[]> {
  return adapter.payment.findMany({
    where: { reservationId, deletedAt: null },
    ...(options.orderBy ? { orderBy: options.orderBy } : {}),
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

export type MpMetadata = {
  mpPaymentId?: string;
  mpStatusDetail?: string;
  mpPaymentMethodId?: string;
  mpPaymentType?: string;
  mpCardLastFour?: string;
  mpInstallments?: number;
  mpTransactionAmount?: number;
  mpNetReceivedAmount?: number;
  mpFeeAmount?: number;
  mpDateCreated?: string;
};

/**
 * Marca un payment como COMPLETED.
 *
 * Acepta campos opcionales: `paidAt` (default: now), `mercadoPagoId`,
 * `receiptUrl`. El caller es responsable de pasar los campos relevantes
 * según el método (MP webhook vs manual).
 *
 * Idempotencia (ADR-0026):
 * - Si el pago ya es COMPLETED con metadata MP poblada → no pisa nada.
 * - Si el pago ya es COMPLETED pero sin metadata MP → pobla solo campos MP nuevos.
 * - Si está en estado no-terminal → actualiza normalmente.
 */
export async function markPaymentCompleted(
  paymentId: string,
  data: {
    paidAt?: Date;
    mercadoPagoId?: string;
    receiptUrl?: string;
    mpMetadata?: MpMetadata;
  } = {},
  adapter: QueryAdapter = prisma,
): Promise<Payment> {
  const { paidAt, mercadoPagoId, receiptUrl, mpMetadata } = data;

  // Si ya está COMPLETED, verificar idempotencia de metadata
  const current = await adapter.payment.findFirst({
    where: { id: paymentId, deletedAt: null },
    select: { status: true, mpPaymentId: true, mpStatusDetail: true },
  });

  if (current?.status === "COMPLETED") {
    // Ya completo: verificar si hay metadata MP que ya existe
    const hasMpMetadata = Boolean(current.mpPaymentId || current.mpStatusDetail);

    if (hasMpMetadata) {
      // Idempotencia: no pisar nada si ya tiene metadata de MP
      const existing = await adapter.payment.findFirst({ where: { id: paymentId } });
      return existing!;
    }

    // COMPLETED pero sin metadata MP → poblar solo campos MP
    if (mpMetadata) {
      const mpData: Record<string, unknown> = {};
      if (mpMetadata.mpPaymentId) mpData.mpPaymentId = mpMetadata.mpPaymentId;
      if (mpMetadata.mpStatusDetail) mpData.mpStatusDetail = mpMetadata.mpStatusDetail;
      if (mpMetadata.mpPaymentMethodId) mpData.mpPaymentMethodId = mpMetadata.mpPaymentMethodId;
      if (mpMetadata.mpPaymentType) mpData.mpPaymentType = mpMetadata.mpPaymentType;
      if (mpMetadata.mpCardLastFour) mpData.mpCardLastFour = mpMetadata.mpCardLastFour;
      if (mpMetadata.mpInstallments != null) mpData.mpInstallments = mpMetadata.mpInstallments;
      if (mpMetadata.mpTransactionAmount != null) mpData.mpTransactionAmount = mpMetadata.mpTransactionAmount;
      if (mpMetadata.mpNetReceivedAmount != null) mpData.mpNetReceivedAmount = mpMetadata.mpNetReceivedAmount;
      if (mpMetadata.mpFeeAmount != null) mpData.mpFeeAmount = mpMetadata.mpFeeAmount;
      if (mpMetadata.mpDateCreated) mpData.mpDateCreated = new Date(mpMetadata.mpDateCreated);

      return adapter.payment.update({
        where: { id: paymentId },
        data: mpData,
      });
    }

    // Ya completo sin metadata nueva → no hacer nada extra
    const existing = await adapter.payment.findFirst({ where: { id: paymentId } });
    return existing!;
  }

  // Estado no-terminal → update normal
  const updateData: Record<string, unknown> = {
    status: "COMPLETED",
    paidAt: paidAt ?? new Date(),
  };
  if (mercadoPagoId) updateData.mercadoPagoId = mercadoPagoId;
  if (receiptUrl) updateData.receiptUrl = receiptUrl;

  if (mpMetadata) {
    if (mpMetadata.mpPaymentId) updateData.mpPaymentId = mpMetadata.mpPaymentId;
    if (mpMetadata.mpStatusDetail) updateData.mpStatusDetail = mpMetadata.mpStatusDetail;
    if (mpMetadata.mpPaymentMethodId) updateData.mpPaymentMethodId = mpMetadata.mpPaymentMethodId;
    if (mpMetadata.mpPaymentType) updateData.mpPaymentType = mpMetadata.mpPaymentType;
    if (mpMetadata.mpCardLastFour) updateData.mpCardLastFour = mpMetadata.mpCardLastFour;
    if (mpMetadata.mpInstallments != null) updateData.mpInstallments = mpMetadata.mpInstallments;
    if (mpMetadata.mpTransactionAmount != null) updateData.mpTransactionAmount = mpMetadata.mpTransactionAmount;
    if (mpMetadata.mpNetReceivedAmount != null) updateData.mpNetReceivedAmount = mpMetadata.mpNetReceivedAmount;
    if (mpMetadata.mpFeeAmount != null) updateData.mpFeeAmount = mpMetadata.mpFeeAmount;
    if (mpMetadata.mpDateCreated) updateData.mpDateCreated = new Date(mpMetadata.mpDateCreated);
  }

  return adapter.payment.update({
    where: { id: paymentId },
    data: updateData,
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
 * Usado por:
 * - `deleteReservation` para bloquear borrado si hay ≥1 pago
 *   completado (preservación de auditoría financiera).
 * - `canTransition` (state machine) cuando la transición es a COMPLETED,
 *   para verificar que los pagos del arriendo están liquidados. En este
 *   caso se pasa `paymentType: "RESERVATION"` para excluir EXTRAs.
 *
 * Por defecto cuenta TODOS los pagos completados (RESERVATION + EXTRA).
 * Si pasas `paymentType`, filtra por ese tipo.
 */
export async function countCompletedPaymentsForReservation(
  reservationId: string,
  options: { paymentType?: "RESERVATION" | "EXTRA" } = {},
  adapter: QueryAdapter = prisma,
): Promise<number> {
  return adapter.payment.count({
    where: {
      reservationId,
      status: "COMPLETED",
      ...(options.paymentType ? { paymentType: options.paymentType } : {}),
      deletedAt: null,
    },
  });
}
