/**
 * Auth seam — módulo de sesión canónico.
 *
 * Funciones puras (sin `"use server"`) para resolver la sesión activa.
 * Usar en server components, server actions y route handlers.
 *
 * Para guards que redirigen (layouts), usar `lib/auth/guards.ts`.
 */

import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "@/lib/db/prisma";
import { isSuperAdmin } from "@/lib/auth/role-routes";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "your-secret-key");

export type SessionUser = {
  userId: string;
  role: string;
  plan: string | null;
  email: string;
  status?: string;
};

/**
 * Resuelve la sesión activa desde la cookie `session`.
 *
 * Retorna `null` si:
 * - No hay cookie
 * - El JWT es inválido o expiró
 * - El usuario ya no existe en DB
 * - El usuario está `SUSPENDED` o `CANCELLED`
 */
export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;

  if (!token) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const userId = (payload as { userId?: string }).userId;

    if (!userId) {
      return null;
    }

    const user = await prisma.userProfile.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        plan: true,
        email: true,
        status: true,
      },
    });

    if (!user || user.status === "SUSPENDED" || user.status === "CANCELLED") {
      return null;
    }

    return {
      userId: user.id,
      role: user.role,
      plan: user.plan,
      email: user.email,
      status: user.status,
    };
  } catch {
    return null;
  }
}

/**
 * Helper para server actions: retorna la sesión solo si el usuario es
 * `SUPER_ADMIN`, o `null` en cualquier otro caso (sin redirigir).
 *
 * Para guards de layout que redirigen, usar `requireSuperAdmin` de
 * `lib/auth/guards.ts`.
 *
 * Reemplaza los duplicados históricos:
 * - `assertSuperAdmin` (admin-support.ts) — silent null
 * - `isSuperAdmin` (super-admin.ts) — boolean wrapper sobre lo mismo
 */
export async function getSuperAdminSession(): Promise<SessionUser | null> {
  const session = await getSession();
  if (!session) return null;
  return isSuperAdmin(session.role) ? session : null;
}

// Re-exported for advanced use cases (e.g. login/register actions).
export { SignJWT };
