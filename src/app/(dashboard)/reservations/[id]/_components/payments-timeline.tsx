"use client";

import { ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PaymentTimelineNode } from "./payment-timeline-node";
import { daysFromTodayDateOnly, isOverdueDateOnly, nowKeyInBusinessTz } from "@/lib/domain/timezone";
import type { Payment } from "@/components/payments/payments-table";

function formatPrice(price: string | number): string {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(price));
}

interface PaymentsTimelineProps {
  payments: Payment[];
  isActive: boolean;
  overdueCount: number;
  overdueAmount: number;
  onGenerateLink?: (paymentId: string) => void;
  onRegenerateLink?: (paymentId: string) => void;
  onMarkPaid?: (paymentId: string) => void;
  onDeletePayment?: (paymentId: string) => void;
  onUploadReceipt?: (paymentId: string, file: File) => Promise<{ error?: string }>;
  onSendLink?: (payment: Payment) => void;
  generatingLinkId?: string | null;
  regeneratingLinkId?: string | null;
}

export function PaymentsTimeline({
  payments,
  isActive,
  overdueCount,
  overdueAmount,
  onGenerateLink,
  onRegenerateLink,
  onMarkPaid,
  onDeletePayment,
  onUploadReceipt,
  onSendLink,
  generatingLinkId,
  regeneratingLinkId,
}: PaymentsTimelineProps) {
  const nowKey = nowKeyInBusinessTz();

  // Sort by installment index ascending
  const sorted = [...payments].sort(
    (a, b) => (a.installmentIndex ?? 0) - (b.installmentIndex ?? 0),
  );

  // Find first overdue payment for focus
  const firstOverdueIdx = sorted.findIndex(
    (p) => p.status === "PENDING" && isOverdueDateOnly(p.dueDate, nowKey),
  );
  const firstOverdueId = firstOverdueIdx >= 0 ? sorted[firstOverdueIdx].id : null;

  const handleFocusFirstOverdue = () => {
    if (firstOverdueId) {
      const el = document.querySelector(`[data-testid="timeline-node-${firstOverdueId}"]`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        // Focus ring
        (el as HTMLElement).focus?.();
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* Focus card — only when overdue exist */}
      {overdueCount > 0 && isActive && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
          {/* `flex-wrap` (no depende de ningún breakpoint, ni de viewport ni de
              contenedor): a anchos angostos el botón baja a su propia línea en vez
              de forzar el texto a comprimirse contra su ancho fijo (`shrink-0`),
              lo que partía el mensaje en una o dos palabras por línea.
              `flex-auto` (`flex: 1 1 auto`, NO `flex-1` que es `flex: 1 1 0%`):
              con basis 0% el texto "cuenta" como 0px para la decisión de wrap y
              el botón nunca baja de línea porque siempre "cabe"; con basis `auto`
              el texto aporta su ancho real a esa decisión, el botón sí baja de
              línea cuando no entran los dos, y el texto crece para ocupar toda
              la línea (sola o junto al botón) y envuelve con normalidad. */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex-auto">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                Cuotas vencidas
              </p>
              <p className="text-sm font-medium text-destructive-text">
                Tienes {overdueCount} cuota{overdueCount > 1 ? "s" : ""} vencida{overdueCount > 1 ? "s" : ""} · {formatPrice(overdueAmount)}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 gap-1.5"
              onClick={handleFocusFirstOverdue}
            >
              <ArrowDown className="size-3.5" />
              Ir a la primera cuota vencida
            </Button>
          </div>
        </div>
      )}

      {/* Timeline nodes — empty state solo mensaje. El CTA "Agregar Pago" vive en el
          header de la sección padre (no se duplica aquí). El strip celebratorio
          "Cuotas pagadas en su totalidad" fue eliminado (2026-Q3 cleanup):
          redundaba con el KPI "Pagado" del header y con el badge "Pagado" de cada
          PaymentTimelineNode. La lista queda plana, sin summary interno. */}
      {sorted.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-8">
          <p className="text-sm text-muted-foreground">Aún no generaste cuotas</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sorted.map((payment, idx) => {
            const days = payment.dueDate
              ? daysFromTodayDateOnly(payment.dueDate)
              : 999; // No due date → treat as far future
            return (
              <PaymentTimelineNode
                key={payment.id}
                payment={payment}
                index={idx}
                total={sorted.length}
                nowKey={nowKey}
                daysFromNow={days}
                isActive={isActive}
                onGenerateLink={onGenerateLink}
                onRegenerateLink={onRegenerateLink}
                onMarkPaid={onMarkPaid}
                onDeletePayment={onDeletePayment}
                onUploadReceipt={onUploadReceipt}
                onSendLink={onSendLink}
                generatingLinkId={generatingLinkId}
                regeneratingLinkId={regeneratingLinkId}
                isFirstOverdue={payment.id === firstOverdueId}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
