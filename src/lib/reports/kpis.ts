/**
 * KPIs puros de reportes — seam de lógica de dominio.
 *
 * Estas funciones son PURAS (sin efectos secundarios, sin mutations).
 * No dependen de Prisma ni de session. Aceptan inputs serializables.
 *
 * Decisiones de dominio documentadas:
 * - `clipNightsToRange` — intersección inclusiva de fechas para calcular
 *   noches occupationadas dentro de un rango.
 * - `sumCollectionTotals` — opera sobre el conjunto completo (no paginado).
 * - `isReportsRangeAllowed` — determina si un plan puede acceder a un rango rápido.
 * - `portfolioOccupancyDenominator` — unidades totales del scope (todas las propiedades
 *   del owner, no solo las que tienen reservas en el período).
 * - `prorateRevenueToRange` — prorratea `totalPrice` de una reserva DAILY por
 *   noches dentro de un rango (exacto, no estimación — ver CONTEXT.md "Precio").
 * - `prorateMonthlyRevenueToRange` — prorratea `totalPrice` de una reserva
 *   MONTHLY por CUOTAS (mes calendario), no por noches — el precio mensual
 *   no es lineal por noche (ver CONTEXT.md "Precio" y JSDoc de la función).
 */

import { getInclusiveMonths } from "@/lib/reservation-dates";

export type QuickRange = "current_month" | "prev_month" | "last_3" | "last_6" | "year_to_date" | "custom";

/**
 * Verifica si el plan tiene permiso para usar un rango rápido dado.
 * Plan FREE solo puede acceder a `current_month`.
 */
export function isReportsRangeAllowed(
  plan: string | null | undefined,
  range: QuickRange,
): boolean {
  if (plan !== "FREE") return true;
  return range === "current_month";
}

/**
 * Calcula el denominador de ocupación (unidades totales disponibles en scope).
 *
 * - Si `selectedPropertyId` es provided, usa esa propiedad específica.
 * - Si `selectedPropertyId` es "all" o undefined, usa TODAS las propiedades
 *   del owner (no solo las que tienen reservas en el período).
 *
 * Usado en el KPI "Ocupación del portafolio" para evitar inflar la ocupación
 * cuando hay propiedades sin reservas en el rango seleccionado.
 */
export function portfolioOccupancyDenominator(
  properties: Array<{ id: string; unitsAvailable: number }>,
  selectedPropertyId?: string,
): number {
  if (selectedPropertyId && selectedPropertyId !== "all") {
    const prop = properties.find((p) => p.id === selectedPropertyId);
    return prop ? prop.unitsAvailable : 1;
  }
  return properties.reduce((acc, p) => acc + (p.unitsAvailable || 1), 0);
}

/**
 * Calcula las noches (unidades de noche) de una reserva dentro de un rango de fechas,
 * usando intersección inclusiva de fechas date-only (timezone-agnostic).
 *
 * Convenção: startDate = primer noche de la estancia (inclusivo),
 * endDate = última noche de la estancia (inclusivo).
 * both dates are calendar day indices (no timezone).
 *
 * Ejemplo: reserva 15-20 Ene, rango 18-25 Ene
 *   → intersect = [18, 19, 20] → 3 noches
 *
 * Devuelve 0 si no hay intersección.
 */
export function clipNightsToRange(
  reservationStart: Date,
  reservationEnd: Date,
  rangeStart: Date,
  rangeEnd: Date,
): number {
  // Date-only epoch-day arithmetic: extract calendar day indices
  // by rounding to nearest day boundary (handles both UTC and local inputs).
  // This is timezone-agnostic: dates are day indices, not moments in time.
  const resStartDay = Math.floor(reservationStart.getTime() / 86_400_000);
  const resEndDay = Math.floor(reservationEnd.getTime() / 86_400_000);
  const rngStartDay = Math.floor(rangeStart.getTime() / 86_400_000);
  const rngEndDay = Math.floor(rangeEnd.getTime() / 86_400_000);

  // Inclusive intersection: both startDate and endDate are nights stayed.
  const clippedStart = Math.max(resStartDay, rngStartDay);
  const clippedEnd = Math.min(resEndDay, rngEndDay);

  if (clippedStart > clippedEnd) return 0;

  return clippedEnd - clippedStart + 1;
}

/**
 * Calcula la tasa de ocupación para un conjunto de reservas dentro de un rango.
 *
 * @param reservations — array de { startDate, endDate, unitsBooked }
 * @param rangeStart — inicio del período
 * @param rangeEnd — fin del período (inclusivo)
 * @param unitsAvailable — unidades totales disponibles en la propiedad
 * @returns ocupación como fraction (0-1), o 0 si no hay datos
 */
export function calculateOccupancyRate(
  reservations: Array<{ startDate: Date; endDate: Date; unitsBooked: number }>,
  rangeStart: Date,
  rangeEnd: Date,
  unitsAvailable: number,
): number {
  // Date-only total days: timezone-agnostic epoch-day arithmetic
  const rangeStartDay = Math.floor(rangeStart.getTime() / 86_400_000);
  const rangeEndDay = Math.floor(rangeEnd.getTime() / 86_400_000);
  const totalDays = rangeEndDay - rangeStartDay + 1;
  if (totalDays <= 0 || unitsAvailable <= 0) return 0;

  let totalNightUnits = 0;
  for (const res of reservations) {
    const nights = clipNightsToRange(res.startDate, res.endDate, rangeStart, rangeEnd);
    totalNightUnits += nights * res.unitsBooked;
  }

  const maxPossibleNightUnits = totalDays * unitsAvailable;
  if (maxPossibleNightUnits === 0) return 0;

  return Math.min(totalNightUnits / maxPossibleNightUnits, 1);
}

/**
 * Prorratea el `totalPrice` de una reserva DAILY por las noches que caen
 * dentro de un rango (ej: el mes visible en `/calendar`).
 *
 * Es EXACTO, no una estimación: para `billingType: DAILY`,
 * `totalPrice = noches × daily_price × unitsBooked` (CONTEXT.md, sección
 * "Precio") — el precio es lineal por noche, así que la fracción de noches
 * dentro del rango reproduce el mismo monto que se habría facturado si la
 * reserva hubiera cubierto solo esas noches.
 *
 * El denominador (noches totales de la reserva) se calcula reutilizando
 * `clipNightsToRange` con la reserva como su propio rango — evita duplicar
 * la aritmética de "última noche inclusiva" (ver `getNights` / CONTEXT.md).
 *
 * @param totalPrice — precio total de la reserva completa
 * @param reservationStart — inicio de la reserva (inclusivo)
 * @param reservationEnd — última noche de la reserva (inclusivo)
 * @param rangeStart — inicio del rango a prorratear
 * @param rangeEnd — fin del rango a prorratear (inclusivo)
 * @returns la porción de `totalPrice` correspondiente a las noches dentro
 *   del rango. Devuelve 0 si la reserva no tiene noches (datos inválidos,
 *   `reservationEnd < reservationStart`) o si no intersecta el rango.
 */
export function prorateRevenueToRange(
  totalPrice: number,
  reservationStart: Date,
  reservationEnd: Date,
  rangeStart: Date,
  rangeEnd: Date,
): number {
  const totalNights = clipNightsToRange(reservationStart, reservationEnd, reservationStart, reservationEnd);
  if (totalNights <= 0) return 0;

  const nightsInRange = clipNightsToRange(reservationStart, reservationEnd, rangeStart, rangeEnd);
  if (nightsInRange <= 0) return 0;

  return totalPrice * (nightsInRange / totalNights);
}

/**
 * Prorratea el `totalPrice` de una reserva MONTHLY dentro de un rango (ej:
 * el mes visible en `/calendar`), prorrateando por CUOTAS (mes calendario),
 * NO por noches.
 *
 * `prorateRevenueToRange` es exacto solo para DAILY porque ese precio es
 * lineal por noche. En MONTHLY no lo es: `totalPrice = meses inclusivos ×
 * monthly_price × unitsBooked` (CONTEXT.md, sección "Precio") — es un precio
 * fijo por cuota mensual, no por día. Prorratear una mensual por noches da
 * un número plausible y equivocado (ej: febrero, con menos días, rendiría
 * menos que enero por la misma cuota).
 *
 * Lo correcto: dividir `totalPrice` en `getInclusiveMonths(reservationStart,
 * reservationEnd)` cuotas iguales, una por cada mes calendario cubierto,
 * empezando en el mes de `reservationStart` — el mismo esquema que usa
 * `generateMonthlyPayments` para las fechas de vencimiento (ADR-0012: "Sep 1
 * → Sep 1, Oct 1, Nov 1"). El rango recibe la cuota completa de cada mes
 * calendario que solapa `[rangeStart, rangeEnd]`.
 *
 * Caso límite importante: el mes calendario que la reserva TOCA visualmente
 * no siempre es una cuota. Ej: una reserva 20-ago a 5-sep tiene
 * `getInclusiveMonths` = 1 (el día 5 < día 20, así que no completa un segundo
 * mes) → la única cuota vive en agosto. Vista desde septiembre, aunque la
 * barra cruce esos 5 días, el share es 0 — la cuota ya se facturó en agosto.
 * Vista desde agosto, el share es el `totalPrice` completo.
 *
 * @param totalPrice — precio total de la reserva completa
 * @param reservationStart — inicio de la reserva (inclusivo)
 * @param reservationEnd — última noche de la reserva (inclusivo)
 * @param rangeStart — inicio del rango a prorratear
 * @param rangeEnd — fin del rango a prorratear (inclusivo)
 * @returns la porción de `totalPrice` correspondiente a las cuotas cuyo mes
 *   calendario solapa el rango. Devuelve 0 si ninguna cuota cae en el rango.
 */
export function prorateMonthlyRevenueToRange(
  totalPrice: number,
  reservationStart: Date,
  reservationEnd: Date,
  rangeStart: Date,
  rangeEnd: Date,
): number {
  const months = getInclusiveMonths(reservationStart, reservationEnd);
  const perInstallment = totalPrice / months;

  const rangeStartDay = Math.floor(rangeStart.getTime() / 86_400_000);
  const rangeEndDay = Math.floor(rangeEnd.getTime() / 86_400_000);

  const startYear = reservationStart.getFullYear();
  const startMonth = reservationStart.getMonth(); // 0-indexed

  let total = 0;
  for (let i = 0; i < months; i++) {
    const installmentMonthIndex = startMonth + i;
    const installmentYear = startYear + Math.floor(installmentMonthIndex / 12);
    const installmentMonth = ((installmentMonthIndex % 12) + 12) % 12;

    const installmentFirstDay = Math.floor(
      new Date(installmentYear, installmentMonth, 1).getTime() / 86_400_000,
    );
    const installmentLastDay = Math.floor(
      new Date(installmentYear, installmentMonth + 1, 0).getTime() / 86_400_000,
    );

    const overlapsRange = installmentFirstDay <= rangeEndDay && installmentLastDay >= rangeStartDay;
    if (overlapsRange) total += perInstallment;
  }

  return total;
}

/**
 * Agrega los montos pendientes y vencidos de un conjunto de CollectionReportRow
 * (el conjunto COMPLETO, no una página).
 *
 * Usado por los KPIs "Total por cobrar" y "Cobros vencidos" en el frontend.
 * NUNCA debe operar sobre rows paginados — siempre pasar el total de filas filtradas.
 */
export function sumCollectionTotals(
  rows: Array<{ pending: number; extrasPending: number; overdue: number }>,
): { totalToCollect: number; totalOverdue: number; pendingInvoices: number } {
  let totalToCollect = 0;
  let totalOverdue = 0;
  let pendingInvoices = 0;

  for (const row of rows) {
    const rowTotal = row.pending + row.extrasPending;
    totalToCollect += rowTotal;
    totalOverdue += row.overdue;
    if (rowTotal > 0) pendingInvoices += 1;
  }

  return { totalToCollect, totalOverdue, pendingInvoices };
}
