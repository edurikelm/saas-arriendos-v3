/**
 * Decide si la campana suena: hay una notificación sin leer más nueva que la
 * última que ya vimos.
 *
 * Se compara el `createdAt` de la no leída más reciente, no la cantidad: si
 * el owner lee una en otro dispositivo y llega otra en el mismo intervalo, la
 * cantidad no cambia y la nueva pasaría sin sonar.
 *
 * Los timestamps son ISO de `toISOString()` (mismo formato y zona), así que
 * se comparan como strings. Vienen todos del servidor: el reloj del
 * navegador no entra en juego.
 */
export function shouldRing(latestUnreadAt: string | null, lastSeenAt: string | null): boolean {
  if (latestUnreadAt === null) return false;
  return lastSeenAt === null || latestUnreadAt > lastSeenAt;
}

/**
 * Punto de partida al cargar: la notificación más nueva que ya se mostró.
 * Lo que existía al cargar la página no hace sonar la campana.
 */
export function newestCreatedAt(notifications: { createdAt: string }[] | undefined): string | null {
  if (!notifications || notifications.length === 0) return null;
  return notifications.reduce(
    (newest, n) => (n.createdAt > newest ? n.createdAt : newest),
    notifications[0].createdAt,
  );
}
