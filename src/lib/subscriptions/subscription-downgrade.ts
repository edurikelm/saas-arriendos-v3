/**
 * Soft-stop de recursos iCal cuando un owner PRO hace downgrade a FREE.
 *
 * Cuando expira el período pagado de un owner PRO, sus Calendarios Externos
 * y Bloqueos de Canal Externo quedan "zombis" (isActive=true / ACTIVE) y
 * siguen contando para disponibilidad aunque el plan FREE no pueda gestionarlos.
 *
 * Este módulo marca esos recursos como inactivos de forma idempotente y
 * retorna un snapshot con los IDs afectados para que #224 pueda restaurar
 * si el owner reactiva PRO.
 *
 * Importante: el soft-stop se ejecuta SIEMPRE que el tipo de evento sea
 * `expired` o `expired_check`, independiente del resultado de applyPlanChange.
 * Defense in depth — aún si applyPlanChange no cambia el plan (ej: ya era FREE),
 * los recursos quedan marcados para no generar drift.
 */

import { prisma } from "@/lib/db/prisma";
import type { QueryAdapter } from "@/lib/subscriptions/queries";

export type DowngradeSnapshot = {
  externalCalendarIds: string[];
  externalBlockIds: string[];
};

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
