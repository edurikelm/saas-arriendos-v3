"use client";

import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PaymentCard } from "./payment-card";
import type { Payment } from "@/components/payments/payments-table";

function formatPrice(price: string | number): string {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(price));
}

interface PaymentsCardsListProps {
  payments: Payment[];
  nowKey: string;
  isActive: boolean;
  onGenerateLink?: (paymentId: string) => void;
  onRegenerateLink?: (paymentId: string) => void;
  onMarkPaid?: (paymentId: string) => void;
  onDeletePayment?: (paymentId: string) => void;
  onUploadReceipt?: (paymentId: string, file: File) => Promise<{ error?: string }>;
  onSendLink?: (payment: Payment) => void;
  generatingLinkId?: string | null;
  regeneratingLinkId?: string | null;
  /** Controls celebratory copy and empty-state message. */
  variant?: "reservation" | "extra";
  // Empty state CTA
  onAddPayment?: () => void;
}

export function PaymentsCardsList({
  payments,
  nowKey,
  isActive,
  onGenerateLink,
  onRegenerateLink,
  onMarkPaid,
  onDeletePayment,
  onUploadReceipt,
  onSendLink,
  generatingLinkId,
  regeneratingLinkId,
  variant = "reservation",
  onAddPayment,
}: PaymentsCardsListProps) {
  const totalPaid = payments.reduce((sum, p) => sum + (p.status === "COMPLETED" ? Number(p.amount) : 0), 0);
  const allCompleted = payments.length > 0 && payments.every((p) => p.status === "COMPLETED");

  // Variant-driven copy
  const celebratoryText =
    payments.length === 1
      ? `Pago cobrado · ${formatPrice(payments[0].amount)}`
      : `${payments.length} pagos · ${formatPrice(totalPaid)} cobrados`;
  const emptyMessage =
    variant === "extra"
      ? "Aún no hay cobros extra registrados"
      : "Aún no hay pagos registrados";

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {/* Fully paid compact summary strip — único "summary" dentro del contenedor.
          El KPI "Pendiente" ya carga el saldo arriba; este strip solo se luce cuando
          todo está cobrado (celebratorio, no redundante). */}
      {allCompleted && payments.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <CheckCircle2 className="size-4 text-success shrink-0" aria-hidden="true" />
          <p className="text-sm text-success">{celebratoryText}</p>
        </div>
      )}

      {/* Payment items or empty state */}
      {payments.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-10">
          <p className="text-sm text-muted-foreground">
            {isActive ? emptyMessage : "Esta reserva no tiene pagos registrados."}
          </p>
          {isActive && onAddPayment && (
            <Button size="sm" onClick={onAddPayment}>
              Agregar Pago
            </Button>
          )}
        </div>
      ) : (
        <div className="divide-y divide-border">
          {payments.map((payment, idx) => (
            <PaymentCard
              key={payment.id}
              payment={payment}
              index={idx}
              total={payments.length}
              nowKey={nowKey}
              isActive={isActive}
              onGenerateLink={onGenerateLink}
              onRegenerateLink={onRegenerateLink}
              onMarkPaid={onMarkPaid}
              onDeletePayment={onDeletePayment}
              onUploadReceipt={onUploadReceipt}
              onSendLink={onSendLink}
              generatingLinkId={generatingLinkId}
              regeneratingLinkId={regeneratingLinkId}
            />
          ))}
        </div>
      )}
    </div>
  );
}