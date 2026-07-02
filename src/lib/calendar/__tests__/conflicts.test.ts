import { describe, it, expect } from "vitest";
import { computeConflictDates } from "../conflicts";

describe("computeConflictDates", () => {
  it("overlap parcial → días compartidos", () => {
    // Reserva 5-10 jun + block 8-12 jun → 2025-06-08, 09, 10
    const reservations = [{ startDate: "2025-06-05", endDate: "2025-06-10" }];
    const blocks = [{ startDate: "2025-06-08", endDate: "2025-06-12" }];
    const conflicts = computeConflictDates(reservations, blocks);
    expect(conflicts.size).toBe(3);
    expect(conflicts.has("2025-06-08")).toBe(true);
    expect(conflicts.has("2025-06-09")).toBe(true);
    expect(conflicts.has("2025-06-10")).toBe(true);
  });

  it("adyacente sin overlap → vacío", () => {
    // Reserva 5-10 jun + block 11-15 jun → {} (no hay overlap)
    const reservations = [{ startDate: "2025-06-05", endDate: "2025-06-10" }];
    const blocks = [{ startDate: "2025-06-11", endDate: "2025-06-15" }];
    const conflicts = computeConflictDates(reservations, blocks);
    expect(conflicts.size).toBe(0);
  });

  it("bloque contenido dentro de reserva → todos los días del block", () => {
    const reservations = [{ startDate: "2025-06-01", endDate: "2025-06-30" }];
    const blocks = [{ startDate: "2025-06-10", endDate: "2025-06-15" }];
    const conflicts = computeConflictDates(reservations, blocks);
    expect(conflicts.size).toBe(6);
  });

  it("reserva contenida dentro de block → todos los días de la reserva", () => {
    const reservations = [{ startDate: "2025-06-10", endDate: "2025-06-15" }];
    const blocks = [{ startDate: "2025-06-01", endDate: "2025-06-30" }];
    const conflicts = computeConflictDates(reservations, blocks);
    expect(conflicts.size).toBe(6);
  });

  it("múltiples reservas + múltiples blocks con intersección compleja", () => {
    const reservations = [
      { startDate: "2025-06-01", endDate: "2025-06-05" },
      { startDate: "2025-06-12", endDate: "2025-06-18" },
      { startDate: "2025-06-25", endDate: "2025-06-28" },
    ];
    const blocks = [
      { startDate: "2025-06-03", endDate: "2025-06-07" }, // solapa con r1
      { startDate: "2025-06-14", endDate: "2025-06-16" }, // solapa con r2
      { startDate: "2025-06-20", endDate: "2025-06-22" }, // sin solape
      { startDate: "2025-06-26", endDate: "2025-06-29" }, // solapa parcialmente con r3
    ];
    const conflicts = computeConflictDates(reservations, blocks);
    // r1 ∩ b1: 03, 04, 05
    // r2 ∩ b2: 14, 15, 16
    // r3 ∩ b4: 26, 27, 28
    expect(conflicts.has("2025-06-03")).toBe(true);
    expect(conflicts.has("2025-06-04")).toBe(true);
    expect(conflicts.has("2025-06-05")).toBe(true);
    expect(conflicts.has("2025-06-14")).toBe(true);
    expect(conflicts.has("2025-06-15")).toBe(true);
    expect(conflicts.has("2025-06-16")).toBe(true);
    expect(conflicts.has("2025-06-26")).toBe(true);
    expect(conflicts.has("2025-06-27")).toBe(true);
    expect(conflicts.has("2025-06-28")).toBe(true);
    expect(conflicts.size).toBe(9);
    // Sin solape: 20, 21, 22 del block, y 20-22 de reserva (ninguna reserva)
    expect(conflicts.has("2025-06-20")).toBe(false);
  });

  it("acepta Date objects además de strings", () => {
    const reservations = [{ startDate: new Date("2025-06-05"), endDate: new Date("2025-06-10") }];
    const blocks = [{ startDate: new Date("2025-06-08"), endDate: new Date("2025-06-12") }];
    const conflicts = computeConflictDates(reservations, blocks);
    expect(conflicts.size).toBe(3);
  });

  it("acepta mix de strings y Date objects", () => {
    const reservations = [{ startDate: "2025-06-05", endDate: new Date("2025-06-10") }];
    const blocks = [{ startDate: new Date("2025-06-08"), endDate: "2025-06-12" }];
    const conflicts = computeConflictDates(reservations, blocks);
    expect(conflicts.size).toBe(3);
  });

  it("sin overlap → vacío", () => {
    const reservations = [{ startDate: "2025-06-01", endDate: "2025-06-05" }];
    const blocks = [{ startDate: "2025-07-01", endDate: "2025-07-05" }];
    const conflicts = computeConflictDates(reservations, blocks);
    expect(conflicts.size).toBe(0);
  });

  it("bloques vacíos → vacío", () => {
    const reservations = [{ startDate: "2025-06-01", endDate: "2025-06-10" }];
    const conflicts = computeConflictDates(reservations, []);
    expect(conflicts.size).toBe(0);
  });

  it("reservas vacías → vacío", () => {
    const blocks = [{ startDate: "2025-06-01", endDate: "2025-06-10" }];
    const conflicts = computeConflictDates([], blocks);
    expect(conflicts.size).toBe(0);
  });

  it("reservado cancelada + block activo → filtrado upstream (ambos vacíos aquí = sin conflicto)", () => {
    // El test de dominio: canceladas no se pasan a esta función.
    // Aquí verificamos que sin datos no hay conflicto.
    const conflicts = computeConflictDates([], [{ startDate: "2025-06-01", endDate: "2025-06-10" }]);
    expect(conflicts.size).toBe(0);
  });

  it("mismo día (1 noche) → un solo día de conflicto", () => {
    const reservations = [{ startDate: "2025-06-05", endDate: "2025-06-05" }];
    const blocks = [{ startDate: "2025-06-05", endDate: "2025-06-05" }];
    const conflicts = computeConflictDates(reservations, blocks);
    expect(conflicts.size).toBe(1);
    expect(conflicts.has("2025-06-05")).toBe(true);
  });
});
