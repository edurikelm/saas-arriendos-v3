#!/usr/bin/env node
/**
 * Performance profiling script.
 * Bypasses HTTP layer: logs in via the login action, then walks the same Prisma
 * queries that each route uses. Captures counts and timings.
 *
 * Usage: node scripts/profile-walk.mjs
 */

import { performance } from "node:perf_hooks";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const poolConfig = {
  connectionString,
  max: 5,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 5000,
};
if (connectionString.includes("sslmode=verify-ca") || connectionString.includes("sslmode=require")) {
  poolConfig.ssl = { rejectUnauthorized: false };
}
const pool = new pg.Pool(poolConfig);
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
  log: [
    { emit: "event", level: "query" },
    { emit: "stdout", level: "error" },
  ],
});

// Counters
let queryCount = 0;
const queries = [];

prisma.$on("query", (e) => {
  queryCount++;
  queries.push({
    duration_ms: Number(e.duration),
    query: e.query.replace(/\s+/g, " ").slice(0, 200),
  });
});

function resetCounters() {
  queryCount = 0;
  queries.length = 0;
}

function summarize(label) {
  const durations = queries.map((q) => q.duration_ms);
  const total = durations.reduce((a, b) => a + b, 0);
  const max = Math.max(...durations);
  const avg = durations.length > 0 ? total / durations.length : 0;
  console.log(`\n--- ${label} ---`);
  console.log(`queries: ${queries.length}, total_db_ms: ${total.toFixed(2)}, avg_ms: ${avg.toFixed(2)}, max_ms: ${max.toFixed(2)}`);
  console.log("Top 5 slowest:");
  [...queries]
    .sort((a, b) => b.duration_ms - a.duration_ms)
    .slice(0, 5)
    .forEach((q, i) => console.log(`  ${i + 1}. ${q.duration_ms.toFixed(2)}ms — ${q.query}`));
}

async function timeit(label, fn) {
  resetCounters();
  const t0 = performance.now();
  try {
    const result = await fn();
    const t1 = performance.now();
    summarize(label);
    console.log(`total_wall_ms: ${(t1 - t0).toFixed(2)}, returned: ${Array.isArray(result) ? result.length + " rows" : typeof result}`);
    return result;
  } catch (err) {
    console.log(`ERROR: ${err.message}`);
  }
}

async function main() {
  console.log("=== RentalPro Profile Walk ===\n");
  console.log(`Data volume: see pg_stat_user_tables\n`);

  // 1. /dashboard equivalent: owner KPIs + today reservations
  // Mimic: getOwnersCount, total properties, today reservations, etc.
  await timeit("Dashboard — owner KPIs", async () => {
    const [properties, reservations, payments, clients] = await Promise.all([
      prisma.property.count(),
      prisma.reservation.count(),
      prisma.payment.findMany({
        where: { status: "COMPLETED" },
        select: { amount: true, method: true },
      }),
      prisma.reservationClient.count(),
    ]);
    return { properties, reservations, payments: payments.length, clients };
  });

  // 2. /properties equivalent
  await timeit("Properties — list with images+amenities", async () => {
    return prisma.property.findMany({
      include: { _count: { select: { reservations: true } } },
    });
  });

  // 3. /properties equivalent — MINIMAL select (proposed fix)
  await timeit("Properties — list WITH select (proposed)", async () => {
    return prisma.property.findMany({
      select: {
        id: true, name: true, unitsAvailable: true, dailyPrice: true,
        monthlyPrice: true, color: true, mainImage: true,
        type: true, currency: true, amenities: true, images: true,
        _count: { select: { reservations: true } },
      },
    });
  });

  // 4. /reservations list with full payments include (current behavior)
  await timeit("Reservations — list with payments include", async () => {
    return prisma.reservation.findMany({
      include: {
        property: { select: { id: true, name: true, color: true } },
        client: { select: { id: true, name: true } },
        payments: {
          where: { deletedAt: null },
          select: {
            id: true, paymentType: true, status: true, method: true,
            amount: true, paidAt: true, dueDate: true, installmentIndex: true,
            receiptUrl: true, expiresAt: true, mercadoPagoId: true, initPoint: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  });

  // 5. /reservations list WITHOUT receiptUrl (proposed fix)
  await timeit("Reservations — list WITHOUT receiptUrl (proposed)", async () => {
    return prisma.reservation.findMany({
      include: {
        property: { select: { id: true, name: true, color: true } },
        client: { select: { id: true, name: true } },
        payments: {
          where: { deletedAt: null },
          select: {
            id: true, paymentType: true, status: true, method: true,
            amount: true, paidAt: true, dueDate: true, installmentIndex: true,
            expiresAt: true, mercadoPagoId: true, initPoint: true,
            // receiptUrl omitted
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  });

  // 6. /calendar — properties + reservations in date range
  await timeit("Calendar — properties + reservations in date range", async () => {
    const [properties, reservations, externalBlocks] = await Promise.all([
      prisma.property.findMany({
        select: { id: true, name: true, color: true, unitsAvailable: true, dailyPrice: true, type: true },
      }),
      prisma.reservation.findMany({
        where: {
          status: { in: ["PENDING", "CONFIRMED"] },
          // Date range filter omitted for simplicity
        },
        select: {
          id: true, startDate: true, endDate: true, status: true,
          unitsBooked: true, billingType: true,
          propertyId: true,
        },
      }),
      prisma.externalChannelBlock.findMany({
        where: { status: "ACTIVE" },
        select: { id: true, startDate: true, endDate: true, propertyId: true, externalCalendarId: true },
      }),
    ]);
    return { properties, reservations, externalBlocks };
  });

  // 7. /reports — getRevenueReport with 12 months (current loop)
  await timeit("Reports — getRevenueReport 12-month loop (current)", async () => {
    const reports = [];
    for (let i = 0; i < 12; i++) {
      const targetDate = new Date(2026, i, 1);
      const startOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
      const endOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0);
      const result = await prisma.payment.aggregate({
        where: {
          status: "COMPLETED",
          paidAt: { gte: startOfMonth, lte: endOfMonth },
        },
        _sum: { amount: true },
        _count: { id: true },
      });
      reports.push({ month: i, total: result._sum.amount ?? 0, count: result._count.id });
    }
    return reports;
  });

  // 8. /reports — getRevenueReport with single groupBy (proposed fix)
  await timeit("Reports — getRevenueReport single groupBy (proposed)", async () => {
    const yearStart = new Date(2026, 0, 1);
    const yearEnd = new Date(2026, 11, 31);
    return prisma.payment.groupBy({
      by: ["paidAt"],
      where: {
        status: "COMPLETED",
        paidAt: { gte: yearStart, lte: yearEnd },
      },
      _sum: { amount: true },
      _count: { id: true },
    });
  });

  // 9. /admin/users list (super admin)
  await timeit("Admin — getAllUsers", async () => {
    return prisma.userProfile.findMany({
      include: {
        _count: { select: { properties: true, reservations: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  });

  // 10. /admin/support list
  await timeit("Admin — support tickets with unread", async () => {
    const tickets = await prisma.supportTicket.findMany({
      include: {
        user: { select: { id: true, name: true, email: true } },
        _count: { select: { messages: true } },
      },
      orderBy: [{ priority: "desc" }, { status: "asc" }, { lastActivityAt: "desc" }],
      take: 20,
    });
    // Mimic buildUnreadMap
    const ticketIds = tickets.map((t) => t.id);
    const reads = await prisma.supportTicketRead.findMany({
      where: { ticketId: { in: ticketIds } },
      select: { ticketId: true, lastReadAt: true },
    });
    return { tickets, reads };
  });

  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});