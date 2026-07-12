"use server";

import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";
import { getSession, getSuperAdminSession } from "@/lib/auth/session";
import { updateUserPlanSchema, createOwnerSchema } from "@/lib/validations/super-admin";
import { hash } from "bcryptjs";
import { revalidatePath } from "next/cache";
import { sumCompletedPaymentsAll } from "@/lib/payments/queries";

export async function getAllUsers(options?: {
  search?: string;
  plan?: string;
  page?: number;
  limit?: number;
  noProperties?: boolean;
  noReservations?: boolean;
  mpDisconnected?: boolean;
  pendingPayments?: boolean;
  overduePayments?: boolean;
  createdFrom?: string;
  createdTo?: string;
}) {
  if (!(await getSuperAdminSession())) return { users: [], total: 0 };

  const page = options?.page || 1;
  const limit = options?.limit || 20;
  const skip = (page - 1) * limit;

  const where: Prisma.UserProfileWhereInput = { role: "OWNER" };

  if (options?.search) {
    where.OR = [
      { email: { contains: options.search, mode: "insensitive" } },
      { name: { contains: options.search, mode: "insensitive" } },
    ];
  }

  if (options?.plan && (options.plan === "FREE" || options.plan === "PRO")) {
    where.plan = options.plan;
  }

  const [users, total] = await Promise.all([
    prisma.userProfile.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        plan: true,
        role: true,
        status: true,
        createdAt: true,
        _count: {
          select: {
            properties: true,
            clients: true,
            reservations: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.userProfile.count({ where }),
  ]);

  if (users.length === 0) {
    return { users, total, page, totalPages: Math.ceil(total / limit) };
  }

  const userIds = users.map((u) => u.id);
  const now = new Date();

  // Batched health lookups: 2 queries instead of 2N (was: 2 queries × N users
  // inside Promise.all). MP integrations come from `UserIntegration`; overdue
  // detection joins Payment via the Reservation relation (`Payment.userId` does
  // not exist — Payment belongs to a Reservation).
  const [mpIntegrations, overdueOwners] = await Promise.all([
    prisma.userIntegration.findMany({
      where: {
        userId: { in: userIds },
        provider: "MERCADO_PAGO",
      },
      select: { userId: true, isActive: true },
    }),
    prisma.reservation.findMany({
      where: {
        userId: { in: userIds },
        payments: {
          some: {
            status: "PENDING",
            dueDate: { lt: now },
            deletedAt: null,
          },
        },
      },
      select: { userId: true },
      distinct: ["userId"],
    }),
  ]);

  const mpActiveUserIds = new Set(
    mpIntegrations.filter((i) => i.isActive).map((i) => i.userId),
  );
  const overdueUserIds = new Set(overdueOwners.map((r) => r.userId));

  const usersWithHealth = users.map((user) => ({
    ...user,
    status: user.status as string,
    isMpConnected: mpActiveUserIds.has(user.id),
    hasOverduePayments: overdueUserIds.has(user.id),
  }));

  return { users: usersWithHealth, total, page, totalPages: Math.ceil(total / limit) };
}

export async function getUserStats(userId: string) {
  if (!(await getSuperAdminSession())) return null;

  const [properties, clients, reservations, payments] = await Promise.all([
    prisma.property.count({ where: { userId } }),
    prisma.reservationClient.count({ where: { userId } }),
    prisma.reservation.count({ where: { userId } }),
    prisma.payment.findMany({
      where: {
        reservation: { userId },
        status: "COMPLETED",
      },
      select: { amount: true },
    }),
  ]);

  const totalRevenue = payments.reduce((sum, p) => sum + Number(p.amount), 0);

  return {
    properties,
    clients,
    reservations,
    totalRevenue,
  };
}

export async function updateUserPlan(data: { userId: string; plan: "FREE" | "PRO" }) {
  if (!(await getSuperAdminSession())) return { error: "No autorizado" };

  const validated = updateUserPlanSchema.parse(data);

  const user = await prisma.userProfile.update({
    where: { id: validated.userId },
    data: { plan: validated.plan },
  });

  revalidatePath("/admin/users");

  return { success: true, user };
}

export async function updateUserStatus(data: { userId: string; status: "ACTIVE" | "SUSPENDED" | "CANCELLED" }) {
  const session = await getSuperAdminSession();
  if (!session) return { error: "No autorizado" };

  const user = await prisma.userProfile.update({
    where: { id: data.userId },
    data: { status: data.status },
  });

  await prisma.adminActionLog.create({
    data: {
      adminId: session.userId,
      targetId: data.userId,
      action: "STATUS_CHANGED",
      details: JSON.stringify({ status: data.status }),
    },
  });

  revalidatePath("/admin/users");

  return { success: true, user };
}

export async function deleteUser(userId: string, confirmEmail?: string) {
  if (!(await getSuperAdminSession())) return { error: "No autorizado" };

  if (userId === (await getSession())?.userId) {
    return { error: "No puedes eliminarte a ti mismo" };
  }

  if (confirmEmail) {
    const userToDelete = await prisma.userProfile.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (userToDelete?.email !== confirmEmail) {
      return { error: "Email de confirmación incorrecto" };
    }
  } else {
    return { error: "Se requiere confirmación por email para eliminar" };
  }

  await prisma.$transaction([
    prisma.payment.deleteMany({
      where: { reservation: { userId } },
    }),
    prisma.reservationChange.deleteMany({
      where: { reservation: { userId } },
    }),
    prisma.reservation.deleteMany({
      where: { userId },
    }),
    prisma.reservationClient.deleteMany({
      where: { userId },
    }),
    prisma.property.deleteMany({
      where: { userId },
    }),
    prisma.userProfile.delete({
      where: { id: userId },
    }),
  ]);

  revalidatePath("/admin/users");

  return { success: true };
}

export async function getSystemStats() {
  if (!(await getSuperAdminSession())) return null;

  const [totalUsers, totalProperties, totalReservations, totalRevenue] = await Promise.all([
    prisma.userProfile.count(),
    prisma.property.count(),
    prisma.reservation.count(),
    sumCompletedPaymentsAll(),
  ]);

  return {
    totalUsers,
    totalProperties,
    totalReservations,
    totalRevenue,
  };
}

export async function getDashboardStats() {
  if (!(await getSuperAdminSession())) return null;

  const now = new Date();
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

  const [
    totalOwners,
    totalProperties,
    totalReservations,
    totalRevenue,
    ownersThisMonth,
    ownersLastMonth,
    totalOwnersCount,
    ownersWithPro,
    pendingSupportTickets,
  ] = await Promise.all([
    prisma.userProfile.count({ where: { role: "OWNER" } }),
    prisma.property.count(),
    prisma.reservation.count(),
    sumCompletedPaymentsAll(),
    prisma.userProfile.count({
      where: {
        role: "OWNER",
        createdAt: { gte: startOfThisMonth },
      },
    }),
    prisma.userProfile.count({
      where: {
        role: "OWNER",
        createdAt: { gte: startOfLastMonth, lte: endOfLastMonth },
      },
    }),
    prisma.userProfile.count({ where: { role: "OWNER" } }),
    prisma.userProfile.count({ where: { role: "OWNER", plan: "PRO" } }),
    prisma.supportTicket.count({
      where: { status: { in: ["OPEN", "IN_PROGRESS"] } },
    }),
  ]);

  const growthPercentage =
    ownersLastMonth === 0
      ? ownersThisMonth > 0
        ? 100
        : 0
      : Math.round(((ownersThisMonth - ownersLastMonth) / ownersLastMonth) * 100);

  const conversionPercentage =
    totalOwnersCount === 0
      ? 0
      : Math.round((ownersWithPro / totalOwnersCount) * 100);

  return {
    totalOwners,
    totalProperties,
    totalReservations,
    totalRevenue,
    growthPercentage,
    ownersThisMonth,
    ownersLastMonth,
    conversionPercentage,
    pendingSupportTickets,
  };
}

export async function createOwner(data: {
  email: string;
  password: string;
  name: string;
  plan?: "FREE" | "PRO";
}) {
  if (!(await getSuperAdminSession())) return { error: "No autorizado" };

  const validated = createOwnerSchema.parse(data);

  const existing = await prisma.userProfile.findUnique({
    where: { email: validated.email },
  });

  if (existing) {
    return { error: "El email ya está registrado" };
  }

  const hashedPassword = await hash(validated.password, 12);

  const user = await prisma.userProfile.create({
    data: {
      email: validated.email,
      password: hashedPassword,
      name: validated.name,
      plan: validated.plan,
      role: "OWNER",
    },
  });

  revalidatePath("/admin/users");

  return { success: true, user };
}

export interface AdminUsersKpis {
  total: number;
  pro: number;
  free: number;
  newThisMonth: number;
}

export async function getAdminUsersKpis(): Promise<AdminUsersKpis> {
  if (!(await getSuperAdminSession())) {
    return { total: 0, pro: 0, free: 0, newThisMonth: 0 };
  }

  const now = new Date();
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [total, pro, free, newThisMonth] = await Promise.all([
    prisma.userProfile.count({ where: { role: "OWNER" } }),
    prisma.userProfile.count({ where: { role: "OWNER", plan: "PRO" } }),
    prisma.userProfile.count({ where: { role: "OWNER", plan: "FREE" } }),
    prisma.userProfile.count({
      where: { role: "OWNER", createdAt: { gte: startOfThisMonth } },
    }),
  ]);

  return { total, pro, free, newThisMonth };
}

export async function getRecentOwners(limit: number = 5) {
  if (!(await getSuperAdminSession())) return [];

  const owners = await prisma.userProfile.findMany({
    where: { role: "OWNER" },
    select: {
      id: true,
      name: true,
      email: true,
      companyName: true,
      plan: true,
      createdAt: true,
      _count: {
        select: {
          properties: true,
          reservations: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return owners;
}

export type SystemActivityType =
  | "OWNER_REGISTERED"
  | "SUPPORT_TICKET"
  | "PAYMENT_COMPLETED";

export interface SystemActivityItem {
  id: string;
  type: SystemActivityType;
  title: string;
  description: string;
  createdAt: string;
  priority?: "LOW" | "MEDIUM" | "HIGH";
}

const activityCurrencyFormatter = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  minimumFractionDigits: 0,
});

/**
 * Feed unificado de actividad reciente del sistema para la consola de
 * Super Administrador. Combina registros de propietarios, tickets de soporte
 * y pagos completados, ordenados por fecha descendente.
 */
export async function getSystemActivity(
  limit: number = 6
): Promise<SystemActivityItem[]> {
  if (!(await getSuperAdminSession())) return [];

  const [owners, tickets, payments] = await Promise.all([
    prisma.userProfile.findMany({
      where: { role: "OWNER" },
      select: { id: true, name: true, email: true, companyName: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.supportTicket.findMany({
      select: {
        id: true,
        subject: true,
        priority: true,
        createdAt: true,
        user: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.payment.findMany({
      where: { status: "COMPLETED", paidAt: { not: null }, deletedAt: null },
      select: {
        id: true,
        amount: true,
        paidAt: true,
        reservation: { select: { property: { select: { name: true } } } },
      },
      orderBy: { paidAt: "desc" },
      take: limit,
    }),
  ]);

  const items: SystemActivityItem[] = [];

  for (const owner of owners) {
    items.push({
      id: `owner-${owner.id}`,
      type: "OWNER_REGISTERED",
      title: "Nuevo propietario",
      description: `${owner.companyName || owner.name || owner.email} se unió al sistema.`,
      createdAt: owner.createdAt.toISOString(),
    });
  }

  for (const ticket of tickets) {
    items.push({
      id: `ticket-${ticket.id}`,
      type: "SUPPORT_TICKET",
      title: "Ticket de soporte",
      description: `${ticket.user.name || ticket.user.email}: ${ticket.subject}`,
      createdAt: ticket.createdAt.toISOString(),
      priority: ticket.priority,
    });
  }

  for (const payment of payments) {
    const propertyName = payment.reservation?.property?.name;
    items.push({
      id: `payment-${payment.id}`,
      type: "PAYMENT_COMPLETED",
      title: "Pago recibido",
      description: `${activityCurrencyFormatter.format(Number(payment.amount))} procesado${
        propertyName ? ` · ${propertyName}` : ""
      }.`,
      createdAt: (payment.paidAt as Date).toISOString(),
    });
  }

  return items
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);
}
