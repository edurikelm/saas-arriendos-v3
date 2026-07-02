# PRD-0003: Sistema de Notificaciones (In-App + Email)

## Problem Statement

El owner de RentalPro no recibe avisos oportunos sobre lo que pasa en su negocio. Hoy la información sobre pagos recibidos, pagos vencidos, reservas creadas/canceladas solo aparece si el owner entra a la app y navega a la sección correcta. Esto causa:

- Pagos vencidos que pasan desapercibidos hasta que el owner los descubre manualmente
- Owners que no se enteran de reservas nuevas o cancelaciones hasta horas/días después
- Fricción de soporte: owners contactan a soporte preguntando "¿recibí el pago de X?" o "¿se canceló la reserva Y?"
- Imposibilidad de escalar a más owners sin perder visibilidad

El término de dominio **"Recordatorio de Pago"** ya está definido en `CONTEXT.md:171` y `CONTEXT.md:190` (recordatorio pertenece a un pago pendiente, se dirige al owner, solo se emite para reservas en estado PENDING o CONFIRMED) pero no está implementado end-to-end.

## Solution

Construir un sistema de notificaciones con dos canales desde el día 1: **in-app** (campana con badge + dropdown en navbar) y **email** (digest + recordatorios automáticos). El sistema debe:

1. **Persistir** cada notificación como una fila en DB, con su estado de leído/no-leído por usuario (espejo del patrón `SupportTicketRead`).
2. **Dispatchar** automáticamente a email cuando aplique (pagadores con preferencia de email habilitada, recordatorios automáticos del cron diario).
3. **Surfacing in-app** vía campana en navbar con badge count y dropdown con las últimas 10 notificaciones + link a inbox completo.
4. **Hooks** en las server actions críticas del dominio (reservas, pagos) que emiten eventos cuando ocurren transiciones relevantes.
5. **Cron diario** (Vercel Cron) que identifica pagos próximos a vencer o ya vencidos y dispara recordatorios automáticos por email.

## User Stories

### In-app notifications

1. Como Owner, quiero ver un badge numérico en la campana del navbar indicando cuántas notificaciones no leí, para saber si hay algo que revisar.
2. Como Owner, quiero hacer click en la campana y ver un dropdown con las últimas notificaciones (fecha, tipo, mensaje corto), para enterarme del contexto sin navegar.
3. Como Owner, quiero que las notificaciones se marquen como leídas automáticamente al cerrar el dropdown, para no acumular notificaciones ya revisadas.
4. Como Owner, quiero tener un botón "Marcar todas como leídas" en el dropdown, para limpiar el badge cuando ya revisé todo.
5. Como Owner, quiero poder hacer click en una notificación del dropdown y navegar a la entidad relacionada (reserva, pago), para ir directo al contexto.
6. Como Super Admin, quiero recibir notificaciones in-app también, para enterarme de eventos relevantes de owners que administro.

### Email notifications

7. Como Owner, quiero recibir un email diario con el resumen de pagos que vencen hoy y los que están vencidos, para empezar el día sabiendo qué cobrar.
8. Como Owner, quiero recibir un email inmediato cuando un pago es recibido (manual o Mercado Pago), para confirmar que el pago se acreditó.
9. Como Owner, quiero recibir un email cuando una reserva es cancelada, para ajustar mi cobranza.
10. Como Super Admin, quiero recibir emails de eventos críticos del sistema (nuevo owner creado, owner suspendido), para auditoría y soporte.

### Payment reminders (Recordatorio de Pago)

11. Como Owner, quiero que el sistema me recuerde automáticamente los pagos que están por vencer (3 días antes, 1 día antes, el día del vencimiento, y después de vencer) para no tener que revisar manualmente.
12. Como Owner, quiero que un pago solo genere UN recordatorio por hito (no quiero spam), para mantener mi inbox limpio.
13. Como Owner, quiero que el recordatorio respete mi timezone de negocio (America/Santiago), para que "3 días antes" signifique días de calendario en mi zona.
14. Como Owner, quiero poder desactivar el envío de emails de recordatorios desde mi perfil, para tener control sobre lo que recibo.

### Inbox completo (futuro — out of MVP)

15. Como Owner, quiero una página `/notifications` con todas mis notificaciones, filtrable por tipo y leídas/no-leídas.
16. Como Owner, quiero que la paginación del inbox respete el patrón de `use-pagination` ya establecido en el repo.

## Implementation Decisions

### A. Modelos Prisma nuevos

**`Notification`** — fila por notificación. Espejo conceptual de `SupportTicket` pero más simple.

Campos:
- `id` (cuid, PK)
- `userId` (FK a `UserProfile` — el destinatario)
- `type` (enum `NotificationType`)
- `notificationKey` (string, **`@unique`** — clave estable de deduplicación: `payment-received:pay_abc123`, `payment-reminder:pay_abc123:DUE_TODAY`, `reservation-created:res_xyz789`, etc.)
- `title` (string, generado al crear, snapshot — no se reconstruye)
- `body` (string, generado al crear, snapshot)
- `link` (string opcional — URL interna a la entidad)
- `createdAt` (DateTime)
- `deliveredAt` (DateTime opcional — cuándo se envió por email si aplica)
- índices: `[userId, createdAt]`, `[userId, deliveredAt]` para el cron; el `@unique` en `notificationKey` ya crea índice para dedup

> **Por qué `notificationKey` es `@unique` y no derivado:** es el contrato de idempotencia. Si un webhook de Mercado Pago se reintenta 3 veces, o el cron diario se corre dos veces el mismo día, `findUnique({ where: { notificationKey } })` resuelve el duplicado sin lógica adicional. La forma exacta de la key se documenta en ADR-0021.

**`NotificationRead`** — estado de lectura por usuario. Espejo de `SupportTicketRead`.

- `id`, `notificationId` (FK), `userId` (FK), `lastReadAt` (DateTime)
- `@@unique([notificationId, userId])`
- índices: `[userId]`, `[notificationId]`

> **Anti-pattern a evitar:** NO replicar el patrón de `getUnreadSupportTicketCount` (que hace N+1 sobre tickets). El query de unread para notifications debe ser una sola SQL (`SELECT count(*) FROM Notification n LEFT JOIN NotificationRead r ON ... WHERE r.id IS NULL AND n.userId = ?`).

**`NotificationType`** (enum):
- `RESERVATION_CREATED`
- `RESERVATION_CANCELLED`
- `PAYMENT_RECEIVED`
- `PAYMENT_REMINDER` (los disparados por el cron)
- `PAYMENT_FAILED` (futuro, out de MVP)

### B. Módulos profundos (deep modules)

**1. `selectRemindersForDispatch(payments, now, timezone, remindersAlreadySent)`** — pure function.

Recibe lista de `Payment` activos con su `Reservation`, la fecha actual, y un set de "reminder keys ya enviados" (ej. `paymentId:hito`). Retorna los recordatorios a disparar ahora.

**Hitos como matches exactos de día** (no ventanas — ver rationale en ADR-0021):

| Hito | Condición (en timezone de negocio) | Días desde hoy |
|------|------------------------------------|----------------|
| `BEFORE_3_DAYS` | `dueDate` cae exactamente 3 días después de `now` | +3 |
| `BEFORE_1_DAY` | `dueDate` cae exactamente 1 día después de `now` | +1 |
| `DUE_TODAY` | `dueDate` es el mismo día calendario que `now` | 0 |
| `OVERDUE_1_DAY` | `dueDate` fue exactamente 1 día antes de `now` | -1 |
| `OVERDUE_3_DAYS` | `dueDate` fue exactamente 3 días antes de `now` | -3 |
| `OVERDUE_7_DAYS` | `dueDate` fue exactamente 7 días antes de `now` | -7 |

> **Por qué matches exactos y no ventanas:** la deduplicación depende de que `dueDate` mapee siempre al mismo hito. Si `BEFORE_3_DAYS` fuera "entre 2 y 3 días en el futuro", correr el cron dos veces en días consecutivos podría generar dos recordatorios para el mismo `paymentId`. Con `daysFromToday === 3` la key `payment-reminder:pay_abc123:BEFORE_3_DAYS` se calcula determinísticamente y el `@unique` en `notificationKey` garantiza cero duplicados.

Solo se emite un recordatorio por `(paymentId, hito)`. La deduplicación se hace por **un set de claves calculado desde la tabla de `Notification` filtrada por `type = PAYMENT_REMINDER`**.

**2. `renderNotification(notification, format)`** — pure function.

Dado un evento del dominio (creación de reserva, pago recibido, recordatorio), retorna `{ subject, html, text }` para email. Sin I/O, sin Prisma. Testeable con tablas.

Esta función decide:
- Qué subject poner (ej. "Pago recibido: Juan Pérez ($150.000)")
- Qué body en texto plano
- Qué body en HTML (estructura mínima, branding, link al detalle)

**3. `NotificationChannel`** — interfaz con dos implementaciones.

```ts
interface NotificationChannel {
  readonly name: "in-app" | "email";
  dispatch(notification: NotificationIntent, recipient: UserProfile): Promise<DispatchResult>;
}
```

- `InAppChannel` — persiste fila en `Notification` (idempotente si el `notificationKey` ya existe).
- `EmailChannel` — envía vía Resend (decisión de provider abajo), marca `deliveredAt` en la fila in-app.

Ambas usan un `notificationKey` estable (ej. `payment-received:paymentId` o `payment-reminder:paymentId:hito`) para evitar duplicados cuando un mismo evento se procesa múltiples veces (ej. webhook de MP que se reintenta).

**4. `recordDomainEvent(event)`** — punto único de emisión.

Las server actions (`createReservation`, `cancelReservation`, `processMercadoPagoWebhook`, `markPaymentAsPaid`, `revertPayment`) llaman a `recordDomainEvent` después de commitear la transacción. `recordDomainEvent`:

1. Calcula 0..N `NotificationIntent` a partir del evento.
2. Para cada intent, busca recipients (típicamente el owner; para eventos globales, todos los `SUPER_ADMIN`).
3. Dispatcha via `InAppChannel` (siempre) y `EmailChannel` (según preferencia).

**5. Helpers de unread** (espejo de `src/lib/support/unread.ts` + `src/lib/actions/support-unread.ts`):

- `computeHasUnread(notifications, lastReadByNotification)` — pure, retorna `Set<notificationId>`.
- `getUnreadNotificationCount(userId)` — action, query Prisma, retorna número.
- `markNotificationAsRead(notificationId, userId)` — action, upsert en `NotificationRead`.
- `markAllNotificationsAsRead(userId)` — action, bulk upsert.

### C. Layout-level badge count (siguiendo patrón soporte)

- `src/app/(dashboard)/layout.tsx` — agrega `getUnreadNotificationCount(session.userId)` a la query existente.
- Pasa el count a `DashboardLayoutClient` como `notificationUnreadCount`.
- `DashboardLayoutClient` reenvía a `Navbar` y al `NotificationBell`.
- `NotificationBell` renderiza el badge si `count > 0`.

### D. Notification Bell + Dropdown

- `src/components/notifications/NotificationBell.tsx` — client component, lee el badge del prop y abre un Popover (`<Popover>` de shadcn/ui, ya usado en otros lugares).
- `src/components/notifications/NotificationDropdown.tsx` — server-rendered list de las últimas 10 notificaciones, con "Marcar todas como leídas" + link a inbox.
- Mantiene el `aria-label="Notificaciones"` existente en el Bell — los tests de `dashboard-navbar.test.tsx` siguen pasando.
- Diseño mobile: el Bell en mobile header (`dashboard-layout-client.tsx:79-81`) usa el mismo componente.

### E. Email provider — Resend

Decisión: **Resend** como provider de email.

- Next.js-native (API simple, sin SDK pesado).
- React Email templates si más adelante se quiere más control.
- API key por env var (`RESEND_API_KEY`).
- `RESEND_FROM_EMAIL` y `RESEND_FROM_NAME` configurables.
- Costo: plan gratuito cubre MVP (3.000 emails/mes).

Si en el futuro se necesita otro provider, la abstracción `NotificationChannel` lo permite sin tocar la lógica de negocio.

> **Prerrequisito de deployment (no técnico, documentar en ADR-0021 §Referencias):** Resend requiere verificar el dominio desde el cual se envía (`RESEND_FROM_EMAIL`) antes de poder mandar a producción. Sin verificación, los emails llegan solo a direcciones whitelisted de la cuenta de Resend. Esto es externo al código pero debe estar en la runbook de deploy.

### F. Vercel Cron — `/api/cron/payment-reminders/dispatch`

Mirror exacto del patrón de `/api/cron/external-calendars/sync`:

- `vercel.json` agrega `{ path: "/api/cron/payment-reminders/dispatch", schedule: "0 13 * * *" }` (13:00 UTC = 10:00 America/Santiago, antes de que el owner empiece su día).
- Auth: `Bearer ${REMINDERS_CRON_SECRET}`.
- `maxDuration = 300` (5 min).
- Itera owners activos, para cada uno llama `selectRemindersForDispatch` + dispatch via `EmailChannel`.
- Retorna JSON `{ ok, totalReminders, byOwner: {...}, errors: [...] }`.
- Idempotente: si el cron se corre dos veces el mismo día, no se duplican recordatorios (la dedup vive en `Notification`).

### G. Server action hooks (4 puntos)

En `src/lib/actions/reservations.ts`:
- `createReservation` — emite `RESERVATION_CREATED` para el owner.
- `cancelReservation` — emite `RESERVATION_CANCELLED` para el owner.

En `src/lib/actions/payments.ts`:
- `markPaymentAsPaid` y `processMercadoPagoWebhook` (cuando status → COMPLETED) — emiten `PAYMENT_RECEIVED` para el owner.

Importante: estas emisiones viven **post-commit** del server action (no dentro de la transacción de Prisma, no en un `setTimeout` ni job async).

**Contrato post-commit:**
1. La server action ejecuta su mutación en una transacción Prisma.
2. Si la transacción **falla**, no se emite ninguna notificación. El estado es coherente.
3. Si la transacción **commitea**, se llama a `recordDomainEvent` **después** de retornar. Si `recordDomainEvent` falla (ej. Resend no responde), la mutación ya está persistida — el owner verá la notificación in-app aunque el email falle, y el cron de retry puede reintentar emails huérfanos en el siguiente run.

**Por qué post-commit y no in-transaction:**
- Si el dispatch falla a mitad (ej. error de Resend), queremos que la mutación original NO haga rollback. La notificación es best-effort; la reserva/pago es la verdad de negocio.
- Permite que el email channel sea asíncrono (no bloquea el response del server action).
- El `@unique` en `notificationKey` permite reintentar sin duplicar.

### H. NotificationPreference (modelo opcional)

Para mantener MVP pequeño, **NO agregamos `NotificationPreference` en este PRD**. Se entrega con defaults razonables (todas las notificaciones habilitadas). El control de "no quiero email" se hace con un solo `Boolean` global en `UserProfile`:

- `notificationsEmailEnabled: Boolean @default(true)` — toggle único en `/dashboard/settings` o similar.
- Migración: agregar la columna en una migration dedicada (no rompe nada existente).

Cuando el producto madure, esto se puede migrar a un `NotificationPreference` por tipo sin romper la API.

## Testing Decisions

### Pure functions (alta cobertura)

- `selectRemindersForDispatch` — testear con casos:
  - Pago vence en 3 días → emite `BEFORE_3_DAYS`
  - Pago vence hoy → emite `DUE_TODAY`
  - Pago vencido hace 8 días → no emite (fuera de hitos)
  - Recordatorio ya enviado para un hito → no se reemite
  - Reserva CANCELLED → no emite (constraint de CONTEXT.md)
  - Pago `paymentType = EXTRA` → no emite (solo `RESERVATION` por dominio)
  - Timezone `America/Santiago`: pago que vence "mañana UTC" pero "hoy Santiago" → emite `DUE_TODAY`
- `renderNotification` — testear con snapshot del HTML para 4 tipos de evento.
- `computeHasUnread` — espejo de los tests de `src/lib/support/__tests__/unread.test.ts`.

### Server actions (mocked Prisma + session)

- `recordDomainEvent` — mockea `InAppChannel` y `EmailChannel`, verifica que se llaman con los intents correctos.
- `markNotificationAsRead` — upsert idempotente.
- `getUnreadNotificationCount` — count correcto cuando hay mix de leídas/no-leídas.

### Cron route

- Auth: 401 sin secret, 401 con secret incorrecto, 200 con secret correcto.
- Iteration: por cada owner, llama a las funciones correctas.
- Failure isolation: si el dispatch de un owner falla, el resto sigue.
- Idempotencia: segunda corrida en el mismo día no crea duplicados.

### UI components

- `NotificationBell` — badge aparece si `count > 0`, no aparece si `count === 0`.
- `NotificationDropdown` — renderiza las 10 más recientes, "Marcar todas como leídas" funciona.
- Mantener los tests existentes de `dashboard-navbar.test.tsx:84-93` y `dashboard-layout-client.test.tsx:93-101` pasando (radio y a11y label del Bell).

### Patrón prior art

- **Pure function + I/O separado**: `classifyCollectionAlerts` + `collection-alerts-section` (lectura) → espejo para `selectRemindersForDispatch` + dispatch.
- **Unread tracking**: `SupportTicketRead` + `computeHasUnread` + `markSupportTicketAsRead`.
- **Cron con secret**: `src/app/api/cron/external-calendars/sync/route.ts`.
- **Layout-level count**: `src/app/(dashboard)/layout.tsx:17` → `DashboardLayoutClient` → `DashboardSidebar`.

## Out of Scope

- **Inbox page** (`/notifications` con todas las notificaciones, filtros, paginación) — pendiente para v2. El MVP usa solo el dropdown.
- **Per-tipo notification preferences** (cada owner elige qué tipo recibir) — solo hay un toggle global.
- **Real-time push** (SSE, WebSockets) — sigue el patrón de `router.refresh()` + `revalidatePath()`.
- **Email templates con React Email** — el MVP usa HTML inline simple generado por `renderNotification`.
- **SMS / WhatsApp** channels — solo in-app + email en MVP.
- **Notification digests semanales/mensuales** — solo el cron diario.
- **Retry on email failure** — si el email falla, se loguea y se reintenta en la próxima corrida.
- **Owner que desactiva emails globalmente Y no recibe recordatorios importantes** — se asume que si desactiva, acepta la pérdida (puede verlo en el inbox in-app).
- **Borrar notificaciones viejas** — decisión pendiente para v2 (¿6 meses? ¿1 año?).

## Further Notes

### Por qué el nombre "recordatorio" se preserva

`CONTEXT.md:171` define "Recordatorio de Pago" como término de dominio. La nueva `Notification` con `type = PAYMENT_REMINDER` es la implementación. Los términos siguen siendo los del dominio — el modelo `Notification` es la materialización técnica.

### Por qué `title`/`body` son snapshots, no derivados

Si el pago se actualiza (ej. se corrige el monto), las notificaciones viejas deben seguir mostrando lo que pasó en el momento del evento. Es el mismo patrón que usa `SupportMessage` con su `body` inmutable.

### Decisión sobre `notificationKey`

Cada `NotificationIntent` lleva un `notificationKey` estable (ej. `payment-received:pay_abc123`, `payment-reminder:pay_abc123:DUE_TODAY`, `reservation-created:res_xyz789`). El `InAppChannel` hace un `findUnique({ where: { notificationKey } })` antes de crear — si ya existe, no duplica. Esto resuelve el problema de webhooks de MP que se reintentan y del cron diario que se corre dos veces.

**Convención de formato de la key (canonical, a documentar en ADR-0021):**

| Evento | Formato | Ejemplo |
|--------|---------|---------|
| `RESERVATION_CREATED` | `reservation-created:{reservationId}` | `reservation-created:clxyz123abc` |
| `RESERVATION_CANCELLED` | `reservation-cancelled:{reservationId}` | `reservation-cancelled:clxyz123abc` |
| `PAYMENT_RECEIVED` | `payment-received:{paymentId}` | `payment-received:clpay456def` |
| `PAYMENT_REMINDER` | `payment-reminder:{paymentId}:{MILESTONE}` | `payment-reminder:clpay456def:DUE_TODAY` |
| `PAYMENT_FAILED` (futuro) | `payment-failed:{paymentId}:{status}` | `payment-failed:clpay456def:REJECTED` |

> **Convención derivada de la constraint de idempotencia:** los hitos se calculan determinísticamente desde `paymentId` + estado del pago, no desde `now`. Esto es lo que permite que el cron pueda re-ejecutarse sin generar duplicados.

### Decisión sobre timezone

ADR-0020 deja como follow-up la consolidación de `BUSINESS_TIME_ZONE = "America/Santiago"` en un módulo `src/lib/domain/timezone.ts` con helpers `todayInBusinessTz(now)` y `daysFromNowInBusinessTz(date, now)`. El slice #167 gatilla este follow-up (es Nivel 1, atómico con la fundación). El nuevo módulo se reutiliza desde `selectRemindersForDispatch` y desde cualquier otra lógica de fechas de negocio que pueda necesitarse.

### Próximos pasos (post-MVP)

- Inbox page `/notifications` con paginación y filtros.
- Migrar `notificationsEmailEnabled` a `NotificationPreference` por tipo.
- Push notifications vía Web Push API para owners que lo activen.
- Métricas: cuántas notificaciones se generan, cuántas se leen, cuántas generan click-through al link.

## Issues a crear (sub-slice breakdown)

Esta epic se rompe en los siguientes issues independientes (cada uno es un slice tracer-bullet):

1. **Schema + helpers puros** — agregar `Notification`, `NotificationRead`, `NotificationType` en Prisma. Implementar `selectRemindersForDispatch`, `renderNotification`, `computeHasUnread`. Tests de las funciones puras.
2. **Canales + recordDomainEvent** — implementar `NotificationChannel` interface, `InAppChannel`, `EmailChannel` (con Resend), `recordDomainEvent`. Tests con mocks.
3. **Hooks en server actions** — integrar `recordDomainEvent` en `createReservation`, `cancelReservation`, `markPaymentAsPaid`, `processMercadoPagoWebhook`. Tests de integración.
4. **UI Bell + Dropdown** — `NotificationBell`, `NotificationDropdown`, integrar en `DashboardLayoutClient` y mobile header. Tests de componente.
5. **Layout-level badge count** — agregar `getUnreadNotificationCount` en layout, propagar via props. Tests de flujo.
6. **Cron `/api/cron/payment-reminders/dispatch`** — implementar ruta, integrar en `vercel.json`, tests de auth e idempotencia.
7. **Toggle email preference** — agregar `notificationsEmailEnabled` en `UserProfile`, UI en settings. Tests.
8. **ADR-0021: Notifications architecture** — documentar el modelo de canales, el `notificationKey`, la decisión de Resend, el patrón "post-commit dispatch".
