import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const decryptMock = vi.fn();
const encryptMock = vi.fn();

vi.mock("@/lib/auth/session", () => ({
  getSession: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    userIntegration: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

vi.mock("@/lib/crypto", () => ({
  encrypt: (...args: unknown[]) => encryptMock(...args),
  decrypt: (...args: unknown[]) => decryptMock(...args),
}));

describe("GET /api/integrations/mercadopago/oauth/callback", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
      process.env = {
      ...originalEnv,
      ENCRYPTION_KEY: Buffer.alloc(32).toString("base64"),
      MERCADOPAGO_OAUTH_CLIENT_ID: "client-id",
      MERCADOPAGO_OAUTH_CLIENT_SECRET: "",
      NEXT_PUBLIC_APP_URL: "https://rentalpro.test",
    };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("persists encrypted tokens and redirects to settings on success", async () => {
    const { getSession } = await import("@/lib/auth/session");
    const { prisma } = await import("@/lib/db/prisma");

    vi.mocked(getSession).mockResolvedValue({
      userId: "owner-1",
      role: "OWNER",
      plan: "PRO",
      email: "owner@test.com",
    });

    vi.mocked(prisma.userIntegration.findUnique).mockResolvedValue({
      userId: "owner-1",
      provider: "MERCADO_PAGO",
      metadata: { oauthState: "state-123", oauthCodeVerifier: "verifier-123" },
    } as any);

    encryptMock.mockImplementation((value: string) => `enc:${value}`);

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: "access-abc",
          refresh_token: "refresh-xyz",
          expires_in: 3600,
          user_id: 998877,
          public_key: "pub-key",
        }),
      })
    );

    const { GET } = await import("../route");
    const request = new Request(
      "https://rentalpro.test/api/integrations/mercadopago/oauth/callback?code=oauth-code&state=state-123"
    );

    const response = await GET(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/settings?mp=connected");
    expect(fetch).toHaveBeenCalledWith(
      "https://api.mercadopago.com/oauth/token",
      expect.objectContaining({
        headers: { "Content-Type": "application/json" },
        body: expect.stringContaining('"code_verifier":"verifier-123"'),
      })
    );
    expect(vi.mocked(fetch).mock.calls[0][1]!.body as string).not.toContain("client_secret");
    expect(prisma.userIntegration.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          accessToken: "enc:access-abc",
          isActive: true,
          metadata: expect.objectContaining({
            refreshTokenEncrypted: "enc:refresh-xyz",
            account: expect.objectContaining({ userId: 998877, publicKey: "pub-key" }),
          }),
        }),
      })
    );
  });

  it("rejects callback when state does not match", async () => {
    const { getSession } = await import("@/lib/auth/session");
    const { prisma } = await import("@/lib/db/prisma");

    vi.mocked(getSession).mockResolvedValue({
      userId: "owner-1",
      role: "OWNER",
      plan: "PRO",
      email: "owner@test.com",
    });

    vi.mocked(prisma.userIntegration.findUnique).mockResolvedValue({
      userId: "owner-1",
      provider: "MERCADO_PAGO",
      metadata: { oauthState: "expected-state", oauthCodeVerifier: "verifier-123" },
    } as any);

    const { GET } = await import("../route");
    const request = new Request(
      "https://rentalpro.test/api/integrations/mercadopago/oauth/callback?code=oauth-code&state=wrong-state"
    );

    const response = await GET(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/settings?mp=invalid_state");
    expect(prisma.userIntegration.upsert).not.toHaveBeenCalled();
  });

  it("redirects to config_error when client id is missing", async () => {
    const { getSession } = await import("@/lib/auth/session");
    const { prisma } = await import("@/lib/db/prisma");

    process.env.MERCADOPAGO_OAUTH_CLIENT_ID = "";
    vi.mocked(getSession).mockResolvedValue({
      userId: "owner-1",
      role: "OWNER",
      plan: "PRO",
      email: "owner@test.com",
    });

    vi.mocked(prisma.userIntegration.findUnique).mockResolvedValue({
      userId: "owner-1",
      provider: "MERCADO_PAGO",
      metadata: { oauthState: "state-123", oauthCodeVerifier: "verifier-123" },
    } as any);

    const { GET } = await import("../route");
    const request = new Request(
      "https://rentalpro.test/api/integrations/mercadopago/oauth/callback?code=oauth-code&state=state-123"
    );

    const response = await GET(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/settings?mp=config_error");
    expect(fetch).not.toHaveBeenCalled();
    expect(prisma.userIntegration.upsert).not.toHaveBeenCalled();
  });
});
