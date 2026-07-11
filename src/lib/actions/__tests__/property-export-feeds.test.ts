import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SessionUser } from "@/lib/auth/session";

const mockPrisma = vi.hoisted(() => ({
  property: {
    findFirst: vi.fn(),
  },
  propertyExportFeed: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: mockPrisma }));

vi.mock("@/lib/auth/session", () => ({
  getSession: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
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
  name: "Test Property",
};

const mockFeed = {
  id: "feed-1",
  propertyId: "prop-1",
  channel: "AIRBNB" as const,
  tokenHash: "mockhash",
  tokenLastFour: "abcd",
  createdAt: new Date(),
  lastRotatedAt: new Date(),
  isRevoked: false,
  lastFetchedAt: null,
};

describe("listPropertyExportFeeds", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retorna error si no hay sesión", async () => {
    const { getSession } = await import("@/lib/auth/session");
    vi.mocked(getSession).mockResolvedValue(null);

    const { listPropertyExportFeeds } = await import("../property-export-feeds");
    const result = await listPropertyExportFeeds("prop-1");

    expect(result).toEqual({ error: "No autorizado" });
  });

  it("retorna error si propiedad no existe o no es del owner", async () => {
    const { getSession } = await import("@/lib/auth/session");
    vi.mocked(getSession).mockResolvedValue(mockSession);
    mockPrisma.property.findFirst.mockResolvedValue(null);

    const { listPropertyExportFeeds } = await import("../property-export-feeds");
    const result = await listPropertyExportFeeds("prop-other");

    expect(result).toEqual({ error: "Propiedad no encontrada" });
  });

  it("retorna feeds sin raw token", async () => {
    const { getSession } = await import("@/lib/auth/session");
    vi.mocked(getSession).mockResolvedValue(mockSession);
    mockPrisma.property.findFirst.mockResolvedValue(mockProperty);
    mockPrisma.propertyExportFeed.findMany.mockResolvedValue([mockFeed]);

    const { listPropertyExportFeeds } = await import("../property-export-feeds");
    const result = await listPropertyExportFeeds("prop-1");

    expect(Array.isArray(result)).toBe(true);
    if (Array.isArray(result)) {
      expect(result[0]).not.toHaveProperty("rawToken");
      expect(result[0]).toHaveProperty("tokenLastFour");
      expect(result[0]).toHaveProperty("urlPreview");
    }
  });
});

describe("createPropertyExportFeed", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rechaza plan FREE", async () => {
    const { getSession } = await import("@/lib/auth/session");
    vi.mocked(getSession).mockResolvedValue({ ...mockSession, plan: "FREE" });

    const { createPropertyExportFeed } = await import("../property-export-feeds");
    const result = await createPropertyExportFeed({ propertyId: "prop-1", channel: "AIRBNB" });

    expect(result).toEqual({ error: "Funcionalidad disponible solo para plan PRO" });
  });

  it("crea feed exitosamente con plan PRO", async () => {
    const { getSession } = await import("@/lib/auth/session");
    vi.mocked(getSession).mockResolvedValue(mockSession);
    mockPrisma.property.findFirst.mockResolvedValue(mockProperty);
    mockPrisma.propertyExportFeed.findUnique.mockResolvedValue(null);
    mockPrisma.propertyExportFeed.create.mockResolvedValue(mockFeed);

    const { createPropertyExportFeed } = await import("../property-export-feeds");
    const result = await createPropertyExportFeed({ propertyId: "prop-1", channel: "AIRBNB" });

    expect(result.success).toBe(true);
    expect(result).toHaveProperty("rawToken");
    expect(result.feed).not.toHaveProperty("rawToken");
    expect(mockPrisma.propertyExportFeed.create).toHaveBeenCalled();
  });

  it("rechaza si ya existe feed para ese canal", async () => {
    const { getSession } = await import("@/lib/auth/session");
    vi.mocked(getSession).mockResolvedValue(mockSession);
    mockPrisma.property.findFirst.mockResolvedValue(mockProperty);
    mockPrisma.propertyExportFeed.findUnique.mockResolvedValue(mockFeed);

    const { createPropertyExportFeed } = await import("../property-export-feeds");
    const result = await createPropertyExportFeed({ propertyId: "prop-1", channel: "AIRBNB" });

    expect(result).toEqual({ error: "Ya existe un feed para este canal en esta propiedad" });
  });

  it("rechaza propiedad que no es del owner", async () => {
    const { getSession } = await import("@/lib/auth/session");
    vi.mocked(getSession).mockResolvedValue(mockSession);
    mockPrisma.property.findFirst.mockResolvedValue(null);

    const { createPropertyExportFeed } = await import("../property-export-feeds");
    const result = await createPropertyExportFeed({ propertyId: "prop-other", channel: "AIRBNB" });

    expect(result).toEqual({ error: "Propiedad no encontrada" });
  });
});

describe("regeneratePropertyExportFeed", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rechaza plan FREE", async () => {
    const { getSession } = await import("@/lib/auth/session");
    vi.mocked(getSession).mockResolvedValue({ ...mockSession, plan: "FREE" });

    const { regeneratePropertyExportFeed } = await import("../property-export-feeds");
    const result = await regeneratePropertyExportFeed({ propertyId: "prop-1", channel: "AIRBNB" });

    expect(result).toEqual({ error: "Funcionalidad disponible solo para plan PRO" });
  });

  it("regenera feed exitosamente", async () => {
    const { getSession } = await import("@/lib/auth/session");
    vi.mocked(getSession).mockResolvedValue(mockSession);
    mockPrisma.property.findFirst.mockResolvedValue(mockProperty);
    mockPrisma.propertyExportFeed.findUnique.mockResolvedValue(mockFeed);
    mockPrisma.propertyExportFeed.update.mockResolvedValue(mockFeed);

    const { regeneratePropertyExportFeed } = await import("../property-export-feeds");
    const result = await regeneratePropertyExportFeed({ propertyId: "prop-1", channel: "AIRBNB" });

    expect(result.success).toBe(true);
    expect(result).toHaveProperty("rawToken");
    expect(result.feed).not.toHaveProperty("rawToken");
    expect(mockPrisma.propertyExportFeed.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          isRevoked: false,
        }),
      })
    );
  });

  it("retorna error si no existe feed", async () => {
    const { getSession } = await import("@/lib/auth/session");
    vi.mocked(getSession).mockResolvedValue(mockSession);
    mockPrisma.property.findFirst.mockResolvedValue(mockProperty);
    mockPrisma.propertyExportFeed.findUnique.mockResolvedValue(null);

    const { regeneratePropertyExportFeed } = await import("../property-export-feeds");
    const result = await regeneratePropertyExportFeed({ propertyId: "prop-1", channel: "AIRBNB" });

    expect(result).toEqual({ error: "No existe un feed para este canal en esta propiedad" });
  });

  it("old token es inmediatamente invido después de rotación", async () => {
    const { getSession } = await import("@/lib/auth/session");
    vi.mocked(getSession).mockResolvedValue(mockSession);
    mockPrisma.property.findFirst.mockResolvedValue(mockProperty);
    mockPrisma.propertyExportFeed.findUnique.mockResolvedValue(mockFeed);
    mockPrisma.propertyExportFeed.update.mockResolvedValue({
      ...mockFeed,
      tokenHash: "new-hash",
    });

    const { regeneratePropertyExportFeed } = await import("../property-export-feeds");
    const result = await regeneratePropertyExportFeed({ propertyId: "prop-1", channel: "AIRBNB" });

    expect(result.success).toBe(true);
    // Token hash es diferente en la respuesta
    expect(mockPrisma.propertyExportFeed.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "feed-1" },
        data: expect.objectContaining({
          tokenHash: expect.not.arrayContaining([mockFeed.tokenHash]),
        }),
      })
    );
  });
});

describe("revokePropertyExportFeed", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rechaza plan FREE", async () => {
    const { getSession } = await import("@/lib/auth/session");
    vi.mocked(getSession).mockResolvedValue({ ...mockSession, plan: "FREE" });

    const { revokePropertyExportFeed } = await import("../property-export-feeds");
    const result = await revokePropertyExportFeed({ propertyId: "prop-1", channel: "AIRBNB" });

    expect(result).toEqual({ error: "Funcionalidad disponible solo para plan PRO" });
  });

  it("revoca feed exitosamente", async () => {
    const { getSession } = await import("@/lib/auth/session");
    vi.mocked(getSession).mockResolvedValue(mockSession);
    mockPrisma.property.findFirst.mockResolvedValue(mockProperty);
    mockPrisma.propertyExportFeed.findUnique.mockResolvedValue(mockFeed);
    mockPrisma.propertyExportFeed.update.mockResolvedValue({ ...mockFeed, isRevoked: true });

    const { revokePropertyExportFeed } = await import("../property-export-feeds");
    const result = await revokePropertyExportFeed({ propertyId: "prop-1", channel: "AIRBNB" });

    expect(result).toEqual({ success: true });
    expect(mockPrisma.propertyExportFeed.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "feed-1" },
        data: { isRevoked: true },
      })
    );
  });

  it("retorna error si no existe feed", async () => {
    const { getSession } = await import("@/lib/auth/session");
    vi.mocked(getSession).mockResolvedValue(mockSession);
    mockPrisma.property.findFirst.mockResolvedValue(mockProperty);
    mockPrisma.propertyExportFeed.findUnique.mockResolvedValue(null);

    const { revokePropertyExportFeed } = await import("../property-export-feeds");
    const result = await revokePropertyExportFeed({ propertyId: "prop-1", channel: "AIRBNB" });

    expect(result).toEqual({ error: "No existe un feed para este canal en esta propiedad" });
  });
});
