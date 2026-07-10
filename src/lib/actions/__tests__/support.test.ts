import { describe, it, expect, vi, beforeEach } from "vitest";
import { redirect } from "next/navigation";
import type { SessionUser } from "@/lib/actions/auth";

const prismaMocks = vi.hoisted(() => ({
  supportTicketCreate: vi.fn(),
  supportTicketUpdate: vi.fn(),
  supportMessageCreate: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    supportTicket: {
      create: prismaMocks.supportTicketCreate,
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      update: prismaMocks.supportTicketUpdate,
    },
    supportMessage: {
      create: prismaMocks.supportMessageCreate,
    },
    supportMessageAttachment: {
      create: vi.fn(),
      createMany: vi.fn(),
    },
    supportTicketRead: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    property: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    reservation: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    payment: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    $transaction: vi.fn((fn) => fn({
      supportTicket: {
        create: prismaMocks.supportTicketCreate,
        update: prismaMocks.supportTicketUpdate,
      },
      supportMessage: {
        create: prismaMocks.supportMessageCreate,
      },
    })),
  },
}));

vi.mock("@/lib/actions/auth", () => ({
  getSession: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const mockSession: SessionUser = {
  userId: "user-1",
  role: "OWNER",
  plan: "FREE",
  email: "owner@test.com",
};

const validTicketData = {
  subject: "Problema con mi propiedad",
  description: "El inquilino reportó que la llave de agua no funciona correctamente en la cocina.",
  priority: "HIGH" as const,
  category: "PROPERTIES" as const,
};

const mockTicket = {
  id: "ticket-1",
  userId: "user-1",
  subject: validTicketData.subject,
  description: validTicketData.description,
  status: "OPEN" as const,
  priority: "HIGH" as const,
  category: "PROPERTIES" as const,
  affectedReservationId: null,
  affectedPaymentId: null,
  affectedPropertyId: null,
  lastActivityAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
  messages: [],
};

describe("createSupportTicket", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna error para sesión no autorizada", async () => {
    const { getSession } = await import("@/lib/actions/auth");
    vi.mocked(getSession).mockResolvedValue(null);

    const { createSupportTicket } = await import("../support");
    const result = await createSupportTicket(validTicketData);

    expect(result).toEqual({ error: "No autorizado" });
  });

  it("retorna error cuando el rol no es OWNER", async () => {
    const { getSession } = await import("@/lib/actions/auth");
    vi.mocked(getSession).mockResolvedValue({ ...mockSession, role: "SUPER_ADMIN" });

    const { prisma } = await import("@/lib/db/prisma");
    const { createSupportTicket } = await import("../support");
    const result = await createSupportTicket(validTicketData);

    expect(result).toEqual({ error: "Solo los propietarios pueden crear tickets" });
    expect(prisma.supportTicket.create).not.toHaveBeenCalled();
  });

  it("crea ticket exitosamente con datos válidos", async () => {
    const { getSession } = await import("@/lib/actions/auth");
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(prisma.supportTicket.create).mockResolvedValue(mockTicket);
    vi.mocked(prisma.supportMessage.create).mockResolvedValue({} as never);

    const { createSupportTicket } = await import("../support");
    const result = await createSupportTicket(validTicketData);

    expect(result).toEqual({ success: true, ticket: mockTicket });
    expect(prisma.supportTicket.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        subject: validTicketData.subject,
        description: validTicketData.description,
        priority: "HIGH",
        category: "PROPERTIES",
      },
    });
    expect(prisma.supportMessage.create).toHaveBeenCalledWith({
      data: {
        supportTicketId: mockTicket.id,
        authorId: "user-1",
        content: validTicketData.description,
      },
    });
  });

  it("retorna error para datos inválidos (ZodError)", async () => {
    const { getSession } = await import("@/lib/actions/auth");
    vi.mocked(getSession).mockResolvedValue(mockSession);

    const { createSupportTicket } = await import("../support");
    const result = await createSupportTicket({
      subject: "ab",
      description: "short",
      priority: "HIGH",
      category: "PROPERTIES",
    });

    expect(result.error).toBe("Datos inválidos");
    expect(result.details).toBeDefined();
    expect(Array.isArray(result.details)).toBe(true);
  });

  it("crea ticket con status OPEN (default en esquema)", async () => {
    const { getSession } = await import("@/lib/actions/auth");
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(prisma.supportTicket.create).mockResolvedValue(mockTicket);

    const { createSupportTicket } = await import("../support");
    const result = await createSupportTicket(validTicketData);

    expect(result.success).toBe(true);
    expect((result as any).ticket.status).toBe("OPEN");
  });

  it("crea ticket con imágenes adjuntas", async () => {
    const { getSession } = await import("@/lib/actions/auth");
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(prisma.supportTicket.create).mockResolvedValue(mockTicket);

    const { createSupportTicket } = await import("../support");
    const ticketDataWithImages = {
      ...validTicketData,
      images: [
        { url: "https://res.cloudinary.com/test1.jpg", fileName: "foto1.jpg", fileSize: 1024 },
        { url: "https://res.cloudinary.com/test2.png", fileName: "foto2.png", fileSize: 2048 },
      ],
    };
    const result = await createSupportTicket(ticketDataWithImages);

    expect(result.success).toBe(true);
    expect(prisma.supportMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          supportTicketId: mockTicket.id,
          authorId: "user-1",
          content: validTicketData.description,
        }),
      })
    );
  });

  it("rechaza ticket con más de 3 imágenes", async () => {
    const { getSession } = await import("@/lib/actions/auth");
    vi.mocked(getSession).mockResolvedValue(mockSession);

    const { createSupportTicket } = await import("../support");
    const result = await createSupportTicket({
      ...validTicketData,
      images: Array(4).fill({ url: "https://res.cloudinary.com/test.jpg", fileName: "foto.jpg", fileSize: 1024 }),
    });

    expect(result.error).toBe("Datos inválidos");
  });

  it("crea ticket con affectedReservationId válida", async () => {
    const { getSession } = await import("@/lib/actions/auth");
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue({
      id: "res-1", userId: "user-1",
    } as never);
    vi.mocked(prisma.supportTicket.create).mockResolvedValue(mockTicket);

    const { createSupportTicket } = await import("../support");
    const result = await createSupportTicket({
      ...validTicketData,
      affectedEntityType: "RESERVATION",
      affectedEntityId: "res-1",
    });

    expect(result.success).toBe(true);
    expect(prisma.reservation.findUnique).toHaveBeenCalledWith({
      where: { id: "res-1" },
      select: { userId: true },
    });
    expect(prisma.supportTicket.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          affectedReservationId: "res-1",
        }),
      })
    );
  });

  it("crea ticket con affectedPaymentId válida", async () => {
    const { getSession } = await import("@/lib/actions/auth");
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(prisma.payment.findUnique).mockResolvedValue({
      id: "pay-1", reservation: { userId: "user-1" },
    } as never);
    vi.mocked(prisma.supportTicket.create).mockResolvedValue(mockTicket);

    const { createSupportTicket } = await import("../support");
    const result = await createSupportTicket({
      ...validTicketData,
      affectedEntityType: "PAYMENT",
      affectedEntityId: "pay-1",
    });

    expect(result.success).toBe(true);
    expect(prisma.supportTicket.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          affectedPaymentId: "pay-1",
        }),
      })
    );
  });

  it("crea ticket con affectedPropertyId válida", async () => {
    const { getSession } = await import("@/lib/actions/auth");
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(prisma.property.findUnique).mockResolvedValue({
      id: "prop-1", userId: "user-1",
    } as never);
    vi.mocked(prisma.supportTicket.create).mockResolvedValue(mockTicket);

    const { createSupportTicket } = await import("../support");
    const result = await createSupportTicket({
      ...validTicketData,
      affectedEntityType: "PROPERTY",
      affectedEntityId: "prop-1",
    });

    expect(result.success).toBe(true);
    expect(prisma.supportTicket.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          affectedPropertyId: "prop-1",
        }),
      })
    );
  });

  it("rechaza entidad afectada que no pertenece al owner", async () => {
    const { getSession } = await import("@/lib/actions/auth");
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(prisma.property.findUnique).mockResolvedValue({
      id: "prop-2", userId: "user-2",
    } as never);

    const { createSupportTicket } = await import("../support");
    const result = await createSupportTicket({
      ...validTicketData,
      affectedEntityType: "PROPERTY",
      affectedEntityId: "prop-2",
    });

    expect(result.error).toBe("La entidad afectada no pertenece a este propietario");
    expect(prisma.supportTicket.create).not.toHaveBeenCalled();
  });

  it("rechaza entidad afectada que no existe", async () => {
    const { getSession } = await import("@/lib/actions/auth");
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue(null);

    const { createSupportTicket } = await import("../support");
    const result = await createSupportTicket({
      ...validTicketData,
      affectedEntityType: "RESERVATION",
      affectedEntityId: "nonexistent",
    });

    expect(result.error).toBe("La entidad afectada no existe");
    expect(prisma.supportTicket.create).not.toHaveBeenCalled();
  });
});

describe("getSupportTickets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna [] cuando no hay sesión", async () => {
    const { getSession } = await import("@/lib/actions/auth");
    vi.mocked(getSession).mockResolvedValue(null);

    const { getSupportTickets } = await import("../support");
    const result = await getSupportTickets();

    expect(result).toEqual([]);
  });

  it("filtra por userId del owner actual", async () => {
    const { getSession } = await import("@/lib/actions/auth");
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(prisma.supportTicket.findMany).mockResolvedValue([mockTicket]);
    vi.mocked(prisma.supportTicket.count).mockResolvedValue(1);

    const { getSupportTickets } = await import("../support");
    await getSupportTickets();

    expect(prisma.supportTicket.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: "user-1" }),
      })
    );
  });

  it("ordena por lastActivityAt descendente", async () => {
    const { getSession } = await import("@/lib/actions/auth");
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(prisma.supportTicket.findMany).mockResolvedValue([mockTicket]);
    vi.mocked(prisma.supportTicket.count).mockResolvedValue(1);

    const { getSupportTickets } = await import("../support");
    await getSupportTickets();

    expect(prisma.supportTicket.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { lastActivityAt: "desc" },
      })
    );
  });

  it("devuelve PaginatedResponse con data, total, page, totalPages", async () => {
    const { getSession } = await import("@/lib/actions/auth");
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(prisma.supportTicket.findMany).mockResolvedValue([mockTicket]);
    vi.mocked(prisma.supportTicket.count).mockResolvedValue(1);

    const { getSupportTickets } = await import("../support");
    const result = await getSupportTickets({ page: 1, limit: 10 });

    expect(result).toHaveProperty("data");
    expect(result).toHaveProperty("total", 1);
    expect(result).toHaveProperty("page", 1);
    expect(result).toHaveProperty("totalPages", 1);
    expect(Array.isArray((result as any).data)).toBe(true);
  });

  it("filtra por status cuando se pasa el parámetro", async () => {
    const { getSession } = await import("@/lib/actions/auth");
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(prisma.supportTicket.findMany).mockResolvedValue([mockTicket]);
    vi.mocked(prisma.supportTicket.count).mockResolvedValue(1);

    const { getSupportTickets } = await import("../support");
    await getSupportTickets({ page: 1, limit: 10, status: "OPEN" });

    expect(prisma.supportTicket.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: "user-1", status: "OPEN" }),
      })
    );
  });

  it("no filtra por status cuando no se pasa el parámetro", async () => {
    const { getSession } = await import("@/lib/actions/auth");
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(prisma.supportTicket.findMany).mockResolvedValue([mockTicket]);
    vi.mocked(prisma.supportTicket.count).mockResolvedValue(1);

    const { getSupportTickets } = await import("../support");
    await getSupportTickets({ page: 1, limit: 10 });

    const where = (prisma.supportTicket.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0].where;
    expect(where.userId).toBe("user-1");
    expect(where.status).toBeUndefined();
  });

  it("marks hasUnread=true when last message is self-authored but earlier admin message is unread", async () => {
    const { getSession } = await import("@/lib/actions/auth");
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(getSession).mockResolvedValue(mockSession);

    const ticketWithMessages = {
      ...mockTicket,
      messages: [
        { id: "msg-2", authorId: "user-1", author: { role: "OWNER" }, createdAt: new Date(Date.now() + 20000) },
        { id: "msg-1", authorId: "admin-1", author: { role: "SUPER_ADMIN" }, createdAt: new Date(Date.now() + 10000) },
      ],
    };

    vi.mocked(prisma.supportTicket.findMany).mockResolvedValue([ticketWithMessages as any]);
    vi.mocked(prisma.supportTicket.count).mockResolvedValue(1);
    vi.mocked(prisma.supportTicketRead.findMany).mockResolvedValue([
      { id: "read-1", ticketId: "ticket-1", userId: "user-1", lastReadAt: new Date(Date.now() - 50000) },
    ] as any);

    const { getSupportTickets } = await import("../support");
    const result = await getSupportTickets();

    expect(result).not.toEqual([]);
    const data = (result as any).data;
    expect(data[0].hasUnread).toBe(true);
  });
});

describe("getSupportTicketsKpis", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna zeros cuando no hay sesion", async () => {
    const { getSession } = await import("@/lib/actions/auth");
    vi.mocked(getSession).mockResolvedValue(null);

    const { getSupportTicketsKpis } = await import("../support");
    const result = await getSupportTicketsKpis();

    expect(result).toEqual({ openCount: 0, resolvedCount: 0, avgResponseHours: null });
  });

  it("cuenta OPEN + IN_PROGRESS como openCount", async () => {
    const { getSession } = await import("@/lib/actions/auth");
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(prisma.supportTicket.count)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(5);
    vi.mocked(prisma.supportTicket.findMany).mockResolvedValue([]);

    const { getSupportTicketsKpis } = await import("../support");
    const result = await getSupportTicketsKpis();

    expect(result.openCount).toBe(3);
    expect(prisma.supportTicket.count).toHaveBeenCalledWith({
      where: { userId: "user-1", status: { in: ["OPEN", "IN_PROGRESS"] } },
    });
  });

  it("cuenta RESOLVED + CLOSED como resolvedCount", async () => {
    const { getSession } = await import("@/lib/actions/auth");
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(prisma.supportTicket.count)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(8);
    vi.mocked(prisma.supportTicket.findMany).mockResolvedValue([]);

    const { getSupportTicketsKpis } = await import("../support");
    const result = await getSupportTicketsKpis();

    expect(result.resolvedCount).toBe(8);
    expect(prisma.supportTicket.count).toHaveBeenCalledWith({
      where: { userId: "user-1", status: { in: ["RESOLVED", "CLOSED"] } },
    });
  });

  it("calcula avgResponseHours con 1 decimal cuando hay respuestas de admin", async () => {
    const { getSession } = await import("@/lib/actions/auth");
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(prisma.supportTicket.count).mockResolvedValue(0);

    const baseDate = new Date("2026-01-01T10:00:00Z");
    const ticketWithAdminReply = {
      id: "ticket-1",
      userId: "user-1",
      subject: "Problema",
      description: "Desc",
      status: "OPEN" as const,
      priority: "HIGH" as const,
      category: "PROPERTIES" as const,
      createdAt: baseDate,
      messages: [
        { id: "msg-1", authorId: "user-1", author: { role: "OWNER" }, createdAt: baseDate },
        { id: "msg-2", authorId: "admin-1", author: { role: "SUPER_ADMIN" }, createdAt: new Date(baseDate.getTime() + 2 * 60 * 60 * 1000) },
      ],
    };

    vi.mocked(prisma.supportTicket.findMany).mockResolvedValue([ticketWithAdminReply as any]);

    const { getSupportTicketsKpis } = await import("../support");
    const result = await getSupportTicketsKpis();

    expect(result.avgResponseHours).toBeCloseTo(2.0, 1);
  });

  it("retorna avgResponseHours null cuando no hay respuestas de admin", async () => {
    const { getSession } = await import("@/lib/actions/auth");
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(prisma.supportTicket.count).mockResolvedValue(0);

    const ticketWithoutAdminReply = {
      id: "ticket-1",
      userId: "user-1",
      subject: "Problema",
      description: "Desc",
      status: "OPEN" as const,
      priority: "HIGH" as const,
      category: "PROPERTIES" as const,
      createdAt: new Date(),
      messages: [
        { id: "msg-1", authorId: "user-1", author: { role: "OWNER" }, createdAt: new Date() },
      ],
    };

    vi.mocked(prisma.supportTicket.findMany).mockResolvedValue([ticketWithoutAdminReply as any]);

    const { getSupportTicketsKpis } = await import("../support");
    const result = await getSupportTicketsKpis();

    expect(result.avgResponseHours).toBeNull();
  });

  it("filtra por userId del session", async () => {
    const { getSession } = await import("@/lib/actions/auth");
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(getSession).mockResolvedValue({ ...mockSession, userId: "other-user" });
    vi.mocked(prisma.supportTicket.count).mockResolvedValue(0);
    vi.mocked(prisma.supportTicket.findMany).mockResolvedValue([]);

    const { getSupportTicketsKpis } = await import("../support");
    await getSupportTicketsKpis();

    expect(prisma.supportTicket.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "other-user" },
      })
    );
  });
});

describe("getSupportTicketDetail", () => {
  const ticketWithMessages = {
    id: "ticket-1",
    userId: "user-1",
    subject: "Problema con mi propiedad",
    description: "Descripción detallada del problema",
    status: "OPEN" as const,
    priority: "HIGH" as const,
    category: "PROPERTIES" as const,
    affectedReservationId: null,
    affectedPaymentId: null,
    affectedPropertyId: null,
    lastActivityAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    messages: [
      {
        id: "msg-1", supportTicketId: "ticket-1", authorId: "user-1", content: "Mensaje inicial", createdAt: new Date(),
        author: { id: "user-1", name: "Owner", email: "owner@test.com" },
        attachments: [
          { id: "att-1", messageId: "msg-1", url: "https://res.cloudinary.com/img.jpg", fileName: "img.jpg", fileSize: 1024, createdAt: new Date() },
        ],
      },
      { id: "msg-2", supportTicketId: "ticket-1", authorId: "user-1", content: "Mensaje de seguimiento", createdAt: new Date(Date.now() + 1000), author: { id: "user-1", name: "Owner", email: "owner@test.com" }, attachments: [] },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna null cuando no hay sesión", async () => {
    const { getSession } = await import("@/lib/actions/auth");
    vi.mocked(getSession).mockResolvedValue(null);

    const { getSupportTicketDetail } = await import("../support");
    const result = await getSupportTicketDetail("ticket-1");

    expect(result).toBeNull();
  });

  it("retorna null cuando el ticket pertenece a otro owner", async () => {
    const { getSession } = await import("@/lib/actions/auth");
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(prisma.supportTicket.findUnique).mockResolvedValue(null);

    const { getSupportTicketDetail } = await import("../support");
    const result = await getSupportTicketDetail("ticket-999");

    expect(result).toBeNull();
    expect(prisma.supportTicket.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "ticket-999", userId: "user-1" },
      })
    );
  });

  it("retorna ticket con mensajes ordenados cronológicamente ascendente", async () => {
    const { getSession } = await import("@/lib/actions/auth");
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(prisma.supportTicket.findUnique).mockResolvedValue(ticketWithMessages);

    const { getSupportTicketDetail } = await import("../support");
    const result = await getSupportTicketDetail("ticket-1");

    expect(result).not.toBeNull();
    expect(result!.messages).toHaveLength(2);
    expect(result!.messages[0].content).toBe("Mensaje inicial");
    expect(result!.messages[1].content).toBe("Mensaje de seguimiento");
  });

  it("retorna attachments en los mensajes", async () => {
    const { getSession } = await import("@/lib/actions/auth");
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(prisma.supportTicket.findUnique).mockResolvedValue(ticketWithMessages);

    const { getSupportTicketDetail } = await import("../support");
    const result = await getSupportTicketDetail("ticket-1");

    expect(result).not.toBeNull();
    expect(result!.messages[0].attachments).toHaveLength(1);
    expect(result!.messages[0].attachments[0].url).toBe("https://res.cloudinary.com/img.jpg");
    expect(result!.messages[0].attachments[0].fileName).toBe("img.jpg");
  });

  it("retorna affectedEntity en el detalle cuando existe", async () => {
    const { getSession } = await import("@/lib/actions/auth");
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(getSession).mockResolvedValue(mockSession);

    const ticketWithAffected = {
      ...ticketWithMessages,
      affectedReservationId: "res-1",
      affectedPaymentId: null,
      affectedPropertyId: null,
      affectedReservation: { id: "res-1" },
      affectedPayment: null,
      affectedProperty: null,
    };

    vi.mocked(prisma.supportTicket.findUnique).mockResolvedValue(ticketWithAffected);

    const { getSupportTicketDetail } = await import("../support");
    const result = await getSupportTicketDetail("ticket-1");

    expect(result).not.toBeNull();
    expect(result!.affectedEntity).toEqual({
      type: "RESERVATION",
      id: "res-1",
    });
  });

  it("retorna affectedEntity null cuando no existe", async () => {
    const { getSession } = await import("@/lib/actions/auth");
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(getSession).mockResolvedValue(mockSession);

    const ticketWithoutAffected = {
      ...ticketWithMessages,
      affectedReservationId: null,
      affectedPaymentId: null,
      affectedPropertyId: null,
      affectedReservation: null,
      affectedPayment: null,
      affectedProperty: null,
    };

    vi.mocked(prisma.supportTicket.findUnique).mockResolvedValue(ticketWithoutAffected);

    const { getSupportTicketDetail } = await import("../support");
    const result = await getSupportTicketDetail("ticket-1");

    expect(result).not.toBeNull();
    expect(result!.affectedEntity).toBeNull();
  });
});

describe("addSupportTicketMessage", () => {
  const mockOpenTicket = {
    id: "ticket-1",
    userId: "user-1",
    status: "OPEN" as const,
    priority: "HIGH" as const,
    category: "PROPERTIES" as const,
    subject: "Problema",
    description: "Descripción detallada del problema",
    affectedReservationId: null,
    affectedPaymentId: null,
    affectedPropertyId: null,
    lastActivityAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockClosedTicket = {
    ...mockOpenTicket,
    status: "CLOSED" as const,
  };

  const mockInProgressTicket = {
    ...mockOpenTicket,
    status: "IN_PROGRESS" as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna error cuando no hay sesión", async () => {
    const { getSession } = await import("@/lib/actions/auth");
    vi.mocked(getSession).mockResolvedValue(null);

    const { addSupportTicketMessage } = await import("../support");
    const result = await addSupportTicketMessage("ticket-1", "Nuevo mensaje");

    expect(result).toEqual({ error: "No autorizado" });
  });

  it("retorna error cuando el mensaje está vacío", async () => {
    const { getSession } = await import("@/lib/actions/auth");
    vi.mocked(getSession).mockResolvedValue(mockSession);

    const { addSupportTicketMessage } = await import("../support");
    const result = await addSupportTicketMessage("ticket-1", "");

    expect(result.error).toBe("Datos inválidos");
  });

  it("retorna error cuando el mensaje excede 2000 caracteres", async () => {
    const { getSession } = await import("@/lib/actions/auth");
    vi.mocked(getSession).mockResolvedValue(mockSession);

    const { addSupportTicketMessage } = await import("../support");
    const result = await addSupportTicketMessage("ticket-1", "a".repeat(2001));

    expect(result.error).toBe("Datos inválidos");
  });

  it("retorna error cuando el ticket no existe o no pertenece al owner", async () => {
    const { getSession } = await import("@/lib/actions/auth");
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(prisma.supportTicket.findUnique).mockResolvedValue(null);

    const { addSupportTicketMessage } = await import("../support");
    const result = await addSupportTicketMessage("ticket-999", "Nuevo mensaje");

    expect(result).toEqual({ error: "Ticket no encontrado" });
  });

  it("agrega mensaje a ticket OPEN", async () => {
    const { getSession } = await import("@/lib/actions/auth");
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(prisma.supportTicket.findUnique).mockResolvedValue(mockOpenTicket);
    vi.mocked(prisma.supportMessage.create).mockResolvedValue({ id: "msg-3", supportTicketId: "ticket-1", authorId: "user-1", content: "Nuevo mensaje", createdAt: new Date() });

    const { addSupportTicketMessage } = await import("../support");
    const result = await addSupportTicketMessage("ticket-1", "Nuevo mensaje");

    expect(result).toHaveProperty("success", true);
    expect(prisma.supportMessage.create).toHaveBeenCalledWith({
      data: {
        supportTicketId: "ticket-1",
        authorId: "user-1",
        content: "Nuevo mensaje",
      },
    });
  });

  it("agrega mensaje a ticket IN_PROGRESS", async () => {
    const { getSession } = await import("@/lib/actions/auth");
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(prisma.supportTicket.findUnique).mockResolvedValue(mockInProgressTicket);
    vi.mocked(prisma.supportMessage.create).mockResolvedValue({ id: "msg-3", supportTicketId: "ticket-1", authorId: "user-1", content: "Nuevo mensaje", createdAt: new Date() });

    const { addSupportTicketMessage } = await import("../support");
    const result = await addSupportTicketMessage("ticket-1", "Nuevo mensaje");

    expect(result).toHaveProperty("success", true);
  });

  it("reabre ticket CLOSED al agregar mensaje", async () => {
    const { getSession } = await import("@/lib/actions/auth");
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(prisma.supportTicket.findUnique).mockResolvedValue(mockClosedTicket);
    vi.mocked(prisma.supportTicket.update).mockResolvedValue({ ...mockClosedTicket, status: "OPEN" });
    vi.mocked(prisma.supportMessage.create).mockResolvedValue({ id: "msg-3", supportTicketId: "ticket-1", authorId: "user-1", content: "Nuevo mensaje", createdAt: new Date() });

    const { addSupportTicketMessage } = await import("../support");
    const result = await addSupportTicketMessage("ticket-1", "Nuevo mensaje");

    expect(result).toHaveProperty("success", true);
    expect(prisma.supportTicket.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "ticket-1" },
        data: expect.objectContaining({ status: "OPEN" }),
      })
    );
  });

  it("actualiza lastActivityAt al agregar mensaje", async () => {
    const { getSession } = await import("@/lib/actions/auth");
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(prisma.supportTicket.findUnique).mockResolvedValue(mockOpenTicket);
    vi.mocked(prisma.supportMessage.create).mockResolvedValue({ id: "msg-3", supportTicketId: "ticket-1", authorId: "user-1", content: "Nuevo mensaje", createdAt: new Date() });

    const { addSupportTicketMessage } = await import("../support");
    await addSupportTicketMessage("ticket-1", "Nuevo mensaje");

    expect(prisma.supportTicket.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "ticket-1" },
        data: expect.objectContaining({ lastActivityAt: expect.any(Date) }),
      })
    );
  });

  it("agrega mensaje con imágenes adjuntas", async () => {
    const { getSession } = await import("@/lib/actions/auth");
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(prisma.supportTicket.findUnique).mockResolvedValue(mockOpenTicket);
    vi.mocked(prisma.supportMessage.create).mockResolvedValue({ id: "msg-3", supportTicketId: "ticket-1", authorId: "user-1", content: "Mensaje con fotos", createdAt: new Date() });

    const { addSupportTicketMessage } = await import("../support");
    const result = await addSupportTicketMessage("ticket-1", "Mensaje con fotos", [
      { url: "https://res.cloudinary.com/img1.jpg", fileName: "img1.jpg", fileSize: 1024 },
      { url: "https://res.cloudinary.com/img2.jpg", fileName: "img2.jpg", fileSize: 2048 },
    ]);

    expect(result).toHaveProperty("success", true);
    expect(prisma.supportMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          supportTicketId: "ticket-1",
          authorId: "user-1",
          content: "Mensaje con fotos",
          attachments: {
            create: [
              { url: "https://res.cloudinary.com/img1.jpg", fileName: "img1.jpg", fileSize: 1024 },
              { url: "https://res.cloudinary.com/img2.jpg", fileName: "img2.jpg", fileSize: 2048 },
            ],
          },
        }),
      })
    );
  });

  it("rechaza mensaje con más de 3 imágenes", async () => {
    const { getSession } = await import("@/lib/actions/auth");
    vi.mocked(getSession).mockResolvedValue(mockSession);

    const { addSupportTicketMessage } = await import("../support");
    const result = await addSupportTicketMessage("ticket-1", "Mensaje", Array(4).fill({ url: "https://res.cloudinary.com/test.jpg", fileName: "test.jpg", fileSize: 1024 }));

    expect(result.error).toBe("Datos inválidos");
  });
});

describe("getUserEntityOptions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna [] cuando no hay sesión", async () => {
    const { getSession } = await import("@/lib/actions/auth");
    vi.mocked(getSession).mockResolvedValue(null);

    const { getUserEntityOptions } = await import("../support");
    const result = await getUserEntityOptions("PROPERTY");

    expect(result).toEqual([]);
  });

  it("retorna propiedades del usuario", async () => {
    const { getSession } = await import("@/lib/actions/auth");
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(prisma.property.findMany).mockResolvedValue([
      { id: "prop-1", name: "Casa Playa" },
      { id: "prop-2", name: "Depto Centro" },
    ] as any);

    const { getUserEntityOptions } = await import("../support");
    const result = await getUserEntityOptions("PROPERTY");

    expect(result).toEqual([
      { id: "prop-1", label: "Casa Playa" },
      { id: "prop-2", label: "Depto Centro" },
    ]);
  });

  it("retorna reservas del usuario", async () => {
    const { getSession } = await import("@/lib/actions/auth");
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(prisma.reservation.findMany).mockResolvedValue([
      {
        id: "res-1",
        startDate: new Date("2026-06-01"),
        endDate: new Date("2026-06-10"),
        client: { name: "Juan Pérez" },
        property: { name: "Casa Playa" },
      },
    ] as any);

    const { getUserEntityOptions } = await import("../support");
    const result = await getUserEntityOptions("RESERVATION");

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("res-1");
    expect(result[0].label).toContain("Reserva");
    expect(result[0].label).toContain("Juan Pérez");
    expect(result[0].label).toContain("Casa Playa");
  });

  it("retorna pagos del usuario", async () => {
    const { getSession } = await import("@/lib/actions/auth");
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(prisma.payment.findMany).mockResolvedValue([
      {
        id: "pay-1",
        amount: 50000,
        reservation: {
          client: { name: "Juan Pérez" },
          property: { name: "Casa Playa" },
        },
      },
    ] as any);

    const { getUserEntityOptions } = await import("../support");
    const result = await getUserEntityOptions("PAYMENT");

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("pay-1");
    expect(result[0].label).toContain("Pago");
    expect(result[0].label).toContain("Juan Pérez");
  });
});

describe("closeSupportTicket", () => {
  const mockOpenTicket = {
    id: "ticket-1",
    userId: "user-1",
    status: "OPEN" as const,
    priority: "HIGH" as const,
    category: "PROPERTIES" as const,
    subject: "Problema",
    description: "Descripción detallada del problema",
    affectedReservationId: null,
    affectedPaymentId: null,
    affectedPropertyId: null,
    lastActivityAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna error cuando no hay sesión", async () => {
    const { getSession } = await import("@/lib/actions/auth");
    vi.mocked(getSession).mockResolvedValue(null);

    const { closeSupportTicket } = await import("../support");
    const result = await closeSupportTicket("ticket-1");

    expect(result).toEqual({ error: "No autorizado" });
  });

  it("cierra ticket correctamente", async () => {
    const { getSession } = await import("@/lib/actions/auth");
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(prisma.supportTicket.findUnique).mockResolvedValue(mockOpenTicket);
    vi.mocked(prisma.supportTicket.update).mockResolvedValue({ ...mockOpenTicket, status: "CLOSED" });

    const { closeSupportTicket } = await import("../support");
    const result = await closeSupportTicket("ticket-1");

    expect(result).toHaveProperty("success", true);
    expect(prisma.supportTicket.update).toHaveBeenCalledWith({
      where: { id: "ticket-1" },
      data: { status: "CLOSED", lastActivityAt: expect.any(Date) },
    });
  });

  it("retorna error cuando el ticket no existe o no pertenece al owner", async () => {
    const { getSession } = await import("@/lib/actions/auth");
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(prisma.supportTicket.findUnique).mockResolvedValue(null);

    const { closeSupportTicket } = await import("../support");
    const result = await closeSupportTicket("ticket-999");

    expect(result).toEqual({ error: "Ticket no encontrado" });
  });
});
