import { describe, it, expect, vi, beforeEach } from "vitest";

const { getSessionMock, redirectMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  redirectMock: vi.fn((url: string) => {
    throw new Error(`__REDIRECT__:${url}`);
  }),
}));

vi.mock("@/lib/auth/session", () => ({
  getSession: getSessionMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

import { requireAuth, requireOwner, requireSuperAdmin } from "@/lib/auth/guards";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("requireAuth", () => {
  it("redirects to /login when there is no session", async () => {
    getSessionMock.mockResolvedValue(null);

    await expect(requireAuth()).rejects.toThrow("__REDIRECT__:/login");
    expect(redirectMock).toHaveBeenCalledWith("/login");
  });

  it("returns SessionUser when session is valid", async () => {
    const session = { userId: "u-1", role: "OWNER", plan: "PRO", email: "u@t.com" };
    getSessionMock.mockResolvedValue(session);

    const result = await requireAuth();

    expect(result).toEqual(session);
  });
});

describe("requireOwner", () => {
  it("redirects to /login when there is no session", async () => {
    getSessionMock.mockResolvedValue(null);

    await expect(requireOwner()).rejects.toThrow("__REDIRECT__:/login");
  });

  it("redirects to /admin when role is SUPER_ADMIN", async () => {
    getSessionMock.mockResolvedValue({
      userId: "a-1",
      role: "SUPER_ADMIN",
      plan: null,
      email: "a@t.com",
    });

    await expect(requireOwner()).rejects.toThrow("__REDIRECT__:/admin");
  });

  it("returns SessionUser when role is OWNER", async () => {
    const session = { userId: "u-1", role: "OWNER", plan: "FREE", email: "u@t.com" };
    getSessionMock.mockResolvedValue(session);

    const result = await requireOwner();

    expect(result).toEqual(session);
  });
});

describe("requireSuperAdmin", () => {
  it("redirects to /login when there is no session", async () => {
    getSessionMock.mockResolvedValue(null);

    await expect(requireSuperAdmin()).rejects.toThrow("__REDIRECT__:/login");
  });

  it("redirects to /dashboard when role is OWNER", async () => {
    getSessionMock.mockResolvedValue({
      userId: "u-1",
      role: "OWNER",
      plan: "PRO",
      email: "u@t.com",
    });

    await expect(requireSuperAdmin()).rejects.toThrow("__REDIRECT__:/dashboard");
  });

  it("returns SessionUser when role is SUPER_ADMIN", async () => {
    const session = {
      userId: "a-1",
      role: "SUPER_ADMIN",
      plan: null,
      email: "a@t.com",
    };
    getSessionMock.mockResolvedValue(session);

    const result = await requireSuperAdmin();

    expect(result).toEqual(session);
  });
});
