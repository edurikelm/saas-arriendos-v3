"use server";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/actions/auth";
import { superAdminSchema, updateUserPlanSchema, createOwnerSchema } from "@/lib/validations/super-admin";
import { hash } from "bcryptjs";
import { revalidatePath } from "next/cache";

export async function requireSuperAdmin(): Promise<NextResponse | null> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const user = await prisma.userProfile.findUnique({
    where: { id: session.userId },
  });

  if (user?.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  return null;
}

async function isSuperAdmin(): Promise<boolean> {
  const session = await getSession();
  if (!session) return false;

  const user = await prisma.userProfile.findUnique({
    where: { id: session.userId },
  });

  return user?.role === "SUPER_ADMIN";
}

export async function getAllUsers(options?: {
  search?: string;
  plan?: string;
  page?: number;
  limit?: number;
}) {
  if (!(await isSuperAdmin())) return { users: [], total: 0 };

  const page = options?.page || 1;
  const limit = options?.limit || 20;
  const skip = (page - 1) * limit;

  const where: any = { role: "OWNER" };

  if (options?.search) {
    where.OR = [
      { email: { contains: options.search, mode: "insensitive" } },
      { name: { contains: options.search, mode: "insensitive" } },
    ];
  }

  if (options?.plan) {
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

  return { users, total, page, totalPages: Math.ceil(total / limit) };
}

export async function getUserStats(userId: string) {
  if (!(await isSuperAdmin())) return null;

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
  if (!(await isSuperAdmin())) return { error: "No autorizado" };

  const validated = updateUserPlanSchema.parse(data);

  const user = await prisma.userProfile.update({
    where: { id: validated.userId },
    data: { plan: validated.plan },
  });

  revalidatePath("/admin/users");

  return { success: true, user };
}

export async function deleteUser(userId: string) {
  if (!(await isSuperAdmin())) return { error: "No autorizado" };

  if (userId === (await getSession())?.userId) {
    return { error: "No puedes eliminarte a ti mismo" };
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
  const authError = await requireSuperAdmin();
  if (authError) return null;

  const session = await getSession();

  const [
    totalUsers,
    totalProperties,
    totalReservations,
    totalPayments,
  ] = await Promise.all([
    prisma.userProfile.count(),
    prisma.property.count(),
    prisma.reservation.count(),
    prisma.payment.aggregate({
      where: { status: "COMPLETED" },
      _sum: { amount: true },
    }),
  ]);

  return {
    totalUsers,
    totalProperties,
    totalReservations,
    totalRevenue: Number(totalPayments._sum.amount) || 0,
  };
}

export async function getDashboardStats() {
  const authError = await requireSuperAdmin();
  if (authError) return null;

  const now = new Date();
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

  const [
    totalOwners,
    totalProperties,
    totalReservations,
    completedPayments,
    ownersThisMonth,
    ownersLastMonth,
    totalOwnersCount,
    ownersWithPro,
  ] = await Promise.all([
    prisma.userProfile.count({ where: { role: "OWNER" } }),
    prisma.property.count(),
    prisma.reservation.count(),
    prisma.payment.aggregate({
      where: { status: "COMPLETED" },
      _sum: { amount: true },
    }),
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
    totalRevenue: Number(completedPayments._sum.amount) || 0,
    growthPercentage,
    ownersThisMonth,
    ownersLastMonth,
    conversionPercentage,
  };
}

export async function createOwner(data: {
  email: string;
  password: string;
  name: string;
  plan?: "FREE" | "PRO";
}) {
  if (!(await isSuperAdmin())) return { error: "No autorizado" };

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

export async function getRecentOwners(limit: number = 5) {
  if (!(await isSuperAdmin())) return [];

  const owners = await prisma.userProfile.findMany({
    where: { role: "OWNER" },
    select: {
      id: true,
      email: true,
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