import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";
import type { SessionUser } from "@/lib/actions/auth";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    reservationClient: {
      count: vi.fn(),
      create: vi.fn(),
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
