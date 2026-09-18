import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SessionUser } from "@/lib/auth/session";
import { Decimal } from "@prisma/client/runtime/client";

/**
 * Asignación de captador a una reserva (slice 3 de PRD-0006, ADR-0040 §2).
 *
 * Lo que estos tests fijan:
 * - La tasa se congela en la reserva al crearla.
 * - Un captador de otro owner o desactivado no se puede asignar.
 * - Sacar al captador se lleva su tasa.
 * - El historial guarda el NOMBRE del captador, no su id.
 * - Un cambio de comisión NO recalcula `totalPrice` ni revisa disponibilidad.
 */

const mockPrisma = vi.hoisted(() => ({
  property: { findUnique: vi.fn() },
  reservationClient: { findUnique: vi.fn() },
  userProfile: { findUnique: vi.fn() },
  broker: { findFirst: vi.fn(), findUnique: vi.fn() },
  reservation: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  reservationChange: { create: vi.fn() },
  payment: { create: vi.fn(), count: vi.fn() },
  externalChannelBlock: { findMany: vi.fn().mockResolvedValue([]) },
  $transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb(mockPrisma)),
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: mockPrisma }));

vi.mock("@/lib/auth/session", () => ({ getSession: vi.fn() }));

vi.mock("@/lib/notifications/record-event", () => ({
  recordDomainEvent: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { createReservation, updateReservation } from "../reservations";

const mockSession: SessionUser = {
  userId: "user-1",
  role: "OWNER",
  plan: "PRO",
  email: "test@test.com",
};

const property = {
  id: "prop-1",
  userId: "user-1",
  name: "Casa",
  dailyPrice: new Decimal("10000"),
  monthlyPrice: null,
  unitsAvailable: 5,
  mainImage: "",
  images: [],
  amenities: [],
  color: "#000",
  type: "APARTMENT",
  createdAt: new Date(),
  currency: "CLP",
};

const existingReservation = {
  id: "res-1",
  userId: "user-1",
  propertyId: "prop-1",
  clientId: "client-1",
  startDate: new Date("2026-09-01T15:00:00Z"),
  endDate: new Date("2026-09-10T15:00:00Z"),
  billingType: "DAILY",
  unitsBooked: 1,
  totalPrice: new Decimal("100000"),
  status: "PENDING",
  bookingAirbnb: false,
  notes: null,
  createdAt: new Date(),
  brokerId: null as string | null,
  commissionRate: null as Decimal | null,
  property,
};

const validCreateInput = {
  propertyId: "prop-1",
  clientId: "client-1",
  startDate: "01-09-2026",
  endDate: "10-09-2026",
  billingType: "DAILY" as const,
  unitsBooked: 1,
};

function arrangeCreate() {
  vi.mocked(mockPrisma.property.findUnique).mockResolvedValue(property as never);
  vi.mocked(mockPrisma.reservationClient.findUnique).mockResolvedValue({
    id: "client-1",
    name: "Juan",
    email: "juan@test.com",
  } as never);
  vi.mocked(mockPrisma.userProfile.findUnique).mockResolvedValue({ name: "Owner" } as never);
  vi.mocked(mockPrisma.reservation.findMany).mockResolvedValue([] as never);
  vi.mocked(mockPrisma.externalChannelBlock.findMany).mockResolvedValue([] as never);
  vi.mocked(mockPrisma.reservation.create).mockResolvedValue({
    ...existingReservation,
  } as never);
}

beforeEach(async () => {
  vi.clearAllMocks();
  const { getSession } = await import("@/lib/auth/session");
  vi.mocked(getSession).mockResolvedValue(mockSession);
  mockPrisma.externalChannelBlock.findMany = vi.fn().mockResolvedValue([]);
  mockPrisma.$transaction = vi.fn(async (cb: (tx: unknown) => unknown) => cb(mockPrisma));
});

describe("createReservation con captador", () => {
  it("congela el porcentaje en la reserva", async () => {
    arrangeCreate();
    vi.mocked(mockPrisma.broker.findFirst).mockResolvedValue({
      id: "brk-1",
      active: true,
    } as never);

    const result = await createReservation({
      ...validCreateInput,
      brokerId: "brk-1",
      commissionRate: 8.5,
    });

    expect(result).toHaveProperty("success", true);
    const data = vi.mocked(mockPrisma.reservation.create).mock.calls[0][0].data;
    expect(data.brokerId).toBe("brk-1");
    expect(data.commissionRate).toBe(8.5);
  });

  it("sin captador guarda los dos campos en null", async () => {
    arrangeCreate();

    await createReservation(validCreateInput);

    const data = vi.mocked(mockPrisma.reservation.create).mock.calls[0][0].data;
    expect(data.brokerId).toBe(null);
    expect(data.commissionRate).toBe(null);
    expect(mockPrisma.broker.findFirst).not.toHaveBeenCalled();
  });

  it("rechaza un captador que no es del owner", async () => {
    arrangeCreate();
    vi.mocked(mockPrisma.broker.findFirst).mockResolvedValue(null as never);

    const result = await createReservation({
      ...validCreateInput,
      brokerId: "brk-de-otro",
      commissionRate: 10,
    });

    expect(result).toEqual({ error: "Captador no encontrado" });
    expect(mockPrisma.broker.findFirst).toHaveBeenCalledWith({
      where: { id: "brk-de-otro", userId: "user-1" },
      select: { id: true, active: true },
    });
    expect(mockPrisma.reservation.create).not.toHaveBeenCalled();
  });

  it("rechaza un captador desactivado", async () => {
    arrangeCreate();
    vi.mocked(mockPrisma.broker.findFirst).mockResolvedValue({
      id: "brk-1",
      active: false,
    } as never);

    const result = await createReservation({
      ...validCreateInput,
      brokerId: "brk-1",
      commissionRate: 10,
    });

    expect(result).toEqual({ error: "Ese captador está desactivado" });
    expect(mockPrisma.reservation.create).not.toHaveBeenCalled();
  });

  it("con captador y sin porcentaje no crea nada", async () => {
    // Una reserva con captador y sin tasa no devengaría comisión, y el error
    // recién se notaría en el reporte de fin de mes.
    arrangeCreate();

    const result = await createReservation({
      ...validCreateInput,
      brokerId: "brk-1",
    });

    expect(result).toHaveProperty("error", "Datos inválidos");
    expect(mockPrisma.reservation.create).not.toHaveBeenCalled();
  });

  it("rechaza un porcentaje sobre 100", async () => {
    arrangeCreate();

    const result = await createReservation({
      ...validCreateInput,
      brokerId: "brk-1",
      commissionRate: 150,
    });

    expect(result).toHaveProperty("error", "Datos inválidos");
  });
});

describe("updateReservation — captación", () => {
  it("asignar un captador queda auditado con su nombre, no con su id", async () => {
    vi.mocked(mockPrisma.reservation.findFirst).mockResolvedValue({
      ...existingReservation,
    } as never);
    vi.mocked(mockPrisma.broker.findFirst).mockResolvedValue({
      name: "Ana Rojas",
      active: true,
    } as never);
    vi.mocked(mockPrisma.reservation.update).mockResolvedValue(existingReservation as never);

    await updateReservation("res-1", { brokerId: "brk-1", commissionRate: 10 });

    const logged = vi
      .mocked(mockPrisma.reservationChange.create)
      .mock.calls.map((c) => c[0].data);

    expect(logged).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "brokerId", oldValue: "Sin captador", newValue: "Ana Rojas" }),
        expect.objectContaining({ field: "commissionRate", oldValue: "", newValue: "10" }),
      ]),
    );
  });

  it("sacar al captador anula la tasa y lo deja en el historial", async () => {
    vi.mocked(mockPrisma.reservation.findFirst).mockResolvedValue({
      ...existingReservation,
      brokerId: "brk-1",
      commissionRate: new Decimal("10"),
    } as never);
    vi.mocked(mockPrisma.broker.findUnique).mockResolvedValue({ name: "Ana Rojas" } as never);
    vi.mocked(mockPrisma.reservation.update).mockResolvedValue(existingReservation as never);

    await updateReservation("res-1", { brokerId: "" });

    const data = vi.mocked(mockPrisma.reservation.update).mock.calls[0][0].data;
    expect(data.brokerId).toBe(null);
    expect(data.commissionRate).toBe(null);

    const logged = vi
      .mocked(mockPrisma.reservationChange.create)
      .mock.calls.map((c) => c[0].data);
    expect(logged).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "brokerId", oldValue: "Ana Rojas", newValue: "Sin captador" }),
        expect.objectContaining({ field: "commissionRate", oldValue: "10", newValue: "" }),
      ]),
    );
  });

  it("cambiar solo el porcentaje no recalcula el precio de la reserva", async () => {
    // El bloque de disponibilidad y de `totalPrice` es para fechas, unidades y
    // propiedad. Un edit de comisión que pasara por ahí podría quedar bloqueado
    // por una disponibilidad que otra reserva se llevó.
    vi.mocked(mockPrisma.reservation.findFirst).mockResolvedValue({
      ...existingReservation,
      brokerId: "brk-1",
      commissionRate: new Decimal("10"),
    } as never);
    vi.mocked(mockPrisma.reservation.update).mockResolvedValue(existingReservation as never);

    await updateReservation("res-1", { brokerId: "brk-1", commissionRate: 12 });

    const data = vi.mocked(mockPrisma.reservation.update).mock.calls[0][0].data;
    expect(data.commissionRate).toBe(12);
    expect("totalPrice" in data).toBe(false);
    // Tampoco se consultó disponibilidad.
    expect(mockPrisma.reservation.findMany).not.toHaveBeenCalled();
  });

  it("no escribe nada si el captador y la tasa no cambiaron", async () => {
    vi.mocked(mockPrisma.reservation.findFirst).mockResolvedValue({
      ...existingReservation,
      brokerId: "brk-1",
      commissionRate: new Decimal("10"),
    } as never);
    vi.mocked(mockPrisma.reservation.update).mockResolvedValue(existingReservation as never);

    await updateReservation("res-1", { brokerId: "brk-1", commissionRate: 10 });

    const data = vi.mocked(mockPrisma.reservation.update).mock.calls[0][0].data;
    expect(Object.keys(data)).toEqual([]);
    expect(mockPrisma.reservationChange.create).not.toHaveBeenCalled();
  });

  it("rechaza mover la reserva a un captador desactivado", async () => {
    vi.mocked(mockPrisma.reservation.findFirst).mockResolvedValue({
      ...existingReservation,
    } as never);
    vi.mocked(mockPrisma.broker.findFirst).mockResolvedValue({
      name: "Diego Paz",
      active: false,
    } as never);

    const result = await updateReservation("res-1", {
      brokerId: "brk-4",
      commissionRate: 12,
    });

    expect(result).toEqual({ error: "Ese captador está desactivado" });
    expect(mockPrisma.reservation.update).not.toHaveBeenCalled();
  });
});
