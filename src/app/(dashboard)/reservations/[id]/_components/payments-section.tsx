"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Plus, RefreshCw, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KpiCard } from "@/components/ui/kpi-card";
import { Label } from "@/components/ui/label";
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
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { markPaymentAsPaid, attachReceipt } from "@/lib/actions/payments";
import { AddPaymentDialog } from "@/components/reservations/add-payment-dialog";
import { SendPaymentLinkDialog } from "@/components/reservations/send-payment-link-dialog";
import { ReceiptUpload } from "@/components/ui/receipt-upload";
import { PaymentsTable } from "@/components/payments/payments-table";
import { getReservationPaidAmount, getReservationPendingAmount } from "@/lib/payments/calculations";
import { isOverdueInBusinessTz, nowKeyInBusinessTz } from "@/lib/domain/timezone";
import { format } from "date-fns";

interface Payment {
  id: string;
  installmentIndex?: number | null;
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
  overdueDays?: number | null;
  installmentLabel?: string | null;
}

interface PaymentsSectionProps {
  reservationId: string;
  totalPrice: string;
  billingType: string;
  status: string;
  payments: Payment[];
  client: { name: string; email: string };
  propertyName: string;
}

function formatPrice(price: string | number): string {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(price));
}

/** Pagos pendientes (RESERVATION, no EXTRA) cuya fecha de vencimiento ya pasó.
 *  Usa `isOverdueInBusinessTz` (ADR-0020) para evitar sensibilidad a la zona
 *  del servidor (Vercel corre en UTC, negocio opera en America/Santiago). */
function getOverdueAmount(payments: Payment[]): number {
  const nowKey = nowKeyInBusinessTz();
  return payments
    .filter(
      (p) =>
        p.status === "PENDING" &&
        !p.deletedAt &&
        (p.paymentType ?? "RESERVATION") !== "EXTRA" &&
        isOverdueInBusinessTz(p.dueDate, nowKey),
    )
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);
}

export function PaymentsSection({
  reservationId,
  totalPrice,
  billingType,
  status,
  payments,
  client,
  propertyName,
}: PaymentsSectionProps) {
  type FilterStatus = "all" | "pending" | "paid";
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");

  const FILTER_OPTIONS: Array<{ value: FilterStatus; label: string }> = [
    { value: "all", label: "Todos" },
    { value: "pending", label: "Pendientes" },
    { value: "paid", label: "Pagados" },
  ];

  function applyStatusFilter<T extends { status: string }>(payments: T[], filter: FilterStatus): T[] {
    if (filter === "all") return payments;
    if (filter === "pending") return payments.filter((p) => p.status === "PENDING" || p.status === "FAILED");
    if (filter === "paid") return payments.filter((p) => p.status === "COMPLETED");
    return payments;
  }

  const reservationPayments = applyStatusFilter(payments.filter((p) => p.paymentType !== "EXTRA"), statusFilter);
  const extraPayments = applyStatusFilter(payments.filter((p) => p.paymentType === "EXTRA"), statusFilter);
  const paidAmount = getReservationPaidAmount(payments);
  const pendingAmount = getReservationPendingAmount(payments, Number(totalPrice));
  const extraTotal = extraPayments.reduce((sum, p) => sum + Number(p.amount), 0);
  const extraPaidAmount = extraPayments.filter((p) => p.status === "COMPLETED").reduce((sum, p) => sum + Number(p.amount), 0);
  const extraPendingAmount = Math.max(extraTotal - extraPaidAmount, 0);
  const totalPaid = paidAmount + extraPaidAmount;
  const totalPending = pendingAmount + extraPendingAmount;
  const overdueAmount = getOverdueAmount(payments);

  const [generatingLinkId, setGeneratingLinkId] = useState<string | null>(null);
  const [regeneratingLinkId, setRegeneratingLinkId] = useState<string | null>(null);
  const [showMarkPaidModal, setShowMarkPaidModal] = useState(false);
  const [markPaidPaymentId, setMarkPaidPaymentId] = useState<string | null>(null);
  const [markPaidDate, setMarkPaidDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [markPaidMethod, setMarkPaidMethod] = useState<"CASH" | "TRANSFER">("CASH");
  const [showAddPaymentDialog, setShowAddPaymentDialog] = useState(false);
  const [isCheckingAllPayments, setIsCheckingAllPayments] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState<string | null>(null);
  const [sendLinkPayment, setSendLinkPayment] = useState<Payment | null>(null);

  const router = useRouter();
  // Patrón canónico del repo (CONTEXT.md: page.tsx es `force-dynamic`, no usamos
  // cache). Cada mutación exitosa contra `payments` re-ejecuta el Server Component
  // padre para refrescar `payments`/KPIs sin recarga dura de la página.
  // Equivalente al patrón de /payments/_components/payment-actions.tsx.
  const refreshData = useCallback(() => router.refresh(), [router]);

  const handlePaymentLinkRequest = async (paymentId: string, mode: "generate" | "regenerate") => {
    if (mode === "generate") {
      setGeneratingLinkId(paymentId);
    } else {
      setRegeneratingLinkId(paymentId);
    }

    try {
      const res = await fetch(`/api/payments/${paymentId}`, {
        method: "POST",
      });
      const result = await res.json();
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(mode === "generate" ? "Link generado" : "Link regenerado");
      refreshData();
    } catch {
      toast.error(mode === "generate" ? "Error al generar link" : "Error al regenerar link");
    } finally {
      if (mode === "generate") {
        setGeneratingLinkId(null);
      } else {
        setRegeneratingLinkId(null);
      }
    }
  };

  const handleGenerateLink = (paymentId: string) => handlePaymentLinkRequest(paymentId, "generate");
  const handleRegenerateLink = (paymentId: string) => handlePaymentLinkRequest(paymentId, "regenerate");

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
    refreshData();
  };

  const handleDeletePayment = async (paymentId: string) => {
    try {
      const res = await fetch(`/api/payments/${paymentId}`, { method: "DELETE" });
      const result = await res.json().catch(() => ({}));
      if (!res.ok || result?.error) {
        toast.error(result?.error ?? "Error al eliminar pago");
        return;
      }
      toast.success("Pago eliminado", {
        action: {
          label: "Deshacer",
          onClick: async () => {
            try {
              const restoreRes = await fetch(`/api/payments/${paymentId}`, {
                method: "PUT",
              });
              if (restoreRes.ok) {
                toast.success("Pago restaurado");
                refreshData();
              }
            } catch {
              toast.error("Error al restaurar pago");
            }
          },
        },
        duration: 5000,
      });
      refreshData();
    } catch {
      toast.error("Error al eliminar pago");
    }
  };

  const handleRefreshPayments = async () => {
    setIsCheckingAllPayments(true);
    try {
      const res = await fetch(`/api/payments/reservation/${reservationId}/refresh`);
      const result = await res.json();
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Pagos actualizados");
      refreshData();
    } catch {
      toast.error("Error al refrescar pagos");
    } finally {
      setIsCheckingAllPayments(false);
    }
  };

  const handleUploadReceipt = async (
    paymentId: string,
    file: File,
  ): Promise<{ error?: string }> => {
    // 1. Subir a /api/upload
    const uploadFormData = new FormData();
    uploadFormData.append("file", file);
    uploadFormData.append("folder", "rentalpro/receipts");

    let url: string;
    try {
      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: uploadFormData,
      });
      const uploadResult = await uploadRes.json();
      if (uploadResult.error) {
        return { error: uploadResult.error };
      }
      url = uploadResult.url;
    } catch {
      return { error: "Error al subir comprobante" };
    }

    // 2. Adjuntar a payment
    const result = await attachReceipt(paymentId, url);
    if (result?.error) {
      return { error: result.error };
    }

    // 3. Refrescar datos (el Popover cierra y muestra toast al retornar)
    refreshData();
    return {};
  };

  const isActive = status !== "CANCELLED" && status !== "COMPLETED";
  // "Agregar Pago" visible siempre que la reserva sea activa (incluso sin pagos).
  // "Verificar" solo cuando hay pagos (no hay nada que verificar con 0 pagos).
  const showHeaderActions = isActive;
  const showHeaderVerify = isActive && payments.length > 0;

  return (
    <div className="space-y-6">
      {/* KPIs (KpiCard primitive — DESIGN.md §7).
            Mobile: 2×2 grid para no usar filas de 4 cards muy estrechas. */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard
          label="Total"
          value={formatPrice(Number(totalPrice) + extraTotal)}
          icon={Wallet}
          tone="default"
        />
        <KpiCard
          label="Pagado"
          value={formatPrice(totalPaid)}
          icon={CheckCircle2}
          tone="success"
        />
        <KpiCard
          label="Pendiente"
          value={formatPrice(totalPending)}
          icon={AlertCircle}
          tone={totalPending > 0 ? "warning" : "success"}
        />
        <KpiCard
          label="Vencido"
          value={formatPrice(overdueAmount)}
          icon={AlertCircle}
          tone={overdueAmount > 0 ? "destructive" : "default"}
        />
      </div>

      {/* Tables */}
      <div className="space-y-6">
        {/* Always render reservation payments section - emptyState handles empty array */}
        <div>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            {/* Lado izquierdo: título + pills como una unidad semántica
                (título = nombre de la tabla; pills = filtros de la tabla) */}
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm font-bold text-foreground">
                {billingType === "MONTHLY" ? "Cuotas de arriendo" : "Pagos de reserva"}
              </p>

              <div className="flex items-center gap-1 rounded-full border border-border bg-muted p-1">
                {FILTER_OPTIONS.map((opt) => {
                  const isActive = statusFilter === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setStatusFilter(opt.value)}
                      aria-pressed={isActive}
                      className={cn(
                        "rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors",
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Lado derecho: acciones agrupadas */}
            {showHeaderActions && (
              <div className="flex items-center gap-2">
                {showHeaderVerify && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleRefreshPayments}
                    disabled={isCheckingAllPayments}
                  >
                    <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", isCheckingAllPayments && "animate-spin")} />
                    {isCheckingAllPayments ? "Verificando..." : "Verificar"}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => setShowAddPaymentDialog(true)}
                >
                  <Plus className="h-4 w-4 mr-1.5" />
                  Agregar Pago
                </Button>
              </div>
            )}
          </div>
          <PaymentsTable
            payments={reservationPayments}
            onGenerateLink={handleGenerateLink}
            onRegenerateLink={handleRegenerateLink}
            onMarkPaid={handleMarkPaidClick}
            onDeletePayment={setPaymentToDelete}
            onUploadReceipt={handleUploadReceipt}
            onSendLink={setSendLinkPayment}
            variant="reservation"
            generatingLinkId={generatingLinkId}
            regeneratingLinkId={regeneratingLinkId}
            compact
            emptyState={
              isActive ? (
                <div className="flex flex-col items-center gap-3 py-8">
                  <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Wallet className="size-6 text-primary" aria-hidden="true" />
                  </div>
                  <div className="space-y-1 text-center">
                    <p className="text-sm font-medium text-foreground">Aún no hay pagos registrados</p>
                    <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                      Registra el primer pago de arriendo para esta reserva. Podrás elegir entre Mercado Pago, efectivo o transferencia.
                    </p>
                  </div>
                  <Button onClick={() => setShowAddPaymentDialog(true)} size="sm" className="mt-1">
                    <Plus className="h-4 w-4 mr-2" />
                    Agregar Pago
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-2">
                  Esta reserva no tiene pagos registrados.
                </p>
              )
            }
          />
        </div>

        {extraPayments.length > 0 && (
          <div>
            <div className="mb-3">
              <p className="text-sm font-medium">Cobros extra</p>
            </div>
            <PaymentsTable
              payments={extraPayments}
              onGenerateLink={handleGenerateLink}
              onRegenerateLink={handleRegenerateLink}
              onMarkPaid={handleMarkPaidClick}
              onDeletePayment={setPaymentToDelete}
              onUploadReceipt={handleUploadReceipt}
              onSendLink={setSendLinkPayment}
              variant="extra"
              generatingLinkId={generatingLinkId}
              regeneratingLinkId={regeneratingLinkId}
              compact
            />
          </div>
        )}
      </div>

      {/* Mark Paid Modal */}
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

      {/* Add Payment Dialog */}
      <AddPaymentDialog
        reservationId={reservationId}
        totalPrice={totalPrice}
        paidAmount={paidAmount}
        open={showAddPaymentDialog}
        onOpenChange={setShowAddPaymentDialog}
        onSuccess={refreshData}
      />

      {/* Confirm Delete */}
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

      {/* Send Payment Link */}
      <SendPaymentLinkDialog
        open={!!sendLinkPayment}
        onOpenChange={(open: boolean) => {
          if (!open) setSendLinkPayment(null);
        }}
        payment={sendLinkPayment!}
        client={client}
        propertyName={propertyName}
        billingType={billingType}
      />
    </div>
  );
}
