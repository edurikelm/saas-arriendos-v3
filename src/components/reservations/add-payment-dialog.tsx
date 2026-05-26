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
import { Textarea } from "@/components/ui/textarea";
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
type PaymentType = "RESERVATION" | "EXTRA";

function formatAmount(amount: number): string {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatCurrencyInput(value: string): string {
  // Remove non-numeric characters
  const numericValue = value.replace(/\D/g, "");
  if (!numericValue) return "";
  // Format with thousands separator
  return new Intl.NumberFormat("es-CL", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(numericValue));
}

function parseCurrencyInput(value: string): number {
  return Number(value.replace(/\./g, ""));
}

export function AddPaymentDialog({
  reservationId,
  totalPrice,
  paidAmount,
  open,
  onOpenChange,
  onSuccess,
}: AddPaymentDialogProps) {
  const [paymentType, setPaymentType] = useState<PaymentType>("RESERVATION");
  const [method, setMethod] = useState<PaymentMethod>("MERCADO_PAGO");
  const [amount, setAmount] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [paidAt, setPaidAt] = useState(format(new Date(), "yyyy-MM-dd"));
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const pendingAmount = Number(totalPrice) - paidAmount;
  const maxAmount = pendingAmount;
  const isExtra = paymentType === "EXTRA";

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    // If user is backspacing and removes a separator, handle gracefully
    if (rawValue.length < amount.length && !rawValue.endsWith(".")) {
      // Let the raw value through, then reformat
      const cleaned = rawValue.replace(/\D/g, "");
      setAmount(cleaned ? formatCurrencyInput(cleaned) : "");
      return;
    }
    setAmount(formatCurrencyInput(rawValue));
  };

  const handleMaxClick = () => {
    setAmount(formatCurrencyInput(String(maxAmount)));
  };

  const handleSubmit = async () => {
    const numAmount = parseCurrencyInput(amount);

    if (!numAmount || numAmount <= 0) {
      toast.error("Ingresa un monto válido");
      return;
    }

    if (isExtra) {
      if (!title.trim()) {
        toast.error("El título es requerido para pagos extra");
        return;
      }
    } else {
      if (numAmount > maxAmount) {
        toast.error(`El monto no puede exceder el pendiente: ${formatAmount(maxAmount)}`);
        return;
      }
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
            paymentType,
            title: title || undefined,
            description: description || undefined,
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
        formData.append("paymentType", paymentType);
        if (title) formData.append("title", title);
        if (description) formData.append("description", description);
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
      setTitle("");
      setDescription("");
      setPaymentType("RESERVATION");
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
      <DialogContent className="w-[95vw] max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Agregar Pago
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2 relative">
          <div className="flex gap-1 p-1 rounded-lg bg-muted/50 border border-border">
            <button
              type="button"
              onClick={() => setPaymentType("RESERVATION")}
              className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                !isExtra
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Pago de Reserva
            </button>
            <button
              type="button"
              onClick={() => setPaymentType("EXTRA")}
              className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                isExtra
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Pago Extra
            </button>
          </div>

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
                <SelectValue>
                  {method === "MERCADO_PAGO" ? (
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-3 w-3" />
                      Mercado Pago
                    </div>
                  ) : method === "CASH" ? (
                    "Efectivo"
                  ) : (
                    "Transferencia"
                  )}
                </SelectValue>
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
            <div className="flex items-center justify-between">
              <Label className="text-xs">Monto</Label>
              {!isExtra && (
                <button
                  type="button"
                  onClick={handleMaxClick}
                  className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors cursor-pointer font-medium"
                >
                  Máximo: {formatAmount(maxAmount)}
                </button>
              )}
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none">
                $
              </span>
              <Input
                type="text"
                inputMode="numeric"
                placeholder="0"
                value={amount}
                onChange={handleAmountChange}
                className="h-9 pl-7"
              />
            </div>
          </div>

          {isExtra && (
            <>
              <div className="space-y-2">
                <Label className="text-xs">
                  Título <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="text"
                  placeholder="Ej: Limpieza extra, Daños menores"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="h-9"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Descripción (opcional)</Label>
                <Textarea
                  placeholder="Descripción opcional"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="min-h-[60px]"
                />
              </div>
            </>
          )}

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
