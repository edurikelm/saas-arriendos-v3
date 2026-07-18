import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SessionUser } from "@/lib/auth/session";

const mockStorage = vi.hoisted(() => ({
  createSignedUrl: vi.fn(),
  upload: vi.fn(),
}));

const mockSupabase = vi.hoisted(() => ({
  storage: {
    from: vi.fn(() => mockStorage),
  },
}));

const mockPrisma = vi.hoisted(() => ({
  payment: {
    findFirst: vi.fn(),
  },
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth/session", () => ({ getSession: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn(() => mockSupabase) }));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
vi.mock("@react-pdf/renderer", () => ({
  renderToBuffer: vi.fn(async () => Buffer.from("%PDF-1.4 mock")),
  StyleSheet: { create: vi.fn(() => ({})) },
  Document: ({ children }: { children: React.ReactNode }) => children,
  Page: ({ children }: { children: React.ReactNode }) => children,
  View: ({ children }: { children: React.ReactNode }) => children,
  Text: ({ children }: { children: React.ReactNode }) => children,
}));

const mockSession: SessionUser = {
  userId: "owner-1",
  role: "OWNER",
  plan: "PRO",
  email: "owner@test.com",
};

const fakePayment = {
  id: "pay-1",
  status: "COMPLETED",
  method: "MERCADO_PAGO",
  amount: 50000,
  paidAt: new Date("2025-06-15T12:00:00Z"),
  mpPaymentId: "mp-123",
  mpStatusDetail: "accredited",
  mpPaymentMethodId: "credit_card",
  mpPaymentType: "credit_card",
  mpCardLastFour: "1234",
  mpInstallments: 1,
  mpTransactionAmount: 50000,
  mpNetReceivedAmount: 47500,
  mpFeeAmount: 2500,
  mpDateCreated: new Date("2025-06-15T12:00:00Z"),
  reservation: {
    id: "res-1",
    userId: "owner-1",
    startDate: new Date("2025-06-01"),
    endDate: new Date("2025-06-05"),
    billingType: "DAILY",
    totalPrice: 200000,
    client: { name: "Juan Pérez", email: "juan@test.com", phone: "+56912345678" },
    property: { name: "Cabaña del Bosque", address: "Los Aromos 123" },
  },
};

import { GET } from "../route";

describe("GET /api/payments/[id]/receipt", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { getSession } = await import("@/lib/auth/session");
    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(mockPrisma.payment.findFirst).mockResolvedValue(fakePayment);
  });

  it("returns 401 when no session", async () => {
    const { getSession } = await import("@/lib/auth/session");
    vi.mocked(getSession).mockResolvedValue(null);

    const req = new Request("http://localhost/api/payments/pay-1/receipt");
    const res = await GET(req, { params: Promise.resolve({ id: "pay-1" }) });

    expect(res.status).toBe(401);
  });

  it("returns 403 when payment does not belong to owner", async () => {
    vi.mocked(mockPrisma.payment.findFirst).mockResolvedValue({
      ...fakePayment,
      reservation: { ...fakePayment.reservation, userId: "other-owner" },
    });

    const req = new Request("http://localhost/api/payments/pay-1/receipt");
    const res = await GET(req, { params: Promise.resolve({ id: "pay-1" }) });

    expect(res.status).toBe(403);
  });

  it("returns 400 when payment is not COMPLETED", async () => {
    vi.mocked(mockPrisma.payment.findFirst).mockResolvedValue({
      ...fakePayment,
      status: "PENDING",
    });

    const req = new Request("http://localhost/api/payments/pay-1/receipt");
    const res = await GET(req, { params: Promise.resolve({ id: "pay-1" }) });

    expect(res.status).toBe(400);
  });

  it("returns 400 when payment method is not MERCADO_PAGO", async () => {
    vi.mocked(mockPrisma.payment.findFirst).mockResolvedValue({
      ...fakePayment,
      method: "CASH",
    });

    const req = new Request("http://localhost/api/payments/pay-1/receipt");
    const res = await GET(req, { params: Promise.resolve({ id: "pay-1" }) });

    expect(res.status).toBe(400);
  });

  it("returns 404 when payment does not exist", async () => {
    vi.mocked(mockPrisma.payment.findFirst).mockResolvedValue(null);

    const req = new Request("http://localhost/api/payments/pay-999/receipt");
    const res = await GET(req, { params: Promise.resolve({ id: "pay-999" }) });

    expect(res.status).toBe(404);
  });

  it("redirects to signed URL when PDF already exists", async () => {
    vi.mocked(mockStorage.createSignedUrl).mockResolvedValue({
      data: { signedUrl: "https://storage.example.com/signed-pdf-url" },
      error: null,
    });

    const req = new Request("http://localhost/api/payments/pay-1/receipt");
    const res = await GET(req, { params: Promise.resolve({ id: "pay-1" }) });

    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("https://storage.example.com/signed-pdf-url");
  });

  it("generates and uploads PDF when not cached, then redirects to signed URL", async () => {
    // First call (check existing) returns error → PDF not cached
    vi.mocked(mockStorage.createSignedUrl)
      .mockResolvedValueOnce({ data: null, error: { message: "not found" } })
      // Second call (after upload) returns signed URL
      .mockResolvedValueOnce({
        data: { signedUrl: "https://storage.example.com/new-signed-url" },
        error: null,
      });

    vi.mocked(mockStorage.upload).mockResolvedValue({ data: { path: "payments/pay-1/pay-1-1718452800.pdf" }, error: null });

    const req = new Request("http://localhost/api/payments/pay-1/receipt");
    const res = await GET(req, { params: Promise.resolve({ id: "pay-1" }) });

    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("https://storage.example.com/new-signed-url");
    expect(mockStorage.upload).toHaveBeenCalledTimes(1);
  });

  it("returns 500 when PDF rendering fails", async () => {
    const { renderToBuffer } = await import("@react-pdf/renderer");
    vi.mocked(renderToBuffer).mockRejectedValue(new Error("Render error"));

    vi.mocked(mockStorage.createSignedUrl).mockResolvedValue({
      data: null,
      error: { message: "not found" },
    });

    const req = new Request("http://localhost/api/payments/pay-1/receipt");
    const res = await GET(req, { params: Promise.resolve({ id: "pay-1" }) });

    expect(res.status).toBe(500);
  });

  it("returns 500 when upload fails", async () => {
    vi.mocked(mockStorage.createSignedUrl).mockResolvedValue({
      data: null,
      error: { message: "not found" },
    });
    vi.mocked(mockStorage.upload).mockResolvedValue({ data: null, error: { message: "Upload failed" } });

    const req = new Request("http://localhost/api/payments/pay-1/receipt");
    const res = await GET(req, { params: Promise.resolve({ id: "pay-1" }) });

    expect(res.status).toBe(500);
  });
});
