/**
 * Tests para exportToExcel — cobertura de la hoja "Por método de pago"
 * (desglose de caja del rango por método de pago, ADR-0035/ADR-0030).
 *
 * `XLSX.writeFile` se reemplaza por un no-op vía `vi.mock`: escribe un
 * archivo real a disco (en Node, entorno de este test), que ensuciaría el
 * working tree — no es lo que este test verifica. Se inspeccionan las hojas
 * del `workbook` construido por `XLSX.utils.book_append_sheet` en su lugar,
 * capturadas con un spy sobre esa función.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import * as XLSX from "xlsx";
import { exportToExcel } from "@/lib/export-utils/excel";
import type { ReservationDetail, PropertySummary } from "@/lib/export-utils/excel";

vi.mock("xlsx", async (importOriginal) => {
  const actual = await importOriginal<typeof import("xlsx")>();
  return {
    ...actual,
    writeFile: vi.fn(),
  };
});

const details: ReservationDetail[] = [
  {
    id: "res-1",
    propertyName: "Edificio Centro",
    clientName: "Ana Perez",
    clientEmail: "ana@example.com",
    startDate: new Date(2026, 0, 1),
    endDate: new Date(2026, 0, 5),
    totalPrice: 100_000,
    status: "CONFIRMED",
    paymentStatus: "COMPLETED",
    billingType: "DAILY",
    createdAt: new Date(2026, 0, 1),
  },
];

const summaries: PropertySummary[] = [
  {
    propertyName: "Edificio Centro",
    totalReservations: 1,
    totalNights: 4,
    reservedRevenueInRange: 100_000,
    paidRevenue: 100_000,
    pendingRevenue: 0,
  },
];

function findSheet(name: string) {
  const appendSpy = vi.mocked(XLSX.utils.book_append_sheet);
  const call = appendSpy.mock.calls.find((c) => c[2] === name);
  return call?.[1];
}

describe("exportToExcel — hoja 'Por método de pago'", () => {
  beforeEach(() => {
    vi.mocked(XLSX.writeFile).mockClear();
    vi.spyOn(XLSX.utils, "book_append_sheet");
  });

  it("no agrega la hoja cuando no se pasa cashByMethod", () => {
    exportToExcel(details, summaries, null);
    expect(findSheet("Por método de pago")).toBeUndefined();
  });

  it("agrega la hoja con etiquetas en español, montos CLP y fila TOTAL", () => {
    exportToExcel(details, summaries, null, {
      CASH: 100_000,
      TRANSFER: 200_000,
      MERCADO_PAGO: 300_000,
    });

    const sheet = findSheet("Por método de pago");
    expect(sheet).toBeDefined();

    const rows = XLSX.utils.sheet_to_json(sheet!) as Array<{ Método: string; Cobrado: number }>;
    expect(rows).toEqual(
      expect.arrayContaining([
        { Método: "Efectivo", Cobrado: 100_000 },
        { Método: "Transferencia", Cobrado: 200_000 },
        { Método: "Mercado Pago", Cobrado: 300_000 },
        { Método: "TOTAL", Cobrado: 600_000 },
      ]),
    );
  });

  it("no lanza con cashByMethod vacío", () => {
    expect(() => exportToExcel(details, summaries, null, {})).not.toThrow();
  });

  it("no afecta las hojas existentes (Detalle / Resumen por Propiedad)", () => {
    exportToExcel(details, summaries, null, { CASH: 100_000 });
    expect(findSheet("Detalle")).toBeDefined();
    expect(findSheet("Resumen por Propiedad")).toBeDefined();
  });
});
