/**
 * Máquina de estados de Subscription.
 *
 * Codifica las transiciones válidas del enum `SubscriptionStatus` según
 * la tabla 6x6 del PRD § A:
 *
 * | from \ to    | PENDING | AUTHORIZED | PAUSED | CANCELLED | EXPIRED | FAILED |
 * |--------------|---------|------------|--------|-----------|---------|--------|
 * | (none)       |    ✓    |            |        |           |         |        |
 * | PENDING      |         |     ✓      |   ✓    |     ✓     |    ✓    |        |
 * | AUTHORIZED   |         |            |   ✓    |     ✓     |    ✓    |    ✓   |
 * | PAUSED       |         |     ✓      |        |     ✓     |    ✓    |        |
 * | CANCELLED    |         |     ✓      |        |           |    ✓    |        |
 * | EXPIRED      |         |     ✓      |        |           |         |        |
 * | FAILED       |         |     ✓      |   ✓    |     ✓     |    ✓    |        |
 *
 * Esta función es pura: no consulta DB ni ejecuta side effects.
 * Usada por `applySubscriptionEvent` para validar transiciones antes de
 * escribirlas.
 *
 * Pattern mirror: `lib/reservations/state-machine.ts`.
 */

import type { SubscriptionStatus } from "@prisma/client";

type StatusTuple = readonly [SubscriptionStatus, SubscriptionStatus, boolean];

// Tabla 6x6: [from, to, allowed]
const TRANSITION_TABLE: StatusTuple[] = [
  // (none) → PENDING (crear nueva suscripción)
  // PENDING → AUTHORIZED, PAUSED, CANCELLED, EXPIRED
  ["PENDING", "AUTHORIZED", true],
  ["PENDING", "PAUSED", true],
  ["PENDING", "CANCELLED", true],
  ["PENDING", "EXPIRED", true],
  ["PENDING", "FAILED", false],
  // AUTHORIZED → PAUSED, CANCELLED, EXPIRED, FAILED
  ["AUTHORIZED", "PENDING", false],
  ["AUTHORIZED", "PAUSED", true],
  ["AUTHORIZED", "CANCELLED", true],
  ["AUTHORIZED", "EXPIRED", true],
  ["AUTHORIZED", "FAILED", true],
  // PAUSED → AUTHORIZED, CANCELLED, EXPIRED
  ["PAUSED", "PENDING", false],
  ["PAUSED", "AUTHORIZED", true],
  ["PAUSED", "CANCELLED", true],
  ["PAUSED", "EXPIRED", true],
  ["PAUSED", "FAILED", false],
  // CANCELLED → AUTHORIZED (reactivación manual antes de expirar) y
  // CANCELLED → EXPIRED (el período terminó y la cancelación se procesó)
  ["CANCELLED", "PENDING", false],
  ["CANCELLED", "AUTHORIZED", true],
  ["CANCELLED", "PAUSED", false],
  ["CANCELLED", "EXPIRED", true],
  ["CANCELLED", "FAILED", false],
  // EXPIRED → AUTHORIZED (reactivación)
  ["EXPIRED", "PENDING", false],
  ["EXPIRED", "AUTHORIZED", true],
  ["EXPIRED", "PAUSED", false],
  ["EXPIRED", "CANCELLED", false],
  ["EXPIRED", "FAILED", false],
  // FAILED → AUTHORIZED, PAUSED, CANCELLED, EXPIRED (reactivación tras reintentar)
  ["FAILED", "PENDING", false],
  ["FAILED", "AUTHORIZED", true],
  ["FAILED", "PAUSED", true],
  ["FAILED", "CANCELLED", true],
  ["FAILED", "EXPIRED", true],
];

const TRANSITION_MAP = new Map<string, boolean>();

for (const [from, to, allowed] of TRANSITION_TABLE) {
  TRANSITION_MAP.set(`${from}→${to}`, allowed);
}

// Estado especial: (null) significa "sin estado previo" — solo válido para crear PENDING
const NULL_KEY = "null→PENDING";
TRANSITION_MAP.set(NULL_KEY, true);

/**
 * Evalúa si una transición de estado es válida.
 *
 * @param from   Estado actual (null = subscription aún no existe)
 * @param to     Estado destino
 * @returns true si la transición es válida según la tabla 6x6
 */
export function canTransition(
  from: SubscriptionStatus | null,
  to: SubscriptionStatus,
): boolean {
  if (from === null) {
    return to === "PENDING";
  }
  return TRANSITION_MAP.get(`${from}→${to}`) ?? false;
}
