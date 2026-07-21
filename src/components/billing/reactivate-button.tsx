"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { reactivateMySubscription } from "@/lib/actions/subscriptions";

export function ReactivateButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleReactivate = () => {
    startTransition(async () => {
      try {
        await reactivateMySubscription();
        toast.success("Tu suscripción PRO ha sido reactivada");
        router.refresh();
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Error desconocido";
        toast.error(msg);
      }
    });
  };

  return (
    <Button
      type="button"
      onClick={handleReactivate}
      disabled={isPending}
      variant="default"
      className="w-full"
    >
      <RotateCcw className="size-4 mr-2" />
      {isPending ? "Reactivando..." : "Reactivar PRO"}
    </Button>
  );
}
