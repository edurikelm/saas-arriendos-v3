# ADR-0012: Generación automática de pagos mensuales

## Status

Accepted

## Context

Al crear una reserva con `billing_type: MONTHLY`, el sistema no generaba automáticamente los pagos pendientes correspondientes a cada mes del arriendo. El propietario debía crear cada pago manualmente, lo cual era propenso a errores y olvidos.

Alternativas consideradas:

1. **Generación manual** (status quo): el propietario crea pagos manualmente después de crear la reserva
2. **Generación diferida bajo demanda**: se crean N pagos esqueleto al crear la reserva pero sin `initPoint`, se generan bajo demanda cuando el propietario quiere cobrar
3. **Generación automática al crear** (decidido): se crean los N `Payment` records con status `PENDING` dentro de la misma transacción de `createReservation`

## Decision

Cuando se crea una reserva con `billing_type: MONTHLY`:

- Se generan N registros `Payment` en la misma transacción atómica
- Cada `Payment` tiene `amount = monthly_price × units_booked`
- `due_date` = día 1 de cada mes cubierto por la reserva, empezando por el mes de `start_date` (ej: Sep 1 → Sep 1, Oct 1, Nov 1)
- `end_date` es inclusivo también para MONTHLY: Sep 1 → Nov 30 cuenta como 3 meses, con salida/entrega calculada aparte como Dec 1 si se necesita mostrarla
- `installment_index` = 1, 2, 3... para identificar cada cuota
- Todos start con `status: PENDING`, `method: MERCADO_PAGO`
- `init_point` se genera **bajo demanda** (cuando el propietario quiere cobrar), no al crear la reserva
- El link de MP vence en 7 días

Al cancelar una reserva:
- DELETE payments WHERE `status = PENDING`
- KEEP payments WHERE `status = COMPLETED` (auditoría financiera)

## Implementation

- Modelo `Payment` extendido con `installment_index`, `due_date`, `paid_at`
- Función pura `generateMonthlyPayments(startDate, months, monthlyPrice, unitsBooked)` en `lib/payments/monthly.ts`
- `createReservation` integra la generación de pagos en la transacción
- `cancelReservation` elimina pagos PENDING, mantiene COMPLETED
- UI en `reservation-detail-dialog.tsx` muestra tabla de pagos para MONTHLY
- Server Actions `markPaymentAsPaid` y `generatePaymentLink` para gestión de pagos

## Consequences

### Positive

- El propietario no olvida crear los pagos mensuales
- Trazabilidad financiera completa desde el inicio
- Los pagos completados survived a la cancelación como auditoría
- Cada cuota tiene su `due_date` para tracking de vencimientos
- El link MP se genera cuando se necesita, evitando que venza antes de tiempo

### Negative

- Si el propietario quiere cobrar en efectivo una sola vez (todo junto), debe marcar manualmente los N pagos
- Los pagos se generan aunque el propietario quiera ofrecer descuento por pronto pago (no hay forma de alterarindividual payment amounts post-creación)
