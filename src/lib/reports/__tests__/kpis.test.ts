/**
 * Tests for `prorateRevenueToRange` — pure prorating of a DAILY reservation's
 * `totalPrice` by nights that fall inside a range (e.g. the visible month in
 * `/calendar`).
 *
 * Fixed at midnight LOCAL time (matches `parseCalendarDate` in calendar-view.tsx
 * and the month boundaries built with `new Date(year, month, day)`), consistent
 * with the epoch-day arithmetic in `clipNightsToRange`.
 */

import { describe, expect, it } from "vitest";
import { prorateRevenueToRange } from "@/lib/reports/kpis";

function d(year: number, month: number, day: number): Date {
  // month is 1-indexed here for readability
  return new Date(year, month - 1, day);
}

describe("prorateRevenueToRange", () => {
  it("reserva enteramente dentro del mes → share = total", () => {
    // 5-10 Sep, mes = Sep 1-30. 6 noches totales, 6 dentro del rango.
    const share = prorateRevenueToRange(
      120000,
      d(2026, 9, 5),
      d(2026, 9, 10),
      d(2026, 9, 1),
      d(2026, 9, 30),
    );
    expect(share).toBe(120000);
  });

  it("reserva que empieza antes del mes → prorratea solo las noches dentro", () => {
    // 28 Ago - 5 Sep: noches totales = 9 (28,29,30,31,1,2,3,4,5).
    // Dentro de septiembre (1-30): 1,2,3,4,5 = 5 noches.
    const totalPrice = 90000; // 10000/noche
    const share = prorateRevenueToRange(
      totalPrice,
      d(2026, 8, 28),
      d(2026, 9, 5),
      d(2026, 9, 1),
      d(2026, 9, 30),
    );
    expect(share).toBeCloseTo((5 / 9) * totalPrice, 6);
    expect(share).toBeCloseTo(50000, 6);
  });

  it("reserva que termina después del mes → prorratea solo las noches dentro", () => {
    // 25 Sep - 3 Oct: noches totales = 9 (25,26,27,28,29,30,1,2,3).
    // Dentro de septiembre: 25,26,27,28,29,30 = 6 noches.
    const totalPrice = 90000; // 10000/noche
    const share = prorateRevenueToRange(
      totalPrice,
      d(2026, 9, 25),
      d(2026, 10, 3),
      d(2026, 9, 1),
      d(2026, 9, 30),
    );
    expect(share).toBeCloseTo((6 / 9) * totalPrice, 6);
    expect(share).toBeCloseTo(60000, 6);
  });

  it("reserva que abarca el mes completo (desde antes hasta después) → solo las noches del mes", () => {
    // 15 Ago - 12 Oct: dentro de septiembre = 30 noches (el mes completo).
    const totalPrice = 2784000;
    const totalNights =
      Math.floor(d(2026, 10, 12).getTime() / 86_400_000) -
      Math.floor(d(2026, 8, 15).getTime() / 86_400_000) +
      1;
    const share = prorateRevenueToRange(
      totalPrice,
      d(2026, 8, 15),
      d(2026, 10, 12),
      d(2026, 9, 1),
      d(2026, 9, 30),
    );
    expect(share).toBeCloseTo((30 / totalNights) * totalPrice, 6);
  });

  it("reserva de 1 noche dentro del mes → share = total", () => {
    const share = prorateRevenueToRange(
      15000,
      d(2026, 9, 20),
      d(2026, 9, 20),
      d(2026, 9, 1),
      d(2026, 9, 30),
    );
    expect(share).toBe(15000);
  });

  it("reserva de 1 noche fuera del mes → share = 0", () => {
    const share = prorateRevenueToRange(
      15000,
      d(2026, 8, 20),
      d(2026, 8, 20),
      d(2026, 9, 1),
      d(2026, 9, 30),
    );
    expect(share).toBe(0);
  });

  it("noches totales = 0 (datos inválidos, endDate < startDate) → 0 sin dividir por cero", () => {
    const share = prorateRevenueToRange(
      50000,
      d(2026, 9, 10),
      d(2026, 9, 5),
      d(2026, 9, 1),
      d(2026, 9, 30),
    );
    expect(share).toBe(0);
    expect(Number.isFinite(share)).toBe(true);
  });
});
