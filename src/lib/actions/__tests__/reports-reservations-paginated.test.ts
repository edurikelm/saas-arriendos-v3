import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SessionUser } from "@/lib/auth/session";

const mockPrisma = vi.hoisted(() => ({
  reservation: {
    findMany: vi.fn(),
    count: vi.fn(),
  },
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: mockPrisma,
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

const makeReservation = (id: string, overrides: Record<string, unknown> = {}) => {
  const d = new Date("2026-01-01T00:00:00.000Z");
  return {
    id,
    totalPrice: { toString: () => "100000" } as unknown as bigint,
    status: "CONFIRMED",
    startDate: d,
    endDate: d,
    createdAt: d,
    billingType: "DAILY" as const,
    property: { name: "Casa Test" },
    client: { name: "Juan Perez", email: "juan@test.com" },
    payments: [],
    ...overrides,
  };
};

describe("getReservationsReportForExport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sin sesión → retorna []", async () => {
    const { getSession } = await import("@/lib/auth/session");
    vi.mocked(getSession).mockResolvedValue(null);

    const { getReservationsReportForExport } = await import("@/lib/actions/reports");
    const result = await getReservationsReportForExport({});

    expect(result).toEqual([]);
  });

  it("trae TODOS los resultados sin skip ni take", async () => {
    const { getSession } = await import("@/lib/auth/session");
    vi.mocked(getSession).mockResolvedValue(ownerSession);
    vi.mocked(mockPrisma.reservation.findMany).mockResolvedValue([
      makeReservation("res-1"),
      makeReservation("res-2"),
    ]);

    const { getReservationsReportForExport } = await import("@/lib/actions/reports");
    await getReservationsReportForExport({});

    expect(mockPrisma.reservation.findMany).toHaveBeenCalledTimes(1);
    const callArgs = vi.mocked(mockPrisma.reservation.findMany).mock.calls[0][0];
    expect(callArgs.skip).toBeUndefined();
    expect(callArgs.take).toBeUndefined();
  });

  it("no llama a count", async () => {
    const { getSession } = await import("@/lib/auth/session");
    vi.mocked(getSession).mockResolvedValue(ownerSession);
    vi.mocked(mockPrisma.reservation.findMany).mockResolvedValue([]);

    const { getReservationsReportForExport } = await import("@/lib/actions/reports");
    await getReservationsReportForExport({});

    expect(mockPrisma.reservation.count).not.toHaveBeenCalled();
  });

  it("filtra por propertyId, status, startDate, endDate", async () => {
    const { getSession } = await import("@/lib/auth/session");
    vi.mocked(getSession).mockResolvedValue(ownerSession);
    vi.mocked(mockPrisma.reservation.findMany).mockResolvedValue([]);

    const startDate = new Date("2026-01-01");
    const endDate = new Date("2026-01-31");

    const { getReservationsReportForExport } = await import("@/lib/actions/reports");
    await getReservationsReportForExport({
      propertyId: "prop-1",
      status: "CONFIRMED",
      startDate,
      endDate,
    });

    const callArgs = vi.mocked(mockPrisma.reservation.findMany).mock.calls[0][0];
    expect(callArgs.where).toMatchObject({
      userId: "owner-1",
      propertyId: "prop-1",
      status: "CONFIRMED",
      startDate: { gte: startDate },
      endDate: { lte: endDate },
    });
  });
});

describe("getReservationsReport (paginated)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sin sesión → retorna []", async () => {
    const { getSession } = await import("@/lib/auth/session");
    vi.mocked(getSession).mockResolvedValue(null);

    const { getReservationsReport } = await import("@/lib/actions/reports");
    const result = await getReservationsReport({}, { page: 1, limit: 20 });

    expect(result).toEqual([]);
  });

  it("defaults page=1, limit=50", async () => {
    const { getSession } = await import("@/lib/auth/session");
    vi.mocked(getSession).mockResolvedValue(ownerSession);
    vi.mocked(mockPrisma.reservation.count).mockResolvedValue(0);
    vi.mocked(mockPrisma.reservation.findMany).mockResolvedValue([]);

    const { getReservationsReport } = await import("@/lib/actions/reports");
    await getReservationsReport({});

    const countCall = vi.mocked(mockPrisma.reservation.count).mock.calls[0][0];
    expect(countCall.where).toMatchObject({ userId: "owner-1" });

    const findManyCall = vi.mocked(mockPrisma.reservation.findMany).mock.calls[0][0];
    expect(findManyCall.skip).toBe(0);
    expect(findManyCall.take).toBe(50);
  });

  it("count y findMany se llaman en paralelo (Promise.all)", async () => {
    const { getSession } = await import("@/lib/auth/session");
    vi.mocked(getSession).mockResolvedValue(ownerSession);
    vi.mocked(mockPrisma.reservation.count).mockResolvedValue(0);
    vi.mocked(mockPrisma.reservation.findMany).mockResolvedValue([]);

    const { getReservationsReport } = await import("@/lib/actions/reports");
    await getReservationsReport({}, { page: 2, limit: 10 });

    expect(mockPrisma.reservation.count).toHaveBeenCalledTimes(1);
    expect(mockPrisma.reservation.findMany).toHaveBeenCalledTimes(1);
  });

  it("aplica skip y take correctos en findMany", async () => {
    const { getSession } = await import("@/lib/auth/session");
    vi.mocked(getSession).mockResolvedValue(ownerSession);
    vi.mocked(mockPrisma.reservation.count).mockResolvedValue(100);
    vi.mocked(mockPrisma.reservation.findMany).mockResolvedValue([]);

    const { getReservationsReport } = await import("@/lib/actions/reports");
    await getReservationsReport({}, { page: 3, limit: 25 });

    const findManyCall = vi.mocked(mockPrisma.reservation.findMany).mock.calls[0][0];
    expect(findManyCall.skip).toBe(50); // (3-1) * 25
    expect(findManyCall.take).toBe(25);
  });

  it("retorna shape PaginatedResponse con data, total, page, totalPages", async () => {
    const { getSession } = await import("@/lib/auth/session");
    vi.mocked(getSession).mockResolvedValue(ownerSession);
    vi.mocked(mockPrisma.reservation.count).mockResolvedValue(55);
    vi.mocked(mockPrisma.reservation.findMany).mockResolvedValue([
      makeReservation("res-1"),
      makeReservation("res-2"),
    ]);

    const { getReservationsReport } = await import("@/lib/actions/reports");
    const result = await getReservationsReport({}, { page: 1, limit: 20 });

    expect(result).toHaveProperty("data");
    expect(result).toHaveProperty("total");
    expect(result).toHaveProperty("page");
    expect(result).toHaveProperty("totalPages");
    expect((result as any).total).toBe(55);
    expect((result as any).page).toBe(1);
    expect((result as any).totalPages).toBe(3);
    expect((result as any).data).toHaveLength(2);
  });

  it("totalPages se calcula correctamente con Math.ceil(total / limit)", async () => {
    const { getSession } = await import("@/lib/auth/session");
    vi.mocked(getSession).mockResolvedValue(ownerSession);
    vi.mocked(mockPrisma.reservation.count).mockResolvedValue(101);
    vi.mocked(mockPrisma.reservation.findMany).mockResolvedValue([]);

    const { getReservationsReport } = await import("@/lib/actions/reports");
    const result = await getReservationsReport({}, { page: 1, limit: 50 });

    expect((result as any).totalPages).toBe(3); // ceil(101/50) = 3
  });

  it("edge: total=0 → totalPages=0, data=[]", async () => {
    const { getSession } = await import("@/lib/auth/session");
    vi.mocked(getSession).mockResolvedValue(ownerSession);
    vi.mocked(mockPrisma.reservation.count).mockResolvedValue(0);
    vi.mocked(mockPrisma.reservation.findMany).mockResolvedValue([]);

    const { getReservationsReport } = await import("@/lib/actions/reports");
    const result = await getReservationsReport({}, { page: 1, limit: 50 });

    expect((result as any).totalPages).toBe(0);
    expect((result as any).data).toHaveLength(0);
  });

  it("filtros: propertyId, status, startDate, endDate se pasan al where", async () => {
    const { getSession } = await import("@/lib/auth/session");
    vi.mocked(getSession).mockResolvedValue(ownerSession);
    vi.mocked(mockPrisma.reservation.count).mockResolvedValue(0);
    vi.mocked(mockPrisma.reservation.findMany).mockResolvedValue([]);

    const startDate = new Date("2026-01-01");
    const endDate = new Date("2026-01-31");

    const { getReservationsReport } = await import("@/lib/actions/reports");
    await getReservationsReport(
      {
        propertyId: "prop-1",
        status: "PENDING",
        startDate,
        endDate,
      },
      { page: 1, limit: 20 }
    );

    const countCall = vi.mocked(mockPrisma.reservation.count).mock.calls[0][0];
    expect(countCall.where).toMatchObject({
      userId: "owner-1",
      propertyId: "prop-1",
      status: "PENDING",
      startDate: { gte: startDate },
      endDate: { lte: endDate },
    });
  });
});
