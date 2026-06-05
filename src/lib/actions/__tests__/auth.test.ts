import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  jwtVerify: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: mocks.cookies,
}));

vi.mock("jose", () => ({
  jwtVerify: mocks.jwtVerify,
  SignJWT: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    userProfile: {
      findUnique: vi.fn(),
    },
  },
}));

describe("getSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.cookies.mockResolvedValue({
      get: vi.fn(() => ({ value: "session-token" })),
      set: vi.fn(),
      delete: vi.fn(),
    });
    mocks.jwtVerify.mockResolvedValue({ payload: { userId: "user-1" } } as any);
  });

  it("returns null for suspended users", async () => {
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(prisma.userProfile.findUnique).mockResolvedValue({
      id: "user-1",
      role: "OWNER",
      plan: "FREE",
      email: "suspended@test.com",
      status: "SUSPENDED",
    } as any);

    const { getSession } = await import("@/lib/actions/auth");
    await expect(getSession()).resolves.toBeNull();
  });

  it("returns null for cancelled users", async () => {
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(prisma.userProfile.findUnique).mockResolvedValue({
      id: "user-1",
      role: "OWNER",
      plan: "FREE",
      email: "cancelled@test.com",
      status: "CANCELLED",
    } as any);

    const { getSession } = await import("@/lib/actions/auth");
    await expect(getSession()).resolves.toBeNull();
  });

  it("returns the current active session from the database", async () => {
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(prisma.userProfile.findUnique).mockResolvedValue({
      id: "user-1",
      role: "OWNER",
      plan: "PRO",
      email: "active@test.com",
      status: "ACTIVE",
    } as any);

    const { getSession } = await import("@/lib/actions/auth");
    const session = await getSession();

    expect(session).toEqual({
      userId: "user-1",
      role: "OWNER",
      plan: "PRO",
      email: "active@test.com",
      status: "ACTIVE",
    });
  });
});

describe("loginAction", () => {
  it("blocks suspended users", async () => {
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(prisma.userProfile.findUnique).mockResolvedValue({
      id: "user-1",
      email: "suspended@test.com",
      password: "hashed",
      role: "OWNER",
      plan: "FREE",
      status: "SUSPENDED",
    } as any);

    const { loginAction } = await import("@/lib/actions/auth");
    await expect(loginAction({ email: "suspended@test.com", password: "password123" })).resolves.toEqual({
      error: "Cuenta suspendida",
    });
  });

  it("blocks cancelled users", async () => {
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(prisma.userProfile.findUnique).mockResolvedValue({
      id: "user-1",
      email: "cancelled@test.com",
      password: "hashed",
      role: "OWNER",
      plan: "FREE",
      status: "CANCELLED",
    } as any);

    const { loginAction } = await import("@/lib/actions/auth");
    await expect(loginAction({ email: "cancelled@test.com", password: "password123" })).resolves.toEqual({
      error: "Cuenta cancelada",
    });
  });
});
