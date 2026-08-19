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
  onSendLink,
  generatingLinkId,
  regeneratingLinkId,
  isFirstOverdue,
}: PaymentTimelineNodeProps) {
  const isCompleted = payment.status === "COMPLETED";
  const isPending = payment.status === "PENDING";
  const isMercadoPago = payment.method === "MERCADO_PAGO";
  const isExpired = payment.expiresAt ? new Date(payment.expiresAt) < new Date() : false;

  // Tone derivation — todos los pagos PENDING cargan el tono `warning` (amber)
  // para coincidir con el KPI "Pendiente" del header. La etiqueta del badge (abajo)
  // se calcula por separado desde `daysFromNow` para reflejar la urgencia real,
  // no el color. Así "Vence 1 oct 2026" muestra badge "Pendiente", no "Vence hoy".
  let tone: Tone;
  if (isCompleted) {
    tone = "success";
  } else if (isPending && daysFromNow < 0) {
    tone = "destructive"; // overdue
  } else {
    tone = "warning"; // PENDING (any future or due today) — matches KPI Pendiente
  }

  // Label del badge — refleja la urgencia real contra `dueDate`, NO el color.
  // Cuatro ramas (mismo orden que el tone derivation para evitar inconsistencias).
  const badgeLabel = isCompleted
    ? "Pagado"
    : daysFromNow < 0
      ? "Vencido"
      : daysFromNow === 0
        ? "Vence hoy"
        : "Pendiente";

  const { bar: barClass } = toneClasses[tone];
  const installmentNumber = payment.installmentIndex ?? index + 1;
  const monthLabel = formatMonthLabel(payment.dueDate);
  const methodLabel = METHOD_LABELS[payment.method] ?? "—";

  // Primary action cascade — alineado con ACTION_CONFIG en payment-row-actions.tsx
  // (seam canónico de UI de acciones de pago). Orden: generate → regenerate → copy → markPaid.
  const canGenerateLink = isPending && isMercadoPago && !payment.initPoint && !!onGenerateLink;
  const canRegenerateLink = isPending && isMercadoPago && isExpired && !!payment.initPoint && !!onRegenerateLink;
  const canCopyLink = isPending && isMercadoPago && !!payment.initPoint && !isExpired;
  const canSendLink = isPending && isMercadoPago && !!payment.initPoint && !!onSendLink;
  const canMarkPaid = isPending && isActive && !!onMarkPaid;
  const canDelete = isPending && !isMercadoPago && isActive && !!onDeletePayment;
  const canViewReceipt = !!payment.receiptUrl;

  const isGenerating = generatingLinkId === payment.id;
  const isRegenerating = regeneratingLinkId === payment.id;

  // Action primaria: generate > regenerate > copy > markPaid > viewReceipt.
  // `sendLink` queda como secundario (dropdown), nunca como primary.
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
  // Esto elimina los 3 puntos cuando solo hay "Marcar pagado" como secundaria
  // (caso típico de cuota mensual sin link generado).
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

  const isLast = index === total - 1;
  const ariaLabel = `Cuota ${installmentNumber} de ${total}`;
  const amountKicker = isCompleted ? "Monto cobrado" : "Monto a pagar";

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

      {/* Content — Layout 2 zonas:
            • Info zone (izquierda): eyebrow + título (mes + badge) + amount block + meta line
            • Actions zone (derecha):  primary action | secondary action (o dropdown)
          El monto vive en el info zone (no con los botones) para que la columna
          derecha solo contenga acciones — evita la percepción de "3 columnas"
          que aparece cuando monto + acciones compiten por el mismo cluster vertical.
          Border canónico del design system; sin border tint por tone. */}
      <div
        className={cn(
          "flex-1 rounded-lg border border-border bg-card overflow-hidden transition-colors",
          isActive && "hover:bg-muted/30",
          !isActive && "opacity-60",
        )}
      >
        <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
          {/* ───── INFO ZONE (izquierda) ───── */}
          <div className="min-w-0 flex-1 flex flex-col gap-2">
            <p
              className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
              aria-label={ariaLabel}
            >
              Mensualidad · Cuota {installmentNumber} de {total}
            </p>
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <h3 className="text-sm font-semibold text-foreground truncate">
                {monthLabel || "—"}
              </h3>
              <Badge variant={toneBadgeVariant[tone]} className="shrink-0">
                {badgeLabel}
              </Badge>
            </div>
            {/* Amount block — vive con el info zone. Kicker 10px whisper + número tabular grande. */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {amountKicker}
              </p>
              <p className="text-xl font-bold tabular-nums text-foreground tracking-tight">
                {formatAmount(payment.amount)}
              </p>
            </div>
            <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5 text-xs text-muted-foreground min-w-0">
              {payment.dueDate && (
                <span className="tabular-nums">
                  Vence {formatShortDate(payment.dueDate)}
                  {isPending && daysFromNow >= 0 && daysFromNow <= 7 && daysFromNow > 0 && (
                    <span className="text-info font-medium"> · En {daysFromNow} días</span>
                  )}
                  {isPending && daysFromNow === 0 && (
                    <span className="text-warning font-medium"> · Vence hoy</span>
                  )}
                </span>
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
                      aria-label={`Más acciones para Cuota ${installmentNumber}`}
                    >
                      <MoreHorizontal className="size-3.5 mr-1" />
                      Más acciones
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
      </div>
    </div>
  );
}