"use client";

import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Calendar,
  User,
  CreditCard,
  Check,
  RefreshCw,
  FileText,
  ExternalLink,
  Copy,
  Plus,
  Loader2,
  MoreHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { confirmPayment, revertPayment, generatePaymentLink, markPaymentAsPaid, attachReceipt } from "@/lib/actions/payments";
import { CheckCircle, Search } from "lucide-react";
import { AddPaymentDialog } from "./add-payment-dialog";
import { ReceiptUpload } from "@/components/ui/receipt-upload";
import { ReservationDocumentsPanel } from "./reservation-documents-panel";
import { getInclusiveMonths } from "@/lib/reservation-dates";

export interface Payment {
  id: string;
  installmentIndex?: number;
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
}

interface Property {
  id: string;
  name: string;
  color?: string;
  unitsAvailable?: number;
  dailyPrice?: string;
  monthlyPrice?: string | null;
}

interface Client {
  id: string;
  name: string;
  email: string;
  phone?: string;
}

export interface ReservationDetailProps {
  reservation: {
    id: string;
    propertyId: string;
    clientId: string;
    startDate: string;
    endDate: string;
    billingType: string;
    unitsBooked: number;
    totalPrice: string;
    status: string;
    bookingAirbnb: boolean;
    notes: string | null;
    property: Property;
    client: Client;
    payments: Payment[];
  };
  open: boolean;
  onClose: () => void;
  onCopyLink?: (initPoint: string) => void;
  onRegenerateLink?: (paymentId: string) => void;
  onConfirmPayment?: (paymentId: string) => void;
  onDeletePayment?: (paymentId: string) => void;
  onEdit?: () => void;
  onCancel?: () => void;
  onRefresh?: (reservationId: string) => void;
  onMarkPaid?: (paymentId: string) => void;
  onAddPayment?: () => void;
  onCheckPaymentStatus?: (paymentId: string) => void;
  plan?: "FREE" | "PRO" | null;
}

const statusConfig: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  PENDING: { label: "Pendiente", variant: "secondary" },
  CONFIRMED: { label: "Confirmada", variant: "default" },
  CANCELLED: { label: "Cancelada", variant: "destructive" },
  COMPLETED: { label: "Completada", variant: "outline" },
};

const paymentStatusConfig: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className?: string }
> = {
  PENDING: { label: "Pendiente", variant: "secondary", className: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800" },
  COMPLETED: { label: "Pagado", variant: "outline", className: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800" },
  FAILED: { label: "Fallido", variant: "destructive", className: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-800" },
};

const paymentMethodLabels: Record<string, string> = {
  MERCADO_PAGO: "Mercado Pago",
  CASH: "Efectivo",
  TRANSFER: "Transferencia",
};

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("es-CL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDueDate(dateString: string): string {
  return format(new Date(dateString), "d MMM yyyy", { locale: es } as any);
}

function formatAmount(amount: string | number): string {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(amount));
}

function formatPrice(price: string | number): string {
  return new Intl.NumberFormat("CLP", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(price));
}

function getNights(startDate: string, endDate: string): number {
  const diff = new Date(endDate).getTime() - new Date(startDate).getTime();
  return Math.round(diff / (1000 * 60 * 60 * 24)) + 1;
}

function getMonths(startDate: string, endDate: string): number {
  return getInclusiveMonths(startDate, endDate);
}

export function PaymentsTable({
  payments,
  onGenerateLink,
  onMarkPaid,
  onDeletePayment,
  onAttachReceipt,
  showInstallmentColumns,
  showConceptColumn = false,
  generatingLinkId,
}: {
  payments: Payment[];
  onGenerateLink?: (paymentId: string) => void;
  onMarkPaid?: (paymentId: string) => void;
  onDeletePayment?: (paymentId: string) => void;
  onAttachReceipt?: (paymentId: string) => void;
  showInstallmentColumns: boolean;
  showConceptColumn?: boolean;
  generatingLinkId?: string | null;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border/70">
      <table className="w-full text-xs">
        <thead className="bg-muted/30">
          <tr>
            {showInstallmentColumns && (
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Cuota</th>
            )}
            {showConceptColumn && (
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Concepto</th>
            )}
            <th className="px-3 py-2 text-left font-medium text-muted-foreground">Monto</th>
            {showInstallmentColumns && (
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Vencimiento</th>
            )}
            <th className="px-3 py-2 text-left font-medium text-muted-foreground">Fecha Pago</th>
            <th className="px-3 py-2 text-left font-medium text-muted-foreground">Medio</th>
            <th className="px-3 py-2 text-left font-medium text-muted-foreground">Estado</th>
            <th className="px-3 py-2 text-right font-medium text-muted-foreground w-[180px]">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {[...payments].sort((a, b) => (a.installmentIndex ?? 0) - (b.installmentIndex ?? 0)).map((payment) => {
            const statusCfg = paymentStatusConfig[payment.status] || paymentStatusConfig.PENDING;
            const isPending = payment.status === "PENDING";
            const isCompleted = payment.status === "COMPLETED";
            const isMercadoPago = payment.method === "MERCADO_PAGO";
            const canGenerateLink = isPending && isMercadoPago && !payment.initPoint && onGenerateLink;
            const canCopyLink = isPending && isMercadoPago && payment.initPoint;
            const canMarkPaid = isPending && onMarkPaid;
            const canDelete = isPending && !isMercadoPago && onDeletePayment;
            const canViewReceipt = Boolean(payment.receiptUrl);
            const canAttachReceipt = isCompleted && !payment.receiptUrl && onAttachReceipt;
            const primaryAction = canGenerateLink
              ? "generate"
              : canCopyLink
                ? "copy"
                : canMarkPaid
                  ? "markPaid"
                  : canViewReceipt
                    ? "viewReceipt"
                    : null;
            const secondaryActions = [
              canMarkPaid && primaryAction !== "markPaid" ? "markPaid" : null,
              canDelete ? "delete" : null,
              canViewReceipt && primaryAction !== "viewReceipt" ? "viewReceipt" : null,
              canAttachReceipt ? "attachReceipt" : null,
            ].filter(Boolean) as Array<"markPaid" | "delete" | "viewReceipt" | "attachReceipt">;

            const renderActionButton = (action: typeof primaryAction) => {
              if (!action) return null;

              if (action === "generate") {
                return (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs"
                    disabled={generatingLinkId === payment.id}
                    onClick={() => onGenerateLink?.(payment.id)}
                  >
                    {generatingLinkId === payment.id ? (
                      <Loader2 className="mr-1 size-3 animate-spin" />
                    ) : (
                      <ExternalLink className="mr-1 size-3" />
                    )}
                    Generar link
                  </Button>
                );
              }

              if (action === "copy") {
                return (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs"
                    onClick={() => {
                      navigator.clipboard.writeText(payment.initPoint!);
                      toast.success("Link copiado al portapapeles");
                    }}
                  >
                    <Copy className="mr-1 size-3" />
                    Copiar link
                  </Button>
                );
              }

              if (action === "markPaid") {
                return (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs"
                    onClick={() => onMarkPaid?.(payment.id)}
                  >
                    <Check className="mr-1 size-3" />
                    Marcar pagado
                  </Button>
                );
              }

              if (action === "viewReceipt") {
                return (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs"
                    onClick={() => window.open(payment.receiptUrl!, "_blank")}
                  >
                    <FileText className="mr-1 size-3" />
                    Ver comp.
                  </Button>
                );
              }

              return null;
            };

            const renderMenuItem = (action: (typeof secondaryActions)[number]) => {
              if (action === "markPaid") {
                return <DropdownMenuItem onClick={() => onMarkPaid?.(payment.id)}>Marcar como pagado</DropdownMenuItem>;
              }

              if (action === "delete") {
                return <DropdownMenuItem variant="destructive" onClick={() => onDeletePayment?.(payment.id)}>Eliminar pago</DropdownMenuItem>;
              }

              if (action === "viewReceipt") {
                return <DropdownMenuItem onClick={() => window.open(payment.receiptUrl!, "_blank")}>Ver comprobante</DropdownMenuItem>;
              }

              return <DropdownMenuItem onClick={() => onAttachReceipt?.(payment.id)}>Adjuntar comprobante</DropdownMenuItem>;
            };

            return (
              <tr key={payment.id} className="border-t border-border/60 transition-colors hover:bg-muted/20">
                {showInstallmentColumns && (
                  <td className="px-3 py-3 font-medium">
                    {payment.installmentIndex ?? "—"}
                  </td>
                )}
                {showConceptColumn && (
                  <td className="px-3 py-3">
                    <p className="font-medium text-foreground">{payment.title || "Cobro extra"}</p>
                    {payment.description && (
                      <p className="text-xs text-muted-foreground line-clamp-1">{payment.description}</p>
                    )}
                  </td>
                )}
                <td className="px-3 py-3 font-medium">{formatAmount(payment.amount)}</td>
                {showInstallmentColumns && (
                  <td className="px-3 py-3">
                    {payment.dueDate ? formatDueDate(payment.dueDate) : "—"}
                  </td>
                )}
                <td className="px-3 py-3 text-muted-foreground text-xs">
                  {payment.paidAt ? formatDate(payment.paidAt) : "—"}
                </td>
                <td className="px-3 py-3">
                  {payment.method === "MERCADO_PAGO" ? "Mercado Pago" : payment.method === "CASH" ? "Efectivo" : payment.method === "TRANSFER" ? "Transferencia" : "—"}
                </td>
                <td className="px-3 py-3">
                  <Badge variant={statusCfg.variant} className={cn("h-5 text-[11px] font-medium", statusCfg.className)}>{statusCfg.label}</Badge>
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center justify-end gap-1">
                    {renderActionButton(primaryAction)}
                    {secondaryActions.length > 0 && (
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button size="icon" variant="ghost" className="size-7" aria-label="Más acciones">
                              <MoreHorizontal className="size-3.5" />
                            </Button>
                          }
                        />
                        <DropdownMenuContent align="end" className="w-44">
                          {secondaryActions.map((action) => (
                            <div key={action}>{renderMenuItem(action)}</div>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                    {!primaryAction && secondaryActions.length === 0 && (
                      <span className="text-muted-foreground text-[10px]">—</span>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function ReservationDetailDialog({
  reservation,
  open,
  onClose,
  onCopyLink,
  onRegenerateLink,
  onConfirmPayment,
  onDeletePayment,
  onEdit,
  onCancel,
  onRefresh,
  onAddPayment,
  plan = "FREE",
}: ReservationDetailProps) {
  const status = statusConfig[reservation.status] || statusConfig.PENDING;
  const nights = getNights(reservation.startDate, reservation.endDate);
  const reservationPayments = reservation.payments.filter((p) => p.paymentType !== "EXTRA");
  const extraPayments = reservation.payments.filter((p) => p.paymentType === "EXTRA");
  const paidAmount = reservationPayments.filter((p) => p.status === "COMPLETED").reduce((sum, p) => sum + Number(p.amount), 0);
  const pendingAmount = Math.max(Number(reservation.totalPrice) - paidAmount, 0);
  const extraTotal = extraPayments.reduce((sum, p) => sum + Number(p.amount), 0);
  const extraPaidAmount = extraPayments.filter((p) => p.status === "COMPLETED").reduce((sum, p) => sum + Number(p.amount), 0);
  const extraPendingAmount = Math.max(extraTotal - extraPaidAmount, 0);
  const grandTotal = Number(reservation.totalPrice) + extraTotal;
  const totalPaid = paidAmount + extraPaidAmount;
  const totalPending = pendingAmount + extraPendingAmount;

  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [generatingLinkId, setGeneratingLinkId] = useState<string | null>(null);
  const [showMarkPaidModal, setShowMarkPaidModal] = useState(false);
  const [markPaidPaymentId, setMarkPaidPaymentId] = useState<string | null>(null);
  const [markPaidDate, setMarkPaidDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [markPaidMethod, setMarkPaidMethod] = useState<"CASH" | "TRANSFER">("CASH");
  const [showAddPaymentDialog, setShowAddPaymentDialog] = useState(false);
  const [isCheckingAllPayments, setIsCheckingAllPayments] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showAttachReceiptModal, setShowAttachReceiptModal] = useState(false);
  const [attachReceiptPaymentId, setAttachReceiptPaymentId] = useState<string | null>(null);
  const [attachReceiptFile, setAttachReceiptFile] = useState<File | null>(null);
  const [isAttachingReceipt, setIsAttachingReceipt] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState<string | null>(null);

  const handleCopyLink = (initPoint: string) => {
    navigator.clipboard.writeText(initPoint);
    toast.success("Link copiado al portapapeles");
    onCopyLink?.(initPoint);
  };

  const handleRegenerateLink = async (paymentId: string) => {
    setGeneratingLinkId(paymentId);
    try {
      const res = await fetch(`/api/payments/${paymentId}`, {
        method: "POST",
      });
      const result = await res.json();
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Link regenerado");
      onRefresh?.(reservation.id);
      onRegenerateLink?.(paymentId);
    } catch {
      toast.error("Error al regenerar link");
    } finally {
      setGeneratingLinkId(null);
    }
  };

  const handleConfirmPayment = async (paymentId: string) => {
    const result = await confirmPayment(paymentId);
    if (result?.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Pago confirmado");
    onRefresh?.(reservation.id);
    onConfirmPayment?.(paymentId);
  };

  const handleRevertPayment = async (paymentId: string) => {
    const result = await revertPayment(paymentId);
    if (result?.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Pago revertido a pendiente");
    onRefresh?.(reservation.id);
  };

  const handleMarkPaidClick = (paymentId: string) => {
    setMarkPaidPaymentId(paymentId);
    setMarkPaidDate(format(new Date(), "yyyy-MM-dd"));
    setMarkPaidMethod("CASH");
    setReceiptFile(null);
    setShowMarkPaidModal(true);
  };

  const handleConfirmMarkPaid = async () => {
    if (!markPaidPaymentId) return;

    let receiptUrl: string | undefined;

    if (receiptFile) {
      setIsUploading(true);
      const uploadFormData = new FormData();
      uploadFormData.append("file", receiptFile);
      uploadFormData.append("folder", "rentalpro/receipts");

      try {
        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: uploadFormData,
        });
        const uploadResult = await uploadRes.json();
        if (uploadResult.error) {
          toast.error(uploadResult.error);
          return;
        }
        receiptUrl = uploadResult.url;
      } catch {
        toast.error("Error al subir comprobante");
        return;
      } finally {
        setIsUploading(false);
      }
    }

    const result = await markPaymentAsPaid(markPaidPaymentId, new Date(markPaidDate), markPaidMethod, receiptUrl);
    if (result?.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Pago marcado como pagado");
    setShowMarkPaidModal(false);
    setMarkPaidPaymentId(null);
    setReceiptFile(null);
    onRefresh?.(reservation.id);
  };

  const handleDeletePayment = (paymentId: string) => {
    toast.success("Pago eliminado", {
      action: {
        label: "Deshacer",
        onClick: async () => {
          try {
            const res = await fetch(`/api/payments/${paymentId}`, {
              method: "PUT",
            });
            if (res.ok) {
              toast.success("Pago restaurado");
onRefresh?.(reservation.id);
            }
          } catch {
            toast.error("Error al restaurar pago");
          }
        },
      },
      duration: 5000,
    });
    fetch(`/api/payments/${paymentId}`, { method: "DELETE" }).then((res) => {
      if (res.ok) {
onRefresh?.(reservation.id);
        onDeletePayment?.(paymentId);
      }
    });
  };

  const handleRefreshPayments = async () => {
    setIsCheckingAllPayments(true);
    try {
      const res = await fetch(`/api/payments/reservation/${reservation.id}/refresh`);
      const result = await res.json();
      if (result.error) {
        toast.error(result.error);
        return;
      }
      onRefresh?.(reservation.id);
    } catch {
      toast.error("Error al refrescar pagos");
    } finally {
      setIsCheckingAllPayments(false);
    }
  };

  const handleAttachReceiptClick = (paymentId: string) => {
    setAttachReceiptPaymentId(paymentId);
    setAttachReceiptFile(null);
    setShowAttachReceiptModal(true);
  };

  const handleConfirmAttachReceipt = async () => {
    if (!attachReceiptPaymentId || !attachReceiptFile) return;

    setIsAttachingReceipt(true);
    try {
      const uploadFormData = new FormData();
      uploadFormData.append("file", attachReceiptFile);
      uploadFormData.append("folder", "rentalpro/receipts");

      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: uploadFormData,
      });
      const uploadResult = await uploadRes.json();
      if (uploadResult.error) {
        toast.error(uploadResult.error);
        return;
      }

      const result = await attachReceipt(attachReceiptPaymentId, uploadResult.url);
      if (result?.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Comprobante adjuntado");
      setShowAttachReceiptModal(false);
      setAttachReceiptPaymentId(null);
      setAttachReceiptFile(null);
      onRefresh?.(reservation.id);
    } catch {
      toast.error("Error al adjuntar comprobante");
    } finally {
      setIsAttachingReceipt(false);
    }
  };

  const handleGenerateLink = async (amount: number) => {
    if (amount <= 0) return;
    setIsGeneratingLink(true);
    try {
      const res = await fetch("/api/payments/generate-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reservationId: reservation.id,
          amount,
        }),
      });
      const result = await res.json();
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Link generado - Copia el link desde el listado de pagos");
      onRefresh?.(reservation.id);
    } catch {
      toast.error("Error al generar link");
    } finally {
      setIsGeneratingLink(false);
    }
  };



  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-y-auto p-0">
        <div className="space-y-6 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4 pr-8">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="h-12 w-12 shrink-0 rounded-xl flex items-center justify-center text-white font-bold shadow-sm"
                style={{ backgroundColor: reservation.property.color || "#3B82F6" }}
              >
                {reservation.property.name[0]}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <DialogTitle className="text-base leading-tight truncate">{reservation.property.name}</DialogTitle>
                  <Badge variant={status.variant} className="h-5 text-[11px]">{status.label}</Badge>
                  {reservation.bookingAirbnb && <Badge variant="outline" className="h-5 text-[11px]">Airbnb</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">#{reservation.id.slice(0, 8)}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_1.35fr]">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <div className="rounded-xl border border-border/70 bg-muted/20 p-3.5">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  Período
                </div>
                <p className="mt-2 text-sm font-medium text-foreground">
                  {formatDate(reservation.startDate)} - {formatDate(reservation.endDate)}
                </p>
                <p className="text-xs text-muted-foreground">{reservation.billingType === "MONTHLY" ? `${getMonths(reservation.startDate, reservation.endDate)} meses` : `${nights} noches`}</p>
              </div>

              <div className="rounded-xl border border-border/70 bg-muted/20 p-3.5">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <User className="h-3 w-3" />
                  Huésped
                </div>
                <p className="mt-2 font-medium text-sm">{reservation.client.name}</p>
                <p className="text-xs text-muted-foreground truncate">{reservation.client.email}</p>
                {reservation.client.phone && <p className="text-xs text-muted-foreground">{reservation.client.phone}</p>}
              </div>
            </div>

            <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total general</p>
                  <p className="mt-1 text-3xl font-semibold tracking-tight text-emerald-500">{formatPrice(grandTotal)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Arriendo + cobros extra</p>
                </div>
                {totalPending > 0 && (
                  <div className="rounded-lg border border-orange-500/20 bg-orange-500/10 px-3 py-2 text-left sm:text-right">
                    <p className="text-xs text-muted-foreground">Pendiente</p>
                    <p className="text-sm font-semibold text-orange-500">{formatPrice(totalPending)}</p>
                  </div>
                )}
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                <div className="rounded-lg bg-background/40 p-3">
                  <p className="text-xs text-muted-foreground">Arriendo</p>
                  <p className="text-sm font-medium">{formatPrice(reservation.totalPrice)}</p>
                  {reservation.billingType === "MONTHLY" && reservation.property.monthlyPrice && (
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{formatPrice(reservation.property.monthlyPrice)}/mes × {getMonths(reservation.startDate, reservation.endDate)}</p>
                  )}
                  {reservation.billingType === "DAILY" && reservation.property.dailyPrice && (
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{formatPrice(reservation.property.dailyPrice)}/noche × {nights}</p>
                  )}
                  {pendingAmount > 0 && <p className="mt-0.5 text-[11px] text-orange-500">{formatPrice(pendingAmount)} pend.</p>}
                </div>
                <div className="rounded-lg bg-background/40 p-3">
                  <p className="text-xs text-muted-foreground">Extras</p>
                  <p className="text-sm font-medium">{formatPrice(extraTotal)}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{extraPayments.length === 1 ? "1 cobro" : `${extraPayments.length} cobros`}</p>
                </div>
                <div className="rounded-lg bg-background/40 p-3">
                  <p className="text-xs text-muted-foreground">Pagado</p>
                  <p className="text-sm font-medium">{formatPrice(totalPaid)}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">Pendiente {formatPrice(totalPending)}</p>
                </div>
              </div>
            </div>
          </div>

        {reservation.notes && (
          <div className="p-3 rounded-md bg-muted/30 border border-border mb-6">
            <div className="flex items-center gap-2 mb-1">
              <FileText className="h-3 w-3 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Notas</p>
            </div>
            <p className="text-sm">{reservation.notes}</p>
          </div>
        )}

        {reservation.billingType === "MONTHLY" && plan === "PRO" && (
          <ReservationDocumentsPanel reservationId={reservation.id} />
        )}

        {(reservationPayments.length > 0 || reservation.payments.length > 0) && (
          <div className="mb-6 space-y-6">
            {reservationPayments.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium">
                    {reservation.billingType === "MONTHLY" ? "Cuotas de arriendo" : "Pagos de reserva"}
                  </p>
                  {reservation.status !== "CANCELLED" && reservation.status !== "COMPLETED" && (
                    <div className="flex gap-2">
                      {reservation.payments && reservation.payments.length > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={handleRefreshPayments}
                          disabled={isCheckingAllPayments}
                        >
                          <RefreshCw className={cn("h-3 w-3 mr-1", isCheckingAllPayments && "animate-spin")} />
                          {isCheckingAllPayments ? "Verificando..." : "Verificar"}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => setShowAddPaymentDialog(true)}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Agregar Pago
                      </Button>
                    </div>
                  )}
                </div>
                <PaymentsTable
                  payments={reservationPayments}
                  onGenerateLink={handleRegenerateLink}
                  onMarkPaid={handleMarkPaidClick}
                  onDeletePayment={setPaymentToDelete}
                  onAttachReceipt={handleAttachReceiptClick}
                  showInstallmentColumns={reservation.billingType === "MONTHLY"}
                  generatingLinkId={generatingLinkId}
                />
              </div>
            )}

            {extraPayments.length > 0 && (
              <div>
                <div className="mb-3">
                  <p className="text-sm font-medium">Cobros extra</p>
                </div>
                <PaymentsTable
                  payments={extraPayments}
                  onGenerateLink={handleRegenerateLink}
                  onMarkPaid={handleMarkPaidClick}
                  onDeletePayment={setPaymentToDelete}
                  onAttachReceipt={handleAttachReceiptClick}
                  showInstallmentColumns={false}
                  showConceptColumn
                  generatingLinkId={generatingLinkId}
                />
              </div>
            )}
          </div>
        )}

        {reservation.status !== "CANCELLED" && reservation.status !== "COMPLETED" && reservation.payments?.length === 0 && (
          <div className="mb-6">
            <Button
              size="sm"
              variant="outline"
              className="w-full h-8"
              onClick={() => setShowAddPaymentDialog(true)}
            >
              <Plus className="h-3 w-3 mr-1" />
              Agregar Pago
            </Button>
          </div>
        )}



        <div className="flex flex-col sm:flex-row gap-2 pt-4 border-t border-border mt-6">
          <Button variant="outline" size="sm" className="flex-1 h-8" onClick={onEdit}>Editar Reserva</Button>
          {reservation.status !== "CANCELLED" && reservation.status !== "COMPLETED" && (
            <Button variant="destructive" size="sm" className="h-8" onClick={onCancel}>Cancelar</Button>
          )}
        </div>

        <Dialog open={showMarkPaidModal} onOpenChange={setShowMarkPaidModal}>
          <DialogContent className="w-[95vw] max-w-sm">
            <DialogHeader>
              <DialogTitle>Marcar Pago como Pagado</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label className="text-xs">Fecha de Pago</Label>
                <Input
                  type="date"
                  value={markPaidDate}
                  onChange={(e) => setMarkPaidDate(e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Método de Pago</Label>
                <Select value={markPaidMethod} onValueChange={(v) => setMarkPaidMethod(v as typeof markPaidMethod)}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CASH">Efectivo</SelectItem>
                    <SelectItem value="TRANSFER">Transferencia</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Comprobante (opcional)</Label>
                <ReceiptUpload onFileSelect={setReceiptFile} />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="ghost" onClick={() => setShowMarkPaidModal(false)} disabled={isUploading}>Cancelar</Button>
              <Button size="sm" onClick={handleConfirmMarkPaid} disabled={isUploading}>{isUploading ? "Subiendo..." : "Confirmar"}</Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showAttachReceiptModal} onOpenChange={setShowAttachReceiptModal}>
          <DialogContent className="w-[95vw] max-w-sm">
            <DialogHeader>
              <DialogTitle>Adjuntar Comprobante</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <ReceiptUpload onFileSelect={setAttachReceiptFile} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="ghost" onClick={() => setShowAttachReceiptModal(false)}>Cancelar</Button>
              <Button size="sm" onClick={handleConfirmAttachReceipt} disabled={!attachReceiptFile || isAttachingReceipt}>
                {isAttachingReceipt ? "Subiendo..." : "Subir"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <AddPaymentDialog
          reservationId={reservation.id}
          totalPrice={reservation.totalPrice}
          paidAmount={paidAmount}
          open={showAddPaymentDialog}
          onOpenChange={setShowAddPaymentDialog}
          onSuccess={() => onRefresh?.(reservation.id)}
        />
        <ConfirmDialog
          open={!!paymentToDelete}
          onOpenChange={(open) => {
            if (!open) setPaymentToDelete(null);
          }}
          title="Eliminar pago"
          description="El pago pendiente se eliminará del registro. Podrás deshacerlo desde la notificación inmediatamente después."
          confirmLabel="Eliminar pago"
          onConfirm={() => {
            if (!paymentToDelete) return;
            handleDeletePayment(paymentToDelete);
            setPaymentToDelete(null);
          }}
        />
        </div>
      </DialogContent>
    </Dialog>
  );
}
