"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { toast } from "sonner";
import { markPaymentAsPaid, attachReceipt } from "@/lib/actions/payments";
import { AddPaymentDialog } from "@/components/reservations/add-payment-dialog";
import { SendPaymentLinkDialog } from "@/components/reservations/send-payment-link-dialog";
import { ReceiptUpload } from "@/components/ui/receipt-upload";
import type { Payment } from "@/components/payments/payments-table";

export interface PaymentActionsProps {
  reservationId: string;
  totalPrice: string;
  paidAmount: number;
  client: { name: string; email: string };
  propertyName: string;
  billingType: string;
  isActive: boolean;
}

export function usePaymentActions({
  reservationId,
  totalPrice,
  paidAmount,
  client,
  propertyName,
  billingType,
  isActive,
}: PaymentActionsProps) {
  const router = useRouter();
  const refreshData = useCallback(() => router.refresh(), [router]);

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

  // ── Link generation ──────────────────────────────────────────────────────────

  const handlePaymentLinkRequest = async (paymentId: string, mode: "generate" | "regenerate") => {
    if (mode === "generate") {
      setGeneratingLinkId(paymentId);
    } else {
      setRegeneratingLinkId(paymentId);
    }

    try {
      const res = await fetch(`/api/payments/${paymentId}`, { method: "POST" });
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

  // ── Mark paid ──────────────────────────────────────────────────────────────

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
        const uploadRes = await fetch("/api/upload", { method: "POST", body: uploadFormData });
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

  // ── Delete ─────────────────────────────────────────────────────────────────

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
              const restoreRes = await fetch(`/api/payments/${paymentId}`, { method: "PUT" });
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

  // ── Refresh / verify ───────────────────────────────────────────────────────

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

  // ── Upload receipt ─────────────────────────────────────────────────────────

  const handleUploadReceipt = async (
    paymentId: string,
    file: File,
  ): Promise<{ error?: string }> => {
    const uploadFormData = new FormData();
    uploadFormData.append("file", file);
    uploadFormData.append("folder", "rentalpro/receipts");

    let url: string;
    try {
      const uploadRes = await fetch("/api/upload", { method: "POST", body: uploadFormData });
      const uploadResult = await uploadRes.json();
      if (uploadResult.error) return { error: uploadResult.error };
      url = uploadResult.url;
    } catch {
      return { error: "Error al subir comprobante" };
    }

    const result = await attachReceipt(paymentId, url);
    if (result?.error) return { error: result.error };

    refreshData();
    return {};
  };

  // ── Modals ─────────────────────────────────────────────────────────────────

  const MarkPaidModal = () => (
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
  );

  const AddPaymentModal = () => (
    <AddPaymentDialog
      reservationId={reservationId}
      totalPrice={totalPrice}
      paidAmount={paidAmount}
      open={showAddPaymentDialog}
      onOpenChange={setShowAddPaymentDialog}
      onSuccess={refreshData}
    />
  );

  const DeleteConfirmModal = () => (
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
  );

  const SendLinkModal = () => (
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
  );

  return {
    // State
    generatingLinkId,
    regeneratingLinkId,
    isCheckingAllPayments,
    // Handlers
    handleGenerateLink,
    handleRegenerateLink,
    handleMarkPaidClick,
    handleDeletePayment: setPaymentToDelete,
    handleUploadReceipt,
    handleRefreshPayments,
    handleSendLink: setSendLinkPayment,
    // Modal open state
    showAddPaymentDialog,
    setShowAddPaymentDialog,
    // Derived
    isActive,
    showHeaderActions: isActive,
    // Modals
    MarkPaidModal,
    AddPaymentModal,
    DeleteConfirmModal,
    SendLinkModal,
  };
}
