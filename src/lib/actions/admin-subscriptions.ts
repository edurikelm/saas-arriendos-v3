"use server";

import { requireSuperAdmin } from "@/lib/auth/guards";
import { revalidatePath } from "next/cache";
import { applySubscriptionEvent } from "@/lib/subscriptions/lifecycle";
import { getActiveSubscription } from "@/lib/subscriptions/queries";
import { adminCancelSubscriptionSchema } from "@/lib/validations/subscriptions";
import { logAdminAction } from "@/lib/actions/admin-actions";

export async function adminCancelSubscription(
  args: { userId: string; reason: string },
): Promise<{ success: true; subscriptionId: string }> {
  const session = await requireSuperAdmin();

  // Validación Zod
  const validated = adminCancelSubscriptionSchema.parse(args);

  // Cargar subscription del user
  const subscription = await getActiveSubscription(validated.userId);
  if (!subscription) {
    throw new Error("Este owner no tiene una suscripción activa");
  }

  if (
    subscription.status !== "AUTHORIZED" &&
    subscription.status !== "PAUSED"
  ) {
    throw new Error(
      `Solo se pueden cancelar suscripciones en estado AUTHORIZED o PAUSED. Estado actual: ${subscription.status}`,
    );
  }

  // Llamar lifecycle con type admin_cancel
  await applySubscriptionEvent({
    type: "admin_cancel",
    subscriptionId: subscription.id,
    payload: {
      reason: validated.reason,
      adminId: session.userId, // El SUPER_ADMIN que ejecuta
    },
  });

  // Registrar AdminActionLog
  await logAdminAction({
    targetId: validated.userId,
    action: "SUBSCRIPTION_CANCELLED_ADMIN",
    details: {
      subscriptionId: subscription.id,
      reason: validated.reason,
      adminId: session.userId,
    },
  });

  // Revalidar página del owner
  revalidatePath(`/admin/users/${validated.userId}`);

  return { success: true, subscriptionId: subscription.id };
}
