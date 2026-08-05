"use client";

import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="rounded-full bg-destructive/10 p-4">
        <AlertCircle className="h-8 w-8 text-destructive" />
      </div>
      <div className="space-y-2 max-w-md">
        <h2 className="text-xl font-bold tracking-tight">No se pudo cargar la reserva</h2>
        <p className="text-sm text-muted-foreground">
          {error.message || "Ocurrió un error inesperado al mostrar esta reserva."}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button onClick={reset} variant="outline">
          Reintentar
        </Button>
        <Link href="/reservations" className={buttonVariants({ variant: "default" })}>
          Volver a Reservas
        </Link>
      </div>
    </div>
  );
}
