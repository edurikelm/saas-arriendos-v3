"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { DataTable, type DataTableHeader } from "@/components/ui/data-table";
import { PaymentRowActions } from "./payment-row-actions";
import { cn } from "@/lib/utils";
import { formatDateOnly } from "@/lib/domain/timezone";

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
 * - `"full"`: listado completo /payments.
 *
 * `"full"` NO comparte el layout de las otras dos. Las variantes de reserva
 * son una columna por dato, que a seis o siete columnas entra sin problema en
 * el ancho de un diálogo. El listado global tenía once y necesitaba 1668px
 * contra los 1086px reales de un escritorio de 1440, así que agrupa los
 * mismos datos en cinco columnas a dos niveles: el dato arriba, su metadata
 * debajo. Ver `FULL_ACTIONS_CELL` para la medición completa.
 */
export type PaymentsTableVariant = "reservation" | "extra" | "full";

/**
 * Padding + hover de cada celda de la variante `"full"`. El hover vive en la
 * celda y no en el `<tr>` porque la columna de acciones es `sticky` y necesita
 * fondo propio: con el hover en la fila, la celda fija lo tapaba. Mismo patrón
 * que `reservation-table.tsx`, que resolvió esto antes.
 */
const FULL_CELL = "px-6 py-4 bg-card group-hover:bg-muted/30 transition-colors";

/**
 * La columna de acciones se fija al borde derecho.
 *
 * Medido al ancho real de contenido de un escritorio de 1440 (sidebar 256 +
 * padding 48 → 1086px útiles): la tabla de once columnas necesitaba 1668px, y
 * las cuatro últimas —fecha de pago, medio, estado y acciones— quedaban fuera
 * del área visible. Como las filas no son clickeables (The Row Isolation Rule)
 * el scroll horizontal era el único camino a Generar link / Marcar pagado /
 * Eliminar, sin nada que lo señalara: la tabla quedaba de solo lectura y el
 * corolario de esa regla lo advierte explícitamente.
 *
 * Bajar a cinco columnas resuelve el ancho hoy. Fijar la columna lo resuelve
 * también con nombres largos y a 1280, donde solo hay 976px.
 *
 * Lleva `px-4` en vez de `px-6`: los 16px que ahorra son margen real para la
 * columna de montos, que se dibuja por debajo de la fija al scrollear.
 */
const FULL_ACTIONS_CELL = "sticky right-0 z-10 border-l border-border px-4";

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

export const paymentStatusConfig: Record<
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
  return formatDateOnly(dateString, { day: "numeric", month: "short", year: "numeric" });
}

export function formatAmount(amount: string | number): string {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(amount));
}

export function getConceptLabel(payment: Payment): { primary: string } {
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

export function isPaymentExpired(payment: Payment): boolean {
  if (!payment.expiresAt) return false;
  return new Date(payment.expiresAt) < new Date();
}

export function getConceptBadgeVariant(payment: Payment): ConceptVariant {
  // EXTRA → warning (atención: cobro adicional al arriendo)
  if (payment.paymentType === "EXTRA") {
    return "warning";
  }
  // RESERVATION (Arriendo o Mensualidad) → info (caso estándar)
  return "info";
}

export const METHOD_LABELS: Record<string, string> = {
  MERCADO_PAGO: "Mercado Pago",
  CASH: "Efectivo",
  TRANSFER: "Transferencia",
};

/**
 * Segunda línea de la columna "Concepto": la cuota y la descripción del cobro.
 *
 * En la fila a dos niveles el badge dice QUÉ se cobra y esta línea dice cuál
 * de la serie y con qué detalle. Devuelve `null` cuando no hay ninguno de los
 * dos, para no dejar una línea vacía ocupando altura.
 */
export function getConceptSubline(payment: Payment): string | null {
  const parts: string[] = [];

  const cuota = payment.installmentLabel ?? payment.installmentIndex;
  if (cuota != null) parts.push(`Cuota ${cuota}`);
  if (payment.description) parts.push(payment.description);

  return parts.length > 0 ? parts.join(" · ") : null;
}

/**
 * Segunda línea de la columna "Estado": la fecha que importa según el estado.
 *
 * Reemplaza a las tres columnas de fecha que tenía la tabla —creación,
 * vencimiento y pago— con la única que el estado hace relevante. Un pago
 * cobrado se explica por cuándo entró la plata; uno pendiente, por cuándo
 * vence o hace cuánto venció. Las tres columnas mostraban un guion en la
 * mayoría de las filas: `dueDate` solo existe en cuotas, `paidAt` solo en
 * cobrados.
 *
 * El `className` colorea únicamente la mora, que es la que pide acción.
 */
export function getStatusDateLine(payment: Payment): { text: string; className?: string } {
  if (payment.status === "COMPLETED" && payment.paidAt) {
    return { text: `Pagado ${formatDate(payment.paidAt)}` };
  }

  if (payment.status === "PENDING") {
    if (payment.overdueDays != null && payment.overdueDays > 0) {
      const dias = payment.overdueDays;
      return {
        text: `Vencido hace ${dias} ${dias === 1 ? "día" : "días"}`,
        className: "text-destructive-text",
      };
    }
    if (payment.dueDate) {
      return { text: `Vence ${formatDueDate(payment.dueDate)}` };
    }
  }

  if (payment.createdAt) {
    return { text: `Emitido ${formatDate(String(payment.createdAt))}` };
  }

  return { text: "—" };
}

export function PaymentsTable({
  payments,
  onGenerateLink,
  onRegenerateLink,
  onMarkPaid,
  onDeletePayment,
  onAttachReceipt,
  onUploadReceipt,
  onSendLink,
  variant,
  generatingLinkId,
  regeneratingLinkId,
  attachingReceiptId,
  compact = false,
  emptyState,
}: {
  payments: Payment[];
  onGenerateLink?: (paymentId: string) => void;
  onRegenerateLink?: (paymentId: string) => void;
  onMarkPaid?: (paymentId: string) => void;
  onDeletePayment?: (paymentId: string) => void;
  onAttachReceipt?: (paymentId: string) => void;
  onUploadReceipt?: (paymentId: string, file: File) => Promise<{ error?: string }>;
  onSendLink?: (payment: Payment) => void;
  variant: PaymentsTableVariant;
  generatingLinkId?: string | null;
  regeneratingLinkId?: string | null;
  attachingReceiptId?: string | null;
  compact?: boolean;
  emptyState?: React.ReactNode;
}) {
  // Auto-detect installment column visibility for the "reservation" variant:
  // if any payment has installment data, show the columns; otherwise hide them.
  // This eliminates the need for the caller to know the billingType.
  const hasInstallmentData = payments.some(
    (p) => p.installmentIndex != null || p.installmentLabel != null,
  );

  // La variante `"full"` (/payments) no comparte el layout por columnas de las
  // otras dos: es un historial de varias reservas y agrupa los mismos datos en
  // cinco columnas a dos niveles. Ver `FULL_ACTIONS_CELL` para la medición.
  const isFull = variant === "full";

  // Map variant → column visibility booleans (solo para las variantes de
  // reserva, que siguen siendo una columna por dato)
  const showConceptColumn = variant === "extra";
  const showInstallmentColumns = variant === "reservation" && hasInstallmentData;

  // Build headers array based on resolved column visibility
  const headers: DataTableHeader[] = isFull
    ? [
        "Cliente",
        "Concepto",
        { label: "Monto", align: "right" },
        "Estado",
        {
          label: "Acciones",
          align: "right",
          // La celda fija necesita fondo OPACO, si no los `th` que pasan por
          // debajo al scrollear se transparentan a través. `bg-muted` suelto se
          // ve más oscuro que el resto del header, que es `bg-muted/50` sobre
          // la card; el `color-mix` de esos mismos dos tokens da el compuesto
          // exacto, ya opaco y sin hardcodear un color. Igual que en
          // `reservation-table.tsx`.
          className:
            "sticky right-0 z-20 border-l border-border px-4 bg-[color-mix(in_srgb,var(--muted)_50%,var(--card))]",
        },
      ]
    : [
        ...(showInstallmentColumns ? ["Cuota"] : []),
        ...(showConceptColumn ? ["Concepto"] : []),
        { label: "Monto", align: "right" },
        ...(showInstallmentColumns ? ["Vencimiento"] : []),
        "Fecha Pago",
        "Medio",
        ...(compact ? [] : ["Estado"]),
        { label: "Acciones", align: "right" },
      ];

  // Orden por cuota SOLO dentro de una reserva. Ahí el índice de cuota es el
  // orden natural y todas las filas comparten la misma serie.
  //
  // La variante `"full"` (/payments) es un historial global de varias reservas:
  // ordenar por `installmentIndex` intercala series distintas y colapsa a 0
  // todo lo que no es cuota (arriendos diarios, cobros extra), así que la
  // columna "Fecha creación" sale sin orden aparente. Ahí manda el orden del
  // servidor (`createdAt` desc en `getPayments`).
  const sortedPayments =
    variant === "full"
      ? payments
      : [...payments].sort(
          (a, b) => (a.installmentIndex ?? 0) - (b.installmentIndex ?? 0)
        );

  return (
    <DataTable headers={headers} caption="Listado de pagos" emptyState={emptyState}>
      {sortedPayments.length === 0 ? null : sortedPayments.map((payment) => {
        const statusCfg = paymentStatusConfig[payment.status] || paymentStatusConfig.PENDING;
        const isPending = payment.status === "PENDING";
        const isMercadoPago = payment.method === "MERCADO_PAGO";
        const isExpired = isPaymentExpired(payment);
        // Fila a dos niveles: cada celda lleva el dato arriba y su metadata
        // debajo, en vez de una columna por dato. Cliente absorbe propiedad,
        // Concepto absorbe cuota y descripción, Monto absorbe el medio de pago
        // y Estado absorbe las tres columnas de fecha.
        if (isFull) {
          const conceptSubline = getConceptSubline(payment);
          const dateLine = getStatusDateLine(payment);

          return (
            <tr key={payment.id} className="group border-b last:border-0">
              {/* Cliente · propiedad */}
              <td className={FULL_CELL}>
                <p className="truncate font-bold text-foreground">{payment.clientName ?? "—"}</p>
                <p className="truncate text-[10px] text-muted-foreground">
                  {payment.propertyName ?? "—"}
                </p>
              </td>

              {/* Concepto · cuota y descripción */}
              <td className={FULL_CELL}>
                <Badge
                  variant={getConceptBadgeVariant(payment)}
                  className="w-fit text-[10px] font-bold uppercase tracking-tight"
                >
                  {getConceptLabel(payment).primary}
                </Badge>
                {conceptSubline && (
                  <p className="mt-1 line-clamp-1 text-[10px] text-muted-foreground">
                    {conceptSubline}
                  </p>
                )}
              </td>

              {/* Monto · medio de pago */}
              <td className={cn(FULL_CELL, "text-right")}>
                <p className="font-bold tabular-nums text-foreground">
                  {formatAmount(payment.amount)}
                </p>
                <p className="whitespace-nowrap text-[10px] text-muted-foreground">
                  {METHOD_LABELS[payment.method] ?? "—"}
                </p>
              </td>

              {/* Estado · la fecha que ese estado hace relevante */}
              <td className={FULL_CELL}>
                <div className="flex flex-wrap items-center gap-1">
                  <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
                  {isPending && isMercadoPago && isExpired && (
                    <Badge variant="destructive">Expirado</Badge>
                  )}
                </div>
                <p
                  className={cn(
                    "mt-1 whitespace-nowrap text-[10px] tabular-nums",
                    dateLine.className ?? "text-muted-foreground",
                  )}
                >
                  {dateLine.text}
                </p>
              </td>

              <td className={cn(FULL_CELL, FULL_ACTIONS_CELL, "text-right")}>
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
                />
              </td>
            </tr>
          );
        }

        return (
          <tr key={payment.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
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
              <div className="flex items-center justify-end gap-1.5">
                {compact && (
                  <span
                    className={cn(
                      "size-2 rounded-full shrink-0",
                      payment.status === "PENDING" && "bg-warning",
                      payment.status === "COMPLETED" && "bg-success",
                      payment.status === "FAILED" && "bg-destructive",
                    )}
                    title={`${statusCfg.label}${payment.overdueDays && payment.overdueDays > 0 ? ` · Vencido hace ${payment.overdueDays} días` : ""}`}
                    aria-label={
                      payment.overdueDays && payment.overdueDays > 0
                        ? `${statusCfg.label} · Vencido hace ${payment.overdueDays} días`
                        : statusCfg.label
                    }
                  />
                )}
                <p className="text-xs font-bold text-foreground tabular-nums">
                  {formatAmount(payment.amount)}
                </p>
              </div>
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
            {!compact && (
              <td className="px-6 py-4 align-middle">
                <div className="flex flex-col gap-1">
                  <Badge variant={statusCfg.variant}>
                    {statusCfg.label}
                  </Badge>
                  {isPending && payment.overdueDays != null && payment.overdueDays > 0 && (
                    <p className="text-[10px] text-destructive-text">
                      Vencido hace {payment.overdueDays} {payment.overdueDays === 1 ? "día" : "días"}
                    </p>
                  )}
                  {isPending && isMercadoPago && isExpired && (
                    <Badge variant="destructive">
                      Expirado
                    </Badge>
                  )}
                </div>
              </td>
            )}
            <td className="px-6 py-4 text-right">
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
                compact={compact}
              />
            </td>
          </tr>
        );
      })}
    </DataTable>
  );
}
