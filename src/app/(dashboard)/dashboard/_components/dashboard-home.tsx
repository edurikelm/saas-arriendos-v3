import type { ReactNode } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import type { DashboardAgendaDay, DashboardSummary } from "@/lib/dashboard/summary";
import { formatCLP } from "@/lib/format/currency";
import { DashboardAgenda } from "./dashboard-agenda";
import { DashboardCobranzaList, type CobranzaItem } from "./dashboard-cobranza-list";
import { DashboardMonthPulse } from "./dashboard-month-pulse";
import { DashboardOnboarding } from "./dashboard-onboarding";
import { DashboardPropertyBoard } from "./dashboard-property-board";
import { longDayTitle } from "./day-labels";

function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}

/**
 * Subtítulo del inicio: el movimiento de hoy y la plata vencida, en una línea.
 * Es lo único de la página que se lee sin bajar en un teléfono, así que
 * resume las dos secciones que piden acción. Los vencidos salen del mismo
 * `windowGroups.OVERDUE` que el encabezado "Vencidos" de "Por cobrar": misma
 * cifra, misma palabra (#238).
 */
function buildSubtitle(today: DashboardAgendaDay | undefined, summary: DashboardSummary): string {
  const events = today?.events ?? [];
  const arrivals = events.filter((event) => event.kind === "ARRIVAL").length;
  const departures = events.filter((event) => event.kind === "DEPARTURE").length;

  const movementParts: string[] = [];
  if (arrivals > 0) movementParts.push(`${arrivals} ${pluralize(arrivals, "llegada", "llegadas")}`);
  if (departures > 0) {
    movementParts.push(`${departures} ${pluralize(departures, "salida", "salidas")}`);
  }
  const movement =
    movementParts.length > 0 ? `${movementParts.join(" y ")} hoy` : "Sin llegadas ni salidas hoy";

  const overdue = summary.collection.windowGroups.OVERDUE;
  const money =
    overdue.count > 0
      ? `${overdue.count} ${pluralize(overdue.count, "cobro vencido", "cobros vencidos")} por ${formatCLP(overdue.amount)}`
      : "Cobranza al día";

  return `${movement} · ${money}`;
}

interface DashboardHomeProps {
  summary: DashboardSummary;
  /** Banner de plan: lo resuelve la página, que es la que carga la suscripción. */
  banner?: ReactNode;
  /**
   * MP conectado (`getMercadoPagoIntegration`, resuelto en `page.tsx`). Sin
   * esto, "Por cobrar" no ofrece "Enviar link" en ninguna fila.
   */
  canSendPaymentLinks?: boolean;
}

/**
 * Cuerpo del inicio, separado de `page.tsx` para que la página se quede con
 * la carga de datos y el fallback de error, y esto se pueda renderizar con
 * datos armados a mano (tests, revisión visual) sin sesión ni base.
 *
 * Estructura: lo que pide acción primero (agenda y cobros), lo que se consulta
 * después (propiedades y el mes) — en columnas en desktop, apilado en móvil.
 * Una cuenta sin reservas ve solo los primeros pasos: cada sección sería una
 * caja vacía.
 */
export function DashboardHome({ summary, banner, canSendPaymentLinks = false }: DashboardHomeProps) {
  const { todayKey, agenda, collection, collectionItems, propertyBoard, month, isEmpty } = summary;

  const cobranzaItems: CobranzaItem[] = collectionItems.map((item) => ({
    reservationId: item.reservationId,
    clientName: item.clientName,
    clientEmail: item.clientEmail,
    clientPhone: item.clientPhone,
    billingType: item.billingType,
    amount: item.amount,
    dueDate: item.dueDate ? new Date(item.dueDate) : null,
    daysFromToday: item.daysFromToday,
    bucket: item.bucket,
    propertyName: item.propertyName,
    overdueCount: item.overdueCount,
    dueSoonCount: item.dueSoonCount,
    dueSoonDaysFromToday: item.dueSoonDaysFromToday,
    nextCharge: item.nextCharge,
  }));

  // Hoy siempre viene en `days`, aunque no tenga eventos.
  const today = agenda.days.find((day) => day.offset === 0);

  return (
    <div className="space-y-6 pb-10">
      {/* La fecha es el título porque la página es "tu día". El nombre de la
          página queda para lectores de pantalla, que se orientan por el h1. */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground tracking-tight">
            <span className="sr-only">Dashboard: </span>
            {longDayTitle(todayKey)}
          </h1>
          {!isEmpty.reservations && (
            <p className="text-xs text-muted-foreground">{buildSubtitle(today, summary)}</p>
          )}
        </div>
        {/* En los primeros pasos el camino es uno solo: el botón repetiría el
            paso 2, y sin propiedades llevaría a un formulario sin nada que
            elegir. */}
        {!isEmpty.reservations && (
          <Link href="/reservations?create=true" className={buttonVariants({ size: "sm" })}>
            <Plus className="h-3.5 w-3.5" />
            Nueva Reserva
          </Link>
        )}
      </div>

      {banner}

      {isEmpty.reservations ? (
        <DashboardOnboarding hasProperties={!isEmpty.properties} />
      ) : (
        <>
          {/* Tres columnas desde xl: cada sección es una lista de filas cortas
              (nombre + cifra), y a 2/3 del ancho esas filas quedaban con un
              hueco en el medio.

              Agenda y cobros van en su propia grilla y se estiran al mismo
              alto: son las dos listas que piden acción, con el mismo tope de
              6 filas, y leídas lado a lado su pie ("+N más", "Total") queda a
              la misma altura. Propiedades y el mes van en la tercera columna,
              cada una del alto de su contenido: estiradas, una cuenta con 15
              propiedades dejaría agenda y cobros con media card vacía.

              El mes va bajo propiedades y ya no bajo la agenda: con la agenda
              sin tope, una semana cargada lo dejaba a 1286px, fuera de la
              primera pantalla a 1280×800; acá empieza en ~555px.

              El DOM conserva el orden de lectura —agenda, cobros, propiedades,
              mes—, que es el del móvil, el teclado y los lectores de pantalla.
              En lg, dos columnas por fila: a 1/3 la columna de cobros quedaría
              en ~224px, sin espacio para monto y acciones en la misma fila. */}
          <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-3">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:col-span-2">
              <DashboardAgenda agenda={agenda} todayKey={todayKey} />
              <DashboardCobranzaList
                items={cobranzaItems}
                viewAllHref="/payments"
                totalAmount={collection.windowAmount}
                totalCount={collection.windowCount}
                groupTotals={collection.windowGroups}
                canSendPaymentLinks={canSendPaymentLinks}
              />
            </div>
            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2 xl:grid-cols-1">
              <DashboardPropertyBoard board={propertyBoard} todayKey={todayKey} />
              <DashboardMonthPulse month={month} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
