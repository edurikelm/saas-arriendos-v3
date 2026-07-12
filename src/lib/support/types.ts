/**
 * Tipos compartidos del dominio de Support.
 *
 * **Por qué un archivo separado de `queries.ts`**:
 * - `queries.ts` importa `prisma` (server-only) para sus helpers.
 * - Los tipos de este archivo son consumidos tanto por Server Components
 *   (`/admin/support/page.tsx`) como por Client Components
 *   (`/components/admin/support/admin-support-list.tsx`).
 * - `import type` se borra en compile time, pero los bundlers
 *   (Turbopack/Webpack) pueden intentar procesar el módulo completo
 *   al resolver `import type { ... }` desde un Client Component, lo
 *   que arrastraría el `prisma` server-only al grafo del cliente.
 * - Solución: tipos sin ninguna dependencia runtime → un Client
 *   Component puede importar de aquí con seguridad.
 *
 * Verificado en commit `3c4ae01` (mini-audit 2026-07-12) que Next.js
 * 16.2.10 / Turbopack FALLA al re-exportar estos tipos desde un módulo
 * `"use server"` (error: "Export X doesn't exist in target module").
 * La solución correcta es apuntar el import al seam original.
 */

import type { TicketStatus } from "@prisma/client";

/** Filtro de status para la lista de tickets del admin. */
export type StatusFilter = "ALL" | TicketStatus;

/** Filtros adicionales para la lista de tickets del admin (owner, priority, category). */
export interface AdminTicketFilters {
  ownerId?: string;
  priority?: string;
  category?: string;
}

/**
 * Ref tipado a la entidad afectada por un ticket.
 * Un ticket solo puede referenciar UNA de {RESERVATION, PAYMENT, PROPERTY}.
 */
export interface AffectedEntityRef {
  type: "RESERVATION" | "PAYMENT" | "PROPERTY";
  id: string;
}
