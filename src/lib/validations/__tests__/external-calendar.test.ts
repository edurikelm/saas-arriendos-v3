import { describe, it, expect } from "vitest";
import {
  createExternalCalendarInputSchema,
  updateExternalCalendarInputSchema,
  externalChannelSchema,
} from "../external-calendar";

describe("externalChannelSchema", () => {
  it("acepta AIRBNB", () => {
    expect(externalChannelSchema.parse("AIRBNB")).toBe("AIRBNB");
  });

  it("acepta BOOKING_COM", () => {
    expect(externalChannelSchema.parse("BOOKING_COM")).toBe("BOOKING_COM");
  });

  it("acepta VRBO", () => {
    expect(externalChannelSchema.parse("VRBO")).toBe("VRBO");
  });

  it("acepta OTHER", () => {
    expect(externalChannelSchema.parse("OTHER")).toBe("OTHER");
  });

  it("rechaza canal inválido", () => {
    expect(() => externalChannelSchema.parse("INVALID")).toThrow();
  });
});

describe("createExternalCalendarInputSchema", () => {
  const validInput = {
    propertyId: "prop-123",
    channel: "AIRBNB",
    name: "Mi Calendario Airbnb",
    feedUrl: "https://example.com/ical",
  };

  it("happy path con datos válidos", () => {
    const result = createExternalCalendarInputSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it("rechaza URL sin HTTPS", () => {
    const result = createExternalCalendarInputSchema.safeParse({
      ...validInput,
      feedUrl: "http://example.com/ical",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].message).toBe("La URL del feed debe usar HTTPS");
    }
  });

  it("rechaza URL que no es URL válida", () => {
    const result = createExternalCalendarInputSchema.safeParse({
      ...validInput,
      feedUrl: "not-a-url",
    });
    expect(result.success).toBe(false);
  });

  it("rechaza nombre vacío", () => {
    const result = createExternalCalendarInputSchema.safeParse({
      ...validInput,
      name: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].message).toBe("El nombre no puede estar vacío");
    }
  });

  it("rechaza nombre con más de 100 caracteres", () => {
    const result = createExternalCalendarInputSchema.safeParse({
      ...validInput,
      name: "a".repeat(101),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].message).toBe("El nombre no puede exceder 100 caracteres");
    }
  });

  it("rechaza channel inválido", () => {
    const result = createExternalCalendarInputSchema.safeParse({
      ...validInput,
      channel: "INVALID",
    });
    expect(result.success).toBe(false);
  });

  it("rechaza propertyId vacío", () => {
    const result = createExternalCalendarInputSchema.safeParse({
      ...validInput,
      propertyId: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("updateExternalCalendarInputSchema", () => {
  const baseInput = {
    id: "cal-123",
  };

  it("happy path con update parcial - solo name", () => {
    const result = updateExternalCalendarInputSchema.safeParse({
      ...baseInput,
      name: "Nuevo nombre",
    });
    expect(result.success).toBe(true);
  });

  it("happy path con update parcial - solo feedUrl", () => {
    const result = updateExternalCalendarInputSchema.safeParse({
      ...baseInput,
      feedUrl: "https://new-url.com/ical",
    });
    expect(result.success).toBe(true);
  });

  it("happy path con update parcial - solo isActive", () => {
    const result = updateExternalCalendarInputSchema.safeParse({
      ...baseInput,
      isActive: false,
    });
    expect(result.success).toBe(true);
  });

  it("happy path con update parcial - todos los campos opcionales", () => {
    const result = updateExternalCalendarInputSchema.safeParse({
      id: "cal-123",
      name: "Nuevo nombre",
      feedUrl: "https://new-url.com/ical",
      isActive: false,
    });
    expect(result.success).toBe(true);
  });

  it("rechaza feedUrl sin HTTPS", () => {
    const result = updateExternalCalendarInputSchema.safeParse({
      ...baseInput,
      feedUrl: "http://example.com/ical",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].message).toBe("La URL del feed debe usar HTTPS");
    }
  });

  it("rechaza id vacío", () => {
    const result = updateExternalCalendarInputSchema.safeParse({
      id: "",
    });
    expect(result.success).toBe(false);
  });
});
