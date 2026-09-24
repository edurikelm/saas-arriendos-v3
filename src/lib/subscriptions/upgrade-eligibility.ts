/**
 * Elegibilidad para iniciar un nuevo upgrade a PRO ("Activar PRO").
 *
 * Esta regla es la MISMA que aplica `startProUpgrade` (`src/lib/actions/subscriptions.ts`)
 * para decidir si reemplaza (delete + create) una fila existente en vez de bloquear:
 * sin subscription, o `EXPIRED`/`FAILED`, o `CANCELLED` cuyo plan efectivo ya es
 * FREE. El plan efectivo de una `CANCELLED` lo decide `derivePlanFromSubscription`
 * (`effective-plan.ts`, ADR-0034): FREE cuando `currentPeriodEnd` es nulo o ya
 * pasó, PRO cuando el período pagado sigue vigente. Eso cubre tanto
 * `CANCELLED` con período vencido como `CANCELLED` con período nulo (dato
 * legacy) — ADR-0034 ya deriva FREE para ese caso porque no hay período pagado
 * que honrar, así que no hace falta una regla de "safety" aparte acá.
 *
 * `startProUpgrade` es la fuente de verdad — este helper se usa tanto en su
 * pre-check y su re-check dentro de la transacción de reemplazo (para dar un
 * error amigable en vez de chocar con `userId @unique`) como en la UI para
 * decidir si mostrar el CTA "Activar PRO".
 */

import { derivePlanFromSubscription } from "@/lib/subscriptions/effective-plan";

export type UpgradeEligibilitySubscriptionInput = {
  status: string;
  /** Acepta `string` porque puede llegar ya serializado desde un Server Component. */
  currentPeriodEnd: Date | string | null;
} | null;

export function canStartUpgrade(
  subscription: UpgradeEligibilitySubscriptionInput,
  now: Date = new Date(),
): boolean {
  if (!subscription) return true;

  if (subscription.status === "EXPIRED" || subscription.status === "FAILED") {
    return true;
  }

  if (subscription.status !== "CANCELLED") return false;

  // Normalizado a `Date` real antes de comparar — un valor ya serializado a
  // string (Server → Client Component) no compara bien con `<=`/`>` contra un
  // `Date`, porque el operador relacional convierte el `Date` con `valueOf()`
  // (número) y el string se queda como string.
  const currentPeriodEnd =
    subscription.currentPeriodEnd === null
      ? null
      : new Date(subscription.currentPeriodEnd);

  return (
    derivePlanFromSubscription(
      { status: "CANCELLED", currentPeriodEnd, mpPreapprovalId: null },
      now,
    ) === "FREE"
  );
}
