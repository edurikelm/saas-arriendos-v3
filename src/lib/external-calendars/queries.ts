/**
 * Queries Prisma de ExternalCalendar centralizadas como seam canónico.
 *
 * Patrón: helpers puros con adapter opcional para participar en $transaction.
 * Si se omite, usa prisma global.
 *
 * Ubicación nueva — antes estas queries vivían inline en lib/actions/external-calendars.ts
 * (acciones con 'use server'). Este seam es para queries que NO necesitan validar
 * sesión (las consume el Server Component padre que ya tiene requireOwner).
 */

import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";

export type QueryAdapter = Prisma.TransactionClient | typeof prisma;

/**
 * Cuenta los Calendarios Externos activos de un owner.
 *
 * @param userId ID del owner
 * @param adapter Cliente Prisma (global o tx)
 * @returns número de calendarios con isActive=true
 */
export async function countActiveExternalCalendars(
  userId: string,
  adapter: QueryAdapter = prisma,
): Promise<number> {
  return adapter.externalCalendar.count({
    where: { userId, isActive: true },
  });
}
