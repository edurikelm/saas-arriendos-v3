import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Mock del adapter de Prisma. El helper acepta cualquier adapter con la
 * misma shape (default `prisma` o `Prisma.TransactionClient` desde
 * `$transaction(callback)`), así que mockeamos solo los métodos que usa:
 * - `reservation.findUnique`
 * - `reservation.update`
 * - `payment.findMany`
 *
 * vi.mock se eleva al top del archivo, por lo que las funciones mock
 * también deben elevarse vía `vi.hoisted` para estar disponibles en la
 * factory del mock.
 */
const { mockReservationFindFirst, mockReservationUpdate, mockPaymentFindMany } =
  vi.hoisted(() => ({
    mockReservationFindFirst: vi.fn(),
    mockReservationUpdate: vi.fn(),
    mockPaymentFindMany: vi.fn(),
  }));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    reservation: {
      findFirst: mockReservationFindFirst,
      update: mockReservationUpdate,
    },
    payment: {
      findMany: mockPaymentFindMany,
    },
  },
}));

import { confirmReservationIfPaid } from "../confirmation";

const RESERVATION_ID = "res-1";

type MockReservation = {
  id: string;
  status: "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED";
  totalPrice: number | { toString(): string } | unknown;
};

function setReservation(reservation: MockReservation | null) {
  mockReservationFindFirst.mockResolvedValue(reservation as any);
}

function setPayments(payments: Array<Record<string, unknown>>) {
  mockPaymentFindMany.mockResolvedValue(payments as any);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockReservationUpdate.mockResolvedValue({ id: RESERVATION_ID });
});

describe("confirmReservationIfPaid", () => {
  describe("reservation lookup", () => {
    it("retorna not_found si la reserva no existe y no consulta pagos", async () => {
      setReservation(null);

      const result = await confirmReservationIfPaid(RESERVATION_ID);

      expect(result).toEqual({ status: "not_found" });
      expect(mockReservationFindFirst).toHaveBeenCalledWith({
        where: { id: RESERVATION_ID },
        select: { id: true, status: true, totalPrice: true },
      });
      expect(mockPaymentFindMany).not.toHaveBeenCalled();
      expect(mockReservationUpdate).not.toHaveBeenCalled();
    });

    it("busca la reserva por findFirst con select mínimo (id, status, totalPrice)", async () => {
      setReservation({ id: RESERVATION_ID, status: "PENDING", totalPrice: 100000 });
      setPayments([]);

      await confirmReservationIfPaid(RESERVATION_ID);

      expect(mockReservationFindFirst).toHaveBeenCalledWith({
        where: { id: RESERVATION_ID },
        select: { id: true, status: true, totalPrice: true },
      });
    });
  });

  describe("reservation CANCELLED", () => {
    it("rechaza auto-confirmar aunque tenga pagos suficientes (no update)", async () => {
      setReservation({ id: RESERVATION_ID, status: "CANCELLED", totalPrice: 100000 });
      setPayments([
        { amount: "150000", status: "COMPLETED", paymentType: "RESERVATION", deletedAt: null },
      ]);

      const result = await confirmReservationIfPaid(RESERVATION_ID);

      expect(result).toEqual({
        status: "skipped_cancelled",
        totalPaid: 150000,
        totalPrice: 100000,
      });
      expect(mockReservationUpdate).not.toHaveBeenCalled();
    });
  });

  describe("reservation COMPLETED", () => {
    it("rechaza auto-confirmar (la reserva ya terminó)", async () => {
      setReservation({ id: RESERVATION_ID, status: "COMPLETED", totalPrice: 100000 });
      setPayments([
        { amount: "150000", status: "COMPLETED", paymentType: "RESERVATION", deletedAt: null },
      ]);

      const result = await confirmReservationIfPaid(RESERVATION_ID);

      expect(result).toEqual({
        status: "skipped_completed",
        totalPaid: 150000,
        totalPrice: 100000,
      });
      expect(mockReservationUpdate).not.toHaveBeenCalled();
    });
  });

  describe("reservation CONFIRMED", () => {
    it("es idempotente: no escribe si ya estaba CONFIRMED", async () => {
      setReservation({ id: RESERVATION_ID, status: "CONFIRMED", totalPrice: 100000 });
      setPayments([
        { amount: "100000", status: "COMPLETED", paymentType: "RESERVATION", deletedAt: null },
      ]);

      const result = await confirmReservationIfPaid(RESERVATION_ID);

      expect(result).toEqual({
        status: "already_confirmed",
        totalPaid: 100000,
        totalPrice: 100000,
      });
      expect(mockReservationUpdate).not.toHaveBeenCalled();
    });
  });

  describe("reservation PENDING + threshold met", () => {
    it("flip a CONFIRMED cuando totalPaid >= totalPrice", async () => {
      setReservation({ id: RESERVATION_ID, status: "PENDING", totalPrice: 100000 });
      setPayments([
        { amount: "60000", status: "COMPLETED", paymentType: "RESERVATION", deletedAt: null },
        { amount: "40000", status: "COMPLETED", paymentType: "RESERVATION", deletedAt: null },
      ]);

      const result = await confirmReservationIfPaid(RESERVATION_ID);

      expect(result).toEqual({
        status: "confirmed",
        totalPaid: 100000,
        totalPrice: 100000,
      });
      expect(mockReservationUpdate).toHaveBeenCalledWith({
        where: { id: RESERVATION_ID },
        data: { status: "CONFIRMED" },
      });
    });

    it("acepta overpaid (totalPaid > totalPrice) y confirma", async () => {
      setReservation({ id: RESERVATION_ID, status: "PENDING", totalPrice: 100000 });
      setPayments([
        { amount: "120000", status: "COMPLETED", paymentType: "RESERVATION", deletedAt: null },
      ]);

      const result = await confirmReservationIfPaid(RESERVATION_ID);

      expect(result.status).toBe("confirmed");
      expect(mockReservationUpdate).toHaveBeenCalledTimes(1);
    });

    it("acepta exact match (totalPaid === totalPrice)", async () => {
      setReservation({ id: RESERVATION_ID, status: "PENDING", totalPrice: 100000 });
      setPayments([
        { amount: "100000", status: "COMPLETED", paymentType: "RESERVATION", deletedAt: null },
      ]);

      const result = await confirmReservationIfPaid(RESERVATION_ID);

      expect(result.status).toBe("confirmed");
    });
  });

  describe("reservation PENDING + threshold not met", () => {
    it("no confirma si totalPaid < totalPrice", async () => {
      setReservation({ id: RESERVATION_ID, status: "PENDING", totalPrice: 100000 });
      setPayments([
        { amount: "50000", status: "COMPLETED", paymentType: "RESERVATION", deletedAt: null },
      ]);

      const result = await confirmReservationIfPaid(RESERVATION_ID);

      expect(result).toEqual({
        status: "below_threshold",
        totalPaid: 50000,
        totalPrice: 100000,
      });
      expect(mockReservationUpdate).not.toHaveBeenCalled();
    });

    it("ignora pagos EXTRA para el cálculo (no cuentan para confirmar)", async () => {
      setReservation({ id: RESERVATION_ID, status: "PENDING", totalPrice: 100000 });
      setPayments([
        // Los EXTRAs suman 150000 pero no cuentan
        { amount: "100000", status: "COMPLETED", paymentType: "EXTRA", deletedAt: null, title: "Limpieza" },
        { amount: "50000", status: "COMPLETED", paymentType: "EXTRA", deletedAt: null, title: "Multa" },
        // El RESERVATION solo llega a 30000
        { amount: "30000", status: "COMPLETED", paymentType: "RESERVATION", deletedAt: null },
      ]);

      const result = await confirmReservationIfPaid(RESERVATION_ID);

      expect(result).toEqual({
        status: "below_threshold",
        totalPaid: 30000,
        totalPrice: 100000,
      });
      expect(mockReservationUpdate).not.toHaveBeenCalled();
    });

    it("ignora pagos soft-deleted para el cálculo", async () => {
      setReservation({ id: RESERVATION_ID, status: "PENDING", totalPrice: 100000 });
      setPayments([
        { amount: "100000", status: "COMPLETED", paymentType: "RESERVATION", deletedAt: "2025-01-01" },
      ]);

      const result = await confirmReservationIfPaid(RESERVATION_ID);

      expect(result.status).toBe("below_threshold");
      expect(mockReservationUpdate).not.toHaveBeenCalled();
    });

    it("ignora pagos PENDING (solo cuentan COMPLETED)", async () => {
      setReservation({ id: RESERVATION_ID, status: "PENDING", totalPrice: 100000 });
      setPayments([
        { amount: "100000", status: "PENDING", paymentType: "RESERVATION", deletedAt: null },
      ]);

      const result = await confirmReservationIfPaid(RESERVATION_ID);

      expect(result).toEqual({
        status: "below_threshold",
        totalPaid: 0,
        totalPrice: 100000,
      });
      expect(mockReservationUpdate).not.toHaveBeenCalled();
    });
  });

  describe("adapter injection", () => {
    it("usa el adapter provisto en vez del prisma global", async () => {
      // Adapter custom: simula un Prisma.TransactionClient (misma shape).
      // El cast a `any` evita tener que mockear la shape completa del delegate
      // (que tiene ~17 métodos); solo nos importan los 3 que usa el helper.
      const txAdapter = {
        reservation: {
          findFirst: vi.fn().mockResolvedValue({
            id: RESERVATION_ID,
            status: "PENDING",
            totalPrice: 50000,
          }),
          update: vi.fn().mockResolvedValue({ id: RESERVATION_ID }),
        },
        payment: {
          findMany: vi.fn().mockResolvedValue([
            { amount: "50000", status: "COMPLETED", paymentType: "RESERVATION", deletedAt: null },
          ]),
        },
      } as any;

      const result = await confirmReservationIfPaid(RESERVATION_ID, txAdapter);

      expect(result.status).toBe("confirmed");
      expect(txAdapter.reservation.findFirst).toHaveBeenCalled();
      expect(txAdapter.payment.findMany).toHaveBeenCalled();
      expect(txAdapter.reservation.update).toHaveBeenCalledWith({
        where: { id: RESERVATION_ID },
        data: { status: "CONFIRMED" },
      });
      // El prisma global NO debe tocarse cuando se pasa adapter
      expect(mockReservationFindFirst).not.toHaveBeenCalled();
      expect(mockPaymentFindMany).not.toHaveBeenCalled();
      expect(mockReservationUpdate).not.toHaveBeenCalled();
    });
  });

  describe("payment query shape", () => {
    it("consulta pagos con status COMPLETED|PENDING y deletedAt null", async () => {
      setReservation({ id: RESERVATION_ID, status: "PENDING", totalPrice: 100000 });
      setPayments([]);

      await confirmReservationIfPaid(RESERVATION_ID);

      expect(mockPaymentFindMany).toHaveBeenCalledWith({
        where: {
          reservationId: RESERVATION_ID,
          status: { in: ["COMPLETED", "PENDING"] },
          deletedAt: null,
        },
      });
    });
  });
});