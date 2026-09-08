import { describe, it, expect } from "vitest";
import {
  assignTimelineLanes,
  laneStackHeight,
  laneTop,
  timelineRowContentHeight,
  externalBlocksRowTop,
  timelineRowHeight,
  LANE_TOP_OFFSET,
  LANE_HEIGHT,
  type TimelineLaneEntry,
} from "../lanes";

const windowStart = new Date(2025, 0, 1); // 2025-01-01
const windowLength = 31; // enero completo

function laneOf<T extends { id: string; startDate: string; endDate: string }>(
  entries: TimelineLaneEntry<T>[],
  id: string,
): number {
  const entry = entries.find((e) => e.item.id === id);
  if (!entry) throw new Error(`entry ${id} not found`);
  return entry.lane;
}

describe("assignTimelineLanes", () => {
  it("lista vacía → sin entries y laneCount 0", () => {
    const result = assignTimelineLanes([], windowStart, windowLength);
    expect(result.entries).toEqual([]);
    expect(result.laneCount).toBe(0);
  });

  it("dos reservas SIN solape → mismo carril", () => {
    const items = [
      { id: "a", startDate: "2025-01-05", endDate: "2025-01-08" },
      { id: "b", startDate: "2025-01-10", endDate: "2025-01-12" },
    ];
    const result = assignTimelineLanes(items, windowStart, windowLength);
    expect(result.laneCount).toBe(1);
    expect(laneOf(result.entries, "a")).toBe(0);
    expect(laneOf(result.entries, "b")).toBe(0);
  });

  it("dos reservas CON solape → carriles distintos", () => {
    const items = [
      { id: "a", startDate: "2025-01-05", endDate: "2025-01-12" },
      { id: "b", startDate: "2025-01-08", endDate: "2025-01-15" },
    ];
    const result = assignTimelineLanes(items, windowStart, windowLength);
    expect(result.laneCount).toBe(2);
    expect(laneOf(result.entries, "a")).toBe(0);
    expect(laneOf(result.entries, "b")).toBe(1);
  });

  it("prev.endDate === next.startDate → comparten noche, carriles distintos (sobreventa real, no contigüidad)", () => {
    // Caso de los fixtures reales: Undurraga termina 7-sep, Renata empieza 7-sep
    // en una propiedad de 1 unidad. end_date es la última noche inclusiva, así
    // que ambas reservas ocupan la noche del 7 al 8 — se solapan de verdad.
    const items = [
      { id: "undurraga", startDate: "2025-01-01", endDate: "2025-01-07" },
      { id: "renata", startDate: "2025-01-07", endDate: "2025-01-10" },
    ];
    const result = assignTimelineLanes(items, windowStart, windowLength);
    expect(result.laneCount).toBe(2);
    expect(laneOf(result.entries, "undurraga")).toBe(0);
    expect(laneOf(result.entries, "renata")).toBe(1);
  });

  it("reserva que termina justo un día antes de que otra empiece → SÍ pueden compartir carril", () => {
    const items = [
      { id: "a", startDate: "2025-01-01", endDate: "2025-01-06" },
      { id: "b", startDate: "2025-01-07", endDate: "2025-01-10" },
    ];
    const result = assignTimelineLanes(items, windowStart, windowLength);
    expect(result.laneCount).toBe(1);
    expect(laneOf(result.entries, "a")).toBe(0);
    expect(laneOf(result.entries, "b")).toBe(0);
  });

  it("tres reservas simultáneas → tres carriles", () => {
    const items = [
      { id: "a", startDate: "2025-01-05", endDate: "2025-01-15" },
      { id: "b", startDate: "2025-01-06", endDate: "2025-01-14" },
      { id: "c", startDate: "2025-01-07", endDate: "2025-01-13" },
    ];
    const result = assignTimelineLanes(items, windowStart, windowLength);
    expect(result.laneCount).toBe(3);
    expect(new Set(result.entries.map((e) => e.lane)).size).toBe(3);
  });

  it("una reserva larga con varias cortas alrededor: las cortas reutilizan el carril liberado", () => {
    const items = [
      { id: "long", startDate: "2025-01-01", endDate: "2025-01-31" },
      { id: "short-early", startDate: "2025-01-01", endDate: "2025-01-03" },
      { id: "short-mid", startDate: "2025-01-15", endDate: "2025-01-17" },
    ];
    const result = assignTimelineLanes(items, windowStart, windowLength);
    // "long" ocupa todo enero → nunca libera su carril (lane 0).
    expect(laneOf(result.entries, "long")).toBe(0);
    // "short-early" solapa con "long" desde el día 1 → necesita un carril nuevo (lane 1).
    expect(laneOf(result.entries, "short-early")).toBe(1);
    // "short-mid" no solapa con "short-early" (que terminó el 3) → reutiliza lane 1.
    expect(laneOf(result.entries, "short-mid")).toBe(1);
    expect(result.laneCount).toBe(2);
  });

  it("recorta a la ventana: reserva que empieza antes del mes o termina después", () => {
    const items = [
      { id: "spills-before", startDate: "2024-12-20", endDate: "2025-01-05" },
      { id: "spills-after", startDate: "2025-01-28", endDate: "2025-02-05" },
    ];
    const result = assignTimelineLanes(items, windowStart, windowLength);
    const before = result.entries.find((e) => e.item.id === "spills-before")!;
    const after = result.entries.find((e) => e.item.id === "spills-after")!;
    // Recortada al día 0 del mes (no offset negativo).
    expect(before.leftOffset).toBe(0);
    expect(before.duration).toBe(5); // 1 al 5 de enero, recortado
    // Recortada al último día de la ventana (índice 30, 0-based, de 31 días).
    expect(after.leftOffset).toBe(27);
    expect(after.duration).toBe(4); // 28,29,30,31 de enero → hasta el borde de la ventana
  });

  it("orden de entrada arbitrario produce carriles estables (mismo resultado por id)", () => {
    const items = [
      { id: "a", startDate: "2025-01-05", endDate: "2025-01-12" },
      { id: "b", startDate: "2025-01-08", endDate: "2025-01-15" },
      { id: "c", startDate: "2025-01-01", endDate: "2025-01-04" },
    ];
    const resultA = assignTimelineLanes(items, windowStart, windowLength);
    const shuffled = [items[2], items[0], items[1]];
    const resultB = assignTimelineLanes(shuffled, windowStart, windowLength);

    expect(resultB.laneCount).toBe(resultA.laneCount);
    for (const id of ["a", "b", "c"]) {
      expect(laneOf(resultB.entries, id)).toBe(laneOf(resultA.entries, id));
    }
  });
});

describe("geometría de fila (constantes derivadas, no mágicas)", () => {
  it("una fila de 1 carril mide exactamente 76px (invariante dura)", () => {
    expect(timelineRowContentHeight(1)).toBe(76);
    expect(timelineRowHeight(1, false)).toBe(76);
  });

  it("el primer carril queda en top: 12px, igual que antes de lane stacking", () => {
    expect(laneTop(0)).toBe(LANE_TOP_OFFSET);
    expect(laneTop(0)).toBe(12);
  });

  it("crece de forma predecible para 1, 3, 5 y 10 carriles", () => {
    expect(timelineRowContentHeight(1)).toBe(76);
    expect(timelineRowContentHeight(3)).toBe(148);
    expect(timelineRowContentHeight(5)).toBe(220);
    expect(timelineRowContentHeight(10)).toBe(400);
  });

  it("la sub-fila de bloqueos externos queda siempre debajo de todos los carriles", () => {
    for (const laneCount of [1, 2, 3, 5, 10]) {
      const extTop = externalBlocksRowTop(laneCount);
      const lastLaneBottom = laneTop(laneCount - 1) + LANE_HEIGHT;
      expect(extTop).toBeGreaterThanOrEqual(lastLaneBottom);
    }
  });

  it("el borde inferior de la sub-fila externa coincide con el borde inferior del contenido de la fila", () => {
    const EXT_BLOCK_HEIGHT = 24;
    for (const laneCount of [1, 2, 3, 5, 10]) {
      expect(externalBlocksRowTop(laneCount) + EXT_BLOCK_HEIGHT).toBe(
        timelineRowContentHeight(laneCount),
      );
    }
  });

  it("con 1 carril y bloqueos externos, el alto total coincide con el comportamiento original (76 + 32 = 108)", () => {
    expect(timelineRowHeight(1, true)).toBe(108);
  });

  it("laneStackHeight crece linealmente con LANE_HEIGHT + LANE_GAP por carril extra", () => {
    const h1 = laneStackHeight(1);
    const h2 = laneStackHeight(2);
    expect(h2 - h1).toBe(LANE_HEIGHT + 4); // LANE_GAP = 4
  });
});
