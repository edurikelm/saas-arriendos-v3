/**
 * Plan efectivo del owner — cierra la ventana de inconsistencia entre
 * `UserProfile.plan` (cacheado, solo se actualiza en eventos `authorized`/
 * `expired`/`failed`) y el estado real de la `Subscription`.
 *
 * Mercado Pago no emite un status "expired" para `preapproval`, así que el
 * downgrade a FREE depende del cron diario `expired-check`
 * (`src/app/api/cron/subscriptions/expired-check/route.ts`). Mientras ese
 * cron no corre, `UserProfile.plan` puede seguir en "PRO" hasta ~24h después
 * de que el período pagado ya venció, dejando pasar creaciones que deberían
 * bloquearse por el límite FREE.
 *
 * `computeEffectivePlan` recalcula el plan en el momento del request: si el
 * período de la subscription ya venció y su estado sigue en AUTHORIZED o
 * CANCELLED (los mismos candidatos que usa el cron), se trata como FREE
 * independientemente de lo que diga `UserProfile.plan` todavía.
 */

export type EffectivePlanSubscriptionInput = {
  status: string;
  currentPeriodEnd: Date | null;
} | null;

export function computeEffectivePlan(
  rawPlan: string | null,
  subscription: EffectivePlanSubscriptionInput,
  now: Date = new Date(),
): "FREE" | "PRO" {
  const plan = rawPlan === "PRO" ? "PRO" : "FREE";

  if (plan !== "PRO") {
    return plan;
  }

  const periodExpired =
    subscription?.currentPeriodEnd != null && subscription.currentPeriodEnd < now;
  const staleStatus =
    subscription?.status === "AUTHORIZED" || subscription?.status === "CANCELLED";

  if (periodExpired && staleStatus) {
    return "FREE";
  }

  return "PRO";
}
