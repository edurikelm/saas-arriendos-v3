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
 * - Si la subscription está EXPIRED, se debe crear una fila nueva
 *   (`startProUpgrade` lo maneja).
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
 * 1. Verifica que no tenga subscription activa (o que esté EXPIRED).
 * 2. Crea `Subscription(PENDING)` vía `applySubscriptionEvent("created")`.
 * 3. Obtiene `planId` de MP vía `ensurePlan()`.
 * 4. Crea el preapproval en MP y obtiene `initPoint`.
 * 5. Actualiza la subscription con los IDs de MP y fechas.
 *
 * El plan se activa cuando MP envía el webhook "authorized".
 */
export async function startProUpgrade(): Promise<{
  initPoint: string;
  subscriptionId: string;
}> {
  const session = await requireOwner();
  const { userId, email } = session;

  // Verificar subscription existente
  const existing = await getCurrentSubscription(userId);

  if (existing) {
    if (existing.status === "AUTHORIZED" || existing.status === "PAUSED") {
      throw new Error("Ya tienes PRO activo");
    }
    if (existing.status === "CANCELLED" && existing.currentPeriodEnd && existing.currentPeriodEnd > new Date()) {
      const endDate = existing.currentPeriodEnd.toLocaleDateString("es-CL", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      });
      throw new Error(`Tu suscripción PRO sigue activa hasta ${endDate}`);
    }
    // Si CANCELLED + expirada o FAILED/EXPIRED → se permite crear nueva
    // (el constraint userId@unique se maneja via delete o reuso de fila)
  }

  // Crear subscription PENDING
  const { subscription } = await applySubscriptionEvent({
    type: "created",
    userId,
    payload: { initiatedBy: "owner", email },
  });

  try {
    // Obtener planId de MP
    const { planId } = await getProGateway().ensurePlan();

    // Crear preapproval en MP
    const { preapprovalId, initPoint } = await getProGateway().createPreapproval({
      userId,
      payerEmail: email,
      planId,
    });

    // Actualizar subscription con datos de MP
    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // sandbox: +1 mes

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
    // Si falla la creación del preapproval o el update, limpiar la subscription PENDING huérfana
    // para evitar que el owner quede bloqueado por el constraint userId @unique.
    await prisma.subscription.delete({
      where: { id: subscription.id },
    }).catch(() => {
      // Si el delete también falla (raro), noop. El owner podrá intentar de nuevo
      // y `getActiveSubscription` bloqueará el doble intento via la validación previa.
    });
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
