"use client";

import { PaymentCard } from "./payment-card";
import { getDaysUntilDue, sortByDueDate } from "@/lib/payments/payment-status";
import type { Payment } from "@/components/payments/payments-table";

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
  /** Controls the empty-state copy only — celebratory strip was removed (2026-Q3 cleanup). */
  variant?: "reservation" | "extra";
  /** Id del primer pago vencido — recibe el foco desde la focus card de la sección. */
  firstOverdueId?: string | null;
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
  firstOverdueId,
}: PaymentsCardsListProps) {
  // Variant-driven copy — diferenciado por variant en estado activo e inactivo
  // para que las dos secciones de la reserva (arriendo + extras) tengan copy propia.
  const activeEmptyMessage =
    variant === "extra"
      ? "Aún no hay cobros extra registrados"
      : "Aún no hay pagos registrados";
  const inactiveEmptyMessage =
    variant === "extra"
      ? "Esta reserva no tiene cobros extra registrados."
      : "Esta reserva no tiene pagos registrados.";

  // Orden por urgencia de cobro: sin esto el pago mas atrasado podia quedar
  // ultimo, debajo de un KPI que anunciaba que habia vencidos.
  const sorted = sortByDueDate(payments);

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {/* Empty state — solo mensaje. El CTA "Agregar Pago" vive en el header de la
          sección padre (no se duplica aquí), evitando dos botones con la misma acción
          cuando la lista está vacía. El strip celebratorio "Pago cobrado · $X" fue
          eliminado: redundaba con el KPI "Pagado" del header y con el badge "Pagado"
          de cada PaymentCard. La lista queda plana, sin summary interno. */}
      {sorted.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-10">
          <p className="text-sm text-muted-foreground">
            {isActive ? activeEmptyMessage : inactiveEmptyMessage}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {sorted.map((payment, idx) => (
            <PaymentCard
              key={payment.id}
              payment={payment}
              index={idx}
              total={sorted.length}
              daysUntilDue={getDaysUntilDue(payment.dueDate)}
              isFirstOverdue={payment.id === firstOverdueId}
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