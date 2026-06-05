import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  jwtVerify: vi.fn(),
}));

vi.mock("jose", () => ({
  jwtVerify: mocks.jwtVerify,
}));

type ProxyFn = (request: NextRequest) => Promise<Response>;
type ProxyModule = { proxy: ProxyFn };

async function importProxy(): Promise<ProxyModule> {
  return (await import("@/proxy")) as unknown as ProxyModule;
}

function buildRequest(pathname: string, cookieValue?: string): NextRequest {
  const url = `https://example.test${pathname}`;
  const headers = new Headers();
  if (cookieValue) {
    headers.set("cookie", `session=${cookieValue}`);
  }
  return {
    nextUrl: { pathname, origin: "https://example.test", href: url },
    url,
    cookies: {
      get: (name: string) => (name === "session" && cookieValue ? { name, value: cookieValue } : undefined),
    },
    headers,
  } as unknown as NextRequest;
}

function getLocationHeader(response: Response): string | null {
  return response.headers.get("location");
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

describe("proxy auth gate", () => {
  it("passes through unprotected paths without checking the cookie", async () => {
    const { proxy } = await importProxy();
    const response = await proxy(buildRequest("/"));

    expect(response.status).toBe(200);
    expect(getLocationHeader(response)).toBeNull();
  });

  it("redirects protected owner paths to /login when no cookie is present", async () => {
    const { proxy } = await importProxy();
    const response = await proxy(buildRequest("/dashboard"));

    expect(response.status).toBe(307);
    expect(getLocationHeader(response)).toBe("https://example.test/login");
  });

  it("redirects /admin to /login when no cookie is present", async () => {
    const { proxy } = await importProxy();
    const response = await proxy(buildRequest("/admin"));

    expect(response.status).toBe(307);
    expect(getLocationHeader(response)).toBe("https://example.test/login");
  });

  it("redirects to /login when the cookie is invalid", async () => {
    mocks.jwtVerify.mockRejectedValue(new Error("bad-token"));
    const { proxy } = await importProxy();
    const response = await proxy(buildRequest("/dashboard", "bad"));

    expect(mocks.jwtVerify).toHaveBeenCalled();
    expect(getLocationHeader(response)).toBe("https://example.test/login");
  });

  it("redirects to /login when the JWT has no userId", async () => {
    mocks.jwtVerify.mockResolvedValue({ payload: {} } as any);
    const { proxy } = await importProxy();
    const response = await proxy(buildRequest("/dashboard", "tok"));

    expect(getLocationHeader(response)).toBe("https://example.test/login");
  });

  it("lets requests with a valid JWT pass through without deciding the role", async () => {
    mocks.jwtVerify.mockResolvedValue({ payload: { userId: "user-1", role: "OWNER" } } as any);
    const { proxy } = await importProxy();
    const response = await proxy(buildRequest("/dashboard", "tok"));

    expect(response.status).toBe(200);
    expect(getLocationHeader(response)).toBeNull();
  });

  it("does not infer role from the JWT to redirect on /admin", async () => {
    mocks.jwtVerify.mockResolvedValue({ payload: { userId: "user-1", role: "OWNER" } } as any);
    const { proxy } = await importProxy();
    const response = await proxy(buildRequest("/admin", "tok"));

    expect(getLocationHeader(response)).toBeNull();
  });

  it("does not infer role from the JWT to redirect on owner paths", async () => {
    mocks.jwtVerify.mockResolvedValue({ payload: { userId: "user-1", role: "SUPER_ADMIN" } } as any);
    const { proxy } = await importProxy();
    const response = await proxy(buildRequest("/dashboard", "tok"));

    expect(getLocationHeader(response)).toBeNull();
  });
});
