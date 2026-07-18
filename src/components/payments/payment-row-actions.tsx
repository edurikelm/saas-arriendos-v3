"use client";

import {
  ExternalLink,
  Copy,
  Check,
  FileText,
  FileDown,
  Loader2,
  MoreHorizontal,
  RefreshCw,
  Trash2,
  Send,
  Paperclip,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import type { Payment } from "./payments-table";

export interface PaymentRowActionsProps {
  payment: Payment;
  onGenerateLink?: (paymentId: string) => void;
  onRegenerateLink?: (paymentId: string) => void;
  onMarkPaid?: (paymentId: string) => void;
  onDeletePayment?: (paymentId: string) => void;
  onAttachReceipt?: (paymentId: string) => void;
  onSendLink?: (payment: Payment) => void;
  generatingLinkId?: string | null;
  regeneratingLinkId?: string | null;
  attachingReceiptId?: string | null;
  /** Internal API — compact cell in modal context (ReservationDetailDialog). */
  compact?: boolean;
}

function isPaymentExpired(payment: Payment): boolean {
  if (!payment.expiresAt) return false;
  return new Date(payment.expiresAt) < new Date();
}

function formatAmount(amount: string | number): string {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(amount));
}

/** Builds the label for the "More actions" trigger, describing which payment. */
function buildAriaLabel(payment: Payment): string {
  if (payment.installmentLabel) return `Más acciones para cuota ${payment.installmentLabel}`;
  if (payment.installmentIndex != null) return `Más acciones para cuota ${payment.installmentIndex}`;
  return `Más acciones para pago de ${formatAmount(payment.amount)}`;
}

export function PaymentRowActions({
  payment,
  onGenerateLink,
  onRegenerateLink,
  onMarkPaid,
  onDeletePayment,
  onAttachReceipt,
  onSendLink,
  generatingLinkId,
  regeneratingLinkId,
  attachingReceiptId,
  compact = false,
}: PaymentRowActionsProps) {
  const isPending = payment.status === "PENDING";
  const isCompleted = payment.status === "COMPLETED";
  const isMercadoPago = payment.method === "MERCADO_PAGO";
  const isExpired = isPaymentExpired(payment);

  // ── Action eligibility ────────────────────────────────────────────────────
  const canGenerateLink = isPending && isMercadoPago && !payment.initPoint && onGenerateLink;
  const canCopyLink = isPending && isMercadoPago && payment.initPoint && !isExpired;
  const canRegenerateLink =
    isPending && isMercadoPago && isExpired && payment.initPoint && onRegenerateLink;
  const canMarkPaid = isPending && onMarkPaid;
  const canDelete = isPending && !isMercadoPago && onDeletePayment;
  const canViewReceipt = Boolean(payment.receiptUrl);
  const canDownloadReceipt = isCompleted && isMercadoPago;
  const canAttachReceipt = isCompleted && !payment.receiptUrl && onAttachReceipt;
  const canSendLink = isPending && isMercadoPago && payment.initPoint && onSendLink;

  // ── Primary action ───────────────────────────────────────────────────────
  const primaryAction:
    | "generate"
    | "regenerate"
    | "copy"
    | "markPaid"
    | "viewReceipt"
    | "downloadReceipt"
    | null =
    canGenerateLink
      ? "generate"
      : canRegenerateLink
        ? "regenerate"
        : canCopyLink
          ? "copy"
          : canMarkPaid
            ? "markPaid"
            : canViewReceipt
              ? "viewReceipt"
              : canDownloadReceipt
                ? "downloadReceipt"
                : null;

  // ── Secondary actions ─────────────────────────────────────────────────────
  const secondaryActions = [
    canMarkPaid && primaryAction !== "markPaid" ? "markPaid" : null,
    canDelete ? "delete" : null,
    canViewReceipt && primaryAction !== "viewReceipt" ? "viewReceipt" : null,
    canDownloadReceipt && primaryAction !== "downloadReceipt" ? "downloadReceipt" : null,
    canAttachReceipt ? "attachReceipt" : null,
    canSendLink ? "sendLink" : null,
  ].filter(Boolean) as Array<
    "markPaid" | "delete" | "viewReceipt" | "downloadReceipt" | "attachReceipt" | "sendLink"
  >;

  // ── UX: promote single secondary action to primary when primary is absent ──
  // e.g. COMPLETED without receiptUrl → "Adjuntar comprobante" becomes visible
  const effectivePrimary =
    primaryAction ?? (secondaryActions.length === 1 ? secondaryActions[0] : null);
  const effectiveSecondary =
    primaryAction
      ? secondaryActions
      : secondaryActions.filter((a) => a !== effectivePrimary);

  // ── Button / menu sizes ──────────────────────────────────────────────────
  const btnSize = compact ? "size-6" : "size-7";
  const btnVariant = "ghost";
  const btnClassName = compact ? "h-6 px-1.5 text-[10px]" : "h-7 px-2 text-xs";

  // ── Render primary action button ──────────────────────────────────────────
  const renderPrimaryButton = () => {
    if (!effectivePrimary) return null;

    if (effectivePrimary === "generate") {
      return (
        <Button
          size="sm"
          variant="outline"
          className={btnClassName}
          aria-label={compact ? "Generar link" : undefined}
          disabled={generatingLinkId === payment.id}
          onClick={() => onGenerateLink?.(payment.id)}
        >
          {generatingLinkId === payment.id ? (
            <Loader2 className="mr-0.5 size-3 animate-spin" />
          ) : (
            <ExternalLink className="mr-0.5 size-3" />
          )}
          {compact ? "Generar" : "Generar link"}
        </Button>
      );
    }

    if (effectivePrimary === "regenerate") {
      return (
        <Button
          size="sm"
          variant="outline"
          className={btnClassName}
          aria-label={compact ? "Regenerar link" : undefined}
          disabled={regeneratingLinkId === payment.id}
          onClick={() => onRegenerateLink?.(payment.id)}
        >
          {regeneratingLinkId === payment.id ? (
            <Loader2 className="mr-0.5 size-3 animate-spin" />
          ) : (
            <RefreshCw className="mr-0.5 size-3" />
          )}
          {compact ? "Regenerar" : "Regenerar link"}
        </Button>
      );
    }

    if (effectivePrimary === "copy") {
      return (
        <Button
          size="sm"
          variant="outline"
          className={btnClassName}
          aria-label={compact ? "Copiar link" : undefined}
          onClick={() => {
            navigator.clipboard.writeText(payment.initPoint!);
            toast.success("Link copiado al portapapeles");
          }}
        >
          <Copy className="mr-0.5 size-3" />
          {compact ? "Copiar" : "Copiar link"}
        </Button>
      );
    }

    if (effectivePrimary === "markPaid") {
      return (
        <Button
          size="sm"
          variant="outline"
          className={btnClassName}
          aria-label={compact ? "Marcar pagado" : undefined}
          onClick={() => onMarkPaid?.(payment.id)}
        >
          <Check className="mr-0.5 size-3" />
          {compact ? "Marcar pagado" : "Marcar pagado"}
        </Button>
      );
    }

    if (effectivePrimary === "viewReceipt") {
      return (
        <Button
          size="sm"
          variant="ghost"
          className={btnClassName}
          aria-label={compact ? "Ver comprobante" : undefined}
          onClick={() => window.open(payment.receiptUrl!, "_blank")}
        >
          <FileText className="mr-0.5 size-3" />
          {compact ? "Ver comp." : "Ver comprobante"}
        </Button>
      );
    }

    if (effectivePrimary === "downloadReceipt") {
      return (
        <Button
          size="sm"
          variant="outline"
          className={btnClassName}
          aria-label={compact ? "Descargar comprobante" : undefined}
          onClick={() => window.open(`/api/payments/${payment.id}/receipt`, "_blank")}
        >
          <FileDown className="mr-0.5 size-3" />
          {compact ? "Comprobante" : "Descargar comprobante"}
        </Button>
      );
    }

    if (effectivePrimary === "attachReceipt") {
      return (
        <Button
          size="sm"
          variant="outline"
          className={btnClassName}
          aria-label={compact ? "Adjuntar comprobante" : undefined}
          disabled={attachingReceiptId === payment.id}
          onClick={() => onAttachReceipt?.(payment.id)}
        >
          {attachingReceiptId === payment.id ? (
            <Loader2 className="mr-0.5 size-3 animate-spin" />
          ) : (
            <Paperclip className="mr-0.5 size-3" />
          )}
          {compact ? "Adjuntar" : "Adjuntar comprobante"}
        </Button>
      );
    }

    return null;
  };

  // ── Render menu item ──────────────────────────────────────────────────────
  const renderMenuItem = (action: (typeof effectiveSecondary)[number]) => {
    if (action === "markPaid") {
      return (
        <DropdownMenuItem onClick={() => onMarkPaid?.(payment.id)}>
          <Check className="size-3.5 shrink-0" />
          Marcar como pagado
        </DropdownMenuItem>
      );
    }

    if (action === "delete") {
      return (
        <DropdownMenuItem
          variant="destructive"
          onClick={() => onDeletePayment?.(payment.id)}
        >
          <Trash2 className="size-3.5 shrink-0" />
          Eliminar pago
        </DropdownMenuItem>
      );
    }

    if (action === "viewReceipt") {
      return (
        <DropdownMenuItem onClick={() => window.open(payment.receiptUrl!, "_blank")}>
          <FileText className="size-3.5 shrink-0" />
          Ver comprobante
        </DropdownMenuItem>
      );
    }

    if (action === "downloadReceipt") {
      return (
        <DropdownMenuItem
          onClick={() => window.open(`/api/payments/${payment.id}/receipt`, "_blank")}
        >
          <FileDown className="size-3.5 shrink-0" />
          Descargar comprobante PDF
        </DropdownMenuItem>
      );
    }

    if (action === "sendLink") {
      return (
        <DropdownMenuItem onClick={() => onSendLink?.(payment)}>
          <Send className="size-3.5 shrink-0" />
          Enviar link
        </DropdownMenuItem>
      );
    }

    if (action === "attachReceipt") {
      return (
        <DropdownMenuItem
          disabled={attachingReceiptId === payment.id}
          onClick={() => onAttachReceipt?.(payment.id)}
        >
          <Paperclip className="size-3.5 shrink-0" />
          {attachingReceiptId === payment.id ? "Adjuntando..." : "Adjuntar comprobante"}
        </DropdownMenuItem>
      );
    }

    return null;
  };

  return (
    <div className="flex items-center justify-end gap-1">
      {renderPrimaryButton()}
      {effectiveSecondary.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant={btnVariant}
                className={btnSize}
                aria-label={buildAriaLabel(payment)}
              >
                <MoreHorizontal className={compact ? "size-3" : "size-3.5"} />
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="w-48">
            {effectiveSecondary.map((action) => (
              <div key={action}>{renderMenuItem(action)}</div>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {!effectivePrimary && effectiveSecondary.length === 0 && (
        <span className="text-muted-foreground text-[10px]">—</span>
      )}
    </div>
  );
}
