import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SessionUser } from "@/lib/auth/session";

const mockPrisma = vi.hoisted(() => ({
  property: {
    findFirst: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: mockPrisma }));

vi.mock("@/lib/auth/session", () => ({
  getSession: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/external-calendars/queries", () => ({
  softStopExternalCalendarsForProperty: vi.fn(),
}));

const mockSession: SessionUser = {
  userId: "user-1",
  role: "OWNER",
  plan: "PRO",
  email: "owner@test.com",
};

const mockProperty = {
  id: "prop-1",
  userId: "user-1",
  name: "Beach House",
  type: "HOUSE" as const,
  unitsAvailable: 2,
  dailyPrice: BigInt("150000"),
  monthlyPrice: null,
  currency: "CLP" as const,
  color: "#3B82F6",
  mainImage: null,
  amenities: [],
  images: [],
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("deleteProperty", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna error si no hay sesión", async () => {
    const { getSession } = await import("@/lib/auth/session");
    vi.mocked(getSession).mockResolvedValue(null);

    const { deleteProperty } = await import("../properties");
    const result = await deleteProperty("prop-1");

    expect(result).toEqual({ error: "No autorizado" });
  });

  it("retorna error si la propiedad no existe o no pertenece al owner", async () => {
    const { getSession } = await import("@/lib/auth/session");
    vi.mocked(getSession).mockResolvedValue(mockSession);
    mockPrisma.property.findFirst.mockResolvedValue(null);

    const { deleteProperty } = await import("../properties");
    const result = await deleteProperty("prop-other");

    expect(result).toEqual({ error: "Propiedad no encontrada" });
  });

  it("elimina la propiedad y retorna success si no hay calendarios asociados", async () => {
    const { getSession } = await import("@/lib/auth/session");
    vi.mocked(getSession).mockResolvedValue(mockSession);
    mockPrisma.property.findFirst.mockResolvedValue(mockProperty);
    mockPrisma.property.delete.mockResolvedValue(mockProperty);

    const { softStopExternalCalendarsForProperty } = await import(
      "@/lib/external-calendars/queries"
    );
    vi.mocked(softStopExternalCalendarsForProperty).mockResolvedValue({
      externalCalendarIds: [],
      externalBlockIds: [],
    });

    const { deleteProperty } = await import("../properties");
    const { revalidatePath } = await import("next/cache");

    const result = await deleteProperty("prop-1");

    expect(result).toEqual({ success: true });
    expect(softStopExternalCalendarsForProperty).toHaveBeenCalledWith("prop-1");
    expect(mockPrisma.property.delete).toHaveBeenCalledWith({ where: { id: "prop-1" } });
    expect(revalidatePath).toHaveBeenCalledWith("/properties");
  });

  it("con calendarios activos: soft-stop antes del delete succeed", async () => {
    const { getSession } = await import("@/lib/auth/session");
    vi.mocked(getSession).mockResolvedValue(mockSession);
    mockPrisma.property.findFirst.mockResolvedValue(mockProperty);
    mockPrisma.property.delete.mockResolvedValue(mockProperty);

    const { softStopExternalCalendarsForProperty } = await import(
      "@/lib/external-calendars/queries"
    );
    vi.mocked(softStopExternalCalendarsForProperty).mockResolvedValue({
      externalCalendarIds: ["cal-1", "cal-2"],
      externalBlockIds: ["block-1"],
    });

    const { deleteProperty } = await import("../properties");
    const result = await deleteProperty("prop-1");

    expect(result).toEqual({ success: true });
    expect(softStopExternalCalendarsForProperty).toHaveBeenCalledWith("prop-1");
    expect(mockPrisma.property.delete).toHaveBeenCalledWith({ where: { id: "prop-1" } });
  });

  it("si el delete falla por otra razón: retorna error amigable", async () => {
    const { getSession } = await import("@/lib/auth/session");
    vi.mocked(getSession).mockResolvedValue(mockSession);
    mockPrisma.property.findFirst.mockResolvedValue(mockProperty);
    mockPrisma.property.delete.mockRejectedValue(new Error("DB connection failed"));

    const { softStopExternalCalendarsForProperty } = await import(
      "@/lib/external-calendars/queries"
    );
    vi.mocked(softStopExternalCalendarsForProperty).mockResolvedValue({
      externalCalendarIds: [],
      externalBlockIds: [],
    });

    const { deleteProperty } = await import("../properties");

    const result = await deleteProperty("prop-1");

    expect(result).toEqual({
      error: "No se pudo eliminar la propiedad. Por favor intenta de nuevo.",
    });
  });
});
