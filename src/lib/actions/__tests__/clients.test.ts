import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";
import type { SessionUser } from "@/lib/actions/auth";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    reservationClient: {
      count: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
    },
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
  email: "test@test.com",
};

const mockClient = {
  id: "client-1",
  userId: "user-1",
  name: "Test",
  email: "test@test.com",
  phone: null,
  rut: null,
  notes: null,
  createdAt: new Date(),
};

describe("createClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna error amigable para email duplicado (P2002)", async () => {
    const { getSession } = await import("@/lib/actions/auth");
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(prisma.reservationClient.count).mockResolvedValue(0);
    vi.mocked(prisma.reservationClient.create).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "7.0.0",
      })
    );

    const { createClient } = await import("../clients");
    const result = await createClient({
      name: "test",
      email: "dup@test.com",
    });

    expect(result).toEqual({ error: "Ya existe un cliente con ese email" });
  });

  it("crea cliente exitosamente con datos válidos", async () => {
    const { getSession } = await import("@/lib/actions/auth");
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(prisma.reservationClient.count).mockResolvedValue(0);
    vi.mocked(prisma.reservationClient.create).mockResolvedValue(mockClient);

    const { createClient } = await import("../clients");
    const result = await createClient({
      name: "Test",
      email: "test@test.com",
    });

    expect(result).toEqual({ success: true, client: mockClient });
  });

  it("retorna error para sesión no autorizada", async () => {
    const { getSession } = await import("@/lib/actions/auth");
    vi.mocked(getSession).mockResolvedValue(null);

    const { createClient } = await import("../clients");
    const result = await createClient({
      name: "test",
      email: "test@test.com",
    });

    expect(result).toEqual({ error: "No autorizado" });
  });

  it("atrapa otros errores inesperados y retorna mensaje genérico", async () => {
    const { getSession } = await import("@/lib/actions/auth");
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(prisma.reservationClient.count).mockResolvedValue(0);
    vi.mocked(prisma.reservationClient.create).mockRejectedValue(
      new Error("algo raro")
    );

    const { createClient } = await import("../clients");
    const result = await createClient({
      name: "test",
      email: "test@test.com",
    });

    expect(result).toEqual({ error: "Error al crear el cliente" });
  });
});

describe("getClients pagination", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockClientRow = {
    id: "client-1",
    userId: "user-1",
    name: "Test",
    email: "test@test.com",
    phone: null,
    rut: null,
    notes: null,
    createdAt: new Date("2025-01-01"),
    reservations: [] as { id: string }[],
  };

  it("devuelve forma PaginatedResponse con data, total, page, totalPages", async () => {
    const { getSession } = await import("@/lib/actions/auth");
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(prisma.reservationClient.findMany).mockResolvedValue([]);
    vi.mocked(prisma.reservationClient.count).mockResolvedValue(0);

    const { getClients } = await import("../clients");
    const result = await getClients();

    expect(result).toHaveProperty("data");
    expect(result).toHaveProperty("total");
    expect(result).toHaveProperty("page");
    expect(result).toHaveProperty("totalPages");
    expect(Array.isArray((result as any).data)).toBe(true);
  });

  it("calcula totalPages correctamente: 45 elementos con limit 20 = 3 páginas", async () => {
    const { getSession } = await import("@/lib/actions/auth");
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(prisma.reservationClient.findMany).mockResolvedValue([]);
    vi.mocked(prisma.reservationClient.count).mockResolvedValue(45);

    const { getClients } = await import("../clients");
    const result = await getClients({ page: 1, limit: 20 });

    expect((result as any).totalPages).toBe(3);
    expect((result as any).total).toBe(45);
  });

  it("calcula skip correctamente para page=2, limit=20", async () => {
    const { getSession } = await import("@/lib/actions/auth");
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(prisma.reservationClient.findMany).mockResolvedValue([]);
    vi.mocked(prisma.reservationClient.count).mockResolvedValue(40);

    const { getClients } = await import("../clients");
    await getClients({ page: 2, limit: 20 });

    expect(prisma.reservationClient.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 20 })
    );
  });

  it("construye filtro OR cuando se pasa search", async () => {
    const { getSession } = await import("@/lib/actions/auth");
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(prisma.reservationClient.findMany).mockResolvedValue([]);
    vi.mocked(prisma.reservationClient.count).mockResolvedValue(0);

    const { getClients } = await import("../clients");
    await getClients({ search: "juan" });

    expect(prisma.reservationClient.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { name: { contains: "juan", mode: "insensitive" } },
            { email: { contains: "juan", mode: "insensitive" } },
          ],
        }),
      })
    );
  });

  it("mapea las propiedades del cliente al formato esperado", async () => {
    const { getSession } = await import("@/lib/actions/auth");
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(prisma.reservationClient.findMany).mockResolvedValue([
      mockClientRow,
    ]);
    vi.mocked(prisma.reservationClient.count).mockResolvedValue(1);

    const { getClients } = await import("../clients");
    const result = await getClients({ page: 1, limit: 20 });

    const data = (result as any).data;
    expect(data).toHaveLength(1);
    expect(data[0]).toEqual({
      id: "client-1",
      name: "Test",
      email: "test@test.com",
      phone: null,
      rut: null,
      notes: null,
      createdAt: "2025-01-01T00:00:00.000Z",
      userId: "user-1",
      reservationsCount: 0,
    });
  });

  it("retorna [] cuando no hay sesión", async () => {
    const { getSession } = await import("@/lib/actions/auth");
    vi.mocked(getSession).mockResolvedValue(null);

    const { getClients } = await import("../clients");
    const result = await getClients();

    expect(result).toEqual([]);
  });
});
