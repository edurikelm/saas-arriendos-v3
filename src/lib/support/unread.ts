/**
 * Cálculo puro del estado "no leído" de un Ticket de Soporte.
 *
 * Regla: un mensaje es no-leído para el viewer si
 *   1) su autor es de otro rol (no es self-side), Y
 *   2) fue creado después de la última lectura del viewer
 *      (o el viewer nunca leyó el ticket).
 *
 * Esta función es independiente de Prisma, del modelo de sesión y del rol
 * del viewer más allá del string que recibe. La usa tanto el listado de
 * tickets del Owner como el del SUPER_ADMIN, más el contador del sidebar.
 */

export type UnreadRole = "OWNER" | "SUPER_ADMIN";

export interface UnreadMessage {
  authorId: string;
  authorRole: UnreadRole;
  createdAt: Date;
}

export interface UnreadViewer {
  role: UnreadRole;
}

export function computeHasUnread(
  messages: UnreadMessage[],
  viewer: UnreadViewer,
  lastReadAt: Date | undefined,
): boolean {
  return messages.some(
    (msg) =>
      msg.authorRole !== viewer.role &&
      (!lastReadAt || msg.createdAt > lastReadAt),
  );
}
