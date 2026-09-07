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

describe("getFinanceDisplay — una sola magnitud por columna", () => {
  // La versión anterior ponía en negrita cosas distintas según la fila:
  // "Saldado" (una palabra), lo que falta cobrar, el precio total cuando no
  // había abonos, y el total otra vez cuando estaba cancelada. La columna se
  // lee en vertical, así que tiene que contener siempre la misma cantidad.
  it("el monto principal es siempre lo que falta cobrar", () => {
    expect(getFinanceDisplay([pay(250000)], "250000", "CONFIRMED").amountDue).toBe(0);
    expect(getFinanceDisplay([pay(200000)], "620000", "CONFIRMED").amountDue).toBe(420000);
    expect(getFinanceDisplay([], "384000", "CONFIRMED").amountDue).toBe(384000);
    expect(getFinanceDisplay([], "248000", "CANCELLED").amountDue).toBe(0);
  });

  it("saldada: $0 por cobrar, y el subtexto dice cuánto entró", () => {
    const fin = getFinanceDisplay([pay(1020000)], "1020000", "CONFIRMED");
    expect(fin.label).toBe("$0");
    expect(fin.subtext).toBe("$1.020.000 cobrado");
  });

  it("el subtexto usa el mismo verbo en las cuatro ramas: lo que ya entró", () => {
    expect(getFinanceDisplay([pay(1020000)], "1020000", "CONFIRMED").subtext).toBe("$1.020.000 cobrado");
    expect(getFinanceDisplay([pay(200000)], "620000", "CONFIRMED").subtext).toBe("$200.000 cobrado");
    expect(getFinanceDisplay([], "384000", "CONFIRMED").subtext).toBe("sin abonos");
    expect(getFinanceDisplay([], "248000", "CANCELLED").subtext).toBe("sin cobros");
  });

  it("parcial: el subtexto explica el monto, no nombra otro distinto", () => {
    // Regresión: antes el monto en negrita era el restante ($420.000) y el
    // subtexto decía "Restante de $620.000" — la palabra "restante" pegada al
    // número que no describe.
    const fin = getFinanceDisplay([pay(200000)], "620000", "CONFIRMED");
    expect(fin.label).toBe("$420.000");
    expect(fin.subtext).toBe("$200.000 cobrado");
    expect(fin.subtext).not.toContain("Restante de $620.000");
  });

  it("sin abonos: el monto es el total y el subtexto no lo repite", () => {
    const fin = getFinanceDisplay([], "384000", "CONFIRMED");
    expect(fin.label).toBe("$384.000");
    expect(fin.subtext).toBe("sin abonos");
  });

  it("cancelada sin abonos: no muestra un monto por cobrar", () => {
    const fin = getFinanceDisplay([], "248000", "CANCELLED");
    expect(fin.label).toBe("—");
    expect(fin.subtext).toBe("sin cobros");
    expect(fin.label).not.toContain("248");
    expect(fin.subtext).not.toBe("Pendiente de pago");
  });

  it("cancelada con abonos: muestra lo cobrado, no lo adeudado", () => {
    const fin = getFinanceDisplay([pay(100000)], "248000", "CANCELLED");
    expect(fin.amountDue).toBe(0);
    expect(fin.subtext).toBe("$100.000 cobrado");
  });

  it("el color del monto es binario: se debe algo, o no", () => {
    // Un monto que cambia de color por fila deja de ser escaneable como columna
    // (DESIGN.md). Y ningún tono de relleno como color de texto: `text-success`
    // sobre card mide 3.03:1 en claro.
    const debe = [
      getFinanceDisplay([pay(200000)], "620000", "CONFIRMED"),
      getFinanceDisplay([], "384000", "CONFIRMED"),
    ];
    const saldado = [
      getFinanceDisplay([pay(250000)], "250000", "CONFIRMED"),
      getFinanceDisplay([], "248000", "CANCELLED"),
    ];
    for (const fin of debe) expect(fin.labelClassName).toBe("text-foreground");
    for (const fin of saldado) expect(fin.labelClassName).toBe("text-muted-foreground");
    for (const fin of [...debe, ...saldado]) {
      expect(fin.labelClassName).not.toMatch(/text-(success|warning|info|destructive)/);
    }
  });
});
