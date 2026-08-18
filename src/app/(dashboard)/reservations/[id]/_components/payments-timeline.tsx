"use client";

import { useRef } from "react";
import { ArrowDown, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PaymentTimelineNode } from "./payment-timeline-node";
import { daysFromNowInBusinessTz, isOverdueInBusinessTz, nowKeyInBusinessTz } from "@/lib/domain/timezone";
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
  onAddPayment?: () => void;
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
  onAddPayment,
}: PaymentsTimelineProps) {
  const nowKey = nowKeyInBusinessTz();

  // Sort by installment index ascending
  const sorted = [...payments].sort(
    (a, b) => (a.installmentIndex ?? 0) - (b.installmentIndex ?? 0),
  );

  const allCompleted = sorted.length > 0 && sorted.every((p) => p.status === "COMPLETED");

  // Find first overdue payment for focus
  const firstOverdueIdx = sorted.findIndex(
    (p) => p.status === "PENDING" && isOverdueInBusinessTz(p.dueDate, nowKey),
  );
  const firstOverdueId = firstOverdueIdx >= 0 ? sorted[firstOverdueIdx].id : null;

  const focusRef = useRef<HTMLDivElement>(null);

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
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                Cuotas vencidas
              </p>
              <p className="text-sm font-medium text-destructive">
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

      {/* Fully paid celebratory state */}
      {allCompleted && sorted.length > 0 && (
        <div className="rounded-lg border border-success/20 bg-success/5 p-4 flex items-center gap-3">
          <div className="size-10 rounded-full bg-success/10 flex items-center justify-center shrink-0">
            <CheckCircle2 className="size-5 text-success" aria-hidden="true" />
          </div>
          <p className="text-sm font-medium text-foreground">Cuotas pagadas en su totalidad</p>
        </div>
      )}

      {/* Timeline nodes */}
      {sorted.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-8">
          <p className="text-sm text-muted-foreground">Aún no generaste cuotas</p>
          {isActive && onAddPayment && (
            <Button size="sm" onClick={onAddPayment}>
              Agregar Pago
            </Button>
          )}
        </div>
      ) : (
        <div ref={focusRef} className="space-y-4">
          {sorted.map((payment, idx) => {
            const days = payment.dueDate
              ? daysFromNowInBusinessTz(payment.dueDate, new Date(nowKey), "America/Santiago")
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
