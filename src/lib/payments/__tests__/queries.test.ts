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
  findFirst: vi.fn(),
  findMany: vi.fn(),
  aggregate: vi.fn(),
  count: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    payment: {
      findFirst: mocks.findFirst,
      findMany: mocks.findMany,
      aggregate: mocks.aggregate,
      count: mocks.count,
      update: mocks.update,
    },
  },
}));

import {
  getPaymentById,
  getPaymentByMercadoPagoId,
  getAllPaymentsForReservation,
  getActivePaymentsForReservation,
  sumCompletedPaymentsForOwner,
  sumPendingPaymentsForOwner,
  countPendingPaymentsForOwner,
  sumCompletedPaymentsAll,
  markPaymentCompleted,
  markPaymentStatus,
  revertPaymentToPending,
  countCompletedPaymentsForReservation,
} from "../queries";

beforeEach(() => {
  vi.clearAllMocks();
});

// ────────────────────────────────────────────────────────────────────────────
// Patrón A — Lookup
// ────────────────────────────────────────────────────────────────────────────

describe("getPaymentById", () => {
  it("busca por id, excluye soft-deleted, e incluye reservation+client", async () => {
    const fakePayment = { id: "pay-1", reservation: { client: { name: "x" } } };
    mocks.findFirst.mockResolvedValue(fakePayment);

    const result = await getPaymentById("pay-1");

    expect(result).toBe(fakePayment);
    expect(mocks.findFirst).toHaveBeenCalledWith({
      where: { id: "pay-1", deletedAt: null },
      include: {
        reservation: {
          include: { client: true },
        },
      },
    });
  });

  it("includeClient=false omite client del include", async () => {
    mocks.findFirst.mockResolvedValue(null);

    await getPaymentById("pay-2", { includeClient: false });

    expect(mocks.findFirst).toHaveBeenCalledWith({
      where: { id: "pay-2", deletedAt: null },
      include: {
        reservation: { include: { client: false } },
      },
    });
  });

  it("includeProperty=true agrega property al include", async () => {
    mocks.findFirst.mockResolvedValue(null);

    await getPaymentById("pay-3", { includeProperty: true });

    expect(mocks.findFirst).toHaveBeenCalledWith({
      where: { id: "pay-3", deletedAt: null },
      include: {
        reservation: {
          include: { client: true, property: true },
        },
      },
    });
  });
});

describe("getPaymentByMercadoPagoId", () => {
  it("busca por mercadoPagoId, excluye soft-deleted, incluye client", async () => {
    const fakePayment = { id: "pay-1", mercadoPagoId: "mp-123" };
    mocks.findFirst.mockResolvedValue(fakePayment);

    const result = await getPaymentByMercadoPagoId("mp-123");

    expect(result).toBe(fakePayment);
    expect(mocks.findFirst).toHaveBeenCalledWith({
      where: { mercadoPagoId: "mp-123", deletedAt: null },
      include: {
        reservation: { include: { client: true } },
      },
    });
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Patrón B — findMany para pagos de una reserva
// ────────────────────────────────────────────────────────────────────────────

describe("getAllPaymentsForReservation", () => {
  it("busca pagos sin filtro de status, excluye soft-deleted", async () => {
    mocks.findMany.mockResolvedValue([{ id: "p1" }, { id: "p2" }]);

    await getAllPaymentsForReservation("res-1");

    expect(mocks.findMany).toHaveBeenCalledWith({
      where: { reservationId: "res-1", deletedAt: null },
    });
  });
});

describe("getActivePaymentsForReservation", () => {
  it("filtra por status COMPLETED|PENDING, excluye soft-deleted", async () => {
    mocks.findMany.mockResolvedValue([{ id: "p1" }]);

    await getActivePaymentsForReservation("res-2");

    expect(mocks.findMany).toHaveBeenCalledWith({
      where: {
        reservationId: "res-2",
        status: { in: ["COMPLETED", "PENDING"] },
        deletedAt: null,
      },
    });
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Patrón C — Aggregates (revenue)
// ────────────────────────────────────────────────────────────────────────────

describe("sumCompletedPaymentsForOwner", () => {
  it("filtra por COMPLETED+RESERVATION+paidAt+userId+deletedAt y devuelve Number", async () => {
    mocks.aggregate.mockResolvedValue({ _sum: { amount: 150000 } });

    const result = await sumCompletedPaymentsForOwner("user-1", {
      from: new Date("2025-01-01"),
      to: new Date("2025-01-31"),
    });

    expect(result).toBe(150000);
    expect(mocks.aggregate).toHaveBeenCalledWith({
      where: {
        status: "COMPLETED",
        paymentType: "RESERVATION",
        paidAt: { gte: new Date("2025-01-01"), lte: new Date("2025-01-31") },
        deletedAt: null,
        reservation: { userId: "user-1" },
      },
      _sum: { amount: true },
    });
  });

  it("omite from/to del filtro si no se pasan (aggregate total histórico)", async () => {
    mocks.aggregate.mockResolvedValue({ _sum: { amount: null } });

    const result = await sumCompletedPaymentsForOwner("user-1");

    expect(result).toBe(0); // null-safe via ?? 0
    expect(mocks.aggregate).toHaveBeenCalledWith({
      where: {
        status: "COMPLETED",
        paymentType: "RESERVATION",
        paidAt: {},
        deletedAt: null,
        reservation: { userId: "user-1" },
      },
      _sum: { amount: true },
    });
  });

  // Regla de dominio crítica: usa paidAt, no createdAt
  it("usa paidAt (cash basis) — NO createdAt", async () => {
    mocks.aggregate.mockResolvedValue({ _sum: { amount: 0 } });

    await sumCompletedPaymentsForOwner("user-1", {
      from: new Date("2025-01-01"),
    });

    const call = mocks.aggregate.mock.calls[0][0];
    expect(call.where.paidAt).toBeDefined();
    expect(call.where.createdAt).toBeUndefined();
  });
});

describe("sumPendingPaymentsForOwner", () => {
  it("filtra por PENDING+RESERVATION+userId+deletedAt", async () => {
    mocks.aggregate.mockResolvedValue({ _sum: { amount: 50000 } });

    const result = await sumPendingPaymentsForOwner("user-2");

    expect(result).toBe(50000);
    expect(mocks.aggregate).toHaveBeenCalledWith({
      where: {
        status: "PENDING",
        paymentType: "RESERVATION",
        deletedAt: null,
        reservation: { userId: "user-2" },
      },
      _sum: { amount: true },
    });
  });
});

describe("countPendingPaymentsForOwner", () => {
  it("cuenta pagos PENDING+RESERVATION+userId+deletedAt", async () => {
    mocks.count.mockResolvedValue(3);

    const result = await countPendingPaymentsForOwner("user-3");

    expect(result).toBe(3);
    expect(mocks.count).toHaveBeenCalledWith({
      where: {
        status: "PENDING",
        paymentType: "RESERVATION",
        deletedAt: null,
        reservation: { userId: "user-3" },
      },
    });
  });
});

describe("sumCompletedPaymentsAll", () => {
  it("suma todos los pagos COMPLETED (sin userId)", async () => {
    mocks.aggregate.mockResolvedValue({ _sum: { amount: 999999 } });

    const result = await sumCompletedPaymentsAll();

    expect(result).toBe(999999);
    expect(mocks.aggregate).toHaveBeenCalledWith({
      where: { status: "COMPLETED" },
      _sum: { amount: true },
    });
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Patrón D — Status updates
// ────────────────────────────────────────────────────────────────────────────

describe("markPaymentCompleted", () => {
  it("marca COMPLETED con paidAt = now por default", async () => {
    mocks.update.mockResolvedValue({ id: "pay-1", status: "COMPLETED" });

    const before = Date.now();
    await markPaymentCompleted("pay-1");
    const after = Date.now();

    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "pay-1" },
      data: { status: "COMPLETED", paidAt: expect.any(Date) },
    });

    const paidAt = mocks.update.mock.calls[0][0].data.paidAt as Date;
    expect(paidAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(paidAt.getTime()).toBeLessThanOrEqual(after);
  });

  it("acepta paidAt, mercadoPagoId y receiptUrl opcionales", async () => {
    mocks.update.mockResolvedValue({});

    const paidAt = new Date("2025-06-15T12:00:00Z");
    await markPaymentCompleted("pay-1", {
      paidAt,
      mercadoPagoId: "mp-pref-123",
      receiptUrl: "https://cloudinary.com/receipt.png",
    });

    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "pay-1" },
      data: {
        status: "COMPLETED",
        paidAt,
        mercadoPagoId: "mp-pref-123",
        receiptUrl: "https://cloudinary.com/receipt.png",
      },
    });
  });

  it("omite mercadoPagoId y receiptUrl si no se pasan (no los setea a undefined)", async () => {
    mocks.update.mockResolvedValue({});

    await markPaymentCompleted("pay-1");

    const data = mocks.update.mock.calls[0][0].data;
    expect(data).not.toHaveProperty("mercadoPagoId");
    expect(data).not.toHaveProperty("receiptUrl");
  });
});

describe("markPaymentStatus", () => {
  it("marca PENDING sin tocar paidAt", async () => {
    mocks.update.mockResolvedValue({ id: "pay-1", status: "PENDING" });

    await markPaymentStatus("pay-1", "PENDING");

    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "pay-1" },
      data: { status: "PENDING" },
    });
  });

  it("marca FAILED", async () => {
    mocks.update.mockResolvedValue({});

    await markPaymentStatus("pay-1", "FAILED");

    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "pay-1" },
      data: { status: "FAILED" },
    });
  });

  it("acepta mercadoPagoId opcional (ej. cuando MP rechaza y devuelve el id)", async () => {
    mocks.update.mockResolvedValue({});

    await markPaymentStatus("pay-1", "FAILED", { mercadoPagoId: "mp-123" });

    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "pay-1" },
      data: { status: "FAILED", mercadoPagoId: "mp-123" },
    });
  });
});

describe("revertPaymentToPending", () => {
  it("revierte a PENDING y limpia paidAt", async () => {
    mocks.update.mockResolvedValue({});

    await revertPaymentToPending("pay-1");

    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "pay-1" },
      data: { status: "PENDING", paidAt: null },
    });
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Patrón E — Counters
// ────────────────────────────────────────────────────────────────────────────

describe("countCompletedPaymentsForReservation", () => {
  it("cuenta COMPLETED+deletedAt=null para una reserva", async () => {
    mocks.count.mockResolvedValue(2);

    const result = await countCompletedPaymentsForReservation("res-1");

    expect(result).toBe(2);
    expect(mocks.count).toHaveBeenCalledWith({
      where: {
        reservationId: "res-1",
        status: "COMPLETED",
        deletedAt: null,
      },
    });
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Adapter pattern — los helpers aceptan un adapter custom (no usan prisma global)
// ────────────────────────────────────────────────────────────────────────────

describe("adapter pattern", () => {
  it("usa el adapter pasado como tercer argumento en vez de prisma global", async () => {
    const txAdapter = {
      payment: {
        findFirst: vi.fn().mockResolvedValue({ id: "pay-tx-1" }),
        findMany: vi.fn(),
        aggregate: vi.fn(),
        count: vi.fn(),
        update: vi.fn(),
      },
    };

    const result = await getPaymentById("pay-1", {}, txAdapter);

    expect(result).toEqual({ id: "pay-tx-1" });
    expect(txAdapter.payment.findFirst).toHaveBeenCalled();
    // El prisma global NO debe llamarse cuando se pasa un adapter custom
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });
});
