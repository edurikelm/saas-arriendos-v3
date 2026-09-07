import { describe, it, expect } from "vitest";
import { getFinanceDisplay } from "../reservation-finance";
import type { ReservationPayment } from "../types";

function pay(amount: number, status = "COMPLETED"): ReservationPayment {
  return {
    id: `p-${amount}`,
    amount: String(amount),
    status,
    method: "TRANSFER",
    paymentType: "RESERVATION",
    deletedAt: null,
  };
}

/** Cuota mensual: lleva `dueDate`, como las que crea el backend para MONTHLY. */
function cuota(amount: number, dueDate: string, status = "PENDING"): ReservationPayment {
  return { ...pay(amount, status), id: `c-${dueDate}`, dueDate, installmentIndex: 1 };
}

// "Hoy" fijo para que la urgencia sea determinística. Mediodía UTC del 10 sept
// 2026 → wall-time 2026-09-10 en America/Santiago.
const HOY = new Date("2026-09-10T12:00:00.000Z");
// Fechas con la forma real del backend: 15/16:00 UTC, no medianoche.
const YA_EMPEZO = "2026-09-05T16:00:00.000Z";
const NO_EMPIEZA = "2026-09-25T16:00:00.000Z";

const fin = (
  payments: ReservationPayment[],
  total: string,
  status: string,
  startDate = NO_EMPIEZA,
) => getFinanceDisplay(payments, total, status, startDate, HOY);

describe("getFinanceDisplay — una sola magnitud por columna", () => {
  // La versión anterior ponía en negrita cosas distintas según la fila:
  // "Saldado" (una palabra), lo que falta cobrar, el precio total cuando no
  // había abonos, y el total otra vez cuando estaba cancelada.
  it("el monto principal es siempre lo que falta cobrar", () => {
    expect(fin([pay(250000)], "250000", "CONFIRMED").amountDue).toBe(0);
    expect(fin([pay(200000)], "620000", "CONFIRMED").amountDue).toBe(420000);
    expect(fin([], "384000", "CONFIRMED").amountDue).toBe(384000);
    expect(fin([], "248000", "CANCELLED").amountDue).toBe(0);
  });

  it("saldada: $0 por cobrar, y el subtexto dice cuánto entró", () => {
    const r = fin([pay(1020000)], "1020000", "CONFIRMED");
    expect(r.label).toBe("$0");
    expect(r.subtext).toBe("$1.020.000 cobrado");
  });

  it("el subtexto usa el mismo verbo en las cuatro ramas: lo que ya entró", () => {
    expect(fin([pay(1020000)], "1020000", "CONFIRMED").subtext).toBe("$1.020.000 cobrado");
    expect(fin([pay(200000)], "620000", "CONFIRMED").subtext).toBe("$200.000 cobrado");
    expect(fin([], "384000", "CONFIRMED").subtext).toBe("sin abonos");
    expect(fin([], "248000", "CANCELLED").subtext).toBe("sin cobros");
  });

  it("parcial: el subtexto explica el monto, no nombra otro distinto", () => {
    // Regresión: antes el monto en negrita era el restante ($420.000) y el
    // subtexto decía "Restante de $620.000" — la palabra "restante" pegada al
    // número que no describe.
    const r = fin([pay(200000)], "620000", "CONFIRMED");
    expect(r.label).toBe("$420.000");
    expect(r.subtext).toBe("$200.000 cobrado");
    expect(r.subtext).not.toContain("Restante de $620.000");
  });

  it("cancelada sin abonos: no muestra un monto por cobrar", () => {
    const r = fin([], "248000", "CANCELLED");
    expect(r.label).toBe("—");
    expect(r.subtext).toBe("sin cobros");
    expect(r.label).not.toContain("248");
    expect(r.subtext).not.toBe("Pendiente de pago");
  });

  it("cancelada con abonos: muestra lo cobrado, no lo adeudado", () => {
    const r = fin([pay(100000)], "248000", "CANCELLED");
    expect(r.amountDue).toBe(0);
    expect(r.subtext).toBe("$100.000 cobrado");
  });
});

describe("getFinanceDisplay — urgencia", () => {
  it("se debe y la estadía ya empezó → overdue: el huésped está adentro sin pagar", () => {
    expect(fin([], "384000", "CONFIRMED", YA_EMPEZO).urgency).toBe("overdue");
    expect(fin([pay(100000)], "384000", "CONFIRMED", YA_EMPEZO).urgency).toBe("overdue");
  });

  it("se debe y aún no empieza → upcoming: deber es lo normal todavía", () => {
    expect(fin([], "384000", "CONFIRMED", NO_EMPIEZA).urgency).toBe("upcoming");
    expect(fin([pay(100000)], "384000", "CONFIRMED", NO_EMPIEZA).urgency).toBe("upcoming");
  });

  it("nada por cobrar → settled, empiece cuando empiece", () => {
    expect(fin([pay(384000)], "384000", "CONFIRMED", YA_EMPEZO).urgency).toBe("settled");
    expect(fin([], "248000", "CANCELLED", YA_EMPEZO).urgency).toBe("settled");
  });

  it("el día de check-in ya cuenta como empezado", () => {
    // start_date = hoy en wall-time SCL. El huésped llega hoy: si no pagó, es
    // hoy que hay que cobrarle, no mañana.
    expect(fin([], "100000", "CONFIRMED", "2026-09-10T16:00:00.000Z").urgency).toBe("overdue");
    expect(fin([], "100000", "CONFIRMED", "2026-09-11T16:00:00.000Z").urgency).toBe("upcoming");
  });

  it("cada urgencia usa el token -text de su tono, nunca el de relleno", () => {
    // The Fill-vs-Text Rule: `text-destructive` sobre card mide 3.76:1 en claro
    // y `text-warning` 2.05:1 — los dos bajo AA.
    expect(fin([], "1", "CONFIRMED", YA_EMPEZO).labelClassName).toBe("text-destructive-text");
    expect(fin([], "1", "CONFIRMED", NO_EMPIEZA).labelClassName).toBe("text-warning-text");
    expect(fin([pay(1)], "1", "CONFIRMED").labelClassName).toBe("text-muted-foreground");
    for (const start of [YA_EMPEZO, NO_EMPIEZA]) {
      expect(fin([], "1", "CONFIRMED", start).labelClassName).not.toMatch(
        /text-(success|warning|info|destructive)$/,
      );
    }
  });
});

describe("getFinanceDisplay — urgencia con cuotas mensuales", () => {
  // En producción (2026-09-07) los pagos DAILY tienen `dueDate` nulo y los
  // MONTHLY lo traen poblado. Cuando hay calendario de cuotas, vencido es el
  // vencimiento real, no "la estadía empezó".
  const VENCIDA = "2026-09-01T00:00:00.000Z";   // antes de HOY (10 sept)
  const POR_VENCER = "2026-10-01T00:00:00.000Z"; // después

  it("cuota impaga con vencimiento pasado → overdue", () => {
    expect(fin([cuota(1450000, VENCIDA)], "4350000", "CONFIRMED", YA_EMPEZO).urgency).toBe("overdue");
  });

  it("al día aunque la estadía haya empezado: la cuota pagada y la próxima sin vencer → upcoming", () => {
    // Este es el falso positivo que la regla de "empezó y debe" producía: un
    // arriendo de varios meses que pagó el mes en curso está al día.
    const r = fin(
      [cuota(1450000, VENCIDA, "COMPLETED"), cuota(1450000, POR_VENCER)],
      "4350000",
      "CONFIRMED",
      YA_EMPEZO,
    );
    expect(r.urgency).toBe("upcoming");
    // El saldo es lo que falta de TODA la reserva, no el monto de la próxima
    // cuota: 4.350.000 menos la única cuota cobrada.
    expect(r.amountDue).toBe(2900000);
  });

  it("una cuota vencida entre varias basta para marcar overdue", () => {
    const r = fin(
      [cuota(1450000, VENCIDA, "COMPLETED"), cuota(1450000, VENCIDA), cuota(1450000, POR_VENCER)],
      "4350000",
      "CONFIRMED",
      YA_EMPEZO,
    );
    expect(r.urgency).toBe("overdue");
  });

  it("una cuota FAILED vencida también cuenta como vencida", () => {
    expect(
      fin([cuota(1450000, VENCIDA, "FAILED")], "4350000", "CONFIRMED", YA_EMPEZO).urgency,
    ).toBe("overdue");
  });

  it("sin cuotas (DAILY) cae a la regla de la estadía", () => {
    // Los pagos DAILY no traen dueDate, así que no hay vencimiento que consultar.
    expect(fin([pay(50000)], "384000", "CONFIRMED", YA_EMPEZO).urgency).toBe("overdue");
    expect(fin([pay(50000)], "384000", "CONFIRMED", NO_EMPIEZA).urgency).toBe("upcoming");
  });

  it("con cuotas, la fecha de inicio deja de mandar", () => {
    // Estadía ya empezada pero ninguna cuota vencida → no es urgente.
    expect(fin([cuota(100, POR_VENCER)], "200", "CONFIRMED", YA_EMPEZO).urgency).toBe("upcoming");
    // Estadía futura con una cuota ya vencida → sí lo es.
    expect(fin([cuota(100, VENCIDA)], "200", "CONFIRMED", NO_EMPIEZA).urgency).toBe("overdue");
  });
});

describe("getFinanceDisplay — conteo de cuotas mensuales", () => {
  const VENCIDA = "2026-09-01T00:00:00.000Z";
  const POR_VENCER = "2026-10-01T00:00:00.000Z";
  const c = (idx: number, dueDate: string, status: string): ReservationPayment => ({
    ...pay(900000, status),
    id: `c${idx}`,
    dueDate,
    installmentIndex: idx,
  });

  it("cuenta cuotas cobradas sobre el total", () => {
    const r = fin(
      [c(1, VENCIDA, "COMPLETED"), c(2, VENCIDA, "PENDING"), c(3, POR_VENCER, "PENDING")],
      "2700000",
      "CONFIRMED",
      YA_EMPEZO,
    );
    expect(r.subtext).toBe("1 de 3 cuotas cobradas");
  });

  it("un EXTRA no es una cuota", () => {
    // En producción hay una multa (paymentType EXTRA, sin installmentIndex)
    // mezclada entre las cuotas de una reserva mensual.
    const extra: ReservationPayment = {
      ...pay(50000, "COMPLETED"),
      id: "extra",
      paymentType: "EXTRA",
    };
    const r = fin(
      [c(1, VENCIDA, "COMPLETED"), c(2, POR_VENCER, "PENDING"), extra],
      "1800000",
      "CONFIRMED",
      YA_EMPEZO,
    );
    expect(r.subtext).toBe("1 de 2 cuotas cobradas");
  });

  it("el total sale del índice máximo, no de cuántas filas hay", () => {
    // Si falta una cuota intermedia, el contrato sigue siendo de 4.
    const r = fin(
      [c(1, VENCIDA, "COMPLETED"), c(4, POR_VENCER, "PENDING")],
      "3600000",
      "CONFIRMED",
      YA_EMPEZO,
    );
    expect(r.subtext).toBe("1 de 4 cuotas cobradas");
  });

  it("saldada con cuotas: dice que están todas cobradas", () => {
    const r = fin(
      [c(1, VENCIDA, "COMPLETED"), c(2, VENCIDA, "COMPLETED")],
      "1800000",
      "CONFIRMED",
      YA_EMPEZO,
    );
    expect(r.label).toBe("$0");
    expect(r.subtext).toBe("2 de 2 cuotas cobradas");
  });

  it("DAILY no tiene cuotas: sigue diciendo lo que entró", () => {
    expect(fin([pay(200000)], "620000", "CONFIRMED").subtext).toBe("$200.000 cobrado");
    expect(fin([], "384000", "CONFIRMED").subtext).toBe("sin abonos");
  });

  it("cancelada conserva su copy, no el conteo de cuotas", () => {
    const r = fin([c(1, VENCIDA, "COMPLETED")], "1800000", "CANCELLED", YA_EMPEZO);
    expect(r.subtext).toBe("$900.000 cobrado");
  });
});
