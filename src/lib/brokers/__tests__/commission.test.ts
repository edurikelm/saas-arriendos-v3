import { describe, it, expect } from "vitest";

import {
  buildBrokerCommissions,
  buildReservationCommissions,
  commissionForPayment,
  commissionForPayments,
  sumCommissions,
  type CommissionPaymentInput,
} from "../commission";

function payment(
  overrides: Partial<CommissionPaymentInput> = {},
): CommissionPaymentInput {
  return {
    paymentId: "pay-1",
    reservationId: "res-1",
    amount: 100_000,
    brokerId: "brk-1",
    brokerName: "Ana",
    commissionRate: 10,
    ...overrides,
  };
}

describe("commissionForPayment", () => {
  it("aplica la tasa como porcentaje, no como fracción", () => {
    // 10 significa 10%. Si se tratara como fracción el resultado sería 1.000.000.
    expect(commissionForPayment(100_000, 10)).toBe(10_000);
  });

  it("acepta tasas con dos decimales", () => {
    expect(commissionForPayment(450_000, 8.75)).toBe(39_375);
  });

  it("redondea al peso", () => {
    // 333.333 × 7% = 23.333,31
    expect(commissionForPayment(333_333, 7)).toBe(23_333);
    // 150.000 × 8,5% = 12.750 exacto; 150.001 × 8,5% = 12.750,085
    expect(commissionForPayment(150_001, 8.5)).toBe(12_750);
  });

  it("con tasa 0 devuelve 0, no null", () => {
    expect(commissionForPayment(500_000, 0)).toBe(0);
  });

  it("con monto 0 devuelve 0", () => {
    expect(commissionForPayment(0, 15)).toBe(0);
  });
});

describe("commissionForPayments", () => {
  it("suma los redondeos por pago, no redondea la suma", () => {
    // Tres cuotas de 33.333 al 7%: cada una redondea a 2.333 (2.333,31).
    // Sumar y redondear después daría 7.000 (99.999 × 7% = 6.999,93).
    const cuotas = [{ amount: 33_333 }, { amount: 33_333 }, { amount: 33_333 }];
    expect(commissionForPayments(cuotas, 7)).toBe(6_999);
  });

  it("sin pagos devuelve 0", () => {
    expect(commissionForPayments([], 12)).toBe(0);
  });
});

describe("buildBrokerCommissions", () => {
  it("agrupa por captador y cuenta reservas distintas", () => {
    const rows = buildBrokerCommissions([
      payment({ paymentId: "p1", reservationId: "res-1", amount: 200_000 }),
      payment({ paymentId: "p2", reservationId: "res-1", amount: 100_000 }),
      payment({ paymentId: "p3", reservationId: "res-2", amount: 300_000 }),
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0].brokerId).toBe("brk-1");
    expect(rows[0].collectedAmount).toBe(600_000);
    expect(rows[0].commission).toBe(60_000);
    expect(rows[0].paymentCount).toBe(3);
    expect(rows[0].reservationCount).toBe(2);
  });

  it("dos reservas del mismo captador con tasas distintas suman cada una con la suya", () => {
    // Es la razón por la que esto no puede ser un _sum de montos en SQL.
    const rows = buildBrokerCommissions([
      payment({ paymentId: "p1", reservationId: "res-1", amount: 100_000, commissionRate: 10 }),
      payment({ paymentId: "p2", reservationId: "res-2", amount: 100_000, commissionRate: 5 }),
    ]);

    expect(rows[0].collectedAmount).toBe(200_000);
    expect(rows[0].commission).toBe(15_000);
  });

  it("separa captadores y ordena por comisión descendente", () => {
    const rows = buildBrokerCommissions([
      payment({ paymentId: "p1", brokerId: "brk-1", brokerName: "Ana", amount: 100_000 }),
      payment({
        paymentId: "p2",
        reservationId: "res-2",
        brokerId: "brk-2",
        brokerName: "Beto",
        amount: 500_000,
      }),
    ]);

    expect(rows.map((r) => r.brokerName)).toEqual(["Beto", "Ana"]);
    expect(rows[0].commission).toBe(50_000);
    expect(rows[1].commission).toBe(10_000);
  });

  it("un captador con tasa 0 aparece con lo cobrado y comisión 0", () => {
    // No se esconde: el owner tiene que poder ver que registró 0%.
    const rows = buildBrokerCommissions([
      payment({ amount: 400_000, commissionRate: 0 }),
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0].collectedAmount).toBe(400_000);
    expect(rows[0].commission).toBe(0);
  });

  it("sin pagos devuelve lista vacía", () => {
    expect(buildBrokerCommissions([])).toEqual([]);
  });
});

describe("buildReservationCommissions", () => {
  it("agrupa por reserva y solo del captador pedido", () => {
    const rows = buildReservationCommissions(
      [
        payment({ paymentId: "p1", reservationId: "res-1", amount: 100_000 }),
        payment({ paymentId: "p2", reservationId: "res-1", amount: 100_000 }),
        payment({ paymentId: "p3", reservationId: "res-2", amount: 500_000 }),
        payment({
          paymentId: "p4",
          reservationId: "res-3",
          brokerId: "brk-2",
          brokerName: "Beto",
          amount: 900_000,
        }),
      ],
      "brk-1",
    );

    expect(rows.map((r) => r.reservationId)).toEqual(["res-2", "res-1"]);
    expect(rows[0].commission).toBe(50_000);
    expect(rows[1].collectedAmount).toBe(200_000);
    expect(rows[1].paymentCount).toBe(2);
  });

  it("un MONTHLY con dos de tres cuotas cobradas devenga dos", () => {
    // La tercera cuota está PENDING, así que la consulta no la trae.
    const rows = buildReservationCommissions(
      [
        payment({ paymentId: "p1", amount: 500_000, commissionRate: 6 }),
        payment({ paymentId: "p2", amount: 500_000, commissionRate: 6 }),
      ],
      "brk-1",
    );

    expect(rows[0].paymentCount).toBe(2);
    expect(rows[0].commission).toBe(60_000);
  });

  it("un captador sin pagos en el período devuelve lista vacía", () => {
    expect(buildReservationCommissions([payment()], "brk-9")).toEqual([]);
  });
});

describe("sumCommissions", () => {
  it("suma el total del bloque", () => {
    const rows = buildBrokerCommissions([
      payment({ paymentId: "p1", amount: 100_000 }),
      payment({
        paymentId: "p2",
        reservationId: "res-2",
        brokerId: "brk-2",
        brokerName: "Beto",
        amount: 200_000,
      }),
    ]);

    expect(sumCommissions(rows)).toBe(30_000);
  });

  it("sin filas devuelve 0", () => {
    expect(sumCommissions([])).toBe(0);
  });
});
