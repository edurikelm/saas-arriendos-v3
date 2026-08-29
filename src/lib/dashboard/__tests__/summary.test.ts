/**
 * Tests para `buildDashboardSummary` — el seam puro que reemplaza el cálculo
 * inline (roto) de `/dashboard/page.tsx`.
 *
 * Testing strategy: fixtures construidos a mano (sin mocks de Prisma), `now`
 * fijo inyectado (America/Santiago, ADR-0020). Cubre los criterios de
 * aceptación del plan (docs/plans/dashboard-improvement-plan.md, Fase 1).
 */

import { describe, expect, it } from "vitest";
import {
  buildDashboardSummary,
  type DashboardPaymentInput,
  type DashboardReservationInput,
  type DashboardSummaryInput,
} from "@/lib/dashboard/summary";
import { buildDecisionSummary } from "@/lib/reports/decision-summary";
import { daysUntilStart } from "@/components/reservations/reservation-status";
import { daysFromTodayDateOnly } from "@/lib/domain/timezone";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

// Miércoles 24 de agosto 2026, 18:00 UTC → tarde en America/Santiago, mismo
// día calendario en SCL sin ambigüedad de DST.
const NOW = new Date("2026-08-24T18:00:00.000Z");

const PROPERTY = { id: "prop-1", name: "Depto Centro", unitsAvailable: 3 };

function makeProperty(overrides?: Partial<typeof PROPERTY>) {
  return { ...PROPERTY, ...overrides };
}

let paymentCounter = 0;
function makePayment(overrides: Partial<DashboardPaymentInput> = {}): DashboardPaymentInput {
  paymentCounter += 1;
  return {
    id: `pay-${paymentCounter}`,
    amount: 100_000,
    status: "PENDING",
    paymentType: "RESERVATION",
    method: "CASH",
    paidAt: null,
    deletedAt: null,
    dueDate: null,
    initPoint: null,
    expiresAt: null,
    ...overrides,
  };
}

let reservationCounter = 0;
function makeReservation(
  overrides: Partial<DashboardReservationInput> = {},
): DashboardReservationInput {
  reservationCounter += 1;
  return {
    id: `res-${reservationCounter}`,
    propertyId: PROPERTY.id,
    billingType: "DAILY",
    status: "CONFIRMED",
    startDate: new Date("2026-08-10T00:00:00.000Z"),
    endDate: new Date("2026-08-15T00:00:00.000Z"),
    totalPrice: 100_000,
    unitsBooked: 1,
    createdAt: new Date("2026-08-01T12:00:00.000Z"),
    property: { id: PROPERTY.id, name: PROPERTY.name, color: "#3B82F6" },
    client: { id: `client-${reservationCounter}`, name: `Cliente ${reservationCounter}`, phone: null },
    payments: [],
    ...overrides,
  };
}

function buildInput(
  reservations: DashboardReservationInput[],
  overrides: Partial<DashboardSummaryInput> = {},
): DashboardSummaryInput {
  return {
    properties: [makeProperty()],
    reservations,
    now: NOW,
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("buildDashboardSummary", () => {
  it("incluye una reserva #11 (fuera del recorte legacy de limit=10) en los KPIs de ingresos", () => {
    const reservations = Array.from({ length: 11 }, (_, i) =>
      makeReservation({
        id: `daily-${i + 1}`,
        payments: [
          makePayment({
            amount: 1_000,
            status: "COMPLETED",
            paymentType: "RESERVATION",
            paidAt: NOW,
          }),
        ],
      }),
    );

    const summary = buildDashboardSummary(buildInput(reservations));

    // 11 reservas × $1.000 pagado este mes — si el dashboard siguiera limitado
    // a 10 reservas (bug legacy), esto daría 10.000, no 11.000.
    expect(summary.income.currentMonth).toBe(11_000);
  });

  it("un pago EXTRA completado no suma a income.currentMonth (ADR-0028 §1)", () => {
    const reservations = [
      makeReservation({
        payments: [
          makePayment({
            amount: 50_000,
            status: "COMPLETED",
            paymentType: "RESERVATION",
            paidAt: NOW,
          }),
          makePayment({
            amount: 20_000,
            status: "COMPLETED",
            paymentType: "EXTRA",
            paidAt: NOW,
          }),
        ],
      }),
    ];

    const summary = buildDashboardSummary(buildInput(reservations));

    expect(summary.income.currentMonth).toBe(50_000);
  });

  it("un pago con dueDate = hoy produce un DashboardCollectionItem con bucket DUE_TODAY", () => {
    const reservations = [
      makeReservation({
        billingType: "MONTHLY",
        status: "CONFIRMED",
        totalPrice: 300_000,
        payments: [
          makePayment({
            amount: 100_000,
            status: "PENDING",
            paymentType: "RESERVATION",
            // Medianoche UTC: como lib/payments/monthly.ts persiste dueDate en
            // produccion. Antes del fix de date-only (dateOnlyKey/isOverdueDateOnly),
            // este ancla caia como OVERDUE en vez de DUE_TODAY por reinterpretacion
            // en wall-time SCL (bug real, ver ADR de re-trabajo Fase 1/Nivel 3).
            dueDate: new Date("2026-08-24T00:00:00.000Z"),
          }),
        ],
      }),
    ];

    const summary = buildDashboardSummary(buildInput(reservations));

    const dueTodayItem = summary.collectionItems.find((item) => item.bucket === "DUE_TODAY");
    expect(dueTodayItem).toBeDefined();
    expect(dueTodayItem?.reservationId).toBe(reservations[0].id);
    expect(summary.collection.dueTodayCount).toBe(1);
  });

  it("collection.overdueCount y collection.overdueAmount describen SIEMPRE la misma población que collectionItems recortado", () => {
    // 6 reservas vencidas — más que `collectionLimit` (default 4).
    const overdueReservations = Array.from({ length: 6 }, (_, i) =>
      makeReservation({
        id: `overdue-${i + 1}`,
        billingType: "MONTHLY",
        status: "CONFIRMED",
        totalPrice: 100_000,
        payments: [
          makePayment({
            amount: 100_000,
            status: "PENDING",
            paymentType: "RESERVATION",
            dueDate: new Date("2026-07-01T00:00:00.000Z"), // vencido: mucho antes de NOW
          }),
        ],
      }),
    );

    const summary = buildDashboardSummary(buildInput(overdueReservations));

    // El KPI cuenta las 6, aunque la lista solo muestre 4 (default collectionLimit).
    expect(summary.collection.overdueCount).toBe(6);
    expect(summary.collection.overdueAmount).toBe(600_000);
    expect(summary.collectionItems).toHaveLength(4);
    expect(summary.collectionItems.every((item) => item.bucket === "OVERDUE")).toBe(true);
  });

  it("una reserva DAILY con deuda pendiente (sin Payment.dueDate) aparece en collectionItems — regresión cobranza DAILY invisible", () => {
    const reservations = [
      makeReservation({
        billingType: "DAILY",
        status: "CONFIRMED",
        totalPrice: 30_000,
        startDate: new Date("2026-08-19T00:00:00.000Z"), // 5 días antes de NOW → vencido
        endDate: new Date("2026-08-21T00:00:00.000Z"),
        payments: [], // sin fila Payment.dueDate — DAILY nunca genera una automáticamente
      }),
    ];

    const summary = buildDashboardSummary(buildInput(reservations));

    const item = summary.collectionItems.find((i) => i.reservationId === reservations[0].id);
    expect(item).toBeDefined();
    expect(item?.bucket).toBe("OVERDUE");
    expect(item?.amount).toBe(30_000);
    expect(summary.collection.overdueCount).toBe(1);
  });

  it("reserva MONTHLY con 3 cuotas (2 vencidas + 1 por vencer en 4 días) reporta el monto real de la ventana, no una sola cuota — repro bug reportado", () => {
    // Alejandra Mayorga, Teja 2: 1 jul → 30 sept 2026, 3 cuotas de $250.000
    // (jul, ago, sept), ninguna pagada. `now` = 28 ago 2026 → jul y ago
    // vencidas, sept vence en 4 días (dentro de la ventana de 7 días).
    const now = new Date("2026-08-28T18:00:00.000Z"); // tarde SCL, sin ambigüedad DST
    const reservations = [
      makeReservation({
        billingType: "MONTHLY",
        status: "CONFIRMED",
        startDate: new Date("2026-07-01T00:00:00.000Z"),
        endDate: new Date("2026-09-30T00:00:00.000Z"),
        totalPrice: 750_000,
        payments: [
          makePayment({ amount: 250_000, status: "PENDING", paymentType: "RESERVATION", dueDate: new Date("2026-07-01T00:00:00.000Z") }),
          makePayment({ amount: 250_000, status: "PENDING", paymentType: "RESERVATION", dueDate: new Date("2026-08-01T00:00:00.000Z") }),
          makePayment({ amount: 250_000, status: "PENDING", paymentType: "RESERVATION", dueDate: new Date("2026-09-01T00:00:00.000Z") }),
        ],
      }),
    ];

    const summary = buildDashboardSummary(buildInput(reservations, { now }));

    expect(summary.collectionItems).toHaveLength(1);
    const item = summary.collectionItems[0];
    expect(item.bucket).toBe("OVERDUE");
    expect(item.amount).toBe(750_000); // 2 vencidas (500k) + 1 por vencer en 4 días (250k)
    expect(item.overdueCount).toBe(2);
    expect(item.dueSoonCount).toBe(1);
    expect(item.dueSoonDaysFromToday).toBe(4);

    expect(summary.collection.windowCount).toBe(3); // 2 vencidas + 1 por vencer
    expect(summary.collection.windowAmount).toBe(750_000);
    expect(summary.collection.overdueInstallmentsCount).toBe(2); // cuotas, no reservas
    expect(summary.collection.overdueAmount).toBe(500_000);
    expect(summary.collection.pendingCount).toBe(3); // 3 cobros (cuotas), no 1 reserva
  });

  it("contrato MONTHLY largo (12 cuotas, 2 vencidas, próxima a 30 días) usa el monto de la ventana, NO totalToCollect del año completo", () => {
    const now = new Date("2026-08-28T18:00:00.000Z");
    // 2 cuotas vencidas ($250k c/u) + 10 cuotas futuras, la más próxima a
    // exactamente 30 días de `now` (fuera de la ventana de 7 días).
    const overdueDueDates = ["2026-06-01T00:00:00.000Z", "2026-07-01T00:00:00.000Z"];
    const futureDueDates = [
      "2026-09-27T00:00:00.000Z", // exactamente +30 días de 28-ago
      "2026-10-27T00:00:00.000Z",
      "2026-11-27T00:00:00.000Z",
      "2026-12-27T00:00:00.000Z",
      "2027-01-27T00:00:00.000Z",
      "2027-02-27T00:00:00.000Z",
      "2027-03-27T00:00:00.000Z",
      "2027-04-27T00:00:00.000Z",
      "2027-05-27T00:00:00.000Z",
      "2027-06-27T00:00:00.000Z",
    ];
    const allDueDates = [...overdueDueDates, ...futureDueDates];
    expect(allDueDates).toHaveLength(12);

    const reservations = [
      makeReservation({
        billingType: "MONTHLY",
        status: "CONFIRMED",
        startDate: new Date("2026-06-01T00:00:00.000Z"),
        endDate: new Date("2027-06-30T00:00:00.000Z"),
        totalPrice: 3_000_000, // 12 × 250k
        payments: allDueDates.map((dueDate) =>
          makePayment({ amount: 250_000, status: "PENDING", paymentType: "RESERVATION", dueDate: new Date(dueDate) }),
        ),
      }),
    ];

    const summary = buildDashboardSummary(buildInput(reservations, { now }));

    expect(summary.collectionItems).toHaveLength(1);
    const item = summary.collectionItems[0];
    expect(item.bucket).toBe("OVERDUE");
    // Solo las 2 vencidas — la próxima cuota está a 30 días, fuera de la
    // ventana de 7 días. NO debe ser totalToCollect (3.000.000, el año
    // completo del contrato).
    expect(item.amount).toBe(500_000);
    expect(item.overdueCount).toBe(2);
    expect(item.dueSoonCount).toBe(0);
    expect(item.dueSoonDaysFromToday).toBeNull();
  });

  it("income.currentMonth coincide exacto con buildDecisionSummary(mismo rango).collectedCash", () => {
    const reservations = [
      makeReservation({
        payments: [
          makePayment({
            amount: 75_000,
            status: "COMPLETED",
            paymentType: "RESERVATION",
            paidAt: new Date("2026-08-05T10:00:00.000Z"),
          }),
        ],
      }),
      makeReservation({
        status: "CANCELLED",
        payments: [
          makePayment({
            amount: 25_000,
            status: "COMPLETED",
            paymentType: "RESERVATION",
            paidAt: new Date("2026-08-20T10:00:00.000Z"),
          }),
        ],
      }),
      makeReservation({
        payments: [
          makePayment({
            amount: 40_000,
            status: "COMPLETED",
            paymentType: "RESERVATION",
            paidAt: new Date("2026-07-31T10:00:00.000Z"), // mes anterior, no debe contar
          }),
        ],
      }),
    ];

    const input = buildInput(reservations);
    const summary = buildDashboardSummary(input);

    // Rango independiente construido a mano para el mismo mes que NOW
    // (agosto 2026 tiene 31 días) — no se reimporta lógica privada de
    // summary.ts, así la comparación es una verificación cruzada real.
    const directDecision = buildDecisionSummary({
      reservations: input.reservations,
      properties: input.properties,
      rangeStart: new Date("2026-08-01T00:00:00.000Z"),
      rangeEnd: new Date("2026-08-31T00:00:00.000Z"),
    });

    expect(summary.income.currentMonth).toBe(directDecision.collectedCash);
    // Sanity: incluye cash de reservas CANCELLED (25.000) + activa (75.000) = 100.000,
    // excluye el pago de julio (40.000).
    expect(summary.income.currentMonth).toBe(100_000);
  });
});

describe("buildDashboardSummary — MONTHLY entra por evento en upcomingReservations/upcoming KPI", () => {
  // NOW = 2026-08-24 (America/Santiago). `daysUntilStart`/`daysUntilEnd`
  // comparan por dateKey directo del ISO string (date-only, sin conversión
  // TZ) — construir `startDate`/`endDate` a medianoche UTC en la fecha
  // deseada basta para controlar `daysToStart`/`daysToEnd` con precisión.

  it("MONTHLY activo SIN evento en la ventana no aparece en upcomingReservations ni en upcoming.total", () => {
    const reservations = [
      makeReservation({
        billingType: "MONTHLY",
        status: "CONFIRMED",
        startDate: new Date("2026-01-01T00:00:00.000Z"), // muy en el pasado
        endDate: new Date("2027-06-30T00:00:00.000Z"), // muy en el futuro (fuera de ventana)
        totalPrice: 5_400_000,
      }),
    ];

    const summary = buildDashboardSummary(buildInput(reservations));

    expect(summary.upcomingReservations.find((r) => r.id === reservations[0].id)).toBeUndefined();
    expect(summary.upcoming.total).toBe(0);
    expect(summary.upcoming.next7Days).toBe(0);
  });

  it("MONTHLY que INICIA dentro de la ventana aparece, con months correcto e installmentAmount = monto de una cuota (no totalPrice)", () => {
    const reservations = [
      makeReservation({
        billingType: "MONTHLY",
        status: "CONFIRMED",
        startDate: new Date("2026-09-01T00:00:00.000Z"), // +8 días de NOW, dentro de la ventana de 14
        endDate: new Date("2026-11-30T00:00:00.000Z"), // 3 meses inclusivos (ej. canónico ADR)
        totalPrice: 900_000, // 3 × 300.000
        payments: [
          // Orden deliberadamente desordenado — el helper debe encontrar la
          // cuota de dueDate MÁS temprano, no la primera del array.
          makePayment({ amount: 300_000, status: "PENDING", paymentType: "RESERVATION", dueDate: new Date("2026-11-01T00:00:00.000Z") }),
          makePayment({ amount: 300_000, status: "PENDING", paymentType: "RESERVATION", dueDate: new Date("2026-09-01T00:00:00.000Z") }),
          makePayment({ amount: 300_000, status: "PENDING", paymentType: "RESERVATION", dueDate: new Date("2026-10-01T00:00:00.000Z") }),
        ],
      }),
    ];

    const summary = buildDashboardSummary(buildInput(reservations));

    const item = summary.upcomingReservations.find((r) => r.id === reservations[0].id);
    expect(item).toBeDefined();
    expect(item?.months).toBe(3);
    expect(item?.installmentAmount).toBe(300_000);
    expect(item?.installmentAmount).not.toBe(item?.totalPrice);
  });

  it("MONTHLY activo que TERMINA dentro de la ventana aparece y se ordena entre las activas por daysToEnd asc", () => {
    const monthlyEndingSoon = makeReservation({
      billingType: "MONTHLY",
      status: "CONFIRMED",
      startDate: new Date("2026-01-01T00:00:00.000Z"),
      endDate: new Date("2026-08-29T00:00:00.000Z"), // +5 días de NOW → activo, termina pronto
      totalPrice: 2_400_000,
    });
    const dailyEndingSooner = makeReservation({
      billingType: "DAILY",
      status: "CONFIRMED",
      startDate: new Date("2026-08-20T00:00:00.000Z"),
      endDate: new Date("2026-08-26T00:00:00.000Z"), // +2 días de NOW → activa, termina antes
      totalPrice: 120_000,
    });

    const summary = buildDashboardSummary(buildInput([monthlyEndingSoon, dailyEndingSooner]));

    const monthlyItem = summary.upcomingReservations.find((r) => r.id === monthlyEndingSoon.id);
    const dailyItem = summary.upcomingReservations.find((r) => r.id === dailyEndingSooner.id);
    expect(monthlyItem).toBeDefined();
    expect(dailyItem).toBeDefined();
    expect(monthlyItem?.isActive).toBe(true);
    expect(monthlyItem?.daysToEnd).toBe(5);
    expect(dailyItem?.daysToEnd).toBe(2);

    const monthlyIndex = summary.upcomingReservations.findIndex((r) => r.id === monthlyEndingSoon.id);
    const dailyIndex = summary.upcomingReservations.findIndex((r) => r.id === dailyEndingSooner.id);
    // Ambas activas → ordenan por daysToEnd asc: la que termina antes (2) va primero.
    expect(dailyIndex).toBeLessThan(monthlyIndex);
  });

  it("regresión DAILY: activas + futuras en ventana siguen apareciendo con nights/totalPrice, months=0 e installmentAmount=null", () => {
    const reservations = [
      makeReservation({
        billingType: "DAILY",
        status: "CONFIRMED",
        startDate: new Date("2026-08-29T00:00:00.000Z"), // +5 días de NOW
        endDate: new Date("2026-09-02T00:00:00.000Z"),
        totalPrice: 200_000,
      }),
    ];

    const summary = buildDashboardSummary(buildInput(reservations));

    const item = summary.upcomingReservations.find((r) => r.id === reservations[0].id);
    expect(item).toBeDefined();
    expect(item?.nights).toBe(5);
    expect(item?.totalPrice).toBe(200_000);
    expect(item?.months).toBe(0);
    expect(item?.installmentAmount).toBeNull();
  });

  it("installmentAmount usa el fallback totalPrice/months cuando la reserva MONTHLY no tiene filas de Payment", () => {
    const reservations = [
      makeReservation({
        billingType: "MONTHLY",
        status: "CONFIRMED",
        startDate: new Date("2026-09-01T00:00:00.000Z"),
        endDate: new Date("2026-11-30T00:00:00.000Z"), // 3 meses
        totalPrice: 900_000,
        payments: [], // sin cuotas generadas (edge case defensivo)
      }),
    ];

    const summary = buildDashboardSummary(buildInput(reservations));

    const item = summary.upcomingReservations.find((r) => r.id === reservations[0].id);
    expect(item?.months).toBe(3);
    expect(item?.installmentAmount).toBe(300_000); // 900_000 / 3
  });

  it("upcoming.total/next7Days: cuenta el MONTHLY con inicio futuro en ventana, ignora el MONTHLY activo sin evento y la reserva a 30 días", () => {
    const monthlyStartingSoon = makeReservation({
      billingType: "MONTHLY",
      status: "CONFIRMED",
      startDate: new Date("2026-08-29T00:00:00.000Z"), // +5 días de NOW → dentro de ventana y de next7Days
      endDate: new Date("2026-11-28T00:00:00.000Z"),
      totalPrice: 900_000,
    });
    const monthlyActiveNoEvent = makeReservation({
      billingType: "MONTHLY",
      status: "CONFIRMED",
      startDate: new Date("2026-01-01T00:00:00.000Z"),
      endDate: new Date("2027-06-30T00:00:00.000Z"),
      totalPrice: 5_400_000,
    });
    const dailyFarOut = makeReservation({
      billingType: "DAILY",
      status: "CONFIRMED",
      startDate: new Date("2026-09-23T00:00:00.000Z"), // +30 días de NOW → fuera de la ventana de 14
      endDate: new Date("2026-09-25T00:00:00.000Z"),
      totalPrice: 60_000,
    });

    const summary = buildDashboardSummary(
      buildInput([monthlyStartingSoon, monthlyActiveNoEvent, dailyFarOut]),
    );

    expect(summary.upcoming.total).toBe(1);
    expect(summary.upcoming.next7Days).toBe(1);
  });
});

describe("coherencia cruzada: daysUntilStart vs daysFromTodayDateOnly", () => {
  // Fija estructuralmente que las dos convenciones de "días hasta el inicio"
  // (reservation-status.ts, usado por el Dashboard para "Llega en N días") y
  // el nuevo helper date-only de timezone.ts no puedan volver a divergir.
  // startDate es date-only (CONTEXT.md) — ambos helpers deben tratarlo igual
  // sin importar si el ancla llega a medianoche o a mediodía UTC.
  it.each([
    ["startDate hoy (medianoche UTC)", "2026-08-24T00:00:00.000Z"],
    ["startDate hoy (mediodía UTC)", "2026-08-24T12:00:00.000Z"],
    ["startDate futuro (medianoche UTC)", "2026-08-27T00:00:00.000Z"],
    ["startDate pasado (medianoche UTC)", "2026-08-20T00:00:00.000Z"],
  ])("%s: daysUntilStart === daysFromTodayDateOnly", (_label, startDateIso) => {
    expect(daysUntilStart(startDateIso, NOW)).toBe(daysFromTodayDateOnly(startDateIso, NOW));
  });
});
