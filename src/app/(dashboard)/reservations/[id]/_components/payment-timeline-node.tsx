"use client";

import { Fragment } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CalendarDays,
  FileText,
  Check,
  Copy,
  ExternalLink,
  RefreshCw,
  Send,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Payment } from "@/components/payments/payments-table";
import { formatDateOnly, formatInstant } from "@/lib/domain/timezone";
import { getPaymentDisplayStatus } from "@/lib/payments/payment-status";
import { AttachReceiptPopover } from "@/components/payments/attach-receipt-popover";

function formatAmount(amount: string | number): string {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(amount));
}

// dueDate es date-only (dia calendario) — formatDateOnly, sin reinterpretar zona.
function formatShortDate(dateString: string | null | undefined): string {
  return formatDateOnly(dateString, { day: "numeric", month: "short", year: "numeric" });
}

// paidAt es un instante real — formatInstant, wall-time America/Santiago.
function formatPaidDate(dateString: string | null | undefined): string {
  return formatInstant(dateString, { day: "numeric", month: "short", year: "numeric" });
}

function formatMonthLabel(dateString: string | null | undefined): string {
  if (!dateString) return "";
  return formatDateOnly(dateString, { month: "long", year: "numeric" }).replace(/^./, (c) =>
    c.toUpperCase(),
  );
}

const METHOD_LABELS: Record<string, string> = {
  MERCADO_PAGO: "Mercado Pago",
  CASH: "Efectivo",
  TRANSFER: "Transferencia",
};

type Tone = "success" | "info" | "warning" | "destructive";

// Solo el color del punto del timeline. La clave `text` que vivia aca nunca se
// destructuraba y llevaba los tokens de relleno crudos: codigo muerto que le
// documentaba el patron equivocado al proximo que lo leyera.
const toneClasses: Record<Tone, { bar: string }> = {
  success: { bar: "bg-success" },
  info: { bar: "bg-info" },
  warning: { bar: "bg-warning" },
  destructive: { bar: "bg-destructive" },
};

/** Mapas de variante del Badge por tono — el Badge es el lenguaje canónico de estado. */
const toneBadgeVariant: Record<Tone, "success" | "warning" | "info" | "destructive"> = {
  success: "success",
  info: "info",
  warning: "warning",
  destructive: "destructive",
};

interface PaymentTimelineNodeProps {
  payment: Payment;
  index: number;
  total: number;
  nowKey: string;
  daysFromNow: number;
  isActive: boolean;
  onGenerateLink?: (paymentId: string) => void;
  onRegenerateLink?: (paymentId: string) => void;
  onMarkPaid?: (paymentId: string) => void;
  onDeletePayment?: (paymentId: string) => void;
  onUploadReceipt?: (paymentId: string, file: File) => Promise<{ error?: string }>;
  onSendLink?: (payment: Payment) => void;
  generatingLinkId?: string | null;
  regeneratingLinkId?: string | null;
  isFirstOverdue?: boolean;
}

export function PaymentTimelineNode({
  payment,
  index,
  total,
  daysFromNow,
  isActive,
  onGenerateLink,
  onRegenerateLink,
  onMarkPaid,
  onDeletePayment,
  onUploadReceipt,
  onSendLink,
  generatingLinkId,
  regeneratingLinkId,
  isFirstOverdue,
}: PaymentTimelineNodeProps) {
  const isCompleted = payment.status === "COMPLETED";
  const isPending = payment.status === "PENDING";
  const isMercadoPago = payment.method === "MERCADO_PAGO";
  const isExpired = payment.expiresAt ? new Date(payment.expiresAt) < new Date() : false;

  // Tono y etiqueta salen del helper compartido: `PaymentCard` (diarias) usa el
  // mismo, para que un pago atrasado se llame igual en los dos modos de cobro.
  const { tone, label: badgeLabel } = getPaymentDisplayStatus(
    payment.status,
    payment.dueDate ? daysFromNow : null,
  );

  const { bar: barClass } = toneClasses[tone];
  const installmentNumber = payment.installmentIndex ?? index + 1;
  const monthLabel = formatMonthLabel(payment.dueDate);
  const methodLabel = METHOD_LABELS[payment.method] ?? "—";

  // Primary action cascade — alineado con ACTION_CONFIG en payment-row-actions.tsx
  // (seam canónico de UI de acciones de pago). Orden: generate → regenerate → sendLink → copy → markPaid.
  //
  // Decisión local a /reservations/[id]: cuando hay link vigente + onSendLink,
  // el primary es "Enviar link" (no "Copiar link"). Justificación: el modal
  // `SendPaymentLinkDialog` ya expone su propio botón "Copiar" para copiar el
  // mensaje con el link; mostrar "Copiar link" + "Enviar link" como dos acciones
  // separadas duplica la misma capacidad. `canCopyLink` queda como fallback
  // defensivo: si por alguna razón `onSendLink` no se pasa (p.ej. otro callsite),
  // el comportamiento legacy (primary = "Copiar link") se preserva.
  const canGenerateLink = isPending && isMercadoPago && !payment.initPoint && !!onGenerateLink;
  const canRegenerateLink = isPending && isMercadoPago && isExpired && !!payment.initPoint && !!onRegenerateLink;
  const canCopyLink = isPending && isMercadoPago && !!payment.initPoint && !isExpired;
  const canSendLink = isPending && isMercadoPago && !!payment.initPoint && !!onSendLink;
  const canMarkPaid = isPending && isActive && !!onMarkPaid;
  const canDelete = isPending && !isMercadoPago && isActive && !!onDeletePayment;
  const canViewReceipt = !!payment.receiptUrl;

  const isGenerating = generatingLinkId === payment.id;
  const isRegenerating = regeneratingLinkId === payment.id;

  // Action primaria: generate > regenerate > sendLink > copy > markPaid > viewReceipt.
  type PrimaryId = "generate" | "regenerate" | "sendLink" | "copy" | "markPaid" | "viewReceipt";
  const primaryAction: PrimaryId | null = canGenerateLink
    ? "generate"
    : canRegenerateLink
      ? "regenerate"
      : canSendLink
        ? "sendLink"
        : canCopyLink
          ? "copy"
          : canMarkPaid
            ? "markPaid"
            : isCompleted && canViewReceipt
              ? "viewReceipt"
              : null;

  // Secondaries — todas se renderizan inline debajo de la primaria, sin importar
  // la cantidad. Antes la regla era "1 → inline, 2+ → dropdown 'Más acciones'",
  // pero el dropdown añadía fricción (dos taps para llegar a acciones obvias
  // como "Marcar pagado" o "Enviar link"). Ahora todas las acciones elegibles
  // son visibles — la jerarquía "primaria arriba + secundarias debajo" las
  // mantiene ordenadas sin esconder nada.
  //
  // `sendLink` se omite cuando ya es la primary (evita duplicación visible).
  //
  // Orden estable (de arriba a abajo):
  //   1. sendLink    — pegada a la primaria cuando la primaria NO es sobre el
  //                    mismo link de MP (p.ej. primary = markPaid).
  //   2. markPaid    — la acción más frecuente del owner.
  //   3. viewReceipt — secundaria de consulta cuando el pago está cerrado.
  //   4. delete      — destructiva, siempre al final.
  type SecondaryId = "markPaid" | "delete" | "viewReceipt" | "sendLink";
  const secondaries: SecondaryId[] = [];
  if (canSendLink && primaryAction !== "sendLink") secondaries.push("sendLink");
  if (canMarkPaid && primaryAction !== "markPaid") secondaries.push("markPaid");
  if (isCompleted && canViewReceipt && primaryAction !== "viewReceipt") secondaries.push("viewReceipt");
  if (canDelete) secondaries.push("delete");

  // "Eliminar pago" no puede quedar pegada al bloque constructivo (P1: en una
  // fila de pago, "Marcar pagado" y "Eliminar pago" son visualmente idénticas
  // y adyacentes — liquidar la deuda vs. destruir el registro). Cuando hay
  // algo renderizado arriba (la primaria, u otra secundaria), se antepone un
  // divisor de 1px `bg-border` — mismo lenguaje visual que `DropdownMenuSeparator`.
  const hasContentAboveDelete = primaryAction !== null || secondaries.some((id) => id !== "delete");

  // Mapa declarativo id → config visual del botón. Cada secundaria sabe cómo
  // renderizarse; el render es un simple .map() sobre la lista `secondaries`.
  const secondaryButtons: Record<SecondaryId, {
    label: string;
    icon: typeof Check;
    className: string;
    onClick: () => void;
  }> = {
    markPaid: {
      label: "Marcar pagado",
      icon: Check,
      className: "text-muted-foreground hover:text-success-text",
      onClick: () => onMarkPaid?.(payment.id),
    },
    sendLink: {
      label: "Enviar link",
      icon: Send,
      className: "text-muted-foreground hover:text-info-text",
      onClick: () => onSendLink?.(payment),
    },
    viewReceipt: {
      label: "Ver comprobante",
      icon: FileText,
      className: "text-muted-foreground hover:text-foreground gap-1",
      onClick: () => payment.receiptUrl && window.open(payment.receiptUrl, "_blank"),
    },
    delete: {
      // Destructiva de verdad: color destructivo en REPOSO, no solo en hover
      // (en touch el hover nunca ocurre — la acción quedaba indistinguible de
      // "Marcar pagado", su vecina constructiva). `text-destructive-text`, no
      // `text-destructive` — ese es el token de relleno (3.76:1 sobre card,
      // bajo AA); ver The Fill-vs-Text Rule en DESIGN.md.
      label: "Eliminar pago",
      icon: Trash2,
      className: "text-destructive-text hover:text-destructive-text",
      onClick: () => onDeletePayment?.(payment.id),
    },
  };

  const isLast = index === total - 1;
  const ariaLabel = `Cuota ${installmentNumber} de ${total}`;

  return (
    <div
      className="relative flex gap-4 scroll-mt-24 rounded-lg focus:outline-2 focus:outline-offset-2"
      data-testid={`timeline-node-${payment.id}`}
      data-payment-id={payment.id}
      tabIndex={isFirstOverdue ? -1 : undefined}
      aria-label={isFirstOverdue ? `${ariaLabel} — vencida` : undefined}
    >
      {/* Connector — left side vertical line */}
      {!isLast && (
        <div
          className="absolute left-2 top-7 bottom-[-20px] w-[2px] bg-muted-foreground/40"
          aria-hidden="true"
        />
      )}

      {/* Node dot */}
      <div
        className={cn(
          "size-4 rounded-full shrink-0 mt-1.5 border-2 border-background",
          barClass,
          isFirstOverdue && "ring-2 ring-destructive ring-offset-2 ring-offset-background",
        )}
        aria-hidden="true"
      />

      {/* Fila de 3 columnas cuando el contenedor da (>= @2xl), apilada cuando no:
            • Col 1 (info):    titulo + badge, debajo descripcion y meta.
            • Col 2 (monto):   cifra tabular alineada a la derecha, ancho fijo para
                               que las cifras de todas las filas formen columna. El
                               rotulo va en el header de la tabla, una vez; aca queda
                               `@2xl:sr-only` para el layout apilado y los lectores.
            • Col 3 (acciones): en fila, ancho fijo, `flex-wrap` para que el caso raro
                               de tres acciones baje de linea en vez de invadir el
                               monto. Orden DOM = orden visual = orden de foco. */}
      <div
        className={cn(
          "flex-1 rounded-lg border border-border bg-card overflow-hidden transition-colors",
          isActive && "hover:bg-muted/30",
          !isActive && "opacity-60",
        )}
      >
        {/* `@xl` (ancho de CONTENEDOR, ver @container en PaymentsSection): en fila
            recién cuando el panel tiene ancho de sobra para info + monto (140px)
            + acciones (150px) + gaps; si no, se apilan verticalmente. Con `sm:`
            (viewport) esto forzaba fila con el panel angosto y la columna de info
            colapsaba a 0 (su texto quedaba sobreimpreso con el monto). */}
        <div className="flex flex-col gap-3 px-4 py-3 @2xl:flex-row @2xl:items-center @2xl:gap-4">
          {/* ───── COL 1 — INFO (mes + badge, debajo meta con iconos) ───── */}
          <div className="min-w-0 flex-1 flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              {/* Sin aria-label: reemplazaba el nombre accesible en vez de
                  complementarlo, asi que navegando por encabezados se oia
                  "Cuota 3 de 6" y nunca el mes que esta en pantalla — y esa
                  misma cadena ya es texto visible dos lineas mas abajo. */}
              <h3 className="text-base font-semibold text-foreground leading-tight">
                {monthLabel || "—"}
              </h3>
              <Badge variant={toneBadgeVariant[tone]} className="shrink-0">
                {badgeLabel}
              </Badge>
            </div>
            {/* Meta: vencimiento y metodo. El chip "# N de M" se movio al header
                de la seccion — el rail ya da la posicion y el h3 nombra el mes. */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground min-w-0">
              {payment.dueDate && (
                <span className="inline-flex items-center gap-1 tabular-nums">
                  <CalendarDays className="size-3 shrink-0" aria-hidden="true" />
                  <span>
                    Vence {formatShortDate(payment.dueDate)}
                    {isPending && daysFromNow >= 0 && daysFromNow <= 7 && daysFromNow > 0 && (
                      <span className="text-info-text font-medium"> · En {daysFromNow} días</span>
                    )}
                    {isPending && daysFromNow === 0 && (
                      <span className="text-warning-text font-medium"> · Vence hoy</span>
                    )}
                  </span>
                </span>
              )}
              {payment.dueDate && (
                <span className="text-muted-foreground/40" aria-hidden="true">·</span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <span>{methodLabel}</span>
              </span>
            </div>
          </div>

          {/* ───── COL 2 — MONTO ───── */}
          <div className="flex flex-col items-start gap-0.5 shrink-0 @2xl:items-end @2xl:w-[130px]">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground @2xl:sr-only">
            {isCompleted ? "Monto cobrado" : "Monto a pagar"}
          </p>
          <p className="text-xl font-bold tabular-nums text-foreground tracking-tight">
              {formatAmount(payment.amount)}
            </p>
            {/* Sublabel "Pagado el X" — solo cuando COMPLETED. Refuerza visualmente
                que ese monto ya fue cobrado, en el mismo verde del badge (Status
                Color Doctrine: COMPLETED → success). */}
            {isCompleted && payment.paidAt && (
              <p className="text-[10px] font-medium text-success-text tabular-nums mt-0.5 @2xl:text-right">
                Pagado el {formatPaidDate(payment.paidAt)}
              </p>
            )}
          </div>

          {/* ───── COL 3 — ACCIONES ───── */}
          <div className="flex flex-col items-start gap-1.5 shrink-0 @2xl:w-[248px] @2xl:flex-row @2xl:flex-wrap @2xl:items-center @2xl:justify-end @2xl:gap-x-2 @2xl:gap-y-1">
            {/* Primary action */}
            {primaryAction === "generate" && (
              <Button
                variant="link"
                size="sm"
                className="h-7 px-1 text-xs text-info-text hover:text-info-text"
                onClick={() => onGenerateLink?.(payment.id)}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  "Generando..."
                ) : (
                  <>
                    <ExternalLink className="size-3.5 mr-1" />
                    Generar link
                  </>
                )}
              </Button>
            )}
            {primaryAction === "regenerate" && (
              <Button
                variant="link"
                size="sm"
                className="h-7 px-1 text-xs text-info-text hover:text-info-text"
                onClick={() => onRegenerateLink?.(payment.id)}
                disabled={isRegenerating}
              >
                {isRegenerating ? (
                  "Regenerando..."
                ) : (
                  <>
                    <RefreshCw className="size-3.5 mr-1" />
                    Regenerar link
                  </>
                )}
              </Button>
            )}
            {primaryAction === "sendLink" && (
              <Button
                variant="link"
                size="sm"
                className="h-7 px-1 text-xs text-info-text hover:text-info-text"
                onClick={() => onSendLink?.(payment)}
              >
                <Send className="size-3.5 mr-1" />
                Enviar link
              </Button>
            )}
            {primaryAction === "copy" && (
              <Button
                variant="link"
                size="sm"
                className="h-7 px-1 text-xs text-info-text hover:text-info-text"
                onClick={() => {
                  if (payment.initPoint) {
                    navigator.clipboard.writeText(payment.initPoint);
                    toast.success("Link copiado al portapapeles");
                  }
                }}
                disabled={!payment.initPoint}
              >
                <Copy className="size-3.5 mr-1" />
                Copiar link
              </Button>
            )}
            {primaryAction === "markPaid" && (
              <Button
                variant="link"
                size="sm"
                className="h-7 px-1 text-xs text-success-text hover:text-success-text"
                onClick={() => onMarkPaid?.(payment.id)}
              >
                <Check className="size-3.5 mr-1" />
                Marcar pagado
              </Button>
            )}
            {primaryAction === "viewReceipt" && (
              <Button
                variant="link"
                size="sm"
                className="h-7 px-1 text-xs text-muted-foreground hover:text-foreground gap-1"
                disabled={!payment.receiptUrl}
                title={!payment.receiptUrl ? "Sin comprobante adjunto" : undefined}
                onClick={() => payment.receiptUrl && window.open(payment.receiptUrl, "_blank")}
              >
                <FileText className="size-3.5" />
                Ver comprobante
              </Button>
            )}
            {/* Pago cobrado sin comprobante: el botón deshabilitado "Ver comprobante"
                que vivía aquí era un callejón sin salida — anunciaba que faltaba el
                comprobante sin ofrecer forma de adjuntarlo, mientras `onUploadReceipt`
                llegaba hasta este componente sin consumirse. Ahora se ofrece la misma
                acción que el seam canónico (`payment-row-actions.tsx`): adjuntarlo. */}
            {isCompleted && primaryAction === null && !canViewReceipt && onUploadReceipt && (
              <AttachReceiptPopover
                triggerLabel="Adjuntar comprobante"
                triggerTooltip="Adjuntar comprobante"
                variant="link"
                triggerClassName="text-muted-foreground hover:text-foreground"
                onSubmit={(file) => onUploadReceipt(payment.id, file)}
              />
            )}
            {isCompleted && primaryAction === null && !canViewReceipt && !onUploadReceipt && (
              <span className="text-xs text-muted-foreground py-1">Sin comprobante</span>
            )}

            {/* Secondaries — todas inline debajo de la primaria. Antes esto
                era un dropdown "Más acciones" cuando había 2+ secundarias; ahora
                cada acción se renderiza como su propio botón en orden estable
                (sendLink → markPaid → viewReceipt → delete). El orden de
                apilamiento refleja prioridad operativa: marcar pagado primero
                (acción más frecuente del owner), destructivas al final.
                `sendLink` se omite cuando ya es la primary (evita duplicación
                visible con el botón de arriba). */}
            {secondaries.map((id) => {
              const cfg = secondaryButtons[id];
              const Icon = cfg.icon;
              const isDelete = id === "delete";
              return (
                <Fragment key={id}>
                  {/* Divisor antes de la destructiva — separación real (13px:
                      gap-1.5 + línea de 1px + gap-1.5) en vez del gap-1.5 uniforme
                      que la pegaba al botón constructivo de arriba. */}
                  {isDelete && hasContentAboveDelete && (
                    <div className="h-px w-full shrink-0 bg-border @2xl:h-4 @2xl:w-px @2xl:self-center" aria-hidden="true" />
                  )}
                  <Button
                    variant="link"
                    size="sm"
                    className={cn("h-7 px-1 text-xs", cfg.className)}
                    onClick={cfg.onClick}
                    title={isDelete ? "Eliminar pago" : undefined}
                  >
                    <Icon className="size-3.5 mr-1" />
                    {cfg.label}
                  </Button>
                </Fragment>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}