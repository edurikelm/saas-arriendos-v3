"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { useForm, useWatch, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { Controller } from "react-hook-form";
import { toast } from "sonner";
import { Plus, CreditCard, Loader2 } from "lucide-react";
import { ReceiptUpload } from "@/components/ui/receipt-upload";

interface AddPaymentDialogProps {
  reservationId: string;
  totalPrice: string;
  /**
   * Saldo pagado del arriendo (RESERVATION COMPLETED only).
   * NO incluye cobros EXTRA. Ver `src/lib/payments/calculations.ts`.
   */
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

// Schema factory — defined OUTSIDE the component (valid-resolver-caching)
function createAddPaymentSchema(maxAmount: number) {
  return z
    .object({
      paymentType: z.enum(["RESERVATION", "EXTRA"]),
      method: z.enum(["MERCADO_PAGO", "CASH", "TRANSFER"]),
      amount: z
        .string()
        .min(1, "Ingresa un monto válido")
        .refine((s) => parseCurrencyInput(s) > 0, "Ingresa un monto válido"),
      title: z.string(),
      description: z.string().optional(),
      paidAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
    })
    .refine(
      (data) => {
        // EXTRA requires title
        if (data.paymentType === "EXTRA" && !data.title.trim()) {
          return false;
        }
        return true;
      },
      {
        message: "El título es requerido para pagos extra",
        path: ["title"],
      }
    )
    .refine(
      (data) => {
        // RESERVATION non-MP: amount <= maxAmount
        if (
          data.paymentType === "RESERVATION" &&
          data.method !== "MERCADO_PAGO"
        ) {
          if (parseCurrencyInput(data.amount) > maxAmount) {
            return false;
          }
        }
        return true;
      },
      {
        message: `El monto no puede exceder el pendiente: ${formatAmount(maxAmount)}`,
        path: ["amount"],
      }
    );
}

type AddPaymentFormValues = z.infer<ReturnType<typeof createAddPaymentSchema>>;

export function AddPaymentDialog({
  reservationId,
  totalPrice,
  paidAmount,
  open,
  onOpenChange,
  onSuccess,
}: AddPaymentDialogProps) {
  const pendingAmount = Number(totalPrice) - paidAmount;

  const schema = useMemo(
    () => createAddPaymentSchema(pendingAmount),
    [pendingAmount]
  );

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    formState: { isSubmitting },
  } = useForm<AddPaymentFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      paymentType: "RESERVATION",
      method: "MERCADO_PAGO",
      amount: "",
      title: "",
      description: "",
      paidAt: format(new Date(), "yyyy-MM-dd"),
    },
    mode: "onSubmit",
    reValidateMode: "onBlur",
  });

  // Local (non-serializable) state for file upload
  const [receiptFile, setReceiptFile] = useState<File | null>(null);

  // Isolated subscriptions for conditional UI (sub-usewatch-over-watch)
  const paymentType = useWatch({ control, name: "paymentType" });
  const method = useWatch({ control, name: "method" });

  const isExtra = paymentType === "EXTRA";
  const showPaidAtAndReceipt = method !== "MERCADO_PAGO";
  const watchedAmount = watch("amount");

  const handleMaxClick = (onChange: (val: string) => void) => {
    onChange(formatCurrencyInput(String(pendingAmount)));
  };

  const onSubmit = async (values: AddPaymentFormValues) => {
    const numAmount = parseCurrencyInput(values.amount);

    try {
      if (values.method === "MERCADO_PAGO") {
        const res = await fetch("/api/payments/generate-link", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reservationId,
            amount: numAmount,
            paymentType: values.paymentType,
            title: values.title || undefined,
            description: values.description || undefined,
          }),
        });
        const result = await res.json();
        if (result.error) {
          toast.error(result.error);
          return;
        }
        toast.success(
          "Link de pago generado - Cópialo desde el listado de pagos"
        );
      } else {
        const formData = new FormData();
        formData.append("reservationId", reservationId);
        formData.append("amount", String(numAmount));
        formData.append("method", values.method);
        formData.append("paymentType", values.paymentType);
        if (values.title) formData.append("title", values.title);
        if (values.description)
          formData.append("description", values.description);
        formData.append("status", "COMPLETED");
        formData.append("paidAt", (() => {
          const [y, m, d] = values.paidAt.split("-").map(Number);
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

      reset();
      setReceiptFile(null);
      onOpenChange(false);
      onSuccess?.();
    } catch {
      toast.error("Error al registrar el pago");
    }
  };

  // onInvalid fires when schema validation fails (onSubmit mode)
  const onInvalid = (errors: FieldErrors<AddPaymentFormValues>) => {
    const messages = Object.values(errors)
      .filter((e): e is NonNullable<typeof e> => !!e)
      .map((e) => e.message);
    if (messages[0]) {
      toast.error(messages[0]);
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
          {/* paymentType toggle — Controller for re-render isolation */}
          <Controller
            control={control}
            name="paymentType"
            render={({ field }) => (
              <div className="flex gap-1 p-1 rounded-lg bg-muted/50 border border-border">
                <button
                  type="button"
                  onClick={() => field.onChange("RESERVATION")}
                  className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                    field.value === "RESERVATION"
                      ? "bg-background text-foreground ring-1 ring-border"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Pago de Reserva
                </button>
                <button
                  type="button"
                  onClick={() => field.onChange("EXTRA")}
                  className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                    field.value === "EXTRA"
                      ? "bg-background text-foreground ring-1 ring-border"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Pago Extra
                </button>
              </div>
            )}
          />

          <div className="p-3 rounded-md bg-muted/50 border border-border text-sm">
            <div className="flex justify-between mb-1">
              <span className="text-muted-foreground">Total reserva:</span>
              <span className="font-medium">
                {formatAmount(Number(totalPrice))}
              </span>
            </div>
            <div className="flex justify-between mb-1">
              <span className="text-muted-foreground">Ya pagado:</span>
              <span className="font-medium text-success">
                {formatAmount(paidAmount)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Pendiente:</span>
              <span className="font-medium text-warning">
                {formatAmount(pendingAmount)}
              </span>
            </div>
          </div>

          {/* method Select — wired with onValueChange (integ-shadcn-select-wiring) */}
          <Controller
            control={control}
            name="method"
            render={({ field }) => (
              <div className="space-y-2">
                <Label className="text-xs">Método de Pago</Label>
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue>
                      {field.value === "MERCADO_PAGO" ? (
                        <div className="flex items-center gap-2">
                          <CreditCard className="h-3 w-3" />
                          Mercado Pago
                        </div>
                      ) : field.value === "CASH" ? (
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
            )}
          />

          {/* amount — Controller storing formatted string (preserve UX) */}
          <Controller
            control={control}
            name="amount"
            render={({ field }) => (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Monto</Label>
                  {!isExtra && (
                    <button
                      type="button"
                      onClick={() => handleMaxClick(field.onChange)}
                      className="text-xs px-2 py-0.5 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors cursor-pointer font-medium"
                    >
                      Máximo: {formatAmount(pendingAmount)}
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
                    value={field.value}
                    onChange={(e) => {
                      const rawValue = e.target.value;
                      // Preserve backspace behavior (handle shorter value + no trailing dot)
                      if (
                        rawValue.length < field.value.length &&
                        !rawValue.endsWith(".")
                      ) {
                        const cleaned = rawValue.replace(/\D/g, "");
                        field.onChange(cleaned ? formatCurrencyInput(cleaned) : "");
                        return;
                      }
                      field.onChange(formatCurrencyInput(rawValue));
                    }}
                    className="h-9 pl-7"
                  />
                </div>
              </div>
            )}
          />

          {isExtra && (
            <>
              <div className="space-y-2">
                <Label className="text-xs">
                  Título <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="text"
                  placeholder="Ej: Limpieza extra, Daños menores"
                  {...register("title")}
                  className="h-9"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Descripción (opcional)</Label>
                <Textarea
                  placeholder="Descripción opcional"
                  {...register("description")}
                  className="min-h-[60px]"
                />
              </div>
            </>
          )}

          {showPaidAtAndReceipt && (
            <div className="space-y-2">
              <Label className="text-xs">Fecha de Pago</Label>
              <Input
                type="date"
                {...register("paidAt")}
                className="h-9"
              />
            </div>
          )}

          {showPaidAtAndReceipt && (
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
            onClick={handleSubmit(onSubmit, onInvalid)}
            disabled={isSubmitting || !watchedAmount}
          >
            {isSubmitting
              ? "Guardando..."
              : method === "MERCADO_PAGO"
                ? "Generar Link"
                : "Registrar Pago"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
