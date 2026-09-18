import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SessionUser } from "@/lib/auth/session";
import { Decimal } from "@prisma/client/runtime/client";

/**
 * `getBrokerCommissions` — el bloque de comisiones de `/reports` (ADR-0040 §7).
 *
 * Lo que fija: obedece al rango y a la propiedad del encabezado, lee `paidAt`
 * por su día de negocio, y no toca ninguna cifra de caja existente.
 */

const mockPrisma = vi.hoisted(() => ({
  payment: { findMany: vi.fn() },
  broker: { count: vi.fn() },
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth/session", () => ({ getSession: vi.fn() }));

import { getBrokerCommissions } from "../reports";

const mockSession: SessionUser = {
  userId: "user-1",
  role: "OWNER",
  plan: "PRO",
  email: "test@test.com",
};

const SEPTIEMBRE = { rangeStartKey: "2026-09-01", rangeEndKey: "2026-09-30" };

function paymentRow({
  id = "pay-1",
  amount = 100_000,
  paidAt = new Date("2026-09-10T15:00:00Z"),
  reservationId = "res-1",
  commissionRate = 10,
  broker = { id: "brk-1", name: "Ana Rojas" } as { id: string; name: string } | null,
  clientName = "Juan Pérez",
} = {}) {
  return {
    id,
    amount: new Decimal(String(amount)),
    paidAt,
    reservation: {
      id: reservationId,
      commissionRate: commissionRate === null ? null : new Decimal(String(commissionRate)),
      startDate: new Date("2026-09-05T15:00:00Z"),
      endDate: new Date("2026-09-12T15:00:00Z"),
      broker,
      client: { name: clientName },
      property: { name: "Departamento Centro" },
    },
  };
}

beforeEach(async () => {
  vi.clearAllMocks();
  const { getSession } = await import("@/lib/auth/session");
  vi.mocked(getSession).mockResolvedValue(mockSession);
  mockPrisma.broker.count.mockResolvedValue(2);
});

describe("getBrokerCommissions", () => {
  it("agrupa por captador y devuelve el total del período", async () => {
    mockPrisma.payment.findMany.mockResolvedValue([
      paymentRow({ id: "p1", amount: 300_000, commissionRate: 8.5 }),
      paymentRow({
        id: "p2",
        reservationId: "res-2",
        amount: 500_000,
        commissionRate: 10,
        broker: { id: "brk-2", name: "Beto Sanhueza" },
        clientName: "María García",
      }),
    ]);

    const result = await getBrokerCommissions(SEPTIEMBRE);

    expect(result?.brokers.map((b) => b.brokerName)).toEqual(["Beto Sanhueza", "Ana Rojas"]);
    // 300.000 × 8,5% = 25.500 ; 500.000 × 10% = 50.000
    expect(result?.totalCommission).toBe(75_500);
    expect(result?.totalCollected).toBe(800_000);
  });

  it("trae el detalle por reserva de cada captador, legible sin abrir otra pantalla", async () => {
    mockPrisma.payment.findMany.mockResolvedValue([
      paymentRow({ id: "p1", amount: 200_000 }),
      paymentRow({ id: "p2", amount: 100_000 }),
    ]);

    const result = await getBrokerCommissions(SEPTIEMBRE);
    const detail = result?.reservationsByBroker["brk-1"];

    expect(detail).toHaveLength(1);
    expect(detail?.[0]).toMatchObject({
      reservationId: "res-1",
      clientName: "Juan Pérez",
      propertyName: "Departamento Centro",
      startDateKey: "2026-09-05",
      paymentCount: 2,
      commission: 30_000,
    });
  });

  it("filtra por la propiedad del encabezado", async () => {
    mockPrisma.payment.findMany.mockResolvedValue([]);

    await getBrokerCommissions({ ...SEPTIEMBRE, propertyId: "prop-9" });

    const where = mockPrisma.payment.findMany.mock.calls[0][0].where;
    expect(where.reservation.propertyId).toBe("prop-9");
    expect(where.reservation.userId).toBe("user-1");
  });

  it("un pago de las 22:30 de Santiago entra en su día, no en el siguiente día UTC", async () => {
    mockPrisma.payment.findMany.mockResolvedValue([
      paymentRow({ paidAt: new Date("2026-09-18T01:30:00Z"), amount: 100_000 }),
    ]);

    const dentro = await getBrokerCommissions({
      rangeStartKey: "2026-09-01",
      rangeEndKey: "2026-09-17",
    });
    const fuera = await getBrokerCommissions({
      rangeStartKey: "2026-09-18",
      rangeEndKey: "2026-09-30",
    });

    expect(dentro?.totalCommission).toBe(10_000);
    expect(fuera?.totalCommission).toBe(0);
  });

  it("sin captadores registrados avisa que el bloque no va", async () => {
    mockPrisma.broker.count.mockResolvedValue(0);
    mockPrisma.payment.findMany.mockResolvedValue([]);

    const result = await getBrokerCommissions(SEPTIEMBRE);

    expect(result?.hasAnyBroker).toBe(false);
    expect(result?.brokers).toEqual([]);
  });

  it("con captadores y sin cobros del período el bloque sí va, vacío", async () => {
    mockPrisma.broker.count.mockResolvedValue(3);
    mockPrisma.payment.findMany.mockResolvedValue([]);

    const result = await getBrokerCommissions(SEPTIEMBRE);

    expect(result?.hasAnyBroker).toBe(true);
    expect(result?.totalCommission).toBe(0);
  });

  it("rechaza un rango con una fecha que no existe", async () => {
    const result = await getBrokerCommissions({
      rangeStartKey: "2026-02-30",
      rangeEndKey: "2026-03-31",
    });

    expect(result).toBe(null);
    expect(mockPrisma.payment.findMany).not.toHaveBeenCalled();
  });

  it("sin sesión no consulta nada", async () => {
    const { getSession } = await import("@/lib/auth/session");
    vi.mocked(getSession).mockResolvedValue(null);

    expect(await getBrokerCommissions(SEPTIEMBRE)).toBe(null);
    expect(mockPrisma.payment.findMany).not.toHaveBeenCalled();
  });
});
