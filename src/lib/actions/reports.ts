"use server";

import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";
import { getSession } from "@/lib/auth/session";
import { startOfMonth, endOfMonth, format, startOfYear, endOfYear } from "date-fns";
import { BUSINESS_TIME_ZONE } from "@/lib/domain/timezone";
import {
  buildCollectionReportRows,
  type CollectionDebtStatusFilter,
  type CollectionBillingFilter,
  type CollectionReportRow,
} from "@/lib/reports/collection";
import { type ReportDecisionSummary } from "@/lib/reports/decision-summary";
import { buildAnnualCollectedCash, type CashPaymentInput } from "@/lib/reports/revenue-series";
import { sumCollectionTotals } from "@/lib/reports/kpis";
import type { PaginatedResponse } from "@/types/pagination";
import {
  sumCompletedPaymentsForOwner,
  sumPendingPaymentsForOwner,
} from "@/lib/payments/queries";

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
  unitsAvailable: number;
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
  billingType: "DAILY" | "MONTHLY";
  createdAt: Date;
}

export async function getDashboardStats(options?: { propertyId?: string }) {
  const session = await getSession();
  if (!session) return null;

  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const { propertyId } = options ?? {};

  const propertyFilter = { userId: session.userId, ...(propertyId ? { id: propertyId } : {}) };

  const [properties, clients, activeReservations, monthlyRevenue, pendingPayments] = await Promise.all([
    prisma.property.count({ where: propertyFilter }),
    prisma.reservationClient.count({ where: { userId: session.userId } }),
    prisma.reservation.count({
      where: {
        userId: session.userId,
        ...(propertyId ? { propertyId } : {}),
        status: { in: ["PENDING", "CONFIRMED"] },
        endDate: { gte: now },
      },
    }),
    sumCompletedPaymentsForOwner(session.userId, { from: monthStart, to: monthEnd, propertyId }),
    sumPendingPaymentsForOwner(session.userId),
  ]);

  return {
    totalProperties: properties,
    totalClients: clients,
    activeReservations,
    monthlyRevenue,
    pendingPayments,
  };
}

/**
 * @deprecated Use getDecisionSummary + decisionSummary.cash.byMonth instead (ADR-0030).
 *             This adapter exists for backward compat only. Not called from UI.
 */
export async function getRevenueReport(options?: {
  months?: number;
  year?: number;
  startDate?: Date;
  endDate?: Date;
  propertyId?: string;
}) {
  const session = await getSession();
  if (!session) return [];

  const { startDate, endDate, propertyId } = options || {};

  if (startDate && endDate) {
    const payments = await prisma.payment.findMany({
      where: {
        reservation: { userId: session.userId, ...(propertyId ? { propertyId } : {}) },
        status: "COMPLETED",
        paymentType: "RESERVATION",
        deletedAt: null,
        paidAt: { gte: startDate, lte: endDate },
      },
      select: {
        paidAt: true,
        amount: true,
        reservation: {
          select: { id: true },
        },
      },
      orderBy: { paidAt: "asc" },
    });

    const byMonth: Record<string, { totalRevenue: number; count: number }> = {};
    payments.forEach((p) => {
      const key = format(p.paidAt!, "MMM yyyy");
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
  const yearStart = startOfYear(new Date(year, 0, 1));
  const yearEnd = endOfYear(new Date(year, 0, 1));

  // H1 perf fix: single query, aggregated by month in JS.
  // Uses paidAt (cash basis) + paymentType: RESERVATION + deletedAt: null.
  const payments = await prisma.payment.findMany({
    where: {
      reservation: { userId: session.userId, ...(propertyId ? { propertyId } : {}) },
      status: "COMPLETED",
      paymentType: "RESERVATION",
      deletedAt: null,
      paidAt: { gte: yearStart, lte: yearEnd },
    },
    select: {
      paidAt: true,
      amount: true,
    },
    orderBy: { paidAt: "asc" },
  });

  const byMonth: Record<string, { totalRevenue: number; count: number }> = {};
  payments.forEach((p) => {
    const key = format(p.paidAt!, "MMM yyyy");
    if (!byMonth[key]) byMonth[key] = { totalRevenue: 0, count: 0 };
    byMonth[key].totalRevenue += Number(p.amount);
    byMonth[key].count += 1;
  });

  // Emit one entry per month (Jan → Dec), filling 0 for months with no payments.
  // Loop bound is `months` to preserve the original behavior of partial-year windows.
  const reports: RevenueReport[] = [];
  for (let i = 0; i < months; i++) {
    const targetDate = new Date(year, i, 1);
    const key = format(targetDate, "MMM yyyy");
    const data = byMonth[key];
    reports.push({
      month: key,
      totalRevenue: data?.totalRevenue ?? 0,
      reservationCount: data?.count ?? 0,
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

  // Intersección: reserva que se solapa con el rango
  // startDate <= rangoEnd AND endDate >= rangoStart
  if (options?.startDate && options?.endDate) {
    where.startDate = { lte: options.endDate };
    where.endDate = { gte: options.startDate };
  }

  const reservations = await prisma.reservation.findMany({
    where,
    select: {
      id: true,
      propertyId: true,
      startDate: true,
      endDate: true,
      unitsBooked: true,
      totalPrice: true,
      status: true,
      property: {
        select: { name: true, unitsAvailable: true },
      },
    },
    orderBy: { startDate: "asc" },
  });

  const { clipNightsToRange } = await import("@/lib/reports/kpis");

  const propertyMap = new Map<string, {
    propertyId: string;
    propertyName: string;
    totalReservations: number;
    totalNightUnits: number;
    totalRevenue: number;
    unitsAvailable: number;
  }>();

  const rangeStart = options?.startDate;
  const rangeEnd = options?.endDate;

  reservations.forEach((res) => {
    // Usar intersección inclusiva con el rango, multiplicar por unitsBooked
    let nightUnits: number;
    if (rangeStart && rangeEnd) {
      nightUnits = clipNightsToRange(res.startDate, res.endDate, rangeStart, rangeEnd) * (res.unitsBooked ?? 1);
    } else {
      nightUnits = (
        Math.ceil(
          (new Date(res.endDate).getTime() - new Date(res.startDate).getTime()) / (1000 * 60 * 60 * 24)
        ) + 1
      ) * (res.unitsBooked ?? 1);
    }

    if (!propertyMap.has(res.propertyId)) {
      propertyMap.set(res.propertyId, {
        propertyId: res.propertyId,
        propertyName: res.property.name,
        totalReservations: 0,
        totalNightUnits: 0,
        totalRevenue: 0,
        unitsAvailable: res.property.unitsAvailable ?? 1,
      });
    }

    const entry = propertyMap.get(res.propertyId)!;
    entry.totalReservations += 1;
    entry.totalNightUnits += nightUnits;
    entry.totalRevenue += Number(res.totalPrice);
  });

  return Array.from(propertyMap.values()).map((entry) => ({
    propertyId: entry.propertyId,
    propertyName: entry.propertyName,
    totalReservations: entry.totalReservations,
    totalNights: entry.totalNightUnits,
    totalRevenue: entry.totalRevenue,
    unitsAvailable: entry.unitsAvailable,
  }));
}

export interface YearlySummaryFilters {
  year?: number;
  /** Filter payments to a specific property (via reservation.propertyId). */
  propertyId?: string;
}

/**
 * Returns annual cash-basis revenue using the buildAnnualCollectedCash seam.
 *
 * Supports two call styles for backward compat:
 *   getYearlySummary(2026)          — legacy (year as positional arg)
 *   getYearlySummary({ year: 2026, propertyId: "prop-1" }) — new filters
 *
 * Predicate: COMPLETED, paymentType RESERVATION, deletedAt null,
 * paidAt in [year-01-01, year-12-31], reservation.userId = session.userId,
 * optionally filtered by reservation.propertyId.
 *
 * Reconciliation: totalCash === sum(byMonth.collectedCash) === sum(byMethod)
 *
 * @see ADR-0030
 */
export async function getYearlySummary(yearOrFilters?: number | YearlySummaryFilters) {
  const session = await getSession();
  if (!session) return null;

  // Support legacy positional year: getYearlySummary(2026)
  const filters: YearlySummaryFilters =
    typeof yearOrFilters === "number" ? { year: yearOrFilters } : (yearOrFilters ?? {});

  const year = filters.year ?? new Date().getFullYear();
  const yearStart = startOfYear(new Date(year, 0, 1));
  const yearEnd = endOfYear(new Date(year, 11, 31, 23, 59, 59, 999));

  // Single read: all COMPLETED RESERVATION payments with paidAt in year.
  // Join to reservation to filter by userId (+ optional propertyId)
  // and to get reservation.status for cancelledPaymentIds.
  const reservationFilter: Prisma.ReservationWhereInput = {
    userId: session.userId,
    ...(filters.propertyId ? { id: filters.propertyId } : {}),
  };

  const payments = await prisma.payment.findMany({
    where: {
      status: "COMPLETED",
      paymentType: "RESERVATION",
      deletedAt: null,
      paidAt: { gte: yearStart, lte: yearEnd },
      reservation: reservationFilter,
    },
    select: {
      id: true,
      amount: true,
      method: true,
      paidAt: true,
      reservation: {
        select: { id: true, status: true, propertyId: true },
      },
    },
  });

  // Build cancelledPaymentIds set — payments whose reservation is CANCELLED
  const cancelledPaymentIds = new Set<string>();
  for (const p of payments) {
    if (p.reservation.status === "CANCELLED") {
      cancelledPaymentIds.add(p.id);
    }
  }

  // Map to CashPaymentInput for the seam
  const cashPayments: CashPaymentInput[] = payments.map((p) => ({
    id: p.id,
    amount: Number(p.amount),
    status: "COMPLETED" as const,
    paymentType: "RESERVATION" as const,
    method: (p.method ?? "CASH") as CashPaymentInput["method"],
    paidAt: p.paidAt,
    deletedAt: null,
  }));

  return buildAnnualCollectedCash(cashPayments, year, BUSINESS_TIME_ZONE, cancelledPaymentIds);
}

export async function getReservationsReportForExport(options?: {
  propertyId?: string;
  status?: string;
  startDate?: Date;
  endDate?: Date;
}): Promise<ReservationReport[]> {
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
      billingType: true,
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
      billingType: r.billingType,
      createdAt: r.createdAt,
    };
  });
}

export interface ReservationsReportFilters {
  propertyId?: string;
  status?: string;
  startDate?: Date;
  endDate?: Date;
}

export async function getReservationsReport(
  filters?: ReservationsReportFilters,
  pagination?: { page?: number; limit?: number }
): Promise<PaginatedResponse<ReservationReport> | []> {
  const session = await getSession();
  if (!session) return [];

  const where: Prisma.ReservationWhereInput = {
    userId: session.userId,
  };

  if (filters?.propertyId) {
    where.propertyId = filters.propertyId;
  }

  if (filters?.status && (filters.status === "PENDING" || filters.status === "CONFIRMED" || filters.status === "CANCELLED" || filters.status === "COMPLETED")) {
    where.status = filters.status;
  }

  if (filters?.startDate) {
    where.startDate = { gte: filters.startDate };
  }

  if (filters?.endDate) {
    where.endDate = { lte: filters.endDate };
  }

  const page = pagination?.page || 1;
  const limit = pagination?.limit || 50;
  const skip = (page - 1) * limit;

  const [total, reservations] = await Promise.all([
    prisma.reservation.count({ where }),
    prisma.reservation.findMany({
      where,
      select: {
        id: true,
        totalPrice: true,
        status: true,
        startDate: true,
        endDate: true,
        createdAt: true,
        billingType: true,
        property: { select: { name: true } },
        client: { select: { name: true, email: true } },
        payments: {
          select: { status: true },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
  ]);

  const data = reservations.map((r) => {
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
      billingType: r.billingType,
      createdAt: r.createdAt,
    };
  });

  return { data, total, page, totalPages: Math.ceil(total / limit) };
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

export interface CollectionReportTotals {
  totalToCollect: number;
  totalOverdue: number;
  pendingInvoices: number;
}

export async function getCollectionReport(filters?: CollectionReportFilters): Promise<
  | (PaginatedResponse<CollectionReportRow> & { totals: CollectionReportTotals })
  | []
> {
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

  // Computar totales sobre el CONJUNTO COMPLETO (no la página) para los KPIs
  const totals = sumCollectionTotals(rows);

  return { data, total, page, totalPages, totals };
}

// ─── Decision Summary ───────────────────────────────────────────────────────────

export interface DecisionSummaryFilters {
  propertyId?: string;
  rangeStart: Date;
  rangeEnd: Date;
  /** Year for the annual cash series. Defaults to current year. */
  annualYear?: number;
}

/**
 * Returns the Decision Summary report for the authenticated user.
 *
 * Uses buildDecisionSummary (pure domain module) after loading data from Prisma.
 * Implements ADR-0028, ADR-0020 (timezone: America/Santiago), and ADR-0030
 * (cash basis source of truth, single payment read).
 *
 * Payment selection includes `method` to power the cash byMethod breakdown.
 */
export async function getDecisionSummary(
  filters: DecisionSummaryFilters,
): Promise<ReportDecisionSummary | null> {
  const session = await getSession();
  if (!session) return null;

  const { propertyId, rangeStart, rangeEnd, annualYear } = filters;

  // Fetch all properties the user owns (optionally filtered by propertyId).
  // propertyId is always combined with userId (ownerId) for security.
  const properties = await prisma.property.findMany({
    where: {
      userId: session.userId,
      ...(propertyId ? { id: propertyId } : {}),
    },
    select: {
      id: true,
      name: true,
      unitsAvailable: true,
    },
  });

  if (properties.length === 0) {
    const { buildDecisionSummary } = await import("@/lib/reports/decision-summary");
    return buildDecisionSummary({
      reservations: [],
      properties: [],
      rangeStart,
      rangeEnd,
    });
  }

  const propertyIdsInScope = properties.map((p) => p.id);

  // Fetch ALL reservations (including CANCELLED) for cash tracking.
  // IMPORTANT: No date intersection filter here — cash is determined by payment paidAt date,
  // not by stay dates. A payment on Feb 28 belongs to February's cash even if the stay
  // started March 1. The domain module (decision-summary.ts) filters by paidAt date.
  const reservations = await prisma.reservation.findMany({
    where: {
      userId: session.userId,
      propertyId: { in: propertyIdsInScope },
      // CANCELLED needed for collectedCashFromCancelledReservations — do NOT filter out
    },
    select: {
      id: true,
      propertyId: true,
      billingType: true,
      status: true,
      startDate: true,
      endDate: true,
      totalPrice: true,
      unitsBooked: true,
      payments: {
        select: {
          id: true,
          amount: true,
          status: true,
          paymentType: true,
          method: true,
          paidAt: true,
          deletedAt: true,
          dueDate: true,
        },
      },
    },
  });

  const { buildDecisionSummary } = await import("@/lib/reports/decision-summary");

  const decisionProperties = properties.map((p) => ({
    id: p.id,
    name: p.name,
    unitsAvailable: p.unitsAvailable,
  }));

  const decisionReservations = reservations.map((r) => ({
    id: r.id,
    propertyId: r.propertyId,
    billingType: r.billingType as "DAILY" | "MONTHLY",
    status: r.status as "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED",
    startDate: r.startDate,
    endDate: r.endDate,
    totalPrice: Number(r.totalPrice),
    unitsBooked: r.unitsBooked,
    payments: r.payments.map((p) => ({
      id: p.id,
      amount: Number(p.amount),
      status: p.status as "PENDING" | "COMPLETED" | "FAILED",
      paymentType: p.paymentType as "RESERVATION" | "EXTRA",
      method: p.method as "MERCADO_PAGO" | "CASH" | "TRANSFER",
      paidAt: p.paidAt,
      deletedAt: p.deletedAt,
      dueDate: p.dueDate,
    })),
  }));

  return buildDecisionSummary({
    reservations: decisionReservations,
    properties: decisionProperties,
    rangeStart,
    rangeEnd,
    annualYear,
  });
}
