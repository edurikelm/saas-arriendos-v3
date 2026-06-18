import { describe, it, expect } from "vitest";
import { supportTicketSchema, supportMessageSchema } from "../support";

describe("supportTicketSchema", () => {
  const validData = {
    subject: "Problema con la reserva",
    description: "El huésped no pudo hacer check-in porque la cerradura estaba dañada y no respondía.",
    priority: "HIGH" as const,
    category: "RESERVATIONS" as const,
  };

  it("rejects subject shorter than 5 characters", () => {
    const result = supportTicketSchema.safeParse({
      ...validData,
      subject: "abc",
    });
    expect(result.success).toBe(false);
  });

  it("rejects subject longer than 120 characters", () => {
    const result = supportTicketSchema.safeParse({
      ...validData,
      subject: "a".repeat(121),
    });
    expect(result.success).toBe(false);
  });

  it("rejects description shorter than 20 characters", () => {
    const result = supportTicketSchema.safeParse({
      ...validData,
      description: "too short",
    });
    expect(result.success).toBe(false);
  });

  it("rejects description longer than 2000 characters", () => {
    const result = supportTicketSchema.safeParse({
      ...validData,
      description: "a".repeat(2001),
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid ticket data", () => {
    const result = supportTicketSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("rejects invalid priority", () => {
    const result = supportTicketSchema.safeParse({
      ...validData,
      priority: "URGENT",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid category", () => {
    const result = supportTicketSchema.safeParse({
      ...validData,
      category: "BILLING",
    });
    expect(result.success).toBe(false);
  });

  it("accepts ticket with optional affected entity", () => {
    const result = supportTicketSchema.safeParse({
      ...validData,
      category: "RESERVATIONS",
      affectedEntityType: "RESERVATION",
      affectedEntityId: "res-1",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid affectedEntityType", () => {
    const result = supportTicketSchema.safeParse({
      ...validData,
      affectedEntityType: "INVALID",
      affectedEntityId: "some-id",
    });
    expect(result.success).toBe(false);
  });

  it("rejects affectedEntityType without affectedEntityId", () => {
    const result = supportTicketSchema.safeParse({
      ...validData,
      affectedEntityType: "RESERVATION",
    });
    expect(result.success).toBe(false);
  });

  it("rejects affectedEntityId without affectedEntityType", () => {
    const result = supportTicketSchema.safeParse({
      ...validData,
      affectedEntityId: "res-1",
    });
    expect(result.success).toBe(false);
  });

  it("accepts ACCOUNT category without affected entity", () => {
    const result = supportTicketSchema.safeParse({
      ...validData,
      category: "ACCOUNT",
    });
    expect(result.success).toBe(true);
  });

  it("accepts OTHER category without affected entity", () => {
    const result = supportTicketSchema.safeParse({
      ...validData,
      category: "OTHER",
    });
    expect(result.success).toBe(true);
  });
});

describe("supportMessageSchema", () => {
  it("accepts valid message without images", () => {
    const result = supportMessageSchema.safeParse({ content: "Mensaje válido" });
    expect(result.success).toBe(true);
  });

  it("accepts message with up to 3 valid images", () => {
    const result = supportMessageSchema.safeParse({
      content: "Aquí están las fotos",
      images: [
        { url: "https://res.cloudinary.com/test1.jpg", fileName: "foto1.jpg", fileSize: 1024 },
        { url: "https://res.cloudinary.com/test2.png", fileName: "foto2.png", fileSize: 2048 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects message with more than 3 images", () => {
    const result = supportMessageSchema.safeParse({
      content: "Muchas fotos",
      images: Array(4).fill({ url: "https://res.cloudinary.com/test.jpg", fileName: "foto.jpg", fileSize: 1024 }),
    });
    expect(result.success).toBe(false);
  });

  it("rejects message with invalid image url", () => {
    const result = supportMessageSchema.safeParse({
      content: "Test",
      images: [{ url: "not-a-url", fileName: "foto.jpg", fileSize: 1024 }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects message with non-image file type in fileName", () => {
    const result = supportMessageSchema.safeParse({
      content: "Test",
      images: [{ url: "https://res.cloudinary.com/test.pdf", fileName: "document.pdf", fileSize: 1024 }],
    });
    expect(result.success).toBe(false);
  });
});
