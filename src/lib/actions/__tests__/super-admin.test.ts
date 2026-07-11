import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SessionUser } from "@/lib/auth/session";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    userProfile: {
      count: vi.fn(),
      findUnique: vi.fn(),
    },
    property: {
      count: vi.fn(),
    },
    reservation: {
      count: vi.fn(),
    },
    payment: {
      aggregate: vi.fn(),
    },
    supportTicket: {
      count: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth/session", () => ({
  getSuperAdminSession: vi.fn(),
  getSession: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const superAdminSession: SessionUser = {
  userId: "admin-1",
  role: "SUPER_ADMIN",
  plan: "PRO",
  email: "admin@test.com",
};

describe("getDashboardStats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna null si no hay sesión", async () => {
    const { getSuperAdminSession } = await import("@/lib/auth/session");
    vi.mocked(getSuperAdminSession).mockResolvedValue(null);

    const { getDashboardStats } = await import("@/lib/actions/super-admin");
    const result = await getDashboardStats();

    expect(result).toBeNull();
  });

  it("retorna null si el usuario no es SUPER_ADMIN", async () => {
    const { getSuperAdminSession } = await import("@/lib/auth/session");

    vi.mocked(getSuperAdminSession).mockResolvedValue(null);

    const { getDashboardStats } = await import("@/lib/actions/super-admin");
    const result = await getDashboardStats();

    expect(result).toBeNull();
  });

  it("retorna métricas excluyendo SUPER_ADMIN (solo OWNER)", async () => {
    const { getSuperAdminSession } = await import("@/lib/auth/session");
    const { prisma } = await import("@/lib/db/prisma");

    vi.mocked(getSuperAdminSession).mockResolvedValue(superAdminSession);

    vi.mocked(prisma.userProfile.count).mockImplementation((async ({ where }: any) => {
      if (!where) return 10;
      if (where.role === "OWNER" && where.plan === "PRO") return 3;
      if (where.role === "OWNER" && where.createdAt?.gte && !where.createdAt?.lte) return 5;
      if (where.role === "OWNER" && where.createdAt?.gte && where.createdAt?.lte) return 4;
      if (where.role === "OWNER") return 10;
      return 0;
    }) as never);
    vi.mocked(prisma.property.count).mockResolvedValue(25);
    vi.mocked(prisma.reservation.count).mockResolvedValue(100);
    vi.mocked(prisma.payment.aggregate).mockResolvedValue({
      _sum: { amount: 500000 },
    } as any);

    const { getDashboardStats } = await import("@/lib/actions/super-admin");
    const result = await getDashboardStats();

    expect(result).not.toBeNull();
    expect(result!.totalOwners).toBe(10);
    expect(result!.totalProperties).toBe(25);
    expect(result!.totalReservations).toBe(100);
    expect(result!.totalRevenue).toBe(500000);
  });

  it("calcula conversión FREE→PRO correctamente", async () => {
    const { getSuperAdminSession } = await import("@/lib/auth/session");
    const { prisma } = await import("@/lib/db/prisma");

    vi.mocked(getSuperAdminSession).mockResolvedValue(superAdminSession);

    vi.mocked(prisma.userProfile.count).mockImplementation((async ({ where }: any) => {
      if (where.role === "OWNER" && where.plan === "PRO") return 3;
      if (where.role === "OWNER" && where.createdAt?.gte && !where.createdAt?.lte) return 2;
      if (where.role === "OWNER" && where.createdAt?.gte && where.createdAt?.lte) return 2;
      if (where.role === "OWNER") return 10;
      return 0;
    }) as never);
    vi.mocked(prisma.property.count).mockResolvedValue(0);
    vi.mocked(prisma.reservation.count).mockResolvedValue(0);
    vi.mocked(prisma.payment.aggregate).mockResolvedValue({ _sum: { amount: 0 } } as any);

    const { getDashboardStats } = await import("@/lib/actions/super-admin");
    const result = await getDashboardStats();

    expect(result!.conversionPercentage).toBe(30);
  });

  it("calcula crecimiento mensual correctamente", async () => {
    const { getSuperAdminSession } = await import("@/lib/auth/session");
    const { prisma } = await import("@/lib/db/prisma");

    vi.mocked(getSuperAdminSession).mockResolvedValue(superAdminSession);

    vi.mocked(prisma.userProfile.count).mockImplementation((async ({ where }: any) => {
      if (where.role === "OWNER" && where.plan === "PRO") return 2;
      if (where.role === "OWNER" && where.createdAt?.gte && !where.createdAt?.lte) return 6;
      if (where.role === "OWNER" && where.createdAt?.gte && where.createdAt?.lte) return 4;
      if (where.role === "OWNER") return 10;
      return 0;
    }) as never);
    vi.mocked(prisma.property.count).mockResolvedValue(0);
    vi.mocked(prisma.reservation.count).mockResolvedValue(0);
    vi.mocked(prisma.payment.aggregate).mockResolvedValue({ _sum: { amount: 0 } } as any);

    const { getDashboardStats } = await import("@/lib/actions/super-admin");
    const result = await getDashboardStats();

    expect(result!.growthPercentage).toBe(50);
    expect(result!.ownersThisMonth).toBe(6);
    expect(result!.ownersLastMonth).toBe(4);
  });

  it("retorna 0% conversión cuando no hay owners", async () => {
    const { getSuperAdminSession } = await import("@/lib/auth/session");
    const { prisma } = await import("@/lib/db/prisma");

    vi.mocked(getSuperAdminSession).mockResolvedValue(superAdminSession);

    vi.mocked(prisma.userProfile.count).mockResolvedValue(0);
    vi.mocked(prisma.property.count).mockResolvedValue(0);
    vi.mocked(prisma.reservation.count).mockResolvedValue(0);
    vi.mocked(prisma.payment.aggregate).mockResolvedValue({ _sum: { amount: 0 } } as any);

    const { getDashboardStats } = await import("@/lib/actions/super-admin");
    const result = await getDashboardStats();

    expect(result!.conversionPercentage).toBe(0);
    expect(result!.growthPercentage).toBe(0);
  });
});
