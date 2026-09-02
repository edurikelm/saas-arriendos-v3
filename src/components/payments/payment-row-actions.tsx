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
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Payment } from "./payments-table";
import { AttachReceiptPopover } from "./attach-receipt-popover";

export interface PaymentRowActionsProps {
  payment: Payment;
  onGenerateLink?: (paymentId: string) => void;
  onRegenerateLink?: (paymentId: string) => void;
  onMarkPaid?: (paymentId: string) => void;
  onDeletePayment?: (paymentId: string) => void;
  onAttachReceipt?: (paymentId: string) => void;
  /** Upload receipt file — used by <AttachReceiptPopover> when attachReceipt is the primary action. */
  onUploadReceipt?: (paymentId: string, file: File) => Promise<{ error?: string }>;
  onSendLink?: (payment: Payment) => void;
  generatingLinkId?: string | null;
  regeneratingLinkId?: string | null;
  attachingReceiptId?: string | null;
  /** Internal API — compact cell in modal context (e.g. dialogs over the list). */
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

// ─── Action config ──────────────────────────────────────────────────────────
// Single source of truth for every action's icon, label, and side-effect.
// Used by both the primary button, the inline secondary button, and the
// dropdown items — keeps visual labels consistent across surfaces.

type ActionId =
  | "generate"
  | "regenerate"
  | "copy"
  | "sendLink"
  | "markPaid"
  | "delete"
  | "viewReceipt"
  | "downloadReceipt"
  | "attachReceipt";

interface ActionConfig {
  icon: LucideIcon;
  iconClassName?: string;
  label: string;
  /** Short label for inline secondary button (used as title tooltip). */
  tooltip: string;
  /** Render separator before this action in the dropdown menu. */
  separatorBefore?: boolean;
  /** Destructive action — render in destructive tone. */
  destructive?: boolean;
  /** Determines if the action is async (shows spinner while in flight). */
  hasLoadingState?: boolean;
}

export const ACTION_CONFIG: Record<ActionId, ActionConfig> = {
  generate: {
    icon: ExternalLink,
    label: "Generar link",
    tooltip: "Generar link de pago",
    hasLoadingState: true,
  },
  regenerate: {
    icon: RefreshCw,
    label: "Regenerar link",
    tooltip: "Regenerar link de pago (el anterior expiró)",
    hasLoadingState: true,
  },
  copy: {
    icon: Copy,
    label: "Copiar link",
    tooltip: "Copiar link al portapapeles",
  },
  sendLink: {
    icon: Send,
    label: "Enviar link",
    tooltip: "Enviar link por WhatsApp o email",
  },
  markPaid: {
    icon: Check,
    label: "Marcar como pagado",
    tooltip: "Marcar como pagado (pago manual)",
  },
  delete: {
    icon: Trash2,
    label: "Eliminar pago",
    tooltip: "Eliminar este pago",
    separatorBefore: true,
    destructive: true,
  },
  viewReceipt: {
    icon: FileText,
    label: "Ver comprobante",
    tooltip: "Ver comprobante",
  },
  downloadReceipt: {
    icon: FileDown,
    label: "Descargar comprobante PDF",
    tooltip: "Descargar comprobante en PDF",
  },
  attachReceipt: {
    icon: Paperclip,
    label: "Adjuntar comprobante",
    tooltip: "Adjuntar comprobante",
    hasLoadingState: true,
  },
};

/** Returns true when the action is currently mid-flight for this payment. */
function isActionLoading(
  action: ActionId,
  payment: Payment,
  state: { generatingLinkId?: string | null; regeneratingLinkId?: string | null; attachingReceiptId?: string | null },
): boolean {
  if (!ACTION_CONFIG[action].hasLoadingState) return false;
  if (action === "generate") return state.generatingLinkId === payment.id;
  if (action === "regenerate") return state.regeneratingLinkId === payment.id;
  if (action === "attachReceipt") return state.attachingReceiptId === payment.id;
  return false;
}

/** Runs the side-effect for the given action. */
function runAction(
  action: ActionId,
  payment: Payment,
  callbacks: Pick<PaymentRowActionsProps, "onGenerateLink" | "onRegenerateLink" | "onMarkPaid" | "onDeletePayment" | "onAttachReceipt" | "onSendLink" | "onUploadReceipt">,
): void {
  switch (action) {
    case "generate": callbacks.onGenerateLink?.(payment.id); break;
    case "regenerate": callbacks.onRegenerateLink?.(payment.id); break;
    case "copy":
      if (payment.initPoint) {
        navigator.clipboard.writeText(payment.initPoint);
        toast.success("Link copiado al portapapeles");
      }
      break;
    case "sendLink": callbacks.onSendLink?.(payment); break;
    case "markPaid": callbacks.onMarkPaid?.(payment.id); break;
    case "delete": callbacks.onDeletePayment?.(payment.id); break;
    case "viewReceipt":
      if (payment.receiptUrl) window.open(payment.receiptUrl, "_blank");
      break;
    case "downloadReceipt":
      window.open(`/api/payments/${payment.id}/receipt`, "_blank");
      break;
    case "attachReceipt": callbacks.onAttachReceipt?.(payment.id); break;
  }
}

/** Builds a short hint describing which payment (cuota / monto). */
function buildContextHint(payment: Payment): string {
  if (payment.installmentLabel) return `cuota ${payment.installmentLabel}`;
  if (payment.installmentIndex != null) return `cuota ${payment.installmentIndex}`;
  return `pago de ${formatAmount(payment.amount)}`;
}

/** Builds the label for the "More actions" trigger, describing which payment. */
function buildAriaLabel(payment: Payment): string {
  return `Más acciones para ${buildContextHint(payment)}`;
}

/** Builds the label for the inline secondary icon-only button. */
function buildInlineSecondaryLabel(action: ActionId, payment: Payment): string {
  const cfg = ACTION_CONFIG[action];
  return `${cfg.label} · ${buildContextHint(payment)}`;
}

export function PaymentRowActions({
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
  compact = false,
}: PaymentRowActionsProps) {
  const isPending = payment.status === "PENDING";
  const isCompleted = payment.status === "COMPLETED";
  const isMercadoPago = payment.method === "MERCADO_PAGO";
  const isExpired = isPaymentExpired(payment);

  const callbacks = { onGenerateLink, onRegenerateLink, onMarkPaid, onDeletePayment, onAttachReceipt, onSendLink, onUploadReceipt };
  const loadingState = { generatingLinkId, regeneratingLinkId, attachingReceiptId };

  // ── Action eligibility ────────────────────────────────────────────────────
  const canGenerateLink = isPending && isMercadoPago && !payment.initPoint && onGenerateLink;
  const canCopyLink = isPending && isMercadoPago && payment.initPoint && !isExpired;
  const canRegenerateLink =
    isPending && isMercadoPago && isExpired && payment.initPoint && onRegenerateLink;
  const canMarkPaid = isPending && onMarkPaid;
  const canDelete = isPending && !isMercadoPago && onDeletePayment;
  const canViewReceipt = Boolean(payment.receiptUrl);
  const canDownloadReceipt = isCompleted && isMercadoPago;
  // La acción es elegible si hay un handler (viejo callback o nuevo Popover).
  // Si solo hay onUploadReceipt (nuevo), el Popover se renderiza como primary.
  // Si solo hay onAttachReceipt (viejo), el dropdown item lo invoca.
  const canAttachReceipt = isCompleted && !payment.receiptUrl && (onAttachReceipt || onUploadReceipt);
  const canSendLink = isPending && isMercadoPago && payment.initPoint && onSendLink;

  // ── Primary action ───────────────────────────────────────────────────────
  const primaryAction: ActionId | null = canGenerateLink
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
              : canAttachReceipt
                ? "attachReceipt"
                : null;

  // ── Secondary actions ─────────────────────────────────────────────────────
  const allSecondary: ActionId[] = [];
  if (canMarkPaid && primaryAction !== "markPaid") allSecondary.push("markPaid");
  if (canDelete) allSecondary.push("delete");
  if (canViewReceipt && primaryAction !== "viewReceipt") allSecondary.push("viewReceipt");
  if (canDownloadReceipt && primaryAction !== "downloadReceipt") allSecondary.push("downloadReceipt");
  // Option C: when onUploadReceipt is provided, attachReceipt is handled by the Popover
  // as the primary action — do NOT add it to the dropdown.
  if (canAttachReceipt && primaryAction !== "attachReceipt" && !onUploadReceipt) allSecondary.push("attachReceipt");
  if (canSendLink) allSecondary.push("sendLink");

  // ── UX rule: 1 secondary → inline button, 2+ → dropdown ────────────────
  // The single-secondary inline button is icon-only with a tooltip. This
  // avoids the "3-dot menu with one item" pattern that wastes visual real
  // estate without any benefit. Two or more secondaries keep the dropdown
  // because inlining three+ icon-only buttons crowds the row.
  const inlineSecondary = primaryAction && allSecondary.length === 1 ? allSecondary[0] : null;
  const dropdownSecondary = primaryAction && allSecondary.length >= 2 ? allSecondary : [];

  // ── UX rule: when primary is absent but a single secondary exists, promote it ──
  const effectivePrimary =
    primaryAction ?? (allSecondary.length === 1 ? allSecondary[0] : null);
  const dropdownOnly =
    !primaryAction && allSecondary.length >= 2 ? allSecondary : [];

  // ── Size tokens ──────────────────────────────────────────────────────────
  const btnHeight = compact ? "h-6" : "h-7";
  const btnText = compact ? "text-[10px]" : "text-xs";
  const iconSize = compact ? "size-3" : "size-3.5";
  const iconBtnSize = compact ? "size-6" : "size-7";

  // ── Primary button (outlined with text + icon) ───────────────────────────
  const renderPrimaryButton = (action: ActionId) => {
    const cfg = ACTION_CONFIG[action];
    const loading = isActionLoading(action, payment, loadingState);
    const Icon = loading ? Loader2 : cfg.icon;
    return (
      <Button
        key={action}
        size="sm"
        variant="outline"
        className={cn(btnHeight, "px-2", btnText)}
        title={cfg.tooltip}
        aria-label={cfg.tooltip}
        disabled={loading}
        onClick={() => runAction(action, payment, callbacks)}
      >
        <Icon className={cn(iconSize, "mr-0.5", loading && "animate-spin")} />
        {cfg.label}
      </Button>
    );
  };

  // ── Inline secondary button (icon-only, ghost) ───────────────────────────
  const renderInlineSecondary = (action: ActionId) => {
    const cfg = ACTION_CONFIG[action];
    const loading = isActionLoading(action, payment, loadingState);
    const Icon = loading ? Loader2 : cfg.icon;
    const label = buildInlineSecondaryLabel(action, payment);
    return (
      <Button
        key={action}
        variant="ghost"
        className={cn(
          iconBtnSize,
          "p-0",
          cfg.destructive && "text-muted-foreground hover:text-destructive-text hover:bg-destructive/10",
        )}
        title={label}
        aria-label={label}
        disabled={loading}
        onClick={() => runAction(action, payment, callbacks)}
      >
        <Icon className={cn(iconSize, loading && "animate-spin")} />
      </Button>
    );
  };

  // ── Dropdown menu item ───────────────────────────────────────────────────
  const renderDropdownItem = (action: ActionId, isLast: boolean) => {
    const cfg = ACTION_CONFIG[action];
    const loading = isActionLoading(action, payment, loadingState);
    const Icon = loading ? Loader2 : cfg.icon;
    const showSeparator = cfg.separatorBefore && !isLast;
    return (
      <div key={action}>
        {showSeparator && <DropdownMenuSeparator />}
        <DropdownMenuItem
          variant={cfg.destructive ? "destructive" : "default"}
          disabled={loading}
          onClick={() => runAction(action, payment, callbacks)}
        >
          <Icon className={cn("size-3.5 shrink-0", loading && "animate-spin")} />
          {loading && action === "attachReceipt" ? "Adjuntando..." : cfg.label}
        </DropdownMenuItem>
      </div>
    );
  };

  // ── Compose ──────────────────────────────────────────────────────────────
  const hasNothing =
    !effectivePrimary && !inlineSecondary && dropdownSecondary.length === 0 && dropdownOnly.length === 0;

  return (
    <div className="flex items-center justify-end gap-1">
      {effectivePrimary && effectivePrimary === "attachReceipt" && onUploadReceipt ? (
        <AttachReceiptPopover
          triggerLabel={ACTION_CONFIG.attachReceipt.label}
          triggerTooltip={ACTION_CONFIG.attachReceipt.tooltip}
          compact={compact}
          onSubmit={(file) => onUploadReceipt(payment.id, file)}
        />
      ) : (
        effectivePrimary && renderPrimaryButton(effectivePrimary)
      )}
      {inlineSecondary && renderInlineSecondary(inlineSecondary)}
      {dropdownSecondary.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                className={cn(iconBtnSize, "p-0 text-muted-foreground hover:text-foreground")}
                aria-label={buildAriaLabel(payment)}
                title={buildAriaLabel(payment)}
              >
                <MoreHorizontal className={iconSize} />
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="w-48">
            {dropdownSecondary.map((action, idx) =>
              renderDropdownItem(action, idx === dropdownSecondary.length - 1),
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {dropdownOnly.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                className={cn(iconBtnSize, "p-0 text-muted-foreground hover:text-foreground")}
                aria-label={buildAriaLabel(payment)}
                title={buildAriaLabel(payment)}
              >
                <MoreHorizontal className={iconSize} />
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="w-48">
            {dropdownOnly.map((action, idx) =>
              renderDropdownItem(action, idx === dropdownOnly.length - 1),
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {hasNothing && <span className="text-muted-foreground text-[10px]">—</span>}
    </div>
  );
}
