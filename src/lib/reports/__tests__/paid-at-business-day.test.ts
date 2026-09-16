/**
 * `paidAt` entra al rango de caja por su DÍA DE NEGOCIO en Santiago (ADR-0038).
 *
 * `paidAt` es un instante. Entre las 20:00 y las 23:59 de Santiago ya es el día
 * siguiente en UTC, así que comparar por día UTC (lo que se hacía antes) lo
 * contaba en un mes para `collectedCash` y en otro para la serie mensual.
 *
 * Cada instante se escribe en UTC con su hora de Santiago al lado, y cada
 * aserción de día se ancla con `getDateKeyInTz`: si el fixture estuviera mal
 * calculado, el test falla ahí y no en el código.
 */

import { afterEach, describe, expect, it } from "vitest";
import {
  buildDecisionSummary,
  type DecisionReservationInput,
  type ReportDecisionSummary,
} from "@/lib/reports/decision-summary";
import { isPaidAtInRange } from "@/lib/reports/revenue-series";
import { dateOnlyFromKey, getDateKeyInTz } from "@/lib/domain/timezone";

type Method = "MERCADO_PAGO" | "CASH" | "TRANSFER";

let seq = 0;

function reservation(
  payments: Array<{ paidAt: string; amount: number; method?: Method }>,
  overrides: Partial<DecisionReservationInput> = {},
): DecisionReservationInput {
  seq += 1;
  return {
    id: `res-${seq}`,
    propertyId: "prop-1",
    billingType: "DAILY",
    status: "CONFIRMED",
    startDate: new Date("2026-01-10T15:00:00.000Z"),
    endDate: new Date("2026-01-12T15:00:00.000Z"),
    totalPrice: 10_000_000,
    unitsBooked: 1,
    ...overrides,
    payments: payments.map((p, i) => ({
      id: `pay-${seq}-${i}`,
      amount: p.amount,
      status: "COMPLETED",
      paymentType: "RESERVATION",
      method: p.method ?? "MERCADO_PAGO",
      paidAt: new Date(p.paidAt),
      deletedAt: null,
      dueDate: null,
    })),
  };
}

const PROPERTIES = [
  { id: "prop-1", name: "Cabaña 1", unitsAvailable: 1 },
  { id: "prop-2", name: "Cabaña 2", unitsAvailable: 1 },
];

function summarize(
  reservations: DecisionReservationInput[],
  startKey: string,
  endKey: string,
): ReportDecisionSummary {
  return buildDecisionSummary({
    reservations,
    properties: PROPERTIES,
    rangeStart: dateOnlyFromKey(startKey),
    rangeEnd: dateOnlyFromKey(endKey),
  });
}

function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

/** Todas las formas de leer la caja del rango tienen que dar lo mismo. */
function expectCashReconciles(s: ReportDecisionSummary): void {
  expect(sum(s.cash.byMonth.map((m) => m.collectedCash))).toBe(s.collectedCash);
  expect(sum(Object.values(s.cash.byMethod))).toBe(s.collectedCash);
  expect(s.byBillingType.DAILY.collectedCash + s.byBillingType.MONTHLY.collectedCash).toBe(
    s.collectedCash,
  );
  expect(sum(s.byProperty.map((p) => p.collectedCash))).toBe(s.collectedCash);
  expect(sum(s.cash.byMonth.map((m) => m.cancelledCash))).toBe(
    s.collectedCashFromCancelledReservations,
  );
}

describe("borde de mes", () => {
  // 31 ago 2026, 23:30 en Santiago (invierno, UTC−4) = 1 sep 03:30 UTC.
  const LAST_DAY_2330 = "2026-09-01T03:30:00.000Z";
  // 1 sep 2026, 00:30 en Santiago = 1 sep 04:30 UTC.
  const FIRST_DAY_0030 = "2026-09-01T04:30:00.000Z";
  // 31 ago 2026, 22:30 en Santiago: un webhook de Mercado Pago de noche.
  const WEBHOOK_2230 = "2026-09-01T02:30:00.000Z";

  it("los fixtures caen en el día de Santiago que dicen", () => {
    expect(getDateKeyInTz(new Date(LAST_DAY_2330))).toBe("2026-08-31");
    expect(getDateKeyInTz(new Date(WEBHOOK_2230))).toBe("2026-08-31");
    expect(getDateKeyInTz(new Date(FIRST_DAY_0030))).toBe("2026-09-01");
    // Y en UTC los tres son del 1 de septiembre: el caso que se rompía.
    for (const t of [LAST_DAY_2330, WEBHOOK_2230, FIRST_DAY_0030]) {
      expect(t.slice(0, 10)).toBe("2026-09-01");
    }
  });

  it("un pago de las 23:30 del último día cuenta en ese mes, en todas las cifras", () => {
    const reservations = [reservation([{ paidAt: LAST_DAY_2330, amount: 100_000 }])];

    const august = summarize(reservations, "2026-08-01", "2026-08-31");
    expect(august.collectedCash).toBe(100_000);
    expect(august.cash.byMonth).toEqual([
      { monthKey: "2026-08", collectedCash: 100_000, paymentCount: 1, cancelledCash: 0 },
    ]);
    expect(august.cash.byMethod).toEqual({ MERCADO_PAGO: 100_000 });
    expectCashReconciles(august);

    const september = summarize(reservations, "2026-09-01", "2026-09-30");
    expect(september.collectedCash).toBe(0);
    expect(september.cash.byMonth).toEqual([
      { monthKey: "2026-09", collectedCash: 0, paymentCount: 0, cancelledCash: 0 },
    ]);
    expect(september.cash.byMethod).toEqual({});
    expectCashReconciles(september);
  });

  it("el webhook de las 22:30 del 31 de agosto no infla el cobrado de septiembre", () => {
    const reservations = [reservation([{ paidAt: WEBHOOK_2230, amount: 250_000 }])];

    expect(summarize(reservations, "2026-09-01", "2026-09-30").collectedCash).toBe(0);
    expect(summarize(reservations, "2026-08-01", "2026-08-31").collectedCash).toBe(250_000);
  });

  it("un pago de las 00:30 del primer día cuenta en el mes que empieza", () => {
    const reservations = [reservation([{ paidAt: FIRST_DAY_0030, amount: 80_000, method: "CASH" }])];

    const september = summarize(reservations, "2026-09-01", "2026-09-30");
    expect(september.collectedCash).toBe(80_000);
    expect(september.cash.byMonth).toEqual([
      { monthKey: "2026-09", collectedCash: 80_000, paymentCount: 1, cancelledCash: 0 },
    ]);
    expect(september.cash.byMethod).toEqual({ CASH: 80_000 });
    expectCashReconciles(september);

    expect(summarize(reservations, "2026-08-01", "2026-08-31").collectedCash).toBe(0);
  });

  it("un rango de un mes no agrega un bucket del mes anterior", () => {
    // Antes la serie leía el borde `2026-09-01T00:00Z` en Santiago (31 ago) y
    // devolvía [agosto, septiembre] para un rango de septiembre.
    const s = summarize([], "2026-09-01", "2026-09-30");
    expect(s.cash.byMonth.map((m) => m.monthKey)).toEqual(["2026-09"]);
  });

  it("el último día del rango es inclusive hasta las 23:59:59.999 de Santiago", () => {
    // 30 sep 2026, 23:59:59.999 en Santiago (verano, UTC−3) = 1 oct 02:59:59.999 UTC.
    const lastMs = "2026-10-01T02:59:59.999Z";
    const nextMs = "2026-10-01T03:00:00.000Z";
    expect(getDateKeyInTz(new Date(lastMs))).toBe("2026-09-30");
    expect(getDateKeyInTz(new Date(nextMs))).toBe("2026-10-01");

    expect(isPaidAtInRange(new Date(lastMs), "2026-09-01", "2026-09-30")).toBe(true);
    expect(isPaidAtInRange(new Date(nextMs), "2026-09-01", "2026-09-30")).toBe(false);
  });
});

describe("cambios de hora de 2026", () => {
  it("septiembre: a las 04:00 UTC del 6 el reloj salta de 00:00 a 01:00", () => {
    const beforeJump = new Date("2026-09-06T03:59:59.999Z"); // 5 sep 23:59:59.999 (UTC−4)
    const afterJump = new Date("2026-09-06T04:00:00.000Z"); // 6 sep 01:00 (UTC−3)
    expect(getDateKeyInTz(beforeJump)).toBe("2026-09-05");
    expect(getDateKeyInTz(afterJump)).toBe("2026-09-06");

    expect(isPaidAtInRange(beforeJump, "2026-09-05", "2026-09-05")).toBe(true);
    expect(isPaidAtInRange(beforeJump, "2026-09-06", "2026-09-06")).toBe(false);
    expect(isPaidAtInRange(afterJump, "2026-09-06", "2026-09-06")).toBe(true);
    expect(isPaidAtInRange(afterJump, "2026-09-05", "2026-09-05")).toBe(false);

    // 22:30 del sábado 5, antes del salto: día UTC 6, día de negocio 5.
    const saturdayNight = reservation([{ paidAt: "2026-09-06T02:30:00.000Z", amount: 40_000 }]);
    const day5 = summarize([saturdayNight], "2026-09-05", "2026-09-05");
    const day6 = summarize([saturdayNight], "2026-09-06", "2026-09-06");
    expect(day5.collectedCash).toBe(40_000);
    expect(day6.collectedCash).toBe(0);
    expectCashReconciles(day5);
    expectCashReconciles(day6);
  });

  it("abril: a las 03:00 UTC del 5 el reloj vuelve de 00:00 a 23:00 del 4", () => {
    // El 4 de abril dura 25 h en Santiago: termina a las 04:00 UTC del 5.
    const lastBeforeFallBack = new Date("2026-04-05T02:59:59.999Z"); // 4 abr 23:59:59.999 (UTC−3)
    const repeatedHour = new Date("2026-04-05T03:30:00.000Z"); // 4 abr 23:30 otra vez (UTC−4)
    const lastOfDay4 = new Date("2026-04-05T03:59:59.999Z"); // 4 abr 23:59:59.999 (UTC−4)
    const startOfDay5 = new Date("2026-04-05T04:00:00.000Z"); // 5 abr 00:00 (UTC−4)
    for (const t of [lastBeforeFallBack, repeatedHour, lastOfDay4]) {
      expect(getDateKeyInTz(t)).toBe("2026-04-04");
    }
    expect(getDateKeyInTz(startOfDay5)).toBe("2026-04-05");

    const inRepeatedHour = reservation([{ paidAt: repeatedHour.toISOString(), amount: 60_000 }]);
    expect(summarize([inRepeatedHour], "2026-04-04", "2026-04-04").collectedCash).toBe(60_000);
    expect(summarize([inRepeatedHour], "2026-04-05", "2026-04-05").collectedCash).toBe(0);

    expect(isPaidAtInRange(startOfDay5, "2026-04-05", "2026-04-05")).toBe(true);
    expect(isPaidAtInRange(startOfDay5, "2026-04-04", "2026-04-04")).toBe(false);
  });
});

describe("invariante total = suma por mes = suma por método", () => {
  // Pagos de noche y de madrugada alrededor de cada borde de mes del segundo
  // semestre, con los dos cambios de hora adentro del año.
  const PAYMENTS: Array<{ paidAt: string; amount: number; method: Method }> = [
    { paidAt: "2026-04-01T02:30:00.000Z", amount: 11_000, method: "CASH" }, // 31 mar 23:30
    { paidAt: "2026-04-05T03:30:00.000Z", amount: 13_000, method: "TRANSFER" }, // 4 abr 23:30 (hora repetida)
    { paidAt: "2026-05-01T03:15:00.000Z", amount: 17_000, method: "MERCADO_PAGO" }, // 30 abr 23:15
    { paidAt: "2026-08-01T00:10:00.000Z", amount: 19_000, method: "MERCADO_PAGO" }, // 31 jul 20:10
    { paidAt: "2026-09-01T02:30:00.000Z", amount: 23_000, method: "MERCADO_PAGO" }, // 31 ago 22:30
    { paidAt: "2026-09-01T04:30:00.000Z", amount: 29_000, method: "CASH" }, // 1 sep 00:30
    { paidAt: "2026-09-06T03:59:00.000Z", amount: 31_000, method: "TRANSFER" }, // 5 sep 23:59
    { paidAt: "2026-10-01T02:45:00.000Z", amount: 37_000, method: "CASH" }, // 30 sep 23:45
    { paidAt: "2026-10-01T15:00:00.000Z", amount: 41_000, method: "MERCADO_PAGO" }, // 1 oct 12:00
    { paidAt: "2026-12-01T02:00:00.000Z", amount: 43_000, method: "TRANSFER" }, // 30 nov 23:00
    { paidAt: "2027-01-01T02:59:59.999Z", amount: 47_000, method: "CASH" }, // 31 dic 23:59:59.999
  ];

  function portfolio(): DecisionReservationInput[] {
    return [
      reservation(PAYMENTS.filter((_, i) => i % 3 === 0)),
      reservation(PAYMENTS.filter((_, i) => i % 3 === 1), {
        propertyId: "prop-2",
        billingType: "MONTHLY",
      }),
      reservation(PAYMENTS.filter((_, i) => i % 3 === 2), { status: "CANCELLED" }),
    ];
  }

  const MONTHS = ["03", "04", "05", "07", "08", "09", "10", "11", "12"].map((m) => {
    const lastDay = new Date(Date.UTC(2026, Number(m), 0)).getUTCDate();
    return { start: `2026-${m}-01`, end: `2026-${m}-${String(lastDay).padStart(2, "0")}` };
  });

  it.each(MONTHS)("se cumple en el mes $start", ({ start, end }) => {
    expectCashReconciles(summarize(portfolio(), start, end));
  });

  it("se cumple en un rango de varios meses, y cada mes suma lo mismo que su rango propio", () => {
    const year = summarize(portfolio(), "2026-01-01", "2026-12-31");
    expectCashReconciles(year);

    for (const month of year.cash.byMonth) {
      const [y, m] = month.monthKey.split("-").map(Number);
      const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
      const alone = summarize(portfolio(), `${month.monthKey}-01`, `${month.monthKey}-${lastDay}`);
      expect(alone.collectedCash).toBe(month.collectedCash);
    }
  });

  it("cada pago cae en el mes de su día de Santiago, no en el de su día UTC", () => {
    const year = summarize(portfolio(), "2026-01-01", "2026-12-31");
    const expected = new Map<string, number>();
    for (const p of PAYMENTS) {
      const key = getDateKeyInTz(new Date(p.paidAt)).slice(0, 7);
      if (key.startsWith("2026")) expected.set(key, (expected.get(key) ?? 0) + p.amount);
    }
    for (const month of year.cash.byMonth) {
      expect(month.collectedCash).toBe(expected.get(month.monthKey) ?? 0);
    }
    // El pago del 31 dic 23:59:59.999 de Santiago es del año, aunque en UTC sea 2027.
    expect(year.cash.byMonth.find((m) => m.monthKey === "2026-12")?.collectedCash).toBe(47_000);
    // Y el de las 23:00 del 30 nov es de noviembre, aunque en UTC sea 1 dic.
    expect(year.cash.byMonth.find((m) => m.monthKey === "2026-11")?.collectedCash).toBe(43_000);
  });
});

describe("no depende de la zona del proceso", () => {
  const originalTz = process.env.TZ;
  afterEach(() => {
    process.env.TZ = originalTz;
  });

  it.each(["UTC", "America/Santiago", "Europe/Madrid", "Asia/Tokyo", "Pacific/Kiritimati", "Pacific/Midway"])(
    "%s",
    (tz) => {
      process.env.TZ = tz;
      const reservations = [
        reservation([
          { paidAt: "2026-09-01T02:30:00.000Z", amount: 100_000, method: "MERCADO_PAGO" }, // 31 ago 22:30
          { paidAt: "2026-09-01T04:30:00.000Z", amount: 50_000, method: "CASH" }, // 1 sep 00:30
        ]),
      ];
      const september = summarize(reservations, "2026-09-01", "2026-09-30");
      expect(september.collectedCash).toBe(50_000);
      expect(september.cash.byMonth).toEqual([
        { monthKey: "2026-09", collectedCash: 50_000, paymentCount: 1, cancelledCash: 0 },
      ]);
      expect(september.cash.byMethod).toEqual({ CASH: 50_000 });
    },
  );
});
