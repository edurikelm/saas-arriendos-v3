"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Sparkles, Check } from "lucide-react";
import { startProUpgrade } from "@/lib/actions/subscriptions";
import type { OwnerUsage } from "@/lib/actions/subscriptions";
import type { Subscription } from "@prisma/client";

interface BillingClientProps {
  subscription: Subscription | null;
  usage: OwnerUsage;
}

export function BillingClient({ subscription, usage }: BillingClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleUpgrade = () => {
    startTransition(async () => {
      try {
        const { initPoint } = await startProUpgrade();
        toast.success("Redirigiendo a Mercado Pago...");
        window.location.href = initPoint;
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Error desconocido";
        toast.error(msg);
      }
    });
  };

  // Estado actual
  const isPro = subscription?.status === "AUTHORIZED" || subscription?.status === "PAUSED";
  const isCancelled = subscription?.status === "CANCELLED";
  const planName = isPro ? "PRO" : "FREE";
  const planPrice = isPro ? "$9.990 / mes" : "Gratis";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Plan Card - columna principal */}
      <div className="lg:col-span-2 space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Plan actual</CardTitle>
              <Badge variant={isPro ? "default" : "secondary"} className="text-sm">
                {isPro && <Sparkles className="size-3 mr-1" />}
                {planName}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-3xl font-bold">{planPrice}</p>
              {isPro && subscription?.currentPeriodEnd && (
                <p className="text-sm text-muted-foreground mt-1">
                  Próximo cobro:{" "}
                  {new Date(subscription.currentPeriodEnd).toLocaleDateString("es-CL", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              )}
              {isCancelled && subscription?.currentPeriodEnd && (
                <p className="text-sm text-warning mt-1">
                  Tu plan sigue activo hasta el{" "}
                  {new Date(subscription.currentPeriodEnd).toLocaleDateString("es-CL", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  }
                  )}
                  . Después bajarás a FREE.
                </p>
              )}
            </div>

            {/* CTA según estado */}
            {!subscription && (
              <Button
                onClick={handleUpgrade}
                disabled={isPending}
                size="lg"
                className="w-full"
              >
                {isPending ? "Conectando con Mercado Pago..." : "Activar PRO"}
              </Button>
            )}

            {subscription?.status === "PENDING" && (
              <div className="rounded-lg border border-warning/20 bg-warning/10 p-4">
                <p className="text-sm text-warning">
                  Tienes un pago pendiente de autorizar. Revisa tu email o contacta a
                  soporte si no lo recibiste.
                </p>
              </div>
            )}

            {isPro && (
              <div className="rounded-lg border border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/20 p-4">
                <p className="text-sm text-green-900 dark:text-green-400">
                  Tienes acceso completo a las funciones PRO: iCal, documentos, propiedades
                  ilimitadas.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Features comparison */}
        <Card>
          <CardHeader>
            <CardTitle>Tu plan incluye</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <FeatureRow label="Propiedades" included={isPro} value={isPro ? "Ilimitadas" : "3"} />
            <FeatureRow label="Clientes" included={isPro} value={isPro ? "Ilimitados" : "5"} />
            <FeatureRow
              label="Sincronización iCal (Airbnb, Booking, VRBO)"
              included={isPro}
            />
            <FeatureRow
              label="Documentos de reserva (contratos, anexos)"
              included={isPro}
            />
            <FeatureRow label="Reportes con rango completo" included={isPro} />
          </CardContent>
        </Card>
      </div>

      {/* Uso vs límites */}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Uso de tu cuenta</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <UsageRow
              label="Propiedades"
              current={usage.properties}
              limit={usage.propertiesLimit}
            />
            <UsageRow
              label="Clientes"
              current={usage.clients}
              limit={usage.clientsLimit}
            />
            {isPro && (
              <p className="text-xs text-muted-foreground">
                Eres PRO. No tienes límites.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function FeatureRow({
  label,
  included,
  value,
}: {
  label: string;
  included: boolean;
  value?: string;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="flex items-center gap-2">
        <Check
          className={
            included
              ? "size-4 text-green-600 dark:text-green-500"
              : "size-4 text-muted-foreground/30"
          }
        />
        <span className={included ? "" : "text-muted-foreground line-through"}>
          {label}
        </span>
      </span>
      {value && <span className="font-medium">{value}</span>}
    </div>
  );
}

function UsageRow({
  label,
  current,
  limit,
}: {
  label: string;
  current: number;
  limit: number;
}) {
  const percentage =
    limit === Infinity ? 0 : Math.min(100, (current / limit) * 100);
  const isAtLimit = limit !== Infinity && current >= limit;
  return (
    <div>
      <div className="flex items-center justify-between mb-1 text-sm">
        <span>{label}</span>
        <span
          className={
            isAtLimit ? "text-warning font-medium" : "text-muted-foreground"
          }
        >
          {current}
          {limit === Infinity ? "" : ` / ${limit}`}
        </span>
      </div>
      {limit !== Infinity && (
        <Progress
          value={percentage}
          className={isAtLimit ? "bg-warning/20" : ""}
        />
      )}
    </div>
  );
}
