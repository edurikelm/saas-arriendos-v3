import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
      <h2 className="text-2xl font-bold tracking-tight">Reserva no encontrada</h2>
      {/* Decía "o fue cancelada", y es falso: una reserva cancelada se abre y se
          lee normal — mandaba al owner a buscar un borrado que no ocurrió. */}
      <p className="text-sm text-muted-foreground mt-2 max-w-md">
        La reserva que buscas no existe o no pertenece a tu cuenta.
      </p>
      <Link href="/reservations" className={buttonVariants({ variant: "default", className: "mt-4" })}>
        Volver a Reservas
      </Link>
    </div>
  );
}
