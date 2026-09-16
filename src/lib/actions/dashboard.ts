"use server";

import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import {
  buildDashboardSummary,
  type DashboardExternalBlockInput,
  type DashboardReservationInput,
  type DashboardSummary,
} from "@/lib/dashboard/summary";

/** Margen para no perder un bloqueo por la hora a la que quedó guardado el `endDate` (ver query abajo). */
const EXTERNAL_BLOCK_LOOKBACK_DAYS = 2;

/**
 * Seam server-side de `/dashboard`. Capa delgada: 3 queries Prisma + delega
 * TODO el cómputo a `buildDashboardSummary` (módulo puro, sin aritmética
 * financiera aquí).
 *
 * Retorna `null` sin sesión, mismo patrón que `getDecisionSummary`.
 */
export async function getDashboardSummary(options?: {
  now?: Date;
  collectionLimit?: number;
}): Promise<DashboardSummary | null> {
  const session = await getSession();
  if (!session) return null;

  const now = options?.now ?? new Date();
  const lookbackFrom = new Date(now.getTime() - EXTERNAL_BLOCK_LOOKBACK_DAYS * 86_400_000);

  const [properties, reservations, externalBlocks] = await Promise.all([
    prisma.property.findMany({
      where: { userId: session.userId },
      select: {
        id: true,
        name: true,
        unitsAvailable: true,
        color: true,
      },
    }),
    prisma.reservation.findMany({
      where: { userId: session.userId },
      select: {
        id: true,
        propertyId: true,
        billingType: true,
        status: true,
        startDate: true,
        endDate: true,
        totalPrice: true,
        unitsBooked: true,
        property: { select: { id: true, name: true, color: true } },
        client: { select: { id: true, name: true, phone: true, email: true } },
        payments: {
          where: { deletedAt: null },
          select: {
            id: true,
            amount: true,
            status: true,
            paymentType: true,
            method: true,
            paidAt: true,
            dueDate: true,
            initPoint: true,
            expiresAt: true,
            // createdAt/installmentIndex/title alimentan `computeNextCharge`
            // (@/lib/dashboard/summary): orden de prioridad, etiqueta de
            // cuota ("Cuota 2 de 3") y título de cobros EXTRA.
            createdAt: true,
            installmentIndex: true,
            title: true,
          },
        },
      },
    }),
    // La tenencia va por `property.userId`: `ExternalChannelBlock` no tiene
    // `userId` propio. El filtro por `endDate` es solo para acotar filas —
    // el corte exacto por día lo hace `buildDashboardSummary` con
    // `dateOnlyKey`; el margen de `EXTERNAL_BLOCK_LOOKBACK_DAYS` evita perder
    // un bloqueo por la hora a la que quedó guardado su `endDate`.
    prisma.externalChannelBlock.findMany({
      where: {
        status: "ACTIVE",
        property: { userId: session.userId },
        endDate: { gte: lookbackFrom },
      },
      select: {
        propertyId: true,
        startDate: true,
        endDate: true,
        externalCalendar: { select: { channel: true } },
      },
    }),
  ]);

  const dashboardReservations: DashboardReservationInput[] = reservations.map((r) => ({
    id: r.id,
    propertyId: r.propertyId,
    billingType: r.billingType,
    status: r.status,
    startDate: r.startDate,
    endDate: r.endDate,
    totalPrice: Number(r.totalPrice),
    unitsBooked: r.unitsBooked,
    property: {
      id: r.property.id,
      name: r.property.name,
      color: r.property.color,
    },
    client: {
      id: r.client.id,
      name: r.client.name,
      phone: r.client.phone,
      email: r.client.email,
    },
    payments: r.payments.map((p) => ({
      id: p.id,
      amount: Number(p.amount),
      status: p.status,
      paymentType: p.paymentType,
      method: p.method,
      paidAt: p.paidAt,
      // deletedAt filtered at query level (`where: { deletedAt: null }`) —
      // the domain payload always carries `null` here since only
      // non-deleted payments are ever selected.
      deletedAt: null,
      dueDate: p.dueDate,
      initPoint: p.initPoint,
      expiresAt: p.expiresAt,
      createdAt: p.createdAt,
      installmentIndex: p.installmentIndex,
      title: p.title,
    })),
  }));

  const dashboardExternalBlocks: DashboardExternalBlockInput[] = externalBlocks.map((b) => ({
    propertyId: b.propertyId,
    startDate: b.startDate,
    endDate: b.endDate,
    channel: b.externalCalendar.channel,
  }));

  return buildDashboardSummary({
    properties: properties.map((p) => ({
      id: p.id,
      name: p.name,
      unitsAvailable: p.unitsAvailable,
      color: p.color,
    })),
    reservations: dashboardReservations,
    externalBlocks: dashboardExternalBlocks,
    now,
    collectionLimit: options?.collectionLimit,
  });
}
