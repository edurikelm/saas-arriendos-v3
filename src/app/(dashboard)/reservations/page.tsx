import { getReservations } from "@/lib/actions/reservations";
import { getProperties } from "@/lib/actions/properties";
import { getClients } from "@/lib/actions/clients";
import { getSession } from "@/lib/actions/auth";
import { ReservationsListClient } from "@/components/reservations/reservations-list-client";

export const dynamic = "force-dynamic";

export default async function ReservationsPage() {
  const [session, reservations, properties, clients] = await Promise.all([
    getSession(),
    getReservations(),
    getProperties(),
    getClients(),
  ]);

  return (
    <ReservationsListClient
      initialReservations={reservations as any}
      properties={properties as any}
      clients={clients as any}
      plan={session?.plan ?? "FREE"}
    />
  );
}