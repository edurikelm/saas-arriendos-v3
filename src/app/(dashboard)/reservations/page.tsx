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

  return (
    <ReservationsListClient
      initialData={reservationsData}
      properties={properties}
      clients={clients.map((c) => ({ id: c.id, name: c.name, email: c.email }))}
      plan={session?.plan ?? "FREE"}
    />
  );
}