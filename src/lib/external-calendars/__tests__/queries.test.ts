import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Mock del adapter de Prisma. Cada test setea solo los métodos que el helper
 * bajo test invocará. Helpers de queries.ts aceptan cualquier adapter con la
 * misma shape (default `prisma` o `Prisma.TransactionClient`).
 *
 * vi.mock se eleva al top del archivo, por lo que los mocks también deben
 * elevarse vía `vi.hoisted` para estar disponibles en la factory.
 */
const mocks = vi.hoisted(() => ({
  count: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    externalCalendar: {
      count: mocks.count,
    },
  },
}));

import { countActiveExternalCalendars, softStopExternalCalendarsForProperty } from "../queries";

beforeEach(() => {
  vi.clearAllMocks();
});

// ────────────────────────────────────────────────────────────────────────────
// countActiveExternalCalendars
// ────────────────────────────────────────────────────────────────────────────

describe("countActiveExternalCalendars", () => {
  it("cuenta solo calendarios con isActive=true del owner", async () => {
    mocks.count.mockResolvedValue(3);

    const count = await countActiveExternalCalendars("user-1");

    expect(count).toBe(3);
  });

  it("retorna 0 si el owner no tiene calendarios", async () => {
    mocks.count.mockResolvedValue(0);

    const count = await countActiveExternalCalendars("user-empty");

    expect(count).toBe(0);
  });

  it("usa el filter isActive=true en la query", async () => {
    mocks.count.mockResolvedValue(0);

    await countActiveExternalCalendars("user-1");

    expect(mocks.count).toHaveBeenCalledWith({
      where: { userId: "user-1", isActive: true },
    });
  });
});

// ────────────────────────────────────────────────────────────────────────────
// softStopExternalCalendarsForProperty
// ────────────────────────────────────────────────────────────────────────────

describe("softStopExternalCalendarsForProperty", () => {
  // Helper: fake adapter que solo expone los métodos que el helper usa.
  const fakeAdapter = (calendarResult: unknown[], blockResult: unknown[]) => ({
    externalCalendar: {
      updateManyAndReturn: vi.fn().mockResolvedValue(calendarResult),
    },
    externalChannelBlock: {
      updateManyAndReturn: vi.fn().mockResolvedValue(blockResult),
    },
  });

  it("retorna IDs de calendarios y bloques afectados con isActive=true en la propiedad", async () => {
    const adapter = fakeAdapter([{ id: "cal-1" }, { id: "cal-2" }], [{ id: "block-1" }]);

    const snapshot = await softStopExternalCalendarsForProperty(
      "prop-1",
      adapter as unknown as Parameters<typeof softStopExternalCalendarsForProperty>[1],
    );

    expect(snapshot.externalCalendarIds).toEqual(["cal-1", "cal-2"]);
    expect(snapshot.externalBlockIds).toEqual(["block-1"]);
  });

  it("sin calendarios ni bloques en la propiedad: retorna arrays vacíos", async () => {
    const adapter = fakeAdapter([], []);

    const snapshot = await softStopExternalCalendarsForProperty(
      "prop-empty",
      adapter as unknown as Parameters<typeof softStopExternalCalendarsForProperty>[1],
    );

    expect(snapshot.externalCalendarIds).toEqual([]);
    expect(snapshot.externalBlockIds).toEqual([]);
  });

  it("solo afecta la propiedad indicada: no toca calendarios de otras propiedades", async () => {
    const adapter = fakeAdapter([], []);

    await softStopExternalCalendarsForProperty(
      "prop-1",
      adapter as unknown as Parameters<typeof softStopExternalCalendarsForProperty>[1],
    );

    expect(
      (adapter.externalCalendar.updateManyAndReturn as ReturnType<typeof vi.fn>).mock
        .calls[0],
    ).toMatchObject([
      {
        where: { propertyId: "prop-1", isActive: true },
        data: { isActive: false },
        select: { id: true },
      },
    ]);
    expect(
      (adapter.externalChannelBlock.updateManyAndReturn as ReturnType<typeof vi.fn>).mock
        .calls[0],
    ).toMatchObject([
      {
        where: { status: "ACTIVE", propertyId: "prop-1" },
        data: { status: "INACTIVE" },
        select: { id: true },
      },
    ]);
  });

  it("idempotente: segundo llamado con recursos ya inactivos retorna arrays vacíos", async () => {
    const adapter = {
      externalCalendar: {
        updateManyAndReturn: vi
          .fn()
          .mockResolvedValueOnce([{ id: "cal-1" }])
          .mockResolvedValueOnce([]),
      },
      externalChannelBlock: {
        updateManyAndReturn: vi
          .fn()
          .mockResolvedValueOnce([{ id: "block-1" }])
          .mockResolvedValueOnce([]),
      },
    };

    const snap1 = await softStopExternalCalendarsForProperty(
      "prop-1",
      adapter as unknown as Parameters<typeof softStopExternalCalendarsForProperty>[1],
    );
    expect(snap1.externalCalendarIds).toEqual(["cal-1"]);
    expect(snap1.externalBlockIds).toEqual(["block-1"]);

    const snap2 = await softStopExternalCalendarsForProperty(
      "prop-1",
      adapter as unknown as Parameters<typeof softStopExternalCalendarsForProperty>[1],
    );
    expect(snap2.externalCalendarIds).toEqual([]);
    expect(snap2.externalBlockIds).toEqual([]);
  });
});
