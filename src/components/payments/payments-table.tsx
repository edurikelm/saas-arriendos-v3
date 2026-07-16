"use client";

import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { DataTable, type DataTableHeader } from "@/components/ui/data-table";
import { PaymentRowActions } from "./payment-row-actions";

/**
 * Variantes explícitas de la tabla de pagos.
 *
 * Antes: 3 boolean props (`showInstallmentColumns`, `showConceptColumn`,
 * `showContextColumns`) que el caller combinaba en 8 formas posibles,
 * pero solo 3 combinaciones se usaban en producción. Eso es "boolean prop
 * proliferation" — el caller piensa "¿qué columnas enciendo?" en vez de
 * "¿qué vista quiero?".
 *
 * Ahora: 3 variants que mapean a los 3 casos de uso reales:
 * - `"reservation"`: pagos de arriendo dentro de una reserva (sin context,
 *   sin concept). Las columnas de installment se auto-detectan desde los
 *   datos: si algún pago tiene `installmentIndex` o `installmentLabel`,
 *   se muestran; si no, se ocultan. Esto cubre tanto reservas DAILY
 *   (sin installments) como MONTHLY (con installments) sin que el
 *   caller tenga que pasar el `billingType`.
 * - `"extra"`: cobros extra dentro de una reserva (con concept, sin
 *   installment, sin context).
 * - `"full"`: listado completo /payments (todas las columnas).
 */
export type PaymentsTableVariant = "reservation" | "extra" | "full";

export interface Payment {
  id: string;
  installmentIndex?: number | null;
  amount: string;
  dueDate?: string | null;
  status: string;
  method: string;
  initPoint?: string | null;
  expiresAt?: string | null;
  paidAt?: string | null;
  deletedAt?: string | null;
  receiptUrl?: string | null;
  paymentType?: string | null;
  title?: string | null;
  description?: string | null;
  overdueDays?: number | null;
  installmentLabel?: string | null;
  createdAt?: string | Date | null;
  clientName?: string | null;
  propertyName?: string | null;
}

const paymentStatusConfig: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" | "warning" | "success" }
> = {
  PENDING: { label: "Pendiente", variant: "warning" },
  COMPLETED: { label: "Pagado", variant: "success" },
  FAILED: { label: "Fallido", variant: "destructive" },
};

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("es-CL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDueDate(dateString: string | null | undefined): string {
  if (!dateString) return "—";
  return format(new Date(dateString), "d MMM yyyy", { locale: es });
}

function formatAmount(amount: string | number): string {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(amount));
}

function getConceptLabel(payment: Payment): { primary: string } {
  // Pago EXTRA → título obligatorio del modelo
  if (payment.paymentType === "EXTRA") {
    return { primary: payment.title ?? "Cobro extra" };
  }

  // Pago RESERVATION mensual con cuota → "Mensualidad"
  if (payment.paymentType === "RESERVATION" && payment.installmentIndex != null) {
    return { primary: "Mensualidad" };
  }

  // Pago RESERVATION diario (sin cuota) → "Arriendo"
  return { primary: "Arriendo" };
}

type ConceptVariant = "info" | "warning";

function isPaymentExpired(payment: Payment): boolean {
  if (!payment.expiresAt) return false;
  return new Date(payment.expiresAt) < new Date();
}

function getConceptBadgeVariant(payment: Payment): ConceptVariant {
  // EXTRA → warning (atención: cobro adicional al arriendo)
  if (payment.paymentType === "EXTRA") {
    return "warning";
  }
  // RESERVATION (Arriendo o Mensualidad) → info (caso estándar)
  return "info";
}

export function PaymentsTable({
  payments,
  onGenerateLink,
  onRegenerateLink,
  onMarkPaid,
  onDeletePayment,
  onAttachReceipt,
  onSendLink,
  variant,
  generatingLinkId,
  regeneratingLinkId,
  attachingReceiptId,
  compact = false,
}: {
  payments: Payment[];
  onGenerateLink?: (paymentId: string) => void;
  onRegenerateLink?: (paymentId: string) => void;
  onMarkPaid?: (paymentId: string) => void;
  onDeletePayment?: (paymentId: string) => void;
  onAttachReceipt?: (paymentId: string) => void;
  onSendLink?: (payment: Payment) => void;
  variant: PaymentsTableVariant;
  generatingLinkId?: string | null;
  regeneratingLinkId?: string | null;
  attachingReceiptId?: string | null;
  compact?: boolean;
}) {
  // Auto-detect installment column visibility for the "reservation" variant:
  // if any payment has installment data, show the columns; otherwise hide them.
  // This eliminates the need for the caller to know the billingType.
  const hasInstallmentData = payments.some(
    (p) => p.installmentIndex != null || p.installmentLabel != null,
  );

  // Map variant → column visibility booleans (used only internally now)
  const showContextColumns = variant === "full";
  const showConceptColumn = variant === "extra" || variant === "full";
  const showInstallmentColumns =
    variant === "full" || (variant === "reservation" && hasInstallmentData);

  // Build headers array based on resolved column visibility
  const headers: DataTableHeader[] = [
    ...(showContextColumns ? ["Fecha creación", "Cliente", "Propiedad"] : []),
    ...(showInstallmentColumns ? ["Cuota"] : []),
    ...(showConceptColumn ? ["Concepto"] : []),
    { label: "Monto", align: "right" },
    ...(showInstallmentColumns ? ["Vencimiento"] : []),
    "Fecha Pago",
    "Medio",
    "Estado",
    { label: "Acciones", align: "right" },
  ];

  const sortedPayments = [...payments].sort(
    (a, b) => (a.installmentIndex ?? 0) - (b.installmentIndex ?? 0)
  );

  return (
    <DataTable headers={headers} caption="Listado de pagos">
      {sortedPayments.length === 0 ? null : sortedPayments.map((payment) => {
        const statusCfg = paymentStatusConfig[payment.status] || paymentStatusConfig.PENDING;
        const isPending = payment.status === "PENDING";
        const isMercadoPago = payment.method === "MERCADO_PAGO";
        const isExpired = isPaymentExpired(payment);
        return (
          <tr key={payment.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
            {showContextColumns && (
              <>
                <td className="px-6 py-4">
                  <p className="text-xs text-muted-foreground whitespace-nowrap">
                    {payment.createdAt ? formatDate(String(payment.createdAt)) : "—"}
                  </p>
                </td>
                <td className="px-6 py-4">
                  <p className="font-bold text-xs text-foreground truncate">{payment.clientName ?? "—"}</p>
                </td>
                <td className="px-6 py-4">
                  <p className="text-xs text-muted-foreground truncate">{payment.propertyName ?? "—"}</p>
                </td>
              </>
            )}
            {showInstallmentColumns && (
              <td className="px-6 py-4">
                <p className="text-xs font-medium text-foreground">
                  {payment.installmentLabel ?? payment.installmentIndex ?? "—"}
                </p>
              </td>
            )}
            {showConceptColumn && (
              <td className="px-6 py-4">
                <div className="flex flex-col gap-1">
                  <Badge
                    variant={getConceptBadgeVariant(payment)}
                    className="w-fit text-[10px] font-bold uppercase tracking-tight"
                  >
                    {getConceptLabel(payment).primary}
                  </Badge>
                  {payment.description && (
                    <p className="text-[10px] text-muted-foreground line-clamp-1">{payment.description}</p>
                  )}
                </div>
              </td>
            )}
            <td className="px-6 py-4">
              <p className="text-xs font-bold text-foreground tabular-nums">
                {formatAmount(payment.amount)}
              </p>
            </td>
            {showInstallmentColumns && (
              <td className="px-6 py-4">
                <p className="text-xs text-muted-foreground">
                  {payment.dueDate ? formatDueDate(payment.dueDate) : "—"}
                </p>
              </td>
            )}
            <td className="px-6 py-4">
              <p className="text-xs text-muted-foreground">
                {payment.paidAt ? formatDate(payment.paidAt) : "—"}
              </p>
            </td>
            <td className="px-6 py-4">
              <p className="text-xs text-muted-foreground">
                {payment.method === "MERCADO_PAGO" ? "Mercado Pago" : payment.method === "CASH" ? "Efectivo" : payment.method === "TRANSFER" ? "Transferencia" : "—"}
              </p>
            </td>
            <td className="px-6 py-4 align-middle">
              <div className="flex flex-col gap-1">
                <Badge variant={statusCfg.variant} className="h-5 text-[11px] font-medium w-fit">
                  {statusCfg.label}
                </Badge>
                {isPending && payment.overdueDays != null && payment.overdueDays > 0 && (
                  <p className="text-[10px] text-destructive">
                    Vencido hace {payment.overdueDays} {payment.overdueDays === 1 ? "día" : "días"}
                  </p>
                )}
                {isPending && isMercadoPago && isExpired && (
                  <Badge variant="destructive" className="h-5 text-[11px] font-medium w-fit">
                    Expirado
                  </Badge>
                )}
              </div>
            </td>
            <td className="px-6 py-4 text-right">
              <PaymentRowActions
                payment={payment}
                onGenerateLink={onGenerateLink}
                onRegenerateLink={onRegenerateLink}
                onMarkPaid={onMarkPaid}
                onDeletePayment={onDeletePayment}
                onAttachReceipt={onAttachReceipt}
                onSendLink={onSendLink}
                generatingLinkId={generatingLinkId}
                regeneratingLinkId={regeneratingLinkId}
                attachingReceiptId={attachingReceiptId}
                compact={compact}
              />
            </td>
          </tr>
        );
      })}
    </DataTable>
  );
}
