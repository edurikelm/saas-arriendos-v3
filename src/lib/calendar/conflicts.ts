/**
 * Detecta días (por propiedad) donde la propiedad está SOBREVENDIDA: la suma de
 * unidades consumidas por reservas activas (no canceladas) y bloqueos externos
 * activos supera `unitsAvailable` de esa propiedad. Usado por la UI para alarmar
 * al owner de un problema operativo real, no de un simple solapamiento visual.
 *
 * Regla de dominio (CONTEXT.md, sección "Calendarios Externos"):
 * - Disponibilidad = suma de `Reservation.unitsBooked` (no canceladas) + 1 por
 *   cada Bloqueo de Canal Externo activo que cubra ese día.
 * - Sobreventa = consumidas(propiedad, día) > unitsAvailable(propiedad).
 *
 * Deliberadamente NO compara solo "¿hay una reserva Y un bloqueo el mismo día?" —
 * esa regla vieja (`computeConflictDates`, removida) ignoraba `propertyId` y
 * unidades, así que marcaba conflicto entre propiedades distintas sin relación
 * alguna, y también marcaba una propiedad de 3 unidades con 1 reserva + 1 bloqueo
 * (0 problema real). Esta función solo alarma cuando de verdad no alcanzan las
 * unidades.
 *
 * Convención de fechas: `endDate` es inclusivo (última noche, no día de checkout).
 * Fechas se comparan como `YYYY-MM-DD` date-only, aceptando `string | Date`.
 *
 * El caller es responsable de filtrar las reservas canceladas antes de llamar
 * (esta función no conoce `status`) y de filtrar bloqueos a solo los activos.
 */
export interface OverbookedDay {
  propertyId: string;
  /** `YYYY-MM-DD`, date-only. */
  date: string;
  /** Unidades consumidas ese día en esa propiedad (reservas + bloqueos). */
  consumed: number;
  /** `unitsAvailable` de la propiedad. */
  capacity: number;
}

function toDateString(d: string | Date): string {
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  return d.slice(0, 10);
}

function accumulate(
  consumedByKey: Map<string, number>,
  propertyId: string,
  startDate: string | Date,
  endDate: string | Date,
  amount: number,
): void {
  const start = new Date(toDateString(startDate));
  const end = new Date(toDateString(endDate));
  // El recorrido va en UTC (`setUTCDate`/`getUTCDate`), NO en hora local.
  // `start`/`end` se anclan a medianoche UTC, y avanzar con `setDate` local
  // rompe en el cambio de hora: en el DST de Chile (6-sep-2026) un día de
  // 23h deja el instante en las 23:00Z del MISMO día, así que el bucle emite
  // ese día dos veces (doble conteo de unidades → alarma falsa) y además
  // pierde el último día del rango. Medido: un rango 01→07 emitía
  // [01,02,03,04,05,06,06] — sin el 07. Avanzar en UTC es inmune al offset local.
  for (let day = new Date(start); day <= end; day.setUTCDate(day.getUTCDate() + 1)) {
    const key = `${propertyId}|${toDateString(day)}`;
    consumedByKey.set(key, (consumedByKey.get(key) ?? 0) + amount);
  }
}

export function computeOverbookedDays(
  reservations: Array<{
    propertyId: string;
    startDate: string | Date;
    endDate: string | Date;
    unitsBooked: number;
  }>,
  blocks: Array<{ propertyId: string; startDate: string | Date; endDate: string | Date }>,
  capacities: Array<{ id: string; unitsAvailable: number }>,
): OverbookedDay[] {
  const consumedByKey = new Map<string, number>();

  for (const reservation of reservations) {
    accumulate(
      consumedByKey,
      reservation.propertyId,
      reservation.startDate,
      reservation.endDate,
      reservation.unitsBooked,
    );
  }
  for (const block of blocks) {
    accumulate(consumedByKey, block.propertyId, block.startDate, block.endDate, 1);
  }

  const capacityByPropertyId = new Map(capacities.map((c) => [c.id, c.unitsAvailable]));

  const overbooked: OverbookedDay[] = [];
  for (const [key, consumed] of consumedByKey.entries()) {
    const separatorIndex = key.indexOf("|");
    const propertyId = key.slice(0, separatorIndex);
    const date = key.slice(separatorIndex + 1);
    const capacity = capacityByPropertyId.get(propertyId);
    // Propiedad ausente de `capacities` (dato inconsistente, ej. propiedad
    // eliminada o filtro incompleto) → comportamiento seguro es NO alarmar.
    // Alarmar sin conocer la capacidad real produciría falsos positivos, que
    // es exactamente el problema que esta reescritura busca eliminar.
    if (capacity === undefined) continue;
    if (consumed > capacity) {
      overbooked.push({ propertyId, date, consumed, capacity });
    }
  }

  return overbooked;
}
