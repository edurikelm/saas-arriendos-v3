import { getProperties } from "@/lib/actions/properties";
import { getClients } from "@/lib/actions/clients";
import { getCalendarReservations, getCalendarExternalBlocks } from "@/lib/actions/reservations";
import { getSession } from "@/lib/actions/auth";
import { CalendarView } from "@/components/calendar/calendar-view";

interface CalendarPageProps {
  searchParams: Promise<{ showExternalBlocks?: string }>;
}

export default async function CalendarPage({ searchParams }: CalendarPageProps) {
  const params = await searchParams;
  const showExternalBlocks = params.showExternalBlocks === "1";

  const [session, properties, clientsResult, reservations, externalBlocks] = await Promise.all([
    getSession(),
    getProperties(),
    getClients({ limit: 1000 }),
    getCalendarReservations({
      year: new Date().getFullYear(),
      month: new Date().getMonth() + 1,
    }),
    showExternalBlocks
      ? getCalendarExternalBlocks({
          year: new Date().getFullYear(),
          month: new Date().getMonth() + 1,
        })
      : Promise.resolve([]),
  ]);

  const clients = Array.isArray(clientsResult) ? [] : clientsResult.data;

  return (
    <CalendarView
      initialReservations={reservations}
      initialExternalBlocks={externalBlocks}
      initialShowExternalBlocks={showExternalBlocks}
      plan={session?.plan ?? "FREE"}
      properties={properties.map((p) => ({
        id: p.id,
        name: p.name,
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
