"use client";

import { CheckCircle2, ExternalLink } from "lucide-react";
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
  pendingAmount: number;
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
  pendingAmount,
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

  // First pending MercadoPago payment eligible for link generation
  const firstMercadoPagoPending = payments.find(
    (p) => p.status === "PENDING" && p.method === "MERCADO_PAGO" && !p.initPoint,
  );

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
    <div className="space-y-4">
      {/* Saldo pendiente focus card — solo si hay pendiente y reserva activa */}
      {!allCompleted && pendingAmount > 0 && isActive && (
        <div className="rounded-lg border border-info/20 bg-info/5 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                Saldo pendiente
              </p>
              <p className="text-2xl font-bold tabular-nums text-foreground">
                {formatPrice(pendingAmount)}
              </p>
            </div>
            {firstMercadoPagoPending ? (
              <Button
                size="sm"
                className="shrink-0"
                onClick={() => onGenerateLink?.(firstMercadoPagoPending.id)}
              >
                <ExternalLink className="size-4 mr-1.5" />
                Generar link de Mercado Pago
              </Button>
            ) : (
              <Button size="sm" className="shrink-0" onClick={onAddPayment}>
                Agregar Pago
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Fully paid compact summary strip */}
      {allCompleted && payments.length > 0 && (
        <div className="flex items-center gap-2 py-2 px-3">
          <CheckCircle2 className="size-4 text-success shrink-0" aria-hidden="true" />
          <p className="text-sm text-success">{celebratoryText}</p>
        </div>
      )}

      {/* Payment cards */}
      {payments.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-8">
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
        <div className="space-y-4">
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
