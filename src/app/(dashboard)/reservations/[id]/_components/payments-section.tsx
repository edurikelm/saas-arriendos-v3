"use client";

import { AlertCircle, CheckCircle2, Plus, RefreshCw, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/ui/kpi-card";
import { cn } from "@/lib/utils";
import { getReservationPaidAmount, getReservationPendingAmount } from "@/lib/payments/calculations";
import { isOverdueInBusinessTz, nowKeyInBusinessTz } from "@/lib/domain/timezone";
import { PaymentsTimeline } from "./payments-timeline";
import { PaymentsCardsList } from "./payments-cards-list";
import { usePaymentActions } from "./payment-actions";
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
 *  Usa `isOverdueInBusinessTz` (ADR-0020) para evitar sensibilidad a la zona
 *  del servidor (Vercel corre en UTC, negocio opera en America/Santiago). */
function getOverdueAmount(payments: Payment[]): number {
  const nowKey = nowKeyInBusinessTz();
  return payments
    .filter(
      (p) =>
        p.status === "PENDING" &&
        !p.deletedAt &&
        (p.paymentType ?? "RESERVATION") !== "EXTRA" &&
        isOverdueInBusinessTz(p.dueDate, nowKey),
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
      isOverdueInBusinessTz(p.dueDate, nowKey),
  ).length;
}

interface PaymentsSectionProps {
  reservationId: string;
  totalPrice: string;
  billingType: string;
  status: string;
  payments: Payment[];
  client: { name: string; email: string };
  propertyName: string;
}

/** Encabezado unificado para sub-secciones de pagos: título + acciones a la derecha.
 *  Funciona como header del listado al que precede — mismo patrón que Cobros extra. */
function SectionHeader({
  title,
  meta,
  actions,
}: {
  title: string;
  meta?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-3">
      <div className="space-y-0.5 min-w-0">
        <p className="text-sm font-bold text-foreground leading-tight">{title}</p>
        {meta && (
          <p className="text-xs text-muted-foreground leading-tight">{meta}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

export function PaymentsSection({
  reservationId,
  totalPrice,
  billingType,
  status,
  payments,
  client,
  propertyName,
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

  const {
    handleGenerateLink,
    handleRegenerateLink,
    handleMarkPaidClick,
    handleDeletePayment,
    handleUploadReceipt,
    handleRefreshPayments,
    handleSendLink,
    isCheckingAllPayments,
    generatingLinkId,
    regeneratingLinkId,
    setShowAddPaymentDialog,
    MarkPaidModal,
    AddPaymentModal,
    DeleteConfirmModal,
    SendLinkModal,
  } = usePaymentActions({
    reservationId,
    totalPrice,
    paidAmount,
    client,
    propertyName,
    billingType,
    isActive,
  });

  // "Verificar" solo cuando hay pagos MERCADO_PAGO (brief §5.8)
  const hasMercadoPagoPayments = payments.some((p) => p.method === "MERCADO_PAGO");
  const showHeaderVerify = isActive && hasMercadoPagoPayments;

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

      {/* Listado de pagos — header (título + acciones) precede al listado.
          Mismo patrón que Cobros extra: title a la izquierda, acciones a la derecha. */}
      <div className="space-y-3">
        <SectionHeader
          title={isMonthly ? "Cuotas de arriendo" : "Pagos de reserva"}
          actions={
            isActive && (
              <>
                {showHeaderVerify && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleRefreshPayments}
                    disabled={isCheckingAllPayments}
                  >
                    <RefreshCw
                      className={cn("h-3.5 w-3.5 mr-1.5", isCheckingAllPayments && "animate-spin")}
                    />
                    {isCheckingAllPayments ? "Verificando..." : "Verificar pagos MP"}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => setShowAddPaymentDialog(true)}
                >
                  <Plus className="h-4 w-4 mr-1.5" />
                  Agregar Pago
                </Button>
              </>
            )
          }
        />

        {isMonthly ? (
          <PaymentsTimeline
            payments={reservationPayments}
            isActive={isActive}
            overdueCount={overdueCount}
            overdueAmount={overdueAmount}
            onGenerateLink={handleGenerateLink}
            onRegenerateLink={handleRegenerateLink}
            onMarkPaid={handleMarkPaidClick}
            onDeletePayment={handleDeletePayment}
            onUploadReceipt={handleUploadReceipt}
            onSendLink={handleSendLink}
            generatingLinkId={generatingLinkId}
            regeneratingLinkId={regeneratingLinkId}
            onAddPayment={() => setShowAddPaymentDialog(true)}
          />
        ) : (
          <PaymentsCardsList
            payments={reservationPayments}
            nowKey={nowKey}
            isActive={isActive}
            onGenerateLink={handleGenerateLink}
            onRegenerateLink={handleRegenerateLink}
            onMarkPaid={handleMarkPaidClick}
            onDeletePayment={handleDeletePayment}
            onUploadReceipt={handleUploadReceipt}
            onSendLink={handleSendLink}
            generatingLinkId={generatingLinkId}
            regeneratingLinkId={regeneratingLinkId}
            onAddPayment={() => setShowAddPaymentDialog(true)}
          />
        )}
      </div>

      {/* Cobros extra (separado por space-y-6 del listado de arriendo) */}
      {extraPayments.length > 0 && (
        <div className="space-y-3">
          <SectionHeader
            title="Cobros extra"
            actions={
              isActive && (
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => setShowAddPaymentDialog(true)}
                >
                  <Plus className="h-4 w-4 mr-1.5" />
                  Agregar Pago
                </Button>
              )
            }
          />
          <PaymentsCardsList
            payments={extraPayments}
            nowKey={nowKey}
            isActive={isActive}
            onGenerateLink={handleGenerateLink}
            onRegenerateLink={handleRegenerateLink}
            onMarkPaid={handleMarkPaidClick}
            onDeletePayment={handleDeletePayment}
            onUploadReceipt={handleUploadReceipt}
            onSendLink={handleSendLink}
            generatingLinkId={generatingLinkId}
            regeneratingLinkId={regeneratingLinkId}
          />
        </div>
      )}

      {/* Modals */}
      <MarkPaidModal />
      <AddPaymentModal />
      <DeleteConfirmModal />
      <SendLinkModal />
    </div>
  );
}