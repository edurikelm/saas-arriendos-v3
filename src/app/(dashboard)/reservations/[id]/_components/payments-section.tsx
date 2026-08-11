"use client";

import { useState } from "react";
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

export function PaymentsSection({
  reservationId,
  totalPrice,
  billingType,
  status,
  payments,
  client,
  propertyName,
}: PaymentsSectionProps) {
  const reservationPayments = payments.filter((p) => p.paymentType !== "EXTRA");
  const extraPayments = payments.filter((p) => p.paymentType === "EXTRA");
  const paidAmount = getReservationPaidAmount(payments);
  const pendingAmount = getReservationPendingAmount(payments, Number(totalPrice));
  const extraTotal = extraPayments.reduce((sum, p) => sum + Number(p.amount), 0);
  const extraPaidAmount = extraPayments.filter((p) => p.status === "COMPLETED").reduce((sum, p) => sum + Number(p.amount), 0);
  const extraPendingAmount = Math.max(extraTotal - extraPaidAmount, 0);
  const totalPaid = paidAmount + extraPaidAmount;
  const totalPending = pendingAmount + extraPendingAmount;

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
  const [showAttachReceiptModal, setShowAttachReceiptModal] = useState(false);
  const [attachReceiptPaymentId, setAttachReceiptPaymentId] = useState<string | null>(null);
  const [attachReceiptFile, setAttachReceiptFile] = useState<File | null>(null);
  const [isAttachingReceipt, setIsAttachingReceipt] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState<string | null>(null);
  const [sendLinkPayment, setSendLinkPayment] = useState<Payment | null>(null);

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
            }
          } catch {
            toast.error("Error al restaurar pago");
          }
        },
      },
      duration: 5000,
    });
    fetch(`/api/payments/${paymentId}`, { method: "DELETE" });
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
    } catch {
      toast.error("Error al adjuntar comprobante");
    } finally {
      setIsAttachingReceipt(false);
    }
  };

  const isActive = status !== "CANCELLED" && status !== "COMPLETED";

  return (
    <div className="space-y-6">
      {/* KPIs (KpiCard primitive — DESIGN.md §7) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
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
      </div>

      {/* Tables */}
      {(reservationPayments.length > 0 || payments.length > 0) && (
        <div className="space-y-6">
          {reservationPayments.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium">
                  {billingType === "MONTHLY" ? "Cuotas de arriendo" : "Pagos de reserva"}
                </p>
                {isActive && (
                  <div className="flex gap-2">
                    {payments.length > 0 && (
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
                onGenerateLink={handleGenerateLink}
                onRegenerateLink={handleRegenerateLink}
                onMarkPaid={handleMarkPaidClick}
                onDeletePayment={setPaymentToDelete}
                onAttachReceipt={handleAttachReceiptClick}
                onSendLink={setSendLinkPayment}
                variant="reservation"
                generatingLinkId={generatingLinkId}
                regeneratingLinkId={regeneratingLinkId}
                compact
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
                onGenerateLink={handleGenerateLink}
                onRegenerateLink={handleRegenerateLink}
                onMarkPaid={handleMarkPaidClick}
                onDeletePayment={setPaymentToDelete}
                onAttachReceipt={handleAttachReceiptClick}
                onSendLink={setSendLinkPayment}
                variant="extra"
                generatingLinkId={generatingLinkId}
                regeneratingLinkId={regeneratingLinkId}
                compact
              />
            </div>
          )}
        </div>
      )}

      {isActive && payments.length === 0 && (
        <Button
          size="sm"
          className="h-8 text-[10px] font-bold uppercase tracking-wider"
          onClick={() => setShowAddPaymentDialog(true)}
        >
          <Plus className="h-3 w-3 mr-1" />
          Agregar Pago
        </Button>
      )}

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

      {/* Attach Receipt Modal */}
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

      {/* Add Payment Dialog */}
      <AddPaymentDialog
        reservationId={reservationId}
        totalPrice={totalPrice}
        paidAmount={paidAmount}
        open={showAddPaymentDialog}
        onOpenChange={setShowAddPaymentDialog}
        onSuccess={() => {}}
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
