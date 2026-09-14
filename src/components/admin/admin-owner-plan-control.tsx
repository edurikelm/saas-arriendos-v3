"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { updateUserPlan } from "@/lib/actions/super-admin";
import type { EffectivePlan } from "@/lib/subscriptions/effective-plan";

/**
 * Concesión manual de PRO desde el detalle del owner.
 *
 * No es un selector FREE/PRO: `updateUserPlan` con "FREE" no fuerza FREE, revoca
 * la concesión y vuelve a derivar de la suscripción. Un selector haría creer que
 * elegir FREE le quita el plan a quien paga. Por eso el control nombra el plan
 * EFECTIVO y de dónde viene; los badges de la página muestran la fila.
 */
export function AdminOwnerPlanControl({
  userId,
  planOverride,
  subscriptionPlan,
}: {
  userId: string;
  planOverride: "FREE" | "PRO" | null;
  /** Lo que daría la suscripción sola, sin la concesión. */
  subscriptionPlan: EffectivePlan;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const hasGrant = planOverride === "PRO";

  const origin = hasGrant
    ? "PRO, concedido manualmente"
    : subscriptionPlan === "PRO"
      ? "PRO, por su suscripción"
      : "FREE";

  const consequence = hasGrant
    ? subscriptionPlan === "PRO"
      ? "Si se revoca, sigue en PRO por su suscripción."
      : "Si se revoca, vuelve a FREE."
    : subscriptionPlan === "PRO"
      ? "Conceder PRO lo mantiene en PRO aunque su suscripción termine."
      : "Conceder PRO le da el plan sin cobro, hasta que se revoque.";

  const change = (plan: "FREE" | "PRO") => {
    startTransition(async () => {
      try {
        const result = await updateUserPlan({ userId, plan });
        if ("error" in result) {
          toast.error(result.error);
          return;
        }
        toast.success(plan === "PRO" ? "PRO concedido" : "Concesión de PRO revocada");
        router.refresh();
      } catch {
        toast.error("No se pudo cambiar el plan");
      }
    });
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-0.5">
        <p className="text-xs text-muted-foreground">Plan efectivo</p>
        <p className="text-sm font-medium">{origin}</p>
        <p className="text-xs text-muted-foreground">{consequence}</p>
      </div>
      {hasGrant ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => change("FREE")}
          disabled={isPending}
        >
          {isPending ? "Revocando..." : "Revocar PRO"}
        </Button>
      ) : (
        <Button type="button" size="sm" onClick={() => change("PRO")} disabled={isPending}>
          <Sparkles className="size-4 mr-2" />
          {isPending ? "Concediendo..." : "Conceder PRO"}
        </Button>
      )}
    </div>
  );
}
