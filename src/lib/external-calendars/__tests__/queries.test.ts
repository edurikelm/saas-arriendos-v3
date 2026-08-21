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

import { countActiveExternalCalendars } from "../queries";

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
