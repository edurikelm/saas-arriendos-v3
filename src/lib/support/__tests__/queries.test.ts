import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Mock del adapter de Prisma. Cada test setea solo los métodos que el helper
 * bajo test invocará. Helpers de queries.ts aceptan cualquier adapter con la
 * misma shape (default `prisma` o `Prisma.TransactionClient` desde
 * `$transaction(callback)`).
 *
 * vi.mock se eleva al top del archivo, por lo que los mocks también deben
 * elevarse vía `vi.hoisted` para estar disponibles en la factory.
 */
const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  findMany: vi.fn(),
  count: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    supportTicket: {
      findUnique: mocks.findUnique,
      findMany: mocks.findMany,
      count: mocks.count,
    },
    supportTicketRead: {
      findMany: vi.fn(),
    },
  },
}));

import {
  buildUnreadMap,
  resolveAffectedEntityAdmin,
  resolveAffectedEntityOwner,
  getOwnerSupportTickets,
  getOwnerSupportTicketDetail,
  getAdminSupportTickets,
  getAdminSupportTicketDetail,
  countTicketsByStatusForOwner,
  getOwnerTicketsForResponseTime,
} from "../queries";

beforeEach(() => {
  vi.clearAllMocks();
});

// ────────────────────────────────────────────────────────────────────────────
// Helpers puros — resolveAffectedEntity*
// ────────────────────────────────────────────────────────────────────────────

describe("resolveAffectedEntityAdmin", () => {
  it("retorna PROPERTY cuando solo affectedProperty está populada", () => {
    expect(
      resolveAffectedEntityAdmin({
        affectedProperty: { id: "prop-1" },
        affectedReservation: null,
        affectedPayment: null,
      })
    ).toEqual({ type: "PROPERTY", id: "prop-1" });
  });

  it("retorna RESERVATION cuando solo affectedReservation está populada", () => {
    expect(
      resolveAffectedEntityAdmin({
        affectedProperty: null,
        affectedReservation: { id: "res-1" },
        affectedPayment: null,
      })
    ).toEqual({ type: "RESERVATION", id: "res-1" });
  });

  it("retorna PAYMENT cuando solo affectedPayment está populada", () => {
    expect(
      resolveAffectedEntityAdmin({
        affectedProperty: null,
        affectedReservation: null,
        affectedPayment: { id: "pay-1" },
      })
    ).toEqual({ type: "PAYMENT", id: "pay-1" });
  });

  it("retorna null si ninguna relation está populada", () => {
    expect(
      resolveAffectedEntityAdmin({
        affectedProperty: null,
        affectedReservation: null,
        affectedPayment: null,
      })
    ).toBeNull();
  });

  it("prioriza PROPERTY sobre RESERVATION y PAYMENT (orden admin)", () => {
    expect(
      resolveAffectedEntityAdmin({
        affectedProperty: { id: "prop-1" },
        affectedReservation: { id: "res-1" },
        affectedPayment: { id: "pay-1" },
      })
    ).toEqual({ type: "PROPERTY", id: "prop-1" });
  });
});

describe("resolveAffectedEntityOwner", () => {
  it("retorna RESERVATION cuando solo affectedReservation está populada", () => {
    expect(
      resolveAffectedEntityOwner({
        affectedProperty: null,
        affectedReservation: { id: "res-1" },
        affectedPayment: null,
      })
    ).toEqual({ type: "RESERVATION", id: "res-1" });
  });

  it("retorna PAYMENT cuando solo affectedPayment está populada", () => {
    expect(
      resolveAffectedEntityOwner({
        affectedProperty: null,
        affectedReservation: null,
        affectedPayment: { id: "pay-1" },
      })
    ).toEqual({ type: "PAYMENT", id: "pay-1" });
  });

  it("retorna PROPERTY cuando solo affectedProperty está populada", () => {
    expect(
      resolveAffectedEntityOwner({
        affectedProperty: { id: "prop-1" },
        affectedReservation: null,
        affectedPayment: null,
      })
    ).toEqual({ type: "PROPERTY", id: "prop-1" });
  });

  it("retorna null si ninguna relation está populada", () => {
    expect(
      resolveAffectedEntityOwner({
        affectedProperty: null,
        affectedReservation: null,
        affectedPayment: null,
      })
    ).toBeNull();
  });

  it("prioriza RESERVATION sobre PAYMENT y PROPERTY (orden owner)", () => {
    expect(
      resolveAffectedEntityOwner({
        affectedProperty: { id: "prop-1" },
        affectedReservation: { id: "res-1" },
        affectedPayment: { id: "pay-1" },
      })
    ).toEqual({ type: "RESERVATION", id: "res-1" });
  });
});

// ────────────────────────────────────────────────────────────────────────────
// buildUnreadMap
// ────────────────────────────────────────────────────────────────────────────

describe("buildUnreadMap", () => {
  it("retorna Map vacío sin tocar la DB si ticketIds está vacío", async () => {
    const { prisma } = await import("@/lib/db/prisma");
    const spy = vi.spyOn(prisma.supportTicketRead, "findMany");

    const map = await buildUnreadMap("user-1", []);

    expect(map.size).toBe(0);
    expect(spy).not.toHaveBeenCalled();
  });

  it("construye Map<ticketId, lastReadAt> desde findMany batched", async () => {
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(prisma.supportTicketRead.findMany).mockResolvedValue([
      { id: "r1", ticketId: "t1", userId: "user-1", lastReadAt: new Date("2026-06-01") },
      { id: "r2", ticketId: "t2", userId: "user-1", lastReadAt: new Date("2026-06-05") },
    ] as never);

    const map = await buildUnreadMap("user-1", ["t1", "t2"]);

    expect(map.size).toBe(2);
    expect(map.get("t1")?.toISOString()).toBe(new Date("2026-06-01").toISOString());
    expect(map.get("t2")?.toISOString()).toBe(new Date("2026-06-05").toISOString());
    expect(prisma.supportTicketRead.findMany).toHaveBeenCalledWith({
      where: { userId: "user-1", ticketId: { in: ["t1", "t2"] } },
    });
  });
});

// ────────────────────────────────────────────────────────────────────────────
// getOwnerSupportTickets
// ────────────────────────────────────────────────────────────────────────────

describe("getOwnerSupportTickets", () => {
  it("busca tickets del owner con paginación y orderBy lastActivityAt desc", async () => {
    const fakeTickets = [{ id: "t1" }];
    mocks.findMany.mockResolvedValue(fakeTickets);
    mocks.count.mockResolvedValue(1);

    const result = await getOwnerSupportTickets("user-1", { page: 2, limit: 5 });

    expect(result.tickets).toBe(fakeTickets);
    expect(result.total).toBe(1);
    expect(mocks.findMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      orderBy: { lastActivityAt: "desc" },
      skip: 5, // (page 2 - 1) * limit 5
      take: 5,
      include: {
        messages: {
          select: { id: true, authorId: true, createdAt: true, author: { select: { role: true } } },
          orderBy: { createdAt: "desc" },
        },
      },
    });
    expect(mocks.count).toHaveBeenCalledWith({ where: { userId: "user-1" } });
  });

  it("agrega filtro status cuando se pasa un status específico", async () => {
    mocks.findMany.mockResolvedValue([]);
    mocks.count.mockResolvedValue(0);

    await getOwnerSupportTickets("user-1", { status: "OPEN" });

    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1", status: "OPEN" },
      })
    );
  });

  it("omite filtro status cuando se pasa 'ALL'", async () => {
    mocks.findMany.mockResolvedValue([]);
    mocks.count.mockResolvedValue(0);

    await getOwnerSupportTickets("user-1", { status: "ALL" });

    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1" }, // sin status
      })
    );
  });

  it("defaults: page=1, limit=10, sin status", async () => {
    mocks.findMany.mockResolvedValue([]);
    mocks.count.mockResolvedValue(0);

    await getOwnerSupportTickets("user-1");

    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1" },
        skip: 0,
        take: 10,
      })
    );
  });
});

// ────────────────────────────────────────────────────────────────────────────
// getOwnerSupportTicketDetail
// ────────────────────────────────────────────────────────────────────────────

describe("getOwnerSupportTicketDetail", () => {
  it("filtra por userId en el where (defense in depth cross-owner)", async () => {
    const fakeTicket = { id: "t1" };
    mocks.findUnique.mockResolvedValue(fakeTicket);

    const result = await getOwnerSupportTicketDetail("user-1", "t1");

    expect(result).toBe(fakeTicket);
    expect(mocks.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "t1", userId: "user-1" },
      })
    );
  });

  it("retorna null cuando el ticket no existe o no pertenece al owner", async () => {
    mocks.findUnique.mockResolvedValue(null);

    const result = await getOwnerSupportTicketDetail("user-1", "nonexistent");

    expect(result).toBeNull();
  });

  it("incluye messages con attachments+author y 3 affected entity refs", async () => {
    mocks.findUnique.mockResolvedValue({});

    await getOwnerSupportTicketDetail("user-1", "t1");

    const call = mocks.findUnique.mock.calls[0][0];
    expect(call.include.messages).toBeDefined();
    expect(call.include.messages.select.author).toEqual({
      select: { id: true, name: true, email: true },
    });
    expect(call.include.messages.select.attachments).toBeDefined();
    expect(call.include.affectedReservation).toEqual({ select: { id: true } });
    expect(call.include.affectedPayment).toEqual({ select: { id: true } });
    expect(call.include.affectedProperty).toEqual({ select: { id: true } });
  });
});

// ────────────────────────────────────────────────────────────────────────────
// getAdminSupportTickets
// ────────────────────────────────────────────────────────────────────────────

describe("getAdminSupportTickets", () => {
  it("default: excluye CLOSED, ordena por priority desc + status asc + lastActivityAt desc", async () => {
    const fakeTickets = [{ id: "t1" }];
    mocks.findMany.mockResolvedValue(fakeTickets);
    mocks.count.mockResolvedValue(1);

    const result = await getAdminSupportTickets();

    expect(result.tickets).toBe(fakeTickets);
    expect(mocks.findMany).toHaveBeenCalledWith({
      where: { status: { not: "CLOSED" } },
      orderBy: [{ priority: "desc" }, { status: "asc" }, { lastActivityAt: "desc" }],
      include: expect.objectContaining({
        user: expect.any(Object),
        _count: { select: { messages: true } },
        messages: expect.any(Object),
      }),
    });
  });

  it("statusFilter='ALL' incluye todos los status (no agrega filtro)", async () => {
    mocks.findMany.mockResolvedValue([]);
    mocks.count.mockResolvedValue(0);

    await getAdminSupportTickets({ statusFilter: "ALL" });

    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {}, // sin filtro de status
      })
    );
  });

  it("statusFilter específico filtra por ese status", async () => {
    mocks.findMany.mockResolvedValue([]);
    mocks.count.mockResolvedValue(0);

    await getAdminSupportTickets({ statusFilter: "RESOLVED" });

    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: "RESOLVED" },
      })
    );
  });

  it("agrega filtros ownerId, priority, category cuando se pasan", async () => {
    mocks.findMany.mockResolvedValue([]);
    mocks.count.mockResolvedValue(0);

    await getAdminSupportTickets({
      statusFilter: "ALL",
      filters: { ownerId: "owner-1", priority: "HIGH", category: "PAYMENTS" },
    });

    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: "owner-1",
          priority: "HIGH",
          category: "PAYMENTS",
        },
      })
    );
  });
});

// ────────────────────────────────────────────────────────────────────────────
// getAdminSupportTicketDetail
// ────────────────────────────────────────────────────────────────────────────

describe("getAdminSupportTicketDetail", () => {
  it("busca por id sin filtro de userId (admin ve todos)", async () => {
    const fakeTicket = { id: "t1" };
    mocks.findUnique.mockResolvedValue(fakeTicket);

    const result = await getAdminSupportTicketDetail("t1");

    expect(result).toBe(fakeTicket);
    expect(mocks.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "t1" },
      })
    );
  });

  it("retorna null cuando el ticket no existe", async () => {
    mocks.findUnique.mockResolvedValue(null);

    const result = await getAdminSupportTicketDetail("nonexistent");

    expect(result).toBeNull();
  });

  it("incluye user + messages con attachments+author + 3 affected refs", async () => {
    mocks.findUnique.mockResolvedValue({});

    await getAdminSupportTicketDetail("t1");

    const call = mocks.findUnique.mock.calls[0][0];
    expect(call.include.user).toBeDefined();
    expect(call.include.messages).toBeDefined();
    expect(call.include.messages.include.author).toEqual({
      select: { id: true, name: true, email: true },
    });
    expect(call.include.messages.include.attachments).toBeDefined();
    expect(call.include.affectedProperty).toEqual({ select: { id: true } });
    expect(call.include.affectedReservation).toEqual({ select: { id: true } });
    expect(call.include.affectedPayment).toEqual({ select: { id: true } });
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Aggregates — KPIs
// ────────────────────────────────────────────────────────────────────────────

describe("countTicketsByStatusForOwner", () => {
  it("cuenta OPEN+IN_PROGRESS y RESOLVED+CLOSED en paralelo", async () => {
    mocks.count
      .mockResolvedValueOnce(3) // open
      .mockResolvedValueOnce(5); // resolved

    const result = await countTicketsByStatusForOwner("user-1");

    expect(result).toEqual({ openCount: 3, resolvedCount: 5 });
    expect(mocks.count).toHaveBeenCalledTimes(2);
    expect(mocks.count).toHaveBeenNthCalledWith(1, {
      where: { userId: "user-1", status: { in: ["OPEN", "IN_PROGRESS"] } },
    });
    expect(mocks.count).toHaveBeenNthCalledWith(2, {
      where: { userId: "user-1", status: { in: ["RESOLVED", "CLOSED"] } },
    });
  });
});

describe("getOwnerTicketsForResponseTime", () => {
  it("busca tickets con messages ordenados asc y subset de campos", async () => {
    const fakeTickets = [{ id: "t1" }];
    mocks.findMany.mockResolvedValue(fakeTickets);

    const result = await getOwnerTicketsForResponseTime("user-1");

    expect(result).toBe(fakeTickets);
    expect(mocks.findMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      select: {
        createdAt: true,
        messages: {
          orderBy: { createdAt: "asc" },
          select: { authorId: true, createdAt: true, author: { select: { role: true } } },
        },
      },
    });
  });
});
