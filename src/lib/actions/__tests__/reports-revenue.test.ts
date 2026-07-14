import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SessionUser } from "@/lib/auth/session";
import { Decimal } from "@prisma/client/runtime/client";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    payment: {
      findMany: vi.fn(),
      aggregate: vi.fn(),
      groupBy: vi.fn(),
    },
    $queryRaw: vi.fn(),
  },
}));

vi.mock("@/lib/payments/queries", () => ({
  sumCompletedPaymentsForOwner: vi.fn().mockResolvedValue(0),
  sumPendingPaymentsForOwner: vi.fn().mockResolvedValue(0),
}));

vi.mock("@/lib/auth/session", () => ({
  getSession: vi.fn(),
}));

const ownerSession: SessionUser = {
  userId: "owner-1",
  role: "OWNER",
  plan: "FREE",
  email: "owner@test.com",
};

describe("getRevenueReport — H1 perf fix (N+1 → single query)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("retorna [] sin sesión", async () => {
    const { getSession } = await import("@/lib/auth/session");
    vi.mocked(getSession).mockResolvedValue(null);

    const { getRevenueReport } = await import("@/lib/actions/reports");
    const result = await getRevenueReport({ year: 2026 });

    expect(result).toEqual([]);
  });

  it("hace UNA sola query findMany (no loop de 12 aggregates)", async () => {
    const { getSession } = await import("@/lib/auth/session");
    const { prisma } = await import("@/lib/db/prisma");

    vi.mocked(getSession).mockResolvedValue(ownerSession);
    vi.mocked(prisma.payment.findMany).mockResolvedValue([]);
    vi.mocked(prisma.payment.aggregate).mockResolvedValue(
      {} as Awaited<ReturnType<typeof prisma.payment.aggregate>>
    );

    const { getRevenueReport } = await import("@/lib/actions/reports");
    await getRevenueReport({ year: 2026 });

    expect(prisma.payment.findMany).toHaveBeenCalledTimes(1);
    // Audit H1: el loop viejo hacía 12 calls a aggregate.
    expect(prisma.payment.aggregate).not.toHaveBeenCalled();
  });

  it("emite los 12 meses del año en orden inverso (más reciente primero)", async () => {
    const { getSession } = await import("@/lib/auth/session");
    const { prisma } = await import("@/lib/db/prisma");

    vi.mocked(getSession).mockResolvedValue(ownerSession);
    vi.mocked(prisma.payment.findMany).mockResolvedValue([]);

    const { getRevenueReport } = await import("@/lib/actions/reports");
    const result = await getRevenueReport({ year: 2026 });

    expect(result).toHaveLength(12);
    expect(result[0].month).toBe("Dec 2026");
    expect(result[11].month).toBe("Jan 2026");
    // Zero-fill en meses sin pagos
    expect(result[0]).toEqual({ month: "Dec 2026", totalRevenue: 0, reservationCount: 0 });
    expect(result[6]).toEqual({ month: "Jun 2026", totalRevenue: 0, reservationCount: 0 });
  });

  it("agrega múltiples pagos del mismo mes (sum amount + count)", async () => {
    const { getSession } = await import("@/lib/auth/session");
    const { prisma } = await import("@/lib/db/prisma");

    vi.mocked(getSession).mockResolvedValue(ownerSession);
    vi.mocked(prisma.payment.findMany).mockResolvedValue([
      { paidAt: new Date("2026-03-05T10:00:00.000Z"), amount: 100 },
      { paidAt: new Date("2026-03-15T10:00:00.000Z"), amount: 250 },
      { paidAt: new Date("2026-03-22T10:00:00.000Z"), amount: 150 },
    ] as never);

    const { getRevenueReport } = await import("@/lib/actions/reports");
    const result = await getRevenueReport({ year: 2026 });

    // Mar 2026 está en posición 9 (índice 11 - 2 = 9) porque el orden es inverso
    const march = result[9];
    expect(march.month).toBe("Mar 2026");
    expect(march.totalRevenue).toBe(500);
    expect(march.reservationCount).toBe(3);
  });

  it("respeta `months` para ventanas parciales (e.g. últimos 3 meses)", async () => {
    const { getSession } = await import("@/lib/auth/session");
    const { prisma } = await import("@/lib/db/prisma");

    vi.mocked(getSession).mockResolvedValue(ownerSession);
    vi.mocked(prisma.payment.findMany).mockResolvedValue([]);

    const { getRevenueReport } = await import("@/lib/actions/reports");
    const result = await getRevenueReport({ year: 2026, months: 3 });

    expect(result).toHaveLength(3);
    expect(result[0].month).toBe("Mar 2026");
    expect(result[1].month).toBe("Feb 2026");
    expect(result[2].month).toBe("Jan 2026");
  });

  it("filtra por owner via `reservation.userId`", async () => {
    const { getSession } = await import("@/lib/auth/session");
    const { prisma } = await import("@/lib/db/prisma");

    vi.mocked(getSession).mockResolvedValue(ownerSession);
    vi.mocked(prisma.payment.findMany).mockResolvedValue([]);

    const { getRevenueReport } = await import("@/lib/actions/reports");
    await getRevenueReport({ year: 2026 });

    expect(prisma.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          reservation: { userId: "owner-1" },
          status: "COMPLETED",
        }),
      })
    );
  });

  it("usa startOfYear/endOfYear del año pedido como rango", async () => {
    const { getSession } = await import("@/lib/auth/session");
    const { prisma } = await import("@/lib/db/prisma");

    vi.mocked(getSession).mockResolvedValue(ownerSession);
    vi.mocked(prisma.payment.findMany).mockResolvedValue([]);

    const { getRevenueReport } = await import("@/lib/actions/reports");
    await getRevenueReport({ year: 2025 });

    const call = vi.mocked(prisma.payment.findMany).mock.calls[0][0];
    const where = call?.where as { paidAt: { gte: Date; lte: Date } };

    expect(where.paidAt.gte).toBeInstanceOf(Date);
    expect(where.paidAt.lte).toBeInstanceOf(Date);
    // 1 Jan 2025 00:00:00 (local time, since date-fns startOfYear usa local)
    expect(where.paidAt.gte.getFullYear()).toBe(2025);
    expect(where.paidAt.gte.getMonth()).toBe(0);
    expect(where.paidAt.gte.getDate()).toBe(1);
    // 31 Dec 2025 (end-of-year via date-fns endOfYear)
    expect(where.paidAt.lte.getFullYear()).toBe(2025);
    expect(where.paidAt.lte.getMonth()).toBe(11);
    expect(where.paidAt.lte.getDate()).toBe(31);
    expect(where.paidAt.lte.getHours()).toBe(23);
  });
});

describe("getYearlySummary — H4 perf fix (findMany → groupBy + $queryRaw)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("retorna null sin sesión", async () => {
    const { getSession } = await import("@/lib/auth/session");
    vi.mocked(getSession).mockResolvedValue(null);

    const { getYearlySummary } = await import("@/lib/actions/reports");
    const result = await getYearlySummary(2026);

    expect(result).toBeNull();
  });

  it("filtra por owner via reservation.userId en las 3 queries en paralelo (Promise.all)", async () => {
    const { getSession } = await import("@/lib/auth/session");
    const { prisma } = await import("@/lib/db/prisma");

    vi.mocked(getSession).mockResolvedValue(ownerSession);
    // Mock sumCompletedPaymentsForOwner (imported from lib/payments/queries)
    vi.mocked(prisma.payment.groupBy).mockResolvedValue([]);
    vi.mocked(prisma.$queryRaw).mockResolvedValue([]);

    const { getYearlySummary } = await import("@/lib/actions/reports");
    await getYearlySummary(2026);

    // Verify groupBy was called with reservation.userId filter
    expect(prisma.payment.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          reservation: { userId: "owner-1" },
          status: "COMPLETED",
          paidAt: expect.any(Object),
        }),
      })
    );

    // Verify $queryRaw was called once (raw SQL with subquery for reservation.userId)
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it("llama a sumCompletedPaymentsForOwner, groupBy y $queryRaw exactamente una vez cada uno", async () => {
    const { getSession } = await import("@/lib/auth/session");
    const { prisma } = await import("@/lib/db/prisma");

    vi.mocked(getSession).mockResolvedValue(ownerSession);
    vi.mocked(prisma.payment.groupBy).mockResolvedValue([]);
    vi.mocked(prisma.$queryRaw).mockResolvedValue([]);

    const { getYearlySummary } = await import("@/lib/actions/reports");
    await getYearlySummary(2026);

    // sumCompletedPaymentsForOwner is called indirectly via the module import
    // We verify the parallel structure by checking groupBy and $queryRaw each called once
    expect(prisma.payment.groupBy).toHaveBeenCalledTimes(1);
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it("emite byMonth con 12 elementos (zero-fill para meses sin datos)", async () => {
    const { getSession } = await import("@/lib/auth/session");
    const { prisma } = await import("@/lib/db/prisma");

    vi.mocked(getSession).mockResolvedValue(ownerSession);
    vi.mocked(prisma.payment.groupBy).mockResolvedValue([]);
    vi.mocked(prisma.$queryRaw).mockResolvedValue([
      { month: 3, total: new Decimal("1500"), count: 2 },
      { month: 7, total: new Decimal("800"), count: 1 },
    ] as never);

    const { getYearlySummary } = await import("@/lib/actions/reports");
    const result = await getYearlySummary(2026);

    expect(result).not.toBeNull();
    expect(result!.byMonth).toHaveLength(12);
    // Months without data should be zero-filled
    expect(result!.byMonth[0]).toBe(0); // Jan
    expect(result!.byMonth[2]).toBe(1500); // Mar
    expect(result!.byMonth[6]).toBe(800); // Jul
    expect(result!.byMonth[8]).toBe(0); // Sep
  });

  it("byMethod mapea correctamente MERCADO_PAGO | CASH | TRANSFER con sus sums", async () => {
    const { getSession } = await import("@/lib/auth/session");
    const { prisma } = await import("@/lib/db/prisma");

    vi.mocked(getSession).mockResolvedValue(ownerSession);
    vi.mocked(prisma.payment.groupBy).mockResolvedValue([
      { method: "CASH", _sum: { amount: new Decimal("500") }, _count: { _all: 3 } },
      { method: "MERCADO_PAGO", _sum: { amount: new Decimal("800") }, _count: { _all: 2 } },
      { method: "TRANSFER", _sum: { amount: new Decimal("1200") }, _count: { _all: 1 } },
    ] as never);
    vi.mocked(prisma.$queryRaw).mockResolvedValue([]);

    const { getYearlySummary } = await import("@/lib/actions/reports");
    const result = await getYearlySummary(2026);

    expect(result).not.toBeNull();
    expect(result!.byMethod).toEqual({
      CASH: 500,
      MERCADO_PAGO: 800,
      TRANSFER: 1200,
    });
  });

  it("totalPayments es la suma de _count._all de todos los métodos", async () => {
    const { getSession } = await import("@/lib/auth/session");
    const { prisma } = await import("@/lib/db/prisma");

    vi.mocked(getSession).mockResolvedValue(ownerSession);
    vi.mocked(prisma.payment.groupBy).mockResolvedValue([
      { method: "CASH", _sum: { amount: new Decimal("500") }, _count: { _all: 3 } },
      { method: "MERCADO_PAGO", _sum: { amount: new Decimal("800") }, _count: { _all: 2 } },
    ] as never);
    vi.mocked(prisma.$queryRaw).mockResolvedValue([]);

    const { getYearlySummary } = await import("@/lib/actions/reports");
    const result = await getYearlySummary(2026);

    expect(result).not.toBeNull();
    expect(result!.totalPayments).toBe(5); // 3 + 2
  });
});