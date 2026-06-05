"use server";

import { prisma } from "@/lib/db/prisma";
import { isSuperAdmin } from "@/lib/actions/super-admin";
import { Plan, UserStatus } from "@prisma/client";
import { Prisma } from "@prisma/client";

export interface OwnerProfile {
  id: string;
  name: string | null;
  email: string;
  plan: Plan | null;
  status: UserStatus;
  role: string;
  createdAt: Date;
  _count: {
    properties: number;
    clients: number;
    reservations: number;
  };
}

export interface OwnerStats {
  properties: number;
  clients: number;
  reservations: number;
  totalRevenue: number;
  paidAmount: number;
  pendingAmount: number;
  overdueAmount: number;
  propertiesLimit: number;
  hasMpIntegration: boolean;
  isMpConnected: boolean;
}

export interface OwnerProperty {
  id: string;
  name: string;
  unitsAvailable: number;
  dailyPrice: Prisma.Decimal;
  color: string;
  _count: {
    reservations: number;
  };
}

export interface OwnerReservation {
  id: string;
  status: string;
  totalPrice: Prisma.Decimal;
  paidAmount: number;
  startDate: Date;
  endDate: Date;
  property: { name: string };
  client: { name: string };
}

export interface OwnerPayment {
  id: string;
  amount: Prisma.Decimal;
  status: string;
  method: string;
  dueDate: Date | null;
  paidAt: Date | null;
  isOverdue?: boolean;
}

export interface OwnerDetailResult {
  owner: OwnerProfile;
  stats: OwnerStats;
  properties: OwnerProperty[];
  reservations: OwnerReservation[];
  payments: OwnerPayment[];
}

export async function getOwnerDetail(ownerId: string): Promise<OwnerDetailResult | null> {
  if (!(await isSuperAdmin())) return null;

  const owner = await prisma.userProfile.findUnique({
    where: { id: ownerId, role: "OWNER" },
    select: {
      id: true,
      name: true,
      email: true,
      plan: true,
      status: true,
      role: true,
      createdAt: true,
      _count: {
        select: {
          properties: true,
          clients: true,
          reservations: true,
        },
      },
    },
  });

  if (!owner) return null;

  const now = new Date();

  const [payments, mpIntegration, properties, reservations] = await Promise.all([
    prisma.payment.findMany({
      where: { reservation: { userId: ownerId } },
      select: {
        id: true,
        amount: true,
        status: true,
        method: true,
        dueDate: true,
        paidAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.userIntegration.findUnique({
      where: { userId_provider: { userId: ownerId, provider: "MERCADO_PAGO" } },
      select: { isActive: true },
    }),
    prisma.property.findMany({
      where: { userId: ownerId },
      select: {
        id: true,
        name: true,
        unitsAvailable: true,
        dailyPrice: true,
        color: true,
        _count: { select: { reservations: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.reservation.findMany({
      where: { userId: ownerId },
      select: {
        id: true,
        status: true,
        totalPrice: true,
        startDate: true,
        endDate: true,
        property: { select: { name: true } },
        client: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  const paidAmount = payments
    .filter((p) => p.status === "COMPLETED" && p.paidAt)
    .reduce((sum, p) => sum + Number(p.amount), 0);

  const pendingPayments = payments.filter((p) => p.status === "PENDING");
  const pendingAmount = pendingPayments.reduce((sum, p) => sum + Number(p.amount), 0);

  const overduePayments = pendingPayments.filter((p) => p.dueDate && p.dueDate < now);
  const overdueAmount = overduePayments.reduce((sum, p) => sum + Number(p.amount), 0);

  const totalRevenue = payments
    .filter((p) => p.status === "COMPLETED")
    .reduce((sum, p) => sum + Number(p.amount), 0);

  const propertiesLimit = owner.plan === "FREE" ? 3 : -1;
  const hasMpIntegration = !!mpIntegration;
  const isMpConnected = mpIntegration?.isActive ?? false;

  const reservationsWithPaid = reservations.map((r) => {
    const paid = payments
      .filter((p) => p.status === "COMPLETED" && p.paidAt)
      .reduce((sum, p) => sum + Number(p.amount), 0);
    return { ...r, paidAmount: paid };
  });

  return {
    owner,
    stats: {
      properties: owner._count.properties,
      clients: owner._count.clients,
      reservations: owner._count.reservations,
      totalRevenue,
      paidAmount,
      pendingAmount,
      overdueAmount,
      propertiesLimit,
      hasMpIntegration,
      isMpConnected,
    },
    properties,
    reservations: reservationsWithPaid,
    payments: payments.map((p) => ({
      ...p,
      isOverdue: p.status === "PENDING" && p.dueDate !== null && p.dueDate < now,
    })),
  };
}