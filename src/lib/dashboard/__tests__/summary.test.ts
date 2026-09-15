/**
 * Tests para `buildDashboardSummary` — el seam puro que alimenta `/dashboard`:
 * cobros pendientes, agenda de llegadas/salidas, tablero de propiedades y el
 * pulso del mes.
 *
 * Testing strategy: fixtures construidos a mano (sin mocks de Prisma), `now`
 * fijo inyectado (America/Santiago, ADR-0020).
 */

import { describe, expect, it } from "vitest";
import {
  buildDashboardSummary,
  type DashboardExternalBlockInput,
  type DashboardNextCharge,
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
    // Fecha fija y creciente por fixture: sin esto, dos pagos creados en el
    // mismo test comparten `Date.now()` y el desempate por `createdAt` de
    // `computeNextCharge` deja de ser determinístico.
    createdAt: new Date(2026, 0, paymentCounter),
    installmentIndex: null,
    title: null,
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
    property: { id: PROPERTY.id, name: PROPERTY.name, color: "#3B82F6" },
    client: {
      id: `client-${reservationCounter}`,
      name: `Cliente ${reservationCounter}`,
      phone: null,
      email: `cliente${reservationCounter}@test.com`,
    },
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

// ─── Tests: cobros pendientes (collection) ─────────────────────────────────────

describe("buildDashboardSummary", () => {
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

  // ── #238: el encabezado "Vencidos" contaba plata que no estaba vencida ──
  //
  // El desglose por grupo repartia la fila ENTERA al grupo de su estado, asi
  // que las cuotas por vencer de una reserva con deuda vencida entraban al
  // subtotal "Vencidos". Con dos reservas (2 vencidas + 1 por vencer / 1
  // vencida) el encabezado decia 4 cobros vencidos cuando eran 3 — y el
  // subtitulo del header de la pagina, en la misma pantalla, decia 3.
  const cuotasMensuales = (dueDates: string[], amount: number) =>
    dueDates.map((dueDate) =>
      makePayment({
        amount,
        status: "PENDING",
        paymentType: "RESERVATION",
        dueDate: new Date(dueDate),
      }),
    );

  function twoReservationsMixedBuckets() {
    return [
      // Victor: 2 cuotas vencidas (jul, ago) + 1 por vencer en 4 dias (sept).
      makeReservation({
        billingType: "MONTHLY",
        status: "CONFIRMED",
        startDate: new Date("2026-07-01T00:00:00.000Z"),
        endDate: new Date("2026-09-30T00:00:00.000Z"),
        totalPrice: 750_000,
        payments: cuotasMensuales(
          ["2026-07-01T00:00:00.000Z", "2026-08-01T00:00:00.000Z", "2026-09-01T00:00:00.000Z"],
          250_000,
        ),
      }),
      // Gladys: 1 cuota vencida, nada por vencer en la ventana.
      makeReservation({
        billingType: "MONTHLY",
        status: "CONFIRMED",
        startDate: new Date("2026-08-01T00:00:00.000Z"),
        endDate: new Date("2026-08-31T00:00:00.000Z"),
        totalPrice: 300_000,
        payments: cuotasMensuales(["2026-08-01T00:00:00.000Z"], 300_000),
      }),
    ];
  }

  it('el subtotal "Vencidos" cuenta solo cuotas vencidas, no la fila entera — repro #238', () => {
    const now = new Date("2026-08-28T18:00:00.000Z");

    const summary = buildDashboardSummary(buildInput(twoReservationsMixedBuckets(), { now }));

    const { OVERDUE, DUE_SOON } = summary.collection.windowGroups;

    // 3 cuotas vencidas (2 de Victor + 1 de Gladys), NO 4: la cuota de sept
    // de Victor no esta vencida aunque su fila se renderice bajo "Vencidos".
    expect(OVERDUE.count).toBe(3);
    expect(OVERDUE.amount).toBe(800_000); // 250k + 250k + 300k
    expect(DUE_SOON.count).toBe(1);
    expect(DUE_SOON.amount).toBe(250_000); // la cuota de sept de Victor

    // El encabezado del card y el subtitulo del header son EL MISMO numero.
    expect(summary.collection.overdueInstallmentsCount).toBe(OVERDUE.count);
    expect(summary.collection.overdueAmount).toBe(OVERDUE.amount);

    // Invariante: los dos encabezados siguen cerrando con el footer.
    expect(OVERDUE.count + DUE_SOON.count).toBe(summary.collection.windowCount);
    expect(OVERDUE.amount + DUE_SOON.amount).toBe(summary.collection.windowAmount);
  });

  it("reporta la porcion truncada de cada grupo, para que ningun cobro desaparezca del card", () => {
    const now = new Date("2026-08-28T18:00:00.000Z");
    const reservations = [
      ...twoReservationsMixedBuckets(),
      // Tercera reserva, sin deuda vencida: cae en el grupo "por vencer" y es
      // la primera en quedar fuera del corte (el orden es OVERDUE primero).
      makeReservation({
        billingType: "MONTHLY",
        status: "CONFIRMED",
        startDate: new Date("2026-08-01T00:00:00.000Z"),
        endDate: new Date("2026-09-30T00:00:00.000Z"),
        totalPrice: 150_000,
        payments: cuotasMensuales(["2026-09-01T00:00:00.000Z"], 150_000),
      }),
    ];

    const summary = buildDashboardSummary(
      buildInput(reservations, { now, collectionLimit: 2 }),
    );

    expect(summary.collectionItems).toHaveLength(2); // las dos filas vencidas

    const { OVERDUE, DUE_SOON } = summary.collection.windowGroups;

    // Nada vencido quedo fuera: las dos filas OVERDUE son las visibles.
    expect(OVERDUE.hiddenCount).toBe(0);
    expect(OVERDUE.hiddenAmount).toBe(0);

    // El grupo "por vencer" no tiene ninguna fila visible propia: sus 2
    // cobros son la cuota de sept de Victor (visible dentro de SU fila) y la
    // reserva truncada. Solo esta ultima es invisible en el card.
    expect(DUE_SOON.count).toBe(2);
    expect(DUE_SOON.amount).toBe(400_000);
    expect(DUE_SOON.hiddenCount).toBe(1);
    expect(DUE_SOON.hiddenAmount).toBe(150_000);
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
});

// ─── Tests: próximo cobro accionable (Nivel 3, ADR-0017) ───────────────────────
//
// `computeNextCharge` es interna a `summary.ts`; se prueba a través de
// `collectionItems[].nextCharge`. Nota: una reserva solo produce un
// `DashboardCollectionItem` cuando `getCollectionStatus` la clasifica como
// OVERDUE/DUE_TODAY/UPCOMING (@/lib/reports/collection) — eso ya excluye
// deuda con vencimiento a más de 7 días, sin tocar `nextCharge`. Todos los
// fixtures de abajo usan un `startDate`/`dueDate` vencido para entrar en esa
// ventana; no es un requisito de `computeNextCharge`, es requisito de la
// función (preexistente, sin cambios en este trabajo) que decide qué filas
// llegan a "Por cobrar".
describe("buildDashboardSummary — nextCharge", () => {
  const OVERDUE_DAILY = {
    startDate: new Date("2026-08-19T00:00:00.000Z"), // 5 días antes de NOW (24 ago)
    endDate: new Date("2026-08-21T00:00:00.000Z"),
  };

  it("DAILY sin pagos: NEW con el totalPrice completo", () => {
    const reservation = makeReservation({
      billingType: "DAILY",
      totalPrice: 90_000,
      ...OVERDUE_DAILY,
      payments: [],
    });

    const summary = buildDashboardSummary(buildInput([reservation]));
    const item = summary.collectionItems.find((i) => i.reservationId === reservation.id);

    expect(item?.nextCharge).toEqual({ kind: "NEW", amount: 90_000 });
  });

  it("DAILY con un pago COMPLETED parcial: NEW con el saldo restante, no el total", () => {
    const reservation = makeReservation({
      billingType: "DAILY",
      totalPrice: 90_000,
      ...OVERDUE_DAILY,
      payments: [makePayment({ amount: 30_000, status: "COMPLETED", paymentType: "RESERVATION" })],
    });

    const summary = buildDashboardSummary(buildInput([reservation]));
    const item = summary.collectionItems.find((i) => i.reservationId === reservation.id);

    expect(item?.nextCharge).toEqual({ kind: "NEW", amount: 60_000 });
  });

  it("DAILY con un pago PENDING de Mercado Pago: EXISTING con method e initPoint, sin cuotas", () => {
    const reservation = makeReservation({
      billingType: "DAILY",
      totalPrice: 90_000,
      ...OVERDUE_DAILY,
      payments: [
        makePayment({
          amount: 90_000,
          status: "PENDING",
          paymentType: "RESERVATION",
          method: "MERCADO_PAGO",
          initPoint: "https://mp.com/checkout/abc",
        }),
      ],
    });

    const summary = buildDashboardSummary(buildInput([reservation]));
    const item = summary.collectionItems.find((i) => i.reservationId === reservation.id);
    const charge = item?.nextCharge as Extract<DashboardNextCharge, { kind: "EXISTING" }>;

    expect(charge.kind).toBe("EXISTING");
    expect(charge.method).toBe("MERCADO_PAGO");
    expect(charge.initPoint).toBe("https://mp.com/checkout/abc");
    expect(charge.installmentIndex).toBeNull();
    expect(charge.installmentCount).toBeNull();
  });

  it("MONTHLY con 2 cuotas vencidas y 1 por vencer: EXISTING de la de dueDate más antiguo, con installmentIndex e installmentCount", () => {
    const now = new Date("2026-08-28T18:00:00.000Z");
    const reservation = makeReservation({
      billingType: "MONTHLY",
      startDate: new Date("2026-07-01T00:00:00.000Z"),
      endDate: new Date("2026-09-30T00:00:00.000Z"),
      totalPrice: 750_000,
      payments: [
        // Orden de creación deliberadamente invertido: el resultado debe
        // depender de `dueDate`, no del orden del array ni de `createdAt`.
        makePayment({
          amount: 250_000,
          status: "PENDING",
          paymentType: "RESERVATION",
          dueDate: new Date("2026-09-01T00:00:00.000Z"),
          installmentIndex: 3,
        }),
        makePayment({
          amount: 250_000,
          status: "PENDING",
          paymentType: "RESERVATION",
          dueDate: new Date("2026-07-01T00:00:00.000Z"),
          installmentIndex: 1,
        }),
        makePayment({
          amount: 250_000,
          status: "PENDING",
          paymentType: "RESERVATION",
          dueDate: new Date("2026-08-01T00:00:00.000Z"),
          installmentIndex: 2,
        }),
      ],
    });

    const summary = buildDashboardSummary(buildInput([reservation], { now }));
    const item = summary.collectionItems[0];
    const charge = item.nextCharge as Extract<DashboardNextCharge, { kind: "EXISTING" }>;

    expect(charge.kind).toBe("EXISTING");
    expect(charge.installmentIndex).toBe(1);
    expect(charge.installmentCount).toBe(3);
    expect(charge.dueDate).toBe(new Date("2026-07-01T00:00:00.000Z").toISOString());
  });

  it("una cuota FAILED cuenta como impaga y puede ser el nextCharge", () => {
    const reservation = makeReservation({
      billingType: "MONTHLY",
      startDate: new Date("2026-07-01T00:00:00.000Z"),
      endDate: new Date("2026-07-31T00:00:00.000Z"),
      totalPrice: 250_000,
      payments: [
        makePayment({
          amount: 250_000,
          status: "FAILED",
          paymentType: "RESERVATION",
          dueDate: new Date("2026-07-01T00:00:00.000Z"),
          installmentIndex: 1,
        }),
      ],
    });

    const summary = buildDashboardSummary(buildInput([reservation]));
    const item = summary.collectionItems.find((i) => i.reservationId === reservation.id);
    const charge = item?.nextCharge as Extract<DashboardNextCharge, { kind: "EXISTING" }>;

    expect(charge.kind).toBe("EXISTING");
    expect(charge.status).toBe("FAILED");
  });

  it("un pago PENDING borrado (deletedAt) se ignora: el saldo completo queda sin Payment (NEW)", () => {
    const reservation = makeReservation({
      billingType: "DAILY",
      totalPrice: 90_000,
      ...OVERDUE_DAILY,
      payments: [
        makePayment({
          amount: 90_000,
          status: "PENDING",
          paymentType: "RESERVATION",
          method: "MERCADO_PAGO",
          initPoint: "https://mp.com/checkout/borrado",
          deletedAt: new Date("2026-08-20T00:00:00.000Z"),
        }),
      ],
    });

    const summary = buildDashboardSummary(buildInput([reservation]));
    const item = summary.collectionItems.find((i) => i.reservationId === reservation.id);

    expect(item?.nextCharge).toEqual({ kind: "NEW", amount: 90_000 });
  });

  it("clientEmail llega al item", () => {
    const reservation = makeReservation({
      billingType: "DAILY",
      totalPrice: 90_000,
      ...OVERDUE_DAILY,
      client: { id: "client-x", name: "Cliente X", phone: null, email: "cliente.x@test.com" },
    });

    const summary = buildDashboardSummary(buildInput([reservation]));
    const item = summary.collectionItems.find((i) => i.reservationId === reservation.id);

    expect(item?.clientEmail).toBe("cliente.x@test.com");
  });

  // Escenarios validados por el tester con mezclas reales (2026-09-15) y
  // vueltos permanentes: son los que un cambio de orden en `computeNextCharge`
  // rompería sin que ningún otro test lo note.

  it("cuotas pagadas fuera de orden: apunta a la impaga, y installmentCount cuenta también las pagadas", () => {
    const now = new Date("2026-08-28T18:00:00.000Z");
    const reservation = makeReservation({
      billingType: "MONTHLY",
      startDate: new Date("2026-07-01T00:00:00.000Z"),
      endDate: new Date("2026-09-30T00:00:00.000Z"),
      totalPrice: 750_000,
      payments: [
        makePayment({
          amount: 250_000,
          status: "COMPLETED",
          dueDate: new Date("2026-07-01T00:00:00.000Z"),
          installmentIndex: 1,
          paidAt: new Date("2026-07-02T15:00:00.000Z"),
        }),
        makePayment({
          amount: 250_000,
          status: "PENDING",
          dueDate: new Date("2026-08-01T00:00:00.000Z"),
          installmentIndex: 2,
        }),
        // La 3 se pagó adelantada mientras la 2 sigue impaga.
        makePayment({
          amount: 250_000,
          status: "COMPLETED",
          dueDate: new Date("2026-09-01T00:00:00.000Z"),
          installmentIndex: 3,
          paidAt: new Date("2026-08-05T15:00:00.000Z"),
        }),
      ],
    });

    const summary = buildDashboardSummary(buildInput([reservation], { now }));
    const charge = summary.collectionItems[0].nextCharge as Extract<
      DashboardNextCharge,
      { kind: "EXISTING" }
    >;

    expect(charge.kind).toBe("EXISTING");
    expect(charge.installmentIndex).toBe(2);
    expect(charge.installmentCount).toBe(3);
  });

  it("DAILY con un pago parcial y un PENDING de MP por el resto: actúa sobre el PENDING, no crea otro por el saldo", () => {
    const reservation = makeReservation({
      billingType: "DAILY",
      totalPrice: 90_000,
      ...OVERDUE_DAILY,
      payments: [
        makePayment({ amount: 30_000, status: "COMPLETED", paidAt: NOW }),
        makePayment({ amount: 60_000, status: "PENDING", method: "MERCADO_PAGO" }),
      ],
    });

    const summary = buildDashboardSummary(buildInput([reservation]));
    const charge = summary.collectionItems[0].nextCharge as Extract<
      DashboardNextCharge,
      { kind: "EXISTING" }
    >;

    expect(charge.kind).toBe("EXISTING");
    expect(charge.amount).toBe(60_000);
    expect(charge.method).toBe("MERCADO_PAGO");
  });

  it("una FAILED con dueDate más antiguo gana sobre una PENDING: manda la fecha, no el estado", () => {
    const now = new Date("2026-08-28T18:00:00.000Z");
    const reservation = makeReservation({
      billingType: "MONTHLY",
      startDate: new Date("2026-07-01T00:00:00.000Z"),
      endDate: new Date("2026-08-31T00:00:00.000Z"),
      totalPrice: 500_000,
      payments: [
        makePayment({
          amount: 250_000,
          status: "PENDING",
          dueDate: new Date("2026-08-01T00:00:00.000Z"),
          installmentIndex: 2,
        }),
        makePayment({
          amount: 250_000,
          status: "FAILED",
          dueDate: new Date("2026-07-01T00:00:00.000Z"),
          installmentIndex: 1,
        }),
      ],
    });

    const summary = buildDashboardSummary(buildInput([reservation], { now }));
    const charge = summary.collectionItems[0].nextCharge as Extract<
      DashboardNextCharge,
      { kind: "EXISTING" }
    >;

    expect(charge.installmentIndex).toBe(1);
    expect(charge.status).toBe("FAILED");
  });

  it("dos PENDING sin dueDate: gana el creado primero", () => {
    const primero = makePayment({
      amount: 40_000,
      status: "PENDING",
      method: "MERCADO_PAGO",
      createdAt: new Date("2026-08-20T15:00:00.000Z"),
    });
    const segundo = makePayment({
      amount: 50_000,
      status: "PENDING",
      method: "MERCADO_PAGO",
      createdAt: new Date("2026-08-22T15:00:00.000Z"),
    });
    const reservation = makeReservation({
      billingType: "DAILY",
      totalPrice: 90_000,
      ...OVERDUE_DAILY,
      // El array trae primero al más nuevo: el orden no puede venir del array.
      payments: [segundo, primero],
    });

    const summary = buildDashboardSummary(buildInput([reservation]));
    const charge = summary.collectionItems[0].nextCharge as Extract<
      DashboardNextCharge,
      { kind: "EXISTING" }
    >;

    expect(charge.paymentId).toBe(primero.id);
  });

  // Toda fila de "Por cobrar" tiene plata en la ventana, así que siempre hay un
  // cobro sobre el que actuar: una fila sin `nextCharge` quedaría sin botones.
  it("toda fila de collectionItems tiene nextCharge, con una mezcla de casos", () => {
    const now = new Date("2026-08-28T18:00:00.000Z");
    const reservations = [
      makeReservation({ billingType: "DAILY", totalPrice: 80_000, ...OVERDUE_DAILY }),
      makeReservation({
        billingType: "DAILY",
        totalPrice: 80_000,
        ...OVERDUE_DAILY,
        payments: [makePayment({ amount: 20_000, status: "COMPLETED", paidAt: NOW })],
      }),
      makeReservation({
        billingType: "DAILY",
        totalPrice: 80_000,
        startDate: new Date("2026-08-30T15:00:00.000Z"),
        endDate: new Date("2026-09-01T15:00:00.000Z"),
        payments: [makePayment({ amount: 80_000, status: "PENDING", method: "MERCADO_PAGO" })],
      }),
      makeReservation({
        billingType: "MONTHLY",
        startDate: new Date("2026-07-01T00:00:00.000Z"),
        endDate: new Date("2026-09-30T00:00:00.000Z"),
        totalPrice: 300_000,
        payments: [
          makePayment({ amount: 100_000, status: "FAILED", dueDate: new Date("2026-07-01T00:00:00.000Z"), installmentIndex: 1 }),
          makePayment({ amount: 100_000, status: "PENDING", dueDate: new Date("2026-08-01T00:00:00.000Z"), installmentIndex: 2 }),
          makePayment({ amount: 100_000, status: "PENDING", dueDate: new Date("2026-09-01T00:00:00.000Z"), installmentIndex: 3 }),
        ],
      }),
    ];

    const summary = buildDashboardSummary(
      buildInput(reservations, { now, collectionLimit: reservations.length }),
    );

    expect(summary.collectionItems.length).toBe(reservations.length);
    for (const item of summary.collectionItems) {
      expect(item.nextCharge).not.toBeNull();
    }
  });

  // No probado vía `collectionItems`: el fallback a EXTRA (regla 3) solo se
  // alcanza cuando el arriendo está 100% pagado (`pendingAmount === 0`), y en
  // ese caso `buildCollectionReportRows` deja `nextDueDate: null` — la fila
  // queda clasificada "PENDING" genérico por `getCollectionStatus`, fuera de
  // los tres buckets (OVERDUE/DUE_TODAY/UPCOMING) que alimentan
  // `collectionItems`. Es una fila real en `collection.totalToCollect`, pero
  // invisible en "Por cobrar" hoy — brecha preexistente de `collection.ts`,
  // no introducida por este cambio, y fuera de su alcance (afecta /reports).
  // La regla 3 de `computeNextCharge` queda implementada para cuando esa
  // brecha se cierre, pero hoy es inalcanzable por esta vía.
});

// ─── Tests: agenda (llegadas/salidas por día) ──────────────────────────────────

describe("buildDashboardSummary — agenda", () => {
  it("DAILY con startDate hoy genera un evento ARRIVAL en offset 0", () => {
    const reservation = makeReservation({
      billingType: "DAILY",
      status: "CONFIRMED",
      startDate: new Date("2026-08-24T15:00:00.000Z"), // hoy (NOW = 24 ago)
      endDate: new Date("2026-08-27T15:00:00.000Z"),
    });

    const summary = buildDashboardSummary(buildInput([reservation]));

    const today = summary.agenda.days.find((d) => d.offset === 0);
    const arrival = today?.events.find((e) => e.reservationId === reservation.id);
    expect(arrival?.kind).toBe("ARRIVAL");
  });

  it("endDate = ayer genera DEPARTURE en offset 0; endDate = hoy genera DEPARTURE en offset 1 (no hoy)", () => {
    const departsToday = makeReservation({
      billingType: "DAILY",
      status: "CONFIRMED",
      startDate: new Date("2026-08-20T15:00:00.000Z"),
      endDate: new Date("2026-08-23T15:00:00.000Z"), // ayer → sale hoy
    });
    const departsTomorrow = makeReservation({
      billingType: "DAILY",
      status: "CONFIRMED",
      startDate: new Date("2026-08-20T15:00:00.000Z"),
      endDate: new Date("2026-08-24T15:00:00.000Z"), // hoy → sale mañana
    });

    const summary = buildDashboardSummary(buildInput([departsToday, departsTomorrow]));

    const today = summary.agenda.days.find((d) => d.offset === 0);
    const tomorrow = summary.agenda.days.find((d) => d.offset === 1);

    expect(
      today?.events.some((e) => e.reservationId === departsToday.id && e.kind === "DEPARTURE"),
    ).toBe(true);
    expect(today?.events.some((e) => e.reservationId === departsTomorrow.id)).toBe(false);
    expect(
      tomorrow?.events.some((e) => e.reservationId === departsTomorrow.id && e.kind === "DEPARTURE"),
    ).toBe(true);
  });

  it("llegada en offset 6 entra al horizonte; llegada en offset 7 no entra y queda como nextEventAfterHorizon", () => {
    const arrivesInHorizon = makeReservation({
      billingType: "DAILY",
      status: "CONFIRMED",
      startDate: new Date("2026-08-30T15:00:00.000Z"), // offset 6
      endDate: new Date("2026-09-02T15:00:00.000Z"),
    });
    const arrivesAfterHorizon = makeReservation({
      billingType: "DAILY",
      status: "CONFIRMED",
      startDate: new Date("2026-08-31T15:00:00.000Z"), // offset 7
      endDate: new Date("2026-09-03T15:00:00.000Z"),
    });

    const summary = buildDashboardSummary(buildInput([arrivesInHorizon, arrivesAfterHorizon]));

    const dayIn = summary.agenda.days.find((d) => d.offset === 6);
    expect(
      dayIn?.events.some((e) => e.reservationId === arrivesInHorizon.id && e.kind === "ARRIVAL"),
    ).toBe(true);

    expect(summary.agenda.days.some((d) => d.offset === 7)).toBe(false);
    expect(summary.agenda.nextEventAfterHorizon).toEqual({ dateKey: "2026-08-31", offset: 7 });
  });

  it("una reserva CANCELLED no genera eventos de agenda ni cuenta para nextEventAfterHorizon", () => {
    const cancelled = makeReservation({
      billingType: "DAILY",
      status: "CANCELLED",
      startDate: new Date("2026-08-24T15:00:00.000Z"), // hoy
      endDate: new Date("2026-09-05T15:00:00.000Z"), // su DEPARTURE caería fuera del horizonte
    });

    const summary = buildDashboardSummary(buildInput([cancelled]));

    for (const day of summary.agenda.days) {
      expect(day.events.some((e) => e.reservationId === cancelled.id)).toBe(false);
    }
    expect(summary.agenda.nextEventAfterHorizon).toBeNull();
  });

  it("MONTHLY con endDate 2026-08-31 genera DEPARTURE el 2026-09-01 (cruce de mes) con months correcto", () => {
    const now = new Date("2026-08-28T15:00:00.000Z");
    const reservation = makeReservation({
      billingType: "MONTHLY",
      status: "CONFIRMED",
      startDate: new Date("2026-06-01T15:00:00.000Z"),
      endDate: new Date("2026-08-31T15:00:00.000Z"), // última noche del mes
      totalPrice: 900_000,
    });

    const summary = buildDashboardSummary(buildInput([reservation], { now }));

    const departureDay = summary.agenda.days.find((d) => d.dateKey === "2026-09-01");
    expect(departureDay?.offset).toBe(4);
    const event = departureDay?.events.find((e) => e.reservationId === reservation.id);
    expect(event?.kind).toBe("DEPARTURE");
    expect(event?.months).toBe(3); // jun, jul, ago
  });

  it("hoy aparece en la agenda aunque no tenga eventos; los días sin eventos no aparecen", () => {
    const reservation = makeReservation({
      billingType: "DAILY",
      status: "CONFIRMED",
      startDate: new Date("2026-08-27T15:00:00.000Z"), // offset 3, único evento cercano
      endDate: new Date("2026-08-29T15:00:00.000Z"),
    });

    const summary = buildDashboardSummary(buildInput([reservation]));

    const today = summary.agenda.days.find((d) => d.offset === 0);
    expect(today).toBeDefined();
    expect(today?.events).toHaveLength(0);

    expect(summary.agenda.days.some((d) => d.offset === 1)).toBe(false);
    expect(summary.agenda.days.some((d) => d.offset === 2)).toBe(false);
    expect(summary.agenda.days.some((d) => d.offset === 3)).toBe(true);
  });

  it("en el mismo día, DEPARTURE va antes que ARRIVAL, y por propertyName dentro de cada tipo", () => {
    const departureZ = makeReservation({
      billingType: "DAILY",
      status: "CONFIRMED",
      property: { id: "prop-z", name: "Zeta", color: "#000" },
      startDate: new Date("2026-08-20T15:00:00.000Z"),
      endDate: new Date("2026-08-23T15:00:00.000Z"), // sale hoy
    });
    const departureA = makeReservation({
      billingType: "DAILY",
      status: "CONFIRMED",
      property: { id: "prop-a", name: "Alfa", color: "#000" },
      startDate: new Date("2026-08-20T15:00:00.000Z"),
      endDate: new Date("2026-08-23T15:00:00.000Z"), // sale hoy
    });
    const arrivalToday = makeReservation({
      billingType: "DAILY",
      status: "CONFIRMED",
      property: { id: "prop-b", name: "Beta", color: "#000" },
      startDate: new Date("2026-08-24T15:00:00.000Z"), // llega hoy
      endDate: new Date("2026-08-27T15:00:00.000Z"),
    });

    const summary = buildDashboardSummary(buildInput([departureZ, departureA, arrivalToday]));

    const today = summary.agenda.days.find((d) => d.offset === 0);
    expect(today?.events.map((e) => `${e.kind}:${e.propertyName}`)).toEqual([
      "DEPARTURE:Alfa",
      "DEPARTURE:Zeta",
      "ARRIVAL:Beta",
    ]);
  });

  it("amountDue de un evento coincide con el monto de cobranza (0 si está pagada) y hasNoPayments refleja si hubo un pago completado — incluye una reserva fuera de collectionItems por el tope", () => {
    // 4 reservas de relleno más vencidas que la reserva bajo prueba, para
    // que esta última quede en la posición 5 y salga del recorte por
    // `collectionLimit` (default 4).
    const paddingDueDates = [
      "2026-08-14T15:00:00.000Z",
      "2026-08-15T15:00:00.000Z",
      "2026-08-16T15:00:00.000Z",
      "2026-08-17T15:00:00.000Z",
    ];
    const paddingReservations = paddingDueDates.map((dueDate) =>
      makeReservation({
        billingType: "MONTHLY",
        status: "CONFIRMED",
        startDate: new Date("2026-01-01T15:00:00.000Z"),
        endDate: new Date("2026-01-05T15:00:00.000Z"), // sin eventos en el horizonte
        totalPrice: 100_000,
        payments: [
          makePayment({ amount: 100_000, status: "PENDING", paymentType: "RESERVATION", dueDate: new Date(dueDate) }),
        ],
      }),
    );

    // La menos vencida de las 5 → queda fuera de `collectionItems`, pero
    // sale HOY (DEPARTURE) y debe traer su monto real igual.
    const departingHidden = makeReservation({
      billingType: "MONTHLY",
      status: "CONFIRMED",
      startDate: new Date("2026-06-01T15:00:00.000Z"),
      endDate: new Date("2026-08-23T15:00:00.000Z"), // ayer → DEPARTURE hoy
      totalPrice: 50_000,
      payments: [
        makePayment({ amount: 50_000, status: "PENDING", paymentType: "RESERVATION", dueDate: new Date("2026-08-23T15:00:00.000Z") }),
      ],
    });

    const paidArrival = makeReservation({
      billingType: "MONTHLY",
      status: "CONFIRMED",
      startDate: new Date("2026-08-25T15:00:00.000Z"), // mañana
      endDate: new Date("2026-10-31T15:00:00.000Z"),
      totalPrice: 200_000,
      payments: [
        makePayment({ amount: 200_000, status: "COMPLETED", paymentType: "RESERVATION", paidAt: NOW }),
      ],
    });

    const summary = buildDashboardSummary(
      buildInput([...paddingReservations, departingHidden, paidArrival]),
    );

    expect(summary.collectionItems.some((i) => i.reservationId === departingHidden.id)).toBe(false);

    const today = summary.agenda.days.find((d) => d.offset === 0);
    const departureEvent = today?.events.find((e) => e.reservationId === departingHidden.id);
    expect(departureEvent?.amountDue).toBe(50_000);
    expect(departureEvent?.hasNoPayments).toBe(true);

    const tomorrow = summary.agenda.days.find((d) => d.offset === 1);
    const arrivalEvent = tomorrow?.events.find((e) => e.reservationId === paidArrival.id);
    expect(arrivalEvent?.amountDue).toBe(0);
    expect(arrivalEvent?.hasNoPayments).toBe(false);
  });

  it("cerca de medianoche en Santiago, todayKey y la agenda usan el día de Santiago, no el UTC", () => {
    const now = new Date("2026-09-15T02:30:00.000Z"); // 14 sept 23:30 en Santiago (ya en horario de verano)
    const reservation = makeReservation({
      billingType: "DAILY",
      status: "CONFIRMED",
      startDate: new Date("2026-09-14T15:00:00.000Z"), // "hoy" en Santiago
      endDate: new Date("2026-09-17T15:00:00.000Z"),
    });

    const summary = buildDashboardSummary(buildInput([reservation], { now }));

    expect(summary.todayKey).toBe("2026-09-14");
    const today = summary.agenda.days.find((d) => d.offset === 0);
    expect(today?.dateKey).toBe("2026-09-14");
    expect(
      today?.events.some((e) => e.reservationId === reservation.id && e.kind === "ARRIVAL"),
    ).toBe(true);
  });

  // Los dos cambios de hora de Chile en 2026, medidos con Intl: en septiembre
  // el reloj salta de sáb 5 23:59 (GMT-4) a dom 6 01:00 (GMT-3) a las 04:00
  // UTC; en abril, a las 03:00 UTC, vuelve de sáb 4 23:59 (GMT-3) a sáb 4
  // 23:00 (GMT-4). Abril es el caso traicionero: un offset fijo de -3 cambiaría
  // de día una hora antes, con la agenda de mañana mostrada como hoy.
  it("en los dos cambios de hora del año, hoy cambia a la medianoche de Santiago", () => {
    const septArrival = makeReservation({
      billingType: "DAILY",
      status: "CONFIRMED",
      startDate: new Date("2026-09-06T15:00:00.000Z"),
      endDate: new Date("2026-09-08T15:00:00.000Z"),
    });
    const beforeJump = buildDashboardSummary(
      buildInput([septArrival], { now: new Date("2026-09-06T03:59:00.000Z") }),
    );
    const afterJump = buildDashboardSummary(
      buildInput([septArrival], { now: new Date("2026-09-06T04:01:00.000Z") }),
    );
    expect(beforeJump.todayKey).toBe("2026-09-05");
    expect(beforeJump.agenda.days.find((d) => d.dateKey === "2026-09-06")?.offset).toBe(1);
    expect(afterJump.todayKey).toBe("2026-09-06");
    expect(afterJump.agenda.days[0].dateKey).toBe("2026-09-06");
    expect(afterJump.agenda.days[0].events.map((e) => e.kind)).toEqual(["ARRIVAL"]);

    const aprilArrival = makeReservation({
      billingType: "DAILY",
      status: "CONFIRMED",
      startDate: new Date("2026-04-05T15:00:00.000Z"),
      endDate: new Date("2026-04-07T15:00:00.000Z"),
    });
    // 03:30 UTC ya es "5 de abril" con offset -3, pero en Santiago son las
    // 23:30 del 4: el reloj acaba de retroceder una hora.
    const repeatedHour = buildDashboardSummary(
      buildInput([aprilArrival], { now: new Date("2026-04-05T03:30:00.000Z") }),
    );
    expect(repeatedHour.todayKey).toBe("2026-04-04");
    expect(repeatedHour.agenda.days.find((d) => d.dateKey === "2026-04-05")?.offset).toBe(1);
  });
});

// ─── Tests: tablero de propiedades ──────────────────────────────────────────────

describe("buildDashboardSummary — tablero de propiedades", () => {
  it("DAILY que cubre hoy queda OCCUPIED con releaseDateKey = endDate + 1; endDate = ayer → FREE; startDate = hoy → OCCUPIED", () => {
    const propCovering = { id: "prop-covering", name: "Covering", unitsAvailable: 1 };
    const propEnded = { id: "prop-ended", name: "Ended", unitsAvailable: 1 };
    const propStarting = { id: "prop-starting", name: "Starting", unitsAvailable: 1 };

    const covering = makeReservation({
      propertyId: propCovering.id,
      property: { id: propCovering.id, name: propCovering.name, color: "#000" },
      billingType: "DAILY",
      status: "CONFIRMED",
      startDate: new Date("2026-08-22T15:00:00.000Z"),
      endDate: new Date("2026-08-26T15:00:00.000Z"),
    });
    const ended = makeReservation({
      propertyId: propEnded.id,
      property: { id: propEnded.id, name: propEnded.name, color: "#000" },
      billingType: "DAILY",
      status: "CONFIRMED",
      startDate: new Date("2026-08-18T15:00:00.000Z"),
      endDate: new Date("2026-08-23T15:00:00.000Z"), // ayer
    });
    const starting = makeReservation({
      propertyId: propStarting.id,
      property: { id: propStarting.id, name: propStarting.name, color: "#000" },
      billingType: "DAILY",
      status: "CONFIRMED",
      startDate: new Date("2026-08-24T15:00:00.000Z"), // hoy
      endDate: new Date("2026-08-28T15:00:00.000Z"),
    });

    const summary = buildDashboardSummary(
      buildInput([covering, ended, starting], {
        properties: [propCovering, propEnded, propStarting],
      }),
    );
    const byId = (id: string) => summary.propertyBoard.properties.find((p) => p.propertyId === id);

    expect(byId(propCovering.id)?.state).toBe("OCCUPIED");
    expect(byId(propCovering.id)?.nextRelease?.releaseDateKey).toBe("2026-08-27");

    expect(byId(propEnded.id)?.state).toBe("FREE");
    expect(byId(propEnded.id)?.nextRelease).toBeNull();

    expect(byId(propStarting.id)?.state).toBe("OCCUPIED");
    expect(byId(propStarting.id)?.nextRelease?.releaseDateKey).toBe("2026-08-29");
  });

  it("MONTHLY que cubre hoy queda OCCUPIED con billingType MONTHLY y lastNightKey = endDate", () => {
    const reservation = makeReservation({
      billingType: "MONTHLY",
      status: "CONFIRMED",
      startDate: new Date("2026-08-01T15:00:00.000Z"),
      endDate: new Date("2026-10-31T15:00:00.000Z"),
      totalPrice: 900_000,
    });

    // Una unidad: con las 3 del fixture por defecto, un solo contrato deja la
    // propiedad PARTIAL, que es correcto pero no es lo que prueba este caso.
    const summary = buildDashboardSummary(
      buildInput([reservation], { properties: [makeProperty({ unitsAvailable: 1 })] }),
    );

    const property = summary.propertyBoard.properties.find((p) => p.propertyId === PROPERTY.id);
    expect(property?.state).toBe("OCCUPIED");
    expect(property?.nextRelease?.source).toBe("RESERVATION");
    expect(property?.nextRelease?.billingType).toBe("MONTHLY");
    expect(property?.nextRelease?.lastNightKey).toBe("2026-10-31");
  });

  it("propiedad de 3 unidades con unitsBooked=2 queda PARTIAL; con unitsBooked=3 queda OCCUPIED", () => {
    const partial = makeReservation({
      billingType: "DAILY",
      status: "CONFIRMED",
      unitsBooked: 2,
      startDate: new Date("2026-08-22T15:00:00.000Z"),
      endDate: new Date("2026-08-26T15:00:00.000Z"),
    });
    const partialSummary = buildDashboardSummary(buildInput([partial])); // PROPERTY.unitsAvailable = 3
    const partialProperty = partialSummary.propertyBoard.properties.find(
      (p) => p.propertyId === PROPERTY.id,
    );
    expect(partialProperty?.state).toBe("PARTIAL");
    expect(partialProperty?.unitsOccupied).toBe(2);

    const full = makeReservation({
      billingType: "DAILY",
      status: "CONFIRMED",
      unitsBooked: 3,
      startDate: new Date("2026-08-22T15:00:00.000Z"),
      endDate: new Date("2026-08-26T15:00:00.000Z"),
    });
    const fullSummary = buildDashboardSummary(buildInput([full]));
    const fullProperty = fullSummary.propertyBoard.properties.find(
      (p) => p.propertyId === PROPERTY.id,
    );
    expect(fullProperty?.state).toBe("OCCUPIED");
    expect(fullProperty?.unitsOccupied).toBe(3);
  });

  it("un bloqueo externo que cubre hoy en una propiedad de 1 unidad la deja OCCUPIED (EXTERNAL_BLOCK, con channel); bloqueo + reserva suman unidades", () => {
    const singleUnitProperty = { id: "prop-single", name: "Studio", unitsAvailable: 1 };
    const blockOnly: DashboardExternalBlockInput = {
      propertyId: singleUnitProperty.id,
      startDate: new Date("2026-08-22T15:00:00.000Z"),
      endDate: new Date("2026-08-26T15:00:00.000Z"),
      channel: "AIRBNB",
    };

    const onlyBlockSummary = buildDashboardSummary(
      buildInput([], { properties: [singleUnitProperty], externalBlocks: [blockOnly] }),
    );
    const onlyBlockProperty = onlyBlockSummary.propertyBoard.properties.find(
      (p) => p.propertyId === singleUnitProperty.id,
    );
    expect(onlyBlockProperty?.state).toBe("OCCUPIED");
    expect(onlyBlockProperty?.nextRelease?.source).toBe("EXTERNAL_BLOCK");
    expect(onlyBlockProperty?.nextRelease?.channel).toBe("AIRBNB");
    expect(onlyBlockProperty?.nextRelease?.reservationId).toBeNull();
    expect(onlyBlockProperty?.nextRelease?.billingType).toBeNull();

    const reservationSameProperty = makeReservation({
      billingType: "DAILY",
      status: "CONFIRMED",
      unitsBooked: 2,
      startDate: new Date("2026-08-22T15:00:00.000Z"),
      endDate: new Date("2026-08-26T15:00:00.000Z"),
    });
    const blockSameProperty: DashboardExternalBlockInput = {
      propertyId: PROPERTY.id,
      startDate: new Date("2026-08-23T15:00:00.000Z"),
      endDate: new Date("2026-08-25T15:00:00.000Z"),
      channel: "BOOKING_COM",
    };

    const mixedSummary = buildDashboardSummary(
      buildInput([reservationSameProperty], { externalBlocks: [blockSameProperty] }),
    );
    const mixedProperty = mixedSummary.propertyBoard.properties.find(
      (p) => p.propertyId === PROPERTY.id,
    );
    expect(mixedProperty?.unitsOccupied).toBe(3); // 2 (reserva) + 1 (bloqueo)
  });

  it("con sobreventa unitsOccupied no tiene tope, pero el agregado occupiedUnits queda topado por propiedad", () => {
    const reservationA = makeReservation({
      billingType: "DAILY",
      status: "CONFIRMED",
      unitsBooked: 2,
      startDate: new Date("2026-08-22T15:00:00.000Z"),
      endDate: new Date("2026-08-26T15:00:00.000Z"),
    });
    const reservationB = makeReservation({
      billingType: "DAILY",
      status: "CONFIRMED",
      unitsBooked: 2,
      startDate: new Date("2026-08-23T15:00:00.000Z"),
      endDate: new Date("2026-08-25T15:00:00.000Z"),
    });

    const summary = buildDashboardSummary(buildInput([reservationA, reservationB])); // unitsAvailable = 3

    const property = summary.propertyBoard.properties.find((p) => p.propertyId === PROPERTY.id);
    expect(property?.unitsOccupied).toBe(4); // 2 + 2, sin tope
    expect(property?.state).toBe("OCCUPIED");
    expect(summary.propertyBoard.occupiedUnits).toBe(3); // topado a unitsAvailable
    expect(summary.propertyBoard.totalUnits).toBe(3);
  });

  it("nextRelease elige al ocupante que se libera primero; nextArrival ignora CANCELLED y toma el startDate futuro más próximo", () => {
    const releasesFirst = makeReservation({
      billingType: "DAILY",
      status: "CONFIRMED",
      startDate: new Date("2026-08-22T15:00:00.000Z"),
      endDate: new Date("2026-08-24T15:00:00.000Z"), // libera mañana
    });
    const releasesLater = makeReservation({
      billingType: "DAILY",
      status: "CONFIRMED",
      startDate: new Date("2026-08-20T15:00:00.000Z"),
      endDate: new Date("2026-08-29T15:00:00.000Z"), // libera en 6 días
    });
    const cancelledSoon = makeReservation({
      billingType: "DAILY",
      status: "CANCELLED",
      startDate: new Date("2026-08-25T15:00:00.000Z"), // sería la más próxima si no estuviera cancelada
      endDate: new Date("2026-08-27T15:00:00.000Z"),
    });
    const arrivesLater = makeReservation({
      billingType: "DAILY",
      status: "CONFIRMED",
      startDate: new Date("2026-08-30T15:00:00.000Z"),
      endDate: new Date("2026-09-02T15:00:00.000Z"),
    });

    const summary = buildDashboardSummary(
      buildInput([releasesFirst, releasesLater, cancelledSoon, arrivesLater]),
    );

    const property = summary.propertyBoard.properties.find((p) => p.propertyId === PROPERTY.id);
    expect(property?.nextRelease?.reservationId).toBe(releasesFirst.id);
    expect(property?.nextArrival?.reservationId).toBe(arrivesLater.id);
  });

  it("una propiedad sin reservas aparece como FREE con nextRelease/nextArrival null; el tablero trae TODAS las propiedades", () => {
    const properties = Array.from({ length: 8 }, (_, i) => ({
      id: `prop-${i + 1}`,
      name: `Propiedad ${i + 1}`,
      unitsAvailable: 1,
    }));
    const reservation = makeReservation({
      propertyId: properties[0].id,
      property: { id: properties[0].id, name: properties[0].name, color: "#000" },
      billingType: "DAILY",
      status: "CONFIRMED",
      startDate: new Date("2026-08-22T15:00:00.000Z"),
      endDate: new Date("2026-08-26T15:00:00.000Z"),
    });

    const summary = buildDashboardSummary(buildInput([reservation], { properties }));

    expect(summary.propertyBoard.properties).toHaveLength(8);
    const emptyProperty = summary.propertyBoard.properties.find(
      (p) => p.propertyId === properties[1].id,
    );
    expect(emptyProperty?.state).toBe("FREE");
    expect(emptyProperty?.nextRelease).toBeNull();
    expect(emptyProperty?.nextArrival).toBeNull();
  });

  it("ordena ocupadas por liberación, luego libres con llegada, luego libres sin llegada por nombre; agrega occupiedUnits/totalUnits/allSingleUnit", () => {
    const occupiedReleasesLater = { id: "prop-occ-later", name: "Ocupada Tarde", unitsAvailable: 1 };
    const occupiedReleasesFirst = { id: "prop-occ-first", name: "Ocupada Pronto", unitsAvailable: 1 };
    const freeWithArrivalLater = { id: "prop-free-arr-later", name: "Libre Llega Tarde", unitsAvailable: 1 };
    const freeWithArrivalFirst = { id: "prop-free-arr-first", name: "Libre Llega Pronto", unitsAvailable: 1 };
    const freeNoArrivalZ = { id: "prop-free-z", name: "Zeta Libre", unitsAvailable: 1 };
    const freeNoArrivalA = { id: "prop-free-a", name: "Alfa Libre", unitsAvailable: 1 };

    const properties = [
      occupiedReleasesLater,
      occupiedReleasesFirst,
      freeWithArrivalLater,
      freeWithArrivalFirst,
      freeNoArrivalZ,
      freeNoArrivalA,
    ];

    const mkRes = (property: { id: string; name: string }, startDate: string, endDate: string) =>
      makeReservation({
        propertyId: property.id,
        property: { id: property.id, name: property.name, color: "#000" },
        billingType: "DAILY",
        status: "CONFIRMED",
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      });

    const reservations = [
      mkRes(occupiedReleasesLater, "2026-08-20T15:00:00.000Z", "2026-08-29T15:00:00.000Z"), // libera en 6 días
      mkRes(occupiedReleasesFirst, "2026-08-20T15:00:00.000Z", "2026-08-24T15:00:00.000Z"), // libera mañana
      mkRes(freeWithArrivalLater, "2026-09-01T15:00:00.000Z", "2026-09-05T15:00:00.000Z"), // llega en 8 días
      mkRes(freeWithArrivalFirst, "2026-08-27T15:00:00.000Z", "2026-08-30T15:00:00.000Z"), // llega en 3 días
    ];

    const summary = buildDashboardSummary(buildInput(reservations, { properties }));

    expect(summary.propertyBoard.properties.map((p) => p.propertyId)).toEqual([
      occupiedReleasesFirst.id,
      occupiedReleasesLater.id,
      freeWithArrivalFirst.id,
      freeWithArrivalLater.id,
      freeNoArrivalA.id,
      freeNoArrivalZ.id,
    ]);

    expect(summary.propertyBoard.totalUnits).toBe(6);
    expect(summary.propertyBoard.occupiedUnits).toBe(2);
    expect(summary.propertyBoard.allSingleUnit).toBe(true);
  });
});

// ─── Tests: el mes en curso ─────────────────────────────────────────────────────

describe("buildDashboardSummary — mes en curso", () => {
  it("incluye una reserva #11 (fuera del recorte legacy de limit=10) en month.collected", () => {
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
    expect(summary.month.collected).toBe(11_000);
  });

  it("un pago EXTRA completado no suma a month.collected (ADR-0028 §1)", () => {
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

    expect(summary.month.collected).toBe(50_000);
  });

  it("month.collected coincide exacto con buildDecisionSummary(mismo rango).collectedCash", () => {
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

    expect(summary.month.collected).toBe(directDecision.collectedCash);
    // Sanity: incluye cash de reservas CANCELLED (25.000) + activa (75.000) = 100.000,
    // excluye el pago de julio (40.000).
    expect(summary.month.collected).toBe(100_000);
  });

  it("collectedPreviousSamePeriod cuenta un pago del 20 jul y NO uno del 28 jul, cuando NOW es 24 ago", () => {
    const reservations = [
      makeReservation({
        payments: [
          makePayment({
            amount: 40_000,
            status: "COMPLETED",
            paymentType: "RESERVATION",
            paidAt: new Date("2026-07-20T15:00:00.000Z"),
          }),
        ],
      }),
      makeReservation({
        payments: [
          makePayment({
            amount: 90_000,
            status: "COMPLETED",
            paymentType: "RESERVATION",
            paidAt: new Date("2026-07-28T15:00:00.000Z"),
          }),
        ],
      }),
    ];

    const summary = buildDashboardSummary(buildInput(reservations));

    expect(summary.month.previousCutoffDay).toBe(24);
    expect(summary.month.collectedPreviousSamePeriod).toBe(40_000);
  });

  it("NOW 2026-03-31 recorta el mes anterior al día 28 (feb no bisiesto); NOW en enero apunta a diciembre del año anterior", () => {
    const marchSummary = buildDashboardSummary(
      buildInput([], { now: new Date("2026-03-31T15:00:00.000Z") }),
    );
    expect(marchSummary.month.previousCutoffDay).toBe(28);
    expect(marchSummary.month.previousMonthKey).toBe("2026-02");

    const januarySummary = buildDashboardSummary(
      buildInput([], { now: new Date("2026-01-15T15:00:00.000Z") }),
    );
    expect(januarySummary.month.previousMonthKey).toBe("2025-12");
  });

  it("month.occupancyRate coincide con buildDecisionSummary llamado directo sobre el mes en curso", () => {
    const reservations = [
      makeReservation({
        billingType: "DAILY",
        status: "CONFIRMED",
        startDate: new Date("2026-08-10T15:00:00.000Z"),
        endDate: new Date("2026-08-15T15:00:00.000Z"),
      }),
    ];

    const input = buildInput(reservations);
    const summary = buildDashboardSummary(input);

    const directDecision = buildDecisionSummary({
      reservations: input.reservations,
      properties: input.properties,
      rangeStart: new Date("2026-08-01T00:00:00.000Z"),
      rangeEnd: new Date("2026-08-31T00:00:00.000Z"),
    });

    expect(summary.month.occupancyRate).toBe(directDecision.occupancyRate);
    expect(summary.month.occupiedNightUnits).toBe(directDecision.occupiedNightUnits);
    expect(summary.month.capacityNightUnits).toBe(directDecision.capacityNightUnits);
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
