"use server";

import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";
import { getSession } from "@/lib/actions/auth";
import { startOfMonth, endOfMonth, subMonths, format, startOfYear, endOfYear } from "date-fns";
import {
  buildCollectionReportRows,
  type CollectionDebtStatusFilter,
  type CollectionBillingFilter,
  type CollectionReportRow,
} from "@/lib/actions/reports-collection";
import type { PaginatedResponse } from "@/types/pagination";

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

export interface ReservationReport {
  id: string;
  propertyName: string;
  clientName: string;
  clientEmail: string;
  startDate: Date;
  endDate: Date;
  totalPrice: number;
  status: string;
  paymentStatus: string;
  createdAt: Date;
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
  startDate?: Date;
  endDate?: Date;
}) {
  const session = await getSession();
  if (!session) return [];

  const { startDate, endDate } = options || {};

  if (startDate && endDate) {
    const payments = await prisma.payment.findMany({
      where: {
        reservation: { userId: session.userId },
        status: "COMPLETED",
        createdAt: { gte: startDate, lte: endDate },
      },
      select: {
        createdAt: true,
        amount: true,
        reservation: {
          select: { id: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const byMonth: Record<string, { totalRevenue: number; count: number }> = {};
    payments.forEach((p) => {
      const key = format(p.createdAt, "MMM yyyy");
      if (!byMonth[key]) byMonth[key] = { totalRevenue: 0, count: 0 };
      byMonth[key].totalRevenue += Number(p.amount);
      byMonth[key].count += 1;
    });

    return Object.entries(byMonth).map(([month, data]) => ({
      month,
      totalRevenue: data.totalRevenue,
      reservationCount: data.count,
    }));
  }

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

  const where: Prisma.ReservationWhereInput = {
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
    ) + 1;

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

export async function getReservationsReport(options?: {
  propertyId?: string;
  status?: string;
  startDate?: Date;
  endDate?: Date;
}) {
  const session = await getSession();
  if (!session) return [];

  const where: Prisma.ReservationWhereInput = {
    userId: session.userId,
  };

  if (options?.propertyId) {
    where.propertyId = options.propertyId;
  }

  if (options?.status && (options.status === "PENDING" || options.status === "CONFIRMED" || options.status === "CANCELLED" || options.status === "COMPLETED")) {
    where.status = options.status;
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
      totalPrice: true,
      status: true,
      startDate: true,
      endDate: true,
      createdAt: true,
      property: { select: { name: true } },
      client: { select: { name: true, email: true } },
      payments: {
        select: { status: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return reservations.map((r) => {
    const paymentStatus = r.payments.some((p) => p.status === "COMPLETED")
      ? "COMPLETED"
      : r.payments.some((p) => p.status === "PENDING")
      ? "PENDING"
      : "NONE";

    return {
      id: r.id,
      propertyName: r.property.name,
      clientName: r.client.name,
      clientEmail: r.client.email,
      startDate: r.startDate,
      endDate: r.endDate,
      totalPrice: Number(r.totalPrice),
      status: r.status,
      paymentStatus,
      createdAt: r.createdAt,
    };
  });
}

export interface CollectionReportFilters {
  billingType?: CollectionBillingFilter;
  propertyId?: string;
  clientId?: string;
  dueDateFrom?: Date;
  dueDateTo?: Date;
  debtStatus?: CollectionDebtStatusFilter;
  page?: number;
  limit?: number;
}

export async function getCollectionReport(filters?: CollectionReportFilters): Promise<PaginatedResponse<CollectionReportRow> | []> {
  const session = await getSession();
  if (!session) return [];

  const reservations = await prisma.reservation.findMany({
    where: {
      userId: session.userId,
      ...(filters?.propertyId ? { propertyId: filters.propertyId } : {}),
      ...(filters?.clientId ? { clientId: filters.clientId } : {}),
      status: { not: "CANCELLED" },
      ...(filters?.billingType && filters.billingType !== "GENERAL"
        ? { billingType: filters.billingType }
        : {}),
    },
    select: {
      id: true,
      propertyId: true,
      clientId: true,
      billingType: true,
      status: true,
      startDate: true,
      totalPrice: true,
      property: {
        select: {
          name: true,
        },
      },
      client: {
        select: {
          name: true,
        },
      },
      payments: {
        where: {
          deletedAt: null,
        },
        select: {
          amount: true,
          status: true,
          paymentType: true,
          dueDate: true,
          deletedAt: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const rows = buildCollectionReportRows(
    reservations.map((reservation) => ({
      id: reservation.id,
      propertyId: reservation.propertyId,
      propertyName: reservation.property.name,
      clientId: reservation.clientId,
      clientName: reservation.client.name,
      billingType: reservation.billingType,
      status: reservation.status,
      startDate: reservation.startDate,
      totalPrice: Number(reservation.totalPrice),
      payments: reservation.payments.map((payment) => ({
        amount: Number(payment.amount),
        status: payment.status,
        paymentType: payment.paymentType,
        dueDate: payment.dueDate,
        deletedAt: payment.deletedAt,
      })),
    })),
    filters
  );

  const page = filters?.page || 1;
  const limit = filters?.limit || 10;
  const total = rows.length;
  const totalPages = Math.ceil(total / limit);
  const skip = (page - 1) * limit;
  const data = rows.slice(skip, skip + limit);

  return { data, total, page, totalPages };
}
