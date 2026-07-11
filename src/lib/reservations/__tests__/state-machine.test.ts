import { describe, it, expect } from "vitest";
import { canTransition } from "../state-machine";

const P = "PENDING" as const;
const C = "CONFIRMED" as const;
const X = "CANCELLED" as const;
const D = "COMPLETED" as const;

const ZERO_PAYMENTS = 0;
const ONE_PAYMENT = 1;
const THREE_PAYMENTS = 3;

describe("canTransition — no-op", () => {
  it.each([
    ["PENDING", "PENDING"],
    ["CONFIRMED", "CONFIRMED"],
    ["CANCELLED", "CANCELLED"],
    ["COMPLETED", "COMPLETED"],
  ] as const)("%s → %s es no-op permitido", (from, to) => {
    expect(canTransition({ from, to, completedReservationPayments: 0 })).toEqual({
      ok: true,
    });
  });
});

describe("canTransition — estados terminales", () => {
  it.each([
    ["CANCELLED", "PENDING"],
    ["CANCELLED", "CONFIRMED"],
    ["CANCELLED", "COMPLETED"],
    ["COMPLETED", "PENDING"],
    ["COMPLETED", "CONFIRMED"],
    ["COMPLETED", "CANCELLED"],
  ] as const)(
    "%s → %s es rechazado (estado terminal)",
    (from, to) => {
      const result = canTransition({
        from,
        to,
        completedReservationPayments: 5,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toMatch(/estado terminal/i);
      }
    },
  );
});

describe("canTransition — desde PENDING", () => {
  it("PENDING → CONFIRMED siempre permitido (override del owner)", () => {
    expect(
      canTransition({ from: P, to: C, completedReservationPayments: ZERO_PAYMENTS }),
    ).toEqual({ ok: true });
  });

  it("PENDING → COMPLETED rechazado (debe pasar por CONFIRMED primero)", () => {
    const result = canTransition({
      from: P,
      to: D,
      completedReservationPayments: THREE_PAYMENTS,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/CONFIRMED primero/);
    }
  });

  it("PENDING → COMPLETED rechazado incluso con muchos pagos", () => {
    const result = canTransition({
      from: P,
      to: D,
      completedReservationPayments: 100,
    });
    expect(result.ok).toBe(false);
  });

  it("PENDING → CANCELLED permitido a nivel de máquina (la acción updateReservation bloquea para forzar cancelReservation)", () => {
    expect(
      canTransition({ from: P, to: X, completedReservationPayments: ZERO_PAYMENTS }),
    ).toEqual({ ok: true });
  });
});

describe("canTransition — desde CONFIRMED", () => {
  it("CONFIRMED → PENDING permitido (downgrade)", () => {
    expect(
      canTransition({ from: C, to: P, completedReservationPayments: THREE_PAYMENTS }),
    ).toEqual({ ok: true });
  });

  it("CONFIRMED → COMPLETED permitido con ≥1 pago RESERVATION COMPLETED", () => {
    expect(
      canTransition({ from: C, to: D, completedReservationPayments: ONE_PAYMENT }),
    ).toEqual({ ok: true });
  });

  it("CONFIRMED → COMPLETED rechazado sin pagos", () => {
    const result = canTransition({
      from: C,
      to: D,
      completedReservationPayments: ZERO_PAYMENTS,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/al menos 1 pago RESERVATION COMPLETED/);
    }
  });

  it("CONFIRMED → COMPLETED rechazado si completedReservationPayments = 0 aunque totalPrice esté pagado en EXTRAs", () => {
    // Regla: solo cuentan RESERVATION COMPLETED. EXTRAs no cuentan.
    const result = canTransition({
      from: C,
      to: D,
      completedReservationPayments: 0,
    });
    expect(result.ok).toBe(false);
  });

  it("CONFIRMED → CANCELLED permitido a nivel de máquina (mismo caso que PENDING → CANCELLED)", () => {
    expect(
      canTransition({ from: C, to: X, completedReservationPayments: ONE_PAYMENT }),
    ).toEqual({ ok: true });
  });
});

describe("canTransition — coherencia de la tabla completa", () => {
  /**
   * Tabla de verdad: cada celda es el resultado esperado.
   * Filas = from, columnas = to.
   */
  const truthTable: Record<string, Record<string, boolean>> = {
    PENDING: {
      PENDING: true,
      CONFIRMED: true,
      CANCELLED: true, // válido aquí; acción lo bloquea
      COMPLETED: false,
    },
    CONFIRMED: {
      PENDING: true,
      CONFIRMED: true,
      CANCELLED: true, // válido aquí; acción lo bloquea
      COMPLETED: true, // depende de payments, asumimos ≥1
    },
    CANCELLED: {
      PENDING: false,
      CONFIRMED: false,
      CANCELLED: true,
      COMPLETED: false,
    },
    COMPLETED: {
      PENDING: false,
      CONFIRMED: false,
      CANCELLED: false,
      COMPLETED: true,
    },
  };

  for (const from of ["PENDING", "CONFIRMED", "CANCELLED", "COMPLETED"] as const) {
    for (const to of ["PENDING", "CONFIRMED", "CANCELLED", "COMPLETED"] as const) {
      const expected = truthTable[from][to];

      it(`${from} → ${to} → ${expected ? "ok" : "reject"}`, () => {
        const result = canTransition({
          from,
          to,
          completedReservationPayments: expected && to === "COMPLETED" ? 1 : 5,
        });
        expect(result.ok).toBe(expected);
      });
    }
  }
});