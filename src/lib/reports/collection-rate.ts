/**
 * Tasa de cobranza del período — pure helper.
 *
 * Deliberadamente compara dos bases contables distintas:
 *  - Numerador: `collectedCash` — caja del rango, por `paidAt` (cuándo entró
 *    el dinero).
 *  - Denominador: `accruedRevenue` — devengado del rango, prorrateado por
 *    noches (DAILY) o cuotas de mes calendario (MONTHLY).
 *
 * No son la misma base contable, así que el resultado puede superar 100%
 * (un prepago cobrado en el rango cuenta como caja aunque su devengo caiga en
 * un rango futuro). Esta función NO clampea — el valor real se muestra tal
 * cual, y la UI es responsable de explicar la diferencia de bases.
 */
export interface CollectionRateResult {
  /** Porcentaje real, sin clampear. `null` cuando no hay denominador (división por cero). */
  pct: number | null;
}

export function computeCollectionRate(
  collectedCash: number,
  accruedRevenue: number,
): CollectionRateResult {
  if (accruedRevenue <= 0) return { pct: null };
  return { pct: Math.round((collectedCash / accruedRevenue) * 100) };
}
