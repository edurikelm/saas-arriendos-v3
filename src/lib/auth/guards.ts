/**
 * Auth seam — guards de layout.
 *
 * Funciones puras (sin `"use server"`) que resuelven la sesión activa y
 * redirigen si no cumple el rol. Usar en `layout.tsx` y `page.tsx` de
 * server components.
 *
 * Para server actions que no deben redirigir, usar `getSuperAdminSession`
 * de `lib/auth/session.ts`.
 */

import { redirect } from "next/navigation";
import { getSession, type SessionUser } from "@/lib/auth/session";
import { isSuperAdmin } from "@/lib/auth/role-routes";

/**
 * Guard para cualquier usuario autenticado. Redirige a `/login` si no hay
 * sesión válida.
 */
export async function requireAuth(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  return session;
}

/**
 * Guard para `OWNER`. Redirige:
 * - A `/login` si no hay sesión
 * - A `/admin` si la sesión es de `SUPER_ADMIN` (los admins usan otra consola)
 */
export async function requireOwner(): Promise<SessionUser> {
  const session = await requireAuth();
  if (isSuperAdmin(session.role)) {
    redirect("/admin");
  }
  return session;
}

/**
 * Guard para `SUPER_ADMIN`. Redirige:
 * - A `/login` si no hay sesión
 * - A `/dashboard` si la sesión no es de super admin
 */
export async function requireSuperAdmin(): Promise<SessionUser> {
  const session = await requireAuth();
  if (!isSuperAdmin(session.role)) {
    redirect("/dashboard");
  }
  return session;
}
