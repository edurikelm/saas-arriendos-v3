"use client";

import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  CalendarDays,
  Mail,
  Phone,
  Home,
  Check,
  RefreshCw,
  FileText,
  ExternalLink,
  Copy,
  Plus,
  Loader2,
  MoreHorizontal,
  X as XIcon,
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
  DialogDescription,
  DialogFooter,
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
import { markPaymentAsPaid, attachReceipt } from "@/lib/actions/payments";
import { AddPaymentDialog } from "./add-payment-dialog";
import { SendPaymentLinkDialog } from "./send-payment-link-dialog";
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

function formatDueDate(dateString: string): string {
  return format(new Date(dateString), "d MMM yyyy", { locale: es });
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
  onSendLink,
  showInstallmentColumns,
  showConceptColumn = false,
  generatingLinkId,
}: {
  payments: Payment[];
  onGenerateLink?: (paymentId: string) => void;
  onMarkPaid?: (paymentId: string) => void;
onDeletePayment?: (paymentId: string) => void;
  onAttachReceipt?: (paymentId: string) => void;
  onSendLink?: (payment: Payment) => void;
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
            const canSendLink = isPending && isMercadoPago && payment.initPoint && onSendLink;
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
              canSendLink ? "sendLink" : null,
            ].filter(Boolean) as Array<"markPaid" | "delete" | "viewReceipt" | "attachReceipt" | "sendLink">;

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

              if (action === "sendLink") {
                return <DropdownMenuItem onClick={() => onSendLink?.(payment)}>Enviar link</DropdownMenuItem>;
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
                  <Badge variant={statusCfg.variant} className="h-5 text-[11px] font-medium">{statusCfg.label}</Badge>
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
  plan = "FREE",
}: ReservationDetailProps) {
  void onCopyLink;
  void onConfirmPayment;
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
  const [sendLinkPayment, setSendLinkPayment] = useState<Payment | null>(null);

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

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <DialogContent className="w-[95vw] max-w-2xl gap-0 p-0 overflow-hidden" showCloseButton={false}>
        <DialogHeader className="border-b border-border px-5 py-4 flex-row items-center justify-between gap-2 space-y-0">
          <div className="space-y-1">
            <DialogTitle>Detalles de la Reserva</DialogTitle>
            <DialogDescription>
              Información de la estadía, pagos y datos de contacto.
            </DialogDescription>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            aria-label="Cerrar"
            className="text-muted-foreground hover:text-foreground -mr-2"
          >
            <XIcon />
          </Button>
        </DialogHeader>

        <div className="space-y-6 p-5 sm:p-6 overflow-y-auto max-h-[calc(90vh-132px)]">
          {/* Guest & Status Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-14 w-14 shrink-0 rounded-full bg-primary/10 ring-1 ring-foreground/10 flex items-center justify-center text-primary text-xl font-bold">
                {reservation.client.name
                  .split(" ")
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((part) => part[0])
                  .join("")
                  .toUpperCase()}
              </div>
              <div className="min-w-0">
                <h3 className="text-lg font-bold text-foreground leading-tight truncate">
                  {reservation.client.name}
                </h3>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-foreground">
                  <a
                    href={`mailto:${reservation.client.email}`}
                    className="inline-flex items-center gap-1.5 hover:text-primary transition-colors"
                  >
                    <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="truncate max-w-[180px]">{reservation.client.email}</span>
                  </a>
                  {reservation.client.phone && (
                    <a
                      href={`tel:${reservation.client.phone}`}
                      className="inline-flex items-center gap-1.5 hover:text-primary transition-colors"
                    >
                      <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>{reservation.client.phone}</span>
                    </a>
                  )}
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <Badge variant={status.variant} className="h-5 text-[10px] font-bold uppercase tracking-wider">
                <span className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${
                  status.variant === "default" ? "bg-success" :
                  status.variant === "destructive" ? "bg-destructive" :
                  "bg-muted-foreground"
                }`} />
                {status.label}
              </Badge>
              {reservation.bookingAirbnb && (
                <Badge variant="outline" className="h-5 text-[10px] font-bold uppercase tracking-wider">
                  Airbnb
                </Badge>
              )}
            </div>
          </div>

          {/* Property + Stay + Payment Summary grid */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {/* Left: Property + Stay */}
            <div className="space-y-5">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  Propiedad
                </p>
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 shrink-0 rounded-lg bg-muted ring-1 ring-foreground/10 flex items-center justify-center text-muted-foreground">
                    <Home className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-bold text-foreground truncate min-w-0">
                    {reservation.property.name}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  Estancia
                </p>
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 shrink-0 rounded-lg bg-muted ring-1 ring-foreground/10 flex items-center justify-center text-muted-foreground">
                    <CalendarDays className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-foreground">
                      {formatDate(reservation.startDate)} - {formatDate(reservation.endDate)}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {reservation.billingType === "MONTHLY" ? `${getMonths(reservation.startDate, reservation.endDate)} meses` : `${nights} noches`}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Payment Summary Card */}
            <div className="rounded-lg border border-border overflow-hidden ring-1 ring-foreground/10">
              <div className="px-4 py-3 border-b border-border bg-muted/50">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Resumen de Pago
                </p>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">Total de estadía</span>
                  <span className="font-medium text-foreground tabular-nums">{formatPrice(reservation.totalPrice)}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">Servicios extra</span>
                  <span className="font-medium text-foreground tabular-nums">{formatPrice(extraTotal)}</span>
                </div>
                <div className="pt-2 border-t border-border/50 flex justify-between items-center text-xs">
                  <span className="font-semibold text-foreground">Monto pagado</span>
                  <span className="font-bold text-success tabular-nums">{formatPrice(totalPaid)}</span>
                </div>
                {totalPending > 0 ? (
                  <div className="flex justify-between items-center text-xs p-2 rounded bg-warning/10 ring-1 ring-warning/20">
                    <span className="font-semibold text-warning-foreground">Saldo pendiente</span>
                    <span className="font-bold text-warning tabular-nums">{formatPrice(totalPending)}</span>
                  </div>
                ) : (
                  <div className="flex justify-between items-center text-xs p-2 rounded bg-success/10 ring-1 ring-success/20">
                    <span className="font-semibold text-success">Saldado</span>
                    <span className="font-bold text-success tabular-nums">$0</span>
                  </div>
                )}
              </div>
            </div>
          </div>

        {reservation.notes && (
          <div className="p-3 rounded-md bg-muted/30 border border-border">
            <div className="flex items-center gap-2 mb-1">
              <FileText className="h-3 w-3 text-muted-foreground" />
              <p className="text-xs font-medium text-muted-foreground">Notas</p>
            </div>
            <p className="text-sm text-foreground whitespace-pre-wrap">{reservation.notes}</p>
          </div>
        )}

        {reservation.billingType === "MONTHLY" && plan === "PRO" && (
          <ReservationDocumentsPanel reservationId={reservation.id} />
        )}

        {(reservationPayments.length > 0 || reservation.payments.length > 0) && (
          <div className="space-y-6">
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
                          className="h-7 text-[10px] font-bold uppercase tracking-wider border-primary text-primary hover:bg-primary/10"
                          onClick={handleRefreshPayments}
                          disabled={isCheckingAllPayments}
                        >
                          <RefreshCw className={cn("h-3 w-3 mr-1", isCheckingAllPayments && "animate-spin")} />
                          {isCheckingAllPayments ? "Verificando..." : "Verificar"}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        className="h-7 text-[10px] font-bold uppercase tracking-wider"
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
                  onSendLink={setSendLinkPayment}
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
                  onSendLink={setSendLinkPayment}
                  showInstallmentColumns={false}
                  showConceptColumn
                  generatingLinkId={generatingLinkId}
                />
              </div>
            )}
          </div>
        )}

        {reservation.status !== "CANCELLED" && reservation.status !== "COMPLETED" && reservation.payments?.length === 0 && (
          <Button
            size="sm"
            className="w-full h-8 text-[10px] font-bold uppercase tracking-wider"
            onClick={() => setShowAddPaymentDialog(true)}
          >
            <Plus className="h-3 w-3 mr-1" />
            Agregar Pago
          </Button>
        )}
        </div>

        <DialogFooter className="-mx-0 -mb-0 gap-0 border-t border-border bg-muted/30 px-5 py-3 sm:flex-row sm:justify-end sm:gap-2">
          <Button variant="outline" size="sm" className="h-8" onClick={onEdit}>
            Editar Reserva
          </Button>
          {reservation.status !== "CANCELLED" && reservation.status !== "COMPLETED" && (
            <Button variant="destructive" size="sm" className="h-8" onClick={onCancel}>
              Cancelar
            </Button>
          )}
        </DialogFooter>

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

        <SendPaymentLinkDialog
          open={!!sendLinkPayment}
          onOpenChange={(open: boolean) => {
            if (!open) setSendLinkPayment(null);
          }}
          payment={sendLinkPayment!}
          client={reservation.client}
          propertyName={reservation.property.name}
          billingType={reservation.billingType}
        />
      </DialogContent>
    </Dialog>
  );
}
