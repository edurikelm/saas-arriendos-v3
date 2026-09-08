/**
 * Lane stacking para el timeline de `/calendar`: coloca cada reserva de una
 * fila (propiedad) en el primer carril libre, en vez de apilar todas las
 * barras en `top: 12px` como hacía el código viejo. Sin este cálculo, dos
 * reservas simultáneas de la misma propiedad se dibujan una encima de la
 * otra y una queda inclickeable (ver PR de lane stacking).
 *
 * Algoritmo: greedy por fecha de inicio. Se ordena por `startDate` y cada
 * reserva se coloca en el primer carril cuyo último ocupante **termine
 * antes** de que esta empiece.
 *
 * Convención de fechas (CONTEXT.md): `endDate` es la ÚLTIMA NOCHE (inclusivo),
 * no el día de checkout. Dos reservas con `prev.endDate === next.startDate`
 * comparten esa noche y por lo tanto SE SOLAPAN — van en carriles distintos.
 * El chequeo usa `occupantEnd < itemStart` (estrictamente antes), no `<=`.
 */

export interface TimelineLaneInput {
  startDate: string;
  endDate: string;
}

export interface TimelineLaneEntry<T> {
  item: T;
  /** Offset en días desde `windowStart`, recortado a `[0, windowLength - 1]`. */
  leftOffset: number;
  /** Cantidad de días visibles dentro de la ventana `[windowStart, windowStart + windowLength)`. */
  duration: number;
  /** Índice de carril (0-based) asignado a este item. */
  lane: number;
}

export interface TimelineLaneResult<T> {
  entries: TimelineLaneEntry<T>[];
  /** Cantidad total de carriles usados por la fila (>= 1 si hay items, 0 si la lista está vacía). */
  laneCount: number;
}

/**
 * Parsea una fecha `YYYY-MM-DD` como date-only local (sin componente horario,
 * sin desfase de timezone). Réplica intencional de `parseCalendarDate` en
 * `calendar-timeline.tsx` — mismo contrato, módulo separado para mantener
 * este seam sin dependencias del componente.
 */
function parseCalendarDate(dateString: string): Date {
  const [year, month, day] = dateString.slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day);
}

function getDayOffset(date: Date, windowStart: Date): number {
  return Math.floor((date.getTime() - windowStart.getTime()) / (1000 * 60 * 60 * 24));
}

export function assignTimelineLanes<T extends TimelineLaneInput>(
  items: T[],
  windowStart: Date,
  windowLength: number,
): TimelineLaneResult<T> {
  const sorted = [...items].sort(
    (a, b) => parseCalendarDate(a.startDate).getTime() - parseCalendarDate(b.startDate).getTime(),
  );

  // Último `endDate` (timestamp) ocupado por cada carril, en orden de asignación.
  const laneEndTimes: number[] = [];
  const entries: TimelineLaneEntry<T>[] = [];

  for (const item of sorted) {
    const start = parseCalendarDate(item.startDate);
    const end = parseCalendarDate(item.endDate);
    const startTime = start.getTime();

    let lane = laneEndTimes.findIndex((endTime) => endTime < startTime);
    if (lane === -1) {
      lane = laneEndTimes.length;
      laneEndTimes.push(end.getTime());
    } else {
      laneEndTimes[lane] = end.getTime();
    }

    const leftOffset = Math.max(0, getDayOffset(start, windowStart));
    const rightOffset = Math.min(windowLength - 1, getDayOffset(end, windowStart));
    const duration = rightOffset - leftOffset + 1;

    entries.push({ item, leftOffset, duration, lane });
  }

  return { entries, laneCount: laneEndTimes.length };
}

// --- Geometría de la fila ---------------------------------------------------
//
// Restricción dura: una fila de UN carril debe medir exactamente 76px (el
// alto que ya tenía la Timeline antes de lane stacking), para no cambiar el
// aspecto del caso común (una sola reserva por propiedad y momento).
//
//   ┌─ ROW_BOTTOM_PADDING (32px, respiro debajo del último carril)
//   │
//   │  carril N-1  ┐
//   │     ⋮        ├─ laneStackHeight(N) = N·LANE_HEIGHT + (N-1)·LANE_GAP
//   │  carril 0    ┘
//   │
//   └─ LANE_TOP_OFFSET (12px, tope del primer carril — igual que el `top: 12px` original)
//
// timelineRowContentHeight(1) = 12 + 32 + 32 = 76px ✓ (invariante verificada en tests)
//
// La sub-fila de bloqueos externos va SIEMPRE debajo de todos los carriles:
// `externalBlocksRowTop(N) = LANE_TOP_OFFSET + laneStackHeight(N) + EXT_ROW_GAP`.
// Por construcción, `externalBlocksRowTop(N) + EXT_BLOCK_HEIGHT === timelineRowContentHeight(N)`
// (EXT_ROW_GAP + EXT_BLOCK_HEIGHT === ROW_BOTTOM_PADDING, 8 + 24 = 32), así que el
// borde inferior de un bloqueo externo siempre coincide con el borde inferior del
// contenido de la fila, sin importar cuántos carriles haya.

/** Alto de cada barra de reserva (`h-8` en Tailwind). */
export const LANE_HEIGHT = 32;
/** Top del primer carril — igual al `top: "12px"` que tenían todas las barras antes de lane stacking. */
export const LANE_TOP_OFFSET = 12;
/** Espacio vertical entre carriles apilados. */
export const LANE_GAP = 4;
/** Respiro debajo del último carril (también usado para alinear el borde inferior de la sub-fila externa). */
export const ROW_BOTTOM_PADDING = 32;
/** Espacio entre el último carril y la sub-fila de bloqueos externos. */
export const EXT_ROW_GAP = 8;
/** Alto de cada barra de bloqueo externo (`h-6` en Tailwind). */
export const EXT_BLOCK_HEIGHT = 24;
/** Alto extra que se suma a la fila cuando hay bloqueos externos (además del contenido de carriles). */
export const EXT_ROW_EXTRA_HEIGHT = 32;

/** Alto total ocupado por los carriles apilados (sin top offset ni padding). */
export function laneStackHeight(laneCount: number): number {
  const count = Math.max(1, laneCount);
  return count * LANE_HEIGHT + (count - 1) * LANE_GAP;
}

/** Top (px) del carril `laneIndex` (0-based) dentro de la fila. */
export function laneTop(laneIndex: number): number {
  return LANE_TOP_OFFSET + laneIndex * (LANE_HEIGHT + LANE_GAP);
}

/** Alto del contenido de la fila (carriles + padding), sin contar bloqueos externos. */
export function timelineRowContentHeight(laneCount: number): number {
  return LANE_TOP_OFFSET + laneStackHeight(laneCount) + ROW_BOTTOM_PADDING;
}

/** Top (px) de la sub-fila de bloqueos externos, siempre debajo de todos los carriles. */
export function externalBlocksRowTop(laneCount: number): number {
  return LANE_TOP_OFFSET + laneStackHeight(laneCount) + EXT_ROW_GAP;
}

/** Alto total de la fila, incluyendo la sub-fila de bloqueos externos si corresponde. */
export function timelineRowHeight(laneCount: number, hasExternalBlocks: boolean): number {
  return timelineRowContentHeight(laneCount) + (hasExternalBlocks ? EXT_ROW_EXTRA_HEIGHT : 0);
}
