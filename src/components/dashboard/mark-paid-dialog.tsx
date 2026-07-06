"use client";

import { useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { ReceiptUpload } from "@/components/ui/receipt-upload";
import { markPaymentAsPaid } from "@/lib/actions/payments";

type PaidMethod = "CASH" | "TRANSFER";

interface MarkPaidDialogProps {
  paymentId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  /**
   * Etiqueta del cliente y propiedad, para mostrar en el header del dialog.
   * Sirve de contexto cuando se abre desde el dashboard (sin ver la reserva).
   */
  contextLabel?: string;
}

/**
 * Diálogo para marcar un Pago como pagado.
 * - Default `paidAt` = hoy.
 * - Método seleccionable (CASH / TRANSFER).
 * - Comprobante opcional (subido a `/api/upload` y luego `receiptUrl`).
 *
 * Replica la lógica de `reservation-detail-dialog.tsx` para no divergir.
 */
export function MarkPaidDialog({
  paymentId,
  open,
  onOpenChange,
  onSuccess,
  contextLabel,
}: MarkPaidDialogProps) {
  const [date, setDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [method, setMethod] = useState<PaidMethod>("CASH");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  function resetState() {
    setReceiptFile(null);
    setIsUploading(false);
  }

  async function handleConfirm() {
    if (!paymentId) return;

    let receiptUrl: string | undefined;

    if (receiptFile) {
      setIsUploading(true);
      try {
        const uploadFormData = new FormData();
        uploadFormData.append("file", receiptFile);
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
        receiptUrl = uploadResult.url;
      } catch {
        toast.error("Error al subir comprobante");
        return;
      } finally {
        setIsUploading(false);
      }
    }

    const result = await markPaymentAsPaid(
      paymentId,
      new Date(date),
      method,
      receiptUrl
    );

    if (result?.error) {
      toast.error(result.error);
      return;
    }

    toast.success("Pago marcado como pagado");
    resetState();
    onSuccess?.();
    onOpenChange(false);
  }

  function handleOpenChange(next: boolean) {
    if (!next) resetState();
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[95vw] max-w-sm">
        <DialogHeader>
          <DialogTitle>Marcar como pagado</DialogTitle>
          {contextLabel ? (
            <DialogDescription>{contextLabel}</DialogDescription>
          ) : null}
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="mark-paid-date" className="text-xs">
              Fecha de pago
            </Label>
            <Input
              id="mark-paid-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-9"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="mark-paid-method" className="text-xs">
              Método de pago
            </Label>
            <Select value={method} onValueChange={(v) => setMethod(v as PaidMethod)}>
              <SelectTrigger id="mark-paid-method" className="h-9 w-full">
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

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="ghost"
            size="sm"
            disabled={isUploading}
            onClick={() => handleOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button size="sm" onClick={handleConfirm} disabled={isUploading}>
            {isUploading ? "Subiendo..." : "Confirmar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
