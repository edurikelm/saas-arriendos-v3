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

export type DowngradeSnapshot = {
  externalCalendarIds: string[];
  externalBlockIds: string[];
};

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

/**
 * Soft-stop de recursos iCal asociados a UNA propiedad específica.
 *
 * - Marca `ExternalCalendar.isActive = false` para calendarios activos de esta propiedad
 * - Marca `ExternalChannelBlock.status = INACTIVE` para bloques activos de esta propiedad
 * - Retorna snapshot `{ externalCalendarIds, externalBlockIds }` con los IDs afectados
 *
 * Idempotente. Reusa el mismo shape del snapshot que `softStopExternalCalendars` (#220)
 * por consistencia.
 *
 * Usado por `deleteProperty` (lib/actions/properties.ts:194) para evitar FK error
 * cuando se elimina una propiedad con calendarios asociados.
 *
 * NO usa el helper de #220 (que opera por userId) porque no queremos pausar calendarios
 * de otras propiedades del mismo owner.
 */
export async function softStopExternalCalendarsForProperty(
  propertyId: string,
  adapter: QueryAdapter = prisma,
): Promise<DowngradeSnapshot> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tx = adapter as any;

  const calendars = await tx.externalCalendar.updateManyAndReturn({
    where: { propertyId, isActive: true },
    data: { isActive: false },
    select: { id: true },
  });

  const blocks = await tx.externalChannelBlock.updateManyAndReturn({
    where: { status: "ACTIVE", propertyId },
    data: { status: "INACTIVE" },
    select: { id: true },
  });

  return {
    externalCalendarIds: calendars.map((c: { id: string }) => c.id),
    externalBlockIds: blocks.map((b: { id: string }) => b.id),
  };
}
