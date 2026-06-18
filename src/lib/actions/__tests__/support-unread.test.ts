import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SessionUser } from "@/lib/actions/auth";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    supportTicket: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
    },
    supportMessage: {
      findFirst: vi.fn(),
    },
    supportTicketRead: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/actions/auth", () => ({
  getSession: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const ownerSession: SessionUser = {
  userId: "owner-1",
  role: "OWNER",
  plan: "FREE",
  email: "owner@test.com",
};

const adminSession: SessionUser = {
  userId: "admin-1",
  role: "SUPER_ADMIN",
  plan: "FREE",
  email: "admin@test.com",
};

describe("getUnreadSupportTicketCount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 0 when user has no tickets", async () => {
    const { getSession } = await import("@/lib/actions/auth");
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(getSession).mockResolvedValue(ownerSession);
    vi.mocked(prisma.supportTicket.findMany).mockResolvedValue([]);

    const { getUnreadSupportTicketCount } = await import("../support-unread");
    const result = await getUnreadSupportTicketCount();

    expect(result).toBe(0);
  });

  it("returns 0 when user has no session", async () => {
    const { getSession } = await import("@/lib/actions/auth");
    vi.mocked(getSession).mockResolvedValue(null);

    const { getUnreadSupportTicketCount } = await import("../support-unread");
    const result = await getUnreadSupportTicketCount();

    expect(result).toBe(0);
  });

  it("counts tickets with messages from other participant after last read", async () => {
    const { getSession } = await import("@/lib/actions/auth");
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(getSession).mockResolvedValue(ownerSession);

    const tickets: any[] = [
      {
        id: "ticket-1",
        userId: "owner-1",
        subject: "Test",
        description: "Test desc",
        status: "OPEN",
        priority: "MEDIUM",
        category: "ACCOUNT",
        affectedReservationId: null,
        affectedPaymentId: null,
        affectedPropertyId: null,
        lastActivityAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        messages: [
          { id: "msg-1", supportTicketId: "ticket-1", authorId: "admin-1", content: "Admin response", createdAt: new Date(Date.now() + 10000) },
        ],
      },
      {
        id: "ticket-2",
        userId: "owner-1",
        subject: "Test 2",
        description: "Test desc 2",
        status: "OPEN",
        priority: "LOW",
        category: "OTHER",
        affectedReservationId: null,
        affectedPaymentId: null,
        affectedPropertyId: null,
        lastActivityAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        messages: [],
      },
    ];

    vi.mocked(prisma.supportTicket.findMany).mockResolvedValue(tickets as any);
    vi.mocked(prisma.supportTicketRead.findUnique).mockImplementation((async ({ where }: any) => {
      if (where.ticketId_userId?.ticketId === "ticket-1") {
        return { id: "read-1", ticketId: "ticket-1", userId: "owner-1", lastReadAt: new Date(Date.now() - 100000) };
      }
      return null;
    }) as any);

    const { getUnreadSupportTicketCount } = await import("../support-unread");
    const result = await getUnreadSupportTicketCount();

    expect(result).toBe(1);
  });

  it("does not count tickets where last read is after all messages", async () => {
    const { getSession } = await import("@/lib/actions/auth");
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(getSession).mockResolvedValue(ownerSession);

    const tickets: any[] = [
      {
        id: "ticket-1",
        userId: "owner-1",
        subject: "Test",
        description: "Test desc",
        status: "OPEN",
        priority: "MEDIUM",
        category: "ACCOUNT",
        affectedReservationId: null,
        affectedPaymentId: null,
        affectedPropertyId: null,
        lastActivityAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        messages: [
          { id: "msg-1", supportTicketId: "ticket-1", authorId: "admin-1", content: "Old admin response", createdAt: new Date(Date.now() - 200000) },
        ],
      },
    ];

    vi.mocked(prisma.supportTicket.findMany).mockResolvedValue(tickets as any);
    vi.mocked(prisma.supportTicketRead.findUnique).mockResolvedValue({
      id: "read-1", ticketId: "ticket-1", userId: "owner-1", lastReadAt: new Date(Date.now() - 50000),
    } as any);

    const { getUnreadSupportTicketCount } = await import("../support-unread");
    const result = await getUnreadSupportTicketCount();

    expect(result).toBe(0);
  });

  it("does not count tickets where only self-authored messages exist after last read", async () => {
    const { getSession } = await import("@/lib/actions/auth");
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(getSession).mockResolvedValue(ownerSession);

    const tickets: any[] = [
      {
        id: "ticket-1",
        userId: "owner-1",
        subject: "Test",
        description: "Test desc",
        status: "OPEN",
        priority: "MEDIUM",
        category: "ACCOUNT",
        affectedReservationId: null,
        affectedPaymentId: null,
        affectedPropertyId: null,
        lastActivityAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        messages: [
          { id: "msg-1", supportTicketId: "ticket-1", authorId: "owner-1", content: "My own message", createdAt: new Date(Date.now() + 10000) },
        ],
      },
    ];

    vi.mocked(prisma.supportTicket.findMany).mockResolvedValue(tickets as any);
    vi.mocked(prisma.supportTicketRead.findUnique).mockResolvedValue({
      id: "read-1", ticketId: "ticket-1", userId: "owner-1", lastReadAt: new Date(Date.now() - 100000),
    } as any);

    const { getUnreadSupportTicketCount } = await import("../support-unread");
    const result = await getUnreadSupportTicketCount();

    expect(result).toBe(0);
  });

  it("returns 0 when user never read any ticket but no messages exist", async () => {
    const { getSession } = await import("@/lib/actions/auth");
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(getSession).mockResolvedValue(ownerSession);

    const tickets: any[] = [
      {
        id: "ticket-1",
        userId: "owner-1",
        subject: "Test",
        description: "Test desc",
        status: "OPEN",
        priority: "MEDIUM",
        category: "ACCOUNT",
        affectedReservationId: null,
        affectedPaymentId: null,
        affectedPropertyId: null,
        lastActivityAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        messages: [],
      },
    ];

    vi.mocked(prisma.supportTicket.findMany).mockResolvedValue(tickets as any);
    vi.mocked(prisma.supportTicketRead.findUnique).mockResolvedValue(null);

    const { getUnreadSupportTicketCount } = await import("../support-unread");
    const result = await getUnreadSupportTicketCount();

    expect(result).toBe(0);
  });

  it("does not count admin-to-admin messages as unread for admin", async () => {
    const { getSession } = await import("@/lib/actions/auth");
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(getSession).mockResolvedValue(adminSession);

    const tickets: any[] = [
      {
        id: "ticket-1",
        userId: "owner-1",
        subject: "Test",
        description: "Test desc",
        status: "OPEN",
        priority: "MEDIUM",
        category: "ACCOUNT",
        affectedReservationId: null,
        affectedPaymentId: null,
        affectedPropertyId: null,
        lastActivityAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        messages: [
          { id: "msg-1", supportTicketId: "ticket-1", authorId: "admin-2", author: { role: "SUPER_ADMIN" }, content: "Admin chat", createdAt: new Date(Date.now() + 10000) },
        ],
      },
    ];

    vi.mocked(prisma.supportTicket.findMany).mockResolvedValue(tickets as any);
    vi.mocked(prisma.supportTicketRead.findUnique).mockResolvedValue(null);

    const { getUnreadSupportTicketCount } = await import("../support-unread");
    const result = await getUnreadSupportTicketCount();

    expect(result).toBe(0);
  });

  it("counts ticket as unread when last message is self-authored (owner) but earlier admin message is unread", async () => {
    const { getSession } = await import("@/lib/actions/auth");
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(getSession).mockResolvedValue(ownerSession);

    const tickets: any[] = [
      {
        id: "ticket-1",
        userId: "owner-1",
        subject: "Test",
        description: "Test desc",
        status: "OPEN",
        priority: "MEDIUM",
        category: "ACCOUNT",
        affectedReservationId: null,
        affectedPaymentId: null,
        affectedPropertyId: null,
        lastActivityAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        messages: [
          { id: "msg-2", supportTicketId: "ticket-1", authorId: "owner-1", author: { role: "OWNER" }, content: "My follow-up", createdAt: new Date(Date.now() + 20000) },
          { id: "msg-1", supportTicketId: "ticket-1", authorId: "admin-1", author: { role: "SUPER_ADMIN" }, content: "Admin response", createdAt: new Date(Date.now() + 10000) },
        ],
      },
    ];

    vi.mocked(prisma.supportTicket.findMany).mockResolvedValue(tickets as any);
    vi.mocked(prisma.supportTicketRead.findUnique).mockResolvedValue({
      id: "read-1", ticketId: "ticket-1", userId: "owner-1", lastReadAt: new Date(Date.now() - 50000),
    } as any);

    const { getUnreadSupportTicketCount } = await import("../support-unread");
    const result = await getUnreadSupportTicketCount();

    expect(result).toBe(1);
  });

  it("counts ticket as unread when last message is self-authored (admin) but earlier owner message is unread", async () => {
    const { getSession } = await import("@/lib/actions/auth");
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(getSession).mockResolvedValue(adminSession);

    const tickets: any[] = [
      {
        id: "ticket-1",
        userId: "owner-1",
        subject: "Test",
        description: "Test desc",
        status: "OPEN",
        priority: "MEDIUM",
        category: "ACCOUNT",
        affectedReservationId: null,
        affectedPaymentId: null,
        affectedPropertyId: null,
        lastActivityAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        messages: [
          { id: "msg-2", supportTicketId: "ticket-1", authorId: "admin-1", author: { role: "SUPER_ADMIN" }, content: "Admin response", createdAt: new Date(Date.now() + 20000) },
          { id: "msg-1", supportTicketId: "ticket-1", authorId: "owner-1", author: { role: "OWNER" }, content: "Owner question", createdAt: new Date(Date.now() + 10000) },
        ],
      },
    ];

    vi.mocked(prisma.supportTicket.findMany).mockResolvedValue(tickets as any);
    vi.mocked(prisma.supportTicketRead.findUnique).mockResolvedValue({
      id: "read-1", ticketId: "ticket-1", userId: "admin-1", lastReadAt: new Date(Date.now() - 50000),
    } as any);

    const { getUnreadSupportTicketCount } = await import("../support-unread");
    const result = await getUnreadSupportTicketCount();

    expect(result).toBe(1);
  });

  it("counts all tickets with unread messages for admin role", async () => {
    const { getSession } = await import("@/lib/actions/auth");
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(getSession).mockResolvedValue(adminSession);

    const tickets: any[] = [
      {
        id: "ticket-1",
        userId: "owner-1",
        subject: "Test",
        description: "Test desc",
        status: "OPEN",
        priority: "MEDIUM",
        category: "ACCOUNT",
        affectedReservationId: null,
        affectedPaymentId: null,
        affectedPropertyId: null,
        lastActivityAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        messages: [
          { id: "msg-1", supportTicketId: "ticket-1", authorId: "owner-1", author: { role: "OWNER" }, content: "Owner question", createdAt: new Date(Date.now() + 10000) },
        ],
      },
    ];

    vi.mocked(prisma.supportTicket.findMany).mockResolvedValue(tickets as any);
    vi.mocked(prisma.supportTicketRead.findUnique).mockResolvedValue({
      id: "read-1", ticketId: "ticket-1", userId: "admin-1", lastReadAt: new Date(Date.now() - 100000),
    } as any);

    const { getUnreadSupportTicketCount } = await import("../support-unread");
    const result = await getUnreadSupportTicketCount();

    expect(result).toBe(1);
  });
});

describe("markSupportTicketAsRead", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("upserts a read record when user opens a ticket", async () => {
    const { getSession } = await import("@/lib/actions/auth");
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(getSession).mockResolvedValue(ownerSession);
    vi.mocked(prisma.supportTicket.findUnique).mockResolvedValue({
      userId: "owner-1",
    } as any);
    vi.mocked(prisma.supportTicketRead.upsert).mockResolvedValue({
      id: "read-1", ticketId: "ticket-1", userId: "owner-1", lastReadAt: new Date(),
    } as any);

    const { markSupportTicketAsRead } = await import("../support-unread");
    const result = await markSupportTicketAsRead("ticket-1");

    expect(prisma.supportTicketRead.upsert).toHaveBeenCalledWith({
      where: {
        ticketId_userId: { ticketId: "ticket-1", userId: "owner-1" },
      },
      update: { lastReadAt: expect.any(Date) },
      create: { ticketId: "ticket-1", userId: "owner-1", lastReadAt: expect.any(Date) },
    });
    expect(result).toEqual({ success: true });
  });

  it("returns error when not authorized", async () => {
    const { getSession } = await import("@/lib/actions/auth");
    vi.mocked(getSession).mockResolvedValue(null);

    const { markSupportTicketAsRead } = await import("../support-unread");
    const result = await markSupportTicketAsRead("ticket-1");

    expect(result).toEqual({ error: "No autorizado" });
  });

  it("returns error when ticket does not exist", async () => {
    const { getSession } = await import("@/lib/actions/auth");
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(getSession).mockResolvedValue(ownerSession);
    vi.mocked(prisma.supportTicket.findUnique).mockResolvedValue(null);

    const { markSupportTicketAsRead } = await import("../support-unread");
    const result = await markSupportTicketAsRead("ticket-999");

    expect(result).toEqual({ error: "Ticket no encontrado" });
    expect(prisma.supportTicketRead.upsert).not.toHaveBeenCalled();
  });

  it("returns error when user is not the ticket owner and not admin", async () => {
    const { getSession } = await import("@/lib/actions/auth");
    const { prisma } = await import("@/lib/db/prisma");
    const otherSession = { ...ownerSession, userId: "other-user" };
    vi.mocked(getSession).mockResolvedValue(otherSession);
    vi.mocked(prisma.supportTicket.findUnique).mockResolvedValue({
      userId: "owner-1",
    } as any);

    const { markSupportTicketAsRead } = await import("../support-unread");
    const result = await markSupportTicketAsRead("ticket-1");

    expect(result).toEqual({ error: "No autorizado" });
    expect(prisma.supportTicketRead.upsert).not.toHaveBeenCalled();
  });

  it("allows ticket owner to mark as read", async () => {
    const { getSession } = await import("@/lib/actions/auth");
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(getSession).mockResolvedValue(ownerSession);
    vi.mocked(prisma.supportTicket.findUnique).mockResolvedValue({
      userId: "owner-1",
    } as any);
    vi.mocked(prisma.supportTicketRead.upsert).mockResolvedValue({
      id: "read-1", ticketId: "ticket-1", userId: "owner-1", lastReadAt: new Date(),
    } as any);

    const { markSupportTicketAsRead } = await import("../support-unread");
    const result = await markSupportTicketAsRead("ticket-1");

    expect(result).toEqual({ success: true });
    expect(prisma.supportTicketRead.upsert).toHaveBeenCalled();
  });

  it("allows SUPER_ADMIN to mark any ticket as read", async () => {
    const { getSession } = await import("@/lib/actions/auth");
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(getSession).mockResolvedValue(adminSession);
    vi.mocked(prisma.supportTicket.findUnique).mockResolvedValue({
      userId: "owner-1",
    } as any);
    vi.mocked(prisma.supportTicketRead.upsert).mockResolvedValue({
      id: "read-1", ticketId: "ticket-1", userId: "admin-1", lastReadAt: new Date(),
    } as any);

    const { markSupportTicketAsRead } = await import("../support-unread");
    const result = await markSupportTicketAsRead("ticket-1");

    expect(result).toEqual({ success: true });
    expect(prisma.supportTicketRead.upsert).toHaveBeenCalled();
  });
});
