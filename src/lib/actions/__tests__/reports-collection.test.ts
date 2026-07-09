import { describe, expect, it } from "vitest";

import { buildCollectionReportRows, type CollectionReservationInput } from "../reports-collection";

const now = new Date("2026-01-15T12:00:00.000Z");

function makeReservation(overrides: Partial<CollectionReservationInput>): CollectionReservationInput {
  return {
    id: "res-1",
    propertyId: "prop-1",
    propertyName: "Edificio Centro",
    clientId: "cli-1",
    clientName: "Ana Perez",
    billingType: "MONTHLY",
    status: "CONFIRMED",
    startDate: new Date("2026-01-01T00:00:00.000Z"),
    totalPrice: 300000,
    payments: [],
    ...overrides,
  };
}

describe("buildCollectionReportRows", () => {
  it("por defecto muestra deuda activa y excluye CANCELLED/completed sin deuda", () => {
    const rows = buildCollectionReportRows(
      [
        makeReservation({ id: "a", status: "CANCELLED", totalPrice: 100000 }),
        makeReservation({
          id: "b",
          status: "COMPLETED",
          totalPrice: 100000,
          payments: [
            { amount: 100000, status: "COMPLETED", paymentType: "RESERVATION", deletedAt: null },
          ],
        }),
        makeReservation({
          id: "c",
          status: "COMPLETED",
          totalPrice: 100000,
          payments: [
            { amount: 100000, status: "COMPLETED", paymentType: "RESERVATION", deletedAt: null },
            { amount: 50000, status: "PENDING", paymentType: "EXTRA", deletedAt: null },
          ],
        }),
      ],
      { now }
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].reservationId).toBe("c");
    expect(rows[0].extrasPending).toBe(50000);
    expect(rows[0].totalToCollect).toBe(50000);
  });

  it("separa pagos RESERVATION y EXTRA y excluye soft-deleted", () => {
    const rows = buildCollectionReportRows(
      [
        makeReservation({
          totalPrice: 200000,
          payments: [
            { amount: 100000, status: "COMPLETED", paymentType: "RESERVATION", deletedAt: null },
            { amount: 100000, status: "COMPLETED", paymentType: "RESERVATION", deletedAt: new Date() },
            { amount: 20000, status: "COMPLETED", paymentType: "EXTRA", deletedAt: null },
            { amount: 30000, status: "PENDING", paymentType: "EXTRA", deletedAt: null },
          ],
        }),
      ],
      { now, debtStatus: "ALL" }
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].paid).toBe(100000);
    expect(rows[0].pending).toBe(100000);
    expect(rows[0].extrasPaid).toBe(20000);
    expect(rows[0].extrasPending).toBe(30000);
    expect(rows[0].totalToCollect).toBe(130000);
  });

  it("MONTHLY calcula vencido usando dueDate", () => {
    const rows = buildCollectionReportRows(
      [
        makeReservation({
          billingType: "MONTHLY",
          startDate: new Date("2026-01-01T00:00:00.000Z"),
          totalPrice: 300000,
          payments: [
            { amount: 100000, status: "COMPLETED", paymentType: "RESERVATION", deletedAt: null, dueDate: new Date("2026-01-01T00:00:00.000Z") },
            { amount: 100000, status: "PENDING", paymentType: "RESERVATION", deletedAt: null, dueDate: new Date("2026-01-10T00:00:00.000Z") },
            { amount: 100000, status: "PENDING", paymentType: "RESERVATION", deletedAt: null, dueDate: new Date("2026-02-01T00:00:00.000Z") },
          ],
        }),
      ],
      { now, debtStatus: "ALL" }
    );

    expect(rows[0].pending).toBe(200000);
    expect(rows[0].overdue).toBe(100000);
    expect(rows[0].nextDueDate?.toISOString()).toBe("2026-01-10T00:00:00.000Z");
    // nextInstallmentAmount: el unpaid installment con el dueDate más
    // temprano. Aquí la cuota del 10-ene está vencida pero sigue siendo
    // "la próxima" (ordenamiento por dueDate, no por estado).
    expect(rows[0].nextInstallmentAmount).toBe(100000);
  });

  it("DAILY sin dueDate usa startDate como fecha esperada", () => {
    const rows = buildCollectionReportRows(
      [
        makeReservation({
          billingType: "DAILY",
          startDate: new Date("2026-01-01T00:00:00.000Z"),
          totalPrice: 120000,
          payments: [],
        }),
      ],
      { now, debtStatus: "ALL" }
    );

    expect(rows[0].pending).toBe(120000);
    expect(rows[0].overdue).toBe(120000);
    expect(rows[0].nextDueDate?.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    // DAILY: no hay cuotas separadas, todo el pending ES la "próxima".
    expect(rows[0].nextInstallmentAmount).toBe(120000);
  });

  it("MONTHLY: nextInstallmentAmount apunta a la cuota NO pagada con dueDate más temprano", () => {
    // 1 cuota pagada (jun, 100k) + 3 pendientes (sept 100k, oct 100k, nov 200k).
    // totalRent = 100k + 300k + 200k... no, 100k + (100k+100k+200k) = 500k.
    // La próxima a cobrar debe ser la de sept (más temprana de las unpaid),
    // NO la de nov aunque sea la más cara.
    const rows = buildCollectionReportRows(
      [
        makeReservation({
          billingType: "MONTHLY",
          startDate: new Date("2026-06-01T00:00:00.000Z"),
          totalPrice: 500000,
          payments: [
            { amount: 100000, status: "COMPLETED", paymentType: "RESERVATION", deletedAt: null, dueDate: new Date("2026-06-01T00:00:00.000Z") },
            { amount: 100000, status: "PENDING", paymentType: "RESERVATION", deletedAt: null, dueDate: new Date("2026-09-01T00:00:00.000Z") },
            { amount: 100000, status: "PENDING", paymentType: "RESERVATION", deletedAt: null, dueDate: new Date("2026-10-01T00:00:00.000Z") },
            { amount: 200000, status: "PENDING", paymentType: "RESERVATION", deletedAt: null, dueDate: new Date("2026-11-01T00:00:00.000Z") },
          ],
        }),
      ],
      { now, debtStatus: "ALL" }
    );

    expect(rows[0].paid).toBe(100000);
    expect(rows[0].pending).toBe(400000);  // 500k - 100k
    expect(rows[0].overdue).toBe(0);
    expect(rows[0].nextDueDate?.toISOString()).toBe("2026-09-01T00:00:00.000Z");
    // La cuota de sept es la próxima ($100k), NO la de nov ($200k).
    expect(rows[0].nextInstallmentAmount).toBe(100000);
  });

  it("MONTHLY: nextInstallmentAmount = 0 cuando todas las cuotas están pagadas (caso degenado)", () => {
    const rows = buildCollectionReportRows(
      [
        makeReservation({
          billingType: "MONTHLY",
          startDate: new Date("2026-06-01T00:00:00.000Z"),
          totalPrice: 300000,
          payments: [
            { amount: 100000, status: "COMPLETED", paymentType: "RESERVATION", deletedAt: null, dueDate: new Date("2026-06-01T00:00:00.000Z") },
            { amount: 100000, status: "COMPLETED", paymentType: "RESERVATION", deletedAt: null, dueDate: new Date("2026-07-01T00:00:00.000Z") },
            { amount: 100000, status: "COMPLETED", paymentType: "RESERVATION", deletedAt: null, dueDate: new Date("2026-08-01T00:00:00.000Z") },
          ],
        }),
      ],
      { now, debtStatus: "ALL" }
    );

    expect(rows[0].pending).toBe(0);
    expect(rows[0].nextInstallmentAmount).toBe(0);
    expect(rows[0].nextDueDate).toBeNull();
  });

  it("DAILY: nextInstallmentAmount = pending (no hay cuotas)", () => {
    // Reserva con pago parcial: $200k de $500k pagados, quedan $300k.
    const rows = buildCollectionReportRows(
      [
        makeReservation({
          billingType: "DAILY",
          startDate: new Date("2026-02-15T00:00:00.000Z"),
          totalPrice: 500000,
          payments: [
            { amount: 200000, status: "COMPLETED", paymentType: "RESERVATION", deletedAt: null },
          ],
        }),
      ],
      { now, debtStatus: "ALL" }
    );

    expect(rows[0].pending).toBe(300000);
    expect(rows[0].nextInstallmentAmount).toBe(300000);  // todo el pending es "la próxima"
  });
});
