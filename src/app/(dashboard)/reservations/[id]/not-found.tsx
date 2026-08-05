import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
      <h2 className="text-2xl font-bold tracking-tight">Reserva no encontrada</h2>
      <p className="text-sm text-muted-foreground mt-2 max-w-md">
        La reserva que buscas no existe, fue cancelada o no pertenece a tu cuenta.
      </p>
      <Link href="/reservations" className={buttonVariants({ variant: "default", className: "mt-4" })}>
        Volver a Reservas
      </Link>
    </div>
  );
}
