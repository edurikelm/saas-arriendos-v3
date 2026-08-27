"use server";

import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import {
  buildDashboardSummary,
  type DashboardReservationInput,
  type DashboardSummary,
} from "@/lib/dashboard/summary";

/**
 * Seam server-side de `/dashboard`. Capa delgada: 2 queries Prisma + delega
 * TODO el cómputo a `buildDashboardSummary` (módulo puro, sin aritmética
 * financiera aquí).
 *
 * Retorna `null` sin sesión, mismo patrón que `getDecisionSummary`.
 */
export async function getDashboardSummary(options?: {
  now?: Date;
  upcomingLimit?: number;
  collectionLimit?: number;
}): Promise<DashboardSummary | null> {
  const session = await getSession();
  if (!session) return null;

  const [properties, reservations] = await Promise.all([
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
        createdAt: true,
        property: { select: { id: true, name: true, color: true } },
        client: { select: { id: true, name: true, phone: true } },
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
          },
        },
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
    createdAt: r.createdAt,
    property: {
      id: r.property.id,
      name: r.property.name,
      color: r.property.color,
    },
    client: {
      id: r.client.id,
      name: r.client.name,
      phone: r.client.phone,
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
    })),
  }));

  return buildDashboardSummary({
    properties: properties.map((p) => ({
      id: p.id,
      name: p.name,
      unitsAvailable: p.unitsAvailable,
    })),
    reservations: dashboardReservations,
    now: options?.now ?? new Date(),
    upcomingLimit: options?.upcomingLimit,
    collectionLimit: options?.collectionLimit,
  });
}
