"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { PaymentRowActions } from "./payment-row-actions";
import {
  METHOD_LABELS,
  getConceptSubline,
  getStatusDateLine,
  paymentStatusConfig,
  getConceptBadges,
  isPaymentExpired,
  formatAmount,
  type Payment,
} from "./payments-table";

export interface PaymentListItemProps {
  payment: Payment;
  onGenerateLink?: (paymentId: string) => void;
  onRegenerateLink?: (paymentId: string) => void;
  onMarkPaid?: (paymentId: string) => void;
  onDeletePayment?: (paymentId: string) => void;
  onAttachReceipt?: (paymentId: string) => void;
  onUploadReceipt?: (paymentId: string, file: File) => Promise<{ error?: string }>;
  onSendLink?: (payment: Payment) => void;
  generatingLinkId?: string | null;
  regeneratingLinkId?: string | null;
  attachingReceiptId?: string | null;
}

/**
 * Fila de pago en móvil (<768px). Es una FILA dentro de un contenedor único,
 * no una card por pago — mismo criterio que `ReservationListItem`: veinte
 * cards apiladas repiten veinte marcos para un solo objeto, y el framing de
 * `DataTable` alrededor del contenedor hace que la lista se lea como la misma
 * tabla en otro ancho.
 *
 * La tabla de once columnas era inalcanzable acá: 1668px de ancho en una
 * pantalla de 375px dejaban visibles la fecha de creación y el cliente, con
 * monto, estado y acciones a más de 1300px de scroll horizontal. Como la fila
 * no es clickeable (The Row Isolation Rule), eso dejaba la página de solo
 * lectura en el teléfono.
 *
 * Las acciones van en su propia línea al pie y no junto al nombre: las
 * etiquetas del sistema son largas ("Descargar comprobante PDF") y a 375px no
 * entran al lado de nada. `flex-wrap` porque `<Button>` trae `shrink-0` en su
 * base y no comprime — sin wrap, el sobrante se dibuja encima de la celda
 * vecina sin que nada lo señale.
 */
export function PaymentListItem({
  payment,
  onGenerateLink,
  onRegenerateLink,
  onMarkPaid,
  onDeletePayment,
  onAttachReceipt,
  onUploadReceipt,
  onSendLink,
  generatingLinkId,
  regeneratingLinkId,
  attachingReceiptId,
}: PaymentListItemProps) {
  const statusCfg = paymentStatusConfig[payment.status] ?? paymentStatusConfig.PENDING;
  const isPending = payment.status === "PENDING";
  const isMercadoPago = payment.method === "MERCADO_PAGO";
  const isExpired = isPaymentExpired(payment);
  const conceptSubline = getConceptSubline(payment);
  const dateLine = getStatusDateLine(payment);

  return (
    <div className="border-b border-border p-4 last:border-0">
      {/* Cliente · propiedad */}
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-foreground">
          {payment.clientName ?? "—"}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {payment.propertyName ?? "—"}
        </p>
      </div>

      {/* Concepto · estado */}
      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5">
        {getConceptBadges(payment).map((badge) => (
          <Badge
            key={badge.label}
            variant={badge.variant}
            className="text-[10px] font-bold uppercase tracking-tight"
          >
            {badge.label}
          </Badge>
        ))}
        <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
        {isPending && isMercadoPago && isExpired && (
          <Badge variant="destructive">Expirado</Badge>
        )}
      </div>

      {/* Monto. Lleva label propio: en la tabla el nombre de la magnitud lo
          pone el `<th>`, y una lista no tiene encabezado. */}
      <div className="mt-2 flex items-baseline justify-between gap-3">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Monto
        </span>
        <span className="flex min-w-0 items-baseline gap-2">
          <span
            className={cn(
              "truncate text-[10px] tabular-nums",
              dateLine.className ?? "text-muted-foreground",
            )}
          >
            {dateLine.text}
          </span>
          <span className="shrink-0 text-xs font-bold tabular-nums text-foreground">
            {formatAmount(payment.amount)}
          </span>
        </span>
      </div>

      {/* Medio de pago · cuota y descripción */}
      <p className="mt-1 line-clamp-1 text-[10px] text-muted-foreground">
        {[METHOD_LABELS[payment.method], conceptSubline].filter(Boolean).join(" · ") || "—"}
      </p>

      <div className="mt-3 flex flex-wrap items-center justify-end gap-1">
        <PaymentRowActions
          payment={payment}
          onGenerateLink={onGenerateLink}
          onRegenerateLink={onRegenerateLink}
          onMarkPaid={onMarkPaid}
          onDeletePayment={onDeletePayment}
          onAttachReceipt={onAttachReceipt}
          onUploadReceipt={onUploadReceipt}
          onSendLink={onSendLink}
          generatingLinkId={generatingLinkId}
          regeneratingLinkId={regeneratingLinkId}
          attachingReceiptId={attachingReceiptId}
          showReservationLink
        />
      </div>
    </div>
  );
}
