"use client";

import { CheckCircle2 } from "lucide-react";
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
}: PaymentsCardsListProps) {
  const totalPaid = payments.reduce((sum, p) => sum + (p.status === "COMPLETED" ? Number(p.amount) : 0), 0);
  const allCompleted = payments.length > 0 && payments.every((p) => p.status === "COMPLETED");

  // Variant-driven copy — diferenciado por variant en estado activo e inactivo
  // para que las dos secciones de la reserva (arriendo + extras) tengan copy propia.
  const celebratoryText =
    payments.length === 1
      ? `Pago cobrado · ${formatPrice(payments[0].amount)}`
      : `${payments.length} pagos · ${formatPrice(totalPaid)} cobrados`;
  const activeEmptyMessage =
    variant === "extra"
      ? "Aún no hay cobros extra registrados"
      : "Aún no hay pagos registrados";
  const inactiveEmptyMessage =
    variant === "extra"
      ? "Esta reserva no tiene cobros extra registrados."
      : "Esta reserva no tiene pagos registrados.";

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

      {/* Empty state — solo mensaje. El CTA "Agregar Pago" vive en el header de la
          sección padre (no se duplica aquí), evitando dos botones con la misma acción
          cuando la lista está vacía. */}
      {payments.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-10">
          <p className="text-sm text-muted-foreground">
            {isActive ? activeEmptyMessage : inactiveEmptyMessage}
          </p>
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