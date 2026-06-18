import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/actions/auth", () => ({
  getSession: vi.fn(),
  requireSuperAdmin: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    supportTicket: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    supportMessage: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    supportTicketRead: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    userProfile: {
      findUnique: vi.fn(),
    },
  },
}));

import { getSession, requireSuperAdmin } from "@/lib/actions/auth";
import { prisma } from "@/lib/db/prisma";

const mockGetSession = getSession as ReturnType<typeof vi.fn>;
const mockRequireSuperAdmin = requireSuperAdmin as ReturnType<typeof vi.fn>;

const mockPrisma = prisma as unknown as {
  supportTicket: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  supportMessage: {
    create: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
  supportTicketRead: {
    findMany: ReturnType<typeof vi.fn>;
  };
  userProfile: {
    findUnique: ReturnType<typeof vi.fn>;
  };
};

const adminUser = { userId: "admin-1", role: "SUPER_ADMIN", email: "admin@test.com", plan: null };
const ownerUser = { userId: "owner-1", role: "OWNER", email: "owner@test.com", plan: "FREE" as const };

function makeTicket(overrides: Record<string, unknown> = {}) {
  return {
    id: "ticket-1",
    userId: "owner-1",
    subject: "Test ticket",
    description: "Test description",
    status: "OPEN",
    priority: "MEDIUM",
    category: "ACCOUNT",
    lastActivityAt: new Date("2026-06-01"),
    createdAt: new Date("2026-06-01"),
    updatedAt: new Date("2026-06-01"),
    user: {
      id: "owner-1",
      name: "Owner Name",
      email: "owner@test.com",
      plan: "FREE",
      status: "ACTIVE",
    },
    _count: { messages: 3 },
    messages: [],
    ...overrides,
  };
}

describe("Admin Support Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Role guard ──────────────────────────────────────
  describe("getAllSupportTickets", () => {
    it("returns empty when user is not SUPER_ADMIN", async () => {
      mockGetSession.mockResolvedValue(ownerUser);

      const { getAllSupportTickets } = await import("@/lib/actions/admin-support");
      const result = await getAllSupportTickets();

      expect(result).toEqual({ data: [], total: 0, page: 1, totalPages: 0 });
      expect(mockPrisma.supportTicket.findMany).not.toHaveBeenCalled();
    });

    it("returns all tickets when user is SUPER_ADMIN", async () => {
      mockGetSession.mockResolvedValue(adminUser);
      mockPrisma.supportTicket.findMany.mockResolvedValue([makeTicket()]);
      mockPrisma.supportTicket.count.mockResolvedValue(1);

      const { getAllSupportTickets } = await import("@/lib/actions/admin-support");
      const result = await getAllSupportTickets();

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(mockPrisma.supportTicket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ priority: "desc" }, { status: "asc" }, { lastActivityAt: "desc" }],
        })
      );
    });

    it("filters out CLOSED tickets by default", async () => {
      mockGetSession.mockResolvedValue(adminUser);
      mockPrisma.supportTicket.findMany.mockResolvedValue([makeTicket()]);
      mockPrisma.supportTicket.count.mockResolvedValue(1);

      const { getAllSupportTickets } = await import("@/lib/actions/admin-support");
      await getAllSupportTickets();

      expect(mockPrisma.supportTicket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { not: "CLOSED" },
          }),
        })
      );
    });

    it("includes CLOSED tickets when statusFilter is ALL", async () => {
      mockGetSession.mockResolvedValue(adminUser);
      mockPrisma.supportTicket.findMany.mockResolvedValue([makeTicket()]);
      mockPrisma.supportTicket.count.mockResolvedValue(1);

      const { getAllSupportTickets } = await import("@/lib/actions/admin-support");
      await getAllSupportTickets("ALL");

      expect(mockPrisma.supportTicket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
        })
      );
    });

    it("includes owner info in returned tickets", async () => {
      mockGetSession.mockResolvedValue(adminUser);
      mockPrisma.supportTicket.findMany.mockResolvedValue([
        makeTicket({
          user: {
            id: "owner-1",
            name: "Owner Name",
            email: "owner@test.com",
            plan: "FREE",
            status: "ACTIVE",
          },
        }),
      ]);
      mockPrisma.supportTicket.count.mockResolvedValue(1);

      const { getAllSupportTickets } = await import("@/lib/actions/admin-support");
      const result = await getAllSupportTickets();

      expect(result.data[0].ownerEmail).toBe("owner@test.com");
      expect(result.data[0].ownerName).toBe("Owner Name");
    });

    it("marks hasUnread=true when owner message exists and no read record", async () => {
      mockGetSession.mockResolvedValue(adminUser);
      mockPrisma.supportTicket.findMany.mockResolvedValue([
        makeTicket({
          messages: [
            {
              id: "msg-1",
              authorId: "owner-1",
              createdAt: new Date("2026-06-02"),
              author: { role: "OWNER" },
            },
          ],
        }),
      ]);
      mockPrisma.supportTicket.count.mockResolvedValue(1);
      mockPrisma.supportTicketRead.findMany.mockResolvedValue([]);

      const { getAllSupportTickets } = await import("@/lib/actions/admin-support");
      const result = await getAllSupportTickets();

      expect(result.data[0].hasUnread).toBe(true);
    });

    it("marks hasUnread=false when only admin messages exist", async () => {
      mockGetSession.mockResolvedValue(adminUser);
      mockPrisma.supportTicket.findMany.mockResolvedValue([
        makeTicket({
          messages: [
            {
              id: "msg-1",
              authorId: "admin-1",
              createdAt: new Date("2026-06-02"),
              author: { role: "SUPER_ADMIN" },
            },
          ],
        }),
      ]);
      mockPrisma.supportTicket.count.mockResolvedValue(1);

      const { getAllSupportTickets } = await import("@/lib/actions/admin-support");
      const result = await getAllSupportTickets();

      expect(result.data[0].hasUnread).toBe(false);
    });

    it("marks hasUnread=false when owner message was already read", async () => {
      mockGetSession.mockResolvedValue(adminUser);
      mockPrisma.supportTicket.findMany.mockResolvedValue([
        makeTicket({
          messages: [
            {
              id: "msg-1",
              authorId: "owner-1",
              createdAt: new Date("2026-06-01"),
              author: { role: "OWNER" },
            },
          ],
        }),
      ]);
      mockPrisma.supportTicket.count.mockResolvedValue(1);
      mockPrisma.supportTicketRead.findMany.mockResolvedValue([
        { id: "read-1", ticketId: "ticket-1", userId: "admin-1", lastReadAt: new Date("2026-06-05") },
      ]);

      const { getAllSupportTickets } = await import("@/lib/actions/admin-support");
      const result = await getAllSupportTickets();

      expect(result.data[0].hasUnread).toBe(false);
    });

    it("marks hasUnread=true when owner message is newer than last read", async () => {
      mockGetSession.mockResolvedValue(adminUser);
      mockPrisma.supportTicket.findMany.mockResolvedValue([
        makeTicket({
          messages: [
            {
              id: "msg-1",
              authorId: "owner-1",
              createdAt: new Date("2026-06-10"),
              author: { role: "OWNER" },
            },
          ],
        }),
      ]);
      mockPrisma.supportTicket.count.mockResolvedValue(1);
      mockPrisma.supportTicketRead.findMany.mockResolvedValue([
        { id: "read-1", ticketId: "ticket-1", userId: "admin-1", lastReadAt: new Date("2026-06-05") },
      ]);

      const { getAllSupportTickets } = await import("@/lib/actions/admin-support");
      const result = await getAllSupportTickets();

      expect(result.data[0].hasUnread).toBe(true);
    });

    it("marks hasUnread=false when ticket has no messages", async () => {
      mockGetSession.mockResolvedValue(adminUser);
      mockPrisma.supportTicket.findMany.mockResolvedValue([
        makeTicket({ messages: [] }),
      ]);
      mockPrisma.supportTicket.count.mockResolvedValue(1);

      const { getAllSupportTickets } = await import("@/lib/actions/admin-support");
      const result = await getAllSupportTickets();

      expect(result.data[0].hasUnread).toBe(false);
    });

    it("marks hasUnread=true when last message is admin-authored but earlier OWNER message is unread", async () => {
      mockGetSession.mockResolvedValue(adminUser);
      mockPrisma.supportTicket.findMany.mockResolvedValue([
        makeTicket({
          messages: [
            { id: "msg-2", authorId: "admin-1", createdAt: new Date("2026-06-10"), author: { role: "SUPER_ADMIN" } },
            { id: "msg-1", authorId: "owner-1", createdAt: new Date("2026-06-08"), author: { role: "OWNER" } },
          ],
        }),
      ]);
      mockPrisma.supportTicket.count.mockResolvedValue(1);
      mockPrisma.supportTicketRead.findMany.mockResolvedValue([
        { id: "read-1", ticketId: "ticket-1", userId: "admin-1", lastReadAt: new Date("2026-06-05") },
      ]);

      const { getAllSupportTickets } = await import("@/lib/actions/admin-support");
      const result = await getAllSupportTickets();

      expect(result.data[0].hasUnread).toBe(true);
    });
  });

  // ── Detail ──────────────────────────────────────────
  describe("getAdminSupportTicketDetail", () => {
    it("returns null when user is not SUPER_ADMIN", async () => {
      mockGetSession.mockResolvedValue(ownerUser);

      const { getAdminSupportTicketDetail } = await import("@/lib/actions/admin-support");
      const result = await getAdminSupportTicketDetail("ticket-1");

      expect(result).toBeNull();
    });

    it("returns ticket with messages and owner data", async () => {
      mockGetSession.mockResolvedValue(adminUser);
      mockPrisma.supportTicket.findUnique.mockResolvedValue(
        makeTicket({
          messages: [
            {
              id: "msg-1",
              supportTicketId: "ticket-1",
              authorId: "owner-1",
              content: "Need help",
              createdAt: new Date("2026-06-01"),
              attachments: [],
              author: { id: "owner-1", name: "Owner Name", email: "owner@test.com" },
            },
          ],
        })
      );

      const { getAdminSupportTicketDetail } = await import("@/lib/actions/admin-support");
      const result = await getAdminSupportTicketDetail("ticket-1");

      expect(result).not.toBeNull();
      expect(result?.ticket.id).toBe("ticket-1");
      expect(result?.messages).toHaveLength(1);
      expect(result?.messages[0].content).toBe("Need help");
      expect(result?.owner.email).toBe("owner@test.com");
    });

    it("returns null when ticket not found", async () => {
      mockGetSession.mockResolvedValue(adminUser);
      mockPrisma.supportTicket.findUnique.mockResolvedValue(null);

      const { getAdminSupportTicketDetail } = await import("@/lib/actions/admin-support");
      const result = await getAdminSupportTicketDetail("nonexistent");

      expect(result).toBeNull();
    });

    it("returns attachments in messages", async () => {
      mockGetSession.mockResolvedValue(adminUser);
      const now = new Date("2026-06-01");
      mockPrisma.supportTicket.findUnique.mockResolvedValue({
        id: "ticket-1",
        userId: "owner-1",
        subject: "Test ticket",
        description: "Test description",
        status: "OPEN",
        priority: "MEDIUM",
        category: "ACCOUNT",
        lastActivityAt: now,
        createdAt: now,
        updatedAt: now,
        user: { id: "owner-1", name: "Owner Name", email: "owner@test.com", plan: "FREE", status: "ACTIVE" },
        _count: { messages: 3 },
        messages: [
          {
            id: "msg-1",
            supportTicketId: "ticket-1",
            authorId: "owner-1",
            content: "Need help",
            createdAt: now,
            attachments: [
              { id: "att-1", messageId: "msg-1", url: "https://example.com/img.jpg", fileName: "img.jpg", fileSize: 1024, createdAt: now },
            ],
            author: { id: "owner-1", name: "Owner Name", email: "owner@test.com" },
          },
        ],
      });

      const { getAdminSupportTicketDetail } = await import("@/lib/actions/admin-support");
      const result = await getAdminSupportTicketDetail("ticket-1");

      expect(result).not.toBeNull();
      expect(result!.messages[0].content).toBe("Need help");
      expect(result!.messages[0].attachments).toHaveLength(1);
      expect(result!.messages[0].attachments[0].url).toBe("https://example.com/img.jpg");
    });

    it("retorna affectedEntity null cuando no hay entidad afectada", async () => {
      mockGetSession.mockResolvedValue(adminUser);
      mockPrisma.supportTicket.findUnique.mockResolvedValue({
        ...makeTicket({}),
        messages: [],
        affectedProperty: null,
        affectedReservation: null,
        affectedPayment: null,
      });
      const { getAdminSupportTicketDetail } = await import("@/lib/actions/admin-support");
      const result = await getAdminSupportTicketDetail("ticket-1");
      expect(result!.affectedEntity).toBeNull();
    });

    it("retorna affectedEntity tipo PROPERTY", async () => {
      mockGetSession.mockResolvedValue(adminUser);
      mockPrisma.supportTicket.findUnique.mockResolvedValue({
        ...makeTicket({}),
        messages: [],
        affectedProperty: { id: "prop-1" },
        affectedReservation: null,
        affectedPayment: null,
      });
      const { getAdminSupportTicketDetail } = await import("@/lib/actions/admin-support");
      const result = await getAdminSupportTicketDetail("ticket-1");
      expect(result!.affectedEntity).toEqual({ type: "PROPERTY", id: "prop-1" });
    });

    it("retorna affectedEntity tipo RESERVATION", async () => {
      mockGetSession.mockResolvedValue(adminUser);
      mockPrisma.supportTicket.findUnique.mockResolvedValue({
        ...makeTicket({}),
        messages: [],
        affectedProperty: null,
        affectedReservation: { id: "res-1" },
        affectedPayment: null,
      });
      const { getAdminSupportTicketDetail } = await import("@/lib/actions/admin-support");
      const result = await getAdminSupportTicketDetail("ticket-1");
      expect(result!.affectedEntity).toEqual({ type: "RESERVATION", id: "res-1" });
    });

    it("retorna affectedEntity tipo PAYMENT", async () => {
      mockGetSession.mockResolvedValue(adminUser);
      mockPrisma.supportTicket.findUnique.mockResolvedValue({
        ...makeTicket({}),
        messages: [],
        affectedProperty: null,
        affectedReservation: null,
        affectedPayment: { id: "pay-1" },
      });
      const { getAdminSupportTicketDetail } = await import("@/lib/actions/admin-support");
      const result = await getAdminSupportTicketDetail("ticket-1");
      expect(result!.affectedEntity).toEqual({ type: "PAYMENT", id: "pay-1" });
    });
  });

  // ── Respond ─────────────────────────────────────────
  describe("respondToSupportTicket", () => {
    it("returns error when user is not SUPER_ADMIN", async () => {
      mockGetSession.mockResolvedValue(ownerUser);

      const { respondToSupportTicket } = await import("@/lib/actions/admin-support");
      const result = await respondToSupportTicket("ticket-1", "response content");

      expect(result).toEqual({ error: "No autorizado" });
    });

    it("returns error when ticket is CLOSED", async () => {
      mockGetSession.mockResolvedValue(adminUser);
      mockPrisma.supportTicket.findUnique.mockResolvedValue(makeTicket({ status: "CLOSED" }));

      const { respondToSupportTicket } = await import("@/lib/actions/admin-support");
      const result = await respondToSupportTicket("ticket-1", "response content");

      expect(result).toEqual({ error: "No se puede responder un ticket cerrado" });
    });

    it("creates a message and updates lastActivityAt", async () => {
      mockGetSession.mockResolvedValue(adminUser);
      mockPrisma.supportTicket.findUnique.mockResolvedValue(makeTicket({ status: "OPEN" }));
      mockPrisma.supportMessage.create.mockResolvedValue({
        id: "msg-new",
        supportTicketId: "ticket-1",
        authorId: "admin-1",
        content: "response content",
        createdAt: new Date(),
      });
      mockPrisma.supportTicket.update.mockResolvedValue(makeTicket({ status: "OPEN" }));

      const { respondToSupportTicket } = await import("@/lib/actions/admin-support");
      const result = await respondToSupportTicket("ticket-1", "response content");

      expect(result.success).toBe(true);
      expect(mockPrisma.supportMessage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            supportTicketId: "ticket-1",
            authorId: "admin-1",
            content: "response content",
          }),
        })
      );
      expect(mockPrisma.supportTicket.update).toHaveBeenCalled();
    });

    it("auto-transitions OPEN to IN_PROGRESS on first admin response", async () => {
      mockGetSession.mockResolvedValue(adminUser);
      mockPrisma.supportTicket.findUnique.mockResolvedValue(makeTicket({ status: "OPEN" }));
      mockPrisma.supportMessage.create.mockResolvedValue({
        id: "msg-new",
        supportTicketId: "ticket-1",
        authorId: "admin-1",
        content: "I'll help",
        createdAt: new Date(),
      });
      mockPrisma.supportTicket.update.mockResolvedValue(makeTicket({ status: "IN_PROGRESS" }));

      const { respondToSupportTicket } = await import("@/lib/actions/admin-support");
      await respondToSupportTicket("ticket-1", "I'll help");

      const updateCall = mockPrisma.supportTicket.update.mock.calls[0][0];
      expect(updateCall.data.status).toBe("IN_PROGRESS");
    });

    it("does not transition IN_PROGRESS ticket", async () => {
      mockGetSession.mockResolvedValue(adminUser);
      mockPrisma.supportTicket.findUnique.mockResolvedValue(makeTicket({ status: "IN_PROGRESS" }));
      mockPrisma.supportMessage.create.mockResolvedValue({
        id: "msg-new",
        supportTicketId: "ticket-1",
        authorId: "admin-1",
        content: "Still helping",
        createdAt: new Date(),
      });
      mockPrisma.supportTicket.update.mockResolvedValue(makeTicket({ status: "IN_PROGRESS" }));

      const { respondToSupportTicket } = await import("@/lib/actions/admin-support");
      await respondToSupportTicket("ticket-1", "Still helping");

      const updateCall = mockPrisma.supportTicket.update.mock.calls[0][0];
      expect(updateCall.data.status).not.toBeDefined();
    });

    it("returns error for empty content", async () => {
      mockGetSession.mockResolvedValue(adminUser);

      const { respondToSupportTicket } = await import("@/lib/actions/admin-support");
      const result = await respondToSupportTicket("ticket-1", "");

      expect(result).toEqual({ error: "El contenido debe tener entre 1 y 2000 caracteres" });
    });

    it("returns error for content exceeding 2000 chars", async () => {
      mockGetSession.mockResolvedValue(adminUser);

      const { respondToSupportTicket } = await import("@/lib/actions/admin-support");
      const result = await respondToSupportTicket("ticket-1", "x".repeat(2001));

      expect(result).toEqual({ error: "El contenido debe tener entre 1 y 2000 caracteres" });
    });
  });

  // ── Resolve ─────────────────────────────────────────
  describe("resolveSupportTicket", () => {
    it("returns error when user is not SUPER_ADMIN", async () => {
      mockGetSession.mockResolvedValue(ownerUser);

      const { resolveSupportTicket } = await import("@/lib/actions/admin-support");
      const result = await resolveSupportTicket("ticket-1");

      expect(result).toEqual({ error: "No autorizado" });
    });

    it("sets status to RESOLVED", async () => {
      mockGetSession.mockResolvedValue(adminUser);
      mockPrisma.supportTicket.findUnique.mockResolvedValue(makeTicket({ status: "OPEN" }));
      mockPrisma.supportTicket.update.mockResolvedValue(makeTicket({ status: "RESOLVED" }));

      const { resolveSupportTicket } = await import("@/lib/actions/admin-support");
      const result = await resolveSupportTicket("ticket-1");

      expect(result.success).toBe(true);
      expect(mockPrisma.supportTicket.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "ticket-1" },
          data: expect.objectContaining({ status: "RESOLVED" }),
        })
      );
    });
  });

  // ── Close ──────────────────────────────────────────
  describe("closeSupportTicket", () => {
    it("returns error when user is not SUPER_ADMIN nor ticket owner", async () => {
      mockGetSession.mockResolvedValue({ userId: "other-owner", role: "OWNER", email: "other@test.com", plan: "FREE" });
      mockPrisma.supportTicket.findUnique.mockResolvedValue(makeTicket({ userId: "owner-1" }));

      const { closeSupportTicket } = await import("@/lib/actions/admin-support");
      const result = await closeSupportTicket("ticket-1");

      expect(result).toEqual({ error: "No autorizado" });
    });

    it("allows ticket owner to close", async () => {
      mockGetSession.mockResolvedValue(ownerUser);
      mockPrisma.supportTicket.findUnique.mockResolvedValue(makeTicket({ userId: "owner-1" }));
      mockPrisma.supportTicket.update.mockResolvedValue(makeTicket({ status: "CLOSED" }));

      const { closeSupportTicket } = await import("@/lib/actions/admin-support");
      const result = await closeSupportTicket("ticket-1");

      expect(result.success).toBe(true);
    });

    it("allows SUPER_ADMIN to close", async () => {
      mockGetSession.mockResolvedValue(adminUser);
      mockPrisma.supportTicket.findUnique.mockResolvedValue(makeTicket({ userId: "owner-1" }));
      mockPrisma.supportTicket.update.mockResolvedValue(makeTicket({ status: "CLOSED" }));

      const { closeSupportTicket } = await import("@/lib/actions/admin-support");
      const result = await closeSupportTicket("ticket-1");

      expect(result.success).toBe(true);
    });
  });

  // ── Filters ─────────────────────────────────────────
  describe("getAllSupportTickets filters", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("filters by priority", async () => {
      mockGetSession.mockResolvedValue(adminUser);
      mockPrisma.supportTicket.findMany.mockResolvedValue([makeTicket({ priority: "HIGH" })]);
      mockPrisma.supportTicket.count.mockResolvedValue(1);

      const { getAllSupportTickets } = await import("@/lib/actions/admin-support");
      await getAllSupportTickets("ALL", { priority: "HIGH" });

      expect(mockPrisma.supportTicket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ priority: "HIGH" }),
        })
      );
    });

    it("filters by category", async () => {
      mockGetSession.mockResolvedValue(adminUser);
      mockPrisma.supportTicket.findMany.mockResolvedValue([makeTicket({ category: "PAYMENTS" })]);
      mockPrisma.supportTicket.count.mockResolvedValue(1);

      const { getAllSupportTickets } = await import("@/lib/actions/admin-support");
      await getAllSupportTickets("ALL", { category: "PAYMENTS" });

      expect(mockPrisma.supportTicket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ category: "PAYMENTS" }),
        })
      );
    });

    it("filters by owner userId", async () => {
      mockGetSession.mockResolvedValue(adminUser);
      mockPrisma.supportTicket.findMany.mockResolvedValue([makeTicket({ userId: "owner-2" })]);
      mockPrisma.supportTicket.count.mockResolvedValue(1);

      const { getAllSupportTickets } = await import("@/lib/actions/admin-support");
      await getAllSupportTickets("ALL", { ownerId: "owner-2" });

      expect(mockPrisma.supportTicket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: "owner-2" }),
        })
      );
    });

    it("filters by all criteria combined", async () => {
      mockGetSession.mockResolvedValue(adminUser);
      mockPrisma.supportTicket.findMany.mockResolvedValue([]);
      mockPrisma.supportTicket.count.mockResolvedValue(0);

      const { getAllSupportTickets } = await import("@/lib/actions/admin-support");
      await getAllSupportTickets("OPEN", { ownerId: "owner-1", priority: "HIGH", category: "PAYMENTS" });

      expect(mockPrisma.supportTicket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: "OPEN",
            userId: "owner-1",
            priority: "HIGH",
            category: "PAYMENTS",
          }),
        })
      );
    });
  });

  // ── Admin ordering ──────────────────────────────────
  describe("getAllSupportTickets ordering", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("orders by priority desc, status asc, lastActivityAt desc", async () => {
      mockGetSession.mockResolvedValue(adminUser);
      mockPrisma.supportTicket.findMany.mockResolvedValue([makeTicket()]);
      mockPrisma.supportTicket.count.mockResolvedValue(1);

      const { getAllSupportTickets } = await import("@/lib/actions/admin-support");
      await getAllSupportTickets();

      expect(mockPrisma.supportTicket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ priority: "desc" }, { status: "asc" }, { lastActivityAt: "desc" }],
        })
      );
    });
  });

  // ── Reclassification ────────────────────────────────
  describe("updateSupportTicketPriority", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("returns error when user is not SUPER_ADMIN", async () => {
      mockGetSession.mockResolvedValue(ownerUser);

      const { updateSupportTicketPriority } = await import("@/lib/actions/admin-support");
      const result = await updateSupportTicketPriority("ticket-1", "HIGH");

      expect(result).toEqual({ error: "No autorizado" });
    });

    it("updates priority when SUPER_ADMIN", async () => {
      mockGetSession.mockResolvedValue(adminUser);
      mockPrisma.supportTicket.findUnique.mockResolvedValue(makeTicket());
      mockPrisma.supportTicket.update.mockResolvedValue(makeTicket({ priority: "HIGH" }));

      const { updateSupportTicketPriority } = await import("@/lib/actions/admin-support");
      const result = await updateSupportTicketPriority("ticket-1", "HIGH");

      expect(result.success).toBe(true);
      expect(mockPrisma.supportTicket.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "ticket-1" },
          data: expect.objectContaining({ priority: "HIGH" }),
        })
      );
    });

    it("returns error for invalid priority value", async () => {
      mockGetSession.mockResolvedValue(adminUser);

      const { updateSupportTicketPriority } = await import("@/lib/actions/admin-support");
      const result = await updateSupportTicketPriority("ticket-1", "URGENT" as never);

      expect(result).toEqual({ error: "Prioridad inválida" });
    });

    it("returns error when ticket not found", async () => {
      mockGetSession.mockResolvedValue(adminUser);
      mockPrisma.supportTicket.findUnique.mockResolvedValue(null);

      const { updateSupportTicketPriority } = await import("@/lib/actions/admin-support");
      const result = await updateSupportTicketPriority("ticket-999", "HIGH");

      expect(result).toEqual({ error: "Ticket no encontrado" });
    });
  });

  describe("updateSupportTicketCategory", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("returns error when user is not SUPER_ADMIN", async () => {
      mockGetSession.mockResolvedValue(ownerUser);

      const { updateSupportTicketCategory } = await import("@/lib/actions/admin-support");
      const result = await updateSupportTicketCategory("ticket-1", "PAYMENTS");

      expect(result).toEqual({ error: "No autorizado" });
    });

    it("updates category when SUPER_ADMIN", async () => {
      mockGetSession.mockResolvedValue(adminUser);
      mockPrisma.supportTicket.findUnique.mockResolvedValue(makeTicket());
      mockPrisma.supportTicket.update.mockResolvedValue(makeTicket({ category: "PAYMENTS" }));

      const { updateSupportTicketCategory } = await import("@/lib/actions/admin-support");
      const result = await updateSupportTicketCategory("ticket-1", "PAYMENTS");

      expect(result.success).toBe(true);
      expect(mockPrisma.supportTicket.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "ticket-1" },
          data: expect.objectContaining({ category: "PAYMENTS" }),
        })
      );
    });

    it("returns error for invalid category value", async () => {
      mockGetSession.mockResolvedValue(adminUser);

      const { updateSupportTicketCategory } = await import("@/lib/actions/admin-support");
      const result = await updateSupportTicketCategory("ticket-1", "BILLING" as never);

      expect(result).toEqual({ error: "Categoría inválida" });
    });

    it("returns error when ticket not found", async () => {
      mockGetSession.mockResolvedValue(adminUser);
      mockPrisma.supportTicket.findUnique.mockResolvedValue(null);

      const { updateSupportTicketCategory } = await import("@/lib/actions/admin-support");
      const result = await updateSupportTicketCategory("ticket-999", "PAYMENTS");

      expect(result).toEqual({ error: "Ticket no encontrado" });
    });
  });
});
