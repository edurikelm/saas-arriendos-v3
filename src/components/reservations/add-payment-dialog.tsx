"use client";

import { useState } from "react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, CreditCard, Loader2 } from "lucide-react";
import { ReceiptUpload } from "@/components/ui/receipt-upload";

interface AddPaymentDialogProps {
  reservationId: string;
  totalPrice: string;
  paidAmount: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

type PaymentMethod = "MERCADO_PAGO" | "CASH" | "TRANSFER";

function formatAmount(amount: number): string {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function AddPaymentDialog({
  reservationId,
  totalPrice,
  paidAmount,
  open,
  onOpenChange,
  onSuccess,
}: AddPaymentDialogProps) {
  const [method, setMethod] = useState<PaymentMethod>("MERCADO_PAGO");
  const [amount, setAmount] = useState("");
  const [paidAt, setPaidAt] = useState(format(new Date(), "yyyy-MM-dd"));
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const pendingAmount = Number(totalPrice) - paidAmount;
  const maxAmount = pendingAmount;

  const handleSubmit = async () => {
    const numAmount = Number(amount);

    if (!numAmount || numAmount <= 0) {
      toast.error("Ingresa un monto válido");
      return;
    }

    if (numAmount > maxAmount) {
      toast.error(`El monto no puede exceder el pendiente: ${formatAmount(maxAmount)}`);
      return;
    }

    setIsSubmitting(true);

    try {
      if (method === "MERCADO_PAGO") {
        const res = await fetch("/api/payments/generate-link", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reservationId,
            amount: numAmount,
          }),
        });
        const result = await res.json();
        if (result.error) {
          toast.error(result.error);
          return;
        }
        toast.success("Link de pago generado - Cópialo desde el listado de pagos");
      } else {
        const formData = new FormData();
        formData.append("reservationId", reservationId);
        formData.append("amount", String(numAmount));
        formData.append("method", method);
        formData.append("status", "COMPLETED");
        formData.append("paidAt", (() => {
          const [y, m, d] = paidAt.split('-').map(Number);
          return new Date(y, m - 1, d, 12, 0, 0).toISOString();
        })());
        if (receiptFile) {
          formData.append("receipt", receiptFile);
        }

        const res = await fetch("/api/payments", {
          method: "POST",
          body: formData,
        });
        const result = await res.json();
        if (result.error) {
          toast.error(result.error);
          return;
        }
        toast.success("Pago registrado exitosamente");
      }

      setAmount("");
      setMethod("MERCADO_PAGO");
      setReceiptFile(null);
      onOpenChange(false);
      onSuccess?.();
    } catch {
      toast.error("Error al registrar el pago");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Agregar Pago
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2 relative">
          <div className="p-3 rounded-md bg-muted/50 border border-border text-sm">
            <div className="flex justify-between mb-1">
              <span className="text-muted-foreground">Total reserva:</span>
              <span className="font-medium">{formatAmount(Number(totalPrice))}</span>
            </div>
            <div className="flex justify-between mb-1">
              <span className="text-muted-foreground">Ya pagado:</span>
              <span className="font-medium text-green-600">{formatAmount(paidAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Pendiente:</span>
              <span className="font-medium text-orange-600">{formatAmount(pendingAmount)}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Método de Pago</Label>
            <Select
              value={method}
              onValueChange={(v) => setMethod(v as PaymentMethod)}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MERCADO_PAGO">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-3 w-3" />
                    Mercado Pago
                  </div>
                </SelectItem>
                <SelectItem value="CASH">Efectivo</SelectItem>
                <SelectItem value="TRANSFER">Transferencia</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Monto</Label>
            <Input
              type="number"
              placeholder="Ingresa el monto"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="h-9"
              min={1}
              max={maxAmount}
            />
            <p className="text-xs text-muted-foreground">
              Máximo: {formatAmount(maxAmount)}
            </p>
          </div>

          {method !== "MERCADO_PAGO" && (
            <div className="space-y-2">
              <Label className="text-xs">Fecha de Pago</Label>
              <Input
                type="date"
                value={paidAt}
                onChange={(e) => setPaidAt(e.target.value)}
                className="h-9"
              />
            </div>
          )}

          {method !== "MERCADO_PAGO" && (
            <div className="space-y-2">
              <Label className="text-xs">Comprobante (opcional)</Label>
              <ReceiptUpload onFileSelect={setReceiptFile} />
            </div>
          )}
        </div>

        {isSubmitting && (
          <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-10 rounded-lg">
            <div className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">
                {receiptFile ? "Subiendo comprobante..." : "Guardando..."}
              </span>
            </div>
          </div>
        )}

        <div className="flex gap-2 justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={isSubmitting || !amount}
          >
            {isSubmitting ? "Guardando..." : method === "MERCADO_PAGO" ? "Generar Link" : "Registrar Pago"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}