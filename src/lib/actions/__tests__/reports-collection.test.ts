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
  });
});
