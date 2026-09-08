import { describe, it, expect } from "vitest";
import { computeScrollLeftForToday } from "../scroll";

describe("computeScrollLeftForToday", () => {
  it("mes sin hoy (todayIndex null) → 0", () => {
    const scrollLeft = computeScrollLeftForToday({
      todayIndex: null,
      dayWidth: 50,
      propertyColumnWidth: 224,
      clientWidth: 800,
      contentWidth: 1724,
    });
    expect(scrollLeft).toBe(0);
  });

  it("mes sin hoy (todayIndex -1) → 0, mismo resultado que null", () => {
    const scrollLeft = computeScrollLeftForToday({
      todayIndex: -1,
      dayWidth: 50,
      propertyColumnWidth: 224,
      clientWidth: 800,
      contentWidth: 1724,
    });
    expect(scrollLeft).toBe(0);
  });

  it("hoy al inicio del mes (index 0) → 0, ya visible sin scrollear", () => {
    // days=30, dayWidth=50, W=200, clientWidth=800 → contentWidth=1700
    const scrollLeft = computeScrollLeftForToday({
      todayIndex: 0,
      dayWidth: 50,
      propertyColumnWidth: 200,
      clientWidth: 800,
      contentWidth: 1700,
    });
    expect(scrollLeft).toBe(0);
  });

  it("hoy al final del mes (index 29 de 30) → clampeado a maxScrollLeft", () => {
    // Mismos params que el caso anterior, pero hoy es el último día del mes.
    // maxScrollLeft = 1700 - 800 = 900; el target ideal (1350) se clampea ahí.
    const scrollLeft = computeScrollLeftForToday({
      todayIndex: 29,
      dayWidth: 50,
      propertyColumnWidth: 200,
      clientWidth: 800,
      contentWidth: 1700,
    });
    expect(scrollLeft).toBe(900);
  });

  it("viewport ancho donde todo el mes cabe → 0, sin importar el índice de hoy", () => {
    // contentWidth (1424) <= clientWidth (1440): nada que scrollear.
    const scrollLeft = computeScrollLeftForToday({
      todayIndex: 15,
      dayWidth: 40,
      propertyColumnWidth: 224,
      clientWidth: 1440,
      contentWidth: 1424,
    });
    expect(scrollLeft).toBe(0);

    // Boundary: contentWidth === clientWidth también da 0.
    const boundary = computeScrollLeftForToday({
      todayIndex: 15,
      dayWidth: 40,
      propertyColumnWidth: 224,
      clientWidth: 1424,
      contentWidth: 1424,
    });
    expect(boundary).toBe(0);
  });

  it("viewport angosto (repro real: sept 2026, hoy=8, dayWidth mínimo 42px) → hoy visible con contexto", () => {
    // Reproduce la medición reportada: 30 días, propertyColumnWidth mobile (156),
    // dayWidth clamped al mínimo (42), clientWidth 310 → contentWidth 1416
    // (coincide con el scrollWidth medido: 156 + 30*42 = 1416).
    const todayIndex = 7; // 8 de septiembre, 0-based
    const scrollLeft = computeScrollLeftForToday({
      todayIndex,
      dayWidth: 42,
      propertyColumnWidth: 156,
      clientWidth: 310,
      contentWidth: 1416,
    });
    expect(scrollLeft).toBe(210);

    // La columna de hoy queda completamente visible: no tapada por la sticky
    // (upperBound = 7*42 = 294) ni cortada por la derecha
    // (lowerBound = 156 + 8*42 - 310 = 182).
    expect(scrollLeft).toBeLessThanOrEqual(7 * 42);
    expect(scrollLeft).toBeGreaterThanOrEqual(156 + 8 * 42 - 310);
  });

  it("caso degenerado: clientWidth menor que columna propiedad + un día → prioriza no-tapado-por-sticky", () => {
    // W + dayWidth = 156 + 42 = 198 > clientWidth (150): las cotas se cruzan
    // (lowerBound 678 > upperBound 630). El resultado colapsa a upperBound.
    const scrollLeft = computeScrollLeftForToday({
      todayIndex: 15,
      dayWidth: 42,
      propertyColumnWidth: 156,
      clientWidth: 150,
      contentWidth: 1416,
    });
    expect(scrollLeft).toBe(15 * 42);
  });

  it("redondea a entero cuando dayWidth es fraccionario", () => {
    // desired = (10-2) * 45.3 = 362.4 → Math.round → 362.
    const scrollLeft = computeScrollLeftForToday({
      todayIndex: 10,
      dayWidth: 45.3,
      propertyColumnWidth: 200,
      clientWidth: 700,
      contentWidth: 1559,
    });
    expect(scrollLeft).toBe(362);
    expect(Number.isInteger(scrollLeft)).toBe(true);
  });
});
