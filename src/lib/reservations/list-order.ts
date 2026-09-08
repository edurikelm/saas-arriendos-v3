/**
 * Orden y paginación de la lista de `/reservations`.
 *
 * **El problema que resuelve.** La lista se ordenaba por `startDate desc`, o sea
 * por cuándo *empezó* la reserva. Medido contra producción (2026-09-07): los dos
 * arriendos mensuales vigentes quedaban en las posiciones 5 y 6, debajo de tres
 * reservas diarias ya terminadas. No era un problema de "mensual vs diaria" —
 * una diaria larga se hunde igual, y una reserva cancelada con fecha futura
 * aparecía por encima de un arriendo en curso. El orden no miraba si la reserva
 * seguía viva.
 *
 * **El orden nuevo.** Dos buckets con el corte exactamente en hoy (día
 * calendario en `America/Santiago`):
 *
 * - **Vivo** — `endDate >= hoy` **y** el estado no es CANCELLED ni COMPLETED:
 *   lo que se acaba antes, primero. Un check-out mañana pide atención antes que
 *   un contrato que corre hasta marzo.
 * - **Terminado** — todo lo demás: lo más recién terminado, primero.
 *
 * **El estado entra en la definición, no solo la fecha.** Con el corte puramente
 * temporal, una reserva cancelada con fechas futuras se ordenaba entre las
 * vigentes — el mismo ruido que tenía el orden viejo. Los dos buckets coinciden
 * exactamente con lo que muestra la columna Estado (`getTemporalStatus`):
 * "Activa"/"Próxima" arriba, "Finalizada"/"Cancelada" abajo. Que el orden y la
 * columna discrepen sería peor que cualquiera de los dos criterios por separado.
 *
 * Dentro de lo vivo el corte por fecha sigue siendo limpio: cualquier
 * `endDate >= hoy` es posterior a cualquier `endDate < hoy`, así que no hace
 * falta un `CASE` para separarlos. Eso permite expresarlo con dos queries de Prisma
 * en vez de SQL crudo, y por lo tanto reusar el mismo `where` y los mismos
 * `include` en vez de duplicar la construcción de filtros en dos lenguajes.
 *
 * **Desempate por `id`.** Antes no había ninguno, y en producción dos reservas
 * comparten `startDate`. Sin criterio de desempate, Postgres puede devolverlas
 * en distinto orden entre consultas, y con `OFFSET/LIMIT` eso hace que una fila
 * se repita o se salte al cambiar de página.
 */

import { nowKeyInBusinessTz } from "@/lib/domain/timezone";

export type ReservationTemporal = "active" | "upcoming" | "past" | "all";

export function normalizeTemporal(value?: string | null): ReservationTemporal {
  return value === "active" || value === "upcoming" || value === "past" ? value : "all";
}

/**
 * Filtro de cobranza. Las dos opciones son las que Prisma puede expresar como
 * filtro de relación sobre `payments`, y por lo tanto resolver en el servidor.
 *
 * La versión anterior ofrecía "Pagado" / "Pendiente" / "Exceso" y se aplicaba en
 * el cliente sobre las ≤10 filas ya cargadas: filtrar "Pendiente" desde la
 * página 1 no veía nada de la página 2. Esas tres comparan la suma de pagos
 * contra `totalPrice`, que es un agregado y no se puede filtrar en la base sin
 * denormalizar. "Exceso", además, no ocurre nunca en producción.
 *
 * - `unpaid`: ningún pago de arriendo cobrado.
 * - `overdue`: alguna cuota sin cobrar con vencimiento pasado — el mismo criterio
 *   que pinta el monto en rojo en la columna "Por cobrar".
 */
export type ReservationPaymentFilter = "unpaid" | "overdue" | "all";

export function normalizePaymentFilter(value?: string | null): ReservationPaymentFilter {
  return value === "unpaid" || value === "overdue" ? value : "all";
}

/**
 * Límites del día de negocio como instantes UTC.
 *
 * `startDate` / `endDate` son fechas date-only del dominio (CONTEXT.md) que el
 * backend guarda a las 15:00/16:00 UTC — nunca a medianoche. Comparar contra la
 * medianoche UTC del día calendario en `America/Santiago` clasifica bien
 * cualquier hora del día: una reserva que termina hoy sigue siendo "viva"
 * (hoy es su última noche), y una que terminó ayer cae en "terminado".
 */
export function businessDayBounds(nowKey: string = nowKeyInBusinessTz()): {
  startOfToday: Date;
  startOfTomorrow: Date;
} {
  const startOfToday = new Date(`${nowKey}T00:00:00.000Z`);
  return {
    startOfToday,
    startOfTomorrow: new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000),
  };
}

export interface BucketRange {
  skip: number;
  take: number;
}

export interface BucketSlice {
  /** Qué tramo pedirle al bucket vivo, o `null` si la página no lo toca. */
  live: BucketRange | null;
  /** Qué tramo pedirle al bucket terminado, o `null`. */
  past: BucketRange | null;
}

/**
 * Reparte una página (`skip`/`limit`) entre los dos buckets concatenados.
 *
 * Los buckets se sirven como una sola lista: primero todo lo vivo, después todo
 * lo terminado. Una página puede caer entera en uno, o cruzar el límite y
 * necesitar la cola de uno más la cabeza del otro.
 */
export function sliceBuckets(skip: number, limit: number, liveCount: number): BucketSlice {
  const liveTake = Math.min(Math.max(liveCount - skip, 0), limit);
  const remaining = limit - liveTake;

  return {
    live: liveTake > 0 ? { skip, take: liveTake } : null,
    past: remaining > 0 ? { skip: Math.max(skip - liveCount, 0), take: remaining } : null,
  };
}
