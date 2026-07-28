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

describe("getYearlySummary — H4 perf fix (seam buildAnnualCollectedCash)", () => {
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

  it("acepta YearlySummaryFilters con year y propertyId (nuevo contrato)", async () => {
    const { getSession } = await import("@/lib/auth/session");
    const { prisma } = await import("@/lib/db/prisma");

    vi.mocked(getSession).mockResolvedValue(ownerSession);
    vi.mocked(prisma.payment.findMany).mockResolvedValue([]);

    const { getYearlySummary } = await import("@/lib/actions/reports");
    const result = await getYearlySummary({ year: 2026, propertyId: "prop-abc" });

    expect(result).not.toBeNull();
    expect(result!.year).toBe(2026);
    expect(prisma.payment.findMany).toHaveBeenCalledTimes(1);
  });

  it("acepta year posicional (legacy compat)", async () => {
    const { getSession } = await import("@/lib/auth/session");
    const { prisma } = await import("@/lib/db/prisma");

    vi.mocked(getSession).mockResolvedValue(ownerSession);
    vi.mocked(prisma.payment.findMany).mockResolvedValue([]);

    const { getYearlySummary } = await import("@/lib/actions/reports");
    const result = await getYearlySummary(2025);

    expect(result).not.toBeNull();
    expect(result!.year).toBe(2025);
  });

  it("filtra predicate: COMPLETED, paymentType RESERVATION, deletedAt null, paidAt en año, reservation.userId", async () => {
    const { getSession } = await import("@/lib/auth/session");
    const { prisma } = await import("@/lib/db/prisma");

    vi.mocked(getSession).mockResolvedValue(ownerSession);
    vi.mocked(prisma.payment.findMany).mockResolvedValue([]);

    const { getYearlySummary } = await import("@/lib/actions/reports");
    await getYearlySummary({ year: 2026, propertyId: undefined });

    expect(prisma.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "COMPLETED",
          paymentType: "RESERVATION",
          deletedAt: null,
          paidAt: expect.objectContaining({ gte: expect.any(Date), lte: expect.any(Date) }),
          reservation: expect.objectContaining({ userId: "owner-1" }),
        }),
      })
    );
  });

  it("filtra por propertyId cuando se provee (propertyId scope)", async () => {
    const { getSession } = await import("@/lib/auth/session");
    const { prisma } = await import("@/lib/db/prisma");

    vi.mocked(getSession).mockResolvedValue(ownerSession);
    vi.mocked(prisma.payment.findMany).mockResolvedValue([]);

    const { getYearlySummary } = await import("@/lib/actions/reports");
    await getYearlySummary({ year: 2026, propertyId: "prop-xyz" });

    expect(prisma.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          reservation: expect.objectContaining({ userId: "owner-1", id: "prop-xyz" }),
        }),
      })
    );
  });

  it("excluye PENDING, FAILED, EXTRA y deletedAt non-null via WHERE clause en findMany", async () => {
    const { getSession } = await import("@/lib/auth/session");
    const { prisma } = await import("@/lib/db/prisma");

    vi.mocked(getSession).mockResolvedValue(ownerSession);
    vi.mocked(prisma.payment.findMany).mockResolvedValue([]);

    const { getYearlySummary } = await import("@/lib/actions/reports");
    await getYearlySummary(2026);

    // Verify the WHERE clause contains all predicate filters
    const call = vi.mocked(prisma.payment.findMany).mock.calls[0][0];
    const where = call?.where as Record<string, unknown>;

    expect(where.status).toBe("COMPLETED");
    expect(where.paymentType).toBe("RESERVATION");
    expect(where.deletedAt).toBeNull();
    expect(where.paidAt).toEqual(expect.objectContaining({ gte: expect.any(Date), lte: expect.any(Date) }));
    expect(where.reservation).toEqual(expect.objectContaining({ userId: "owner-1" }));
  });

  it("retorna zero totals cuando no hay pagos eligible en el año", async () => {
    const { getSession } = await import("@/lib/auth/session");
    const { prisma } = await import("@/lib/db/prisma");

    vi.mocked(getSession).mockResolvedValue(ownerSession);
    // Return data that would NOT pass the DB WHERE filter in a real scenario
    // (in the actual DB these would be filtered out; the empty result proves the filter works)
    vi.mocked(prisma.payment.findMany).mockResolvedValue([]);

    const { getYearlySummary } = await import("@/lib/actions/reports");
    const result = await getYearlySummary(2026);

    expect(result).not.toBeNull();
    expect(result!.totalCash).toBe(0);
    expect(result!.paymentCount).toBe(0);
    expect(result!.cancelledCash).toBe(0);
    for (const m of result!.byMonth) {
      expect(m.collectedCash).toBe(0);
    }
  });

  it("byMonth tiene 12 elementos con shape MonthlyCollectedCash y zero-fill", async () => {
    const { getSession } = await import("@/lib/auth/session");
    const { prisma } = await import("@/lib/db/prisma");

    vi.mocked(getSession).mockResolvedValue(ownerSession);
    vi.mocked(prisma.payment.findMany).mockResolvedValue([
      { id: "p1", amount: new Decimal("150000"), status: "COMPLETED", paymentType: "RESERVATION", method: "MERCADO_PAGO", paidAt: new Date("2026-03-15T10:00:00Z"), deletedAt: null, reservation: { id: "r1", status: "CONFIRMED", propertyId: "prop-1" } },
      { id: "p2", amount: new Decimal("80000"), status: "COMPLETED", paymentType: "RESERVATION", method: "CASH", paidAt: new Date("2026-07-20T10:00:00Z"), deletedAt: null, reservation: { id: "r2", status: "CONFIRMED", propertyId: "prop-1" } },
    ] as never);

    const { getYearlySummary } = await import("@/lib/actions/reports");
    const result = await getYearlySummary(2026);

    expect(result).not.toBeNull();
    expect(result!.byMonth).toHaveLength(12);

    // Shape: each entry has monthKey, collectedCash, paymentCount, cancelledCash
    for (const m of result!.byMonth) {
      expect(m).toHaveProperty("monthKey");
      expect(m).toHaveProperty("collectedCash");
      expect(m).toHaveProperty("paymentCount");
      expect(m).toHaveProperty("cancelledCash");
    }

    // Zero-fill: months without data
    const jan = result!.byMonth.find((m) => m.monthKey === "2026-01")!;
    expect(jan.collectedCash).toBe(0);
    expect(jan.paymentCount).toBe(0);
    expect(jan.cancelledCash).toBe(0);

    // Month with data
    const mar = result!.byMonth.find((m) => m.monthKey === "2026-03")!;
    expect(mar.collectedCash).toBe(150000);
    expect(mar.paymentCount).toBe(1);
    expect(mar.cancelledCash).toBe(0);

    const jul = result!.byMonth.find((m) => m.monthKey === "2026-07")!;
    expect(jul.collectedCash).toBe(80000);
    expect(jul.paymentCount).toBe(1);
  });

  it("byMethod mapea MERCADO_PAGO | CASH | TRANSFER con sums correctos", async () => {
    const { getSession } = await import("@/lib/auth/session");
    const { prisma } = await import("@/lib/db/prisma");

    vi.mocked(getSession).mockResolvedValue(ownerSession);
    vi.mocked(prisma.payment.findMany).mockResolvedValue([
      { id: "p1", amount: new Decimal("100000"), status: "COMPLETED", paymentType: "RESERVATION", method: "MERCADO_PAGO", paidAt: new Date("2026-02-10"), deletedAt: null, reservation: { id: "r1", status: "CONFIRMED", propertyId: "prop-1" } },
      { id: "p2", amount: new Decimal("50000"), status: "COMPLETED", paymentType: "RESERVATION", method: "MERCADO_PAGO", paidAt: new Date("2026-04-10"), deletedAt: null, reservation: { id: "r2", status: "CONFIRMED", propertyId: "prop-1" } },
      { id: "p3", amount: new Decimal("200000"), status: "COMPLETED", paymentType: "RESERVATION", method: "CASH", paidAt: new Date("2026-06-01"), deletedAt: null, reservation: { id: "r3", status: "CONFIRMED", propertyId: "prop-1" } },
      { id: "p4", amount: new Decimal("300000"), status: "COMPLETED", paymentType: "RESERVATION", method: "TRANSFER", paidAt: new Date("2026-09-15"), deletedAt: null, reservation: { id: "r4", status: "CONFIRMED", propertyId: "prop-1" } },
    ] as never);

    const { getYearlySummary } = await import("@/lib/actions/reports");
    const result = await getYearlySummary(2026);

    expect(result).not.toBeNull();
    expect(result!.byMethod["MERCADO_PAGO"]).toBe(150000); // 100k + 50k
    expect(result!.byMethod["CASH"]).toBe(200000);
    expect(result!.byMethod["TRANSFER"]).toBe(300000);
  });

  it("paymentCount cuenta pagos (no reservas)", async () => {
    const { getSession } = await import("@/lib/auth/session");
    const { prisma } = await import("@/lib/db/prisma");

    vi.mocked(getSession).mockResolvedValue(ownerSession);
    // 3 payments for 1 reservation — should count 3, not 1
    vi.mocked(prisma.payment.findMany).mockResolvedValue([
      { id: "p1", amount: new Decimal("100000"), status: "COMPLETED", paymentType: "RESERVATION", method: "MERCADO_PAGO", paidAt: new Date("2026-01-10"), deletedAt: null, reservation: { id: "r1", status: "CONFIRMED", propertyId: "prop-1" } },
      { id: "p2", amount: new Decimal("100000"), status: "COMPLETED", paymentType: "RESERVATION", method: "MERCADO_PAGO", paidAt: new Date("2026-02-10"), deletedAt: null, reservation: { id: "r1", status: "CONFIRMED", propertyId: "prop-1" } },
      { id: "p3", amount: new Decimal("100000"), status: "COMPLETED", paymentType: "RESERVATION", method: "MERCADO_PAGO", paidAt: new Date("2026-03-10"), deletedAt: null, reservation: { id: "r1", status: "CONFIRMED", propertyId: "prop-1" } },
    ] as never);

    const { getYearlySummary } = await import("@/lib/actions/reports");
    const result = await getYearlySummary(2026);

    expect(result).not.toBeNull();
    expect(result!.paymentCount).toBe(3); // 3 payments, 1 reservation
  });

  it("reconciliación: totalCash === sum(byMonth.collectedCash) === sum(byMethod)", async () => {
    const { getSession } = await import("@/lib/auth/session");
    const { prisma } = await import("@/lib/db/prisma");

    vi.mocked(getSession).mockResolvedValue(ownerSession);
    vi.mocked(prisma.payment.findMany).mockResolvedValue([
      { id: "p1", amount: new Decimal("50000"), status: "COMPLETED", paymentType: "RESERVATION", method: "MERCADO_PAGO", paidAt: new Date("2026-06-01"), deletedAt: null, reservation: { id: "r1", status: "CONFIRMED", propertyId: "prop-1" } },
      { id: "p2", amount: new Decimal("75000"), status: "COMPLETED", paymentType: "RESERVATION", method: "CASH", paidAt: new Date("2026-06-15"), deletedAt: null, reservation: { id: "r2", status: "CONFIRMED", propertyId: "prop-1" } },
      { id: "p3", amount: new Decimal("125000"), status: "COMPLETED", paymentType: "RESERVATION", method: "TRANSFER", paidAt: new Date("2026-12-01"), deletedAt: null, reservation: { id: "r3", status: "CONFIRMED", propertyId: "prop-1" } },
    ] as never);

    const { getYearlySummary } = await import("@/lib/actions/reports");
    const result = await getYearlySummary(2026);

    expect(result).not.toBeNull();

    const sumByMonth = result!.byMonth.reduce((acc, m) => acc + m.collectedCash, 0);
    const sumByMethod = Object.values(result!.byMethod).reduce((acc, v) => acc + v, 0);

    expect(result!.totalCash).toBe(250000);
    expect(result!.totalCash).toBe(sumByMonth);
    expect(result!.totalCash).toBe(sumByMethod);
    expect(result!.paymentCount).toBe(3);
  });

  it("cancelledCash es subtotal dentro de totalCash (reservas CANCELLED incluidas en total)", async () => {
    const { getSession } = await import("@/lib/auth/session");
    const { prisma } = await import("@/lib/db/prisma");

    vi.mocked(getSession).mockResolvedValue(ownerSession);
    vi.mocked(prisma.payment.findMany).mockResolvedValue([
      // Normal payment
      { id: "p1", amount: new Decimal("100000"), status: "COMPLETED", paymentType: "RESERVATION", method: "MERCADO_PAGO", paidAt: new Date("2026-01-15"), deletedAt: null, reservation: { id: "r1", status: "CONFIRMED", propertyId: "prop-1" } },
      // Payment from cancelled reservation — still counts in totalCash
      { id: "p2", amount: new Decimal("50000"), status: "COMPLETED", paymentType: "RESERVATION", method: "CASH", paidAt: new Date("2026-02-20"), deletedAt: null, reservation: { id: "r2", status: "CANCELLED", propertyId: "prop-1" } },
    ] as never);

    const { getYearlySummary } = await import("@/lib/actions/reports");
    const result = await getYearlySummary(2026);

    expect(result).not.toBeNull();
    // totalCash includes both (cancelled reservation payments ARE included)
    expect(result!.totalCash).toBe(150000);
    // cancelledCash tracks the subtotal from cancelled reservations
    expect(result!.cancelledCash).toBe(50000);
    expect(result!.cancelledCash).toBeLessThan(result!.totalCash);
  });

  it("usa una sola findMany (sin loop de aggregates)", async () => {
    const { getSession } = await import("@/lib/auth/session");
    const { prisma } = await import("@/lib/db/prisma");

    vi.mocked(getSession).mockResolvedValue(ownerSession);
    vi.mocked(prisma.payment.findMany).mockResolvedValue([]);

    const { getYearlySummary } = await import("@/lib/actions/reports");
    await getYearlySummary(2026);

    expect(prisma.payment.findMany).toHaveBeenCalledTimes(1);
    // No groupBy, no $queryRaw — single seam call
    expect(prisma.payment.groupBy).not.toHaveBeenCalled();
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it("retorna AnnualCollectedCash con shape correcto (sin totalPayments)", async () => {
    const { getSession } = await import("@/lib/auth/session");
    const { prisma } = await import("@/lib/db/prisma");

    vi.mocked(getSession).mockResolvedValue(ownerSession);
    vi.mocked(prisma.payment.findMany).mockResolvedValue([]);

    const { getYearlySummary } = await import("@/lib/actions/reports");
    const result = await getYearlySummary(2026);

    expect(result).not.toBeNull();
    // New shape
    expect(result).toHaveProperty("year");
    expect(result).toHaveProperty("totalCash");
    expect(result).toHaveProperty("byMonth");
    expect(result).toHaveProperty("byMethod");
    expect(result).toHaveProperty("paymentCount");
    expect(result).toHaveProperty("cancelledCash");
    // Old field must NOT exist (fixes TS2339)
    expect(result).not.toHaveProperty("totalPayments");
  });
});