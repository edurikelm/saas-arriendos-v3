import Link from "next/link";
import { AlertTriangle, Sparkles, type LucideIcon } from "lucide-react";
import type { Subscription } from "@prisma/client";

import { buttonVariants } from "@/components/ui/button";
import type { OwnerUsage } from "@/lib/actions/subscriptions";

type PlanAlertBannerProps = {
  subscription: Subscription | null;
  usage: OwnerUsage;
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
 * El icon container sigue la regla del design system:
 * `size-9 rounded-xl bg-{tone}/10 text-{tone}` en la misma posición que
 * otros alerts del dashboard (ver `dashboard/page.tsx:131`).
 */
export function PlanAlertBanner({
  subscription,
  usage,
}: PlanAlertBannerProps) {
  const variant = resolveVariant({ subscription, usage });
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
      className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-warning/20 bg-warning/10 p-4"
    >
      <div className="flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-warning/10 text-warning">
          <Icon className="size-4" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground">{body}</p>
        </div>
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
};

function resolveVariant({
  subscription,
  usage,
}: VariantInput): "free-near-limit" | "cancelled" | null {
  const status = subscription?.status ?? null;
  const now = new Date();
  const periodEnd = subscription?.currentPeriodEnd ?? null;

  if (status === "CANCELLED" && periodEnd !== null && periodEnd > now) {
    return "cancelled";
  }

  const isFreeOrDowngraded =
    status === null ||
    status === "CANCELLED" ||
    status === "EXPIRED" ||
    status === "FAILED";
  if (!isFreeOrDowngraded) return null;

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