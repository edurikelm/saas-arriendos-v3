import Link from "next/link";
import type {
  DashboardExternalChannel,
  DashboardPropertyBoard as DashboardPropertyBoardData,
  DashboardPropertyStatus,
} from "@/lib/dashboard/summary";
import { relativeDayInline } from "./day-labels";

const CHANNEL_LABEL: Record<DashboardExternalChannel, string> = {
  AIRBNB: "Airbnb",
  BOOKING_COM: "Booking.com",
  VRBO: "VRBO",
  OTHER: "Otro canal",
};

interface StatusParts {
  /**
   * Palabra de estado. Solo van destacados lo que se puede arrendar hoy
   * ("Libre", "1 libre") y la sobreventa.
   */
  lead: string;
  detail: string | null;
  tone: "free" | "busy" | "overbooked";
}

/**
 * Traduce el estado de una propiedad a la frase de su fila.
 *
 * Toda fecha de una propiedad ocupada es el día en que se puede volver a
 * arrendar ("libre desde vie 18"), nunca la última noche. Antes convivían dos
 * referencias en la misma columna: "sale vie 18" nombraba el día de salida y
 * "hasta 30 sept", la última noche. Además, "sale vie 18" se leía como "el 18
 * todavía está ocupada", cuando ese día ya puede llegar otro huésped: la
 * disponibilidad se cuenta por noches. La salida sigue en la agenda, que es
 * donde se atiende.
 *
 * Con una sola unidad —el caso de casi todas— la frase nombra al ocupante.
 * Con varias cuenta unidades: "libre desde" no puede decir cuántas se liberan
 * ese día, porque de los ocupantes solo se conoce el que sale primero.
 */
function statusParts(property: DashboardPropertyStatus, todayKey: string): StatusParts {
  const { state, unitsOccupied, unitsAvailable, nextRelease, nextArrival } = property;

  if (unitsOccupied > unitsAvailable) {
    return {
      lead: "Sobreventa",
      detail: `${unitsOccupied} ocupaciones para ${unitsAvailable} ${
        unitsAvailable === 1 ? "unidad" : "unidades"
      }`,
      tone: "overbooked",
    };
  }

  if (state === "FREE" || !nextRelease) {
    return {
      lead: "Libre",
      detail: nextArrival ? `llega ${relativeDayInline(nextArrival.dateKey, todayKey)}` : null,
      tone: "free",
    };
  }

  // `releaseDateKey` ya es la última noche + 1: el día que se puede arrendar.
  const freeFrom = `libre desde ${relativeDayInline(nextRelease.releaseDateKey, todayKey)}`;

  if (unitsAvailable > 1) {
    // Con unidades libres hoy, la propiedad ya se puede arrendar: lo que
    // importa es cuántas, no cuándo sale el próximo.
    if (state === "PARTIAL") {
      const free = unitsAvailable - unitsOccupied;
      return {
        lead: `${free} ${free === 1 ? "libre" : "libres"}`,
        detail: `${unitsOccupied} de ${unitsAvailable} ocupadas`,
        tone: "free",
      };
    }
    return { lead: "Completa", detail: freeFrom, tone: "busy" };
  }

  if (nextRelease.source === "EXTERNAL_BLOCK") {
    return {
      lead: nextRelease.channel ? CHANNEL_LABEL[nextRelease.channel] : "Bloqueo externo",
      detail: freeFrom,
      tone: "busy",
    };
  }

  if (nextRelease.billingType === "MONTHLY") {
    return { lead: "Mensual", detail: freeFrom, tone: "busy" };
  }

  return { lead: "Ocupada", detail: freeFrom, tone: "busy" };
}

// La sobreventa va en ámbar y no en rojo: es el mismo tono que usa la alarma de
// `/calendar`, donde el ámbar quedó reservado para lo accionable (pendiente y
// sobreventa). En rojo diría otra cosa que en el calendario.
const LEAD_CLASS: Record<StatusParts["tone"], string> = {
  free: "font-bold text-foreground",
  busy: "text-muted-foreground",
  overbooked: "font-bold text-warning-text",
};

interface DashboardPropertyBoardProps {
  board: DashboardPropertyBoardData;
  todayKey: string;
}

/**
 * Tablero de propiedades: una línea por propiedad con quién la ocupa hoy y
 * desde qué día se puede volver a arrendar, o, si está libre, cuándo llega el
 * próximo huésped.
 *
 * Es el trabajo que prometía la franja de ocupación y no cumplía: esa franja
 * mostraba solo las propiedades con reservas diarias en el rango, así que
 * escondía justo las libres y las arrendadas por mes. Acá están todas, y
 * "¿tengo algo para el fin de semana?" se contesta leyendo. La grilla por día
 * sigue en `/calendar`.
 *
 * Cuenta los bloqueos de canales externos igual que la disponibilidad: una
 * propiedad bloqueada por Airbnb no está libre aunque no tenga reservas.
 */
export function DashboardPropertyBoard({ board, todayKey }: DashboardPropertyBoardProps) {
  const unitNoun = board.allSingleUnit ? "ocupadas hoy" : "unidades ocupadas hoy";

  return (
    <section aria-labelledby="propiedades-heading" className="flex h-full flex-col">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2
            id="propiedades-heading"
            className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground"
          >
            Propiedades
          </h2>
          <p className="mt-1 text-[10px] tabular-nums text-muted-foreground">
            <span className="font-bold text-foreground">{board.occupiedUnits}</span> de{" "}
            {board.totalUnits} {unitNoun}
          </p>
        </div>
        <Link
          href="/calendar"
          className="shrink-0 text-[10px] font-bold uppercase text-primary hover:underline"
        >
          Ver calendario
        </Link>
      </div>

      <div className="flex-1 overflow-hidden rounded-md border border-border bg-card">
        <ul className="divide-y divide-border">
          {board.properties.map((property) => {
            const parts = statusParts(property, todayKey);
            return (
              <li key={property.propertyId}>
                <Link
                  href={`/properties/${property.propertyId}`}
                  className="flex items-baseline justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[color:var(--foreground)]!"
                >
                  <span className="min-w-0 truncate text-xs font-bold text-foreground">
                    {property.propertyName}
                  </span>
                  <span className="shrink-0 text-[10px] tabular-nums">
                    <span className={LEAD_CLASS[parts.tone]}>{parts.lead}</span>
                    {parts.detail && (
                      <span className="text-muted-foreground"> · {parts.detail}</span>
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
