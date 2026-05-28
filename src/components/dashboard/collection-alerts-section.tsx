"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { markPaymentAsPaid, generatePaymentLink } from "@/lib/actions/payments";
import type { CollectionAlertItem } from "@/lib/alerts/collection-alerts";
import { Button } from "@/components/ui/button";

interface CollectionAlertsSectionProps {
  vencidos: CollectionAlertItem[];
  vencenHoy: CollectionAlertItem[];
  proximos7Dias: CollectionAlertItem[];
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

function AlertGroup({
  title,
  badgeClassName,
  items,
  onMarkAsPaid,
  onGenerateLink,
}: {
  title: string;
  badgeClassName: string;
  items: CollectionAlertItem[];
  onMarkAsPaid: (paymentId: string) => Promise<void>;
  onGenerateLink: (paymentId: string) => Promise<void>;
}) {
  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b bg-muted/40 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <span className={badgeClassName}>{items.length}</span>
      </div>

      {items.length === 0 ? (
        <div className="px-4 py-4 text-sm text-muted-foreground">Sin alertas</div>
      ) : (
        <div className="divide-y">
          {items.map((item) => {
            const hasActiveLink = isActiveLink(item.expiresAt);
            return (
              <div key={item.paymentId} className="px-4 py-3 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{item.clientName}</p>
                    <p className="text-xs text-muted-foreground">{item.propertyName}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Vence</p>
                    <p className="text-sm font-medium">{formatDate(item.dueDate)}</p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <Link
                    href={`/reservations?reservationId=${item.reservationId}`}
                    className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground w-full sm:w-auto"
                  >
                    Ver reserva
                  </Link>
                  <Button size="sm" variant="outline" className="w-full sm:w-auto" onClick={() => onMarkAsPaid(item.paymentId)}>
                    Marcar como pagado
                  </Button>
                  <Button size="sm" variant="outline" className="w-full sm:w-auto" onClick={() => onGenerateLink(item.paymentId)}>
                    Generar link MP
                  </Button>
                  {hasActiveLink && item.initPoint && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full sm:w-auto"
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
  );
}

export function CollectionAlertsSection({ vencidos, vencenHoy, proximos7Dias }: CollectionAlertsSectionProps) {
  const router = useRouter();
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [linkId, setLinkId] = useState<string | null>(null);

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

  return (
    <section className="space-y-4" aria-label="Alertas de Cobranza">
      <div>
        <h2 className="text-xl font-semibold">Alertas de Cobranza</h2>
        <p className="text-sm text-muted-foreground">Pagos de reserva pendientes para reservas activas</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className={disabled ? "pointer-events-none opacity-70" : ""}>
          <AlertGroup
            title="Vencidos"
            badgeClassName="inline-flex min-w-7 justify-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700"
            items={vencidos}
            onMarkAsPaid={handleMarkAsPaid}
            onGenerateLink={handleGenerateLink}
          />
        </div>
        <div className={disabled ? "pointer-events-none opacity-70" : ""}>
          <AlertGroup
            title="Vencen hoy"
            badgeClassName="inline-flex min-w-7 justify-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700"
            items={vencenHoy}
            onMarkAsPaid={handleMarkAsPaid}
            onGenerateLink={handleGenerateLink}
          />
        </div>
        <div className={disabled ? "pointer-events-none opacity-70" : ""}>
          <AlertGroup
            title="Próximos 7 días"
            badgeClassName="inline-flex min-w-7 justify-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700"
            items={proximos7Dias}
            onMarkAsPaid={handleMarkAsPaid}
            onGenerateLink={handleGenerateLink}
          />
        </div>
      </div>
    </section>
  );
}
