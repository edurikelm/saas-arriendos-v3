"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MoreHorizontal,
  FileText,
  Check,
  Send,
  RefreshCw,
  Trash2,
  CalendarClock,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ACTION_CONFIG } from "@/components/payments/payment-row-actions";
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

function formatMonthLabel(dateString: string | null | undefined): string {
  if (!dateString) return "";
  const key = String(dateString).slice(0, 10);
  const [y, m] = key.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, 1, 12));
  return date
    .toLocaleDateString("es-CL", { month: "long", year: "numeric", timeZone: "UTC" })
    .replace(/^./, (c) => c.toUpperCase());
}

const METHOD_LABELS: Record<string, string> = {
  MERCADO_PAGO: "Mercado Pago",
  CASH: "Efectivo",
  TRANSFER: "Transferencia",
};

type Tone = "success" | "info" | "warning" | "destructive";

const toneClasses: Record<Tone, { bar: string; text: string }> = {
  success: { bar: "bg-success", text: "text-success" },
  info: { bar: "bg-info", text: "text-info" },
  warning: { bar: "bg-warning", text: "text-warning" },
  destructive: { bar: "bg-destructive", text: "text-destructive" },
};

const statusBadgeVariant: Record<string, "success" | "warning" | "destructive" | "secondary"> = {
  COMPLETED: "success",
  PENDING: "warning",
  FAILED: "destructive",
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
  nowKey,
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

  // Tone derivation
  let tone: Tone;
  if (isCompleted) {
    tone = "success";
  } else if (isPending && daysFromNow < 0) {
    tone = "destructive"; // overdue
  } else if (isPending && daysFromNow === 0) {
    tone = "warning"; // due today
  } else {
    tone = "info";
  }

  const { bar: barClass } = toneClasses[tone];
  const installmentNumber = payment.installmentIndex ?? index + 1;
  const monthLabel = formatMonthLabel(payment.dueDate);
  const methodLabel = METHOD_LABELS[payment.method] ?? "—";

  // Primary action cascade (brief §5.4)
  const canGenerateLink = isPending && isMercadoPago && !payment.initPoint && !!onGenerateLink;
  const canRegenerateLink = isPending && isMercadoPago && isExpired && !!payment.initPoint && !!onRegenerateLink;
  const canSendLink = isPending && isMercadoPago && !!payment.initPoint && !!onSendLink;
  const canMarkPaid = isPending && isActive && !!onMarkPaid;
  const canDelete = isPending && !isMercadoPago && isActive && !!onDeletePayment;
  const canViewReceipt = !!payment.receiptUrl;

  const isGenerating = generatingLinkId === payment.id;
  const isRegenerating = regeneratingLinkId === payment.id;

  // Dropdown items
  const dropdownItems: Array<{ id: string; label: string; destructive?: boolean }> = [];
  if (canGenerateLink) dropdownItems.push({ id: "generate", label: ACTION_CONFIG.generate.label });
  if (canRegenerateLink) dropdownItems.push({ id: "regenerate", label: ACTION_CONFIG.regenerate.label });
  if (canSendLink) dropdownItems.push({ id: "sendLink", label: ACTION_CONFIG.sendLink.label });
  if (canMarkPaid) dropdownItems.push({ id: "markPaid", label: ACTION_CONFIG.markPaid.label });
  if (canViewReceipt) dropdownItems.push({ id: "viewReceipt", label: ACTION_CONFIG.viewReceipt.label });
  if (canDelete) dropdownItems.push({ id: "delete", label: ACTION_CONFIG.delete.label, destructive: true });

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

  const isLast = index === total - 1;
  const ariaLabel = `Cuota ${installmentNumber} de ${total}`;

  return (
    <div className="relative flex gap-4" data-testid={`timeline-node-${payment.id}`}>
      {/* Connector — left side vertical line */}
      {!isLast && (
        <div
          className="absolute left-2 top-7 bottom-[-20px] w-[2px] bg-foreground/10"
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

      {/* Content */}
      <div className={cn("flex-1 rounded-lg border bg-card overflow-hidden", borderClass(tone))}>
        {/* ───── HEADER: eyebrow + badge ───── */}
        <div className="flex items-start justify-between gap-3 px-4 pt-3.5 pb-2">
          <div className="min-w-0 flex-1">
            <p
              className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
              aria-label={ariaLabel}
            >
              Mensualidad · Cuota {installmentNumber} de {total}
            </p>
            {monthLabel && (
              <p className="text-xs text-muted-foreground mt-0.5 truncate">{monthLabel}</p>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
            {isPending && daysFromNow < 0 && (
              <span className="text-[10px] text-destructive font-medium uppercase tracking-wider">
                Vencido
              </span>
            )}
            <Badge variant={statusBadgeVariant[payment.status] ?? "secondary"} className="text-[10px]">
              {isCompleted ? "Pagado" : isPending ? "Pendiente" : "Fallido"}
            </Badge>
          </div>
        </div>

        {/* ───── HERO AMOUNT ───── */}
        <div className="px-4 pb-3">
          <p className="text-2xl font-bold tabular-nums text-foreground tracking-tight">
            {formatAmount(payment.amount)}
          </p>
        </div>

        {/* ───── DIVIDER ───── */}
        <div className="border-t border-border" />

        {/* ───── FOOTER: metadata + CTA ───── */}
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground min-w-0">
            {payment.dueDate && (
              <span className="inline-flex items-center gap-1.5">
                <CalendarClock className="size-3.5 shrink-0" aria-hidden="true" />
                <span className="tabular-nums">Vence {formatShortDate(payment.dueDate)}</span>
                {isPending && daysFromNow >= 0 && daysFromNow <= 7 && daysFromNow > 0 && (
                  <span className="text-info font-medium">· En {daysFromNow} días</span>
                )}
                {isPending && daysFromNow === 0 && (
                  <span className="text-warning font-medium">· Vence hoy</span>
                )}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <Wallet className="size-3.5 shrink-0" aria-hidden="true" />
              <span>{methodLabel}</span>
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {/* Primary action */}
            {isCompleted && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1"
                disabled={!payment.receiptUrl}
                title={!payment.receiptUrl ? "Sin comprobante adjunto" : undefined}
                onClick={() => payment.receiptUrl && window.open(payment.receiptUrl, "_blank")}
              >
                <FileText className="size-3.5" />
                Ver comprobante
              </Button>
            )}
            {isPending && canGenerateLink && (
              <Button
                variant="default"
                size="sm"
                className="h-7 text-xs"
                onClick={() => onGenerateLink?.(payment.id)}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  "Generando..."
                ) : (
                  <>
                    <Send className="size-3.5 mr-1" />
                    Enviar link
                  </>
                )}
              </Button>
            )}
            {isPending && !canGenerateLink && canSendLink && (
              <Button
                variant="default"
                size="sm"
                className="h-7 text-xs"
                onClick={() => onSendLink?.(payment)}
              >
                <Send className="size-3.5 mr-1" />
                Enviar link
              </Button>
            )}
            {isPending && !canGenerateLink && !canSendLink && canMarkPaid && (
              <Button
                variant="destructive"
                size="sm"
                className="h-7 text-xs"
                onClick={() => onMarkPaid?.(payment.id)}
              >
                <Check className="size-3.5 mr-1" />
                Marcar pagado
              </Button>
            )}

            {/* Dropdown secondaries */}
            {dropdownItems.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="sm"
                      className="size-7 p-0 text-muted-foreground hover:text-foreground"
                      aria-label={`Más acciones para Cuota ${installmentNumber}`}
                    >
                      <MoreHorizontal className="size-3.5" />
                    </Button>
                  }
                />
                <DropdownMenuContent align="end" className="w-48">
                  {dropdownItems.map((item, idx) => (
                    <div key={item.id}>
                      {idx > 0 && <DropdownMenuSeparator />}
                      <DropdownMenuItem
                        variant={item.destructive ? "destructive" : "default"}
                        onClick={() => runAction(item.id)}
                      >
                        {item.label}
                      </DropdownMenuItem>
                    </div>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function borderClass(tone: Tone): string {
  const map: Record<Tone, string> = {
    success: "border-success/20",
    info: "border-info/20",
    warning: "border-warning/20",
    destructive: "border-destructive/20",
  };
  return map[tone];
}