import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";
import type { SessionUser } from "@/lib/auth/session";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    broker: {
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      aggregate: vi.fn(),
    },
    reservation: {
      count: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth/session", () => ({
  getSession: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

/** Plan FREE a propósito: los captadores no consumen cupo (ADR-0040 §9). */
const mockSession: SessionUser = {
  userId: "user-1",
  role: "OWNER",
  plan: "FREE",
  email: "test@test.com",
};

const mockBroker = {
  id: "brk-1",
  userId: "user-1",
  name: "Ana Rojas",
  email: null,
  phone: null,
  rut: null,
  defaultCommissionRate: new Prisma.Decimal("10.00"),
  active: true,
  notes: null,
  createdAt: new Date("2026-09-01T15:00:00Z"),
};

const validInput = { name: "Ana Rojas", defaultCommissionRate: 10 };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createBroker", () => {
  it("no aplica límite de plan: un owner FREE puede crear el sexto captador", async () => {
    // Clientes se cortan en 5 en FREE. Captadores no tienen cupo (ADR-0040 §9).
    const { getSession } = await import("@/lib/auth/session");
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(prisma.broker.create).mockResolvedValue(mockBroker);

    const { createBroker } = await import("../brokers");
    const result = await createBroker(validInput);

    expect(result).toMatchObject({ success: true });
    // Ni siquiera se pregunta cuántos hay.
    expect(prisma.broker.count).not.toHaveBeenCalled();
  });

  it("guarda el porcentaje como Decimal", async () => {
    const { getSession } = await import("@/lib/auth/session");
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(prisma.broker.create).mockResolvedValue(mockBroker);

    const { createBroker } = await import("../brokers");
    await createBroker({ name: "Ana", defaultCommissionRate: 8.75 });

    const data = vi.mocked(prisma.broker.create).mock.calls[0][0].data;
    expect(String(data.defaultCommissionRate)).toBe("8.75");
  });

  it("un email vacío se guarda como null, no como cadena vacía", async () => {
    const { getSession } = await import("@/lib/auth/session");
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(prisma.broker.create).mockResolvedValue(mockBroker);

    const { createBroker } = await import("../brokers");
    await createBroker({ ...validInput, email: "" });

    expect(vi.mocked(prisma.broker.create).mock.calls[0][0].data.email).toBe(null);
  });

  it("rechaza un porcentaje mayor a 100", async () => {
    const { getSession } = await import("@/lib/auth/session");
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(getSession).mockResolvedValue(mockSession);

    const { createBroker } = await import("../brokers");
    const result = await createBroker({ name: "Ana", defaultCommissionRate: 120 });

    expect(result.error).toBe("Datos inválidos");
    expect(prisma.broker.create).not.toHaveBeenCalled();
  });

  it("rechaza un porcentaje negativo", async () => {
    const { getSession } = await import("@/lib/auth/session");
    vi.mocked(getSession).mockResolvedValue(mockSession);

    const { createBroker } = await import("../brokers");
    const result = await createBroker({ name: "Ana", defaultCommissionRate: -5 });

    expect(result.error).toBe("Datos inválidos");
  });

  it("sin sesión no crea nada", async () => {
    const { getSession } = await import("@/lib/auth/session");
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(getSession).mockResolvedValue(null);

    const { createBroker } = await import("../brokers");
    const result = await createBroker(validInput);

    expect(result.error).toBe("No autorizado");
    expect(prisma.broker.create).not.toHaveBeenCalled();
  });
});

describe("updateBroker", () => {
  it("filtra por owner antes de escribir", async () => {
    const { getSession } = await import("@/lib/auth/session");
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(prisma.broker.findFirst).mockResolvedValue(null);

    const { updateBroker } = await import("../brokers");
    const result = await updateBroker("brk-de-otro", validInput);

    expect(result.error).toBe("Captador no encontrado");
    expect(prisma.broker.findFirst).toHaveBeenCalledWith({
      where: { id: "brk-de-otro", userId: "user-1" },
    });
    expect(prisma.broker.update).not.toHaveBeenCalled();
  });

  it("editar el porcentaje no toca ninguna reserva", async () => {
    // La tasa de cada reserva está congelada (ADR-0040 §2): esta acción solo
    // escribe la columna del captador.
    const { getSession } = await import("@/lib/auth/session");
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(prisma.broker.findFirst).mockResolvedValue(mockBroker);
    vi.mocked(prisma.broker.update).mockResolvedValue(mockBroker);

    const { updateBroker } = await import("../brokers");
    await updateBroker("brk-1", { name: "Ana Rojas", defaultCommissionRate: 15 });

    const call = vi.mocked(prisma.broker.update).mock.calls[0][0];
    expect(call.where).toEqual({ id: "brk-1" });
    expect(String(call.data.defaultCommissionRate)).toBe("15");
  });

  it("no pisa `active` cuando el formulario no lo manda", async () => {
    const { getSession } = await import("@/lib/auth/session");
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(prisma.broker.findFirst).mockResolvedValue({ ...mockBroker, active: false });
    vi.mocked(prisma.broker.update).mockResolvedValue(mockBroker);

    const { updateBroker } = await import("../brokers");
    await updateBroker("brk-1", validInput);

    expect(
      "active" in vi.mocked(prisma.broker.update).mock.calls[0][0].data,
    ).toBe(false);
  });
});

describe("setBrokerActive", () => {
  it("desactiva sin borrar", async () => {
    const { getSession } = await import("@/lib/auth/session");
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(prisma.broker.findFirst).mockResolvedValue(mockBroker);
    vi.mocked(prisma.broker.update).mockResolvedValue({ ...mockBroker, active: false });

    const { setBrokerActive } = await import("../brokers");
    const result = await setBrokerActive("brk-1", false);

    expect(result).toEqual({ success: true });
    expect(prisma.broker.update).toHaveBeenCalledWith({
      where: { id: "brk-1" },
      data: { active: false },
    });
    expect(prisma.broker.delete).not.toHaveBeenCalled();
  });

  it("no toca un captador de otro owner", async () => {
    const { getSession } = await import("@/lib/auth/session");
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(prisma.broker.findFirst).mockResolvedValue(null);

    const { setBrokerActive } = await import("../brokers");
    const result = await setBrokerActive("brk-de-otro", false);

    expect(result.error).toBe("Captador no encontrado");
    expect(prisma.broker.update).not.toHaveBeenCalled();
  });
});

describe("deleteBroker", () => {
  it("con reservas asociadas no borra y explica que se desactiva", async () => {
    const { getSession } = await import("@/lib/auth/session");
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(prisma.broker.findFirst).mockResolvedValue({
      ...mockBroker,
      _count: { reservations: 3 },
    } as never);

    const { deleteBroker } = await import("../brokers");
    const result = await deleteBroker("brk-1");

    expect(result.error).toContain("Desactívalo");
    expect(prisma.broker.delete).not.toHaveBeenCalled();
  });

  it("sin reservas sí borra", async () => {
    const { getSession } = await import("@/lib/auth/session");
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(prisma.broker.findFirst).mockResolvedValue({
      ...mockBroker,
      _count: { reservations: 0 },
    } as never);
    vi.mocked(prisma.broker.delete).mockResolvedValue(mockBroker);

    const { deleteBroker } = await import("../brokers");
    const result = await deleteBroker("brk-1");

    expect(result).toEqual({ success: true });
    expect(prisma.broker.delete).toHaveBeenCalledWith({ where: { id: "brk-1" } });
  });
});

describe("getBrokers", () => {
  it("filtra por owner y lista los activos primero", async () => {
    const { getSession } = await import("@/lib/auth/session");
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(prisma.broker.findMany).mockResolvedValue([
      { ...mockBroker, reservations: [{ id: "res-1" }, { id: "res-2" }] },
    ] as never);
    vi.mocked(prisma.broker.count).mockResolvedValue(1);

    const { getBrokers } = await import("../brokers");
    const result = await getBrokers({ page: 1, limit: 10 });

    const call = vi.mocked(prisma.broker.findMany).mock.calls[0][0]!;
    expect(call.where).toMatchObject({ userId: "user-1" });
    expect(call.orderBy).toEqual([{ active: "desc" }, { createdAt: "desc" }]);

    expect(Array.isArray(result)).toBe(false);
    if (Array.isArray(result)) return;
    expect(result.data[0].defaultCommissionRate).toBe(10);
    expect(result.data[0].reservationsCount).toBe(2);
  });

  it("por defecto trae también los desactivados", async () => {
    const { getSession } = await import("@/lib/auth/session");
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(prisma.broker.findMany).mockResolvedValue([]);
    vi.mocked(prisma.broker.count).mockResolvedValue(0);

    const { getBrokers } = await import("../brokers");
    await getBrokers();

    expect(
      "active" in vi.mocked(prisma.broker.findMany).mock.calls[0][0]!.where!,
    ).toBe(false);
  });

  it("con onlyActive esconde los desactivados", async () => {
    const { getSession } = await import("@/lib/auth/session");
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(prisma.broker.findMany).mockResolvedValue([]);
    vi.mocked(prisma.broker.count).mockResolvedValue(0);

    const { getBrokers } = await import("../brokers");
    await getBrokers({ onlyActive: true });

    expect(vi.mocked(prisma.broker.findMany).mock.calls[0][0]!.where).toMatchObject({
      active: true,
    });
  });

  it("sin sesión devuelve lista vacía", async () => {
    const { getSession } = await import("@/lib/auth/session");
    vi.mocked(getSession).mockResolvedValue(null);

    const { getBrokers } = await import("../brokers");
    expect(await getBrokers()).toEqual([]);
  });
});

describe("getActiveBrokers", () => {
  it("devuelve solo activos, ordenados por nombre, con la tasa como número", async () => {
    const { getSession } = await import("@/lib/auth/session");
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(prisma.broker.findMany).mockResolvedValue([
      { id: "brk-1", name: "Ana", defaultCommissionRate: new Prisma.Decimal("8.50") },
    ] as never);

    const { getActiveBrokers } = await import("../brokers");
    const result = await getActiveBrokers();

    const call = vi.mocked(prisma.broker.findMany).mock.calls[0][0]!;
    expect(call.where).toEqual({ userId: "user-1", active: true });
    expect(call.orderBy).toEqual({ name: "asc" });
    expect(result[0].defaultCommissionRate).toBe(8.5);
  });
});

describe("getBrokersKpis", () => {
  it("cuenta las reservas captadas y promedia la tasa de los activos", async () => {
    const { getSession } = await import("@/lib/auth/session");
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(prisma.broker.count)
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(3);
    vi.mocked(prisma.reservation.count).mockResolvedValue(12);
    vi.mocked(prisma.broker.aggregate).mockResolvedValue({
      _avg: { defaultCommissionRate: new Prisma.Decimal("9.25") },
    } as never);

    const { getBrokersKpis } = await import("../brokers");
    const kpis = await getBrokersKpis();

    expect(kpis).toEqual({
      total: 4,
      active: 3,
      reservationsBrought: 12,
      averageRate: 9.25,
    });
    expect(vi.mocked(prisma.reservation.count).mock.calls[0][0]!.where).toEqual({
      userId: "user-1",
      brokerId: { not: null },
    });
  });

  it("sin captadores el promedio es 0, no null", async () => {
    const { getSession } = await import("@/lib/auth/session");
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(prisma.broker.count).mockResolvedValue(0);
    vi.mocked(prisma.reservation.count).mockResolvedValue(0);
    vi.mocked(prisma.broker.aggregate).mockResolvedValue({
      _avg: { defaultCommissionRate: null },
    } as never);

    const { getBrokersKpis } = await import("../brokers");
    expect((await getBrokersKpis()).averageRate).toBe(0);
  });
});
