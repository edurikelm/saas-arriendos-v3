import { requireOwner } from "@/lib/auth/guards";
import { getCurrentSubscriptionAction, countOwnerUsage } from "@/lib/actions/subscriptions";
import { countActiveExternalCalendars } from "@/lib/external-calendars/queries";
import { BillingClient } from "@/components/billing/billing-client";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Plan y facturación - RentalPro",
};

export default async function BillingPage() {
  const session = await requireOwner();
  const [subscription, usage, activeExternalCalendarCount] = await Promise.all([
    getCurrentSubscriptionAction(),
    countOwnerUsage(session.userId),
    countActiveExternalCalendars(session.userId).catch((error) => {
      // Defense in depth (per dashboard pattern at /dashboard/page.tsx):
      // si la query falla, fallback a 0 — el bloque amber no se muestra,
      // pero la página sigue renderizando. Mejor un warning perdido que 500.
      console.error("[billing] failed to count active external calendars", error);
      return 0;
    }),
  ]);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="space-y-2 mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold">Plan y facturación</h1>
        <p className="text-sm text-muted-foreground">
          Administra tu suscripción PRO y revisa el uso de tu cuenta
        </p>
      </div>

      <BillingClient
        subscription={subscription}
        usage={usage}
        activeExternalCalendarCount={activeExternalCalendarCount}
      />
    </div>
  );
}
