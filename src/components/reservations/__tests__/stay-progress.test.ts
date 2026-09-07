import { describe, it, expect } from "vitest";
import { formatStayProgress, getStayProgress } from "../reservation-status";

// Mediodía UTC del 7 sept 2026 → wall-time 2026-09-07 en America/Santiago.
const HOY = new Date("2026-09-07T12:00:00.000Z");
const prog = (s: string, e: string, bt: string, st = "CONFIRMED") =>
  getStayProgress(s, e, bt, st, HOY);
const label = (...a: Parameters<typeof prog>) => formatStayProgress(prog(...a));

describe("getStayProgress", () => {
  it("DAILY en curso: la noche que va, sobre el total", () => {
    // 1 → 12 sept son 12 noches (end_date es la última noche, CONTEXT.md).
    const r = prog("2026-09-01T16:00:00.000Z", "2026-09-12T16:00:00.000Z", "DAILY");
    expect(r).toEqual({ unit: "noche", total: 12, current: 7 });
    expect(label("2026-09-01T16:00:00.000Z", "2026-09-12T16:00:00.000Z", "DAILY")).toBe("noche 7 de 12");
  });

  it("MONTHLY en curso: el mes que va coincide con el índice de la cuota", () => {
    // Caso real de producción: 1 jul → 31 oct, cuotas 1..4, hoy 7 sept.
    // La cuota 3 (vence 1 sept) es la que está en juego.
    const r = prog("2026-07-01T16:00:00.000Z", "2026-10-31T15:00:00.000Z", "MONTHLY");
    expect(r).toEqual({ unit: "mes", total: 4, current: 3 });
    expect(label("2026-07-01T16:00:00.000Z", "2026-10-31T15:00:00.000Z", "MONTHLY")).toBe("mes 3 de 4");
  });

  it("sin empezar: solo el total, sin ordinal", () => {
    const r = prog("2026-09-20T16:00:00.000Z", "2026-09-27T16:00:00.000Z", "DAILY");
    expect(r.current).toBeNull();
    expect(label("2026-09-20T16:00:00.000Z", "2026-09-27T16:00:00.000Z", "DAILY")).toBe("8 noches");
  });

  it("terminada: solo el total", () => {
    expect(label("2026-08-10T16:00:00.000Z", "2026-08-18T16:00:00.000Z", "DAILY")).toBe("9 noches");
  });

  it("cancelada y finalizada no muestran ordinal aunque las fechas la contengan", () => {
    const dentro = ["2026-09-01T16:00:00.000Z", "2026-09-12T16:00:00.000Z", "DAILY"] as const;
    expect(prog(...dentro, "CANCELLED").current).toBeNull();
    expect(prog(...dentro, "COMPLETED").current).toBeNull();
  });

  it("el día de check-in ya es la noche 1", () => {
    expect(label("2026-09-07T16:00:00.000Z", "2026-09-10T16:00:00.000Z", "DAILY")).toBe("noche 1 de 4");
  });

  it("la última noche es la del total, no una más", () => {
    expect(label("2026-09-04T16:00:00.000Z", "2026-09-07T16:00:00.000Z", "DAILY")).toBe("noche 4 de 4");
  });

  it("singular cuando dura una sola unidad", () => {
    expect(label("2026-09-20T16:00:00.000Z", "2026-09-20T16:00:00.000Z", "DAILY")).toBe("1 noche");
  });
});
