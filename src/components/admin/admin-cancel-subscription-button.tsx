"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { adminCancelSubscription } from "@/lib/actions/admin-subscriptions";

export function AdminCancelSubscriptionButton({
  userId,
  subscriptionId,
}: {
  userId: string;
  subscriptionId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleCancel = () => {
    if (!reason.trim()) {
      toast.error("La razón es obligatoria");
      return;
    }
    startTransition(async () => {
      try {
        await adminCancelSubscription({ userId, reason });
        toast.success("Suscripción cancelada");
        setOpen(false);
        router.refresh();
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Error desconocido";
        toast.error(msg);
      }
    });
  };

  return (
    <>
      <Button
        type="button"
        variant="destructive"
        size="sm"
        onClick={() => setOpen(true)}
      >
        <Ban className="size-4 mr-2" />
        Cancelar manualmente
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cancelar suscripción manualmente</DialogTitle>
            <DialogDescription>
              Esta acción es irreversible desde la UI. La cancelación es al fin del
              período: el owner seguirá con PRO hasta entonces.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <Label htmlFor="reason">Razón (obligatoria, para auditoría)</Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ej: Disputa de pago, solicitud del owner, fraude, etc."
                rows={3}
                className="mt-2"
                required
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Subscription ID:{" "}
              <span className="font-mono">{subscriptionId}</span>
            </p>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
              className="w-full sm:w-auto"
            >
              Volver
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleCancel}
              disabled={isPending || !reason.trim()}
              className="w-full sm:w-auto"
            >
              {isPending ? "Cancelando..." : "Confirmar cancelación"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
