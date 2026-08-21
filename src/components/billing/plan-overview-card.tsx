import Link from "next/link";
import { Sparkles } from "lucide-react";
import type { Subscription } from "@prisma/client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { PRO_PRICING } from "@/lib/subscriptions/pricing";
import type { OwnerUsage } from "@/lib/actions/subscriptions";

type PlanOverviewCardProps = {
  subscription: Subscription | null;
  usage: OwnerUsage;
};

/**
 * Resumen del plan actual + CTA hacia `/settings/billing`.
 *
 * Server Component (no tiene estado ni handlers; solo renderiza datos de
 * suscripción y navega). Vive en `/settings` como primer card del layout,
 * siguiendo la jerarquía: plan > perfil > integraciones.
 *
 * Decisión de descubribilidad: el dueño que busca "administrar mi plan"
 * aterriza naturalmente en Configuración y desde aquí llega a `/settings/billing`
 * con un click, sin necesidad de item dedicado en el sidebar.
 */
export function PlanOverviewCard({ subscription, usage }: PlanOverviewCardProps) {
  const status = subscription?.status ?? null;
  const now = new Date();
  const periodEnd = subscription?.currentPeriodEnd ?? null;
  const isPro = status === "AUTHORIZED" || status === "PAUSED";
  const isCancelled = status === "CANCELLED";
  const isPending = status === "PENDING";
  const hasActiveCancellation =
    isCancelled && periodEnd !== null && periodEnd > now;

  let planName: "FREE" | "PRO";
  let badgeVariant: "default" | "secondary" | "warning";
  if (isPro) {
    planName = "PRO";
    badgeVariant = "default";
  } else if (isPending) {
    planName = "FREE";
    badgeVariant = "warning";
  } else if (hasActiveCancellation) {
    planName = "PRO";
    badgeVariant = "warning";
  } else {
    planName = "FREE";
    badgeVariant = "secondary";
  }

  // CTA label se adapta al estado para empujar la acción correcta
  let ctaLabel = "Administrar plan";
  if (isPending) ctaLabel = "Revisar pago pendiente";
  else if (hasActiveCancellation) ctaLabel = "Reactivar PRO";
  else if (!isPro) ctaLabel = "Pasar a PRO";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Plan y facturación</CardTitle>
          <Badge variant={badgeVariant} className="text-sm">
            {isPro && <Sparkles className="size-3 mr-1" />}
            {planName}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isPro && (
          <div>
            <p className="text-3xl font-bold tabular-nums">
              {formatPrice(PRO_PRICING.monthly.amount)} / mes
            </p>
            {periodEnd && (
              <p className="text-sm text-muted-foreground mt-1">
                Próximo cobro: {formatLongDate(periodEnd)}
              </p>
            )}
          </div>
        )}

        {hasActiveCancellation && periodEnd && (
          <div className="rounded-lg border border-warning/20 bg-warning/10 p-4">
            <p className="text-sm text-warning-foreground">
              Tu plan sigue activo hasta el {formatLongDate(periodEnd)}.
              Después bajarás a FREE automáticamente.
            </p>
          </div>
        )}

        {isPending && (
          <div className="rounded-lg border border-warning/20 bg-warning/10 p-4">
            <p className="text-sm text-warning-foreground">
              Tienes un pago de Mercado Pago pendiente de autorizar. Si no lo
              recibiste, contacta a soporte.
            </p>
          </div>
        )}

        {!isPro && !isPending && (
          <div>
            <p className="text-sm text-muted-foreground">
              Plan gratuito ·{" "}
              {usage.propertiesLimit === Infinity
                ? "uso ilimitado"
                : `${usage.properties} / ${usage.propertiesLimit} propiedades · ${usage.clients} / ${usage.clientsLimit} clientes`}
            </p>
          </div>
        )}

        <Link
          href="/settings/billing"
          className={buttonVariants({
            variant: isPro ? "outline" : "default",
            size: "default",
            className: "w-full",
          })}
        >
          {ctaLabel}
        </Link>
      </CardContent>
    </Card>
  );
}

function formatPrice(amount: number): string {
  return `$${amount.toLocaleString("es-CL")}`;
}

function formatLongDate(date: Date): string {
  return date.toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}