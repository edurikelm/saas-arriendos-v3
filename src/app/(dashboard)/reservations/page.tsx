import { getReservations } from "@/lib/actions/reservations";
import { getProperties } from "@/lib/actions/properties";
import { getClients } from "@/lib/actions/clients";
import { ReservationsListClient } from "@/components/reservations/reservations-list-client";

export const dynamic = "force-dynamic";

export default async function ReservationsPage() {
  const [reservations, properties, clients] = await Promise.all([
    getReservations(),
    getProperties(),
    getClients(),
  ]);

  return (
    <ReservationsListClient
      initialReservations={reservations as any}
      properties={properties as any}
      clients={clients as any}
    />
  );
}