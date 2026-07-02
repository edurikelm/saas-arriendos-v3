/**
 * Calcula días (YYYY-MM-DD) donde una Reserva interna se solapa con un Bloqueo Externo.
 * Usado por UI para resaltar conflictos. No muta inputs.
 *
 * Regla de dominio (CONTEXT.md):
 * - Reservas internas siempre prevalecen sobre bloqueos externos.
 * - Conflictos son solo visuales; no bloquean operaciones.
 */
export function computeConflictDates(
  reservations: Array<{ startDate: string | Date; endDate: string | Date }>,
  blocks: Array<{ startDate: string | Date; endDate: string | Date }>,
): Set<string> {
  const toDateString = (d: string | Date): string => {
    if (d instanceof Date) return d.toISOString().slice(0, 10);
    return d.slice(0, 10);
  };

  const toDateSet = (
    items: Array<{ startDate: string | Date; endDate: string | Date }>,
  ): Map<string, boolean> => {
    const map = new Map<string, boolean>();
    for (const item of items) {
      const start = new Date(toDateString(item.startDate));
      const end = new Date(toDateString(item.endDate));
      for (let day = new Date(start); day <= end; day.setDate(day.getDate() + 1)) {
        map.set(toDateString(day), true);
      }
    }
    return map;
  };

  const reservationDates = toDateSet(reservations);
  const blockDates = toDateSet(blocks);

  const conflicts = new Set<string>();
  for (const date of blockDates.keys()) {
    if (reservationDates.has(date)) {
      conflicts.add(date);
    }
  }

  return conflicts;
}
