"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CalendarClock,
  Copy,
  Link2,
  MoreHorizontal,
  ReceiptText,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MarkPaidDialog } from "@/components/dashboard/mark-paid-dialog";
import type { CollectionAlertItem } from "@/lib/alerts/collection-alerts";
import { generatePaymentLink } from "@/lib/actions/payments";

interface UrgentCollectionCardProps {
  vencidos: CollectionAlertItem[];
  vencenHoy: CollectionAlertItem[];
  proximos7Dias: CollectionAlertItem[];
}

type BucketKey = "vencidos" | "vencenHoy" | "proximos7Dias";

function formatCLP(amount: number): string {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Santiago",
  });
}

function isActiveLink(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() > Date.now();
}

function sumAmount(items: CollectionAlertItem[]): number {
  return items.reduce((acc, item) => acc + item.amount, 0);
}

export function UrgentCollectionCard({
  vencidos,
  vencenHoy,
  proximos7Dias,
}: UrgentCollectionCardProps) {
  const router = useRouter();
  const [generatingLinkId, setGeneratingLinkId] = useState<string | null>(null);
  const [markPaidId, setMarkPaidId] = useState<string | null>(null);

  const buckets: Record<BucketKey, CollectionAlertItem[]> = {
    vencidos,
    vencenHoy,
    proximos7Dias,
  };

  // Selecciona por defecto el primer bucket con datos (o vencidos).
  const defaultBucket: BucketKey = useMemo<BucketKey>(() => {
    if (vencidos.length > 0) return "vencidos";
    if (vencenHoy.length > 0) return "vencenHoy";
    if (proximos7Dias.length > 0) return "proximos7Dias";
    return "vencidos";
  }, [vencidos, vencenHoy, proximos7Dias]);

  const totalAmount = sumAmount(vencidos) + sumAmount(vencenHoy) + sumAmount(proximos7Dias);
  const totalCount = vencidos.length + vencenHoy.length + proximos7Dias.length;

  async function handleGenerateLink(paymentId: string) {
    setGeneratingLinkId(paymentId);
    try {
      const result = await generatePaymentLink(paymentId);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Link de pago generado");
      router.refresh();
    } catch {
      toast.error("No fue posible generar el link");
    } finally {
      setGeneratingLinkId(null);
    }
  }

  function handleCopyLink(initPoint: string | null) {
    if (!initPoint) {
      toast.error("No hay link vigente para copiar");
      return;
    }
    navigator.clipboard.writeText(initPoint);
    toast.success("Link copiado al portapapeles");
  }

  return (
    <Card aria-label="Alertas de Cobranza" className="h-full">
      <CardHeader className="border-b pb-4">
        <div className="mb-2 inline-flex w-fit items-center gap-2 rounded-md border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
          <ReceiptText className="size-3.5" />
          Cobranza
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <CardTitle>Alertas de cobranza</CardTitle>
            <CardDescription>
              Cuotas con vencimiento inmediato sobre reservas activas.
            </CardDescription>
          </div>

          <div className="shrink-0 rounded-lg bg-warning/10 px-4 py-2 text-right">
            <p className="text-xs font-medium text-muted-foreground">Total a cobrar</p>
            <p className="text-xl font-semibold text-warning-foreground">
              {formatCLP(totalAmount)}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {totalCount} {totalCount === 1 ? "alerta" : "alertas"} en total
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <Tabs defaultValue={defaultBucket} className="w-full">
          <TabsList variant="line" className="mb-4 w-full justify-start">
            <TabsTrigger
              value="vencidos"
              disabled={vencidos.length === 0}
              className="gap-2"
            >
              <AlertTriangle className="size-4 text-destructive" />
              Vencidos
              {vencidos.length > 0 ? (
                <Badge variant="destructive" className="ml-1">
                  {vencidos.length}
                </Badge>
              ) : null}
            </TabsTrigger>
            <TabsTrigger
              value="vencenHoy"
              disabled={vencenHoy.length === 0}
              className="gap-2"
            >
              <CalendarClock className="size-4 text-warning-foreground" />
              Vencen hoy
              {vencenHoy.length > 0 ? (
                <Badge variant="warning" className="ml-1">
                  {vencenHoy.length}
                </Badge>
              ) : null}
            </TabsTrigger>
            <TabsTrigger
              value="proximos7Dias"
              disabled={proximos7Dias.length === 0}
              className="gap-2"
            >
              <CalendarClock className="size-4 text-info-foreground" />
              Próx. 7 días
              {proximos7Dias.length > 0 ? (
                <Badge variant="info" className="ml-1">
                  {proximos7Dias.length}
                </Badge>
              ) : null}
            </TabsTrigger>
          </TabsList>

          {(["vencidos", "vencenHoy", "proximos7Dias"] as BucketKey[]).map((bucket) => {
            const items = buckets[bucket];
            return (
              <TabsContent key={bucket} value={bucket} className="space-y-3">
                {items.length === 0 ? (
                  <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                    Sin pagos en esta categoría.
                  </div>
                ) : (
                  items.map((item) => {
                    const hasActiveLink = isActiveLink(item.expiresAt);
                    const disabledRow = generatingLinkId === item.paymentId;
                    return (
                      <div
                        key={item.paymentId}
                        className="flex flex-col items-start justify-between gap-4 rounded-xl border bg-muted/30 p-4 transition-colors hover:bg-muted/40 md:flex-row md:items-center"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">
                            {item.clientName}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {item.propertyName}
                          </p>
                        </div>

                        <div className="flex w-full flex-wrap items-center gap-4 md:w-auto md:justify-end">
                          <div className="text-left md:text-right">
                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                              Monto
                            </p>
                            <p className="text-base font-bold text-foreground">
                              {formatCLP(item.amount)}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              Vence {formatDate(item.dueDate)}
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              onClick={() => setMarkPaidId(item.paymentId)}
                              disabled={disabledRow}
                            >
                              Marcar pagado
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-input bg-background transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
                                disabled={disabledRow}
                                aria-label="Más acciones"
                              >
                                <MoreHorizontal className="size-4" />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() =>
                                    router.push(
                                      `/reservations?reservationId=${item.reservationId}`
                                    )
                                  }
                                >
                                  <ReceiptText className="size-4" />
                                  Ver reserva
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleGenerateLink(item.paymentId)}
                                >
                                  <Link2 className="size-4" />
                                  Generar link MP
                                </DropdownMenuItem>
                                {hasActiveLink ? (
                                  <DropdownMenuItem
                                    onClick={() => handleCopyLink(item.initPoint)}
                                  >
                                    <Copy className="size-4" />
                                    Copiar link vigente
                                  </DropdownMenuItem>
                                ) : null}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      </CardContent>

      <MarkPaidDialog
        paymentId={markPaidId}
        open={markPaidId !== null}
        onOpenChange={(open) => {
          if (!open) setMarkPaidId(null);
        }}
        onSuccess={() => router.refresh()}
      />
    </Card>
  );
}
