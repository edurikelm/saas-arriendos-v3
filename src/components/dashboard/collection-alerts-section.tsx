"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, CalendarClock, ChevronRight, ReceiptText } from "lucide-react";
import { toast } from "sonner";
import { markPaymentAsPaid, generatePaymentLink } from "@/lib/actions/payments";
import type { CollectionAlertItem } from "@/lib/alerts/collection-alerts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface SaldoItem {
  reservationId: string;
  reservation: {
    client: { name: string };
    property: { name: string };
  };
  pending: number;
}

interface CollectionAlertsSectionProps {
  vencidos: CollectionAlertItem[];
  vencenHoy: CollectionAlertItem[];
  proximos7Dias: CollectionAlertItem[];
  saldos: SaldoItem[];
}

type TabKey = "vencidos" | "vencenHoy" | "proximos7Dias" | "saldos";

type AlertTab = {
  key: "vencidos" | "vencenHoy" | "proximos7Dias";
  label: string;
  items: CollectionAlertItem[];
  countClassName: string;
  icon: React.ReactNode;
  emptyMessage: string;
  itemNoun: "alerta";
};

type SaldoTab = {
  key: "saldos";
  label: string;
  items: SaldoItem[];
  countClassName: string;
  icon: React.ReactNode;
  emptyMessage: string;
  itemNoun: "saldo";
};

type Tab = AlertTab | SaldoTab;

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Santiago",
  });
}

function formatCLP(amount: number): string {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function isActiveLink(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() > Date.now();
}

export function CollectionAlertsSection({ vencidos, vencenHoy, proximos7Dias, saldos }: CollectionAlertsSectionProps) {
  const router = useRouter();
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [linkId, setLinkId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("vencidos");

  const handleMarkAsPaid = async (paymentId: string) => {
    setMarkingId(paymentId);
    try {
      const result = await markPaymentAsPaid(paymentId, new Date(), "CASH");
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Pago marcado como pagado");
      router.refresh();
    } catch {
      toast.error("No fue posible marcar el pago como pagado");
    } finally {
      setMarkingId(null);
    }
  };

  const handleGenerateLink = async (paymentId: string) => {
    setLinkId(paymentId);
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
      setLinkId(null);
    }
  };

  const disabled = Boolean(markingId || linkId);

  const tabs: Tab[] = [
    {
      key: "vencidos",
      label: "Vencidos",
      items: vencidos,
      countClassName: "bg-destructive/10 text-destructive",
      icon: <AlertTriangle className="size-4" />,
      emptyMessage: "Sin pagos vencidos",
      itemNoun: "alerta",
    },
    {
      key: "vencenHoy",
      label: "Vencen hoy",
      items: vencenHoy,
      countClassName: "bg-warning/10 text-warning-foreground",
      icon: <CalendarClock className="size-4" />,
      emptyMessage: "Sin pagos que venzan hoy",
      itemNoun: "alerta",
    },
    {
      key: "proximos7Dias",
      label: "Próx. 7 días",
      items: proximos7Dias,
      countClassName: "bg-info/10 text-info-foreground",
      icon: <CalendarClock className="size-4" />,
      emptyMessage: "Sin alertas en próximos 7 días",
      itemNoun: "alerta",
    },
    {
      key: "saldos",
      label: "Saldos pendientes",
      items: saldos,
      countClassName: "bg-warning/10 text-warning-foreground",
      icon: <ReceiptText className="size-4" />,
      emptyMessage: "Sin saldos pendientes",
      itemNoun: "saldo",
    },
  ];

  const currentTab = tabs.find((tab) => tab.key === activeTab) ?? tabs[0];
  const totalAlerts = vencidos.length + vencenHoy.length + proximos7Dias.length + saldos.length;
  const isSaldoTab = currentTab.key === "saldos";

  return (
    <Card aria-label="Alertas de Cobranza">
      <CardHeader className="border-b pb-4">
        <div className="mb-2 inline-flex w-fit items-center gap-2 rounded-md border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
          <ReceiptText className="size-3.5" />
          Cobranza
        </div>
        <CardTitle>Alertas de cobranza</CardTitle>
        <CardDescription>Pagos pendientes para reservas activas.</CardDescription>
        <p className="text-sm font-medium text-muted-foreground">{totalAlerts} alertas abiertas</p>
      </CardHeader>

      <CardContent className="space-y-4 pt-0">
        <div className="grid grid-cols-4 gap-2">
          {tabs.map((tab) => {
            const isActive = tab.key === currentTab.key;

            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`rounded-lg border px-2 py-2 text-left transition-colors ${
                  isActive ? "border-primary bg-primary/10" : "border-border bg-muted/40 hover:bg-muted"
                }`}
              >
                <p className="truncate text-[11px] font-medium text-foreground">{tab.label}</p>
                <span className={`mt-1 inline-flex min-w-6 justify-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${tab.countClassName}`}>
                  {tab.items.length}
                </span>
              </button>
            );
          })}
        </div>

        <div className={disabled ? "pointer-events-none opacity-70" : ""}>
          <p className="mb-3 text-xs text-muted-foreground">
            Mostrando {currentTab.items.length} {currentTab.itemNoun}{currentTab.items.length === 1 ? "" : "s"}
          </p>

          {currentTab.items.length === 0 ? (
            <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              {currentTab.emptyMessage}
            </div>
          ) : isSaldoTab ? (
            <div className="space-y-3">
              {currentTab.items.map((item) => (
                <div key={item.reservationId} className="rounded-xl border bg-muted/30 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{item.reservation.client.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{item.reservation.property.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Saldo</p>
                      <p className="text-sm font-semibold text-warning-foreground">{formatCLP(item.pending)}</p>
                    </div>
                  </div>
                  <div className="mt-3">
                    <Link
                      href={`/reservations?reservationId=${item.reservationId}`}
                      className="inline-flex h-8 items-center justify-center rounded-lg border border-input bg-background px-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
                    >
                      Ver reserva
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {currentTab.items.map((item) => {
                const hasActiveLink = isActiveLink(item.expiresAt);

                return (
                  <div key={item.paymentId} className="rounded-xl border bg-muted/30 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{item.clientName}</p>
                        <p className="truncate text-xs text-muted-foreground">{item.propertyName}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Vence</p>
                        <p className="text-sm font-semibold text-foreground">{formatDate(item.dueDate)}</p>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <Link
                        href={`/reservations?reservationId=${item.reservationId}`}
                        className="inline-flex h-8 items-center justify-center rounded-lg border border-input bg-background px-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
                      >
                        Ver reserva
                      </Link>
                      <Button size="sm" variant="outline" className="h-8" onClick={() => handleMarkAsPaid(item.paymentId)}>
                        Marcar pagado
                      </Button>
                      <Button size="sm" variant="outline" className="h-8 sm:col-span-2" onClick={() => handleGenerateLink(item.paymentId)}>
                        Generar link MP
                        <ChevronRight className="size-4" />
                      </Button>
                      {hasActiveLink && item.initPoint && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 sm:col-span-2"
                          onClick={() => {
                            navigator.clipboard.writeText(item.initPoint || "");
                            toast.success("Link copiado al portapapeles");
                          }}
                        >
                          Copiar link vigente
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
