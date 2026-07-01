import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies before importing the route
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    propertyExportFeed: {
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
    property: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/ical/export", () => ({
  buildExportEvents: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/ical/serializer", () => ({
  serializeIcal: vi.fn().mockReturnValue("MOCK_ICAL_CONTENT"),
}));

const mockFeed = {
  id: "feed-1",
  propertyId: "prop-1",
  channel: "AIRBNB" as const,
  tokenHash: "mock-hash",
  tokenLastFour: "abcd",
  createdAt: new Date(),
  lastRotatedAt: new Date(),
  isRevoked: false,
  lastFetchedAt: null,
};

describe("GET /api/ical/export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna 401 cuando falta channel", async () => {
    const { GET } = await import("../route");
    const url = new URL("http://localhost/api/ical/export?token=abc123");

    const request = new Request(url);
    const result = await GET(request);

    expect(result.status).toBe(401);
  });

  it("retorna 401 cuando channel es inválido", async () => {
    const { GET } = await import("../route");
    const url = new URL("http://localhost/api/ical/export?channel=INVALID&token=abc123");

    const request = new Request(url);
    const result = await GET(request);

    expect(result.status).toBe(401);
  });

  it("retorna 401 cuando falta token", async () => {
    const { GET } = await import("../route");
    const url = new URL("http://localhost/api/ical/export?channel=AIRBNB");

    const request = new Request(url);
    const result = await GET(request);

    expect(result.status).toBe(401);
  });

  it("retorna 401 cuando token tiene formato inválido", async () => {
    const { GET } = await import("../route");
    const url = new URL("http://localhost/api/ical/export?channel=AIRBNB&token=too-short");

    const request = new Request(url);
    const result = await GET(request);

    expect(result.status).toBe(401);
  });

  it("retorna 401 cuando feed no existe", async () => {
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(prisma.propertyExportFeed.findUnique).mockResolvedValue(null);

    const { GET } = await import("../route");
    const url = new URL("http://localhost/api/ical/export?channel=AIRBNB&token=abc1234567890123456789012345678901234");

    const request = new Request(url);
    const result = await GET(request);

    expect(result.status).toBe(401);
  });

  it("retorna 401 cuando feed está revocado", async () => {
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(prisma.propertyExportFeed.findUnique).mockResolvedValue({
      ...mockFeed,
      isRevoked: true,
    });

    const { GET } = await import("../route");
    const url = new URL("http://localhost/api/ical/export?channel=AIRBNB&token=abc1234567890123456789012345678901234");

    const request = new Request(url);
    const result = await GET(request);

    expect(result.status).toBe(401);
  });

  it("retorna 401 cuando channel no coincide (anti-oracle)", async () => {
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(prisma.propertyExportFeed.findUnique).mockResolvedValue({
      ...mockFeed,
      channel: "BOOKING_COM", // Feed is for Booking, but request asks for Airbnb
    });

    const { GET } = await import("../route");
    // Request asks for AIRBNB channel
    const url = new URL("http://localhost/api/ical/export?channel=AIRBNB&token=abc1234567890123456789012345678901234");

    const request = new Request(url);
    const result = await GET(request);

    expect(result.status).toBe(401);
  });

  it("retorna 200 con iCal content cuando token es válido", async () => {
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(prisma.propertyExportFeed.findUnique).mockResolvedValue(mockFeed);
    vi.mocked(prisma.property.findUnique).mockResolvedValue({ name: "Cabaña Lago" } as never);

    const { GET } = await import("../route");
    const url = new URL("http://localhost/api/ical/export?channel=AIRBNB&token=abc1234567890123456789012345678901234");

    const request = new Request(url);
    const result = await GET(request);

    expect(result.status).toBe(200);
    expect(result.headers.get("Content-Type")).toBe("text/calendar; charset=utf-8");
    expect(result.headers.get("Cache-Control")).toBe("public, max-age=300, s-maxage=300");
    expect(result.headers.get("X-Robots-Tag")).toBe("noindex");

    const body = await result.text();
    expect(body).toBe("MOCK_ICAL_CONTENT");
  });

  it("soporta Authorization: Bearer header", async () => {
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(prisma.propertyExportFeed.findUnique).mockResolvedValue(mockFeed);
    vi.mocked(prisma.property.findUnique).mockResolvedValue({ name: "Cabaña Lago" } as never);

    const { GET } = await import("../route");
    const url = new URL("http://localhost/api/ical/export?channel=AIRBNB");

    const request = new Request(url, {
      headers: {
        Authorization: "Bearer abc1234567890123456789012345678901234",
      },
    });

    const result = await GET(request);

    expect(result.status).toBe(200);
  });

  it("prefiere Authorization header sobre query param", async () => {
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(prisma.propertyExportFeed.findUnique).mockResolvedValue(mockFeed);

    const { GET } = await import("../route");
    // Query param has wrong token, header has correct one
    const url = new URL("http://localhost/api/ical/export?channel=AIRBNB&token=wrong-token");

    const request = new Request(url, {
      headers: {
        Authorization: "Bearer abc1234567890123456789012345678901234",
      },
    });

    const result = await GET(request);

    // Should succeed because header token is valid (mock matches this token)
    expect(result.status).toBe(200);
  });

  it("actualiza lastFetchedAt (fire-and-forget)", async () => {
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(prisma.propertyExportFeed.findUnique).mockResolvedValue(mockFeed);
    vi.mocked(prisma.propertyExportFeed.update).mockResolvedValue(mockFeed);

    const { GET } = await import("../route");
    const url = new URL("http://localhost/api/ical/export?channel=AIRBNB&token=abc1234567890123456789012345678901234");

    const request = new Request(url);
    await GET(request);

    // The update is fire-and-forget, so we just verify it was called
    expect(prisma.propertyExportFeed.update).toHaveBeenCalled();
  });

  it("incluye Content-Disposition con filename correcto", async () => {
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(prisma.propertyExportFeed.findUnique).mockResolvedValue(mockFeed);

    const { GET } = await import("../route");
    const url = new URL("http://localhost/api/ical/export?channel=AIRBNB&token=abc1234567890123456789012345678901234");

    const request = new Request(url);
    const result = await GET(request);

    expect(result.headers.get("Content-Disposition")).toBe(
      'inline; filename="rentalpro-prop-1-AIRBNB.ics"'
    );
  });

  it("soporta todos los canales válidos", async () => {
    const { prisma } = await import("@/lib/db/prisma");

    const channels = ["AIRBNB", "BOOKING_COM", "VRBO", "OTHER"] as const;

    for (const channel of channels) {
      vi.clearAllMocks();
      vi.mocked(prisma.propertyExportFeed.findUnique).mockResolvedValue({
        ...mockFeed,
        channel,
      });

      const { GET } = await import("../route");
      const url = new URL(`http://localhost/api/ical/export?channel=${channel}&token=abc1234567890123456789012345678901234`);

      const request = new Request(url);
      const result = await GET(request);

      expect(result.status).toBe(200);
    }
  });
});
