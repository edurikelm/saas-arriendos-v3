/**
 * Tests para `buildAgingBuckets` — tramos de antigüedad de deuda ("aging
 * buckets") sobre `CollectionReportRow[]` ya construidas.
 *
 * Todas las comparaciones de fecha son en wall-time `America/Santiago`
 * (ADR-0020), vía `daysFromTodayDateOnly`. `now` se fija explícitamente para
 * que los tests sean deterministas.
 */

import { describe, expect, it } from "vitest";
import { buildAgingBuckets, type CollectionReportRow } from "@/lib/reports/collection";

// "now" a media tarde UTC del 15-ene-2026: en Santiago (verano, UTC-3) cae en
// el mismo día calendario (15-ene), evitando ambigüedad de zona horaria.
const NOW = new Date("2026-01-15T18:00:00.000Z");
const NOW_UTC_DAY = Date.UTC(2026, 0, 15);

/** `dateOnlyKey`/`dateKeyToDayIndex` operan en aritmética epoch-day UTC pura,
 * así que restar días en UTC reproduce exactamente lo que ve `daysFromTodayDateOnly`. */
function daysBeforeNow(days: number): Date {
  return new Date(NOW_UTC_DAY - days * 86_400_000);
}
function daysAfterNow(days: number): Date {
  return new Date(NOW_UTC_DAY + days * 86_400_000);
}

function makeRow(overrides: Partial<CollectionReportRow> = {}): CollectionReportRow {
  return {
    reservationId: overrides.reservationId ?? `res-${Math.random().toString(36).slice(2)}`,
    propertyId: overrides.propertyId ?? "prop-1",
    propertyName: overrides.propertyName ?? "Edificio Centro",
    clientId: overrides.clientId ?? "cli-1",
    clientName: overrides.clientName ?? "Ana Perez",
    billingType: overrides.billingType ?? "MONTHLY",
    reservationStatus: overrides.reservationStatus ?? "CONFIRMED",
    totalRent: overrides.totalRent ?? 100000,
    paid: overrides.paid ?? 0,
    pending: overrides.pending ?? 100000,
    overdue: overrides.overdue ?? 0,
    nextDueDate: overrides.nextDueDate ?? null,
    nextInstallmentAmount: overrides.nextInstallmentAmount ?? 100000,
    extrasPaid: overrides.extrasPaid ?? 0,
    extrasPending: overrides.extrasPending ?? 0,
    totalToCollect: overrides.totalToCollect ?? 100000,
    overdueCount: overrides.overdueCount ?? 0,
    dueSoon: overrides.dueSoon ?? 0,
    dueSoonCount: overrides.dueSoonCount ?? 0,
    dueSoonNextDueDate: overrides.dueSoonNextDueDate ?? null,
    extrasPendingCount: overrides.extrasPendingCount ?? 0,
    pendingChargesCount: overrides.pendingChargesCount ?? 1,
  };
}

function bucketAmount(summary: ReturnType<typeof buildAgingBuckets>, key: string) {
  return summary.buckets.find((b) => b.key === key)?.amount ?? null;
}
function bucketCount(summary: ReturnType<typeof buildAgingBuckets>, key: string) {
  return summary.buckets.find((b) => b.key === key)?.count ?? null;
}

describe("buildAgingBuckets", () => {
  it("siempre devuelve los 4 tramos, en orden, aunque estén en 0", () => {
    const summary = buildAgingBuckets([], NOW);
    expect(summary.buckets.map((b) => b.key)).toEqual([
      "DUE_SOON",
      "OVERDUE_1_30",
      "OVERDUE_31_60",
      "OVERDUE_60_PLUS",
    ]);
    expect(summary.buckets.every((b) => b.amount === 0 && b.count === 0)).toBe(true);
    expect(summary.totalDue).toBe(0);
    expect(summary.totalOverdue).toBe(0);
  });

  it("ignora filas con totalToCollect <= 0", () => {
    const rows = [
      makeRow({ totalToCollect: 0, overdue: 0, nextDueDate: daysAfterNow(3) }),
      makeRow({ totalToCollect: -50, overdue: -50 }),
    ];
    const summary = buildAgingBuckets(rows, NOW);
    expect(summary.totalDue).toBe(0);
    expect(summary.totalOverdue).toBe(0);
  });

  it("DUE_SOON: fila sin overdue que vence dentro de los próximos 7 días (incluyendo hoy)", () => {
    const rows = [
      makeRow({ overdue: 0, totalToCollect: 30000, nextDueDate: NOW, dueSoonCount: 1 }), // hoy
      makeRow({ overdue: 0, totalToCollect: 20000, nextDueDate: daysAfterNow(7), dueSoonCount: 1 }), // borde 7
    ];
    const summary = buildAgingBuckets(rows, NOW);
    expect(bucketAmount(summary, "DUE_SOON")).toBe(50000);
    expect(bucketCount(summary, "DUE_SOON")).toBe(2);
  });

  it("DUE_SOON cuenta cobros (dueSoonCount), no filas: una MONTHLY con 2 cuotas en la ventana cuenta 2", () => {
    const rows = [
      makeRow({ overdue: 0, totalToCollect: 60000, nextDueDate: daysAfterNow(3), dueSoonCount: 2 }),
    ];
    const summary = buildAgingBuckets(rows, NOW);
    expect(bucketAmount(summary, "DUE_SOON")).toBe(60000);
    expect(bucketCount(summary, "DUE_SOON")).toBe(2);
  });

  it("una fila que vence en 20 días (sin overdue) no entra en ningún tramo", () => {
    const rows = [makeRow({ overdue: 0, totalToCollect: 40000, nextDueDate: daysAfterNow(20) })];
    const summary = buildAgingBuckets(rows, NOW);
    expect(summary.buckets.every((b) => b.amount === 0 && b.count === 0)).toBe(true);
    expect(summary.totalDue).toBe(0);
  });

  it("OVERDUE_1_30: exactamente 30 días de atraso cae en el tramo 1-30 (borde inclusivo)", () => {
    const rows = [
      makeRow({ overdue: 100000, totalToCollect: 100000, nextDueDate: daysBeforeNow(30) }),
    ];
    const summary = buildAgingBuckets(rows, NOW);
    expect(bucketAmount(summary, "OVERDUE_1_30")).toBe(100000);
    expect(bucketAmount(summary, "OVERDUE_31_60")).toBe(0);
  });

  it("OVERDUE_31_60: 31 días de atraso cae en el tramo 31-60 (justo después del borde de 30)", () => {
    const rows = [
      makeRow({ overdue: 100000, totalToCollect: 100000, nextDueDate: daysBeforeNow(31) }),
    ];
    const summary = buildAgingBuckets(rows, NOW);
    expect(bucketAmount(summary, "OVERDUE_1_30")).toBe(0);
    expect(bucketAmount(summary, "OVERDUE_31_60")).toBe(100000);
  });

  it("OVERDUE_31_60: exactamente 60 días de atraso cae en el tramo 31-60 (borde inclusivo)", () => {
    const rows = [
      makeRow({ overdue: 100000, totalToCollect: 100000, nextDueDate: daysBeforeNow(60) }),
    ];
    const summary = buildAgingBuckets(rows, NOW);
    expect(bucketAmount(summary, "OVERDUE_31_60")).toBe(100000);
    expect(bucketAmount(summary, "OVERDUE_60_PLUS")).toBe(0);
  });

  it("OVERDUE_60_PLUS: 61 días de atraso cae en el tramo más de 60 (justo después del borde de 60)", () => {
    const rows = [
      makeRow({ overdue: 100000, totalToCollect: 100000, nextDueDate: daysBeforeNow(61) }),
    ];
    const summary = buildAgingBuckets(rows, NOW);
    expect(bucketAmount(summary, "OVERDUE_31_60")).toBe(0);
    expect(bucketAmount(summary, "OVERDUE_60_PLUS")).toBe(100000);
  });

  it("overdue > 0 con nextDueDate null cae en OVERDUE_1_30 (caso borde, tramo menos alarmista)", () => {
    // overdueCount no se especifica (default 0 en makeRow): el piso de 1 evita
    // reportar un tramo con monto y cero cobros.
    const rows = [makeRow({ overdue: 75000, totalToCollect: 75000, nextDueDate: null })];
    const summary = buildAgingBuckets(rows, NOW);
    expect(bucketAmount(summary, "OVERDUE_1_30")).toBe(75000);
    expect(bucketCount(summary, "OVERDUE_1_30")).toBe(1);
  });

  it("cuenta cobros (overdueCount), no filas: una MONTHLY con 3 cuotas vencidas cuenta 3, no 1", () => {
    const rows = [
      makeRow({
        billingType: "MONTHLY",
        overdue: 300000,
        totalToCollect: 300000,
        nextDueDate: daysBeforeNow(90), // cuota más antigua vencida
        overdueCount: 3, // 3 cuotas RESERVATION vencidas de la misma reserva
      }),
    ];
    const summary = buildAgingBuckets(rows, NOW);
    expect(bucketAmount(summary, "OVERDUE_60_PLUS")).toBe(300000);
    expect(bucketCount(summary, "OVERDUE_60_PLUS")).toBe(3);
  });

  it("el monto de una fila vencida es `overdue`, no `totalToCollect` (pueden divergir con extras)", () => {
    const rows = [
      makeRow({
        overdue: 60000,
        totalToCollect: 90000, // 60000 vencido + 30000 en extras pendientes
        nextDueDate: daysBeforeNow(10),
      }),
    ];
    const summary = buildAgingBuckets(rows, NOW);
    expect(bucketAmount(summary, "OVERDUE_1_30")).toBe(60000);
  });

  it("totalDue y totalOverdue son consistentes con los 4 tramos", () => {
    const rows = [
      makeRow({ overdue: 0, totalToCollect: 10000, nextDueDate: daysAfterNow(2) }), // DUE_SOON
      makeRow({ overdue: 20000, totalToCollect: 20000, nextDueDate: daysBeforeNow(5) }), // 1-30
      makeRow({ overdue: 30000, totalToCollect: 30000, nextDueDate: daysBeforeNow(45) }), // 31-60
      makeRow({ overdue: 40000, totalToCollect: 40000, nextDueDate: daysBeforeNow(90) }), // 60+
    ];
    const summary = buildAgingBuckets(rows, NOW);
    expect(summary.totalOverdue).toBe(20000 + 30000 + 40000);
    expect(summary.totalDue).toBe(10000 + 20000 + 30000 + 40000);
  });
});
