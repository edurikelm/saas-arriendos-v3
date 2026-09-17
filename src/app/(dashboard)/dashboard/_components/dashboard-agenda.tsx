import Link from "next/link";
import { CalendarCheck, LogIn, LogOut } from "lucide-react";
import { formatCLP } from "@/lib/format/currency";
import type {
  DashboardAgenda as DashboardAgendaData,
  DashboardAgendaDay,
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

/**
 * Filas que muestra la agenda antes de mandar el resto al calendario. El mismo
 * tope que "Cobros pendientes" (`DEFAULT_COLLECTION_LIMIT`): las dos cards van
 * lado a lado y miden lo mismo, y sin tope una semana cargada estiraba la
 * agenda a más del doble que cobros (1106px contra 626px a 1280, medido) y
 * empujaba el mes fuera de la primera pantalla.
 */
export const AGENDA_ROW_LIMIT = 6;

export interface AgendaCut {
  days: DashboardAgendaDay[];
  hiddenCount: number;
  hiddenDays: DashboardAgendaDay[];
}

/**
 * Qué días entran bajo el tope. Hoy y mañana van siempre completos —son los
 * que se atienden—; después, días ENTEROS mientras quepan, en orden. Un día
 * nunca se parte: "lunes 21" con dos de sus tres llegadas diría que ese día
 * tiene dos. El primer día con movimientos entra aunque solo pase del tope,
 * para que una agenda con eventos nunca quede vacía.
 */
export function cutAgendaDays(days: DashboardAgendaDay[], limit = AGENDA_ROW_LIMIT): AgendaCut {
  const shown: DashboardAgendaDay[] = [];
  let count = 0;
  for (const day of days) {
    if (day.offset > 1 && count > 0 && count + day.events.length > limit) break;
    shown.push(day);
    count += day.events.length;
  }
  const hiddenDays = days.slice(shown.length);
  const hiddenCount = hiddenDays.reduce((sum, day) => sum + day.events.length, 0);
  return { days: shown, hiddenCount, hiddenDays };
}

function durationLabel(event: DashboardAgendaEvent): string {
  if (event.billingType === "MONTHLY") {
    return `${event.months} ${event.months === 1 ? "mes" : "meses"}`;
  }
  return `${event.nights} ${event.nights === 1 ? "noche" : "noches"}`;
}

/**
 * Tercera línea de la fila: lo que se coordina con quien llega.
 *
 * Una llegada lleva duración, unidades si son varias y, en DAILY, la última
 * noche (hasta cuándo duerme). Una salida lleva solo las unidades si son
 * varias —cuántas hay que preparar—: su última noche es siempre la víspera
 * de la salida y su duración ya no se coordina, así que las dos repetían lo
 * que la fila ya dice. `null` si no queda nada que decir.
 */
function detailLabel(event: DashboardAgendaEvent, todayKey: string): string | null {
  const units = event.unitsBooked > 1 ? `${event.unitsBooked} unidades` : null;
  if (event.kind === "DEPARTURE") return units;

  const lastNight =
    event.billingType === "DAILY"
      ? `última noche ${relativeDayInline(event.lastNightDateKey, todayKey)}`
      : null;
  return [durationLabel(event), units, lastNight].filter(Boolean).join(" · ");
}

interface DashboardAgendaProps {
  agenda: DashboardAgendaData;
  todayKey: string;
}

/**
 * Agenda del inicio: quién llega y quién sale, día por día, en los próximos
 * `horizonDays` días, hasta `AGENDA_ROW_LIMIT` filas.
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
  const cut = cutAgendaDays(agenda.days);
  const lastHidden = cut.hiddenDays.at(-1);

  return (
    <DashboardSection
      headingId="agenda-heading"
      title="Agenda"
      meta={`Llegadas y salidas · próximos ${agenda.horizonDays} días`}
      action={{ href: "/reservations", label: "Ver reservas" }}
    >
      {hasEvents ? (
        <>
          <div>
            {cut.days.map((day, dayIdx) => {
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
                    {day.events.length === 0 && (
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
          {/* Mismo pie que "+N cobros más" en Cobros pendientes: dice cuánto
              quedó fuera y lleva a donde se ve completo. `mt-auto` lo baja al
              fondo cuando la card se estira al alto de cobros. */}
          {cut.hiddenCount > 0 && lastHidden && (
            <Link
              href="/calendar"
              className="mt-auto block border-t border-border px-4 py-2 text-[10px] font-bold tabular-nums text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground focus-visible:bg-muted/40 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[color:var(--foreground)]!"
            >
              +{cut.hiddenCount} {cut.hiddenCount === 1 ? "movimiento" : "movimientos"} más ·{" "}
              {cut.hiddenDays.length === 1 ? "el" : "hasta el"}{" "}
              {relativeDayInline(lastHidden.dateKey, todayKey)}
            </Link>
          )}
        </>
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
  const detail = detailLabel(event, todayKey);
  const hasAmount = event.amountDue > 0;

  return (
    <li>
      {/* Click simple: el preview de `/calendar`. Ctrl+click o sin JS: la página. */}
      <ReservationPreviewLink
        reservationId={event.reservationId}
        className="flex items-start gap-3 px-4 py-2.5 transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[color:var(--foreground)]!"
      >
        {/*
          Llegada y salida se distinguen por palabra e ícono, no por color: el
          color del inicio queda para lo que pide acción (cobros vencidos). Sin
          borde: era el único dentro de las filas y se repetía en cada una. El
          fondo es `bg-foreground/5` y no `bg-muted`: sin el borde, en oscuro
          `--muted` queda más oscuro que la card por un pelo y el chip perdía la
          forma. Ancho fijo para que nombres y montos alineen en columna.
        */}
        <span className="mt-px inline-flex w-14 shrink-0 items-center gap-1 rounded-md bg-foreground/5 px-1.5 py-1 text-[9px] font-bold uppercase tracking-tight text-foreground">
          <Icon className="size-3" aria-hidden="true" />
          {KIND_LABEL[event.kind]}
        </span>
        {/*
          Tres líneas con el mismo esqueleto que una fila de cobros: nombre y
          monto arriba, propiedad abajo, y el detalle al final a todo el ancho.
          Antes el monto ocupaba su propia columna a la altura de las tres
          líneas, y en la columna de 1/3 la línea "propiedad · noches ·
          unidades" se truncaba en 8 de 12 filas: se perdían justo las noches o
          cuántas unidades preparar.
        */}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            {/* Sin `truncate`: cortar el nombre de quien llega es perder el dato. */}
            <p className="min-w-0 text-xs leading-snug font-semibold break-words text-foreground">
              {event.clientName}
            </p>
            {hasAmount && (
              <p className="shrink-0 text-xs font-semibold tabular-nums text-foreground">
                {formatCLP(event.amountDue)}
              </p>
            )}
          </div>
          <div className="mt-0.5 flex items-center justify-between gap-3">
            <p className="flex min-w-0 items-center gap-1.5 text-[10px] text-muted-foreground">
              <PropertyDot color={event.propertyColor} />
              <span className="truncate">{event.propertyName}</span>
            </p>
            {hasAmount && (
              <p className="shrink-0 text-[10px] text-muted-foreground">
                {event.hasNoPayments ? "sin pagos" : "saldo"}
              </p>
            )}
          </div>
          {detail && (
            <p className="mt-0.5 text-[10px] tabular-nums text-muted-foreground">{detail}</p>
          )}
        </div>
      </ReservationPreviewLink>
    </li>
  );
}
