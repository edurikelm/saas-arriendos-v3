import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { SessionUser } from "@/lib/auth/session";
import { Decimal } from "@prisma/client/runtime/client";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    reservation: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/auth/session", () => ({
  getSession: vi.fn(),
}));

const ownerSession: SessionUser = {
  userId: "owner-1",
  role: "OWNER",
  plan: "PRO",
  email: "owner@test.com",
};

describe("getOutstandingSnapshot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("devuelve null sin sesión, sin consultar la base", async () => {
    const { getSession } = await import("@/lib/auth/session");
    const { prisma } = await import("@/lib/db/prisma");

    vi.mocked(getSession).mockResolvedValue(null);

    const { getOutstandingSnapshot } = await import("@/lib/actions/reports");
    const result = await getOutstandingSnapshot();

    expect(result).toBeNull();
    expect(prisma.reservation.findMany).not.toHaveBeenCalled();
  });

  it("agrega tramos de antigüedad y top deudores SOLO (nunca las filas) sobre el conjunto completo", async () => {
    const { getSession } = await import("@/lib/auth/session");
    const { prisma } = await import("@/lib/db/prisma");

    vi.mocked(getSession).mockResolvedValue(ownerSession);
    vi.setSystemTime(new Date("2026-01-15T12:00:00.000Z"));

    // 2 reservas vencidas de un mismo cliente (deben consolidarse en un solo
    // top debtor) + 1 reserva sin deuda (no debe aportar a ningún agregado).
    const reservations = [
      {
        id: "res-1",
        propertyId: "prop-1",
        clientId: "cli-1",
        billingType: "DAILY" as const,
        status: "CONFIRMED" as const,
        startDate: new Date("2025-12-01T00:00:00.000Z"), // vencida hace >30 días
        totalPrice: new Decimal("100000"),
        property: { name: "Edificio Centro" },
        client: { name: "Ana Perez" },
        payments: [],
      },
      {
        id: "res-2",
        propertyId: "prop-1",
        clientId: "cli-1",
        billingType: "DAILY" as const,
        status: "CONFIRMED" as const,
        startDate: new Date("2025-12-20T00:00:00.000Z"), // vencida, tramo 1-30
        totalPrice: new Decimal("50000"),
        property: { name: "Edificio Centro" },
        client: { name: "Ana Perez" },
        payments: [],
      },
      {
        id: "res-3",
        propertyId: "prop-2",
        clientId: "cli-2",
        billingType: "DAILY" as const,
        status: "COMPLETED" as const,
        startDate: new Date("2025-11-01T00:00:00.000Z"),
        totalPrice: new Decimal("80000"),
        property: { name: "Depto Sur" },
        client: { name: "Bruno Diaz" },
        payments: [
          { amount: new Decimal("80000"), status: "COMPLETED", paymentType: "RESERVATION", dueDate: null, deletedAt: null },
        ],
      },
    ];

    vi.mocked(prisma.reservation.findMany).mockResolvedValue(reservations as never);

    const { getOutstandingSnapshot } = await import("@/lib/actions/reports");
    const result = await getOutstandingSnapshot();

    expect(result).not.toBeNull();
    // Sin sesión ya se probó arriba; acá siempre hay resultado.
    if (!result) throw new Error("unreachable");

    // Solo un cliente con deuda activa: ambas reservas de cli-1 se consolidan.
    expect(result.topDebtors).toHaveLength(1);
    expect(result.topDebtors[0].clientId).toBe("cli-1");
    expect(result.topDebtors[0].amount).toBe(150000);

    // Tramos: res-1 (46 días de atraso → 31-60), res-2 (26 días → 1-30).
    const overdue1to30 = result.aging.buckets.find((b) => b.key === "OVERDUE_1_30");
    const overdue31to60 = result.aging.buckets.find((b) => b.key === "OVERDUE_31_60");
    expect(overdue1to30?.amount).toBe(50000);
    expect(overdue31to60?.amount).toBe(100000);
    expect(result.aging.totalOverdue).toBe(150000);

    expect(result.totals.totalToCollect).toBe(150000);
    expect(result.totals.totalOverdue).toBe(150000);

    // La respuesta nunca expone filas individuales — solo agregados.
    expect(result).not.toHaveProperty("data");
    expect(result).not.toHaveProperty("rows");
  });

  it("aplica el filtro propertyId a la consulta de reservas en scope del owner", async () => {
    const { getSession } = await import("@/lib/auth/session");
    const { prisma } = await import("@/lib/db/prisma");

    vi.mocked(getSession).mockResolvedValue(ownerSession);
    vi.mocked(prisma.reservation.findMany).mockResolvedValue([]);

    const { getOutstandingSnapshot } = await import("@/lib/actions/reports");
    await getOutstandingSnapshot({ propertyId: "prop-1" });

    const call = vi.mocked(prisma.reservation.findMany).mock.calls[0][0];
    const where = call?.where as { userId: string; propertyId?: string; status: unknown };
    expect(where.userId).toBe("owner-1");
    expect(where.propertyId).toBe("prop-1");
    expect(where.status).toEqual({ not: "CANCELLED" });
  });

  it(
    "agrega `totals` sobre TODO el conjunto activo, no un subconjunto — " +
      "invariante migrada desde `getCollectionReport` (ADR-0028 §3): la sección " +
      "de deuda de /reports ya no pagina, así que el bug original (KPIs sobre " +
      "solo una página) no puede reaparecer aquí por construcción, pero el " +
      "escenario de muchas filas se conserva como regresión.",
    async () => {
      const { getSession } = await import("@/lib/auth/session");
      const { prisma } = await import("@/lib/db/prisma");

      vi.mocked(getSession).mockResolvedValue(ownerSession);

      // 25 reservas activas con deuda, cada una de un cliente distinto —
      // suficientes para haber cruzado cualquier límite de página que
      // `getCollectionReport` aplicaba (10 por página).
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

      const { getOutstandingSnapshot } = await import("@/lib/actions/reports");
      const result = await getOutstandingSnapshot();
      if (!result) throw new Error("unreachable");

      // 25 reservas × 100.000 de deuda cada una = 2.500.000 — la suma de
      // TODAS las filas, no solo una porción.
      expect(result.totals.totalToCollect).toBe(2_500_000);
    },
  );

  it("usa el mismo `now` para aging y topDebtors — no depende del reloj del cliente", async () => {
    const { getSession } = await import("@/lib/auth/session");
    const { prisma } = await import("@/lib/db/prisma");

    vi.mocked(getSession).mockResolvedValue(ownerSession);
    vi.setSystemTime(new Date("2026-06-01T12:00:00.000Z"));

    const reservations = [
      {
        id: "res-1",
        propertyId: "prop-1",
        clientId: "cli-1",
        billingType: "DAILY" as const,
        status: "CONFIRMED" as const,
        startDate: new Date("2026-05-01T00:00:00.000Z"), // 31 días de atraso desde el `now` fijado arriba
        totalPrice: new Decimal("100000"),
        property: { name: "Edificio Centro" },
        client: { name: "Ana Perez" },
        payments: [],
      },
    ];
    vi.mocked(prisma.reservation.findMany).mockResolvedValue(reservations as never);

    const { getOutstandingSnapshot } = await import("@/lib/actions/reports");
    const result = await getOutstandingSnapshot();
    if (!result) throw new Error("unreachable");

    // daysOverdue del top debtor y el tramo de aging deben coincidir con el
    // mismo `now` del servidor (31 días → tramo 31-60, no 1-30).
    expect(result.topDebtors[0].daysOverdue).toBe(31);
    const overdue31to60 = result.aging.buckets.find((b) => b.key === "OVERDUE_31_60");
    expect(overdue31to60?.amount).toBe(100000);
  });
});
