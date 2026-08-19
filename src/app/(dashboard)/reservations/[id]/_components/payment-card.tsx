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
  Copy,
  ExternalLink,
  RefreshCw,
  Send,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
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

  // Primary action cascade — alineado con ACTION_CONFIG / payment-row-actions.tsx
  // (seam UI canónico). Orden: generate → regenerate → copy → markPaid → viewReceipt.
  // `sendLink` queda como secundario (dropdown), nunca como primary.
  const canGenerateLink = isPending && isMercadoPago && !payment.initPoint && !!onGenerateLink;
  const canRegenerateLink = isPending && isMercadoPago && isExpired && !!payment.initPoint && !!onRegenerateLink;
  const canCopyLink = isPending && isMercadoPago && !!payment.initPoint && !isExpired;
  const canSendLink = isPending && isMercadoPago && !!payment.initPoint && !!onSendLink;
  const canMarkPaid = isPending && isActive && !!onMarkPaid;
  const canDelete = isPending && !isMercadoPago && isActive && !!onDeletePayment;
  const canViewReceipt = !!payment.receiptUrl;

  const isGenerating = generatingLinkId === payment.id;
  const isRegenerating = regeneratingLinkId === payment.id;

  type PrimaryId = "generate" | "regenerate" | "copy" | "markPaid" | "viewReceipt";
  const primaryAction: PrimaryId | null = canGenerateLink
    ? "generate"
    : canRegenerateLink
      ? "regenerate"
      : canCopyLink
        ? "copy"
        : canMarkPaid
          ? "markPaid"
          : isCompleted && canViewReceipt
            ? "viewReceipt"
            : null;

  // Secondaries — todo lo que NO es primary pero sigue siendo elegible.
  // UX rule (consistente con payment-row-actions.tsx): 1 secundaria → inline
  // (botón visible, sin dropdown), 2+ secundarias → dropdown group.
  type SecondaryId = "markPaid" | "delete" | "viewReceipt" | "sendLink";
  const secondaries: SecondaryId[] = [];
  if (canMarkPaid && primaryAction !== "markPaid") secondaries.push("markPaid");
  if (canDelete) secondaries.push("delete");
  if (isCompleted && canViewReceipt && primaryAction !== "viewReceipt") secondaries.push("viewReceipt");
  if (canSendLink) secondaries.push("sendLink");

  const inlineSecondary: SecondaryId | null =
    primaryAction && secondaries.length === 1 ? secondaries[0] : null;
  const dropdownSecondaries: SecondaryId[] =
    primaryAction && secondaries.length >= 2 ? secondaries : [];

  const dropdownItems = dropdownSecondaries.map((id) => ({
    id,
    label: ACTION_CONFIG[id].label,
    destructive: id === "delete",
  }));

  const runAction = (actionId: string) => {
    switch (actionId) {
      case "generate": onGenerateLink?.(payment.id); break;
      case "regenerate": onRegenerateLink?.(payment.id); break;
      case "copy":
        if (payment.initPoint) {
          navigator.clipboard.writeText(payment.initPoint);
          toast.success("Link copiado al portapapeles");
        }
        break;
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
  const amountKicker = isCompleted ? "Monto cobrado" : "Monto a pagar";

  return (
    <article
      data-testid={`payment-card-${payment.id}`}
      aria-label={ariaLabel}
      className={cn(
        "px-4 py-3 transition-colors",
        isActive && "hover:bg-muted/30",
        !isActive && "opacity-60",
      )}
    >
      {/* Layout 2 zonas (igual que PaymentTimelineNode para coherencia visual):
            • Info zone (izquierda): contextHint + status badge + amount block + meta line
            • Actions zone (derecha):  primary action | secondary action (o dropdown)
          El monto vive en el info zone (no con los botones) para que la columna
          derecha solo contenga acciones — evita la percepción de "3 columnas". */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        {/* ───── INFO ZONE (izquierda) ───── */}
        <div className="min-w-0 flex-1 flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground truncate">
              {contextHint}
            </p>
            <Badge variant={statusBadgeVariant[payment.status] ?? "secondary"} className="shrink-0">
              {statusBadgeLabel[payment.status] ?? payment.status}
            </Badge>
          </div>
          {/* Amount block — vive con el info zone */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {amountKicker}
            </p>
            <p className="text-xl font-bold tabular-nums text-foreground tracking-tight">
              {formatAmount(payment.amount)}
            </p>
          </div>
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

        {/* ───── ACTIONS ZONE (derecha) — solo botones, sin monto ───── */}
        <div className="flex flex-col items-start gap-1.5 shrink-0 sm:items-end">
          {/* Primary action */}
          {primaryAction === "generate" && (
            <Button
              variant="link"
              size="sm"
              className="h-7 px-1 text-xs text-primary hover:text-primary"
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
              className="h-7 px-1 text-xs text-primary hover:text-primary"
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
          {primaryAction === "copy" && (
            <Button
              variant="link"
              size="sm"
              className="h-7 px-1 text-xs text-primary hover:text-primary"
              onClick={() => runAction("copy")}
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
              className="h-7 px-1 text-xs text-warning hover:text-warning"
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

          {/* Secondary: dropdown (2+) OR inline button (1) */}
          {dropdownItems.length > 0 ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="link"
                    size="sm"
                    className="h-7 px-1 text-xs text-muted-foreground hover:text-foreground"
                    aria-label={`Más acciones para ${contextHint}`}
                  >
                    <MoreHorizontal className="size-3.5 mr-1" />
                    Más acciones
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
          ) : inlineSecondary === "markPaid" ? (
            <Button
              variant="link"
              size="sm"
              className="h-7 px-1 text-xs text-warning hover:text-warning"
              onClick={() => onMarkPaid?.(payment.id)}
            >
              <Check className="size-3.5 mr-1" />
              Marcar pagado
            </Button>
          ) : inlineSecondary === "sendLink" ? (
            <Button
              variant="link"
              size="sm"
              className="h-7 px-1 text-xs text-primary hover:text-primary"
              onClick={() => onSendLink?.(payment)}
            >
              <Send className="size-3.5 mr-1" />
              Enviar link
            </Button>
          ) : inlineSecondary === "viewReceipt" ? (
            <Button
              variant="link"
              size="sm"
              className="h-7 px-1 text-xs text-muted-foreground hover:text-foreground gap-1"
              onClick={() => payment.receiptUrl && window.open(payment.receiptUrl, "_blank")}
            >
              <FileText className="size-3.5" />
              Ver comprobante
            </Button>
          ) : inlineSecondary === "delete" ? (
            <Button
              variant="link"
              size="sm"
              className="h-7 px-1 text-xs text-muted-foreground hover:text-destructive"
              onClick={() => onDeletePayment?.(payment.id)}
              title="Eliminar pago"
            >
              <Trash2 className="size-3.5 mr-1" />
              Eliminar
            </Button>
          ) : null}
        </div>
      </div>
    </article>
  );
}