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
 * 1. FREE **por debajo** del límite pero a una unidad de topearlo →
 *    descubrimiento preventivo.
 * 2. FREE **en o por encima** del límite → estado distinto y copy distinto.
 *    Un owner que baja de PRO no se acerca al límite: aterriza arriba de él,
 *    y decirle "cerca del límite" con 7 propiedades sobre 3 es falso. Ver
 *    `PRODUCT.md` (Límites de plan y downgrade) para la política.
 * 3. CANCELLED con `currentPeriodEnd > now` → empujar reactivación mientras
 *    el período pagado sigue vigente.
 *
 * Los umbrales salen de `usage.propertiesLimit` / `usage.clientsLimit`, nunca
 * de constantes: el copy hardcodeaba "/3" y "/5", así que decía la verdad solo
 * mientras los límites FREE no cambiaran.
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

  const isCancelled = variant === "cancelled";
  const title = isCancelled
    ? "Tu plan PRO está cancelándose"
    : variant === "free-over-limit"
      ? overLimitTitle(usage)
      : "Cerca del límite de tu plan FREE";
  const body = isCancelled
    ? cancelledCopy(subscription?.currentPeriodEnd ?? null)
    : variant === "free-over-limit"
      ? overLimitCopy(usage)
      : nearLimitCopy(usage);
  const cta = isCancelled ? "Reactivar PRO" : "Pasar a PRO";
  const Icon: LucideIcon = isCancelled ? Sparkles : AlertTriangle;

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
}: VariantInput): "free-near-limit" | "free-over-limit" | "cancelled" | null {
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

  if (enOSobreLimite(usage)) return "free-over-limit";

  // "Cerca" = a una unidad de topear, derivado del límite real.
  const cerca =
    usage.properties >= usage.propertiesLimit - 1 ||
    usage.clients >= usage.clientsLimit - 1;
  return cerca ? "free-near-limit" : null;
}

const enOSobreLimite = (u: OwnerUsage) =>
  u.properties >= u.propertiesLimit || u.clients >= u.clientsLimit;

const sobreLimite = (u: OwnerUsage) =>
  u.properties > u.propertiesLimit || u.clients > u.clientsLimit;

/**
 * Dos títulos para el mismo estado, porque no son la misma situación: llegar
 * al límite es algo que el owner hizo creciendo; superarlo solo pasa al bajar
 * de plan, y ahí el número que ve ("7 sobre 3") necesita una explicación.
 */
function overLimitTitle(usage: OwnerUsage): string {
  return sobreLimite(usage)
    ? "Superaste el límite de tu plan FREE"
    : "Llegaste al límite de tu plan FREE";
}

function overLimitCopy(usage: OwnerUsage): string {
  const partes: string[] = [];
  if (usage.properties >= usage.propertiesLimit) {
    partes.push(`${usage.propertiesLimit} propiedades y tienes ${usage.properties}`);
  }
  if (usage.clients >= usage.clientsLimit) {
    partes.push(`${usage.clientsLimit} clientes y tienes ${usage.clients}`);
  }

  const detalle = `Tu plan FREE permite ${partes.join("; ")}.`;

  // La política, dicha al owner: nada de lo que ya tiene deja de funcionar.
  // Ver PRODUCT.md — es lo que separa este producto de un PMS que puede
  // "mutear" propiedades, porque acá la reserva vive en la app.
  return sobreLimite(usage)
    ? `${detalle} Lo que ya tienes sigue funcionando; no puedes crear más.`
    : `${detalle} PRO libera el límite.`;
}

function nearLimitCopy(usage: OwnerUsage): string {
  if (
    usage.properties >= usage.propertiesLimit - 1 &&
    usage.clients >= usage.clientsLimit - 1
  ) {
    return `Tienes ${usage.properties}/${usage.propertiesLimit} propiedades y ${usage.clients}/${usage.clientsLimit} clientes. PRO los libera.`;
  }
  if (usage.properties >= usage.propertiesLimit - 1) {
    return `Tienes ${usage.properties}/${usage.propertiesLimit} propiedades. PRO los libera.`;
  }
  return `Tienes ${usage.clients}/${usage.clientsLimit} clientes. PRO los libera.`;
}

function cancelledCopy(periodEnd: Date | null): string {
  if (!periodEnd) return "Tu plan PRO fue cancelado.";
  return `Sigue activo hasta el ${periodEnd.toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  })}. Después bajarás a FREE automáticamente.`;
}