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
