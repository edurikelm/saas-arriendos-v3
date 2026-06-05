export type AppRole = "SUPER_ADMIN" | "OWNER";

export const DEFAULT_PATH_BY_ROLE: Record<AppRole, string> = {
  SUPER_ADMIN: "/admin",
  OWNER: "/dashboard",
};

export function getDefaultPathForRole(role: string | null | undefined): string {
  if (role === "SUPER_ADMIN") return DEFAULT_PATH_BY_ROLE.SUPER_ADMIN;
  return DEFAULT_PATH_BY_ROLE.OWNER;
}

export function isSuperAdmin(role: string | null | undefined): boolean {
  return role === "SUPER_ADMIN";
}
