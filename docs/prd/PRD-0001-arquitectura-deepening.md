# PRD-0001: Arquitectura - Profundización de Módulos y Testabilidad

## Problem Statement

El codebase tiene módulos **superficiales** (interface casi tan compleja como la implementación), lógica duplicada a través de las costuras, y validación partida entre routes y actions. Esto causa:

- Dificultad para testear lógica de negocio sin tocar BD
- Bugs por "me olvidé de llamar logChange" al agregar campos
- Duplicación de isSuperAdmin() entre routes y actions
- Modules como `calendar.ts` que no aportan abstracción real
- Pagos Mercado Pago sin costura que impida swapping de provider

## Solution

Implementar 5 deepening opportunities:

1. **ChangeRecorder** — módulo de auditoría que intercepta cambios de campos automáticamente via diffing
2. **PaymentGateway** — interfaz abstracción de procesador de pagos para facilitar futuro multi-provider
3. **Admin Routes** — unificar isSuperAdmin() helper y mover dashboard stats a super-admin.ts
4. **calendar.ts** — absorver funciones en reservations.ts y eliminar módulo
5. **Double Validation** — actions validan todo, routes pasan raw data

## User Stories

1. Como Owner, quiero que cuando меня changedate una reserva, quede registrado quién cambió qué y cuándo, para poder hacer debugging si el cliente pregunta
2. Como Owner, quiero poder auditar todos los cambios de una reserva (fechas, estado, cliente) en un solo lugar, sin tener que buscar en múltiples tablas
3. Como Super Admin, quiero ver dashboard stats (total owners, properties, revenue) en un solo lugar, para monitorizar el negocio
4. Como developer, quiero poder hacer tests de actions sin necesidad de base de datos real, para poder hacer TDD
5. Como developer, quiero que la validación viva en un solo lugar (la action), para no tener que recordar validar en dos sitios
6. Como developer, quiero poder hacer swap de Mercado Pago a otro provider sin reescribir toda la lógica de pagos
7. Como developer, quiero que cuando agregue un campo a Reservation, la auditoría se haga automáticamente sin tocar código de audit

## Implementation Decisions

### Candidato 5: Double Validation (COMPLETADO)

**Decisión**: ActionsOwnValidation pattern — cada action valida internamente, routes pasan raw JSON.

- `createReservation(data: unknown)` → internamente hace `reservationSchema.parse(data)` → typed
- `updateReservation(id, data: unknown)` → internamente hace `reservationUpdateSchema.parse(data)` → typed
- `createClient(data: unknown)` → internamente hace `clientSchema.parse(data)` → typed
- `createPayment(data: unknown)` → internamente hace `paymentSchema.parse(data)` → typed
- Routes ahora solo hacen `request.json()` y delegan

**Beneficios**:
- Interface claridad: callers saben que cada action valida su propio input
- Testabilidad: tests pueden llamar actions con datos crudos sin pre-validar
- Consistência: no más "algunos actions re-validan, otros no"

**Tests creados**:
- `src/lib/actions/__tests__/reservations.test.ts` — 4 tests covering validation
- Vitest configurado con path aliases y mocks para Prisma/next/cache

### Candidato 1: ChangeRecorder (COMPLETADO)

**Decisión**: Módulo `src/lib/audit/` con diffing automático síncrono.

- Interfaz: `ChangeRecorder` con método `record(original, updated, meta)` → `ChangeRecord[]`
- `entityType` es enum cerrado (`'reservation' | 'payment' | 'property'`)
- Diffing automático — compara old vs new object, genera registros automáticamente
- Síncrono — mismo transaction que la mutación

**Implementación**:
- `src/lib/audit/change-recorder.ts` — módulo con `diffObjects()`, `recordChanges()`, `createChangeRecorder()`
- `src/lib/audit/__tests__/change-recorder.test.ts` — 12 tests cubriendo diffing de todos los tipos de valor

**Beneficios**:
- Locality: agregar un campo nuevo automáticamente obtiene auditoría
- Tests: se pueden testear con pares de objetos sin Prisma

### Candidato 2: PaymentGateway (COMPLETADO)

**Decisión**: Interface `PaymentGateway` con adapters MercadoPago (y futuro Stripe).

- Métodos: `createPaymentLink(reservation)`, `getPaymentStatus(paymentId)`, `handleWebhook(rawPayload)`
- `PaymentEvent` normalizado mínimo: `{ paymentId, status, reservationId? }`
- Factory con cache: `getGateway('mercadopago')`
- El gateway parsea su propio payload de webhook
- Token encryption vive dentro del adapter de Mercado Pago

**Implementación**:
- `src/lib/payment/gateway.ts` — interface `PaymentGateway`, clase `MercadoPagoGateway`, factory `getGateway()`
- `MercadoPagoGateway` implementa todos los métodos: `createPaymentLink`, `getPaymentStatus`, `handleWebhook`
- Gateway cache para reusar instancias por provider+userId

**Beneficios**:
- Leverage: swap de provider sin tocar lógica de reserva/pago
- Locality: webhook handling, token resolution, link generation en un lugar

**ADR conflict**: ADR-0001 documenta webhook flow actual. No lo contradice — solo restructura internamente.

### Candidato 3: Admin Routes (COMPLETADO)

**Decisión**: Toda lógica en `super-admin.ts`, `requireSuperAdmin(request)` helper que throws.

- `dashboard-stats/route.ts` delega a `getDashboardStats()` en super-admin.ts
- `requireSuperAdmin()` helper exportado que retorna `NextResponse | null`
- `isSuperAdmin()` duplicado se elimina de routes

**Implementación**:
- `src/lib/actions/super-admin.ts` — agregado `requireSuperAdmin()` exportable y `getDashboardStats()`
- `src/app/api/admin/dashboard-stats/route.ts` — ahora delega a `getDashboardStats()`, ~60 líneas reducidas a ~15

**Beneficios**:
- Locality: si schema de BD cambia, un solo lugar para actualizar
- DRY: isSuperAdmin check vive en un módulo

### Candidato 4: calendar.ts (COMPLETADO)

**Decisión**: Funciones movidas a `reservations.ts`, archivo eliminado.

- `getCalendarReservations` → `reservations.ts`
- `getReservationsByDateRange` → `reservations.ts`
- `CalendarReservation` type se elimina (es solo un subset de Reservation)

**Implementación**:
- `src/lib/actions/calendar.ts` — ELIMINADO
- `src/lib/actions/reservations.ts` — absorbidas `getCalendarReservations` y `getReservationsByDateRange`

**Deletion test confirm**: el módulo no ocultaba complejidad, solo la relocalizaba.

## Testing Decisions

### Criterio de buen test

- Solo verifica comportamiento a través de interfaces públicas
- No mockea métodos internos ni privados
- Supervivencia a refactors internos: si renombrás una función privada y el test rompe, el test estaba acoplado a implementación
- Test lee como especificación: "crea reserva con datos válidos" vs "llama createReservation con propertyId vacío y espera error"

### Módulos con tests creados

- `reservations.ts` — 4 tests de validación (double validation candidate)
- `audit/change-recorder.ts` — 12 tests de diffing automático

### Módulos prioritarios para tests futuros

1. `createReservation` — tests de disponibilidad, cálculo de precio
2. `PaymentGateway.handleWebhook` — tests con payloads crudos de MP
3. `requireSuperAdmin()` — tests de auth fallida

### Prior art

- Mock pattern usado: `vi.mock('@/lib/db/prisma')` con `vi.mocked(prisma.xxx).mockResolvedValue()`
- Mock de `next/cache` con `vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))`
- Mock de `getSession` con session completa `{ userId, role, plan, email }`

## Out of Scope

- Migración de Stripe como segundo payment provider (solo se prepara la interfaz)
- Tests de UI o integración end-to-end
- Migración de la base de datos (sin schema changes)
- Re-escritura de frontend forms

## Further Notes

- Vitest instalado y configurado en `vitest.config.ts` con path aliases
- Tests viven en `src/lib/actions/__tests__/*.test.ts`
- El código de double validation fue el "warm-up" — demuestra el patrón para los candidatos siguientes
- Los candidatos 1 y 2 son los más arquitectónicamente significativos (ChangeRecorder y PaymentGateway)
