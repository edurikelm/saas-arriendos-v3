/**
 * Queries Prisma de SupportTicket centralizadas como seam canónico.
 *
 * Reglas de dominio (CONTEXT.md):
 * - **Tickets de Owner**: el `userId` es el filtro de scope. Un owner solo ve
 *   sus propios tickets. `getSession()` resuelve el `userId`; el seam asume
 *   que el caller ya validó el rol (no valida auth — eso es responsabilidad
 *   de la server action).
 * - **Tickets de Admin**: el `SUPER_ADMIN` ve todos los tickets, con filtros
 *   opcionales (status, ownerId, priority, category).
 * - **Affected Entity**: cada ticket puede referenciar UNA de {RESERVATION,
 *   PAYMENT, PROPERTY} mediante 3 FKs opcionales. La resolución de cuál está
 *   activa vive en `resolveAffectedEntity` (helper puro).
 * - **No-leído (hasUnread)**: el cálculo de unread vive en `lib/support/unread.ts`
 *   (función pura `computeHasUnread`). Este seam provee `buildUnreadMap` para
 *   resolver el `lastReadAt` por ticket de un viewer.
 *
 * Patrón de adapter:
 * - Todos los helpers aceptan un `adapter` opcional (`Prisma.TransactionClient |
 *   typeof prisma`) para participar en `$transaction` del caller.
 * - Si se omite, se usa el cliente global `prisma` (modo no transaccional).
 * - Mismo patrón que `lib/payments/queries.ts` y `lib/reservations/confirmation.ts`.
 *
 * Patrón de orden/paginación:
 * - Owner list: `orderBy: { lastActivityAt: "desc" }` (lo más reciente arriba),
 *   paginación con `page/limit`.
 * - Admin list: `orderBy: [{ priority: "desc" }, { status: "asc" }, { lastActivityAt: "desc" }]`
 *   (HIGH → LOW, OPEN/IN_PROGRESS primero, luego RESOLVED/CLOSED, y dentro
 *   de cada grupo por actividad), sin paginación (limit 20 fijo).
 *   Esto refleja la UX del panel admin: tickets urgentes arriba y la lista es
 *   corta (no más de ~20 tickets activos a la vez).
 *
 * Detalle (owner/admin):
 * - Owner: filtra por `userId` en el `where` del `findUnique` (404 si no
 *   pertenece al owner; defense in depth contra acceso cross-owner).
 * - Admin: sin filtro de `userId`. El caller debe tener rol SUPER_ADMIN.
 *   El detail incluye `user` para mostrar owner info.
 *
 * Por qué el seam no devuelve los DTOs finales (SupportTicketRow, etc.):
 * - Los DTOs de admin y owner difieren (admin tiene ownerName/ownerEmail/
 *   ownerPlan/messageCount; owner no). Si el seam los devolviera, tendría
 *   que exportar dos tipos distintos, duplicando la decisión de qué campos
 *   se exponen.
 * - Mantener la transformación DTO en las server actions preserva el
 *   contrato actual: el seam es "datos crudos de Prisma con includes",
 *   las actions son "DTOs para la UI". Mismo patrón que `lib/payments/queries.ts`.
 */

import { prisma } from "@/lib/db/prisma";
import type { Prisma, TicketStatus, UserRole } from "@prisma/client";
import type { StatusFilter, AdminTicketFilters, AffectedEntityRef } from "./types";

// Re-exports de tipos para que los callers del seam los tengan disponibles
// sin tener que importar de `./types` directamente.
export type { StatusFilter, AdminTicketFilters, AffectedEntityRef };

export type QueryAdapter = Prisma.TransactionClient | typeof prisma;

// ────────────────────────────────────────────────────────────────────────────
// Tipos de filas Prisma (con includes) que devuelven las queries del seam
// ────────────────────────────────────────────────────────────────────────────

/** Ticket con `messages` (solo campos necesarios para hasUnread). */
export type SupportTicketWithUnreadMessages = Prisma.SupportTicketGetPayload<{
  include: {
    messages: {
      select: {
        id: true;
        authorId: true;
        createdAt: true;
        author: { select: { role: true } };
      };
    };
  };
}>;

/** Ticket de admin con `user`, `_count.messages` y `messages` (para unread). */
export type AdminSupportTicketWithRelations = Prisma.SupportTicketGetPayload<{
  include: {
    user: { select: { id: true; name: true; email: true; plan: true; status: true } };
    _count: { select: { messages: true } };
    messages: {
      select: {
        id: true;
        authorId: true;
        createdAt: true;
        author: { select: { role: true } };
      };
    };
  };
}>;

/** Ticket detail (owner) con messages+attachments+author y 3 affected entity refs. */
export type OwnerSupportTicketDetail = Prisma.SupportTicketGetPayload<{
  include: {
    messages: {
      select: {
        id: true;
        authorId: true;
        content: true;
        createdAt: true;
        author: { select: { id: true; name: true; email: true } };
        attachments: {
          select: {
            id: true;
            url: true;
            fileName: true;
            fileSize: true;
            createdAt: true;
          };
        };
      };
    };
    affectedReservation: { select: { id: true } };
    affectedPayment: { select: { id: true } };
    affectedProperty: { select: { id: true } };
  };
}>;

/** Ticket detail (admin) con user + messages+attachments+author y 3 affected refs. */
export type AdminSupportTicketDetail = Prisma.SupportTicketGetPayload<{
  include: {
    user: { select: { id: true; name: true; email: true; plan: true; status: true } };
    messages: {
      include: {
        author: { select: { id: true; name: true; email: true } };
        attachments: {
          select: {
            id: true;
            url: true;
            fileName: true;
            fileSize: true;
            createdAt: true;
          };
        };
      };
    };
    affectedProperty: { select: { id: true } };
    affectedReservation: { select: { id: true } };
    affectedPayment: { select: { id: true } };
  };
}>;

// ────────────────────────────────────────────────────────────────────────────
// Helpers puros (sin DB)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Resuelve la `AffectedEntityRef` a partir de las 3 relations opcionales
 * del ticket. Función pura — no toca DB.
 *
 * Solo chequea las relations (no los FKs) porque las relations son la fuente
 * de verdad del dato: si Prisma devuelve la relation populada, el FK está
 * seteado; si la relation es `null`, el FK también lo es.
 *
 * Prioridad: PROPERTY → RESERVATION → PAYMENT (orden histórico del admin,
 * para que el admin vea primero la referencia más "concreta" si un ticket
 * tuviera múltiples relations seteadas — actualmente imposible por la app,
 * pero defensivo).
 *
 * En el flujo del owner, el orden es RESERVATION → PAYMENT → PROPERTY
 * (ver `getOwnerSupportTicketDetail`); este helper usa el orden admin.
 */
export function resolveAffectedEntityAdmin(ticket: {
  affectedProperty?: { id: string } | null;
  affectedReservation?: { id: string } | null;
  affectedPayment?: { id: string } | null;
}): AffectedEntityRef | null {
  if (ticket.affectedProperty) {
    return { type: "PROPERTY", id: ticket.affectedProperty.id };
  }
  if (ticket.affectedReservation) {
    return { type: "RESERVATION", id: ticket.affectedReservation.id };
  }
  if (ticket.affectedPayment) {
    return { type: "PAYMENT", id: ticket.affectedPayment.id };
  }
  return null;
}

/**
 * Variante owner de `resolveAffectedEntityAdmin`. Orden distinto: RESERVATION
 * primero, luego PAYMENT, luego PROPERTY. Refleja el orden del action original
 * de owner (`getSupportTicketDetail`).
 */
export function resolveAffectedEntityOwner(ticket: {
  affectedProperty?: { id: string } | null;
  affectedReservation?: { id: string } | null;
  affectedPayment?: { id: string } | null;
}): AffectedEntityRef | null {
  if (ticket.affectedReservation) {
    return { type: "RESERVATION", id: ticket.affectedReservation.id };
  }
  if (ticket.affectedPayment) {
    return { type: "PAYMENT", id: ticket.affectedPayment.id };
  }
  if (ticket.affectedProperty) {
    return { type: "PROPERTY", id: ticket.affectedProperty.id };
  }
  return null;
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers con DB
// ────────────────────────────────────────────────────────────────────────────

/**
 * Construye un `Map<ticketId, lastReadAt>` para un viewer.
 *
 * Usado por la lista de tickets (admin y owner) para resolver `hasUnread`
 * sin hacer una query por ticket. Patrón batched: una sola `findMany`
 * con `ticketId: { in: [...] }`, y el caller hace lookup O(1) en el Map.
 *
 * Si `ticketIds` está vacío, retorna Map vacío sin tocar la DB.
 */
export async function buildUnreadMap(
  userId: string,
  ticketIds: string[],
  adapter: QueryAdapter = prisma,
): Promise<Map<string, Date>> {
  if (ticketIds.length === 0) {
    return new Map();
  }
  const reads = await adapter.supportTicketRead.findMany({
    where: { userId, ticketId: { in: ticketIds } },
  });
  return new Map(reads.map((r) => [r.ticketId, r.lastReadAt]));
}

// ────────────────────────────────────────────────────────────────────────────
// Queries — Owner (scope: userId)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Lista paginada de tickets de un Owner.
 * Filtra por `userId` en el `where` (no por session — el caller ya validó).
 * Ordena por `lastActivityAt: desc` (lo más reciente arriba).
 *
 * Devuelve los datos crudos de Prisma (con messages para hasUnread) + total
 * para que la action mapee al DTO final. NO construye el `hasUnread` —
 * eso lo hace la action con `buildUnreadMap` + `computeHasUnread`.
 */
export async function getOwnerSupportTickets(
  userId: string,
  options: { page?: number; limit?: number; status?: TicketStatus | "ALL" } = {},
  adapter: QueryAdapter = prisma,
): Promise<{ tickets: SupportTicketWithUnreadMessages[]; total: number }> {
  const page = options.page ?? 1;
  const limit = options.limit ?? 10;
  const skip = (page - 1) * limit;

  const where: Prisma.SupportTicketWhereInput = { userId };
  if (options.status && options.status !== "ALL") {
    where.status = options.status;
  }

  const [tickets, total] = await Promise.all([
    adapter.supportTicket.findMany({
      where,
      orderBy: { lastActivityAt: "desc" },
      skip,
      take: limit,
      include: {
        messages: {
          select: { id: true, authorId: true, createdAt: true, author: { select: { role: true } } },
          orderBy: { createdAt: "desc" },
        },
      },
    }),
    adapter.supportTicket.count({ where }),
  ]);

  return { tickets, total };
}

/**
 * Detalle de un ticket para un Owner.
 *
 * Filtra por `userId` en el `where` del `findUnique` — defense in depth contra
 * acceso cross-owner (un owner no puede ver el ticket de otro owner aunque
 * conozca el `ticketId`). Retorna `null` si no existe o no pertenece al owner.
 *
 * Incluye messages con attachments + author, y los 3 FKs de affected entity.
 */
export async function getOwnerSupportTicketDetail(
  userId: string,
  ticketId: string,
  adapter: QueryAdapter = prisma,
): Promise<OwnerSupportTicketDetail | null> {
  return adapter.supportTicket.findUnique({
    where: { id: ticketId, userId },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          authorId: true,
          content: true,
          createdAt: true,
          author: { select: { id: true, name: true, email: true } },
          attachments: {
            select: {
              id: true,
              url: true,
              fileName: true,
              fileSize: true,
              createdAt: true,
            },
          },
        },
      },
      affectedReservation: { select: { id: true } },
      affectedPayment: { select: { id: true } },
      affectedProperty: { select: { id: true } },
    },
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Queries — Admin (scope: todos los tickets)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Lista de tickets para el panel admin.
 * Sin paginación (limit 20 fijo, no más de ~20 tickets activos a la vez).
 *
 * Filtros:
 * - `statusFilter`: si no se pasa, excluye CLOSED (default UX: tickets
 *   visibles = no cerrados). Si es "ALL", incluye todos los status.
 *   Si es un status específico, filtra por ese status.
 * - `filters.ownerId`: filtra por owner específico.
 * - `filters.priority`: filtra por prioridad (string — el caller debe
 *   validar contra el enum `TicketPriority` antes de llamar).
 * - `filters.category`: análogo para categoría.
 *
 * Orden: `[{ priority: "desc" }, { status: "asc" }, { lastActivityAt: "desc" }]`
 * — HIGH primero, después MEDIUM/LOW; dentro de cada prioridad, OPEN/
 * IN_PROGRESS antes que RESOLVED/CLOSED (orden alfabético del enum
 * CLOSED < IN_PROGRESS < OPEN < RESOLVED); y dentro de cada grupo,
 * actividad más reciente arriba.
 */
export async function getAdminSupportTickets(
  options: {
    statusFilter?: StatusFilter;
    filters?: AdminTicketFilters;
  } = {},
  adapter: QueryAdapter = prisma,
): Promise<{ tickets: AdminSupportTicketWithRelations[]; total: number }> {
  const where: Prisma.SupportTicketWhereInput = {};

  if (!options.statusFilter) {
    // Default: ocultar CLOSED
    where.status = { not: "CLOSED" };
  } else if (options.statusFilter !== "ALL") {
    where.status = options.statusFilter;
  }

  if (options.filters?.ownerId) {
    where.userId = options.filters.ownerId;
  }
  if (options.filters?.priority) {
    where.priority = options.filters.priority as Prisma.SupportTicketWhereInput["priority"];
  }
  if (options.filters?.category) {
    where.category = options.filters.category as Prisma.SupportTicketWhereInput["category"];
  }

  const [tickets, total] = await Promise.all([
    adapter.supportTicket.findMany({
      where,
      orderBy: [{ priority: "desc" }, { status: "asc" }, { lastActivityAt: "desc" }],
      include: {
        user: { select: { id: true, name: true, email: true, plan: true, status: true } },
        _count: { select: { messages: true } },
        messages: {
          select: { id: true, authorId: true, createdAt: true, author: { select: { role: true } } },
          orderBy: { createdAt: "desc" },
        },
      },
    }),
    adapter.supportTicket.count({ where }),
  ]);

  return { tickets, total };
}

/**
 * Detalle de un ticket para el panel admin.
 * Sin filtro de `userId` (el SUPER_ADMIN ve todos los tickets).
 * Retorna `null` si el ticket no existe.
 *
 * Incluye `user` (owner info), `messages` con attachments+author, y los 3
 * FKs de affected entity.
 */
export async function getAdminSupportTicketDetail(
  ticketId: string,
  adapter: QueryAdapter = prisma,
): Promise<AdminSupportTicketDetail | null> {
  return adapter.supportTicket.findUnique({
    where: { id: ticketId },
    include: {
      user: { select: { id: true, name: true, email: true, plan: true, status: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        include: {
          author: { select: { id: true, name: true, email: true } },
          attachments: {
            select: {
              id: true,
              url: true,
              fileName: true,
              fileSize: true,
              createdAt: true,
            },
          },
        },
      },
      affectedProperty: { select: { id: true } },
      affectedReservation: { select: { id: true } },
      affectedPayment: { select: { id: true } },
    },
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Aggregates — KPIs
// ────────────────────────────────────────────────────────────────────────────

/**
 * Cuenta tickets por status para un Owner.
 * Usado por `getSupportTicketsKpis` (open vs resolved counts).
 *
 * Retorna `{ openCount, resolvedCount }` donde:
 * - open = OPEN + IN_PROGRESS (tickets que requieren atención)
 * - resolved = RESOLVED + CLOSED (tickets cerrados/cerrables)
 */
export async function countTicketsByStatusForOwner(
  userId: string,
  adapter: QueryAdapter = prisma,
): Promise<{ openCount: number; resolvedCount: number }> {
  const [openCount, resolvedCount] = await Promise.all([
    adapter.supportTicket.count({
      where: { userId, status: { in: ["OPEN", "IN_PROGRESS"] } },
    }),
    adapter.supportTicket.count({
      where: { userId, status: { in: ["RESOLVED", "CLOSED"] } },
    }),
  ]);
  return { openCount, resolvedCount };
}

/**
 * Carga los tickets de un owner con sus mensajes ordenados ascendente,
 * con el subset de campos necesario para calcular el tiempo medio de
 * primera respuesta del admin.
 *
 * Usado por `getSupportTicketsKpis`. Devuelve solo `createdAt` (del ticket)
 * y mensajes con `authorId/createdAt/author.role` — lo mínimo para que el
 * caller compute el delay entre la creación del ticket y el primer mensaje
 * de un SUPER_ADMIN.
 */
export async function getOwnerTicketsForResponseTime(
  userId: string,
  adapter: QueryAdapter = prisma,
): Promise<
  Array<{
    createdAt: Date;
    messages: Array<{
      authorId: string;
      createdAt: Date;
      author: { role: UserRole };
    }>;
  }>
> {
  return adapter.supportTicket.findMany({
    where: { userId },
    select: {
      createdAt: true,
      messages: {
        orderBy: { createdAt: "asc" },
        select: { authorId: true, createdAt: true, author: { select: { role: true } } },
      },
    },
  });
}
