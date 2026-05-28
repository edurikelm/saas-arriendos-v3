import { describe, expect, it } from "vitest";
import {
  RESERVATION_DOCUMENT_MAX_SIZE_BYTES,
  reservationDocumentFileSchema,
  reservationDocumentCategorySchema,
} from "../reservation-document";

describe("reservationDocumentFileSchema", () => {
  it("accepts valid PDF files", () => {
    const result = reservationDocumentFileSchema.safeParse({
      name: "contrato.pdf",
      size: 1024,
      type: "application/pdf",
    });

    expect(result.success).toBe(true);
  });

  it("rejects files above 10MB", () => {
    const result = reservationDocumentFileSchema.safeParse({
      name: "big.pdf",
      size: RESERVATION_DOCUMENT_MAX_SIZE_BYTES + 1,
      type: "application/pdf",
    });

    expect(result.success).toBe(false);
  });

  it("rejects unsupported mime type", () => {
    const result = reservationDocumentFileSchema.safeParse({
      name: "doc.gif",
      size: 100,
      type: "image/gif",
    });

    expect(result.success).toBe(false);
  });
});

describe("reservationDocumentCategorySchema", () => {
  it("accepts allowed categories", () => {
    expect(reservationDocumentCategorySchema.safeParse("CONTRATO").success).toBe(true);
    expect(reservationDocumentCategorySchema.safeParse("ANEXO").success).toBe(true);
    expect(reservationDocumentCategorySchema.safeParse("INVENTARIO").success).toBe(true);
    expect(reservationDocumentCategorySchema.safeParse("OTRO").success).toBe(true);
  });
});
