/**
 * Helper de notificaciones para eventos de Subscription.
 *
 * Conecta el lifecycle (applyPlanChange con source "subscription_lifecycle")
 * con el sistema de notificaciones existente (PRD-0003).
 *
 * Patrón de post-commit: este helper es BEST-EFFORT. Si falla, el cambio
 * de plan ya está persistido en DB. El owner verá la notificación in-app
 * aunque el email falle.
 *
 * notificationKey estable para idempotencia: si el mismo evento se procesa
 * 2 veces (webhook duplicado, etc.), el InAppChannel no duplica.
 */

import { prisma } from "@/lib/db/prisma";
import { inAppChannel } from "@/lib/notifications/in-app-channel";
import { emailChannel } from "@/lib/notifications/email-channel";
import type { NotificationRecipient } from "@/lib/notifications/channel";

export type SubscriptionNotificationType =
  | "SUBSCRIPTION_ACTIVATED"
  | "SUBSCRIPTION_CANCELLED"
  | "SUBSCRIPTION_EXPIRED";

/**
 * Emite una notificación in-app + email para un evento de suscripción.
 *
 * Best-effort: los errores se loguean pero nunca propagan para no
 * interferir con el flujo principal del lifecycle.
 *
 * IMPORTANTE: siempre retorna una Promise (nunca early-return void) para
 * que el caller pueda hacer .catch() sin riesgo de TypeError.
 */
export async function recordSubscriptionNotification(args: {
  userId: string;
  type: SubscriptionNotificationType;
  subscriptionId: string;
}): Promise<void> {
  const { userId, type, subscriptionId } = args;

  // Obtener datos del owner para el email
  const user = await prisma.userProfile.findUnique({
    where: { id: userId },
    select: { email: true, name: true },
  });

  if (!user) {
    // Loguear y resolved normalmente — best-effort
    console.error(
      `[recordSubscriptionNotification] User not found: ${userId}`,
    );
    return;
  }

  const { title, body } = getNotificationContent(type);

  const intent = {
    notificationKey: `${type.toLowerCase()}:${subscriptionId}`,
    type: type as SubscriptionNotificationType,
    title,
    body,
    link: "/settings/billing",
    userId,
  };

  const recipient: NotificationRecipient = {
    userId,
    email: user.email,
    name: user.name ?? undefined,
  };

  // InApp primero — para que la fila in-app exista antes de que
  // EmailChannel intente actualizar deliveredAt
  const inAppResult = await inAppChannel.dispatch(intent, recipient);
  if (!inAppResult.ok) {
    // Loguear pero continuar al email dispatch — best-effort
    console.error(
      `[recordSubscriptionNotification] InApp dispatch failed for ${type}`,
      inAppResult,
    );
  }

  const emailResult = await emailChannel.dispatch(intent, recipient);
  if (!emailResult.ok && !("skipped" in emailResult)) {
    console.error(
      `[recordSubscriptionNotification] Email dispatch failed for ${type}`,
      emailResult,
    );
  }
}

function getNotificationContent(
  type: SubscriptionNotificationType,
): { title: string; body: string } {
  switch (type) {
    case "SUBSCRIPTION_ACTIVATED":
      return {
        title: "Tu plan PRO está activo",
        body: "Ahora tienes acceso a iCal, documentos de reserva y propiedades ilimitadas.",
      };
    case "SUBSCRIPTION_CANCELLED":
      return {
        title: "Suscripción PRO cancelada",
        body: "Tu plan seguirá activo hasta el fin del período pagado. Después bajarás a FREE automáticamente.",
      };
    case "SUBSCRIPTION_EXPIRED":
      return {
        title: "Tu plan bajó a FREE",
        body: "Las funciones PRO (iCal, documentos, propiedades ilimitadas) ya no están disponibles.",
      };
  }
}
