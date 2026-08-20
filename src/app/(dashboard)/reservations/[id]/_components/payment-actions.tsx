"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "sonner";
import { attachReceipt } from "@/lib/actions/payments";
import { AddPaymentDialog } from "@/components/reservations/add-payment-dialog";
import { SendPaymentLinkDialog } from "@/components/reservations/send-payment-link-dialog";
import { MarkPaidDialog } from "@/components/dashboard/mark-paid-dialog";
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
  const [markPaidId, setMarkPaidId] = useState<string | null>(null);
  const [showAddPaymentDialog, setShowAddPaymentDialog] = useState(false);
  const [isCheckingAllPayments, setIsCheckingAllPayments] = useState(false);
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
    handleMarkPaidClick: setMarkPaidId,
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
    // Modal renderers
    AddPaymentModal,
    DeleteConfirmModal,
    SendLinkModal,
    // Mark paid wiring (consumed by the canonical MarkPaidDialog from the parent)
    markPaidId,
    setMarkPaidId,
  };
}

/**
 * Wrapper sobre `MarkPaidDialog` (canónico de `@/components/dashboard/mark-paid-dialog`)
 * que mantiene el mismo nombre de import que tenía el modal local.
 *
 * Importante: este componente está definido a nivel de módulo (NO dentro del
 * hook) para preservar la identidad del componente entre renders del padre.
 * Si el modal se definiera dentro de `usePaymentActions`, React trataría cada
 * re-render del hook como un componente diferente, desmontando/remontando el
 * `<Dialog>` — lo que borra el archivo seleccionado del `<input type="file">`
 * y nunca muestra la preview. Regresión detectada: la imagen se subía a
 * Cloudinary correctamente pero la preview nunca aparecía.
 *
 * Para reproducir el bug original bastaba con:
 *   1. Renderizar el modal desde el padre
 *   2. Seleccionar un archivo válido
 *   3. Observar: el `img[alt="Preview"]` no aparecía y el file input quedaba vacío
 */
export function MarkPaidModal({
  paymentId,
  open,
  onOpenChange,
  onSuccess,
  contextLabel,
}: {
  paymentId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  contextLabel?: string;
}) {
  return (
    <MarkPaidDialog
      paymentId={paymentId}
      open={open}
      onOpenChange={onOpenChange}
      onSuccess={onSuccess}
      contextLabel={contextLabel}
    />
  );
}
