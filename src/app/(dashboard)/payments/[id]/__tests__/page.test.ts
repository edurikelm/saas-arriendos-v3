import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockFindFirst, mockRedirect, mockNotFound } = vi.hoisted(() => ({
  mockFindFirst: vi.fn(),
  // Like Next's, both interrupt rendering by throwing.
  mockRedirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
  mockNotFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: { payment: { findFirst: mockFindFirst } },
}));

vi.mock("@/lib/auth/guards", () => ({
  requireOwner: vi.fn().mockResolvedValue({ userId: "owner-1", role: "OWNER", plan: "PRO", email: "o@test.com" }),
}));

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
  notFound: mockNotFound,
}));

async function visit(id: string) {
  const { default: PaymentRedirectPage } = await import("../page");
  return PaymentRedirectPage({ params: Promise.resolve({ id }) });
}

describe("/payments/[id] (links of older payment notifications)", () => {
  beforeEach(() => {
    mockFindFirst.mockReset();
  });

  it("redirects to the payment's reservation", async () => {
    mockFindFirst.mockResolvedValue({ reservationId: "res-9" });

    await expect(visit("pay-1")).rejects.toThrow("REDIRECT:/reservations/res-9");
  });

  it("only looks up payments of the owner's own reservations", async () => {
    mockFindFirst.mockResolvedValue({ reservationId: "res-9" });

    await visit("pay-1").catch(() => undefined);

    expect(mockFindFirst).toHaveBeenCalledWith({
      where: { id: "pay-1", reservation: { userId: "owner-1" } },
      select: { reservationId: true },
    });
  });

  it("is a 404 when the payment does not exist or belongs to someone else", async () => {
    mockFindFirst.mockResolvedValue(null);

    await expect(visit("pay-ajeno")).rejects.toThrow("NOT_FOUND");
    expect(mockRedirect).not.toHaveBeenCalledWith(expect.stringContaining("pay-ajeno"));
  });
});
