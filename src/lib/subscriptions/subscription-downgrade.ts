/**
 * Soft-stop y restore de recursos iCal acoplados al ciclo de vida del plan PRO.
 *
 * - `softStopExternalCalendars`: marca inactivos Calendarios Externos y
 *   Bloqueos Externos cuando expira el PRO (issue #220).
 * - `restoreExternalCalendars`: restaura esos recursos a estado activo cuando
 *   el owner reactiva PRO (issue #224).
 *
 * El snapshot persistido en SubscriptionEvent.payload.downgradeSnapshot es el
 * contrato entre ambos helpers.
 */

import { prisma } from "@/lib/db/prisma";
import type { QueryAdapter, DowngradeSnapshot } from "@/lib/subscriptions/queries";

/**
 * Soft-stop todos los recursos iCal de un owner.
 *
 * - Marca `ExternalCalendar.isActive = false` para los calendarios activos del owner.
 * - Marca `ExternalChannelBlock.status = INACTIVE` para los bloques activos del owner.
 * - Retorna snapshot `{ externalCalendarIds, externalBlockIds }` con los IDs afectados.
 *
 * Idempotente: re-llamar no rompe (updateMany con filtros `isActive:true`/`status:ACTIVE`
 * retorna `count=0` si ya están inactivos).
 *
 * Acepta `QueryAdapter` para participar en `$transaction` del caller. NO abre tx propia.
 *
 * Para restauración (#224): el snapshot persiste en `SubscriptionEvent.payload` —
 * usar el del ÚLTIMO `expired`/`expired_check` que precede al `authorized` actual.
 */
export async function softStopExternalCalendars(
  userId: string,
  adapter: QueryAdapter = prisma,
): Promise<DowngradeSnapshot> {
  // Usar updateManyAndReturn (Prisma 5.10+, disponible en 7.0) — 1 sola query por tabla.
  // El cast es necesario porque TypeScript no infiere que Prisma.TransactionClient
  // expone `externalCalendar` y `externalChannelBlock` (los seams canónicos del repo
  // — `queries.ts` — solo declaran explícitamente subscription/subscriptionEvent/
  // userProfile/adminActionLog en el tipo QueryAdapter).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tx = adapter as any;

  const calendars = await tx.externalCalendar.updateManyAndReturn({
    where: { userId, isActive: true },
    data: { isActive: false },
    select: { id: true },
  });

  const blocks = await tx.externalChannelBlock.updateManyAndReturn({
    where: { status: "ACTIVE", property: { userId } },
    data: { status: "INACTIVE" },
    select: { id: true },
  });

  return {
    externalCalendarIds: calendars.map((c: { id: string }) => c.id),
    externalBlockIds: blocks.map((b: { id: string }) => b.id),
  };
}

export type RestoreReport = {
  restoredCalendarIds: string[];
  restoredBlockIds: string[];
};

/**
 * Restaura los recursos iCal del snapshot a estado activo.
 *
 * - Marca `ExternalCalendar.isActive = true` para los calendarios inactivos del snapshot.
 * - Marca `ExternalChannelBlock.status = ACTIVE` para los bloques inactivos del snapshot.
 * - Retorna `RestoreReport` con los IDs efectivamente restaurados (excluye huérfanos).
 *
 * Silent skip es intencional:
 * - IDs eliminados por el owner mientras estaba FREE: la fila no existe, se ignora.
 * - IDs ya activos (race con cron): `WHERE isActive:false` filtra, no-op.
 * - IDs de OTRO owner (defense in depth): `userId` filtra, no se tocan.
 *
 * Si el owner modificó manualmente un calendario durante FREE (no soportado
 * por UI pero posible vía DB directa), el restore revierte ese cambio.
 * Decisión intencional: la suscripción PRO restaura todos los recursos PRO.
 *
 * Acepta `QueryAdapter` para participar en `$transaction` del caller.
 */
export async function restoreExternalCalendars(
  userId: string,
  snapshot: DowngradeSnapshot,
  adapter: QueryAdapter = prisma,
): Promise<RestoreReport> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tx = adapter as any;

  const calendars = await tx.externalCalendar.updateManyAndReturn({
    where: {
      userId,
      id: { in: snapshot.externalCalendarIds },
      isActive: false, // idempotente + respeta cambios manuales como no-op
    },
    data: { isActive: true },
    select: { id: true },
  });

  const blocks = await tx.externalChannelBlock.updateManyAndReturn({
    where: {
      status: "INACTIVE",
      id: { in: snapshot.externalBlockIds },
      property: { userId }, // defense in depth
    },
    data: { status: "ACTIVE" },
    select: { id: true },
  });

  return {
    restoredCalendarIds: calendars.map((c: { id: string }) => c.id),
    restoredBlockIds: blocks.map((b: { id: string }) => b.id),
  };
}
