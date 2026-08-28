import { describe, expect, it } from "vitest";

import { buildCollectionReportRows, type CollectionReservationInput } from "@/lib/reports/collection";

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

  it("DAILY: una reserva cuyo startDate es hoy (medianoche UTC) no cuenta como overdue", () => {
    // startDate a medianoche UTC del mismo dia que `now` (interpretado en SCL,
    // agosto = invierno, UTC-4 sin ambiguedad de DST). Repro H1 para DAILY:
    // antes del fix, la reinterpretacion en wall-time SCL podia leer el
    // startDate como "ayer" y marcar overdue incorrectamente.
    const todayNow = new Date("2026-08-24T18:00:00.000Z"); // tarde SCL del 24-ago
    const rows = buildCollectionReportRows(
      [
        makeReservation({
          billingType: "DAILY",
          startDate: new Date("2026-08-24T00:00:00.000Z"),
          totalPrice: 80000,
          payments: [],
        }),
      ],
      { now: todayNow, debtStatus: "ALL" }
    );

    expect(rows[0].pending).toBe(80000);
    expect(rows[0].overdue).toBe(0);
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

  it("MONTHLY: 2 cuotas vencidas + 1 dentro de los próximos 7 días", () => {
    // now = 2026-01-15. Vencidas: dic-1, ene-1. Por vencer: ene-20 (5 días).
    const rows = buildCollectionReportRows(
      [
        makeReservation({
          billingType: "MONTHLY",
          startDate: new Date("2025-12-01T00:00:00.000Z"),
          totalPrice: 300000,
          payments: [
            { amount: 100000, status: "PENDING", paymentType: "RESERVATION", deletedAt: null, dueDate: new Date("2025-12-01T00:00:00.000Z") },
            { amount: 100000, status: "PENDING", paymentType: "RESERVATION", deletedAt: null, dueDate: new Date("2026-01-01T00:00:00.000Z") },
            { amount: 100000, status: "PENDING", paymentType: "RESERVATION", deletedAt: null, dueDate: new Date("2026-01-20T00:00:00.000Z") },
          ],
        }),
      ],
      { now, debtStatus: "ALL" }
    );

    expect(rows[0].overdueCount).toBe(2);
    expect(rows[0].dueSoon).toBe(100000);
    expect(rows[0].dueSoonCount).toBe(1);
    expect(rows[0].dueSoonNextDueDate?.toISOString()).toBe("2026-01-20T00:00:00.000Z");
    expect(rows[0].pendingChargesCount).toBe(3);
  });

  it("MONTHLY: próxima cuota a 30 días → dueSoonCount es 0 (fuera de la ventana de 7 días)", () => {
    const rows = buildCollectionReportRows(
      [
        makeReservation({
          billingType: "MONTHLY",
          startDate: new Date("2026-01-01T00:00:00.000Z"),
          totalPrice: 100000,
          payments: [
            { amount: 100000, status: "PENDING", paymentType: "RESERVATION", deletedAt: null, dueDate: new Date("2026-02-14T00:00:00.000Z") },
          ],
        }),
      ],
      { now, debtStatus: "ALL" }
    );

    expect(rows[0].overdueCount).toBe(0);
    expect(rows[0].dueSoon).toBe(0);
    expect(rows[0].dueSoonCount).toBe(0);
    expect(rows[0].dueSoonNextDueDate).toBeNull();
  });

  it("MONTHLY: cuota impaga sin dueDate no cuenta en overdue ni dueSoon, pero sí en pendingChargesCount", () => {
    const rows = buildCollectionReportRows(
      [
        makeReservation({
          billingType: "MONTHLY",
          startDate: new Date("2026-01-01T00:00:00.000Z"),
          totalPrice: 100000,
          payments: [
            { amount: 100000, status: "PENDING", paymentType: "RESERVATION", deletedAt: null, dueDate: null },
          ],
        }),
      ],
      { now, debtStatus: "ALL" }
    );

    expect(rows[0].overdueCount).toBe(0);
    expect(rows[0].dueSoonCount).toBe(0);
    expect(rows[0].dueSoon).toBe(0);
    expect(rows[0].pendingChargesCount).toBe(1);
  });

  it("DAILY: reserva vencida cuenta overdueCount = 1 y no aporta a dueSoon", () => {
    const rows = buildCollectionReportRows(
      [
        makeReservation({
          billingType: "DAILY",
          startDate: new Date("2026-01-01T00:00:00.000Z"), // muy anterior a now (15-ene)
          totalPrice: 80000,
          payments: [],
        }),
      ],
      { now, debtStatus: "ALL" }
    );

    expect(rows[0].overdueCount).toBe(1);
    expect(rows[0].dueSoonCount).toBe(0);
    expect(rows[0].dueSoon).toBe(0);
    expect(rows[0].pendingChargesCount).toBe(1);
  });

  it("DAILY: reserva por vencer dentro de 7 días cuenta en dueSoon, no en overdue", () => {
    const rows = buildCollectionReportRows(
      [
        makeReservation({
          billingType: "DAILY",
          startDate: new Date("2026-01-20T00:00:00.000Z"), // 5 días después de now (15-ene)
          totalPrice: 80000,
          payments: [],
        }),
      ],
      { now, debtStatus: "ALL" }
    );

    expect(rows[0].overdueCount).toBe(0);
    expect(rows[0].dueSoonCount).toBe(1);
    expect(rows[0].dueSoon).toBe(80000);
    expect(rows[0].dueSoonNextDueDate?.toISOString()).toBe("2026-01-20T00:00:00.000Z");
  });

  it("extras impagos se cuentan en extrasPendingCount y suman a pendingChargesCount", () => {
    const rows = buildCollectionReportRows(
      [
        makeReservation({
          billingType: "MONTHLY",
          startDate: new Date("2026-01-01T00:00:00.000Z"),
          totalPrice: 100000,
          payments: [
            { amount: 100000, status: "COMPLETED", paymentType: "RESERVATION", deletedAt: null, dueDate: new Date("2026-01-01T00:00:00.000Z") },
            { amount: 20000, status: "PENDING", paymentType: "EXTRA", deletedAt: null },
            { amount: 15000, status: "FAILED", paymentType: "EXTRA", deletedAt: null },
            { amount: 10000, status: "COMPLETED", paymentType: "EXTRA", deletedAt: null },
          ],
        }),
      ],
      { now, debtStatus: "ALL" }
    );

    expect(rows[0].extrasPendingCount).toBe(2);
    // Sin cuotas RESERVATION impagas (0) + 2 extras impagos = 2.
    expect(rows[0].pendingChargesCount).toBe(2);
  });
});
