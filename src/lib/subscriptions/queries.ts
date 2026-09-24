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
// Import type-only: lifecycle.ts importa de este módulo, así que un import de
// valor acá crearía un ciclo. `import type` se borra en compilación y no lo hace.
import type { SubscriptionEventType } from "@/lib/subscriptions/lifecycle";

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
 * Usada por `applySubscriptionEvent({ type: "created" })` para el pre-check
 * de "el owner ya tiene una subscription en curso" y por los callers de
 * admin. **No** es la lectura que usan las superficies de owner — para eso
 * ver `getOwnerSubscription`, que trae la fila sin filtrar por status.
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

/**
 * Busca la fila de `Subscription` del owner, cualquiera sea su `status`.
 *
 * `userId @unique` garantiza a lo sumo una fila. Esta es LA lectura que usan
 * las superficies de owner (settings, billing, dashboard, pricing) vía
 * `getCurrentSubscription`/`getCurrentSubscriptionAction`: a diferencia de
 * `getActiveSubscription`, necesitan ver también `CANCELLED` (para decidir si
 * el período pagado sigue vigente — `hasActiveCancellation`, `canStartUpgrade`)
 * y `EXPIRED`/`FAILED` (para ofrecer "Activar PRO" de nuevo). Filtrar por
 * status acá era el bug de #195 ronda 2: la UI de owner recibía `null` para
 * una `CANCELLED` con período vigente y mostraba FREE + "Activar PRO", que al
 * hacer click chocaba con `userId @unique` (P2002) porque la fila seguía viva.
 */
export async function getOwnerSubscription(
  userId: string,
  adapter: QueryAdapter = prisma,
): Promise<Subscription | null> {
  return adapter.subscription.findUnique({ where: { userId } });
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
 * - La subscription pasó por `CANCELLED` sin llegar a expirar y volvió a
 *   `AUTHORIZED` antes del downgrade (la transición sigue en `state-machine.ts`,
 *   aunque ningún flujo de owner la dispara hoy — no existe reactivar, #195).
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

// ────────────────────────────────────────────────────────────────────────────
// Idempotencia de webhooks de authorized_payment
// ────────────────────────────────────────────────────────────────────────────

/**
 * Detecta si ya existe un `SubscriptionEvent` de `type` para esta subscription
 * cuyo payload trae `payloadKey === value` — usado por el webhook
 * `authorized_payment` para no reaplicar el mismo cobro dos veces
 * (reintentos de MP bajo el mismo authorized_payment id, o el mismo payment id).
 *
 * `payloadKey` es "mpAuthorizedPaymentId" para dedupe de `renewed` y
 * `payment_unapplied` (un authorized_payment aprobado se aplica una sola vez) o "mpPaymentId" para
 * dedupe de `payment_failed` (cada intento rechazado tiene su propio payment id).
 */
export async function hasSubscriptionEventForAuthorizedPayment(
  subscriptionId: string,
  type: SubscriptionEventType,
  payloadKey: "mpAuthorizedPaymentId" | "mpPaymentId",
  value: string,
  adapter: QueryAdapter = prisma,
): Promise<boolean> {
  const event = await adapter.subscriptionEvent.findFirst({
    where: {
      subscriptionId,
      type,
      payload: { path: [payloadKey], equals: value },
    },
    select: { id: true },
  });
  return event !== null;
}
