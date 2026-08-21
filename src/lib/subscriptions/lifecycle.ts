/**
 * Lifecycle de Subscription — punto único de transición de estado.
 *
 * Principios de diseño (ADR-0027 §2, §3):
 * - `applySubscriptionEvent` es idempotente para webhooks duplicados de MP
 *   (Hallazgo #1 del code review slices 1-2-10).
 * - `applyPlanChange` emite `AdminActionLog` cuando el origen es
 *   `subscription_lifecycle` (Hallazgo #4 del code review).
 * - La cancelación es al fin del período: `cancelMySubscription` marca
 *   `CANCELLED` pero NO cambia `UserProfile.plan`.
 *
 * El adapter opcional permite participar en `$transaction` del caller.
 * Si se omite, usa `prisma` directo (modo no transaccional).
 */

import { prisma } from "@/lib/db/prisma";
import { canTransition } from "@/lib/subscriptions/state-machine";
import { PRO_PRICING } from "@/lib/subscriptions/pricing";
import { getActiveSubscription } from "@/lib/subscriptions/queries";
import type { QueryAdapter } from "@/lib/subscriptions/queries";
import type { Subscription, SubscriptionStatus } from "@prisma/client";
import { recordSubscriptionNotification } from "@/lib/notifications/subscription-events";
import { softStopExternalCalendars, restoreExternalCalendars } from "@/lib/subscriptions/subscription-downgrade";
import { findLastDowngradeSnapshot } from "@/lib/subscriptions/queries";
import type { DowngradeSnapshot } from "@/lib/subscriptions/queries";

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export type SubscriptionEventType =
  | "created"
  | "authorized"
  | "paused"
  | "cancelled"
  | "expired"
  | "failed"
  | "renewed"
  | "payment_failed"
  | "owner_cancel"
  | "admin_cancel"
  | "duplicate"
  | "expired_check";

export type SubscriptionEventInput = {
  type: SubscriptionEventType;
  subscriptionId?: string;
  payload?: Record<string, unknown>;
  /** Solo para type="created" cuando no existe subscription previa */
  userId?: string;
};

export type ApplyPlanChangeArgs = {
  userId: string;
  newPlan: "FREE" | "PRO";
  source: "subscription_lifecycle" | "admin_manual" | "owner_request";
  subscriptionId?: string;
  /** Solo para source="admin_manual": ID del SUPER_ADMIN que ejecuta la acción */
  adminId?: string;
};

export type PlanChange = {
  from: "FREE" | "PRO" | null;
  to: "FREE" | "PRO";
  source: string;
};

// ────────────────────────────────────────────────────────────────────────────
// Helpers puros
// ────────────────────────────────────────────────────────────────────────────

/**
 * Mapea el tipo de evento al estado destino de la Subscription.
 * Devuelve null cuando el evento no produce cambio de estado.
 */
/**
 * Mapea el tipo de evento al estado destino de la Subscription.
 * Devuelve null cuando el evento no produce cambio de estado.
 */
function targetStatusFor(eventType: SubscriptionEventType): SubscriptionStatus | null {
  switch (eventType) {
    case "created":
      return "PENDING";
    case "authorized":
      return "AUTHORIZED";
    case "paused":
      return "PAUSED";
    case "cancelled":
    case "owner_cancel":
    case "admin_cancel":
      return "CANCELLED";
    case "expired":
    case "expired_check":
      return "EXPIRED";
    case "failed":
      return "FAILED";
    case "renewed":
      // "renewed" mantiene AUTHORIZED — no hay cambio de estado
      return null;
    case "payment_failed":
      // "payment_failed" mantiene AUTHORIZED — no hay cambio de estado
      return null;
    case "duplicate":
      // "duplicate" no produce transición
      return null;
    default:
      return null;
  }
}

/**
 * Determina si el evento implica un cambio de plan.
 * Las transiciones que activan PRO: PENDING → AUTHORIZED.
 * Las transiciones que disparan downgrade: AUTHORIZED → EXPIRED/FAILED.
 */
function eventTriggersPlanChange(eventType: SubscriptionEventType): boolean {
  return eventType === "authorized" || eventType === "expired" || eventType === "failed";
}

// ────────────────────────────────────────────────────────────────────────────
// applyPlanChange — efecto secundario: actualiza UserProfile.plan + AdminActionLog
// ────────────────────────────────────────────────────────────────────────────

/**
 * Aplica un cambio de plan al owner.
 *
 * Ejecuta dentro de la misma transacción que la transición de estado para
 * mantener atomicidad. Si `source === "subscription_lifecycle"`, emite
 * `AdminActionLog` con action "PLAN_CHANGED_AUTO" (Hallazgo #4 del code review).
 *
 * Si `currentPlan === newPlan`, no hace nada y retorna `{ from: newPlan, to: newPlan, source }`.
 */
export async function applyPlanChange(
  args: ApplyPlanChangeArgs,
  adapter: QueryAdapter = prisma,
): Promise<PlanChange> {
  const { userId, newPlan, source } = args;

  // Cargar plan actual del owner
  const user = await adapter.userProfile.findUnique({
    where: { id: userId },
    select: { plan: true },
  });

  const currentPlan = (user?.plan as "FREE" | "PRO" | null) ?? "FREE";

  // Si el plan no cambia, no hacer nada
  if (currentPlan === newPlan) {
    return { from: newPlan, to: newPlan, source };
  }

  // Actualizar plan del owner
  await adapter.userProfile.update({
    where: { id: userId },
    data: { plan: newPlan },
  });

  // Emitir AdminActionLog según la fuente del cambio
  // Para source="subscription_lifecycle", el cambio es automático del sistema:
  // adminId es un placeholder que identifica al sistema (no a un usuario real).
  // Para source="admin_manual", adminId debe ser el ID del SUPER_ADMIN que
  // ejecutó la acción (pasado por el caller; si no se pasa, fallback al target).
  const SYSTEM_ADMIN_ID = "system";
  if (source === "subscription_lifecycle") {
    await adapter.adminActionLog.create({
      data: {
        adminId: SYSTEM_ADMIN_ID,
        targetId: userId,
        action: "PLAN_CHANGED_AUTO",
        details: JSON.stringify({
          source,
          subscriptionId: args.subscriptionId,
          fromPlan: currentPlan,
          toPlan: newPlan,
        }),
      },
    });
  } else if (source === "admin_manual") {
    await adapter.adminActionLog.create({
      data: {
        adminId: args.adminId ?? SYSTEM_ADMIN_ID,
        targetId: userId,
        action: "PLAN_CHANGED_MANUAL",
        details: JSON.stringify({
          fromPlan: currentPlan,
          toPlan: newPlan,
        }),
      },
    });
  }
  // "owner_request" no emite AdminActionLog — no es una acción de admin

  return { from: currentPlan, to: newPlan, source };
}

// ────────────────────────────────────────────────────────────────────────────
// applySubscriptionEvent — orquestación principal
// ────────────────────────────────────────────────────────────────────────────

/**
 * Punto único de transición de estado para Subscription.
 *
 * Comportamiento:
 * 1. **Idempotencia A** (Hallazgo #1): si la subscription ya está en el
 *    estado destino, registra `SubscriptionEvent("duplicate")` y retorna
 *    `{ subscription }` sin error.
 * 2. Para "created": valida que el owner no tenga ya una subscription activa.
 * 3. Valida la transición con `canTransition`.
 * 4. Ejecuta en transacción atómica:
 *    - Actualiza `Subscription` con el nuevo status + campos según evento.
 *    - Crea `SubscriptionEvent`.
 *    - Si corresponde, llama `applyPlanChange` (misma transacción).
 * 5. Retorna `{ subscription, planChange? }`.
 *
 * @param event Evento con tipo, subscriptionId opcional, payload y userId (solo para "created").
 * @param adapter Cliente Prisma (global o de transacción).
 */
export async function applySubscriptionEvent(
  event: SubscriptionEventInput,
  adapter: QueryAdapter = prisma,
): Promise<{ subscription: Subscription; planChange?: PlanChange }> {
  const { type, subscriptionId, payload, userId } = event;

  // ── Tipo "created" — crear nueva subscription ──────────────────────────────
  if (type === "created") {
    if (!userId) {
      throw new Error("userId es requerido para crear una subscription");
    }

    // Validar que el owner no tenga ya una subscription activa
    const existing = await getActiveSubscription(userId, adapter);
    if (existing) {
      throw new Error("User already has an active subscription");
    }

    const subscription = await adapter.subscription.create({
      data: {
        userId,
        plan: "PRO",
        status: "PENDING",
        amount: PRO_PRICING.monthly.amount,
        currency: PRO_PRICING.monthly.currency,
        frequency: PRO_PRICING.monthly.frequency,
        frequencyType: PRO_PRICING.monthly.frequencyType,
        startedAt: new Date(),
      },
    });

    // Registrar evento de creación
    await adapter.subscriptionEvent.create({
      data: {
        subscriptionId: subscription.id,
        type: "created",
        payload: (payload ?? undefined) as any,
      },
    });

    return { subscription };
  }

  // ── Eventos sobre subscription existente ───────────────────────────────────
  if (!subscriptionId) {
    throw new Error("subscriptionId es requerido para eventos sobre subscription existente");
  }

  const currentSubscription = await adapter.subscription.findUnique({
    where: { id: subscriptionId },
  });

  if (!currentSubscription) {
    throw new Error(`Subscription not found: ${subscriptionId}`);
  }

  const targetStatus = targetStatusFor(type);

  // ── Idempotencia A: mismo estado destino → duplicate ─────────────────────
  if (targetStatus !== null && currentSubscription.status === targetStatus) {
    await adapter.subscriptionEvent.create({
      data: {
        subscriptionId,
        type: "duplicate",
        payload: (payload ?? undefined) as any,
      },
    });
    return { subscription: currentSubscription };
  }

  // ── Validar transición (excepto renewed / payment_failed que no cambian estado) ──
  if (targetStatus !== null && !canTransition(currentSubscription.status, targetStatus)) {
    throw new Error(
      `Invalid transition: ${currentSubscription.status} → ${targetStatus} for event "${type}"`,
    );
  }

  // ── Construir datos de actualización según tipo de evento ──────────────────
  const updateData: Record<string, unknown> = {};

  if (targetStatus !== null) {
    updateData.status = targetStatus;
  }

  switch (type) {
    case "authorized":
      updateData.currentPeriodStart = payload?.startDate
        ? new Date(payload.startDate as string)
        : new Date();
      updateData.currentPeriodEnd = payload?.endDate
        ? new Date(payload.endDate as string)
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // sandbox: +1 mes
      updateData.nextPaymentDate = payload?.nextPaymentDate
        ? new Date(payload.nextPaymentDate as string)
        : null;
      // Si la reactivación viene desde CANCELLED, limpiar marcadores de cancelación
      // para que la subscription quede "como nueva" sin perder su historial de eventos.
      if (currentSubscription.status === "CANCELLED") {
        updateData.cancelledAt = null;
        updateData.cancellationReason = null;
      }
      break;

    case "renewed":
      // Mantiene AUTHORIZED, solo actualiza fechas
      updateData.currentPeriodStart = payload?.startDate
        ? new Date(payload.startDate as string)
        : currentSubscription.currentPeriodEnd ?? new Date();
      updateData.currentPeriodEnd = payload?.endDate
        ? new Date(payload.endDate as string)
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      updateData.nextPaymentDate = payload?.nextPaymentDate
        ? new Date(payload.nextPaymentDate as string)
        : null;
      break;

    case "paused":
      // Solo cambia status
      break;

    case "cancelled":
    case "owner_cancel":
    case "admin_cancel":
      updateData.cancelledAt = new Date();
      updateData.cancellationReason =
        type === "owner_cancel"
          ? (payload?.reason as string | undefined) ?? "owner_request"
          : type === "admin_cancel"
            ? (payload?.reason as string | undefined) ?? "admin_manual"
            : null;
      break;

    case "expired":
    case "expired_check":
      // Solo cambia status — las fechas ya deberían estar seteadas
      break;

    case "failed":
      // Solo cambia status
      break;

    case "payment_failed":
      // Mantiene AUTHORIZED, solo registra el evento (no cambia status)
      // El owner es notificado por el caller (webhook/cron)
      break;

    case "duplicate":
      // Ya manejado arriba
      break;

    default:
      // No-op para tipos no reconocidos
      break;
  }

  // ── Transacción atómica ──────────────────────────────────────────────────
  // Si el adapter es prisma global (no una tx en curso), envolvemos todas
  // las escrituras en una $transaction para garantizar consistencia entre
  // Subscription update, SubscriptionEvent create, y applyPlanChange.
  // Si el adapter ya es un Prisma.TransactionClient, las operaciones se
  // ejecutan dentro de la transacción del caller (sin abrir una nueva).
  const isGlobalPrisma = adapter === prisma;

  const runInTx = async <T>(work: (a: QueryAdapter) => Promise<T>): Promise<T> => {
    if (isGlobalPrisma) {
      return prisma.$transaction(async (tx) => work(tx as unknown as QueryAdapter));
    }
    return work(adapter);
  };

  const result = await runInTx(async (tx) => {
    // "payment_failed" y "duplicate" no producen cambios en la subscription.
    const hasUpdate = targetStatus !== null || type === "renewed";

    const updatedSubscription = hasUpdate
      ? await tx.subscription.update({
          where: { id: subscriptionId },
          data: updateData,
        })
      : currentSubscription;

    // ── Soft-stop de recursos externos en downgrade (expired / expired_check) ──
    let downgradeSnapshot: DowngradeSnapshot | undefined;
    if (type === "expired" || type === "expired_check") {
      downgradeSnapshot = await softStopExternalCalendars(currentSubscription.userId, tx);
    }

    // ── Restore de recursos externos en upgrade (authorized desde CANCELLED/EXPIRED/FAILED) ──
    if (
      type === "authorized" &&
      ["CANCELLED", "EXPIRED", "FAILED"].includes(currentSubscription.status)
    ) {
      const snapshot = await findLastDowngradeSnapshot(currentSubscription.userId, tx);
      if (snapshot) {
        await restoreExternalCalendars(currentSubscription.userId, snapshot, tx);
      }
      // Si no hay snapshot (FREE puro → PRO, o CANCELLED-vigente → reactivado): no-op
    }

    // Registrar evento de auditoría — el snapshot se mergea DENTRO del payload
    // (no como propiedad hermana de `data`, porque SubscriptionEvent solo tiene
    // la columna JSON `payload` — ver schema.prisma:587)
    await tx.subscriptionEvent.create({
      data: {
        subscriptionId,
        type,
        payload: {
          ...(payload ?? {}),
          ...(downgradeSnapshot ? { downgradeSnapshot } : {}),
        } as any,
      },
    });

    // ── Plan change (si corresponde) ───────────────────────────────────────
    let planChange: PlanChange | undefined;

    if (eventTriggersPlanChange(type)) {
      const newPlan: "FREE" | "PRO" =
        type === "authorized" ? "PRO" : "FREE";

      planChange = await applyPlanChange(
        {
          userId: currentSubscription.userId,
          newPlan,
          source: "subscription_lifecycle",
          subscriptionId,
        },
        tx,
      );
    }

    return { subscription: updatedSubscription, planChange };
  });

  // ── Post-commit: notificar al owner si el plan cambió por lifecycle ────────
  if (
    result.planChange &&
    result.planChange.source === "subscription_lifecycle" &&
    result.planChange.from !== result.planChange.to
  ) {
    const notificationType =
      result.planChange.to === "PRO"
        ? "SUBSCRIPTION_ACTIVATED"
        : "SUBSCRIPTION_EXPIRED";

    // Fire-and-forget: si falla, el cambio de plan ya está persistido
    recordSubscriptionNotification({
      userId: currentSubscription.userId,
      type: notificationType,
      subscriptionId,
    }).catch((error) => {
      console.error(
        `[applySubscriptionEvent] Failed to record ${notificationType} notification:`,
        error,
      );
    });
  }

  return result;
}

// ────────────────────────────────────────────────────────────────────────────
// getCurrentSubscription — wrapper con adapter
// ────────────────────────────────────────────────────────────────────────────

/**
 * Wrapper sobre `getActiveSubscription` con firma más clara para server actions.
 * Busca la subscription activa del owner (PENDING | AUTHORIZED | PAUSED).
 */
export async function getCurrentSubscription(
  userId: string,
  adapter: QueryAdapter = prisma,
): Promise<Subscription | null> {
  return getActiveSubscription(userId, adapter);
}
