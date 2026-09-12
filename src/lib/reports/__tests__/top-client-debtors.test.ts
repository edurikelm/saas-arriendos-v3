/**
 * Tests para `selectTopClientDebtors` — agrupación de `CollectionReportRow[]`
 * por cliente para el drill-down de aging (top deudores).
 */

import { describe, expect, it } from "vitest";
import { selectTopClientDebtors } from "@/lib/reports/trend";
import type { CollectionReportRow } from "@/lib/reports/collection";

const NOW = new Date("2026-01-15T18:00:00.000Z");
const NOW_UTC_DAY = Date.UTC(2026, 0, 15);
function daysBeforeNow(days: number): Date {
  return new Date(NOW_UTC_DAY - days * 86_400_000);
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

describe("selectTopClientDebtors", () => {
  it("agrupa dos reservas del mismo cliente en propiedades distintas en una sola entrada", () => {
    const rows: CollectionReportRow[] = [
      makeRow({
        clientId: "cli-1",
        clientName: "Ana Perez",
        propertyName: "Edificio Centro",
        billingType: "MONTHLY",
        totalToCollect: 100000,
        overdue: 0,
        nextDueDate: daysBeforeNow(-5), // no vencido, ignorado por el cálculo de daysOverdue
      }),
      makeRow({
        clientId: "cli-1",
        clientName: "Ana Perez",
        propertyName: "Cabaña Sur",
        billingType: "DAILY",
        totalToCollect: 250000,
        overdue: 250000,
        nextDueDate: daysBeforeNow(10),
      }),
    ];

    const result = selectTopClientDebtors(rows, 5, NOW);

    expect(result).toHaveLength(1);
    expect(result[0].clientId).toBe("cli-1");
    expect(result[0].amount).toBe(350000);
    // La fila de mayor deuda (250000, Cabaña Sur) da el contexto de propiedad/billingType.
    expect(result[0].propertyName).toBe("Cabaña Sur");
    expect(result[0].billingType).toBe("DAILY");
    expect(result[0].daysOverdue).toBe(10);
  });

  it("descarta clientes con suma de totalToCollect <= 0", () => {
    const rows: CollectionReportRow[] = [
      makeRow({ clientId: "cli-paid", totalToCollect: 0, overdue: 0 }),
      makeRow({ clientId: "cli-debt", totalToCollect: 50000, overdue: 0, nextDueDate: daysBeforeNow(-2) }),
    ];

    const result = selectTopClientDebtors(rows, 5, NOW);
    expect(result.map((d) => d.clientId)).toEqual(["cli-debt"]);
  });

  it("ordena por amount descendente y corta en `limit`", () => {
    const rows: CollectionReportRow[] = [
      makeRow({ clientId: "cli-a", clientName: "A", totalToCollect: 10000, overdue: 0 }),
      makeRow({ clientId: "cli-b", clientName: "B", totalToCollect: 90000, overdue: 0 }),
      makeRow({ clientId: "cli-c", clientName: "C", totalToCollect: 50000, overdue: 0 }),
    ];

    const result = selectTopClientDebtors(rows, 2, NOW);
    expect(result.map((d) => d.clientId)).toEqual(["cli-b", "cli-c"]);
  });

  it("daysOverdue es el atraso MÁXIMO entre las filas del cliente, 0 si ninguna está vencida", () => {
    const rowsNoOverdue: CollectionReportRow[] = [
      makeRow({ clientId: "cli-1", totalToCollect: 20000, overdue: 0, nextDueDate: daysBeforeNow(-3) }),
    ];
    expect(selectTopClientDebtors(rowsNoOverdue, 5, NOW)[0].daysOverdue).toBe(0);

    const rowsMixed: CollectionReportRow[] = [
      makeRow({
        clientId: "cli-2",
        totalToCollect: 20000,
        overdue: 20000,
        nextDueDate: daysBeforeNow(15),
      }),
      makeRow({
        clientId: "cli-2",
        totalToCollect: 30000,
        overdue: 30000,
        nextDueDate: daysBeforeNow(45),
      }),
    ];
    expect(selectTopClientDebtors(rowsMixed, 5, NOW)[0].daysOverdue).toBe(45);
  });

  it("devuelve [] cuando no hay filas con deuda", () => {
    expect(selectTopClientDebtors([], 5, NOW)).toEqual([]);
  });
});
