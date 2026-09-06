"use client";

import { PaymentTimelineNode } from "./payment-timeline-node";
import { daysFromTodayDateOnly, nowKeyInBusinessTz } from "@/lib/domain/timezone";
import type { Payment } from "@/components/payments/payments-table";

interface PaymentsTimelineProps {
  payments: Payment[];
  isActive: boolean;
  /** Id del primer pago vencido — lo decide PaymentsSection, que tambien
   *  renderiza la focus card que lleva el foco hasta aca. */
  firstOverdueId?: string | null;
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
  firstOverdueId,
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


  return (
    <div className="space-y-4">
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
