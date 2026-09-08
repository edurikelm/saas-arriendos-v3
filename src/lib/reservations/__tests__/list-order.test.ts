import { describe, it, expect } from "vitest";
import { businessDayBounds, normalizeTemporal, sliceBuckets } from "../list-order";

describe("sliceBuckets", () => {
  // Los dos buckets se sirven como una sola lista: primero todo lo vivo,
  // después todo lo terminado. Una página puede caer entera en uno o cruzar.
  it("página entera dentro del bucket vivo", () => {
    expect(sliceBuckets(0, 10, 25)).toEqual({
      live: { skip: 0, take: 10 },
      past: null,
    });
  });

  it("página entera dentro del bucket terminado", () => {
    // 3 vivas; la página 2 (skip 10) empieza 7 filas dentro de lo terminado.
    expect(sliceBuckets(10, 10, 3)).toEqual({
      live: null,
      past: { skip: 7, take: 10 },
    });
  });

  it("página que cruza el límite: cola de lo vivo + cabeza de lo terminado", () => {
    expect(sliceBuckets(2, 2, 3)).toEqual({
      live: { skip: 2, take: 1 },
      past: { skip: 0, take: 1 },
    });
  });

  it("el caso de producción: 3 vivas y 3 terminadas entran en una página", () => {
    expect(sliceBuckets(0, 10, 3)).toEqual({
      live: { skip: 0, take: 3 },
      past: { skip: 0, take: 7 },
    });
  });

  it("sin filas vivas, todo sale del bucket terminado", () => {
    expect(sliceBuckets(0, 10, 0)).toEqual({
      live: null,
      past: { skip: 0, take: 10 },
    });
  });

  it("el primer skip después del último vivo no re-lee lo terminado desde el medio", () => {
    // Regresión del off-by-one: con skip === liveCount, `past.skip` debe ser 0.
    expect(sliceBuckets(3, 10, 3)).toEqual({
      live: null,
      past: { skip: 0, take: 10 },
    });
  });

  it("nunca pide más filas que el limit", () => {
    for (const [skip, limit, live] of [[0, 5, 100], [7, 3, 2], [4, 6, 4], [0, 1, 1]]) {
      const s = sliceBuckets(skip, limit, live);
      expect((s.live?.take ?? 0) + (s.past?.take ?? 0)).toBe(limit);
      expect(s.live?.skip ?? 0).toBeGreaterThanOrEqual(0);
      expect(s.past?.skip ?? 0).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("businessDayBounds", () => {
  it("el corte es la medianoche UTC del día calendario de negocio", () => {
    const { startOfToday, startOfTomorrow } = businessDayBounds("2026-09-07");
    expect(startOfToday.toISOString()).toBe("2026-09-07T00:00:00.000Z");
    expect(startOfTomorrow.toISOString()).toBe("2026-09-08T00:00:00.000Z");
  });

  it("una reserva que termina hoy sigue siendo vivo; la de ayer no", () => {
    // El backend guarda las fechas date-only a las 15:00/16:00 UTC, nunca a
    // medianoche, así que comparar contra el inicio del día clasifica bien.
    const { startOfToday } = businessDayBounds("2026-09-07");
    expect(new Date("2026-09-07T16:00:00.000Z") >= startOfToday).toBe(true);
    expect(new Date("2026-09-06T16:00:00.000Z") >= startOfToday).toBe(false);
  });

  it("una reserva que empieza hoy ya empezó", () => {
    const { startOfTomorrow } = businessDayBounds("2026-09-07");
    expect(new Date("2026-09-07T16:00:00.000Z") < startOfTomorrow).toBe(true);
    expect(new Date("2026-09-08T16:00:00.000Z") < startOfTomorrow).toBe(false);
  });
});

describe("normalizeTemporal", () => {
  it("solo acepta los tres valores conocidos y cae en 'all'", () => {
    expect(normalizeTemporal("active")).toBe("active");
    expect(normalizeTemporal("upcoming")).toBe("upcoming");
    expect(normalizeTemporal("all")).toBe("all");
    expect(normalizeTemporal(undefined)).toBe("all");
    expect(normalizeTemporal("")).toBe("all");
    expect(normalizeTemporal("../etc")).toBe("all");
  });
});
