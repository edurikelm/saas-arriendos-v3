/**
 * Elegibilidad para iniciar un nuevo upgrade a PRO ("Activar PRO").
 *
 * Esta regla es la MISMA que aplica `startProUpgrade` (`src/lib/actions/subscriptions.ts`)
 * para decidir si reemplaza (delete + create) una fila existente en vez de bloquear:
 * sin subscription, o `EXPIRED`/`FAILED`, o `CANCELLED` con `currentPeriodEnd`
 * no-nulo ya vencido. `CANCELLED` con período nulo se trata como vigente por
 * safety (mismo criterio que `startProUpgrade`), así que NO es elegible.
 *
 * `startProUpgrade` es la fuente de verdad — este helper solo se consume hoy
 * desde la UI para decidir si mostrar el CTA "Activar PRO"; no se usó ahí
 * porque su lógica está entrelazada con la transacción de reemplazo y
 * refactorizarla no es un cambio trivialmente seguro fuera de esta tarea (#195).
 */

export type UpgradeEligibilitySubscriptionInput = {
  status: string;
  currentPeriodEnd: Date | null;
} | null;

export function canStartUpgrade(
  subscription: UpgradeEligibilitySubscriptionInput,
  now: Date = new Date(),
): boolean {
  if (!subscription) return true;

  if (subscription.status === "EXPIRED" || subscription.status === "FAILED") {
    return true;
  }

  if (subscription.status === "CANCELLED") {
    return (
      subscription.currentPeriodEnd !== null &&
      subscription.currentPeriodEnd <= now
    );
  }

  return false;
}
