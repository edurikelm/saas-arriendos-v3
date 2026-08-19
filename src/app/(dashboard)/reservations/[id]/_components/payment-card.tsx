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

  // Primary action cascade (brief §5.4)
  const canMarkPaid = isPending && isActive && !!onMarkPaid;
  const canGenerateLink = isPending && isMercadoPago && !payment.initPoint && !!onGenerateLink;
  const canRegenerateLink = isPending && isMercadoPago && isExpired && !!payment.initPoint && !!onRegenerateLink;
  const canSendLink = isPending && isMercadoPago && !!payment.initPoint && !!onSendLink;
  const canDelete = isPending && !isMercadoPago && isActive && !!onDeletePayment;
  const canViewReceipt = !!payment.receiptUrl;

  // Dropdown secondaries
  const dropdownItems: Array<{ id: string; label: string; destructive?: boolean }> = [];
  if (canMarkPaid) dropdownItems.push({ id: "markPaid", label: ACTION_CONFIG.markPaid.label });
  if (canDelete) dropdownItems.push({ id: "delete", label: ACTION_CONFIG.delete.label, destructive: true });
  if (canViewReceipt) dropdownItems.push({ id: "viewReceipt", label: ACTION_CONFIG.viewReceipt.label });
  if (canSendLink) dropdownItems.push({ id: "sendLink", label: ACTION_CONFIG.sendLink.label });
  if (canGenerateLink) dropdownItems.push({ id: "generate", label: ACTION_CONFIG.generate.label });
  if (canRegenerateLink) dropdownItems.push({ id: "regenerate", label: ACTION_CONFIG.regenerate.label });

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

  // Eyebrow context: prioritize specific labels, fall back to ordinal position
  const contextHint =
    payment.paymentType === "EXTRA" && payment.title
      ? payment.title
      : payment.installmentLabel
        ? payment.installmentLabel
        : payment.installmentIndex != null
          ? `Cuota ${payment.installmentIndex}`
          : `Pago ${index + 1} de ${total}`;

  const methodLabel = METHOD_LABELS[payment.method] ?? "—";
  const ariaLabel =
    payment.paymentType === "EXTRA" && payment.title
      ? `Cobro extra · ${payment.title}`
      : payment.installmentIndex != null
        ? `Cuota ${payment.installmentIndex}`
        : `Pago ${index + 1} de ${total}`;

  return (
    <article
      data-testid={`payment-card-${payment.id}`}
      aria-label={ariaLabel}
      className={cn(
        "px-4 py-3 flex flex-col gap-2 transition-colors",
        isActive && "hover:bg-muted/30",
        !isActive && "opacity-60",
      )}
    >
      {/* Header: context eyebrow + status badge */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground min-w-0 flex-1">
          {contextHint}
        </p>
        <Badge variant={statusBadgeVariant[payment.status] ?? "secondary"} className="shrink-0">
          {statusBadgeLabel[payment.status] ?? payment.status}
        </Badge>
      </div>

      {/* Single info row: status dot + amount + meta + actions. El dot refuerza el
          badge del header con color al lado del monto — patrón "Status indicators"
          del design system (DESIGN.md). self-center porque el círculo no tiene
          baseline; el resto del row usa items-baseline para alinear el tipo. */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 min-w-0 flex-1">
          <span
            className={cn(
              "size-2 rounded-full shrink-0 self-center",
              payment.status === "PENDING" && "bg-warning",
              payment.status === "COMPLETED" && "bg-success",
              payment.status === "FAILED" && "bg-destructive",
            )}
            aria-hidden="true"
          />
          <p className="text-base font-bold tabular-nums text-foreground tracking-tight">
            {formatAmount(payment.amount)}
          </p>
          <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5 text-xs text-muted-foreground min-w-0">
            {payment.paidAt && (
              <span className="tabular-nums">Pagado {formatShortDate(payment.paidAt)}</span>
            )}
            {payment.dueDate && (
              <span className="tabular-nums">Vence {formatShortDate(payment.dueDate)}</span>
            )}
            <span>{methodLabel}</span>
          </div>
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
              disabled={generatingLinkId === payment.id}
            >
              {generatingLinkId === payment.id ? "Generando..." : "Generar link"}
            </Button>
          )}
          {isPending && canRegenerateLink && (
            <Button
              variant="default"
              size="sm"
              className="h-7 text-xs"
              onClick={() => onRegenerateLink?.(payment.id)}
              disabled={regeneratingLinkId === payment.id}
            >
              {regeneratingLinkId === payment.id ? "Regenerando..." : "Regenerar link"}
            </Button>
          )}
          {isPending && !canGenerateLink && !canRegenerateLink && canSendLink && (
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
          {isPending && !canGenerateLink && !canRegenerateLink && !canSendLink && canMarkPaid && (
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
                    aria-label={`Más acciones para ${contextHint}`}
                  >
                    <MoreHorizontal className="size-3.5" />
                  </Button>
                }
              />
              <DropdownMenuContent align="end" className="w-48">
                {dropdownItems.map((item, idx) => (
                  <div key={item.id}>
                    {idx > 0 && idx === dropdownItems.findIndex((i) => i.destructive) && (
                      <DropdownMenuSeparator />
                    )}
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
    </article>
  );
}