import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: mocks.cookies,
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

vi.mock("jose", () => ({
  SignJWT: vi.fn(),
}));

vi.mock("bcryptjs", () => ({
  hash: vi.fn(async (pw: string) => `hashed:${pw}`),
  compare: vi.fn(),
}));

vi.mock("@/lib/email/send-password-reset", () => ({
  sendPasswordResetEmail: mocks.sendPasswordResetEmail,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    userProfile: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    passwordResetToken: {
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

const ORIGINAL_ENV = { ...process.env };

describe("requestPasswordResetAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...ORIGINAL_ENV, NEXT_PUBLIC_APP_URL: "http://localhost:3000" };
  });

  it("retorna success sin crear token cuando el email no existe (anti-enumeración)", async () => {
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(prisma.userProfile.findUnique).mockResolvedValue(null);

    const { requestPasswordResetAction } = await import("../auth");
    const result = await requestPasswordResetAction({ email: "noexiste@test.com" });

    expect(result).toEqual({ success: true });
    expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
    expect(mocks.sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it("retorna success sin crear token cuando la cuenta está SUSPENDED", async () => {
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(prisma.userProfile.findUnique).mockResolvedValue({
      id: "user-1",
      email: "suspended@test.com",
      status: "SUSPENDED",
    } as any);

    const { requestPasswordResetAction } = await import("../auth");
    const result = await requestPasswordResetAction({ email: "suspended@test.com" });

    expect(result).toEqual({ success: true });
    expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
  });

  it("retorna success sin crear token cuando la cuenta está CANCELLED", async () => {
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(prisma.userProfile.findUnique).mockResolvedValue({
      id: "user-1",
      email: "cancelled@test.com",
      status: "CANCELLED",
    } as any);

    const { requestPasswordResetAction } = await import("../auth");
    const result = await requestPasswordResetAction({ email: "cancelled@test.com" });

    expect(result).toEqual({ success: true });
    expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
  });

  it("invalida tokens previos y crea uno nuevo cuando el usuario es ACTIVE", async () => {
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(prisma.userProfile.findUnique).mockResolvedValue({
      id: "user-1",
      email: "active@test.com",
      status: "ACTIVE",
    } as any);
    vi.mocked(prisma.passwordResetToken.updateMany).mockResolvedValue({ count: 1 } as any);
    vi.mocked(prisma.passwordResetToken.create).mockResolvedValue({ id: "tok-1" } as any);
    mocks.sendPasswordResetEmail.mockResolvedValue({ sent: true, emailId: "em-1" });

    const { requestPasswordResetAction } = await import("../auth");
    const result = await requestPasswordResetAction({ email: "active@test.com" });

    expect(result).toEqual({ success: true });
    expect(prisma.passwordResetToken.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-1", usedAt: null },
      data: { expiresAt: expect.any(Date) },
    });
    expect(prisma.passwordResetToken.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        tokenHash: expect.stringMatching(/^[A-Za-z0-9_-]{42,44}$/),
        expiresAt: expect.any(Date),
      },
    });
    expect(mocks.sendPasswordResetEmail).toHaveBeenCalledWith({
      to: "active@test.com",
      resetUrl: expect.stringMatching(/^http:\/\/localhost:3000\/reset-password\?token=[A-Za-z0-9_-]+$/),
    });
  });

  it("expira el token nuevo a 1 hora", async () => {
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(prisma.userProfile.findUnique).mockResolvedValue({
      id: "user-1",
      email: "active@test.com",
      status: "ACTIVE",
    } as any);
    vi.mocked(prisma.passwordResetToken.updateMany).mockResolvedValue({ count: 0 } as any);
    vi.mocked(prisma.passwordResetToken.create).mockResolvedValue({ id: "tok-1" } as any);
    mocks.sendPasswordResetEmail.mockResolvedValue({ sent: true, emailId: "em-1" });

    const before = Date.now();
    const { requestPasswordResetAction } = await import("../auth");
    await requestPasswordResetAction({ email: "active@test.com" });
    const after = Date.now();

    const createCall = vi.mocked(prisma.passwordResetToken.create).mock.calls[0]?.[0];
    const expiresAt = (createCall as any).data.expiresAt as Date;
    const expiresMs = expiresAt.getTime();

    expect(expiresMs).toBeGreaterThanOrEqual(before + 60 * 60 * 1000 - 1000);
    expect(expiresMs).toBeLessThanOrEqual(after + 60 * 60 * 1000 + 1000);
  });

  it("expone devResetUrl cuando el email no se pudo enviar (dev sin Resend)", async () => {
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(prisma.userProfile.findUnique).mockResolvedValue({
      id: "user-1",
      email: "active@test.com",
      status: "ACTIVE",
    } as any);
    vi.mocked(prisma.passwordResetToken.updateMany).mockResolvedValue({ count: 0 } as any);
    vi.mocked(prisma.passwordResetToken.create).mockResolvedValue({ id: "tok-1" } as any);
    mocks.sendPasswordResetEmail.mockResolvedValue({ sent: false, reason: "no-api-key" });

    const { requestPasswordResetAction } = await import("../auth");
    const result = await requestPasswordResetAction({ email: "active@test.com" });

    expect(result.success).toBe(true);
    expect((result as any).devResetUrl).toMatch(
      /^http:\/\/localhost:3000\/reset-password\?token=[A-Za-z0-9_-]+$/,
    );
  });

  it("rechaza email inválido por Zod", async () => {
    const { requestPasswordResetAction } = await import("../auth");
    await expect(
      requestPasswordResetAction({ email: "no-es-email" }),
    ).rejects.toThrow();
  });
});

describe("validatePasswordResetTokenAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna invalid-format para token con formato inválido", async () => {
    const { prisma } = await import("@/lib/db/prisma");

    const { validatePasswordResetTokenAction } = await import("../auth");
    const result = await validatePasswordResetTokenAction("abc");

    expect(result).toEqual({ valid: false, reason: "invalid-format" });
    expect(prisma.passwordResetToken.findUnique).not.toHaveBeenCalled();
  });

  it("retorna not-found cuando el hash no existe en DB", async () => {
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(prisma.passwordResetToken.findUnique).mockResolvedValue(null);

    const { validatePasswordResetTokenAction } = await import("../auth");
    const result = await validatePasswordResetTokenAction("a".repeat(43));

    expect(result).toEqual({ valid: false, reason: "not-found" });
  });

  it("retorna used cuando el token ya fue usado", async () => {
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(prisma.passwordResetToken.findUnique).mockResolvedValue({
      id: "tok-1",
      tokenHash: "hash",
      userId: "user-1",
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      usedAt: new Date(),
      createdAt: new Date(),
    });

    const { validatePasswordResetTokenAction } = await import("../auth");
    const result = await validatePasswordResetTokenAction("a".repeat(43));

    expect(result).toEqual({ valid: false, reason: "used" });
  });

  it("retorna expired cuando el token está vencido", async () => {
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(prisma.passwordResetToken.findUnique).mockResolvedValue({
      id: "tok-1",
      tokenHash: "hash",
      userId: "user-1",
      expiresAt: new Date(Date.now() - 1000),
      usedAt: null,
      createdAt: new Date(),
    });

    const { validatePasswordResetTokenAction } = await import("../auth");
    const result = await validatePasswordResetTokenAction("a".repeat(43));

    expect(result).toEqual({ valid: false, reason: "expired" });
  });

  it("retorna valid:true para token fresco", async () => {
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(prisma.passwordResetToken.findUnique).mockResolvedValue({
      id: "tok-1",
      tokenHash: "hash",
      userId: "user-1",
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      usedAt: null,
      createdAt: new Date(),
    });

    const { validatePasswordResetTokenAction } = await import("../auth");
    const result = await validatePasswordResetTokenAction("a".repeat(43));

    expect(result).toEqual({ valid: true });
  });
});

describe("resetPasswordAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rechaza token con formato inválido", async () => {
    const { prisma } = await import("@/lib/db/prisma");

    const { resetPasswordAction } = await import("../auth");
    const result = await resetPasswordAction({ token: "abc", password: "NewPass123" });

    expect(result).toEqual({ error: "Token inválido" });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rechaza password que no cumple requisitos", async () => {
    const { resetPasswordAction } = await import("../auth");
    await expect(
      resetPasswordAction({ token: "a".repeat(43), password: "short" }),
    ).rejects.toThrow();
  });

  it("rechaza token expirado", async () => {
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(prisma.$transaction).mockImplementation(async (fn) => {
      const tx = {
        passwordResetToken: {
          findUnique: vi.fn().mockResolvedValue({
            id: "tok-1",
            userId: "user-1",
            expiresAt: new Date(Date.now() - 1000),
            usedAt: null,
          }),
        },
      };
      return (fn as any)(tx);
    });

    const { resetPasswordAction } = await import("../auth");
    const result = await resetPasswordAction({ token: "a".repeat(43), password: "NewPass123" });

    expect(result).toEqual({ error: "El enlace de recuperación es inválido o ha expirado" });
  });

  it("rechaza token ya usado", async () => {
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(prisma.$transaction).mockImplementation(async (fn) => {
      const tx = {
        passwordResetToken: {
          findUnique: vi.fn().mockResolvedValue({
            id: "tok-1",
            userId: "user-1",
            expiresAt: new Date(Date.now() + 60 * 60 * 1000),
            usedAt: new Date(),
          }),
        },
      };
      return (fn as any)(tx);
    });

    const { resetPasswordAction } = await import("../auth");
    const result = await resetPasswordAction({ token: "a".repeat(43), password: "NewPass123" });

    expect(result).toEqual({ error: "El enlace de recuperación es inválido o ha expirado" });
  });

  it("rechaza token no encontrado", async () => {
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(prisma.$transaction).mockImplementation(async (fn) => {
      const tx = {
        passwordResetToken: {
          findUnique: vi.fn().mockResolvedValue(null),
        },
      };
      return (fn as any)(tx);
    });

    const { resetPasswordAction } = await import("../auth");
    const result = await resetPasswordAction({ token: "a".repeat(43), password: "NewPass123" });

    expect(result).toEqual({ error: "El enlace de recuperación es inválido o ha expirado" });
  });

  it("actualiza el password y marca el token como usado en una transacción", async () => {
    const { prisma } = await import("@/lib/db/prisma");
    const updateToken = vi.fn().mockResolvedValue({ id: "tok-1" });
    const updateUser = vi.fn().mockResolvedValue({ id: "user-1" });

    vi.mocked(prisma.$transaction).mockImplementation(async (fn) => {
      const tx = {
        passwordResetToken: {
          findUnique: vi.fn().mockResolvedValue({
            id: "tok-1",
            userId: "user-1",
            expiresAt: new Date(Date.now() + 60 * 60 * 1000),
            usedAt: null,
          }),
          update: updateToken,
        },
        userProfile: {
          update: updateUser,
        },
      };
      return (fn as any)(tx);
    });

    const { resetPasswordAction } = await import("../auth");
    const result = await resetPasswordAction({ token: "a".repeat(43), password: "NewPass123" });

    expect(result).toEqual({ success: true });
    expect(updateToken).toHaveBeenCalledWith({
      where: { id: "tok-1" },
      data: { usedAt: expect.any(Date) },
    });
    expect(updateUser).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { password: "hashed:NewPass123" },
    });
  });
});
