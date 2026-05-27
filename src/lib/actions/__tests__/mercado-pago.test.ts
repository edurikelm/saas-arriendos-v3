import { beforeEach, describe, expect, it, vi } from "vitest";

const decryptMock = vi.fn();
const encryptMock = vi.fn();

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    userIntegration: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/crypto", () => ({
  encrypt: (...args: unknown[]) => encryptMock(...args),
  decrypt: (...args: unknown[]) => decryptMock(...args),
}));

describe("getValidMercadoPagoToken", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...originalEnv,
      ENCRYPTION_KEY: Buffer.alloc(32).toString("base64"),
      MERCADOPAGO_OAUTH_CLIENT_ID: "client-id",
      MERCADOPAGO_OAUTH_CLIENT_SECRET: "client-secret",
    };
  });

  it("refreshes token when expired and persists new credentials", async () => {
    const { prisma } = await import("@/lib/db/prisma");

    vi.mocked(prisma.userIntegration.findFirst).mockResolvedValue({
      id: "int-1",
      userId: "owner-1",
      provider: "MERCADO_PAGO",
      accessToken: "enc:old-access",
      isActive: true,
      metadata: {
        expiresAt: new Date(Date.now() - 60_000).toISOString(),
        refreshTokenEncrypted: "enc:old-refresh",
      },
    } as any);

    decryptMock.mockImplementation((v: string) => (v === "enc:old-refresh" ? "refresh-1" : "old-access"));
    encryptMock.mockImplementation((v: string) => `enc:${v}`);

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: "new-access",
          refresh_token: "new-refresh",
          expires_in: 7200,
        }),
      })
    );

    const { getValidMercadoPagoToken } = await import("../mercado-pago");
    const token = await getValidMercadoPagoToken("owner-1");

    expect(token).toBe("new-access");
    expect(prisma.userIntegration.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "int-1" },
        data: expect.objectContaining({
          accessToken: "enc:new-access",
          metadata: expect.objectContaining({
            refreshTokenEncrypted: "enc:new-refresh",
          }),
        }),
      })
    );
  });

  it("deactivates integration and returns null when refresh fails", async () => {
    const { prisma } = await import("@/lib/db/prisma");

    vi.mocked(prisma.userIntegration.findFirst).mockResolvedValue({
      id: "int-1",
      userId: "owner-1",
      provider: "MERCADO_PAGO",
      accessToken: "enc:old-access",
      isActive: true,
      metadata: {
        expiresAt: new Date(Date.now() - 60_000).toISOString(),
        refreshTokenEncrypted: "enc:old-refresh",
      },
    } as any);

    decryptMock.mockReturnValue("refresh-1");

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
      })
    );

    const { getValidMercadoPagoToken } = await import("../mercado-pago");
    const token = await getValidMercadoPagoToken("owner-1");

    expect(token).toBeNull();
    expect(prisma.userIntegration.update).toHaveBeenCalledWith({
      where: { id: "int-1" },
      data: { isActive: false },
    });
  });
});
