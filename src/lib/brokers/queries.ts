/**
 * Queries Prisma de comisiones de captadores.
 *
 * Fuente de verdad: ADR-0040.
 *
 * **La comisión no se guarda: se deriva.** No hay tabla `Commission` ni devengo
 * escrito. Este módulo lee los pagos que ya existen y los multiplica por la tasa
 * congelada en su reserva. Por eso la feature no toca el camino de escritura de
 * pagos: ni el webhook de Mercado Pago, ni `markPaymentCompleted`, ni
 * `confirmReservationIfPaid` (ADR-0040 §3).
 *
 * El predicado de qué pago comisiona vive en el `where` de acá, una sola vez:
 * `COMPLETED` + `RESERVATION` + `deletedAt: null` + `paidAt` presente. Es el
 * mismo conjunto que la caja de `/reports` (`isEligibleCashPayment`), y por eso
 * las cancelaciones no necesitan reversa: cancelar borra los `PENDING` y
 * conserva los `COMPLETED`, así que lo derivado ya es la comisión de lo que
 * efectivamente entró (ADR-0040 §5).
 *
 * El rango de fechas **no se filtra en SQL**. `paidAt` es un instante y entra al
 * período por su día de negocio en Santiago (`isPaidAtInRange`, ADR-0038), igual
 * que la caja: un pago de las 22:30 tiene que caer en el mismo día y el mismo
 * mes que en el resto de `/reports`. El mismo criterio que usa
 * `getDecisionSummary`, que también trae los pagos y filtra en el módulo puro.
 *
 * Dirección de dependencia (ADR-0025): `src/lib/brokers/` puede importar de
 * `src/lib/payments/` y de los módulos puros de reportes; nadie de esos importa
 * de acá.
 */

import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";
import { isPaidAtInRange } from "@/lib/reports/revenue-series";
import { BUSINESS_TIME_ZONE } from "@/lib/domain/timezone";
import {
  buildBrokerCommissions,
  buildReservationCommissions,
  commissionForPayments,
  type BrokerCommissionRow,
  type CommissionPaymentInput,
  type ReservationCommissionRow,
} from "./commission";

export type QueryAdapter = Prisma.TransactionClient | typeof prisma;

export interface CommissionFilters {
  /** Primer día del período, `YYYY-MM-DD`, inclusive. */
  rangeStartKey: string;
  /** Último día del período, `YYYY-MM-DD`, inclusive. */
  rangeEndKey: string;
  /** Si se pasa, limita a una propiedad — igual que el encabezado de `/reports`. */
  propertyId?: string;
  /** Solo para tests; en producción siempre es la zona de negocio. */
  tz?: string;
}

/**
 * Pagos cobrados en el período que devengan comisión, uno por fila, con el
 * captador y la tasa congelada de su reserva.
 *
 * Solo trae pagos de reservas CON captador y CON tasa: una reserva sin captador
 * —el caso de la mayoría— no aparece. Que `commissionRate` sea `null` con
 * `brokerId` presente es imposible por construcción (el formulario escribe los
 * dos juntos); el filtro está igual, porque una fila así devengaría una comisión
 * indefinida en vez de ninguna.
 */
export async function getCommissionPaymentsForOwner(
  userId: string,
  filters: CommissionFilters,
  adapter: QueryAdapter = prisma,
): Promise<CommissionPaymentInput[]> {
  const { rangeStartKey, rangeEndKey, propertyId, tz = BUSINESS_TIME_ZONE } = filters;

  const payments = await adapter.payment.findMany({
    where: {
      status: "COMPLETED",
      paymentType: "RESERVATION",
      deletedAt: null,
      paidAt: { not: null },
      reservation: {
        userId,
        brokerId: { not: null },
        commissionRate: { not: null },
        ...(propertyId ? { propertyId } : {}),
      },
    },
    select: {
      id: true,
      amount: true,
      paidAt: true,
      reservation: {
        select: {
          id: true,
          commissionRate: true,
          broker: { select: { id: true, name: true } },
        },
      },
    },
  });

  const rows: CommissionPaymentInput[] = [];

  for (const p of payments) {
    // `paidAt: { not: null }` ya lo garantiza; el guard es para el tipo.
    if (!p.paidAt) continue;
    if (!isPaidAtInRange(p.paidAt, rangeStartKey, rangeEndKey, tz)) continue;

    const broker = p.reservation.broker;
    const rate = p.reservation.commissionRate;
    if (!broker || rate === null) continue;

    rows.push({
      paymentId: p.id,
      reservationId: p.reservation.id,
      amount: Number(p.amount),
      brokerId: broker.id,
      brokerName: broker.name,
      commissionRate: Number(rate),
    });
  }

  return rows;
}

/**
 * Total devengado por captador en el período. Lo que el bloque de `/reports`
 * muestra como resumen.
 */
export async function getBrokerCommissionsForOwner(
  userId: string,
  filters: CommissionFilters,
  adapter: QueryAdapter = prisma,
): Promise<BrokerCommissionRow[]> {
  const payments = await getCommissionPaymentsForOwner(userId, filters, adapter);
  return buildBrokerCommissions(payments);
}

/**
 * Detalle por reserva de un captador en el período — lo que justifica su total
 * si el captador lo discute.
 */
export async function getReservationCommissionsForBroker(
  userId: string,
  brokerId: string,
  filters: CommissionFilters,
  adapter: QueryAdapter = prisma,
): Promise<ReservationCommissionRow[]> {
  const payments = await getCommissionPaymentsForOwner(userId, filters, adapter);
  return buildReservationCommissions(payments, brokerId);
}

/**
 * Comisión devengada hasta hoy de UNA reserva, sin filtro de período.
 *
 * Para el detalle de la reserva: "este captador lleva devengado X en esta
 * estadía". Histórico completo a propósito — la pregunta del owner acá no es
 * del mes, es de la estadía.
 *
 * Pide `userId` y filtra por él, igual que las server actions de pagos
 * (`findFirst({ where: { id, userId } })`): un id de reserva que llega de un
 * request no puede devolver la comisión de otro owner. Una reserva ajena
 * devuelve 0, igual que una que no existe.
 */
export async function getCommissionForReservation(
  reservationId: string,
  userId: string,
  adapter: QueryAdapter = prisma,
): Promise<number> {
  const reservation = await adapter.reservation.findFirst({
    where: { id: reservationId, userId },
    select: {
      commissionRate: true,
      brokerId: true,
      payments: {
        where: {
          status: "COMPLETED",
          paymentType: "RESERVATION",
          deletedAt: null,
        },
        select: { amount: true },
      },
    },
  });

  if (!reservation?.brokerId || reservation.commissionRate === null) return 0;

  return commissionForPayments(
    reservation.payments.map((p) => ({ amount: Number(p.amount) })),
    Number(reservation.commissionRate),
  );
}
