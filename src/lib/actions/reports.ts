"use server";

import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";
import { getSession } from "@/lib/auth/session";
import { startOfMonth, endOfMonth } from "date-fns";
import { nightsBetweenDateOnly } from "@/lib/domain/timezone";
import {
  buildCollectionReportRows,
  buildAgingBuckets,
  type AgingSummary,
  type CollectionReportRow,
} from "@/lib/reports/collection";
import { selectTopClientDebtors, type ClientDebtor } from "@/lib/reports/trend";
import { type ReportDecisionSummary } from "@/lib/reports/decision-summary";
import { sumCollectionTotals } from "@/lib/reports/kpis";
import type { PaginatedResponse } from "@/types/pagination";
import {
  sumCompletedPaymentsForOwner,
  sumPendingPaymentsForOwner,
} from "@/lib/payments/queries";

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
      nightUnits = nightsBetweenDateOnly(res.startDate, res.endDate) * (res.unitsBooked ?? 1);
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

/**
 * Cuenta cuántas reservas traería `getReservationsReportForExport` con los
 * mismos filtros, SIN traer las filas ni sus relaciones.
 *
 * Existe para que los botones de exportación de `/reports` (sección "Llevarse
 * el período") puedan declarar cuántas filas van a exportar ANTES del click,
 * sin repetir la query pesada de `getReservationsReportForExport` en cada
 * cambio de filtro — un `count()` es una query distinta y mucho más barata
 * que un `findMany` con `select` de relaciones, así que esto no reintroduce
 * el costo que ADR-0030 sacó del ciclo de filtrado.
 */
export async function getReservationsReportCount(options?: {
  propertyId?: string;
  startDate?: Date;
  endDate?: Date;
}): Promise<number> {
  const session = await getSession();
  if (!session) return 0;

  const where: Prisma.ReservationWhereInput = {
    userId: session.userId,
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

  return prisma.reservation.count({ where });
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

export interface CollectionReportTotals {
  totalToCollect: number;
  totalOverdue: number;
  pendingInvoices: number;
}

/**
 * Trae las reservas activas (no CANCELLED) del owner en scope, opcionalmente
 * filtradas por propiedad, con sus pagos no borrados, y arma las filas de
 * cobranza vía `buildCollectionReportRows`.
 *
 * Único consumidor: `getOutstandingSnapshot`, que necesita el universo
 * COMPLETO de deuda activa (`billingType: "GENERAL"`, `debtStatus: "ACTIVE"`)
 * — no un subconjunto filtrable por cliente/tipo de arriendo/vencimiento ni
 * paginado. Esa combinación existía como tabla paginada (`getCollectionReport`)
 * y se retiró en ADR-0035 por duplicar `/payments`; la firma de este helper
 * se simplificó junto con ese borrado a lo que su único caller necesita.
 */
async function loadCollectionReportRows(
  userId: string,
  propertyId: string | undefined,
  now: Date,
): Promise<CollectionReportRow[]> {
  const reservations = await prisma.reservation.findMany({
    where: {
      userId,
      ...(propertyId ? { propertyId } : {}),
      status: { not: "CANCELLED" },
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

  return buildCollectionReportRows(
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
    { propertyId, billingType: "GENERAL", debtStatus: "ACTIVE", now },
  );
}

export interface OutstandingSnapshot {
  aging: AgingSummary;
  topDebtors: ClientDebtor[];
  totals: CollectionReportTotals;
}

/**
 * Agregados de deuda activa para la sección "Dónde está la plata que falta"
 * de `/reports` (foto del presente, no del rango seleccionado).
 *
 * Antes, el cliente pedía el conjunto COMPLETO de `CollectionReportRow`
 * (con un límite artificial de 10.000) solo para reducirlo en el browser a
 * 4 tramos de antigüedad y 5 nombres — cruzando el límite servidor→cliente
 * con cientos de objetos de ~17 campos que nunca se muestran. Esta action
 * calcula los agregados en
 * el servidor con el mismo camino de datos (`loadCollectionReportRows`) y
 * devuelve SOLO los agregados.
 *
 * `now` se toma una sola vez y se pasa explícito a `buildAgingBuckets` y
 * `selectTopClientDebtors` para que ambos agregados usen el mismo instante
 * — el cálculo de atraso ocurre en el servidor, no depende del reloj del
 * browser (wall-time `America/Santiago`, ADR-0020).
 */
export async function getOutstandingSnapshot(
  filters?: { propertyId?: string },
): Promise<OutstandingSnapshot | null> {
  const session = await getSession();
  if (!session) return null;

  const now = new Date();
  const rows = await loadCollectionReportRows(session.userId, filters?.propertyId, now);

  return {
    aging: buildAgingBuckets(rows, now),
    topDebtors: selectTopClientDebtors(rows, 5, now),
    totals: sumCollectionTotals(rows),
  };
}

// ─── Decision Summary ───────────────────────────────────────────────────────────

export interface DecisionSummaryFilters {
  propertyId?: string;
  rangeStart: Date;
  rangeEnd: Date;
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

  const { propertyId, rangeStart, rangeEnd } = filters;

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
  });
}
