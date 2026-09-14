/**
 * Tests de `getDashboardSummary`: la capa de datos del inicio.
 *
 * El cómputo vive en `buildDashboardSummary`, probado aparte y sin mocks. Acá
 * se fija lo único que existe en esta capa: qué se le pide a la base, con qué
 * tenencia, y cómo llegan los bloqueos externos al tablero. Importa la acción
 * REAL con Prisma mockeado, no una copia de su query.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  propertyFindMany: vi.fn(),
  reservationFindMany: vi.fn(),
  externalChannelBlockFindMany: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    property: { findMany: mocks.propertyFindMany },
    reservation: { findMany: mocks.reservationFindMany },
    externalChannelBlock: { findMany: mocks.externalChannelBlockFindMany },
  },
}));

vi.mock("@/lib/auth/session", () => ({
  getSession: mocks.getSession,
}));

import { getDashboardSummary } from "@/lib/actions/dashboard";

// Lunes 14 sept 2026, mediodía en Santiago.
const NOW = new Date("2026-09-14T15:00:00.000Z");

const SESSION = {
  userId: "owner-1",
  role: "OWNER",
  plan: "PRO",
  email: "owner@test.com",
  status: "ACTIVE",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue(SESSION);
  mocks.propertyFindMany.mockResolvedValue([]);
  mocks.reservationFindMany.mockResolvedValue([]);
  mocks.externalChannelBlockFindMany.mockResolvedValue([]);
});

describe("getDashboardSummary", () => {
  it("sin sesión devuelve null y no consulta la base", async () => {
    mocks.getSession.mockResolvedValue(null);

    expect(await getDashboardSummary({ now: NOW })).toBeNull();
    expect(mocks.propertyFindMany).not.toHaveBeenCalled();
    expect(mocks.reservationFindMany).not.toHaveBeenCalled();
    expect(mocks.externalChannelBlockFindMany).not.toHaveBeenCalled();
  });

  it("pide propiedades y reservas solo del owner de la sesión", async () => {
    await getDashboardSummary({ now: NOW });

    expect(mocks.propertyFindMany.mock.calls[0][0].where).toEqual({ userId: "owner-1" });
    expect(mocks.reservationFindMany.mock.calls[0][0].where).toEqual({ userId: "owner-1" });
  });

  // `ExternalChannelBlock` no tiene `userId`: la tenencia tiene que ir por la
  // propiedad. Sin ese filtro, el tablero de un owner contaría como ocupadas
  // propiedades por bloqueos de Airbnb de otro. El margen de 2 días sobre
  // `endDate` solo acota filas; el corte por día lo hace el seam puro.
  it("pide los bloqueos ACTIVE del owner vía property.userId, con margen de 2 días", async () => {
    await getDashboardSummary({ now: NOW });

    expect(mocks.externalChannelBlockFindMany).toHaveBeenCalledTimes(1);
    expect(mocks.externalChannelBlockFindMany.mock.calls[0][0].where).toEqual({
      status: "ACTIVE",
      property: { userId: "owner-1" },
      endDate: { gte: new Date("2026-09-12T15:00:00.000Z") },
    });
  });

  it("un bloqueo que cubre hoy llega al tablero con el canal de su calendario", async () => {
    mocks.propertyFindMany.mockResolvedValue([
      { id: "prop-1", name: "Casa Playa", unitsAvailable: 1, color: "#3B82F6" },
    ]);
    mocks.externalChannelBlockFindMany.mockResolvedValue([
      {
        propertyId: "prop-1",
        startDate: new Date("2026-09-13T15:00:00.000Z"),
        endDate: new Date("2026-09-16T15:00:00.000Z"),
        externalCalendar: { channel: "AIRBNB" },
      },
    ]);

    const summary = await getDashboardSummary({ now: NOW });

    const property = summary?.propertyBoard.properties[0];
    expect(property?.state).toBe("OCCUPIED");
    expect(property?.nextRelease?.source).toBe("EXTERNAL_BLOCK");
    expect(property?.nextRelease?.channel).toBe("AIRBNB");
    expect(property?.nextRelease?.releaseDateKey).toBe("2026-09-17");
  });
});
