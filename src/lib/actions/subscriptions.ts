"use server";

/**
 * Server actions para gestión de suscripciones PRO.
 *
 * Principios de diseño:
 * - Todas las acciones que modifican estado usan `applySubscriptionEvent`.
 * - La cancelación es al fin del período: `cancelMySubscription` marca
 *   `CANCELLED` pero NO cambia `UserProfile.plan`.
 * - `startProUpgrade` crea la subscription en PENDING, el plan cambia cuando
 *   MP envía el webhook de "authorized".
 *
 * Decisiones documentadas (no cambiar sin coordinar con el equipo):
 * - `userId @unique`: 1 owner = 1 subscription activa.
 * - Si la subscription está CANCELLED y no expiró, `reactivateMySubscription`
 *   reactiva la misma fila (no se crea nueva).
 * - Si la subscription está EXPIRED o FAILED, `startProUpgrade` ejecuta
 *   delete+create dentro de una transacción atómica (ADR-0027 §9).
 */

import { requireOwner } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { revalidatePath } from "next/cache";
import { getProGateway } from "@/lib/payment/pro-gateway";
import {
  applySubscriptionEvent,
  getCurrentSubscription,
} from "@/lib/subscriptions/lifecycle";
import {
  cancelSubscriptionSchema,
  reactivateSubscriptionSchema,
} from "@/lib/validations/subscriptions";
import { recordSubscriptionNotification } from "@/lib/notifications/subscription-events";

// ────────────────────────────────────────────────────────────────────────────
// getCurrentSubscription
// ────────────────────────────────────────────────────────────────────────────

/**
 * Devuelve la suscripción activa del owner actual o null.
 * Retornable desde server component.
 */
export async function getCurrentSubscriptionAction() {
  const session = await requireOwner();
  return getCurrentSubscription(session.userId);
}

// ────────────────────────────────────────────────────────────────────────────
// startProUpgrade
// ────────────────────────────────────────────────────────────────────────────

/**
 * Inicia el flujo de upgrade a PRO.
 *
 * 1. Pre-check: verifica que no tenga subscription activa.
 * 2. Dentro de tx: si EXPIRED/FAILED existe → delete eventos + hard-delete la fila.
 * 3. Crea `Subscription(PENDING)` vía `applySubscriptionEvent("created", tx)`.
 * 4. Post-commit: registra `AdminActionLog.SUBSCRIPTION_REPLACED`.
 * 5. Obtiene `planId` de MP vía `ensurePlan()`.
 * 6. Crea el preapproval en MP y obtiene `initPoint`.
 * 7. Actualiza la subscription con los IDs de MP y fechas.
 *
 * El plan se activa cuando MP envía el webhook "authorized".
 */
export async function startProUpgrade(): Promise<{
  initPoint: string;
  subscriptionId: string;
}> {
  const session = await requireOwner();
  const { userId, email } = session;

  // Pre-check (existente, fuera de tx — solo bloquea casos no elegibles)
  const existing = await getCurrentSubscription(userId);

  if (existing) {
    if (existing.status === "AUTHORIZED" || existing.status === "PAUSED") {
      throw new Error("Ya tienes PRO activo");
    }
    if (existing.status === "PENDING") {
      // El segundo click del dueño mientras la PENDING inicial aún existe.
      // La protección real está en el tx (P2002 si intenta create de nuevo),
      // pero damos un mensaje útil aquí.
      throw new Error(
        "Tienes un pago PRO pendiente de autorizar. Complétalo antes de iniciar otro.",
      );
    }
    if (existing.status === "CANCELLED") {
      // CANCELLED con período vigente (currentPeriodEnd futuro o null legacy):
      // bloquear. CANCELLED-expirado cae al path de replace.
      // Si currentPeriodEnd es null (dato legacy), tratamos como vigente por safety:
      // el owner puede tener acceso a features PRO sin que podamos probar lo contrario.
      if (!existing.currentPeriodEnd || existing.currentPeriodEnd > new Date()) {
        const endDate = existing.currentPeriodEnd
          ? existing.currentPeriodEnd.toLocaleDateString("es-CL", {
              day: "2-digit",
              month: "long",
              year: "numeric",
            })
          : "que termine tu período actual";
        throw new Error(`Tu suscripción PRO sigue activa hasta ${endDate}`);
      }
      // else: CANCELLED-expired → cae al replace
    }
  }

  // ── REEMPLAZAR: dentro de tx, si existe fila EXPIRED/FAILED → delete + create ──
  // (mover el try/catch interno al bloque tx para atomicidad)

  let subscription: import("@prisma/client").Subscription;
  let replacedSubscriptionId: string | null = null;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Re-check dentro de tx (doble-click concurrente: puede que la fila ya no exista)
      const fresh = await tx.subscription.findUnique({ where: { userId } });

      if (
        fresh &&
        (fresh.status === "EXPIRED" ||
          fresh.status === "FAILED" ||
          // CANCELLED-expirado también es reemplazable: el pre-check lo dejó pasar
          // (porque currentPeriodEnd <= now), pero la fila sigue ocupando el
          // userId @unique. El cron eventualmente la convertiría a EXPIRED,
          // pero no podemos esperar al cron aquí.
          (fresh.status === "CANCELLED" &&
            (!fresh.currentPeriodEnd || fresh.currentPeriodEnd <= new Date())))
      ) {
        // Borrar eventos de la subscription vieja (FK RESTRICT lo exige)
        await tx.subscriptionEvent.deleteMany({
          where: { subscriptionId: fresh.id },
        });
        // Hard delete la fila vieja
        await tx.subscription.delete({
          where: { id: fresh.id },
        });
        replacedSubscriptionId = fresh.id;
      }

      // Crear la nueva subscription PENDING via applySubscriptionEvent
      // (participa en la tx vía adapter pattern — ver lifecycle.ts:374-384)
      const { subscription: created } = await applySubscriptionEvent(
        {
          type: "created",
          userId,
          payload: { initiatedBy: "owner", email },
        },
        tx,
      );
      return { subscription: created };
    });
    subscription = result.subscription;
  } catch (error) {
    // Si falla el delete o el create, nada se persiste (rollback automático)
    console.error("[startProUpgrade] failed to replace existing subscription", error);
    throw error;
  }

  // Auditar el reemplazo si ocurrió (FUERA de tx — best-effort)
  if (replacedSubscriptionId) {
    try {
      await prisma.adminActionLog.create({
        data: {
          adminId: userId, // owner como actor (no el placeholder "system")
          targetId: userId,
          action: "SUBSCRIPTION_REPLACED",
          details: JSON.stringify({
            replacedSubscriptionId,
            newSubscriptionId: subscription.id,
            reason: "owner_reactivate_from_expired_or_failed",
          }),
        },
      });
    } catch (error) {
      console.error("[startProUpgrade] failed to record SUBSCRIPTION_REPLACED log", error);
      // No-op: el reemplazo ocurrió, solo perdimos la auditoría
    }
  }

  // ── Continuar con MP (idéntico al código actual) ──
  try {
    const { planId } = await getProGateway().ensurePlan();

    const { preapprovalId, initPoint } = await getProGateway().createPreapproval({
      userId,
      payerEmail: email,
      planId,
    });

    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        mpPreapprovalId: preapprovalId,
        mpPlanId: planId,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        nextPaymentDate: periodEnd,
      },
    });

    revalidatePath("/settings/billing");

    return { initPoint, subscriptionId: subscription.id };
  } catch (error) {
    // Si falla la creación del preapproval, limpiar la subscription PENDING huérfana
    await prisma.subscription.delete({
      where: { id: subscription.id },
    }).catch(() => {});
    throw error;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// cancelMySubscription
// ────────────────────────────────────────────────────────────────────────────

/**
 * El owner cancela su suscripción.
 *
 * Marca `status = CANCELLED` + `cancelledAt` pero NO cambia `UserProfile.plan`.
 * El downgrade a FREE ocurre cuando MP envía el webhook "expired" o cuando
 * el cron detecta `currentPeriodEnd < now` (ADR-0027 § Decisión 3).
 */
export async function cancelMySubscription(
  reason?: "too_expensive" | "not_using" | "switching_provider" | "other",
): Promise<{ success: true; currentPeriodEnd: Date | null }> {
  // Validación Zod (defensa en profundidad, también para callers programáticos)
  cancelSubscriptionSchema.parse({ reason });

  const session = await requireOwner();
  const { userId } = session;

  const subscription = await getCurrentSubscription(userId);

  if (!subscription) {
    throw new Error("No tienes una suscripción activa");
  }

  if (subscription.status !== "AUTHORIZED" && subscription.status !== "PAUSED") {
    throw new Error(
      `No puedes cancelar una suscripción en estado "${subscription.status}"`,
    );
  }

  // Cancelar primero en Mercado Pago para que MP deje de cobrar.
  // Si falla, el estado local queda intacto y el owner puede reintentar.
  // La subscription local se mantiene AUTHORIZED hasta que MP confirme la
  // cancelación vía webhook (que marcará CANCELLED + creará evento).
  if (subscription.mpPreapprovalId) {
    try {
      await getProGateway().cancelPreapproval(subscription.mpPreapprovalId);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[cancelMySubscription] MP cancel failed for ${subscription.mpPreapprovalId}:`, msg);
      throw new Error(
        "No pudimos cancelar la suscripción en Mercado Pago. Por favor intenta de nuevo en unos minutos."
      );
    }
  }

  await applySubscriptionEvent({
    type: "owner_cancel",
    subscriptionId: subscription.id,
    payload: { reason: reason ?? null, userId },
  });

  // Notificar al owner que su plan fue cancelado (best-effort)
  recordSubscriptionNotification({
    userId,
    type: "SUBSCRIPTION_CANCELLED",
    subscriptionId: subscription.id,
  }).catch((error) => {
    console.error(
      "[cancelMySubscription] Failed to record SUBSCRIPTION_CANCELLED notification:",
      error,
    );
  });

  // Obtener fecha fin del período para informar al owner
  const updated = await prisma.subscription.findUnique({
    where: { id: subscription.id },
    select: { currentPeriodEnd: true },
  });

  revalidatePath("/settings/billing");

  return {
    success: true,
    currentPeriodEnd: updated?.currentPeriodEnd ?? null,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// reactivateMySubscription
// ────────────────────────────────────────────────────────────────────────────

/**
 * Reactivar una suscripción cancelada que aún no expiró.
 *
 * Solo válido si `status === CANCELLED && currentPeriodEnd > now`.
 * Pasa por `applySubscriptionEvent({ type: "authorized" })` para mantener
 * el patrón de auditoría. El lifecycle limpia `cancelledAt` y `cancellationReason`
 * cuando la transición viene de CANCELLED.
 */
export async function reactivateMySubscription(): Promise<{
  success: true;
  subscription: { id: string; status: string; currentPeriodEnd: Date | null };
}> {
  reactivateSubscriptionSchema.parse({});

  const session = await requireOwner();
  const { userId } = session;

  const subscription = await getCurrentSubscription(userId);

  if (!subscription) {
    throw new Error("No tienes una suscripción para reactivar");
  }

  if (subscription.status !== "CANCELLED") {
    throw new Error(
      `Solo puedes reactivar una suscripción cancelada. Estado actual: "${subscription.status}"`,
    );
  }

  const now = new Date();
  if (!subscription.currentPeriodEnd || subscription.currentPeriodEnd <= now) {
    throw new Error(
      "Tu suscripción ya expiró. Usa 'Activar PRO' para crear una nueva.",
    );
  }

  // Transición CANCELLED → AUTHORIZED pasa por applySubscriptionEvent
  // (state-machine.ts permite esta transición para reactivación manual).
  await applySubscriptionEvent({
    type: "authorized",
    subscriptionId: subscription.id,
    payload: { source: "reactivate", userId },
  });

  revalidatePath("/settings/billing");

  return {
    success: true,
    subscription: {
      id: subscription.id,
      status: "AUTHORIZED",
      currentPeriodEnd: subscription.currentPeriodEnd,
    },
  };
}

// ────────────────────────────────────────────────────────────────────────────
// countOwnerUsage — helper para la UI de /settings/billing
// ────────────────────────────────────────────────────────────────────────────

export type OwnerUsage = {
  properties: number;
  clients: number;
  propertiesLimit: number;
  clientsLimit: number;
};

/**
 * Cuenta el uso actual del owner para mostrar en la UI de billing.
 *
 * Límites FREE: 3 propiedades, 5 clientes.
 * Límites PRO: Infinity (sin límite).
 *
 * future: cuando el plan se lea de `UserProfile.plan` en vez de subscription,
 * este helper consultará `session.plan` directamente.
 */
export async function countOwnerUsage(userId: string): Promise<OwnerUsage> {
  const [propertyCount, clientCount] = await Promise.all([
    prisma.property.count({ where: { userId } }),
    prisma.reservationClient.count({ where: { userId } }),
  ]);

  // Determinar plan actual del owner
  const user = await prisma.userProfile.findUnique({
    where: { id: userId },
    select: { plan: true },
  });

  const plan = (user?.plan as "FREE" | "PRO" | null) ?? "FREE";
  const isPro = plan === "PRO";

  return {
    properties: propertyCount,
    clients: clientCount,
    propertiesLimit: isPro ? Infinity : 3,
    clientsLimit: isPro ? Infinity : 5,
  };
}
