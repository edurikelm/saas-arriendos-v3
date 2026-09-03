"use server";

import { prisma } from "@/lib/db/prisma";
import { getSuperAdminSession } from "@/lib/auth/session";
import { isOverdueDateOnly, nowKeyInBusinessTz } from "@/lib/domain/timezone";
import { Plan, UserStatus } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { resolveEffectivePlan } from "@/lib/subscriptions/effective-plan";

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
  if (!(await getSuperAdminSession())) return null;

  const owner = await prisma.userProfile.findUnique({
    where: { id: ownerId, role: "OWNER" },
    select: {
      id: true,
      name: true,
      email: true,
      plan: true,
      planOverride: true,
      subscription: { select: { status: true, currentPeriodEnd: true, mpPreapprovalId: true } },
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

  // "Hoy" en wall-time America/Santiago (ADR-0020). Usado para detectar
  // pagos vencidos: comparar `payment.dueDate < now` directo es frágil cuando
  // el servidor corre en UTC (Vercel). `dueDate` es date-only: `isOverdueDateOnly`
  // lee su día calendario directo (sin reinterpretar en zona) y lo compara
  // contra `nowKey`.
  const nowKey = nowKeyInBusinessTz();

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

  const overduePayments = pendingPayments.filter((p) =>
    isOverdueDateOnly(p.dueDate, nowKey)
  );
  const overdueAmount = overduePayments.reduce((sum, p) => sum + Number(p.amount), 0);

  const totalRevenue = payments
    .filter((p) => p.status === "COMPLETED")
    .reduce((sum, p) => sum + Number(p.amount), 0);

  // Plan EFECTIVO, no la columna: el admin necesita ver el limite que el owner
  // choca de verdad. La columna `plan` sigue expuesta aparte como registro.
  const effectivePlan = resolveEffectivePlan(owner.planOverride, owner.subscription);
  const propertiesLimit = effectivePlan === "FREE" ? 3 : -1;
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
      isOverdue: p.status === "PENDING" && isOverdueDateOnly(p.dueDate, nowKey),
    })),
  };
}