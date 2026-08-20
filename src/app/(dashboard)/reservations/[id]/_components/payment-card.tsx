"use client";

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

function formatAmount(amount: string | number): string {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(amount));
}

function formatShortDate(dateString: string | null | undefined): string {
  if (!dateString) return "—";
  const key = String(dateString).slice(0, 10);
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  return date.toLocaleDateString("es-CL", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

const METHOD_LABELS: Record<string, string> = {
  MERCADO_PAGO: "Mercado Pago",
  CASH: "Efectivo",
  TRANSFER: "Transferencia",
};

type BadgeVariant =
  | "default"
  | "secondary"
  | "destructive"
  | "outline"
  | "warning"
  | "success";

const statusBadgeVariant: Record<string, BadgeVariant> = {
  PENDING: "warning",
  COMPLETED: "success",
  FAILED: "destructive",
};

const statusBadgeLabel: Record<string, string> = {
  PENDING: "Pendiente",
  COMPLETED: "Pagado",
  FAILED: "Fallido",
};

interface PaymentCardProps {
  payment: Payment;
  index: number;
  total: number;
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
}

/** Item de lista dentro del contenedor de `PaymentsCardsList`.
 *  El borde, el rounded y el background los provee el contenedor — este componente
 *  solo aporta el contenido y su divider interno (lo provee el `divide-y` del padre). */
export function PaymentCard({
  payment,
  index,
  total,
  isActive,
  onGenerateLink,
  onRegenerateLink,
  onMarkPaid,
  onDeletePayment,
  onSendLink,
  generatingLinkId,
  regeneratingLinkId,
}: PaymentCardProps) {
  const isCompleted = payment.status === "COMPLETED";
  const isPending = payment.status === "PENDING";
  const isMercadoPago = payment.method === "MERCADO_PAGO";
  const isExpired = payment.expiresAt ? new Date(payment.expiresAt) < new Date() : false;

  // Primary action cascade — alineado con ACTION_CONFIG / payment-row-actions.tsx
  // (seam UI canónico). Orden: generate → regenerate → sendLink → copy → markPaid → viewReceipt.
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
      className: "text-success hover:text-success",
      onClick: () => onMarkPaid?.(payment.id),
    },
    sendLink: {
      label: "Enviar link",
      icon: Send,
      className: "text-info hover:text-info",
      onClick: () => onSendLink?.(payment),
    },
    viewReceipt: {
      label: "Ver comprobante",
      icon: FileText,
      className: "text-muted-foreground hover:text-foreground gap-1",
      onClick: () => payment.receiptUrl && window.open(payment.receiptUrl, "_blank"),
    },
    delete: {
      label: "Eliminar pago",
      icon: Trash2,
      className: "text-muted-foreground hover:text-destructive",
      onClick: () => onDeletePayment?.(payment.id),
    },
  };

  const runAction = (actionId: string) => {
    switch (actionId) {
      case "generate": onGenerateLink?.(payment.id); break;
      case "regenerate": onRegenerateLink?.(payment.id); break;
      case "sendLink": onSendLink?.(payment); break;
      case "markPaid": onMarkPaid?.(payment.id); break;
      case "delete": onDeletePayment?.(payment.id); break;
      case "viewReceipt":
        if (payment.receiptUrl) window.open(payment.receiptUrl, "_blank");
        break;
    }
  };

  // Eyebrow context: prioritize specific labels, fall back to ordinal position.
  // Para pagos DAILY usamos solo "Pago N" (sin "de M") — el total no aporta
  // información accionable y compite con el badge de estado ("Pagado"/"Pendiente").
  const contextHint =
    payment.paymentType === "EXTRA" && payment.title
      ? payment.title
      : payment.installmentLabel
        ? payment.installmentLabel
        : payment.installmentIndex != null
          ? `Cuota ${payment.installmentIndex}`
          : `Pago ${index + 1}`;

const methodLabel = METHOD_LABELS[payment.method] ?? "—";
  const ariaLabel =
    payment.paymentType === "EXTRA" && payment.title
      ? `Cobro extra · ${payment.title}`
      : payment.installmentIndex != null
        ? `Cuota ${payment.installmentIndex}`
        : `Pago ${index + 1}`;
  const amountKicker = isCompleted ? "Monto cobrado" : "Monto a pagar";

  return (
    <article
      data-testid={`payment-card-${payment.id}`}
      aria-label={ariaLabel}
      className={cn(
        "px-4 py-4 transition-colors",
        isActive && "hover:bg-muted/30",
        !isActive && "opacity-60",
      )}
    >
      {/* Layout 3 columnas (desktop) / stacked (mobile) — mismo patrón que
          PaymentTimelineNode para coherencia visual entre reservas mensuales y diarias:
            • Col 1 (info):    contextHint (Pago N / Cuota / título EXTRA) + badge,
                               debajo descripción (cobros extras) y meta con iconos
                               (📅 Vence / método). "Pagado X" NO vive aquí — se movió
                               bajo el monto cobrado (Col 2) cuando COMPLETED, igual
                               que en el timeline node de mensuales.
            • Col 2 (monto):   kicker 10px + número tabular grande + sublabel
                               "Pagado el X" (text-success) cuando COMPLETED.
            • Col 3 (acciones): botones apilados, alineados a la derecha en desktop.
          El contextHint pasa de eyebrow 10px a título `text-base` para alinearse con
          el patrón del timeline node ("Octubre de 2026" como h3). */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
        {/* ───── COL 1 — INFO (contextHint + badge, debajo meta con iconos) ───── */}
        <div className="min-w-0 flex-1 flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <h3 className="text-base font-semibold text-foreground leading-tight">
              {contextHint}
            </h3>
            <Badge variant={statusBadgeVariant[payment.status] ?? "secondary"} className="shrink-0">
              {statusBadgeLabel[payment.status] ?? payment.status}
            </Badge>
          </div>
          {payment.description && (
            <p className="text-xs text-muted-foreground leading-snug">
              {payment.description}
            </p>
          )}
          {/* Meta row con iconos — Vence / Método.
              "Pagado X" se mueve bajo el monto cobrado (Col 2) cuando COMPLETED,
              replicando el patrón del timeline node de mensuales. */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground min-w-0">
            {payment.dueDate && (
              <span className="inline-flex items-center gap-1 tabular-nums">
                <CalendarDays className="size-3 shrink-0" aria-hidden="true" />
                <span>Vence {formatShortDate(payment.dueDate)}</span>
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

        {/* ───── COL 2 — MONTO (kicker + número tabular, centrado en desktop) ───── */}
        <div className="flex flex-col items-start gap-0.5 shrink-0 sm:items-center sm:min-w-[140px]">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {amountKicker}
          </p>
          <p className="text-xl font-bold tabular-nums text-foreground tracking-tight">
            {formatAmount(payment.amount)}
          </p>
          {/* Sublabel "Pagado el X" — solo cuando COMPLETED. Replica el patrón del
              timeline node (mensuales) y refuerza visualmente que ese monto ya fue
              cobrado, en el mismo verde del badge (Status Color Doctrine). */}
          {isCompleted && payment.paidAt && (
            <p className="text-[10px] font-medium text-success tabular-nums mt-0.5">
              Pagado el {formatShortDate(payment.paidAt)}
            </p>
          )}
        </div>

        {/* ───── COL 3 — ACCIONES (botones apilados, alineados a la derecha en desktop) ───── */}
        <div className="flex flex-col items-start gap-1.5 shrink-0 sm:items-end sm:min-w-[150px]">
          {/* Primary action */}
          {primaryAction === "generate" && (
            <Button
              variant="link"
              size="sm"
              className="h-7 px-1 text-xs text-info hover:text-info"
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
              className="h-7 px-1 text-xs text-info hover:text-info"
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
              className="h-7 px-1 text-xs text-info hover:text-info"
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
              className="h-7 px-1 text-xs text-info hover:text-info"
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
              className="h-7 px-1 text-xs text-success hover:text-success"
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
          {isCompleted && primaryAction === null && canViewReceipt === false && (
            <Button
              variant="link"
              size="sm"
              className="h-7 px-1 text-xs text-muted-foreground/60 gap-1"
              disabled
              title="Sin comprobante adjunto"
            >
              <FileText className="size-3.5" />
              Ver comprobante
            </Button>
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
            return (
              <Button
                key={id}
                variant="link"
                size="sm"
                className={cn("h-7 px-1 text-xs", cfg.className)}
                onClick={cfg.onClick}
                title={id === "delete" ? "Eliminar pago" : undefined}
              >
                <Icon className="size-3.5 mr-1" />
                {cfg.label}
              </Button>
            );
          })}
        </div>
      </div>
    </article>
  );
}