import { getProperties } from "@/lib/actions/properties";
import { getClients } from "@/lib/actions/clients";
import { getCalendarReservations } from "@/lib/actions/reservations";
import { CalendarView } from "@/components/calendar/calendar-view";

export default async function CalendarPage() {
  const [properties, clients, reservations] = await Promise.all([
    getProperties(),
    getClients(),
    getCalendarReservations({
      year: new Date().getFullYear(),
      month: new Date().getMonth() + 1,
    }),
  ]);

  return (
    <CalendarView
      initialReservations={reservations}
      properties={properties.map((p) => ({
        id: p.id,
        name: p.name,
        color: p.color ?? undefined,
      }))}
      clients={clients.map((c) => ({
        id: c.id,
        name: c.name,
        email: c.email,
      }))}
    />
  );
}
