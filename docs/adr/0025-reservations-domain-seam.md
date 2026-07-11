# ADR-0025: `src/lib/reservations/` as canonical seam for Reservation domain logic

## Status

Aceptado (2026-07-11)

## Context

Una auditoría técnica del codebase (sesión 2026-07-11, 38 hallazgos crudos) identificó tres bugs críticos concentrados en la lógica de dominio de Reservation, todos por ausencia de un seam dedicado:

1. **Transición PENDING → CONFIRMED duplicada 5 veces** en `src/lib/actions/payments.ts`: `createPayment`, `markPaymentAsPaid`, `updatePayment`, `checkMercadoPagoPaymentStatus`, `processMercadoPagoWebhook`. Cada callsite repetía el query de pagos + cálculo + comparación + `reservation.update` (~14 líneas idénticas). Cambiar la regla de "¿cuándo confirmar?" requería editar 5 sitios y mantenerlos sincronizados a mano.

2. **`updateReservation` permitía cualquier transición de status** sin guard. Zod schema `reservationUpdateSchema` aceptaba `PENDING | CONFIRMED | CANCELLED | COMPLETED` libremente. Bugs concretos:
   - `updateReservation({ status: "COMPLETED" })` sin pagos → reserva marcada como completada sin ingresos.
   - `updateReservation({ status: "CANCELLED" })` sin ejecutar `cancelReservation()` → pagos PENDING NO se borraban (bypass de la limpieza).

3. **`deleteReservation` hard-deleted Payments**, destruyendo evidencia financiera de cobros ya realizados. CONTEXT.md exige `Payment.deletedAt` para auditoría y la regla de dominio "Al cancelar: KEEP pagos COMPLETED".

El codebase ya tenía el patrón `src/lib/payments/{calculations,monthly}.ts` como seam canónico de lógica pura de pagos — pero no existía el equivalente para Reservation. La lógica de dominio de Reservation estaba dispersa entre `actions/reservations.ts`, `actions/payments.ts` y `validations/reservation.ts`.

## Decision

Adoptar **`src/lib/reservations/` como seam canónico para lógica pura de dominio de Reservation**. Distinto de `src/lib/payments/` (que es dueño de cálculos de Payment, no de transiciones de Reservation).

### Qué vive en `src/lib/reservations/`

- **Funciones puras o casi-puras** (DB writes OK si están acotados al dominio de Reservation).
- Lógica reutilizable desde server actions y tests sin tener que mockear Prisma completo.
- Transiciones de estado, cálculos derivados de Reservation, validaciones de invariantes del modelo.

### Qué NO vive ahí

- Server actions (`src/lib/actions/reservations.ts`) — orquestan sesión + Prisma + reválidación.
- Validaciones Zod (`src/lib/validations/reservation.ts`) — shape de input, no reglas de dominio.
- Componentes UI (`src/components/reservations/`) — presentación.
- Lógica de Payment (cálculos, queries) — eso es `src/lib/payments/`.

### Regla de dependencia

- `src/lib/reservations/` **puede importar** de `src/lib/payments/` (e.g., `getReservationPaidAmount` se usa para decidir confirmación).
- `src/lib/payments/` **NO debe importar** de `src/lib/reservations/` (los pagos son un concepto ortogonal al de Reservation como aggregate).
- `src/lib/actions/*.ts` orquesta ambos.

### Módulos shipped

#### 1. `src/lib/reservations/confirmation.ts`

```ts
confirmReservationIfPaid(
  reservationId: string,
  adapter?: Prisma.TransactionClient | typeof prisma
): Promise<ConfirmationOutcome>
```

Regla encapsulada (CONTEXT.md):

| Status actual | Comportamiento |
|---|---|
| `PENDING` + `totalPaid >= totalPrice` | flip a `CONFIRMED`, retorna `{ status: "confirmed" }` |
| `PENDING` + `totalPaid < totalPrice` | no-op, `{ status: "below_threshold" }` |
| `CONFIRMED` | no-op idempotente, `{ status: "already_confirmed" }` |
| `CANCELLED` | rechazo, `{ status: "skipped_cancelled" }` |
| `COMPLETED` | rechazo, `{ status: "skipped_completed" }` |
| Reserva no existe | `{ status: "not_found" }` |

Acepta un `adapter` opcional para que callers envueltos en `$transaction` pasen su `tx`. Por defecto usa `prisma` global (modo no transaccional).

#### 2. `src/lib/reservations/state-machine.ts`

```ts
canTransition({
  from, to, completedReservationPayments
}: TransitionContext): TransitionResult
```

Tabla de verdad de transiciones:

| from → to | Permitido | Condición |
|---|---|---|
| * → mismo | ✅ | no-op |
| PENDING → CONFIRMED | ✅ | siempre (override del owner) |
| PENDING → COMPLETED | ❌ | debe pasar por CONFIRMED primero |
| PENDING → CANCELLED | ✅* | *válido aquí; la acción updateReservation bloquea para forzar `cancelReservation()` |
| CONFIRMED → PENDING | ✅ | downgrade |
| CONFIRMED → COMPLETED | ✅ | requiere ≥1 pago RESERVATION COMPLETED |
| CONFIRMED → CANCELLED | ✅* | *mismo caso que PENDING → CANCELLED |
| CANCELLED → * | ❌ | estado terminal |
| COMPLETED → * | ❌ | estado terminal |

**Separación clave**: la máquina describe el dominio (qué transiciones son válidas). La acción `updateReservation` es donde reside la regla workflow "use `cancelReservation` para cancelar". Esa separación evita que la máquina tenga que conocer nombres de acciones.

## Implementation

### Cambios

- **Nuevos módulos**: `src/lib/reservations/confirmation.ts` + `state-machine.ts` con 49 tests dedicados (14 + 35).
- **Migración de 5 callsites** en `src/lib/actions/payments.ts` para usar `confirmReservationIfPaid`. Net: **-75 líneas duplicadas**.
- **Integración de guards** en `src/lib/actions/reservations.ts:updateReservation` con check de CANCELLED específico.
- **`deleteReservation` con soft-delete de Payments** + bloqueo si hay ≥1 pago COMPLETED (sugiere `cancelReservation`). 6 tests nuevos.

### Commits (en orden)

1. `7db951f` — `refactor(reservations): add confirmReservationIfPaid module with tests`
2. `2927672` — `refactor(payments): use confirmReservationIfPaid in 5 actions to dedupe PENDING→CONFIRMED logic`
3. `fb21135` — `refactor(reservations): add canTransition state-machine with full transition table tests`
4. `eff9fd8` — `fix(reservations): guard updateReservation status transitions + force cancel via cancelReservation`
5. `9ef8685` — `fix(reservations): soft-delete payments + block deleteReservation on COMPLETED payments`

### Tests

- 49 tests nuevos pasan (14 confirmation + 35 state-machine + 6 deleteReservation).
- 70 tests existentes de `payments.test.ts` preservados sin modificación (la migración es drop-in).
- 11 tests existentes de `reservations.test.ts` preservados + 6 nuevos para deleteReservation.

## Consequences

### Positive

- **Locality**: cambiar la regla de "¿cuándo confirmar?" es 1 lugar. Cambiar las transiciones válidas es 1 lugar. Cambiar la política de borrado es 1 lugar.
- **Test surface explícita**: la lógica de dominio ahora tiene tests dedicados sin pasar por mocks de server actions.
- **Bugs prevenidos**: 5 bugs críticos documentados en el audit ya no son posibles (auto-confirmar CANCELLED, COMPLETED sin pagos, bypass de cleanup, hard-delete de pagos, etc.).
- **Patrón replicable**: el codebase ya tenía `lib/payments/` como seam de pagos. Ahora tiene simetría con `lib/reservations/` para el dominio de Reservation.
- **Adapter injection**: `confirmReservationIfPaid` ya soporta composición con `$transaction` para callers que quieran atomicidad real en el futuro.

### Negative

- **Complejidad inicial**: 2 nuevos módulos + 49 tests = más archivos que mantener. Mitigación: la lógica que encapsulan era lo suficientemente crítica (5 bugs) que el costo se paga solo.
- **Separación máquina vs acción puede confundir**: el hecho de que `canTransition` permita PENDING→CANCELLED pero `updateReservation` lo rechace es intencional pero requiere leer el ADR o el docstring del módulo. Mitigación: docstring explícito en ambos archivos + este ADR.

### Neutral

- `cancelReservation()` queda como único path para cancelar una reserva (con su side effect de DELETE pagos PENDING). Es lo que la auditoría quería pero el cambio de API es soft (no se renombró nada).
- `Payment.deletedAt` ya existía en el schema (CONTEXT.md) — no requirió migración.

## Future work (opcional)

- Si se quiere `Reservation.deletedAt` para soft-delete de reservas también, requeriría migración de schema. Hoy no es necesario (la auditoría concluyó que Reservation + ReservationChange hard-delete es aceptable).
- Si se quiere atomicidad real en los 5 callsites, agregar `$transaction` y pasar `tx` al helper. Hoy el helper soporta el adapter pero los callers usan el default.
- Migración de los `lib/payments/calculations.ts` rules a una ADR específica si crece la complejidad.

## References

- `src/lib/reservations/confirmation.ts` — `confirmReservationIfPaid`
- `src/lib/reservations/state-machine.ts` — `canTransition`
- `src/lib/payments/calculations.ts` — patrón análogo para pagos (precedente)
- `src/lib/actions/reservations.ts` — consumer de los módulos
- `src/lib/actions/payments.ts` — consumer del helper de confirmación
- `src/lib/payments/calculations.ts:33` — `getReservationPaidAmount` (cálculo puro reutilizado por el helper)
- CONTEXT.md sección "Modelo de Datos > Reservation" — modelo de dominio
- CONTEXT.md regla de cancelación ("KEEP pagos COMPLETED") — base del bloqueo en deleteReservation
- Sesión de auditoría 2026-07-11 — `mem_search topic_key:audit/2026-07-11-technical`