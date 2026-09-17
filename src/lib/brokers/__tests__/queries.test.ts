import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Mock del adapter de Prisma, mismo patrón que
 * `src/lib/payments/__tests__/queries.test.ts`: `vi.mock` se eleva al top del
 * archivo, así que los mocks se declaran con `vi.hoisted`.
 *
 * Nada de esto toca la base: `.env` de este repo apunta a producción.
 */
const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  findUnique: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    payment: { findMany: mocks.findMany },
    reservation: { findUnique: mocks.findUnique },
  },
}));

import { getDateKeyInTz } from "@/lib/domain/timezone";
import {
  getBrokerCommissionsForOwner,
  getCommissionForReservation,
  getCommissionPaymentsForOwner,
  getReservationCommissionsForBroker,
} from "../queries";

const SEPTIEMBRE = { rangeStartKey: "2026-09-01", rangeEndKey: "2026-09-30" };

/** Fila como la devuelve el `select` de `getCommissionPaymentsForOwner`. */
function row({
  id = "pay-1",
  amount = 100_000,
  paidAt = new Date("2026-09-10T15:00:00Z"),
  reservationId = "res-1",
  commissionRate = 10 as number | null,
  broker = { id: "brk-1", name: "Ana" } as { id: string; name: string } | null,
} = {}) {
  return {
    id,
    amount,
    paidAt,
    reservation: { id: reservationId, commissionRate, broker },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getCommissionPaymentsForOwner — predicado", () => {
  it("pide solo pagos COMPLETED + RESERVATION, no borrados y con paidAt", () => {
    mocks.findMany.mockResolvedValue([]);

    return getCommissionPaymentsForOwner("user-1", SEPTIEMBRE).then(() => {
      const where = mocks.findMany.mock.calls[0][0].where;

      expect(where.status).toBe("COMPLETED");
      expect(where.paymentType).toBe("RESERVATION");
      expect(where.deletedAt).toBe(null);
      expect(where.paidAt).toEqual({ not: null });
    });
  });

  it("pide solo reservas del owner, con captador y con tasa", () => {
    mocks.findMany.mockResolvedValue([]);

    return getCommissionPaymentsForOwner("user-1", SEPTIEMBRE).then(() => {
      const reservation = mocks.findMany.mock.calls[0][0].where.reservation;

      expect(reservation.userId).toBe("user-1");
      expect(reservation.brokerId).toEqual({ not: null });
      expect(reservation.commissionRate).toEqual({ not: null });
      expect(reservation.propertyId).toBeUndefined();
    });
  });

  it("filtra por propiedad cuando el encabezado la trae", () => {
    mocks.findMany.mockResolvedValue([]);

    return getCommissionPaymentsForOwner("user-1", {
      ...SEPTIEMBRE,
      propertyId: "prop-9",
    }).then(() => {
      expect(mocks.findMany.mock.calls[0][0].where.reservation.propertyId).toBe(
        "prop-9",
      );
    });
  });

  it("NO filtra el rango en SQL: el día de negocio se decide en JS", () => {
    mocks.findMany.mockResolvedValue([]);

    return getCommissionPaymentsForOwner("user-1", SEPTIEMBRE).then(() => {
      // Si hubiera un gte/lte de paidAt acá, el pago de las 22:30 se perdería
      // antes de que `isPaidAtInRange` pueda leerlo en Santiago.
      expect(mocks.findMany.mock.calls[0][0].where.paidAt).toEqual({ not: null });
    });
  });
});

describe("getCommissionPaymentsForOwner — rango por día de negocio", () => {
  it("un pago de las 22:30 de Santiago cuenta en su día, no en el siguiente día UTC", async () => {
    // 2026-09-17 22:30 en Santiago (UTC-3 en septiembre) = 2026-09-18T01:30Z.
    const paidAt = new Date("2026-09-18T01:30:00Z");
    expect(getDateKeyInTz(paidAt)).toBe("2026-09-17");

    mocks.findMany.mockResolvedValue([row({ paidAt })]);

    const rows = await getCommissionPaymentsForOwner("user-1", {
      rangeStartKey: "2026-09-01",
      rangeEndKey: "2026-09-17",
    });

    expect(rows).toHaveLength(1);
  });

  it("ese mismo pago NO cuenta en un rango que empieza el 18", async () => {
    mocks.findMany.mockResolvedValue([
      row({ paidAt: new Date("2026-09-18T01:30:00Z") }),
    ]);

    const rows = await getCommissionPaymentsForOwner("user-1", {
      rangeStartKey: "2026-09-18",
      rangeEndKey: "2026-09-30",
    });

    expect(rows).toEqual([]);
  });

  it("descarta los pagos fuera del período", async () => {
    mocks.findMany.mockResolvedValue([
      row({ id: "dentro", paidAt: new Date("2026-09-10T15:00:00Z") }),
      row({ id: "antes", paidAt: new Date("2026-08-31T15:00:00Z") }),
      row({ id: "despues", paidAt: new Date("2026-10-01T15:00:00Z") }),
    ]);

    const rows = await getCommissionPaymentsForOwner("user-1", SEPTIEMBRE);

    expect(rows.map((r) => r.paymentId)).toEqual(["dentro"]);
  });
});

describe("getCommissionPaymentsForOwner — mapeo", () => {
  it("convierte los Decimal de Prisma a números", async () => {
    // Prisma devuelve Decimal, no number. Si el mapeo se cayera, la comisión
    // saldría NaN o concatenada como string.
    const decimal = (value: string) => ({
      toString: () => value,
      valueOf: () => value,
    });

    mocks.findMany.mockResolvedValue([
      row({
        amount: decimal("450000") as unknown as number,
        commissionRate: decimal("8.75") as unknown as number,
      }),
    ]);

    const rows = await getCommissionPaymentsForOwner("user-1", SEPTIEMBRE);

    expect(rows[0].amount).toBe(450_000);
    expect(rows[0].commissionRate).toBe(8.75);
  });

  it("salta una fila sin captador en vez de reventar", async () => {
    mocks.findMany.mockResolvedValue([row({ broker: null })]);

    const rows = await getCommissionPaymentsForOwner("user-1", SEPTIEMBRE);

    expect(rows).toEqual([]);
  });

  it("salta una fila con captador y sin tasa", async () => {
    mocks.findMany.mockResolvedValue([row({ commissionRate: null })]);

    const rows = await getCommissionPaymentsForOwner("user-1", SEPTIEMBRE);

    expect(rows).toEqual([]);
  });
});

describe("getBrokerCommissionsForOwner", () => {
  it("agrega por captador con la tasa de cada reserva", async () => {
    mocks.findMany.mockResolvedValue([
      row({ id: "p1", reservationId: "res-1", amount: 100_000, commissionRate: 10 }),
      row({ id: "p2", reservationId: "res-2", amount: 200_000, commissionRate: 5 }),
      row({
        id: "p3",
        reservationId: "res-3",
        amount: 600_000,
        commissionRate: 10,
        broker: { id: "brk-2", name: "Beto" },
      }),
    ]);

    const rows = await getBrokerCommissionsForOwner("user-1", SEPTIEMBRE);

    expect(rows.map((r) => r.brokerName)).toEqual(["Beto", "Ana"]);
    expect(rows[1].commission).toBe(20_000);
    expect(rows[1].reservationCount).toBe(2);
  });
});

describe("getReservationCommissionsForBroker", () => {
  it("devuelve solo las reservas del captador pedido", async () => {
    mocks.findMany.mockResolvedValue([
      row({ id: "p1", reservationId: "res-1", amount: 100_000 }),
      row({
        id: "p2",
        reservationId: "res-2",
        amount: 900_000,
        broker: { id: "brk-2", name: "Beto" },
      }),
    ]);

    const rows = await getReservationCommissionsForBroker(
      "user-1",
      "brk-1",
      SEPTIEMBRE,
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].reservationId).toBe("res-1");
    expect(rows[0].commission).toBe(10_000);
  });
});

describe("getCommissionForReservation", () => {
  it("suma el histórico completo de la reserva, sin filtro de período", async () => {
    mocks.findUnique.mockResolvedValue({
      brokerId: "brk-1",
      commissionRate: 6,
      payments: [{ amount: 500_000 }, { amount: 500_000 }],
    });

    expect(await getCommissionForReservation("res-1")).toBe(60_000);
  });

  it("devuelve 0 en una reserva sin captador", async () => {
    mocks.findUnique.mockResolvedValue({
      brokerId: null,
      commissionRate: null,
      payments: [{ amount: 800_000 }],
    });

    expect(await getCommissionForReservation("res-1")).toBe(0);
  });

  it("devuelve 0 si la reserva no existe", async () => {
    mocks.findUnique.mockResolvedValue(null);

    expect(await getCommissionForReservation("no-existe")).toBe(0);
  });

  it("pide solo los pagos que comisionan", async () => {
    mocks.findUnique.mockResolvedValue({
      brokerId: "brk-1",
      commissionRate: 10,
      payments: [],
    });

    await getCommissionForReservation("res-1");

    const where = mocks.findUnique.mock.calls[0][0].select.payments.where;
    expect(where).toEqual({
      status: "COMPLETED",
      paymentType: "RESERVATION",
      deletedAt: null,
    });
  });
});
