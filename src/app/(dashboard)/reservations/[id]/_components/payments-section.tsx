"use client";

import { AlertCircle, CheckCircle2, Wallet } from "lucide-react";
import { KpiCard } from "@/components/ui/kpi-card";
import { isOverdueDateOnly, nowKeyInBusinessTz } from "@/lib/domain/timezone";
import { getReservationPaidAmount, getReservationPendingAmount } from "@/lib/payments/calculations";
import { PaymentsCardsList } from "./payments-cards-list";
import { PaymentsTimeline } from "./payments-timeline";
import type { Payment } from "@/components/payments/payments-table";

function formatPrice(price: string | number): string {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(price));
}

/** Pagos pendientes (RESERVATION, no EXTRA) cuya fecha de vencimiento ya pasó.
 *  `dueDate` es date-only (ADR-0020 / dominio): `isOverdueDateOnly` lee su
 *  día calendario directo, sin reinterpretar en zona, y lo compara contra
 *  "hoy" en wall-time America/Santiago. */
function getOverdueAmount(payments: Payment[]): number {
  const nowKey = nowKeyInBusinessTz();
  return payments
    .filter(
      (p) =>
        p.status === "PENDING" &&
        !p.deletedAt &&
        (p.paymentType ?? "RESERVATION") !== "EXTRA" &&
        isOverdueDateOnly(p.dueDate, nowKey),
    )
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);
}

function getOverdueCount(payments: Payment[]): number {
  const nowKey = nowKeyInBusinessTz();
  return payments.filter(
    (p) =>
      p.status === "PENDING" &&
      !p.deletedAt &&
      (p.paymentType ?? "RESERVATION") !== "EXTRA" &&
      isOverdueDateOnly(p.dueDate, nowKey),
  ).length;
}

export interface PaymentsSectionActions {
  onGenerateLink: (paymentId: string) => void;
  onRegenerateLink: (paymentId: string) => void;
  onMarkPaid: (paymentId: string) => void;
  onDeletePayment: (paymentId: string) => void;
  onUploadReceipt: (paymentId: string, file: File) => Promise<{ error?: string }>;
  onSendLink: (payment: Payment) => void;
  generatingLinkId: string | null;
  regeneratingLinkId: string | null;
}

interface PaymentsSectionProps {
  /** Precio total de la reserva (sin extras). Necesario para los KPIs. */
  totalPrice: string;
  billingType: string;
  status: string;
  payments: Payment[];
  /** Handlers + state de usePaymentActions (el padre los provee). */
  actions: PaymentsSectionActions;
  /** Modal components renderizados al final de la sección (Mark paid, Add payment,
   *  Delete confirm, Send link). El state vive en el `usePaymentActions` del padre. */
  modals: React.ReactNode;
}

/** Encabezado unificado para sub-secciones de pagos: solo título + meta opcional.
 *  Las acciones (Verificar MP, Agregar Pago) viven en el top bar del detail —
 *  este header ya no las renderiza para evitar duplicación. */
function SectionHeader({
  title,
  meta,
}: {
  title: string;
  meta?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-3">
      <div className="space-y-0.5 min-w-0">
        <p className="text-sm font-bold text-foreground leading-tight">{title}</p>
        {meta && (
          <p className="text-xs text-muted-foreground leading-tight">{meta}</p>
        )}
      </div>
    </div>
  );
}

export function PaymentsSection({
  totalPrice,
  billingType,
  status,
  payments,
  actions,
  modals,
}: PaymentsSectionProps) {
  const nowKey = nowKeyInBusinessTz();
  const isActive = status !== "CANCELLED" && status !== "COMPLETED";

  const reservationPayments = payments.filter((p) => p.paymentType !== "EXTRA");
  const extraPayments = payments.filter((p) => p.paymentType === "EXTRA");

  const paidAmount = getReservationPaidAmount(payments);
  const pendingAmount = getReservationPendingAmount(payments, Number(totalPrice));
  const extraTotal = extraPayments.reduce((sum, p) => sum + Number(p.amount), 0);
  const extraPaidAmount = extraPayments
    .filter((p) => p.status === "COMPLETED")
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const extraPendingAmount = Math.max(extraTotal - extraPaidAmount, 0);
  const totalPaid = paidAmount + extraPaidAmount;
  const totalPending = pendingAmount + extraPendingAmount;
  const overdueAmount = getOverdueAmount(payments);
  const overdueCount = getOverdueCount(payments);

  const isMonthly = billingType === "MONTHLY";

  return (
    <div className="space-y-6">
      {/* KPIs — sin título encima, los números son el resumen */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard
          label="Total"
          value={formatPrice(Number(totalPrice) + extraTotal)}
          icon={Wallet}
          tone="default"
        />
        <KpiCard
          label="Pagado"
          value={formatPrice(totalPaid)}
          icon={CheckCircle2}
          tone="success"
        />
        <KpiCard
          label="Pendiente"
          value={formatPrice(totalPending)}
          icon={AlertCircle}
          tone={totalPending > 0 ? "warning" : "success"}
        />
        <KpiCard
          label="Vencido"
          value={formatPrice(overdueAmount)}
          icon={AlertCircle}
          tone={overdueAmount > 0 ? "destructive" : "default"}
        />
      </div>

      {/* Listado de pagos — header solo título (acciones viven en el top bar). */}
      <div className="space-y-3">
        <SectionHeader title={isMonthly ? "Cuotas de arriendo" : "Pagos de reserva"} />

        {isMonthly ? (
          <PaymentsTimeline
            payments={reservationPayments}
            isActive={isActive}
            overdueCount={overdueCount}
            overdueAmount={overdueAmount}
            onGenerateLink={actions.onGenerateLink}
            onRegenerateLink={actions.onRegenerateLink}
            onMarkPaid={actions.onMarkPaid}
            onDeletePayment={actions.onDeletePayment}
            onUploadReceipt={actions.onUploadReceipt}
            onSendLink={actions.onSendLink}
            generatingLinkId={actions.generatingLinkId}
            regeneratingLinkId={actions.regeneratingLinkId}
          />
        ) : (
          <PaymentsCardsList
            payments={reservationPayments}
            nowKey={nowKey}
            isActive={isActive}
            onGenerateLink={actions.onGenerateLink}
            onRegenerateLink={actions.onRegenerateLink}
            onMarkPaid={actions.onMarkPaid}
            onDeletePayment={actions.onDeletePayment}
            onUploadReceipt={actions.onUploadReceipt}
            onSendLink={actions.onSendLink}
            generatingLinkId={actions.generatingLinkId}
            regeneratingLinkId={actions.regeneratingLinkId}
          />
        )}
      </div>

      {/* Cobros extra — siempre visible (empty state vive en PaymentsCardsList). */}
      <div className="space-y-3">
        <SectionHeader title="Cobros extra" />
        <PaymentsCardsList
          payments={extraPayments}
          nowKey={nowKey}
          isActive={isActive}
          variant="extra"
          onGenerateLink={actions.onGenerateLink}
          onRegenerateLink={actions.onRegenerateLink}
          onMarkPaid={actions.onMarkPaid}
          onDeletePayment={actions.onDeletePayment}
          onUploadReceipt={actions.onUploadReceipt}
          onSendLink={actions.onSendLink}
          generatingLinkId={actions.generatingLinkId}
          regeneratingLinkId={actions.regeneratingLinkId}
        />
      </div>

      {/* Modals (estado vive en el hook del padre; solo los renderizamos aquí). */}
      {modals}
    </div>
  );
}
