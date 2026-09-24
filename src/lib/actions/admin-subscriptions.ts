"use server";

import { requireSuperAdmin } from "@/lib/auth/guards";
import { revalidatePath } from "next/cache";
import { applySubscriptionEvent } from "@/lib/subscriptions/lifecycle";
import { getActiveSubscription } from "@/lib/subscriptions/queries";
import { adminCancelSubscriptionSchema } from "@/lib/validations/subscriptions";
import { logAdminAction } from "@/lib/actions/admin-actions";
import { revalidateAfterPlanChange } from "@/lib/subscriptions/revalidate-plan";
import { getProGateway } from "@/lib/payment/pro-gateway";

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

  // Cancelar primero en Mercado Pago para que MP deje de cobrar — mismo orden
  // que `cancelMySubscription` (src/lib/actions/subscriptions.ts). Sin esto,
  // el admin marcaba CANCELLED localmente pero MP seguía cobrando al owner
  // cada mes hasta que alguien lo notara.
  // Si falla, el estado local y el AdminActionLog quedan intactos (no se
  // ejecuta ni applySubscriptionEvent ni logAdminAction) y el admin puede
  // reintentar.
  let mpCancelled = false;
  if (subscription.mpPreapprovalId) {
    try {
      await getProGateway().cancelPreapproval(subscription.mpPreapprovalId);
      mpCancelled = true;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(
        `[adminCancelSubscription] MP cancel failed for ${subscription.mpPreapprovalId} (user ${validated.userId}):`,
        msg,
      );
      throw new Error(
        "No pudimos cancelar la suscripción en Mercado Pago. El estado local no cambió; intenta de nuevo.",
      );
    }
  }

  // Llamar lifecycle con type admin_cancel
  const { planChange } = await applySubscriptionEvent({
    type: "admin_cancel",
    subscriptionId: subscription.id,
    payload: {
      reason: validated.reason,
      adminId: session.userId, // El SUPER_ADMIN que ejecuta
      mpCancelled,
    },
  });
  revalidateAfterPlanChange(planChange);

  // Registrar AdminActionLog
  await logAdminAction({
    targetId: validated.userId,
    action: "SUBSCRIPTION_CANCELLED_ADMIN",
    details: {
      subscriptionId: subscription.id,
      reason: validated.reason,
      adminId: session.userId,
      mpCancelled,
    },
  });

  // Revalidar página del owner
  revalidatePath(`/admin/users/${validated.userId}`);

  return { success: true, subscriptionId: subscription.id };
}
