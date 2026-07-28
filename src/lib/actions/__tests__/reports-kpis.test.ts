import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SessionUser } from "@/lib/auth/session";
import { Decimal } from "@prisma/client/runtime/client";
import { isReportsRangeAllowed } from "@/lib/reports/kpis";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    payment: { findMany: vi.fn(), aggregate: vi.fn(), groupBy: vi.fn() },
    $queryRaw: vi.fn(),
    reservation: { findMany: vi.fn(), count: vi.fn() },
    property: { count: vi.fn(), findMany: vi.fn() },
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

describe("KPI: Ingresos cobrados — propertyId filter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("getRevenueReport filtra por propertyId cuando se pasa la opción", async () => {
    const { getSession } = await import("@/lib/auth/session");
    const { prisma } = await import("@/lib/db/prisma");

    vi.mocked(getSession).mockResolvedValue(ownerSession);
    vi.mocked(prisma.payment.findMany).mockResolvedValue([]);

    const { getRevenueReport } = await import("@/lib/actions/reports");
    await getRevenueReport({ year: 2026, propertyId: "prop-1" });

    // Verificar que propertyId se filtra vía reservation.propertyId
    const call = vi.mocked(prisma.payment.findMany).mock.calls[0][0];
    const where = call?.where as { reservation: { userId: string; propertyId?: string } };
    expect(where.reservation).toEqual(expect.objectContaining({ userId: "owner-1", propertyId: "prop-1" }));
  });

  it("getRevenueReport aplica todos los filtros juntos: status COMPLETED, paymentType RESERVATION, deletedAt null, paidAt en rango, propertyId", async () => {
    const { getSession } = await import("@/lib/auth/session");
    const { prisma } = await import("@/lib/db/prisma");

    vi.mocked(getSession).mockResolvedValue(ownerSession);
    vi.mocked(prisma.payment.findMany).mockResolvedValue([]);

    const { getRevenueReport } = await import("@/lib/actions/reports");
    await getRevenueReport({
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-01-31"),
      propertyId: "prop-1",
    });

    const call = vi.mocked(prisma.payment.findMany).mock.calls[0][0];
    const where = call?.where as Record<string, unknown>;

    // Filtro de sesión
    expect((where.reservation as Record<string, unknown>).userId).toBe("owner-1");
    expect((where.reservation as Record<string, unknown>).propertyId).toBe("prop-1");

    // Filtros financieros
    expect(where.status).toBe("COMPLETED");
    expect(where.paymentType).toBe("RESERVATION");
    expect(where.deletedAt).toBeNull();

    // Filtro de rango por paidAt (cash basis)
    expect(where.paidAt).toEqual({ gte: new Date("2026-01-01"), lte: new Date("2026-01-31") });
  });
});

describe("KPI: Ocupación del portafolio — clipping + unitsBooked", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("calcula night-units con intersección inclusiva del rango", async () => {
    // Reserva: 15-20 Ene (6 noches), rango: 18-25 Ene (8 días)
    // Intersección inclusiva: 18, 19, 20 = 3 noches
    const { getSession } = await import("@/lib/auth/session");
    const { prisma } = await import("@/lib/db/prisma");

    vi.mocked(getSession).mockResolvedValue(ownerSession);
    vi.mocked(prisma.reservation.findMany).mockResolvedValue([
      {
        id: "res-1",
        propertyId: "prop-1",
        startDate: new Date("2026-01-15T00:00:00.000Z"),
        endDate: new Date("2026-01-20T00:00:00.000Z"),
        unitsBooked: 2,
        totalPrice: new Decimal("300000"),
        status: "CONFIRMED",
        property: { name: "Edificio Centro", unitsAvailable: 5 },
      },
    ] as never);

    const { getOccupancyReport } = await import("@/lib/actions/reports");
    const result = await getOccupancyReport({
      propertyId: "prop-1",
      startDate: new Date("2026-01-18T00:00:00.000Z"),
      endDate: new Date("2026-01-25T00:00:00.000Z"),
    });

    // La intersección de [15-20] con [18-25] es [18-20] = 3 noches
    // unitsBooked = 2, entonces 3 noches * 2 = 6 night-units
    expect(result[0].totalNights).toBe(6);
  });

  it("excluye reservas CANCELLED del cálculo de ocupación", async () => {
    // Verificar que la query filtra CANCELLED en el where
    const { getSession } = await import("@/lib/auth/session");
    const { prisma } = await import("@/lib/db/prisma");

    vi.mocked(getSession).mockResolvedValue(ownerSession);
    vi.mocked(prisma.reservation.findMany).mockResolvedValue([]);

    const { getOccupancyReport } = await import("@/lib/actions/reports");
    await getOccupancyReport({
      startDate: new Date("2026-01-01T00:00:00.000Z"),
      endDate: new Date("2026-01-31T00:00:00.000Z"),
    });

    // Verificar que el where tiene status: { not: "CANCELLED" }
    const call = vi.mocked(prisma.reservation.findMany).mock.calls[0][0];
    const where = call?.where as { status: unknown; startDate: unknown; endDate: unknown };
    expect(where.status).toEqual({ not: "CANCELLED" });
  });

  it("getOccupancyReport usa intersección: startDate <= rangeEnd AND endDate >= rangeStart", async () => {
    const { getSession } = await import("@/lib/auth/session");
    const { prisma } = await import("@/lib/db/prisma");

    vi.mocked(getSession).mockResolvedValue(ownerSession);
    vi.mocked(prisma.reservation.findMany).mockResolvedValue([]);

    const { getOccupancyReport } = await import("@/lib/actions/reports");
    const rangeStart = new Date("2026-01-01");
    const rangeEnd = new Date("2026-01-31");

    await getOccupancyReport({ startDate: rangeStart, endDate: rangeEnd });

    const call = vi.mocked(prisma.reservation.findMany).mock.calls[0][0];
    const where = call?.where as { startDate: unknown; endDate: unknown };

    // Intersección: la reserva debe solaparse con el rango
    expect(where.startDate).toEqual({ lte: rangeEnd }); // startDate <= rangeEnd
    expect(where.endDate).toEqual({ gte: rangeStart }); // endDate >= rangeStart
  });
});

describe("portfolioOccupancyDenominator — usa todas las propiedades, no solo las con reservas", () => {
  it("denominador incluye propiedades sin reservas en el período (portfolio)", async () => {
    const { portfolioOccupancyDenominator } = await import("@/lib/reports/kpis");

    const allProperties = [
      { id: "prop-1", unitsAvailable: 3 }, // tiene reservas
      { id: "prop-2", unitsAvailable: 5 }, // NO tiene reservas
      { id: "prop-3", unitsAvailable: 2 }, // NO tiene reservas
    ];

    // Portfolio (all): debe sumar las 10 unidades, no solo las 3 de prop-1
    const portfolioDenom = portfolioOccupancyDenominator(allProperties, "all");
    expect(portfolioDenom).toBe(10); // 3 + 5 + 2

    // Property específica: solo esa propiedad
    const prop1Denom = portfolioOccupancyDenominator(allProperties, "prop-1");
    expect(prop1Denom).toBe(3);

    const prop2Denom = portfolioOccupancyDenominator(allProperties, "prop-2");
    expect(prop2Denom).toBe(5);
  });

  it("portfolioOccupancyDenominator: array vacío retorna 0 (el caller usa Math.max con 1)", async () => {
    const { portfolioOccupancyDenominator } = await import("@/lib/reports/kpis");
    // El reduce de array vacío con acc=0 retorna 0. El cliente hace Math.max(totalUnitsInScope, 1).
    const denom = portfolioOccupancyDenominator([], "all");
    expect(denom).toBe(0);
  });
});

describe("getCollectionReport — totales agregan TODO el conjunto filtrado", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("getCollectionReport devuelve total que representa TODAS las filas, no solo la página", async () => {
    const { getSession } = await import("@/lib/auth/session");
    const { prisma } = await import("@/lib/db/prisma");

    vi.mocked(getSession).mockResolvedValue(ownerSession);

    // Crear 25 reservas que generan 25 filas de colección
    const reservations = Array.from({ length: 25 }, (_, i) => ({
      id: `res-${i}`,
      propertyId: "prop-1",
      clientId: `cli-${i}`,
      billingType: "DAILY" as const,
      status: "CONFIRMED" as const,
      startDate: new Date("2026-01-01T00:00:00.000Z"),
      totalPrice: new Decimal("100000"),
      property: { name: "Propiedad 1" },
      client: { name: `Cliente ${i}` },
      payments: [],
    }));

    vi.mocked(prisma.reservation.findMany).mockResolvedValue(reservations as never);

    const { getCollectionReport } = await import("@/lib/actions/reports");
    const result = await getCollectionReport({ limit: 10, page: 1 });

    // El total DEBE ser 25 (todas las filas), no 10 (la página)
    expect(result).toHaveProperty("total");
    expect((result as { total: number }).total).toBe(25);
    // Y data solo tiene la primera página
    expect((result as { data: unknown[] }).data.length).toBe(10);
    // Y totals existe con los valores correctos
    expect(result).toHaveProperty("totals");
    const totals = (result as { totals: { totalToCollect: number } }).totals;
    expect(totals.totalToCollect).toBeGreaterThan(0);
  });
});

describe("FREE plan — bloquea rango para no-current_month", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("isReportsRangeAllowed: FREE permite solo current_month", () => {
    const freeRanges = ["prev_month", "last_3", "last_6", "year_to_date", "custom"] as const;
    for (const range of freeRanges) {
      expect(isReportsRangeAllowed("FREE", range)).toBe(false);
    }
    expect(isReportsRangeAllowed("FREE", "current_month")).toBe(true);
  });

  it("isReportsRangeAllowed: PRO permite todos los rangos", () => {
    const allRanges = ["current_month", "prev_month", "last_3", "last_6", "year_to_date", "custom"] as const;
    for (const range of allRanges) {
      expect(isReportsRangeAllowed("PRO", range)).toBe(true);
    }
  });

  it("isReportsRangeAllowed: null/undefined plan se trata como no-FREE", () => {
    expect(isReportsRangeAllowed(null, "current_month")).toBe(true);
    expect(isReportsRangeAllowed(undefined, "year_to_date")).toBe(true);
  });
});
