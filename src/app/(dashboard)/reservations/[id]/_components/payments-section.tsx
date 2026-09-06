"use client";

import { AlertCircle, ArrowDown, CheckCircle2, MinusCircle, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/ui/kpi-card";
import { isOverdueDateOnly, nowKeyInBusinessTz } from "@/lib/domain/timezone";
import { getReservationPaidAmount, getReservationPendingAmount } from "@/lib/payments/calculations";
import { PaymentsCardsList } from "./payments-cards-list";
import { PaymentsTimeline } from "./payments-timeline";
import { sortByDueDate } from "@/lib/payments/payment-status";
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
  // En una reserva viva el pendiente es `totalPrice - pagado`: las cuotas futuras
  // pueden no estar generadas todavía, así que el contrato es la fuente de verdad.
  // En una reserva cerrada no: `cancelReservation` borra los pagos PENDING, y una
  // COMPLETED ya no genera cuotas nuevas. Ahí `totalPrice - pagado` anuncia una
  // deuda que no existe ni tiene fila que cobrar — el pendiente real es la suma de
  // los pagos PENDING que quedan (0 tras una cancelación).
  const pendingAmount = isActive
    ? getReservationPendingAmount(payments, Number(totalPrice))
    : reservationPayments
        .filter((p) => p.status === "PENDING" && !p.deletedAt)
        .reduce((sum, p) => sum + Number(p.amount || 0), 0);
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
  const totalContract = Number(totalPrice) + extraTotal;
  const collectedPct = totalContract > 0 ? Math.round((totalPaid / totalContract) * 100) : 0;
  // En una reserva cerrada nada de lo que falta se va a cobrar, asi que la
  // tercera card deja de ser "por cobrar" y pasa a ser la conciliacion:
  // Total = Cobrado + No cobrado. Antes ese hueco no se explicaba en ninguna
  // parte — la pagina mostraba Total $480.000, Cobrado $220.000, Pendiente $0.
  const uncollected = Math.max(totalContract - totalPaid, 0);
  const showUncollected = !isActive && uncollected > 0;

  // Primer pago de arriendo vencido: destino del foco de la focus card. Se
  // decide aca y no dentro de cada lista, para que las dos coincidan.
  const firstOverdueId =
    sortByDueDate(
      reservationPayments.filter(
        (p) => p.status === "PENDING" && !p.deletedAt && isOverdueDateOnly(p.dueDate, nowKey),
      ),
    )[0]?.id ?? null;

  const handleFocusFirstOverdue = () => {
    if (!firstOverdueId) return;
    const el = document.querySelector<HTMLElement>(`[data-payment-id="${firstOverdueId}"]`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.focus?.();
  };

  return (
    // `@container`: los hijos (KPIs y filas de pago más abajo) miden el ANCHO DE
    // ESTA COLUMNA, no el viewport. Necesario porque el layout de 2 columnas de
    // `reservation-detail-client.tsx` deja este panel en ~360px cuando el viewport
    // mide 1024px pero ~756px cuando mide 1440px — un breakpoint `sm:`/`lg:` de
    // Tailwind (basado en viewport) no puede distinguir esos dos casos y por eso
    // el grid de KPIs y las filas de pago se rompían en anchos intermedios de
    // viewport (bug P0, ver fix/reservation-detail-contraste-y-comprobante).
    <div className="space-y-6 @container">
      {/* KPIs. Antes eran cuatro cifras del mismo peso, y dos de ellas eran el
          mismo hecho: "Vencido" es un SUBCONJUNTO de "Pendiente", asi que podian
          mostrar el mismo numero lado a lado en ambar y rojo sin nada que dijera
          que uno contiene al otro. Ahora son tres y lo vencido vive dentro de
          "Por cobrar" como indicador, que es donde el owner ya esta mirando.
          `@xl` (576px de CONTENEDOR): con tres cards de ~181px cabe la cifra mas
          larga del dominio (8 digitos, ~123px + 32px de padding). La tercera
          ocupa el ancho completo mientras se apilan de a dos: es la card que
          pide accion. */}
      <div className="grid grid-cols-2 @xl:grid-cols-3 gap-3 @xl:gap-4">
        <KpiCard
          label="Total"
          value={formatPrice(totalContract)}
          icon={Wallet}
          tone="default"
        />
        <KpiCard
          label="Cobrado"
          value={formatPrice(totalPaid)}
          icon={CheckCircle2}
          tone={totalPaid > 0 ? "success" : "default"}
          progressBar={{ value: collectedPct }}
        />
        <div className="col-span-2 @xl:col-span-1">
          {showUncollected ? (
            <KpiCard
              label="No cobrado"
              value={formatPrice(uncollected)}
              icon={MinusCircle}
              tone="default"
              sublabel={status === "CANCELLED" ? "Reserva cancelada" : "Reserva finalizada"}
            />
          ) : (
            <KpiCard
              label="Por cobrar"
              value={formatPrice(totalPending)}
              icon={AlertCircle}
              tone={totalPending > 0 ? "warning" : "success"}
              indicator={
                overdueAmount > 0
                  ? {
                      text: `${formatPrice(overdueAmount)} vencidos`,
                      variant: "warning",
                    }
                  : undefined
              }
            />
          )}
        </div>
      </div>

      {/* Focus card de vencidas. Vivia dentro de PaymentsTimeline, asi que solo
          existia para reservas mensuales: en las diarias el KPI anunciaba dinero
          atrasado y no habia forma de llegar a el. Ahora esta sobre las dos. */}
      {overdueCount > 0 && isActive && firstOverdueId && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-4">
          <div className="flex-auto">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
              {isMonthly ? "Cuotas vencidas" : "Pagos vencidos"}
            </p>
            <p className="text-sm font-medium text-destructive-text">
              {isMonthly
                ? `Tienes ${overdueCount} ${overdueCount === 1 ? "cuota vencida" : "cuotas vencidas"}`
                : `Tienes ${overdueCount} ${overdueCount === 1 ? "pago vencido" : "pagos vencidos"}`}{" "}
              · {formatPrice(overdueAmount)}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 gap-1.5"
            onClick={handleFocusFirstOverdue}
          >
            <ArrowDown className="size-3.5" />
            {isMonthly ? "Ir a la primera cuota vencida" : "Ir al primer pago vencido"}
          </Button>
        </div>
      )}

      {/* Listado de pagos — header solo título (acciones viven en el top bar). */}
      <div className="space-y-3">
        <SectionHeader title={isMonthly ? "Cuotas de arriendo" : "Pagos de reserva"} />

        {isMonthly ? (
          <PaymentsTimeline
            payments={reservationPayments}
            isActive={isActive}
            firstOverdueId={firstOverdueId}
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
            firstOverdueId={firstOverdueId}
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
