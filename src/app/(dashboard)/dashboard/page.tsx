import Link from "next/link";
import { AlertCircle, RefreshCw } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { getDashboardSummary } from "@/lib/actions/dashboard";
import type { DashboardSummary } from "@/lib/dashboard/summary";
import {
  getCurrentSubscriptionAction,
  countOwnerUsage,
} from "@/lib/actions/subscriptions";
import { getMercadoPagoIntegration } from "@/lib/actions/mercado-pago";
import { requireOwner } from "@/lib/auth/guards";
import { PlanAlertBanner } from "@/components/billing/plan-alert-banner";
import { DashboardHome } from "./_components/dashboard-home";

export default async function DashboardPage() {
  // Load principal data defensively. Si getDashboardSummary lanza (o retorna
  // null por sesión inválida), la página renderiza un fallback honesto en
  // vez de un Next.js error page.
  let dashboardSummary: DashboardSummary | null = null;
  let dataLoadError: string | null = null;

  // Plan/subscription + usage: cargados aparte para no acoplar el try/catch
  // principal. Si fallan (raro), el dashboard sigue renderizando sin banner —
  // un banner ausente no es un error funcional.
  let subscription: Awaited<ReturnType<typeof getCurrentSubscriptionAction>> = null;
  let usage: Awaited<ReturnType<typeof countOwnerUsage>> = {
    properties: 0,
    clients: 0,
    propertiesLimit: 3,
    clientsLimit: 5,
  };
  // Tolerante a fallos, igual que subscription/usage: sin esto, "Por cobrar"
  // simplemente no ofrece "Enviar link" (`canSendPaymentLinks ?? false`), no
  // rompe el resto del dashboard.
  let mpIntegration: Awaited<ReturnType<typeof getMercadoPagoIntegration>> = null;

  const session = await requireOwner();

  try {
    dashboardSummary = await getDashboardSummary();
    if (!dashboardSummary) {
      dataLoadError = "No pudimos verificar tu sesión.";
    }
  } catch (err) {
    console.error("[dashboard] failed to load initial data", err);
    dataLoadError = err instanceof Error ? err.message : "No pudimos cargar tus datos.";
  }

  try {
    const [sub, usageResult, integration] = await Promise.all([
      getCurrentSubscriptionAction(),
      countOwnerUsage(session.userId),
      getMercadoPagoIntegration(),
    ]);
    subscription = sub;
    usage = usageResult;
    mpIntegration = integration;
  } catch (err) {
    console.error("[dashboard] failed to load plan/usage data", err);
    // No-op: seguimos con defaults; el banner no se renderiza (variante null)
    // y "Por cobrar" no ofrece "Enviar link" (canSendPaymentLinks = false).
  }

  // Fallback de error: el dashboard es el home diario — un white-screen destruye
  // confianza. Renderizamos un Card con mensaje claro + CTA reintentar / soporte.
  if (dataLoadError || !dashboardSummary) {
    return (
      <div className="space-y-6 pb-10">
        <div>
          <h1 className="text-xl font-bold text-foreground tracking-tight">Dashboard</h1>
          <p className="text-xs text-muted-foreground">Sin conexión con el servidor</p>
        </div>
        <Card className="ring-1 ring-foreground/10">
          <CardHeader>
            <div className="flex items-start gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-warning/10 text-warning-text">
                <AlertCircle className="size-4" />
              </div>
              <div className="space-y-1">
                <CardTitle>No pudimos cargar tus datos</CardTitle>
                <CardDescription>
                  Tus datos están seguros. Volvemos a intentar al recargar la página.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">
              {dataLoadError ?? "No pudimos cargar tus datos."}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Link href="/dashboard" className={buttonVariants({ size: "sm" })}>
                <RefreshCw className="size-3.5" />
                Reintentar
              </Link>
              <Link href="/support" className={buttonVariants({ variant: "outline", size: "sm" })}>
                Contactar soporte
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <DashboardHome
      summary={dashboardSummary}
      // Solo aparece si FREE cerca del límite o CANCELLED con período vigente;
      // en estado estable se anula solo.
      banner={<PlanAlertBanner subscription={subscription} usage={usage} plan={session.plan} />}
      canSendPaymentLinks={mpIntegration?.isConnected ?? false}
    />
  );
}
