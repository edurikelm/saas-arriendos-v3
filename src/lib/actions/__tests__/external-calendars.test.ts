import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SessionUser } from "@/lib/actions/auth";

const mockPrisma = vi.hoisted(() => ({
  externalCalendar: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  property: {
    findFirst: vi.fn(),
  },
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: mockPrisma }));

vi.mock("@/lib/actions/auth", () => ({
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

const mockCalendar = {
  id: "cal-1",
  userId: "user-1",
  propertyId: "prop-1",
  channel: "AIRBNB" as const,
  name: "Test Calendar",
  feedUrl: "https://example.com/ical",
  isActive: true,
  lastSyncedAt: null,
  lastSyncError: null,
  lastSyncCount: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockProperty = {
  id: "prop-1",
  userId: "user-1",
  name: "Test Property",
};

describe("listExternalCalendars", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retorna error si no hay sesión", async () => {
    const { getSession } = await import("@/lib/actions/auth");
    vi.mocked(getSession).mockResolvedValue(null);

    const { listExternalCalendars } = await import("../external-calendars");
    const result = await listExternalCalendars("prop-1");

    expect(result).toEqual({ error: "No autorizado" });
  });

  it("retorna error si propiedad no es del owner", async () => {
    const { getSession } = await import("@/lib/actions/auth");
    vi.mocked(getSession).mockResolvedValue(mockSession);
    mockPrisma.property.findFirst.mockResolvedValue(null);

    const { listExternalCalendars } = await import("../external-calendars");
    const result = await listExternalCalendars("prop-other");

    expect(result).toEqual({ error: "Propiedad no encontrada" });
  });

  it("retorna calendarios activos por defecto", async () => {
    const { getSession } = await import("@/lib/actions/auth");
    vi.mocked(getSession).mockResolvedValue(mockSession);
    mockPrisma.property.findFirst.mockResolvedValue(mockProperty);
    mockPrisma.externalCalendar.findMany.mockResolvedValue([mockCalendar]);

    const { listExternalCalendars } = await import("../external-calendars");
    const result = await listExternalCalendars("prop-1");

    expect(result).toEqual([mockCalendar]);
    expect(mockPrisma.externalCalendar.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ propertyId: "prop-1", isActive: true }) })
    );
  });
});

describe("createExternalCalendar", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rechaza plan FREE", async () => {
    const { getSession } = await import("@/lib/actions/auth");
    vi.mocked(getSession).mockResolvedValue({ ...mockSession, plan: "FREE" });

    const { createExternalCalendar } = await import("../external-calendars");
    const result = await createExternalCalendar({
      propertyId: "prop-1",
      channel: "AIRBNB",
      name: "Test",
      feedUrl: "https://example.com/ical",
    });

    expect(result).toEqual({ error: "Funcionalidad disponible solo para plan PRO" });
  });

  it("crea calendario exitosamente con plan PRO", async () => {
    const { getSession } = await import("@/lib/actions/auth");
    vi.mocked(getSession).mockResolvedValue(mockSession);
    mockPrisma.property.findFirst.mockResolvedValue(mockProperty);
    mockPrisma.externalCalendar.create.mockResolvedValue(mockCalendar);

    const { createExternalCalendar } = await import("../external-calendars");
    const result = await createExternalCalendar({
      propertyId: "prop-1",
      channel: "AIRBNB",
      name: "Test Calendar",
      feedUrl: "https://example.com/ical",
    });

    expect(result.success).toBe(true);
    expect(mockPrisma.externalCalendar.create).toHaveBeenCalled();
  });

  it("rechaza propiedad que no es del owner", async () => {
    const { getSession } = await import("@/lib/actions/auth");
    vi.mocked(getSession).mockResolvedValue(mockSession);
    mockPrisma.property.findFirst.mockResolvedValue(null);

    const { createExternalCalendar } = await import("../external-calendars");
    const result = await createExternalCalendar({
      propertyId: "prop-other",
      channel: "AIRBNB",
      name: "Test",
      feedUrl: "https://example.com/ical",
    });

    expect(result).toEqual({ error: "Propiedad no encontrada" });
  });
});

describe("updateExternalCalendar", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rechaza plan FREE", async () => {
    const { getSession } = await import("@/lib/actions/auth");
    vi.mocked(getSession).mockResolvedValue({ ...mockSession, plan: "FREE" });

    const { updateExternalCalendar } = await import("../external-calendars");
    const result = await updateExternalCalendar({ id: "cal-1", name: "New Name" });

    expect(result).toEqual({ error: "Funcionalidad disponible solo para plan PRO" });
  });

  it("actualiza calendario exitosamente", async () => {
    const { getSession } = await import("@/lib/actions/auth");
    vi.mocked(getSession).mockResolvedValue(mockSession);
    mockPrisma.externalCalendar.findFirst.mockResolvedValue(mockCalendar);
    mockPrisma.externalCalendar.update.mockResolvedValue({ ...mockCalendar, name: "New Name" });

    const { updateExternalCalendar } = await import("../external-calendars");
    const result = await updateExternalCalendar({ id: "cal-1", name: "New Name" });

    expect(result.success).toBe(true);
  });

  it("rechaza calendario que no es del owner", async () => {
    const { getSession } = await import("@/lib/actions/auth");
    vi.mocked(getSession).mockResolvedValue(mockSession);
    mockPrisma.externalCalendar.findFirst.mockResolvedValue(null);

    const { updateExternalCalendar } = await import("../external-calendars");
    const result = await updateExternalCalendar({ id: "cal-other", name: "New Name" });

    expect(result).toEqual({ error: "Calendario no encontrado" });
  });
});

describe("deleteExternalCalendar (soft delete)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rechaza plan FREE", async () => {
    const { getSession } = await import("@/lib/actions/auth");
    vi.mocked(getSession).mockResolvedValue({ ...mockSession, plan: "FREE" });

    const { deleteExternalCalendar } = await import("../external-calendars");
    const result = await deleteExternalCalendar("cal-1");

    expect(result).toEqual({ error: "Funcionalidad disponible solo para plan PRO" });
  });

  it("soft delete via isActive=false", async () => {
    const { getSession } = await import("@/lib/actions/auth");
    vi.mocked(getSession).mockResolvedValue(mockSession);
    mockPrisma.externalCalendar.findFirst.mockResolvedValue(mockCalendar);
    mockPrisma.externalCalendar.update.mockResolvedValue({ ...mockCalendar, isActive: false });

    const { deleteExternalCalendar } = await import("../external-calendars");
    const result = await deleteExternalCalendar("cal-1");

    expect(result.success).toBe(true);
    expect(mockPrisma.externalCalendar.update).toHaveBeenCalledWith({
      where: { id: "cal-1" },
      data: { isActive: false },
    });
  });
});

describe("syncExternalCalendar", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rechaza plan FREE", async () => {
    const { getSession } = await import("@/lib/actions/auth");
    vi.mocked(getSession).mockResolvedValue({ ...mockSession, plan: "FREE" });

    const { syncExternalCalendar } = await import("../external-calendars");
    const result = await syncExternalCalendar({ id: "cal-1" });

    expect(result).toEqual({ error: "Funcionalidad disponible solo para plan PRO" });
  });

  it("rechaza calendario que no es del owner", async () => {
    const { getSession } = await import("@/lib/actions/auth");
    vi.mocked(getSession).mockResolvedValue(mockSession);
    mockPrisma.externalCalendar.findFirst.mockResolvedValue(null);

    const { syncExternalCalendar } = await import("../external-calendars");
    const result = await syncExternalCalendar({ id: "cal-other" });

    expect(result).toEqual({ error: "Calendario no encontrado" });
  });
});

describe("getExternalCalendarStatus", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retorna error si no hay sesión", async () => {
    const { getSession } = await import("@/lib/actions/auth");
    vi.mocked(getSession).mockResolvedValue(null);

    const { getExternalCalendarStatus } = await import("../external-calendars");
    const result = await getExternalCalendarStatus("cal-1");

    expect(result).toEqual({ error: "No autorizado" });
  });

  it("retorna status del calendario", async () => {
    const { getSession } = await import("@/lib/actions/auth");
    vi.mocked(getSession).mockResolvedValue(mockSession);
    mockPrisma.externalCalendar.findFirst.mockResolvedValue({
      ...mockCalendar,
      lastSyncedAt: new Date("2026-01-01T10:00:00Z"),
      lastSyncError: null,
      lastSyncCount: 3,
    });

    const { getExternalCalendarStatus } = await import("../external-calendars");
    const result = await getExternalCalendarStatus("cal-1");

    expect(result).toEqual({
      isActive: true,
      lastSyncedAt: "2026-01-01T10:00:00.000Z",
      lastSyncError: null,
      lastSyncCount: 3,
    });
  });
});
