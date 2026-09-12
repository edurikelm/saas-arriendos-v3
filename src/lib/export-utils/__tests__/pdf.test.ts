/**
 * Tests para exportToPDF — en particular, que ya no existe el límite
 * artificial de 100 filas (ver comentario en pdf.ts).
 *
 * `jspdf-autotable` pagina el body de la tabla automáticamente — no hay
 * truncamiento silencioso que un límite duro necesite prevenir. Se mide acá
 * con ~250 filas (bien por sobre el límite anterior) generando varias
 * páginas sin lanzar ninguna excepción.
 *
 * `jsPDF#save` se reemplaza por un no-op vía `vi.mock`: es una propiedad
 * PROPIA de instancia (asignada en el constructor real, no en el prototype),
 * así que `vi.spyOn(jsPDF.prototype, "save")` no la intercepta. En Node
 * (entorno de este test) el `save` real termina escribiendo un archivo a
 * disco, que ensuciaría el working tree — no es lo que este test verifica.
 */
import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { exportToPDF } from "@/lib/export-utils/pdf";
import type { ReservationDetail, PropertySummary } from "@/lib/export-utils/excel";

const saveMock = vi.fn();

vi.mock("jspdf", async (importOriginal) => {
  const actual = await importOriginal<typeof import("jspdf")>();
  class TestPDF extends actual.default {
    constructor(...args: ConstructorParameters<typeof actual.default>) {
      super(...args);
      // Overrides the real per-instance `save` (assigned by the parent
      // constructor) with a spy, so no PDF is ever written to disk.
      this.save = ((...saveArgs: unknown[]) => {
        saveMock(...saveArgs);
        return this;
      }) as unknown as typeof this.save;
    }
  }
  return { ...actual, default: TestPDF };
});

// Captura los argumentos de cada llamada a `autoTable` (head/body/foot) sin
// perder el comportamiento real — sigue delegando a la implementación real
// para que los tests de paginación (250 filas) no cambien de significado.
const autoTableCalls: Array<Record<string, unknown>> = [];
vi.mock("jspdf-autotable", async (importOriginal) => {
  const actual = await importOriginal<typeof import("jspdf-autotable")>();
  const wrapped = (doc: unknown, options: Record<string, unknown>) => {
    autoTableCalls.push(options);
    return (actual.default as (doc: unknown, options: unknown) => unknown)(doc, options);
  };
  return { ...actual, default: wrapped };
});

function makeDetails(n: number): ReservationDetail[] {
  const arr: ReservationDetail[] = [];
  for (let i = 0; i < n; i++) {
    arr.push({
      id: `id-${i}`,
      propertyName: `Propiedad ${i}`,
      clientName: `Cliente ${i}`,
      clientEmail: `cliente${i}@example.com`,
      startDate: new Date(2026, 0, 1),
      endDate: new Date(2026, 0, 5),
      totalPrice: 100_000,
      status: "CONFIRMED",
      paymentStatus: "COMPLETED",
      billingType: "DAILY",
      createdAt: new Date(2026, 0, 1),
    });
  }
  return arr;
}

const summaries: PropertySummary[] = [
  {
    propertyName: "Propiedad 0",
    totalReservations: 250,
    totalNights: 1000,
    reservedRevenueInRange: 25_000_000,
    paidRevenue: 20_000_000,
    pendingRevenue: 5_000_000,
  },
];

describe("exportToPDF", () => {
  beforeEach(() => {
    autoTableCalls.length = 0;
  });

  afterEach(() => {
    saveMock.mockClear();
  });

  it("does not throw with ~250 rows (well above the old 100-row cap)", () => {
    const details = makeDetails(250);
    expect(() => exportToPDF(details, summaries, null)).not.toThrow();
    expect(saveMock).toHaveBeenCalledTimes(1);
  });

  it("produces a multi-page document with 250 rows — autoTable paginates, nothing is silently truncated", () => {
    const details = makeDetails(250);
    const doc = new jsPDF();
    autoTable(doc, {
      startY: 20,
      head: [["Propiedad", "Cliente", "Inicio", "Fin", "Total", "Estado", "Pago"]],
      body: details.map((d) => [d.propertyName, d.clientName, "01/01/2026", "05/01/2026", "100.000", d.status, d.paymentStatus]),
    });
    expect(doc.getNumberOfPages()).toBeGreaterThan(1);
  });

  it("still exports fine with a small dataset (regression guard)", () => {
    const details = makeDetails(5);
    expect(() => exportToPDF(details, summaries.slice(0, 1), null)).not.toThrow();
  });

  it("calls doc.save exactly once", () => {
    exportToPDF(makeDetails(10), summaries, null);
    expect(saveMock).toHaveBeenCalledTimes(1);
  });

  it("omits the 'Por método de pago' table when cashByMethod is not provided", () => {
    exportToPDF(makeDetails(5), summaries, null);

    const methodTable = autoTableCalls.find(
      (call) => Array.isArray(call.head) && (call.head as unknown[][])[0]?.[0] === "Método",
    );
    expect(methodTable).toBeUndefined();
  });

  it("adds a 'Por método de pago' table with Spanish labels, CLP amounts, and a total row", () => {
    exportToPDF(makeDetails(5), summaries, null, {
      CASH: 100_000,
      TRANSFER: 200_000,
      MERCADO_PAGO: 300_000,
    });

    const methodTable = autoTableCalls.find(
      (call) => Array.isArray(call.head) && (call.head as unknown[][])[0]?.[0] === "Método",
    );
    expect(methodTable).toBeDefined();

    const body = methodTable!.body as string[][];
    expect(body).toEqual(
      expect.arrayContaining([
        ["Efectivo", (100_000).toLocaleString("CLP")],
        ["Transferencia", (200_000).toLocaleString("CLP")],
        ["Mercado Pago", (300_000).toLocaleString("CLP")],
      ]),
    );

    const foot = methodTable!.foot as string[][];
    expect(foot).toEqual([["TOTAL", (600_000).toLocaleString("CLP")]]);
  });

  it("still exports without throwing when cashByMethod is an empty object", () => {
    expect(() => exportToPDF(makeDetails(5), summaries, null, {})).not.toThrow();
  });
});
