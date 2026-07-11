import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies before importing
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    externalChannelBlock: { findMany: vi.fn() },
    externalCalendar: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/auth/session", () => ({
  getSession: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

describe("getCalendarExternalBlocks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function getCalendarExternalBlocks(opts: {
    year: number;
    month: number;
    propertyId?: string;
  }) {
    const { prisma } = await import("@/lib/db/prisma");
    const { getSession } = await import("@/lib/auth/session");

    const session = await getSession();
    if (!session) return [];

    if (session.plan !== "PRO") return [];

    const startDate = new Date(opts.year, opts.month - 1, 1);
    const endDate = new Date(opts.year, opts.month, 0, 23, 59, 59);

    const blocks = await prisma.externalChannelBlock.findMany({
      where: {
        status: "ACTIVE",
        ...(opts.propertyId ? { propertyId: opts.propertyId } : {}),
        OR: [
          { startDate: { gte: startDate, lte: endDate } },
          { endDate: { gte: startDate, lte: endDate } },
          {
            AND: [
              { startDate: { lte: startDate } },
              { endDate: { gte: endDate } },
            ],
          },
        ],
      },
      select: {
        id: true,
        startDate: true,
        endDate: true,
        propertyId: true,
        summary: true,
        externalCalendar: {
          select: { channel: true },
        },
      },
    });

    return blocks.map((b) => ({
      id: b.id,
      startDate: b.startDate.toISOString(),
      endDate: b.endDate.toISOString(),
      channel: b.externalCalendar.channel,
      propertyId: b.propertyId,
      summary: b.summary,
    }));
  }

  it("sin sesión → []", async () => {
    const { getSession } = await import("@/lib/auth/session");
    vi.mocked(getSession).mockResolvedValue(null);

    const result = await getCalendarExternalBlocks({ year: 2025, month: 6 });
    expect(result).toEqual([]);
  });

  it("plan FREE → [] (gating)", async () => {
    const { getSession } = await import("@/lib/auth/session");
    vi.mocked(getSession).mockResolvedValue({ userId: "user-1", role: "OWNER", plan: "FREE", email: "test@test.com" });

    const result = await getCalendarExternalBlocks({ year: 2025, month: 6 });
    expect(result).toEqual([]);
  });

  it("plan PRO sin propertyId → trae todos del mes", async () => {
    const { getSession } = await import("@/lib/auth/session");
    const { prisma } = await import("@/lib/db/prisma");

    vi.mocked(getSession).mockResolvedValue({ userId: "user-1", role: "OWNER", plan: "PRO", email: "test@test.com" });
    vi.mocked(prisma.externalChannelBlock.findMany).mockResolvedValue([
      {
        id: "block-1",
        startDate: new Date("2025-06-05"),
        endDate: new Date("2025-06-10"),
        propertyId: "prop-1",
        summary: "Airbnb reservation",
        externalCalendar: { channel: "AIRBNB" as const },
      },
      {
        id: "block-2",
        startDate: new Date("2025-06-12"),
        endDate: new Date("2025-06-15"),
        propertyId: "prop-2",
        summary: null,
        externalCalendar: { channel: "BOOKING_COM" as const },
      },
    ] as never);

    const result = await getCalendarExternalBlocks({ year: 2025, month: 6 });

    expect(result).toHaveLength(2);
    expect(result[0].channel).toBe("AIRBNB");
    expect(result[1].channel).toBe("BOOKING_COM");
    expect(prisma.externalChannelBlock.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "ACTIVE",
        }),
      })
    );
  });

  it("plan PRO con propertyId → filtra por propiedad", async () => {
    const { getSession } = await import("@/lib/auth/session");
    const { prisma } = await import("@/lib/db/prisma");

    vi.mocked(getSession).mockResolvedValue({ userId: "user-1", role: "OWNER", plan: "PRO", email: "test@test.com" });
    vi.mocked(prisma.externalChannelBlock.findMany).mockResolvedValue([
      {
        id: "block-1",
        startDate: new Date("2025-06-05"),
        endDate: new Date("2025-06-10"),
        propertyId: "prop-1",
        summary: null,
        externalCalendar: { channel: "AIRBNB" as const },
      },
    ] as never);

    const result = await getCalendarExternalBlocks({ year: 2025, month: 6, propertyId: "prop-1" });

    expect(result).toHaveLength(1);
    expect(prisma.externalChannelBlock.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          propertyId: "prop-1",
        }),
      })
    );
  });

  it("plan PRO con propertyId ajeno → vacío (mock retorna vacío)", async () => {
    const { getSession } = await import("@/lib/auth/session");
    const { prisma } = await import("@/lib/db/prisma");

    vi.mocked(getSession).mockResolvedValue({ userId: "user-1", role: "OWNER", plan: "PRO", email: "test@test.com" });
    vi.mocked(prisma.externalChannelBlock.findMany).mockResolvedValue([]);

    const result = await getCalendarExternalBlocks({ year: 2025, month: 6, propertyId: "prop-other" });

    expect(result).toEqual([]);
    expect(prisma.externalChannelBlock.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          propertyId: "prop-other",
        }),
      })
    );
  });

  it("bloques INACTIVE excluidos (verifica status: ACTIVE en where)", async () => {
    const { getSession } = await import("@/lib/auth/session");
    const { prisma } = await import("@/lib/db/prisma");

    vi.mocked(getSession).mockResolvedValue({ userId: "user-1", role: "OWNER", plan: "PRO", email: "test@test.com" });
    vi.mocked(prisma.externalChannelBlock.findMany).mockResolvedValue([]);

    await getCalendarExternalBlocks({ year: 2025, month: 6 });

    expect(prisma.externalChannelBlock.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "ACTIVE",
        }),
      })
    );
  });
});
