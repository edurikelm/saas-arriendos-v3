# ADR-0021: Notifications Architecture

## Status

Aceptado

## Context

El sistema de notificaciones (PRD-0003) necesita una arquitectura que soporte múltiples canales de entrega (in-app, email) desde el día 1, con deduplicación idempotente, timezone correcto, y un contrato de dispatch post-commit que preserve la coherencia entre la mutación de negocio y la notificación.

Este ADR documenta las decisiones arquitectónicas del slice foundation (#167) que aplican a todos los slices subsecuentes.

## Decision

### 1. Channel Abstraction

Se introduce la interfaz `NotificationChannel`:

```ts
interface NotificationChannel {
  readonly name: "in-app" | "email";
  dispatch(intent: NotificationIntent, recipient: NotificationRecipient): Promise<DispatchResult>;
}
```

`NotificationIntent` lleva toda la información necesaria para crear la notificación:
- `notificationKey`: clave única de deduplicación (ej. `payment-received:pay_abc123`)
- `type`: enum NotificationType
- `title`, `body`: snapshots en el momento del evento
- `link`: URL interna opcional
- `userId`: destinatario

`DispatchResult` es una discriminated union que permite al caller distinguir entre éxito, skip intencional (email deshabilitado, sin API key), y error.

Cada canal es responsable de su propia idempotencia. El `InAppChannel` usa `findUnique` + `create` con el `@unique` en `notificationKey`. El `EmailChannel` (futuro) usa el mismo patrón.

### 2. notificationKey Deduplication Contract

**Contrato:** cada `NotificationIntent` lleva un `notificationKey` estable que:
1. Identifica unívocamente el evento sin ambigüedad
2. Es determinístico (mismo evento → misma key, sin random)
3. Permite que el canal detecte duplicados con una sola query

**Formato canónico:**

| Evento | Formato | Ejemplo |
|--------|---------|---------|
| `RESERVATION_CREATED` | `reservation-created:{reservationId}` | `reservation-created:clxyz123abc` |
| `RESERVATION_CANCELLED` | `reservation-cancelled:{reservationId}` | `reservation-cancelled:clxyz123abc` |
| `PAYMENT_RECEIVED` | `payment-received:{paymentId}` | `payment-received:clpay456def` |
| `PAYMENT_REMINDER` | `payment-reminder:{paymentId}:{MILESTONE}` | `payment-reminder:clpay456def:DUE_TODAY` |
| `PAYMENT_FAILED` | `payment-failed:{paymentId}:{status}` | `payment-failed:clpay456def:REJECTED` |

**El `@unique` en `notificationKey` es la única línea de defensa contra duplicados.** No hay lógica de "ya envió" en el caller. Si el webhook de Mercado Pago se reintenta 3 veces, o el cron corre dos veces el mismo día, la segunda ejecución encuentra el registro existente y retorna `{ deduplicated: true }` sin crear duplicado.

### 3. Exact-Day Milestone Rule

Los hitos de recordatorio se calculan como **matches exactos de día calendario**, no como ventanas:

```
| Milestone       | Días desde hoy |
|-----------------|----------------|
| BEFORE_3_DAYS   | +3             |
| BEFORE_1_DAY     | +1             |
| DUE_TODAY        | 0              |
| OVERDUE_1_DAY    | -1             |
| OVERDUE_3_DAYS  | -3             |
| OVERDUE_7_DAYS   | -7             |
```

**Por qué no ventanas:** si `BEFORE_3_DAYS` fuera "entre 2 y 3 días", el cron corriendo dos días consecutivos podría generar dos recordatorios distintos para el mismo `paymentId`. Con `daysFromToday === 3` la key `payment-reminder:pay_abc123:BEFORE_3_DAYS` se calcula determinísticamente y el `@unique` garantiza cero duplicados sin que el caller tenga que mantener estado de qué ya envió.

La función `daysFromNowInBusinessTz(targetDate, now, tz)` retorna el entero de días entre dos fechas interpretadas en `America/Santiago`. La comparación es determinística: si `dueDate` es el 20 de mayo y `now` es el 17 de mayo a las 23:00 SCL, retorna `3`.

### 4. Post-Commit Dispatch Contract

Las server actions que emiten notificaciones siguen este orden:

```
1. Server action abre transacción Prisma
2. Ejecuta mutación (createReservation, etc.)
3. Si transacción falla → rollback, no se emite notificación
4. Si transacción commitea → se llama a recordDomainEvent() FUERA de la transacción
5. recordDomainEvent() calcula intents, busca recipients, dispatcha por canal
```

**Propiedad:** si `recordDomainEvent` falla (ej. Resend no responde), la mutación ya está persistida. El owner verá la notificación in-app aunque el email falle. La notificación es best-effort; la reserva/pago es la verdad de negocio.

**Por qué fuera de la transacción:**
- Si el dispatch fallara a mitad (ej. error de Resend), no queremos que la mutación original haga rollback.
- Permite que `EmailChannel` sea asíncrono sin bloquear el response del server action.
- El `@unique` en `notificationKey` permite reintentar sin duplicar.

### 5. Resend Decision + Domain Verification Prerequisite

**Decisión:** Resend como provider de email para el MVP.

- Next.js-native (API simple, sin SDK pesado).
- React Email templates para futuro.
- API key en `RESEND_API_KEY`, `RESEND_FROM_EMAIL` configurables.
- Plan gratuito: 3.000 emails/mes (cubre MVP).

**Prerrequisito de deployment (no técnico):** Resend requiere verificar el dominio de envío (`RESEND_FROM_EMAIL`) antes de mandar a producción. Sin verificación, los emails llegan solo a direcciones whitelisted de la cuenta. Esto es externo al código pero debe estar en la runbook de deploy.

### 6. Snapshot Rationale

`title` y `body` son **snapshots** almacenados al momento de crear la notificación, no derivados dinámicamente.

**Por qué:** si el pago se actualiza (ej. se corrige el monto), las notificaciones viejas deben seguir mostrando lo que pasó en el momento del evento. Es el mismo patrón que usa `SupportMessage` con su `body` inmutable. Esto evita inconsistencias entre "lo que pasó" y "lo que dice la notificación".

## Consequences

### Positive

- **Idempotencia perfecta**: webhook reintentado o cron duplicado no genera duplicados.
- **Canales ortogonales**: agregar SMS/WhatsApp no requiere cambiar la lógica de negocio.
- **Tests de pure functions**: `selectRemindersForDispatch`, `renderNotification`, `computeHasUnread` son testeables sin Prisma ni I/O.
- **Post-commit safety**: la mutación de negocio nunca se revierte por un fallo en el canal de notificación.

### Negative

- **Acoplamiento al milestone exacto**: no hay flexibilidad para "recordar 2-3 días antes" como ventana. Si el negocio pide flexibilidad, hay que reabrir este ADR.
- **Single timezone**: toda la app asume `America/Santiago`. Multi-país requiere refactor mayor.
- **Email como best-effort**: si Resend falla, no hay retry automático en el mismo request. El siguiente cron reintenta.

## References

- PRD-0003: `docs/prd/PRD-0003-notifications.md`
- ADR-0017: `docs/adr/0017-delegation-routing.md` — clasificación de riesgo para slices
- ADR-0020: `docs/adr/0020-business-dates-timezone.md` — zona horaria y helpers de fecha
- ADR-0001: `docs/adr/0001-adr-template.md` — webhook pattern (referencia para post-commit)
- Implementación:
  - `src/lib/notifications/channel.ts` — NotificationChannel interface
  - `src/lib/notifications/in-app-channel.ts` — InAppChannel implementation
  - `src/lib/notifications/select-reminders-for-dispatch.ts` — pure function for milestone selection
  - `src/lib/notifications/render-notification.ts` — snapshot rendering
  - `src/lib/notifications/compute-has-unread.ts` — unread state computation
  - `src/lib/domain/timezone.ts` — timezone helpers (ADR-0020 follow-up)
- Tests:
  - `src/lib/notifications/__tests__/in-app-channel.test.ts`
  - `src/lib/notifications/__tests__/select-reminders-for-dispatch.test.ts`
  - `src/lib/notifications/__tests__/render-notification.test.ts`
  - `src/lib/notifications/__tests__/compute-has-unread.test.ts`
  - `src/lib/domain/__tests__/timezone.test.ts`
