import Link from "next/link";
import { AlertTriangle, Sparkles, type LucideIcon } from "lucide-react";
import type { Subscription } from "@prisma/client";

import { buttonVariants } from "@/components/ui/button";
import type { OwnerUsage } from "@/lib/actions/subscriptions";

type PlanAlertBannerProps = {
  subscription: Subscription | null;
  usage: OwnerUsage;
  /** Plan efectivo del owner — `session.plan`. Ver `VariantInput.plan`. */
  plan: string | null;
};

/**
 * Banner contextual para el dashboard. Solo aparece cuando hay una decisión
 * accionable de plan; en estado estable (FREE lejos del límite / PRO activo)
 * retorna `null` para respetar la regla "Operate" del design system.
 *
 * Casos:
 * 1. FREE con `usage.properties >= 2 OR usage.clients >= 4` → descubrimiento
 *    preventivo antes de topar el límite FREE (3 propiedades / 5 clientes).
 * 2. CANCELLED con `currentPeriodEnd > now` → empujar reactivación mientras
 *    el período pagado sigue vigente.
 *
 * Formato compacto (explorado en /design junto al usuario): título y body en
 * una sola línea de texto, ícono sin caja de fondo y padding reducido — un
 * aviso que el dueño ve todos los días no necesita el mismo peso visual que
 * una alerta puntual. El CTA reusa `buttonVariants({ size: "sm" })` tal cual
 * (no una variante achicada) para no divergir de los botones "sm" del resto
 * de la app.
 */
export function PlanAlertBanner({
  subscription,
  usage,
  plan,
}: PlanAlertBannerProps) {
  const variant = resolveVariant({ subscription, usage, plan });
  if (variant === null) return null;

  const isNearLimit = variant === "free-near-limit";
  const title = isNearLimit
    ? "Cerca del límite de tu plan FREE"
    : "Tu plan PRO está cancelándose";
  const body = isNearLimit
    ? nearLimitCopy(usage)
    : cancelledCopy(subscription?.currentPeriodEnd ?? null);
  const cta = isNearLimit ? "Pasar a PRO" : "Reactivar PRO";
  const Icon: LucideIcon = isNearLimit ? AlertTriangle : Sparkles;

  return (
    <div
      role="status"
      className="flex flex-col gap-2 sm:flex-row sm:items-center rounded-lg border border-warning/20 bg-warning/10 px-3 py-2"
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <Icon className="size-4 shrink-0 text-warning" />
        <p className="text-xs text-foreground">
          <span className="font-medium">{title}</span>
          <span className="text-muted-foreground"> · {body}</span>
        </p>
      </div>
      <Link
        href="/settings/billing"
        className={buttonVariants({ size: "sm", className: "shrink-0" })}
      >
        {cta}
      </Link>
    </div>
  );
}

type VariantInput = {
  subscription: Subscription | null;
  usage: OwnerUsage;
  /**
   * Plan EFECTIVO del owner (`session.plan`, ya resuelto por
   * `resolveEffectivePlan`). Antes este componente decidia si el owner estaba
   * en FREE a partir de `subscription.status`, o sea con una CUARTA regla
   * propia — y por eso mostraba el banner de FREE a un owner cuyo plan
   * efectivo era PRO, contradiciendo al badge del sidebar en la misma
   * pantalla. Ahora la pregunta "en que plan esta" la responde una sola
   * funcion y este componente solo decide QUE mostrar.
   */
  plan: string | null;
};

function resolveVariant({
  subscription,
  usage,
  plan,
}: VariantInput): "free-near-limit" | "cancelled" | null {
  const now = new Date();
  const periodEnd = subscription?.currentPeriodEnd ?? null;

  // Sigue en PRO pero con la subscription cancelada: le queda periodo pagado.
  if (
    plan === "PRO" &&
    subscription?.status === "CANCELLED" &&
    periodEnd !== null &&
    periodEnd > now
  ) {
    return "cancelled";
  }

  if (plan !== "FREE") return null;

  const nearLimit = usage.properties >= 2 || usage.clients >= 4;
  return nearLimit ? "free-near-limit" : null;
}

function nearLimitCopy(usage: OwnerUsage): string {
  if (usage.properties >= 2 && usage.clients >= 4) {
    return `Tienes ${usage.properties}/3 propiedades y ${usage.clients}/5 clientes. PRO los libera.`;
  }
  if (usage.properties >= 2) {
    return `Tienes ${usage.properties}/3 propiedades. PRO los libera.`;
  }
  return `Tienes ${usage.clients}/5 clientes. PRO los libera.`;
}

function cancelledCopy(periodEnd: Date | null): string {
  if (!periodEnd) return "Tu plan PRO fue cancelado.";
  return `Sigue activo hasta el ${periodEnd.toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  })}. Después bajarás a FREE automáticamente.`;
}