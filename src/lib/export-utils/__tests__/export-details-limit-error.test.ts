/**
 * Tests para ExportDetailsLimitError — exported from @/lib/export-utils
 *
 * Pure error class — no side effects, no DB calls.
 */

import { describe, expect, it } from "vitest";
import { ExportDetailsLimitError } from "@/lib/export-utils/pdf";

describe("ExportDetailsLimitError", () => {
  it("extiende Error", () => {
    const error = new ExportDetailsLimitError(150);
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ExportDetailsLimitError);
  });

  it("el mensaje incluye el número real de reservas", () => {
    const error = new ExportDetailsLimitError(250);
    expect(error.message).toBe("El reporte contiene 250 reservas, superando el límite de 100 filas para PDF.");
  });

  it("el campo total contiene el número provisto al constructor", () => {
    const error = new ExportDetailsLimitError(500);
    expect(error.total).toBe(500);
  });

  it("name es ExportDetailsLimitError", () => {
    const error = new ExportDetailsLimitError(100);
    expect(error.name).toBe("ExportDetailsLimitError");
  });

  it("es throwable y capturable", () => {
    expect(() => { throw new ExportDetailsLimitError(200); }).toThrow();
    expect(() => { throw new ExportDetailsLimitError(200); }).toThrow(/200/);
  });
});
