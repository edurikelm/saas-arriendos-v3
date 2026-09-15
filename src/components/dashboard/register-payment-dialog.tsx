"use client";

import { useState } from "react";
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
import { createPayment } from "@/lib/actions/payments";
import { businessNoonOfDateKey, nowKeyInBusinessTz } from "@/lib/domain/timezone";
import { formatCLP, formatCLPInput, parseCLPInput } from "@/lib/format/currency";

type ManualMethod = "CASH" | "TRANSFER";

const PAID_METHOD_LABELS: Record<string, string> = {
  CASH: "Efectivo",
  TRANSFER: "Transferencia",
};

interface RegisterPaymentDialogProps {
  reservationId: string;
  /** Saldo del arriendo (`getReservationPendingAmount`): tope del monto editable. */
  maxAmount: number;
  /**
   * Cliente · propiedad · concepto, igual criterio que
   * `MarkPaidDialog.contextLabel`.
   */
  contextLabel: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  /**
   * Se llama cuando el pago no se registró (el servidor lo rechazó, o falló la
   * red). El diálogo ya muestra el error; esto le permite al caller refrescar
   * sus datos, que pueden haber quedado viejos (el saldo cambió en otra pestaña).
   */
  onError?: () => void;
}

/**
 * Diálogo para CREAR un pago cuando la reserva tiene deuda pero ningún
 * `Payment` sobre el que actuar — el caso medido en producción de reservas
 * DAILY con saldo pendiente, que no generan cuotas automáticamente
 * (CONTEXT.md, ADR-0036 "Fuera de alcance"). `MarkPaidDialog` liquida un pago
 * EXISTENTE; este lo crea desde cero vía `createPayment`.
 *
 * Estructura calcada de `MarkPaidDialog` (mismo layout de campos, mismo
 * patrón de estado derivado + override) salvo por el monto, que acá es
 * editable en vez de fijo.
 */
export function RegisterPaymentDialog({
  reservationId,
  maxAmount,
  contextLabel,
  open,
  onOpenChange,
  onSuccess,
  onError,
}: RegisterPaymentDialogProps) {
  const [amountOverride, setAmountOverride] = useState<string | null>(null);
  const [methodOverride, setMethodOverride] = useState<ManualMethod | null>(null);
  const [dateOverride, setDateOverride] = useState<string | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [amountError, setAmountError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const amount = amountOverride ?? formatCLPInput(String(maxAmount));
  const method: ManualMethod = methodOverride ?? "CASH";
  // "Hoy" de Santiago, igual que la fecha que se guarda (ver `businessNoonOfDateKey`).
  const date = dateOverride ?? nowKeyInBusinessTz();

  function setMethod(next: ManualMethod) {
    setMethodOverride(next);
  }
  function setDate(next: string) {
    setDateOverride(next);
  }

  function resetState() {
    setAmountOverride(null);
    setMethodOverride(null);
    setDateOverride(null);
    setReceiptFile(null);
    setAmountError(null);
    setIsSubmitting(false);
  }

  function handleAmountChange(raw: string) {
    setAmountOverride(formatCLPInput(raw));
    if (amountError) setAmountError(null);
  }

  async function handleConfirm() {
    const numericAmount = parseCLPInput(amount);

    if (!Number.isInteger(numericAmount) || numericAmount <= 0) {
      setAmountError("Ingresa un monto válido");
      return;
    }
    if (numericAmount > maxAmount) {
      setAmountError(`El monto no puede exceder el saldo: ${formatCLP(maxAmount)}`);
      return;
    }

    setIsSubmitting(true);

    let receiptUrl: string | undefined;
    if (receiptFile) {
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
          setIsSubmitting(false);
          return;
        }
        receiptUrl = uploadResult.url;
      } catch {
        toast.error("Error al subir comprobante");
        setIsSubmitting(false);
        return;
      }
    }

    // Mediodía de Santiago del día elegido, no del navegador ni medianoche UTC:
    // es el único instante que cae en ese día leído en Santiago y por día UTC
    // desde cualquier zona. Ver `businessNoonOfDateKey`.
    const paidAt = businessNoonOfDateKey(date);

    // Objeto, no FormData: el comprobante ya se subió aparte (arriba). Las
    // server actions tienen límite de tamaño de cuerpo, por eso el archivo
    // nunca viaja junto con el resto del payload.
    let result: Awaited<ReturnType<typeof createPayment>>;
    try {
      result = await createPayment({
        reservationId,
        amount: numericAmount,
        method,
        status: "COMPLETED",
        paymentType: "RESERVATION",
        paidAt: paidAt.toISOString(),
        receiptUrl,
      });
    } catch {
      // Un corte de red rechaza la server action en vez de devolver `error`:
      // sin esto el botón quedaba en "Guardando..." para siempre y el dueño no
      // sabía si el pago se había registrado. No se reintenta solo: un
      // reintento automático podría registrar el mismo pago dos veces.
      setIsSubmitting(false);
      toast.error("No se pudo registrar el pago. Revisa tu conexión e intenta de nuevo.");
      onError?.();
      return;
    }

    setIsSubmitting(false);

    if (result?.error) {
      toast.error(result.error);
      onError?.();
      return;
    }

    toast.success("Pago registrado");
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
          <DialogTitle>Registrar pago</DialogTitle>
          <DialogDescription>{contextLabel}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="register-payment-amount" className="text-xs">
              Monto
            </Label>
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
                $
              </span>
              <Input
                id="register-payment-amount"
                type="text"
                inputMode="numeric"
                value={amount}
                onChange={(e) => handleAmountChange(e.target.value)}
                aria-invalid={!!amountError}
                aria-describedby={amountError ? "register-payment-amount-error" : undefined}
                className="h-9 pl-7"
              />
            </div>
            {amountError && (
              <p id="register-payment-amount-error" className="text-xs text-destructive-text">
                {amountError}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="register-payment-date" className="text-xs">
              Fecha de pago
            </Label>
            <Input
              id="register-payment-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-9"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="register-payment-method" className="text-xs">
              Método de pago
            </Label>
            <Select value={method} onValueChange={(v) => setMethod(v as ManualMethod)}>
              <SelectTrigger id="register-payment-method" className="h-9 w-full">
                {/* Mismo motivo que en `MarkPaidDialog`: `SelectValue` de
                    base-ui renderiza el VALOR, no la etiqueta del item. */}
                <SelectValue>{(value: string) => PAID_METHOD_LABELS[value] ?? value}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CASH">{PAID_METHOD_LABELS.CASH}</SelectItem>
                <SelectItem value="TRANSFER">{PAID_METHOD_LABELS.TRANSFER}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="register-payment-receipt" className="text-xs">
              Comprobante (opcional)
            </Label>
            <ReceiptUpload id="register-payment-receipt" onFileSelect={setReceiptFile} />
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="ghost"
            size="sm"
            disabled={isSubmitting}
            onClick={() => handleOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button size="sm" onClick={handleConfirm} disabled={isSubmitting}>
            {isSubmitting ? "Guardando..." : "Registrar pago"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
