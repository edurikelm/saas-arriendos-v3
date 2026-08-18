"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cancelMySubscription } from "@/lib/actions/subscriptions";

const LOST_FEATURES = [
  "Sincronización iCal (Airbnb, Booking, VRBO)",
  "Documentos de reserva (contratos, anexos)",
  "Propiedades y clientes ilimitados",
  "Reportes con rango completo de fechas",
];

const REASON_OPTIONS = [
  { value: "too_expensive", label: "Es muy caro" },
  { value: "not_using", label: "No estoy usando las funciones PRO" },
  { value: "switching_provider", label: "Cambié de proveedor" },
  { value: "other", label: "Otro motivo" },
] as const;

interface CancelSubscriptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPeriodEnd: Date | null;
}

export function CancelSubscriptionDialog({
  open,
  onOpenChange,
  currentPeriodEnd,
}: CancelSubscriptionDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [reason, setReason] = useState<(typeof REASON_OPTIONS)[number]["value"] | null>(
    null
  );
  const [customReason, setCustomReason] = useState("");

  const formattedEnd = currentPeriodEnd
    ? currentPeriodEnd.toLocaleDateString("es-CL", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : null;

  const handleCancel = () => {
    const finalReason =
      reason === "other" ? customReason : (reason ?? undefined);
    startTransition(async () => {
      try {
        await cancelMySubscription(finalReason as "too_expensive" | "not_using" | "switching_provider" | "other" | undefined);
        toast.success(
          formattedEnd
            ? `Tu plan seguirá activo hasta el ${formattedEnd}`
            : "Tu plan ha sido cancelado"
        );
        onOpenChange(false);
        router.refresh();
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Error desconocido";
        toast.error(msg);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-lg" aria-describedby="cancel-dialog-description">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-warning" />
            <DialogTitle>Cancelar suscripcion PRO</DialogTitle>
          </div>
          {formattedEnd && (
            <p className="text-sm text-muted-foreground mt-2" id="cancel-dialog-description">
                Tu plan seguirá activo hasta el{" "}
                <strong className="text-foreground">{formattedEnd}</strong>.
                Después bajarás a FREE y perderás acceso a las funciones PRO.
              </p>
          )}
        </DialogHeader>

        <div className="space-y-4">
          {/* Lista de features que perderas */}
          <div className="rounded-lg border border-warning/20 bg-warning/10 p-4">
            <p className="text-sm font-medium text-warning mb-2">
              Funciones que perderás al bajar a FREE:
            </p>
            <ul className="space-y-1.5 text-sm text-warning">
              {LOST_FEATURES.map((feature) => (
                <li key={feature} className="flex items-start gap-2">
                  <span className="mt-1 size-1.5 rounded-full bg-warning shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Reason selector */}
          <div className="space-y-2">
            <Label htmlFor="cancel-reason">
              Por qué cancelas? (opcional)
            </Label>
            <select
              id="cancel-reason"
              value={reason ?? ""}
              onChange={(e) =>
                setReason((e.target.value as typeof reason) || null)
              }
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Selecciona un motivo...</option>
              {REASON_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {reason === "other" && (
              <Textarea
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Cuéntanos por qué cancelas..."
                rows={3}
                className="mt-2"
              />
            )}
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
            className="w-full sm:w-auto"
          >
            Mantener PRO
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleCancel}
            disabled={isPending}
            className="w-full sm:w-auto"
          >
            {isPending ? "Cancelando..." : "Cancelar suscripcion"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
