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

function formatAmount(amount: string | number): string {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(amount));
}

const PAID_METHOD_LABELS: Record<string, string> = {
  CASH: "Efectivo",
  TRANSFER: "Transferencia",
};

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
  /**
   * Monto del pago que se va a liquidar. Se muestra como la cifra mas grande del
   * dialogo: es lo que el owner tiene que verificar antes de confirmar una accion
   * que no tiene undo, y en una reserva mensual hay seis filas con el mismo valor.
   */
  amount?: string | number;
  /**
   * Metodo con el que se creo el pago. Siembra el select en vez de asumir CASH:
   * confirmar sobre una fila de Transferencia reescribia el metodo en silencio.
   */
  defaultMethod?: string | null;
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
  amount,
  defaultMethod,
}: MarkPaidDialogProps) {
  // Fecha y metodo se DERIVAN en render y el estado guarda solo lo que el owner
  // toco. Sembrarlos con un efecto era la otra opcion, pero setState dentro de un
  // efecto encadena renders (y el lint lo prohibe con razon). Asi ademas el
  // dialogo no arrastra lo elegido la vez anterior: se queda montado entre
  // aperturas, y antes de esto el metodo se pegaba de un pago al siguiente.
  const [methodOverride, setMethodOverride] = useState<PaidMethod | null>(null);
  const [dateOverride, setDateOverride] = useState<string | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // El pago se creo con un metodo; asumirlo siempre CASH lo reescribia en
  // silencio. MERCADO_PAGO no es representable aca (el select ofrece efectivo o
  // transferencia), asi que cae a CASH.
  const method: PaidMethod =
    methodOverride ?? (defaultMethod === "TRANSFER" ? "TRANSFER" : "CASH");
  const date = dateOverride ?? format(new Date(), "yyyy-MM-dd");

  function setMethod(next: PaidMethod) {
    setMethodOverride(next);
  }
  function setDate(next: string) {
    setDateOverride(next);
  }

  function resetState() {
    setReceiptFile(null);
    setIsUploading(false);
    setMethodOverride(null);
    setDateOverride(null);
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

        {/* El monto va aca y no en la descripcion: es el dato que el owner tiene
            que verificar antes de una accion sin undo, y una descripcion en gris
            de 12px es justo lo que se saltea. Mismo idioma kicker + cifra tabular
            que usan las filas de pago. */}
        {amount != null && (
          <div className="rounded-lg border border-border bg-muted/40 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Monto a registrar
            </p>
            <p className="text-2xl font-bold tabular-nums text-foreground tracking-tight">
              {formatAmount(amount)}
            </p>
          </div>
        )}

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
                {/* `SelectValue` de base-ui renderiza el VALOR, no la etiqueta del
                    item: sin esta funcion el trigger mostraba "CASH" en una UI en
                    español mientras el desplegable decia "Efectivo". */}
                <SelectValue>{(value: string) => PAID_METHOD_LABELS[value] ?? value}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CASH">{PAID_METHOD_LABELS.CASH}</SelectItem>
                <SelectItem value="TRANSFER">{PAID_METHOD_LABELS.TRANSFER}</SelectItem>
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
