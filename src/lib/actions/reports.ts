"use server";

import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/actions/auth";
import { startOfMonth, endOfMonth, subMonths, format, startOfYear, endOfYear } from "date-fns";

export interface RevenueReport {
  month: string;
  totalRevenue: number;
  reservationCount: number;
}

export interface OccupancyReport {
  propertyId: string;
  propertyName: string;
  totalReservations: number;
  totalNights: number;
  totalRevenue: number;
}

export interface DashboardStats {
  totalProperties: number;
  totalClients: number;
  activeReservations: number;
  monthlyRevenue: number;
  pendingPayments: number;
}

export async function getDashboardStats() {
  const session = await getSession();
  if (!session) return null;

  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const [properties, clients, activeReservations, monthlyPayments, pendingPayments] = await Promise.all([
    prisma.property.count({ where: { userId: session.userId } }),
    prisma.reservationClient.count({ where: { userId: session.userId } }),
    prisma.reservation.count({
      where: {
        userId: session.userId,
        status: { in: ["PENDING", "CONFIRMED"] },
        endDate: { gte: now },
      },
    }),
    prisma.payment.aggregate({
      where: {
        reservation: { userId: session.userId },
        status: "COMPLETED",
        createdAt: { gte: monthStart, lte: monthEnd },
      },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: {
        reservation: { userId: session.userId },
        status: "PENDING",
      },
      _sum: { amount: true },
    }),
  ]);

  return {
    totalProperties: properties,
    totalClients: clients,
    activeReservations,
    monthlyRevenue: Number(monthlyPayments._sum.amount) || 0,
    pendingPayments: Number(pendingPayments._sum.amount) || 0,
  };
}

export async function getRevenueReport(options?: {
  months?: number;
  year?: number;
}) {
  const session = await getSession();
  if (!session) return [];

  const months = options?.months || 12;
  const year = options?.year || new Date().getFullYear();

  const reports: RevenueReport[] = [];

  for (let i = 0; i < months; i++) {
    const targetDate = subMonths(new Date(year, 0, 1), -i);
    const monthStart = startOfMonth(targetDate);
    const monthEnd = endOfMonth(targetDate);

    const result = await prisma.payment.aggregate({
      where: {
        reservation: { userId: session.userId },
        status: "COMPLETED",
        createdAt: { gte: monthStart, lte: monthEnd },
      },
      _sum: { amount: true },
      _count: { id: true },
    });

    reports.push({
      month: format(targetDate, "MMM yyyy"),
      totalRevenue: Number(result._sum.amount) || 0,
      reservationCount: result._count.id || 0,
    });
  }

  return reports.reverse();
}

export async function getOccupancyReport(options?: {
  propertyId?: string;
  startDate?: Date;
  endDate?: Date;
}) {
  const session = await getSession();
  if (!session) return [];

  const where: any = {
    userId: session.userId,
    status: { not: "CANCELLED" },
  };

  if (options?.propertyId) {
    where.propertyId = options.propertyId;
  }

  if (options?.startDate) {
    where.startDate = { gte: options.startDate };
  }

  if (options?.endDate) {
    where.endDate = { lte: options.endDate };
  }

  const reservations = await prisma.reservation.findMany({
    where,
    select: {
      id: true,
      propertyId: true,
      startDate: true,
      endDate: true,
      totalPrice: true,
      status: true,
      property: {
        select: { name: true },
      },
    },
    orderBy: { startDate: "asc" },
  });

  const propertyMap = new Map<string, {
    propertyId: string;
    propertyName: string;
    totalReservations: number;
    totalNights: number;
    totalRevenue: number;
  }>();

  reservations.forEach((res) => {
    const nights = Math.ceil(
      (new Date(res.endDate).getTime() - new Date(res.startDate).getTime()) / (1000 * 60 * 60 * 24)
    );

    if (!propertyMap.has(res.propertyId)) {
      propertyMap.set(res.propertyId, {
        propertyId: res.propertyId,
        propertyName: res.property.name,
        totalReservations: 0,
        totalNights: 0,
        totalRevenue: 0,
      });
    }

    const entry = propertyMap.get(res.propertyId)!;
    entry.totalReservations += 1;
    entry.totalNights += nights;
    entry.totalRevenue += Number(res.totalPrice);
  });

  return Array.from(propertyMap.values());
}

export async function getYearlySummary(year?: number) {
  const session = await getSession();
  if (!session) return null;

  const targetYear = year || new Date().getFullYear();
  const yearStart = startOfYear(new Date(targetYear, 0, 1));
  const yearEnd = endOfYear(new Date(targetYear, 11, 31));

  const payments = await prisma.payment.findMany({
    where: {
      reservation: { userId: session.userId },
      status: "COMPLETED",
      createdAt: { gte: yearStart, lte: yearEnd },
    },
    select: {
      amount: true,
      method: true,
      createdAt: true,
    },
  });

  const totalRevenue = payments.reduce((sum, p) => sum + Number(p.amount), 0);

  const byMonth: number[] = Array(12).fill(0);
  payments.forEach((p) => {
    const month = new Date(p.createdAt).getMonth();
    byMonth[month] += Number(p.amount);
  });

  const byMethod: Record<string, number> = {};
  payments.forEach((p) => {
    byMethod[p.method] = (byMethod[p.method] || 0) + Number(p.amount);
  });

  return {
    year: targetYear,
    totalRevenue,
    totalPayments: payments.length,
    byMonth,
    byMethod,
  };
}