import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  jwtVerify: vi.fn(),
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

describe("requireOwner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.cookies.mockResolvedValue({
      get: vi.fn(() => ({ value: "session-token" })),
      set: vi.fn(),
      delete: vi.fn(),
    });
    mocks.jwtVerify.mockResolvedValue({ payload: { userId: "user-1" } } as any);
  });

  it("returns the session for OWNER users", async () => {
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(prisma.userProfile.findUnique).mockResolvedValue({
      id: "user-1",
      role: "OWNER",
      plan: "FREE",
      email: "owner@test.com",
      status: "ACTIVE",
    } as any);

    const { requireOwner } = await import("@/lib/actions/auth");
    const session = await requireOwner();

    expect(session.role).toBe("OWNER");
    expect(session.userId).toBe("user-1");
  });

  it("redirects SUPER_ADMIN to /admin", async () => {
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(prisma.userProfile.findUnique).mockResolvedValue({
      id: "user-1",
      role: "SUPER_ADMIN",
      plan: null,
      email: "admin@test.com",
      status: "ACTIVE",
    } as any);

    const { requireOwner } = await import("@/lib/actions/auth");
    const { redirect } = await import("next/navigation");

    await expect(requireOwner()).rejects.toThrow("REDIRECT:/admin");
    expect(redirect).toHaveBeenCalledWith("/admin");
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
