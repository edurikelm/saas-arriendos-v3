/**
 * Calcula el `scrollLeft` objetivo para el timeline horizontal del calendario,
 * de forma que la columna de "hoy" quede visible al montar (o al cambiar de
 * mes) en vez de arrancar en `scrollLeft = 0` con hoy fuera de vista en
 * viewports angostos (mobile/tablet). Puro — no toca el DOM; el caller
 * (`CalendarTimeline`) es quien asigna el resultado a `container.scrollLeft`.
 *
 * Geometría (coordenadas de contenido, no de pantalla):
 *
 *   [ columna propiedad (sticky, ancho W) ][ día 0 ][ día 1 ] ... [ día N-1 ]
 *
 * El día `i` ocupa `[W + i*dayWidth, W + (i+1)*dayWidth]`. La columna de
 * propiedad es `sticky left-0`, así que siempre tapa la franja de PANTALLA
 * `[0, W]`, sin importar cuánto se haya scrolleado.
 *
 * Para que el día `i` quede completamente visible se necesitan dos cotas
 * sobre `scrollLeft`:
 *   - `scrollLeft <= i * dayWidth` — el día no queda tapado por la sticky.
 *   - `scrollLeft >= W + (i+1) * dayWidth - clientWidth` — el día no queda
 *     cortado por el borde derecho del viewport.
 *
 * El target ideal es "hoy con contexto antes" (`CONTEXT_DAYS_BEFORE_TODAY`),
 * clampeado a esas dos cotas y luego al rango scrolleable real
 * `[0, contentWidth - clientWidth]`.
 *
 * Caso degenerado: si `clientWidth < propertyColumnWidth + dayWidth`, las dos
 * cotas se cruzan — no existe ningún `scrollLeft` que muestre el día completo
 * sin tapar nada. En ese caso el clamp `[lowerBound, upperBound]` colapsa
 * siempre a `upperBound` (no tapado por la sticky), sin importar el target
 * ideal: un día parcialmente cortado por la derecha sigue siendo mejor que
 * uno invisible detrás de la columna sticky.
 */

export interface ComputeScrollLeftForTodayParams {
  /**
   * Índice 0-based de "hoy" dentro de los días del mes mostrado.
   * `null` o negativo (p.ej. `-1`) cuando el mes mostrado no contiene hoy.
   */
  todayIndex: number | null;
  /** Ancho de cada columna de día, en px. */
  dayWidth: number;
  /** Ancho de la columna sticky de propiedad, en px. */
  propertyColumnWidth: number;
  /** Ancho visible del contenedor con scroll (`container.clientWidth`), en px. */
  clientWidth: number;
  /** Ancho total del contenido scrolleable (columna propiedad + todos los días), en px. */
  contentWidth: number;
}

/** Días de contexto que se dejan visibles antes de la columna de hoy. */
const CONTEXT_DAYS_BEFORE_TODAY = 2;

export function computeScrollLeftForToday({
  todayIndex,
  dayWidth,
  propertyColumnWidth,
  clientWidth,
  contentWidth,
}: ComputeScrollLeftForTodayParams): number {
  if (todayIndex === null || todayIndex < 0) return 0;

  const maxScrollLeft = Math.max(0, contentWidth - clientWidth);
  if (maxScrollLeft === 0) return 0; // todo el mes cabe en el viewport, no hace falta scrollear

  // Cota superior: scrollLeft <= i*dayWidth (no tapado por la columna sticky).
  const upperBound = todayIndex * dayWidth;
  // Cota inferior: scrollLeft >= W + (i+1)*dayWidth - clientWidth (no cortado por la derecha).
  const lowerBound = propertyColumnWidth + (todayIndex + 1) * dayWidth - clientWidth;
  // Target ideal: hoy con un par de días de contexto antes, no pegado al borde.
  const desired = (todayIndex - CONTEXT_DAYS_BEFORE_TODAY) * dayWidth;

  // Clamp a [lowerBound, upperBound]. Si las cotas se cruzan (viewport angosto,
  // ver doc arriba), este orden de clamp (max primero, min después) colapsa
  // siempre a `upperBound` — la prioridad elegida para el caso degenerado,
  // sin importar `desired`.
  const withinVisibilityBounds = Math.min(Math.max(desired, lowerBound), upperBound);

  return Math.round(Math.min(Math.max(withinVisibilityBounds, 0), maxScrollLeft));
}
