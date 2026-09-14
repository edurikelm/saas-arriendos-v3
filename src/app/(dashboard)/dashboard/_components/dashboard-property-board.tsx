import Link from "next/link";
import type {
  DashboardExternalChannel,
  DashboardPropertyBoard as DashboardPropertyBoardData,
  DashboardPropertyStatus,
} from "@/lib/dashboard/summary";
import { relativeDayInline, shortDate } from "./day-labels";

const CHANNEL_LABEL: Record<DashboardExternalChannel, string> = {
  AIRBNB: "Airbnb",
  BOOKING_COM: "Booking.com",
  VRBO: "VRBO",
  OTHER: "Otro canal",
};

interface StatusParts {
  /** Palabra de estado. Solo "Libre" y "Sobreventa" van destacadas. */
  lead: string;
  detail: string | null;
  tone: "free" | "busy" | "overbooked";
}

/**
 * Traduce el estado de una propiedad a la frase de su fila. Con una sola
 * unidad —el caso de casi todas— la frase nombra al ocupante ("Mensual ·
 * hasta 30 sept"); con varias, cuenta unidades, porque "sale vie 18" en una
 * propiedad con tres huéspedes no dice cuál.
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

  const releaseDay = relativeDayInline(nextRelease.releaseDateKey, todayKey);

  if (unitsAvailable > 1) {
    return {
      lead: state === "OCCUPIED" ? "Completa" : `${unitsOccupied} de ${unitsAvailable} ocupadas`,
      detail: `próxima salida ${releaseDay}`,
      tone: "busy",
    };
  }

  if (nextRelease.source === "EXTERNAL_BLOCK") {
    return {
      lead: nextRelease.channel ? CHANNEL_LABEL[nextRelease.channel] : "Bloqueo externo",
      detail: `hasta ${shortDate(nextRelease.lastNightKey, todayKey)}`,
      tone: "busy",
    };
  }

  if (nextRelease.billingType === "MONTHLY") {
    return {
      lead: "Mensual",
      detail: `hasta ${shortDate(nextRelease.lastNightKey, todayKey)}`,
      tone: "busy",
    };
  }

  return { lead: "Ocupada", detail: `sale ${releaseDay}`, tone: "busy" };
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
 * hasta cuándo, o desde cuándo vuelve a estar ocupada.
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
