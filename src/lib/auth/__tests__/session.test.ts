import { describe, it, expect, vi, beforeEach } from "vitest";

const { cookieStoreMock, jwtVerifyMock, findUniqueMock } = vi.hoisted(() => ({
  cookieStoreMock: {
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  },
  jwtVerifyMock: vi.fn(),
  findUniqueMock: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve(cookieStoreMock),
}));

vi.mock("jose", async () => {
  const actual = await vi.importActual<typeof import("jose")>("jose");
  return {
    ...actual,
    jwtVerify: (...args: unknown[]) => jwtVerifyMock(...args),
  };
});

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    userProfile: {
      findUnique: (...args: unknown[]) => findUniqueMock(...args),
    },
  },
}));

vi.mock("@/lib/auth/jwt-secret", () => ({
  JWT_SECRET: "test-secret",
}));

import { getSession, getSuperAdminSession } from "@/lib/auth/session";

beforeEach(() => {
  vi.clearAllMocks();
  cookieStoreMock.get.mockReturnValue(undefined);
});

function mockDbUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "user-1",
    role: "OWNER",
    plan: "FREE",
    email: "u@test.com",
    status: "ACTIVE",
    ...overrides,
  };
}

describe("getSession", () => {
  it("returns null when no session cookie is present", async () => {
    cookieStoreMock.get.mockReturnValue(undefined);

    const result = await getSession();

    expect(result).toBeNull();
    expect(jwtVerifyMock).not.toHaveBeenCalled();
    expect(findUniqueMock).not.toHaveBeenCalled();
  });

  it("returns null when JWT verification throws", async () => {
    cookieStoreMock.get.mockReturnValue({ value: "bad-token" });
    jwtVerifyMock.mockRejectedValue(new Error("invalid"));

    const result = await getSession();

    expect(result).toBeNull();
  });

  it("returns null when payload has no userId", async () => {
    cookieStoreMock.get.mockReturnValue({ value: "token" });
    jwtVerifyMock.mockResolvedValue({ payload: {} });

    const result = await getSession();

    expect(result).toBeNull();
    expect(findUniqueMock).not.toHaveBeenCalled();
  });

  it("returns null when user no longer exists in DB", async () => {
    cookieStoreMock.get.mockReturnValue({ value: "token" });
    jwtVerifyMock.mockResolvedValue({ payload: { userId: "user-1" } });
    findUniqueMock.mockResolvedValue(null);

    const result = await getSession();

    expect(result).toBeNull();
  });

  it("returns null when user is SUSPENDED", async () => {
    cookieStoreMock.get.mockReturnValue({ value: "token" });
    jwtVerifyMock.mockResolvedValue({ payload: { userId: "user-1" } });
    findUniqueMock.mockResolvedValue(mockDbUser({ status: "SUSPENDED" }));

    const result = await getSession();

    expect(result).toBeNull();
  });

  it("returns null when user is CANCELLED", async () => {
    cookieStoreMock.get.mockReturnValue({ value: "token" });
    jwtVerifyMock.mockResolvedValue({ payload: { userId: "user-1" } });
    findUniqueMock.mockResolvedValue(mockDbUser({ status: "CANCELLED" }));

    const result = await getSession();

    expect(result).toBeNull();
  });

  it("returns SessionUser when user is ACTIVE", async () => {
    cookieStoreMock.get.mockReturnValue({ value: "token" });
    jwtVerifyMock.mockResolvedValue({ payload: { userId: "user-1" } });
    findUniqueMock.mockResolvedValue(
      mockDbUser({ role: "OWNER", plan: "PRO", email: "owner@test.com" })
    );

    const result = await getSession();

    expect(result).toEqual({
      userId: "user-1",
      role: "OWNER",
      plan: "PRO",
      email: "owner@test.com",
      status: "ACTIVE",
    });
  });
});

describe("getSuperAdminSession", () => {
  it("returns null when there is no session", async () => {
    cookieStoreMock.get.mockReturnValue(undefined);

    const result = await getSuperAdminSession();

    expect(result).toBeNull();
  });

  it("returns null when session role is OWNER", async () => {
    cookieStoreMock.get.mockReturnValue({ value: "token" });
    jwtVerifyMock.mockResolvedValue({ payload: { userId: "user-1" } });
    findUniqueMock.mockResolvedValue(mockDbUser({ role: "OWNER" }));

    const result = await getSuperAdminSession();

    expect(result).toBeNull();
  });

  it("returns SessionUser when session role is SUPER_ADMIN", async () => {
    cookieStoreMock.get.mockReturnValue({ value: "token" });
    jwtVerifyMock.mockResolvedValue({ payload: { userId: "admin-1" } });
    findUniqueMock.mockResolvedValue(
      mockDbUser({ id: "admin-1", role: "SUPER_ADMIN", email: "admin@test.com" })
    );

    const result = await getSuperAdminSession();

    expect(result).toEqual({
      userId: "admin-1",
      role: "SUPER_ADMIN",
      plan: "FREE",
      email: "admin@test.com",
      status: "ACTIVE",
    });
  });

  it("does not require an extra DB query for the role check", async () => {
    cookieStoreMock.get.mockReturnValue({ value: "token" });
    jwtVerifyMock.mockResolvedValue({ payload: { userId: "admin-1" } });
    findUniqueMock.mockResolvedValue(mockDbUser({ role: "SUPER_ADMIN" }));

    await getSuperAdminSession();

    // Solo UNA query: la que getSession ya hace para hidratar la sesión.
    expect(findUniqueMock).toHaveBeenCalledTimes(1);
  });
});
