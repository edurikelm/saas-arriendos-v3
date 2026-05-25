import { getProperties } from "@/lib/actions/properties";
import { getClients } from "@/lib/actions/clients";
import { getCalendarReservations } from "@/lib/actions/reservations";
import { getSession } from "@/lib/actions/auth";
import { CalendarView } from "@/components/calendar/calendar-view";

export default async function CalendarPage() {
  const [session, properties, clients, reservations] = await Promise.all([
    getSession(),
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
      plan={session?.plan ?? "FREE"}
      properties={properties.map((p) => ({
        id: p.id,
        name: p.name,
        color: p.color ?? undefined,
        unitsAvailable: p.unitsAvailable,
        dailyPrice: p.dailyPrice,
        monthlyPrice: p.monthlyPrice,
      }))}
      clients={clients.map((c) => ({
        id: c.id,
        name: c.name,
        email: c.email,
      }))}
    />
  );
}
