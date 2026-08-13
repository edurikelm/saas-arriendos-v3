import { Suspense } from "react";
import { getReservations } from "@/lib/actions/reservations";
import { getProperties } from "@/lib/actions/properties";
import { getClients } from "@/lib/actions/clients";
import { getSession } from "@/lib/auth/session";
import { ReservationsListClient } from "@/components/reservations/reservations-list-client";

export const dynamic = "force-dynamic";

export default async function ReservationsPage() {
  const [session, reservationsData, properties, clientsResult] = await Promise.all([
    getSession(),
    getReservations({ page: 1, limit: 10 }),
    getProperties(),
    getClients({ limit: 1000 }),
  ]);

  const clients = Array.isArray(clientsResult) ? [] : clientsResult.data;

  // Suspense boundary requerido por `useSearchParams()` en ReservationsListClient.
  // Patrón consistente con /admin/support/page.tsx. Hoy la página es
  // force-dynamic y el fallback no se ve en producción; queda como red de
  // seguridad si Next.js endurece el requisito en una versión futura.
  return (
    <Suspense
      fallback={
        <div className="py-8 text-center text-sm text-muted-foreground">
          Cargando reservas...
        </div>
      }
    >
      <ReservationsListClient
        initialData={reservationsData}
        properties={properties}
        clients={clients.map((c) => ({ id: c.id, name: c.name, email: c.email }))}
        plan={session?.plan ?? "FREE"}
      />
    </Suspense>
  );
}