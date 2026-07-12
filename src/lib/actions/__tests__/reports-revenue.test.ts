import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SessionUser } from "@/lib/auth/session";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    payment: {
      findMany: vi.fn(),
      aggregate: vi.fn(),
    },
  },
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
      { createdAt: new Date("2026-03-05T10:00:00.000Z"), amount: 100 },
      { createdAt: new Date("2026-03-15T10:00:00.000Z"), amount: 250 },
      { createdAt: new Date("2026-03-22T10:00:00.000Z"), amount: 150 },
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
    const where = call?.where as { createdAt: { gte: Date; lte: Date } };

    expect(where.createdAt.gte).toBeInstanceOf(Date);
    expect(where.createdAt.lte).toBeInstanceOf(Date);
    // 1 Jan 2025 00:00:00 (local time, since date-fns startOfYear usa local)
    expect(where.createdAt.gte.getFullYear()).toBe(2025);
    expect(where.createdAt.gte.getMonth()).toBe(0);
    expect(where.createdAt.gte.getDate()).toBe(1);
    // 31 Dec 2025 (end-of-year via date-fns endOfYear)
    expect(where.createdAt.lte.getFullYear()).toBe(2025);
    expect(where.createdAt.lte.getMonth()).toBe(11);
    expect(where.createdAt.lte.getDate()).toBe(31);
    expect(where.createdAt.lte.getHours()).toBe(23);
  });
});