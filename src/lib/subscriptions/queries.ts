/**
 * Queries Prisma de Subscription centralizadas como seam canónico.
 *
 * Decisión de diseño (ADR-0027 §2):
 * - `Subscription` modela el ciclo de vida completo de la suscripción PRO.
 * - `SubscriptionEvent` es auditoría técnica de cambios de estado.
 * - No se reutiliza `Notification` para esto (dos dominios distintos).
 *
 * Patrón de adapter:
 * - Todos los helpers aceptan un `adapter` opcional (`Prisma.TransactionClient |
 *   typeof prisma`) para participar en `$transaction` del caller.
 * - Si se omite, se usa el cliente global `prisma` (modo no transaccional).
 * - Mismo patrón que `lib/payments/queries.ts`.
 */

import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";
import type { Subscription, SubscriptionEvent } from "@prisma/client";

export type DowngradeSnapshot = {
  externalCalendarIds: string[];
  externalBlockIds: string[];
};

export type QueryAdapter = Prisma.TransactionClient | typeof prisma;

// ────────────────────────────────────────────────────────────────────────────
// Active subscription lookup
// ────────────────────────────────────────────────────────────────────────────

/**
 * Busca la suscripción activa de un owner.
 * "Activa" = status IN (PENDING, AUTHORIZED, PAUSED).
 *
 * Usada por `getCurrentSubscription` (server action) para determinar
 * el plan actual del owner sin consultar `UserProfile.plan`.
 */
export async function getActiveSubscription(
  userId: string,
  adapter: QueryAdapter = prisma,
): Promise<Subscription | null> {
  return adapter.subscription.findFirst({
    where: {
      userId,
      status: { in: ["PENDING", "AUTHORIZED", "PAUSED"] },
    },
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Lookup por MP identifiers
// ────────────────────────────────────────────────────────────────────────────

/**
 * Busca una subscription por `mpPreapprovalId`.
 * Usada por el webhook `/api/webhooks/mercadopago-pro` para correlacionar
 * el evento de MP con la fila local.
 */
export async function getSubscriptionByPreapprovalId(
  mpPreapprovalId: string,
  adapter: QueryAdapter = prisma,
): Promise<Subscription | null> {
  return adapter.subscription.findFirst({
    where: { mpPreapprovalId },
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Lookup por ID
// ────────────────────────────────────────────────────────────────────────────

/**
 * Busca una subscription por ID.
 */
export async function getSubscriptionById(
  id: string,
  adapter: QueryAdapter = prisma,
): Promise<Subscription | null> {
  return adapter.subscription.findFirst({
    where: { id },
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Historial de eventos
// ────────────────────────────────────────────────────────────────────────────

/**
 * Lista eventos de auditoría de una subscription, ordenados por fecha.
 * @param limit máximo de eventos a devolver (default 50)
 */
export async function listSubscriptionEvents(
  subscriptionId: string,
  limit: number = 50,
  adapter: QueryAdapter = prisma,
): Promise<SubscriptionEvent[]> {
  return adapter.subscriptionEvent.findMany({
    where: { subscriptionId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Downgrade snapshot lookup
// ────────────────────────────────────────────────────────────────────────────

/**
 * Busca el snapshot del ÚLTIMO downgrade (expired/expired_check) del owner.
 *
 * Búsqueda por `userId` (no por `subscriptionId`) para sobrevivir a:
 * - Multi-ciclo: el owner puede tener varios eventos `expired` históricos.
 * - Eventual creación de nueva fila de Subscription (gap pre-existente en
 *   startProUpgrade — ver ADR-0027 §9 + ADR-0033 a crear).
 *
 * Retorna `null` si:
 * - Nunca hubo un downgrade para este owner (FREE puro → PRO).
 * - El downgrade fue revertido antes de expirar (CANCELLED-vigente → reactivado).
 * - El payload no contiene `downgradeSnapshot` (evento legacy o corruption).
 *
 * Usado por `restoreExternalCalendars` (#224).
 */
export async function findLastDowngradeSnapshot(
  userId: string,
  adapter: QueryAdapter = prisma,
): Promise<DowngradeSnapshot | null> {
  const event = await adapter.subscriptionEvent.findFirst({
    where: {
      type: { in: ["expired", "expired_check"] },
      payload: { not: Prisma.JsonNull },
      subscription: { userId }, // join via relation
    },
    orderBy: { createdAt: "desc" },
    select: { payload: true },
  });
  if (!event?.payload || typeof event.payload !== "object") return null;
  const snap = (event.payload as Record<string, unknown>).downgradeSnapshot;
  if (!snap || typeof snap !== "object") return null;
  return snap as DowngradeSnapshot;
}
