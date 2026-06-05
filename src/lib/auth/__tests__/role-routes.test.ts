import { describe, it, expect } from "vitest";
import { getDefaultPathForRole, isSuperAdmin, DEFAULT_PATH_BY_ROLE } from "@/lib/auth/role-routes";

describe("getDefaultPathForRole", () => {
  it("returns /admin for SUPER_ADMIN", () => {
    expect(getDefaultPathForRole("SUPER_ADMIN")).toBe("/admin");
  });

  it("returns /dashboard for OWNER", () => {
    expect(getDefaultPathForRole("OWNER")).toBe("/dashboard");
  });

  it("falls back to /dashboard for unknown roles", () => {
    expect(getDefaultPathForRole("GUEST")).toBe("/dashboard");
  });

  it("falls back to /dashboard for null/undefined", () => {
    expect(getDefaultPathForRole(null)).toBe("/dashboard");
    expect(getDefaultPathForRole(undefined)).toBe("/dashboard");
  });

  it("is consistent with the lookup table", () => {
    expect(getDefaultPathForRole("SUPER_ADMIN")).toBe(DEFAULT_PATH_BY_ROLE.SUPER_ADMIN);
    expect(getDefaultPathForRole("OWNER")).toBe(DEFAULT_PATH_BY_ROLE.OWNER);
  });
});

describe("isSuperAdmin", () => {
  it("returns true for SUPER_ADMIN", () => {
    expect(isSuperAdmin("SUPER_ADMIN")).toBe(true);
  });

  it("returns false for OWNER", () => {
    expect(isSuperAdmin("OWNER")).toBe(false);
  });

  it("returns false for null/undefined", () => {
    expect(isSuperAdmin(null)).toBe(false);
    expect(isSuperAdmin(undefined)).toBe(false);
  });
});
