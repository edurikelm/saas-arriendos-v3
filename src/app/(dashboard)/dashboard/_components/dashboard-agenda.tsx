import { CalendarCheck, LogIn, LogOut } from "lucide-react";
import { formatCLP } from "@/lib/format/currency";
import type {
  DashboardAgenda as DashboardAgendaData,
  DashboardAgendaEvent,
  DashboardAgendaEventKind,
} from "@/lib/dashboard/summary";
import { cn } from "@/lib/utils";
import { DashboardSection } from "./dashboard-section";
import { agendaDayHeading, relativeDayInline } from "./day-labels";
import { PropertyDot } from "./property-dot";
import { ReservationPreviewLink } from "./reservation-preview-link";

const KIND_LABEL: Record<DashboardAgendaEventKind, string> = {
  ARRIVAL: "Llega",
  DEPARTURE: "Sale",
};

const KIND_ICON: Record<DashboardAgendaEventKind, typeof LogIn> = {
  ARRIVAL: LogIn,
  DEPARTURE: LogOut,
};

function durationLabel(event: DashboardAgendaEvent): string {
  if (event.billingType === "MONTHLY") {
    return `${event.months} ${event.months === 1 ? "mes" : "meses"}`;
  }
  return `${event.nights} ${event.nights === 1 ? "noche" : "noches"}`;
}

interface DashboardAgendaProps {
  agenda: DashboardAgendaData;
  todayKey: string;
}

/**
 * Agenda del inicio: quién llega y quién sale, día por día, en los próximos
 * `horizonDays` días.
 *
 * Reemplaza a la tabla "Agenda de reservas" (vistas Próximas/Activas) y a la
 * franja de ocupación. Las dos organizaban por RESERVA —un registro con
 * estado—, y así la llegada de hoy quedaba en la pestaña que no se veía por
 * defecto, y la salida no aparecía en ninguna parte: el día que el huésped
 * entrega la propiedad su reserva ya está finalizada. Acá la unidad es el
 * EVENTO, que es lo que el dueño tiene que atender.
 *
 * El inicio y el fin de un contrato mensual entran igual que una llegada o
 * una salida, pero solo la semana en que ocurren: no ocupan filas durante
 * todo el mes, el problema que tumbó los dos intentos anteriores.
 *
 * El monto de una fila es el mismo que esa reserva muestra en "Por cobrar"
 * (`amountDue`, calculado con la misma función). Va sin color: el color de la
 * plata vive en esa sección, agrupado por urgencia.
 */
export function DashboardAgenda({ agenda, todayKey }: DashboardAgendaProps) {
  const hasEvents = agenda.days.some((day) => day.events.length > 0);

  return (
    <DashboardSection
      headingId="agenda-heading"
      title="Agenda"
      meta={`Llegadas y salidas · próximos ${agenda.horizonDays} días`}
      action={{ href: "/reservations", label: "Ver reservas" }}
    >
      {hasEvents ? (
        <div>
          {agenda.days.map((day, dayIdx) => {
            const headingId = `agenda-dia-${day.dateKey}`;
            return (
              <div key={day.dateKey}>
                {/* Banda de día: el mismo segundo plano tonal que el encabezado
                    de la card, más tenue, para que los días se lean como
                    capítulos sin sumar color. */}
                <div
                  className={cn(
                    "flex items-baseline justify-between gap-2 border-b border-border bg-muted/25 px-4 py-1.5",
                    dayIdx > 0 && "border-t"
                  )}
                >
                  <h3
                    id={headingId}
                    className="text-[10px] font-bold uppercase tracking-widest text-foreground"
                  >
                    {agendaDayHeading(day.dateKey, todayKey)}
                  </h3>
                  {/* Hoy sin movimientos se dice en la misma banda: una fila
                      entera para un "nada" empujaba los días con eventos hacia
                      abajo, y el subtítulo de la página ya lo anuncia. */}
                  {day.events.length > 0 ? (
                    <span
                      className="text-[10px] tabular-nums text-muted-foreground"
                      aria-hidden="true"
                    >
                      {day.events.length}
                    </span>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">Sin llegadas ni salidas</span>
                  )}
                </div>
                {day.events.length > 0 && (
                  <ul aria-labelledby={headingId} className="divide-y divide-border/60">
                    {day.events.map((event) => (
                      <AgendaEventRow
                        key={`${event.kind}-${event.reservationId}`}
                        event={event}
                        todayKey={todayKey}
                      />
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
          <CalendarCheck className="size-5 text-muted-foreground" aria-hidden="true" />
          <p className="text-xs font-bold text-foreground">
            Sin llegadas ni salidas en los próximos {agenda.horizonDays} días
          </p>
          <p className="text-[10px] text-muted-foreground">
            {agenda.nextEventAfterHorizon
              ? `El próximo movimiento es el ${relativeDayInline(
                  agenda.nextEventAfterHorizon.dateKey,
                  todayKey,
                )}.`
              : "No hay reservas por llegar ni por salir."}
          </p>
        </div>
      )}
    </DashboardSection>
  );
}

function AgendaEventRow({ event, todayKey }: { event: DashboardAgendaEvent; todayKey: string }) {
  const Icon = KIND_ICON[event.kind];
  const unitsSuffix = event.unitsBooked > 1 ? ` · ${event.unitsBooked} unidades` : "";

  return (
    <li>
      {/* Click simple: el preview de `/calendar`. Ctrl+click o sin JS: la página. */}
      <ReservationPreviewLink
        reservationId={event.reservationId}
        className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[color:var(--foreground)]!"
      >
        {/*
          Llegada y salida se distinguen por palabra e ícono, no por color: el
          color del inicio queda para lo que pide acción (cobros vencidos). Ancho
          fijo para que nombres y montos alineen en columna entre filas.
        */}
        <span className="inline-flex w-14 shrink-0 items-center gap-1 rounded-md border border-border bg-muted px-1.5 py-1 text-[9px] font-bold uppercase tracking-tight text-foreground">
          <Icon className="size-3" aria-hidden="true" />
          {KIND_LABEL[event.kind]}
        </span>
        <div className="min-w-0 flex-1">
          {/* Sin `truncate`: en la columna de 1/3 un nombre completo no cabe en
              una línea, y cortar el nombre de quien llega es perder el dato. */}
          <p className="text-xs leading-snug font-semibold break-words text-foreground">
            {event.clientName}
          </p>
          <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
            <PropertyDot color={event.propertyColor} />
            <p className="truncate text-[10px] text-muted-foreground">
              {event.propertyName} · {durationLabel(event)}
              {unitsSuffix}
            </p>
          </div>
          {/* Solo DAILY: en un arriendo por noches es el dato que se coordina
              (hasta cuándo duerme). Va en su propia línea para no cortar la de
              propiedad y noches en la columna angosta. */}
          {event.billingType === "DAILY" && (
            <p className="mt-0.5 text-[10px] tabular-nums text-muted-foreground">
              Última noche {relativeDayInline(event.lastNightDateKey, todayKey)}
            </p>
          )}
        </div>
        {event.amountDue > 0 && (
          <div className="shrink-0 text-right">
            <p className="text-xs font-semibold tabular-nums text-foreground">
              {formatCLP(event.amountDue)}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {event.hasNoPayments ? "sin pagos" : "saldo"}
            </p>
          </div>
        )}
      </ReservationPreviewLink>
    </li>
  );
}
