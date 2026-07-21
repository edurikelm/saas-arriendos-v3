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
import type { Prisma } from "@prisma/client";
import type { Subscription, SubscriptionEvent } from "@prisma/client";

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
