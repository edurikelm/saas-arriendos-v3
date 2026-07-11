import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionUser } from "@/lib/auth/session";

const mockStorage = vi.hoisted(() => ({
  upload: vi.fn(),
  createSignedUrl: vi.fn(),
}));

const mockSupabase = vi.hoisted(() => ({
  storage: {
    from: vi.fn(() => mockStorage),
  },
}));

const mockPrisma = vi.hoisted(() => ({
  reservation: {
    findFirst: vi.fn(),
  },
  reservationDocument: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth/session", () => ({ getSession: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn(() => mockSupabase) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import {
  createReservationDocument,
  softDeleteReservationDocument,
} from "../reservation-documents";

const mockSession: SessionUser = {
  userId: "owner-1",
  role: "OWNER",
  plan: "PRO",
  email: "owner@test.com",
};

describe("reservation-documents actions", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { getSession } = await import("@/lib/auth/session");
    vi.mocked(getSession).mockResolvedValue(mockSession);

    vi.mocked(mockPrisma.reservation.findFirst).mockResolvedValue({
      id: "res-1",
      billingType: "MONTHLY",
    });

    vi.mocked(mockStorage.upload).mockResolvedValue({ data: { path: "ok" }, error: null });
    vi.mocked(mockPrisma.reservationDocument.create).mockResolvedValue({ id: "doc-1" } as any);
    vi.mocked(mockPrisma.reservationDocument.count).mockResolvedValue(0);
  });

  it("rejects owner FREE plan", async () => {
    const { getSession } = await import("@/lib/auth/session");
    vi.mocked(getSession).mockResolvedValue({ ...mockSession, plan: "FREE" });

    const file = new File(["data"], "contrato.pdf", { type: "application/pdf" });
    const result = await createReservationDocument({ reservationId: "res-1", category: "CONTRATO", file });

    expect(result.error).toMatch(/plan PRO/i);
    expect(mockPrisma.reservationDocument.create).not.toHaveBeenCalled();
  });

  it("rejects non-monthly reservation", async () => {
    vi.mocked(mockPrisma.reservation.findFirst).mockResolvedValue(null);

    const file = new File(["data"], "contrato.pdf", { type: "application/pdf" });
    const result = await createReservationDocument({ reservationId: "res-1", category: "CONTRATO", file });

    expect(result.error).toMatch(/mensual/i);
    expect(mockPrisma.reservationDocument.create).not.toHaveBeenCalled();
  });

  it("rejects when reservation already has 10 docs", async () => {
    vi.mocked(mockPrisma.reservationDocument.count).mockResolvedValue(10);

    const file = new File(["data"], "anexo.pdf", { type: "application/pdf" });
    const result = await createReservationDocument({ reservationId: "res-1", category: "ANEXO", file });

    expect(result.error).toMatch(/máximo 10 documentos/i);
    expect(mockPrisma.reservationDocument.create).not.toHaveBeenCalled();
  });

  it("creates document when rules pass", async () => {
    const file = new File(["data"], "inventario.pdf", { type: "application/pdf" });
    const result = await createReservationDocument({ reservationId: "res-1", category: "INVENTARIO", file });

    expect(result.success).toBe(true);
    expect(mockStorage.upload).toHaveBeenCalledTimes(1);
    expect(mockPrisma.reservationDocument.create).toHaveBeenCalledTimes(1);
  });

  it("soft deletes document instead of hard delete", async () => {
    vi.mocked(mockPrisma.reservationDocument.findFirst).mockResolvedValue({
      id: "doc-1",
      reservation: { billingType: "MONTHLY" },
    } as any);

    const result = await softDeleteReservationDocument("doc-1");

    expect(result.success).toBe(true);
    expect(mockPrisma.reservationDocument.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "doc-1" },
        data: expect.objectContaining({ deletedAt: expect.any(Date) }),
      })
    );
  });
});
