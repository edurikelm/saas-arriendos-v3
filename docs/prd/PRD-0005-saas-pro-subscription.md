# PRD-0005: SaaS PRO Self-Service Subscription (Mercado Pago)

## Problem Statement

El owner de RentalPro puede registrarse gratis (plan FREE con 3 propiedades y 5 clientes) y descubrir las limitaciones cuando intenta:

- Crear una cuarta propiedad → bloqueado por el límite FREE.
- Configurar sincronización iCal con Airbnb/Booking → bloqueado porque esa función es PRO.
- Subir documentos de reserva → bloqueado porque esa función es PRO.

Cuando quiere actualizar a PRO, el único camino es contactar a soporte por WhatsApp o email y esperar a que un `SUPER_ADMIN` modifique manualmente `UserProfile.plan` en la base de datos. Esto genera:

- **Fricción comercial**: el owner no puede comprar PRO de forma autónoma; depende de la disponibilidad del equipo.
- **Fricción operativa**: cada upgrade consume tiempo de un SUPER_ADMIN que ejecuta SQL manual.
- **Inconsistencia con el modelo SaaS**: el resto del producto (cobros de reservas, sync iCal, etc.) es self-service; el plan es el único paso que requiere un humano.
- **Imposibilidad de escalar**: mientras los upgrades sean manuales, no se puede lanzar planes anuales, descuentos por volumen o pruebas gratuitas sin intervención humana cada vez.

Los términos de dominio ya están definidos en `CONTEXT.md:107-110` ("OWNER tiene plan FREE/PRO") y la página pública `/pricing` ya documenta la promesa "Sí. Si pasas de FREE a PRO te activamos las funciones avanzadas en menos de 24 horas hábiles" (línea 347 de `pricing-page.tsx`). Pero esa promesa no es ejecutable por código: requiere un humano en el loop.

## Solution

Construir el flujo end-to-end para que el owner compre y mantenga su plan PRO sin intervención humana:

1. **Pricing dinámico real**: la página `/pricing` muestra precios en CLP (no "Consulta") y un CTA "Activar PRO" que redirige al checkout cuando el owner está autenticado.
2. **Checkout self-service**: el owner inicia la compra desde `/settings/billing`, completa el pago recurrente en Mercado Pago Checkout, y vuelve a la app con el plan activo.
3. **Suscripción recurrente con Mercado Pago Preapproval**: el owner autoriza una vez y MP cobra mensualmente. Webhooks reflejan la activación, renovación y cancelación.
4. **Cancelación al fin del período**: el owner puede cancelar desde `/settings/billing`. Sigue PRO hasta el fin del período pago y baja a FREE automáticamente (no pierde lo que ya pagó).
5. **Billing history visible**: el owner ve estado de suscripción (próximo cobro, método, últimos pagos) en `/settings/billing`.

El upgrade sigue siendo comercial (no se cobra automáticamente la primera cuota al registrarse) — el owner decide cuándo activar PRO. La cancelación nunca es inmediata; siempre respeta el período pago.

## User Stories

### Discovery y compra

1. Como Owner autenticado en plan FREE, quiero ver mi plan actual y el uso (X/3 propiedades, Y/5 clientes) en una sección dedicada, para saber qué funcionalidades me faltan.
2. Como Owner autenticado en plan FREE, quiero ver un CTA claro "Activar PRO" con el precio exacto en CLP, para entender cuánto me cuesta antes de hacer click.
3. Como Owner autenticado, quiero hacer click en "Activar PRO" y ser redirigido a Mercado Pago para autorizar el cargo recurrente, para no tener que contactar a soporte.
4. Como Owner, quiero ver una pantalla de éxito después de autorizar el cargo, para confirmar que el plan se activó.
5. Como Owner, quiero que el plan FREE siga funcionando sin cambios mientras completo el pago, para no perder acceso si la compra falla.
6. Como Owner, quiero recibir una notificación in-app + email confirmando que mi plan PRO está activo, para tener un registro.
7. Como visitante anónimo en `/pricing`, quiero ver los precios reales y un CTA "Empieza gratis" o "Activar PRO" (si estoy autenticado), para evaluar la oferta antes de registrarme.

### Gestión de suscripción activa

8. Como Owner en plan PRO, quiero ver en `/settings/billing` el estado de mi suscripción (próximo cobro, monto, fecha, método de pago), para saber cuándo me cobrarán.
9. Como Owner en plan PRO, quiero ver un historial de cargos de la suscripción, para conciliar con mis gastos.
10. Como Owner en plan PRO, quiero poder actualizar el método de pago (ir a MP y volver) si mi tarjeta vence, para no perder acceso PRO por un fallo de cobro.
11. Como Owner en plan PRO, quiero poder cancelar la suscripción, para dejar de pagar si ya no necesito las funciones.
12. Como Owner que acaba de cancelar, quiero ver claramente "Tu plan sigue activo hasta el DD/MM/AAAA", para saber hasta cuándo tengo PRO.
13. Como Owner cuya suscripción vence sin renovación (cancelada o impago), quiero recibir una notificación in-app + email avisándome que bajé a FREE, para entender por qué perdí funcionalidades.

### Casos límite y soporte

14. Como Owner, si mi primer intento de activar PRO falla (rechazo de tarjeta, fondos insuficientes), quiero ver un mensaje claro con link a reintentar o contactar a soporte, para no quedar a la deriva.
15. Como SUPER_ADMIN, quiero ver en `/admin/users/[id]` el estado de la suscripción del owner (activa, cancelada, próxima a vencer), para entender por qué un owner perdió acceso PRO sin que yo haya intervenido.
16. Como SUPER_ADMIN, quiero poder cancelar manualmente la suscripción de un owner desde el panel admin, para resolver disputas o errores operativos.
17. Como sistema, quiero que el webhook de MP sea idempotente (reintentos de MP no duplican cargos ni cambian el plan dos veces), para no romper la contabilidad.
18. Como sistema, quiero que las funciones que el owner tenía activas antes del downgrade sigan visibles después (datos no se borran), pero las funciones nuevas estén deshabilitadas, para no perder el trabajo del owner.

## Implementation Decisions

### A. Modelo Prisma nuevo: `Subscription`

**Decisión clave**: NO extender `UserProfile` con 5-6 campos nuevos. Crear un modelo `Subscription` dedicado que modela el ciclo de vida de la suscripción PRO. Esto:

- Mantiene `UserProfile` como entidad de identidad/auth, no de billing.
- Permite historial (un owner puede haber tenido varias `Subscription` en el tiempo si mejora/downgrade).
- Aísla el dominio de MP en una tabla con campos claros (`mpPreapprovalId`, `mpPlanId`, `currentPeriodEnd`).

```prisma
enum SubscriptionStatus {
  PENDING     // preapproval creada pero owner aún no autorizó en MP
  AUTHORIZED  // owner autorizó, MP cobra recurrente
  PAUSED      // owner o MP pausó (no se renueva automáticamente)
  CANCELLED   // owner o admin canceló (termina al fin del período)
  EXPIRED     // período pagado terminó sin renovación (fin natural)
  FAILED      // últimos N cobros fallaron (impago persistente)
}

model Subscription {
  id                  String             @id @default(cuid())
  userId              String             @unique  // un owner = a lo más 1 subscription activa; se cierra antes de crear nueva
  user                UserProfile        @relation(fields: [userId], references: [id])

  plan                Plan               // siempre PRO por ahora; el campo existe para futura expansión
  status              SubscriptionStatus

  // Mercado Pago identifiers
  mpPreapprovalId     String?            @unique  // id del preapproval (subscription) en MP
  mpPlanId            String?            @unique  // id del preapproval_plan (plantilla) en MP

  // Período actual (wall-time America/Santiago, ver ADR-0020)
  currentPeriodStart  DateTime?
  currentPeriodEnd    DateTime?
  nextPaymentDate     DateTime?          // próximo intento de cobro (lo que MP muestra en su panel)

  // Montos y configuración
  amount              Decimal            // CLP, snapshot del precio al momento de crear la subscription
  currency            String             @default("CLP")
  frequency           Int                @default(1)
  frequencyType       String             @default("months")  // "days" | "months"

  // Auditoría
  startedAt           DateTime           @default(now())
  cancelledAt         DateTime?          // cuándo se pidió la cancelación
  cancellationReason  String?            // "owner_request" | "admin_manual" | "payment_failed"
  createdAt           DateTime           @default(now())
  updatedAt           DateTime           @updatedAt

  events              SubscriptionEvent[]

  @@index([status])
  @@index([nextPaymentDate])
}

model SubscriptionEvent {
  id             String   @id @default(cuid())
  subscriptionId String
  type           String   // "created" | "authorized" | "renewed" | "paused" | "cancelled" | "expired" | "payment_failed" | "reactivated"
  payload        Json?    // snapshot del payload de MP
  createdAt      DateTime @default(now())

  subscription   Subscription @relation(fields: [subscriptionId], references: [id])

  @@index([subscriptionId, createdAt])
}
```

**Nota sobre `SubscriptionEvent`**: NO usamos el modelo `Notification` existente para esto. `Notification` es para comunicación al usuario. `SubscriptionEvent` es auditoría técnica de cambios de estado. Dos dominios distintos, dos tablas. Si el sistema lo requiere, `processSubscriptionEvent` puede emitir un `Notification` in-app + email como efecto secundario, pero no es el mismo registro.

**Decisión sobre `currency` y `amount`**: el modelo es fijo en CLP y 9.990 por ahora, pero se persisten en la fila para que cuando agreguemos anual u otro currency, la fila ya esté lista.

### B. Credenciales MP centralizadas (NO per-owner)

Crear variables de entorno dedicadas a la cuenta MP de RentalPro:

- `MERCADOPAGO_PRO_ACCESS_TOKEN` — access token de la cuenta MP de RentalPro.
- `MERCADOPAGO_PRO_PUBLIC_KEY` — public key (para Checkout Bricks si lo usamos después).
- `MERCADOPAGO_PRO_WEBHOOK_SECRET` — secret para verificar firma de webhooks de subscription.
- `MERCADOPAGO_PRO_CLIENT_ID` y `MERCADOPAGO_PRO_CLIENT_SECRET` — para refresh de token si la cuenta MP central usa OAuth refresh.

**Separación clara de dos integraciones MP** (ver ADR-0013 para el patrón per-owner):

| Integración | Credenciales | Cobrado a | Webhook URL |
|-------------|-------------|-----------|-------------|
| Reservas (existente) | Por owner (`UserIntegration`) | Cuenta MP del owner | `/api/webhooks/mercadopago` |
| Suscripción PRO (nuevo) | Central de RentalPro (`MERCADOPAGO_PRO_*`) | Cuenta MP de RentalPro | `/api/webhooks/mercadopago-pro` |

El módulo `src/lib/payment/pro-gateway.ts` (espejo de `gateway.ts` actual) consume las credenciales centralizadas y expone métodos para `createPreapprovalPlan`, `createPreapproval`, `updatePreapproval`, `fetchPreapproval`. Nunca toca tokens per-owner.

### C. Módulos profundos (deep modules)

**1. `lib/subscriptions/queries.ts`** — seam canónico de queries Prisma para `Subscription`. Espejo del patrón de `lib/payments/queries.ts`. Funciones puras (sin I/O) donde sea posible; con adapter opcional para `$transaction` cuando aplique.

Helpers:
- `getActiveSubscription(userId)` — devuelve `Subscription` con `status IN (AUTHORIZED, PAUSED)`.
- `getSubscriptionByPreapprovalId(mpPreapprovalId)`.
- `listSubscriptionEvents(subscriptionId, limit)`.

**2. `lib/subscriptions/state-machine.ts`** — `canTransition(from, to)` codificando la tabla:

| from \ to | PENDING | AUTHORIZED | PAUSED | CANCELLED | EXPIRED | FAILED |
|-----------|---------|-----------|--------|-----------|---------|--------|
| (none)    | ✓       |           |        |           |         |        |
| PENDING   |         | ✓         | ✓      | ✓         | ✓       |        |
| AUTHORIZED|         |           | ✓      | ✓         | ✓       | ✓      |
| PAUSED    |         | ✓         |        | ✓         | ✓       |        |
| CANCELLED |         |           |        |           | ✓       |        |
| EXPIRED   |         | ✓         |        |           |         |        |
| FAILED    |         | ✓         | ✓      | ✓         | ✓       |        |

(Fila = `from`, columna = `to`. ✓ = transición válida.)

Espejo del patrón en `lib/reservations/state-machine.ts`.

**3. `lib/subscriptions/pricing.ts`** — fuente única del precio:

```ts
export const PRO_PRICING = {
  monthly: { amount: 9990, currency: "CLP" },
  // Anual: out de scope MVP
} as const;
```

Cualquier UI o server action que necesite el precio importa de aquí. No hay magic numbers.

**4. `lib/payment/pro-gateway.ts`** — interface `ProSubscriptionGateway` con `MercadoPagoProGateway` como única implementación:

```ts
interface ProSubscriptionGateway {
  ensurePlan(): Promise<{ planId: string }>;  // crea el preapproval_plan si no existe (idempotente)
  createPreapproval(args: { userId: string; payerEmail: string; planId: string }): Promise<{ preapprovalId: string; initPoint: string }>;
  cancelPreapproval(preapprovalId: string): Promise<void>;
  fetchPreapproval(preapprovalId: string): Promise<MpPreapprovalInfo>;
}
```

Implementación: `MercadoPagoProGateway` lee `MERCADOPAGO_PRO_ACCESS_TOKEN` en cada llamada (sin caché para evitar tokens stale; el volumen es bajo).

**5. `lib/subscriptions/lifecycle.ts`** — punto único de transición de estado:

```ts
applySubscriptionEvent(event: SubscriptionEventInput): Promise<{ subscription: Subscription; planChange?: { userId: string; from: Plan; to: Plan } }>
```

Recibe un evento (de webhook, de acción de owner, de acción de admin) y:
1. Carga la `Subscription` actual.
2. Valida la transición con `canTransition`.
3. Actualiza `Subscription` y crea un `SubscriptionEvent` (en `$transaction`).
4. Si el cambio de estado implica cambio de `UserProfile.plan` (ej. `PENDING → AUTHORIZED` = `FREE → PRO`, o `EXPIRED → FREE`), llama `applyPlanChange(userId, newPlan)` con `revalidatePath`.
5. Retorna `{ subscription, planChange? }` para que el caller dispare notificaciones si corresponde.

**6. Server actions** (en `src/lib/actions/subscriptions.ts`):

- `getCurrentSubscription()` — devuelve la suscripción del owner actual o `null`.
- `startProUpgrade()` — crea `Subscription(PENDING)` + `preapproval` en MP, devuelve `{ initPoint }`. No toca plan todavía.
- `cancelMySubscription(reason)` — llama `applySubscriptionEvent({ type: "owner_cancel" })`. El estado va a `CANCELLED` pero `currentPeriodEnd` queda intacto hasta que MP mande el evento de expiración.
- `reactivateMySubscription()` — solo válido si está `CANCELLED` y aún no expiró.

### D. Webhook `/api/webhooks/mercadopago-pro`

Espejo del patrón existente en `/api/webhooks/mercadopago`, pero para topics `preapproval` y `authorized_payment`. Valida firma con `MERCADOPAGO_PRO_WEBHOOK_SECRET`. Despacha a `processSubscriptionWebhook` que llama `applySubscriptionEvent`.

Idempotencia: por `mpPreapprovalId` (único). Reintentos de MP para el mismo evento llegan al mismo `Subscription` y solo actualizan.

### E. UI `/settings/billing`

Nueva ruta dentro de `(dashboard)`. Server Component que carga `getCurrentSubscription()` y `countOwnerUsage()` (propiedades, clientes) para mostrar uso vs límites.

Componente `PlanCard` (FREE/PRO) muestra:
- Plan actual con badge.
- Si PRO: `currentPeriodEnd`, `nextPaymentDate`, monto, link "Cancelar suscripción".
- Si FREE: CTA "Activar PRO" → redirige a `startProUpgrade()` que devuelve `initPoint` de MP.

Componente `CancelSubscriptionDialog`: confirmación explícita con copy "Tu plan seguirá activo hasta DD/MM/AAAA. Después bajarás a FREE." Cumple con la decisión de cancelación al fin del período.

Sin `/settings/billing` para SUPER_ADMIN (redirige a `/admin`).

### F. Página `/pricing` actualizada

Reemplazar el CTA de PRO "Hablar con ventas" por:

- Si owner autenticado FREE: "Activar PRO" → llama `startProUpgrade()` y redirige a MP.
- Si owner autenticado PRO: "Ya tienes PRO" + link a `/settings/billing`.
- Si visitante anónimo: "Empieza gratis" → `/register`.

Actualizar `PLAN_FEATURES.pro.price` de "Consulta" a "$9.990" y `priceSuffix` de "precio según volumen" a "/ mes".

### G. Plan downgrade: ¿qué pasa con features PRO existentes?

**Decisión**: el downgrade NO desactiva ni borra datos existentes. Mantiene:

- Calendarios externos configurados: quedan inactivos (no se sincronizan automáticamente). El cron `/api/cron/external-calendars/sync` filtra por `user.plan === "PRO"` para evitar sync.
- Feeds iCal exportados: siguen siendo consultables por canales externos (no se revocan automáticamente). El owner FREE no puede revocarlos; lo hace un SUPER_ADMIN.
- Documentos de reserva: siguen descargables (la UI los oculta al FREE, pero los endpoints `/api/reservation-documents/*` no filtran por plan hoy — esto queda fuera de scope de este PRD).
- Propiedades y clientes que excedan límites (3 / 5): siguen visibles y editables. Solo se impide crear nuevos.

Esta decisión se documenta explícitamente en `/pricing` FAQ para no contradecir lo que el código hace. Hoy la FAQ dice "se desactivan las funciones que exceden el límite" — esa promesa se mantiene.

### H. Auditoría y notificaciones

- Cada transición de estado de `Subscription` crea un `SubscriptionEvent` (auditoría técnica).
- Cuando el `plan` del owner cambia como efecto secundario (FREE ↔ PRO), `applyPlanChange` se ejecuta en la misma transacción y emite:
  - Un `AdminActionLog` con `action: "PLAN_CHANGED_AUTO"` y `details: { source: "subscription_lifecycle", subscriptionId, fromPlan, toPlan }`.
  - Una `Notification` in-app + email al owner: "Tu plan ahora es PRO" o "Tu plan bajó a FREE".

Esto conecta dos PRD previos: el sistema de notificaciones (PRD-0003) y el sistema de auditoría de acciones admin.

## Testing Decisions

### Pure functions (alta cobertura)

- `canTransition` — tabla completa de transiciones (24 casos × 6 estados = ~40 asserts). Espejo del coverage de `lib/reservations/state-machine.test.ts`.
- `lib/subscriptions/pricing.ts` — verifica que `PRO_PRICING.monthly.amount === 9990` y que `currency === "CLP"`.

### Server actions (mocked Prisma + session)

- `startProUpgrade` — mockea `ProSubscriptionGateway.createPreapproval`, verifica que crea `Subscription(PENDING)` con `mpPreapprovalId` correcto y devuelve `initPoint`.
- `cancelMySubscription` — verifica que llama `applySubscriptionEvent`, NO cambia `plan` inmediatamente, marca `cancelledAt`.
- `applySubscriptionEvent` — cubre todos los caminos que afectan `plan`:
  - `PENDING → AUTHORIZED`: plan FREE → PRO.
  - `AUTHORIZED → EXPIRED`: plan PRO → FREE.
  - `AUTHORIZED → FAILED` (3+ cobros fallidos en payload): plan PRO → FREE.
- `getCurrentSubscription` — null si FREE, devuelve fila si PRO.

### Webhook route

- Auth: 401 sin firma, 401 con firma inválida, 200 con firma válida.
- Topic `preapproval` con `status: authorized` → activa plan.
- Topic `preapproval` con `status: cancelled` → marca cancelada pero no baja plan hasta `currentPeriodEnd`.
- Topic `authorized_payment` (cobro recurrente exitoso) → renueva `currentPeriodEnd`.
- Idempotencia: dos webhooks idénticos no duplican `SubscriptionEvent`.

### UI components

- `PlanCard` (PRO) muestra `nextPaymentDate` correcto, oculta CTA "Activar PRO", muestra "Cancelar".
- `PlanCard` (FREE) muestra CTA "Activar PRO" → redirige a MP.
- `CancelSubscriptionDialog` requiere confirmación explícita.

### Patrón prior art

- **Pure function + state machine**: `lib/reservations/state-machine.ts` + tests → espejo para `lib/subscriptions/state-machine.ts`.
- **Seam de queries con adapter**: `lib/payments/queries.ts` → espejo para `lib/subscriptions/queries.ts`.
- **Webhook con verificación de firma**: `src/app/api/webhooks/mercadopago/route.ts` → espejo para `/api/webhooks/mercadopago-pro`.
- **Server action hooks post-commit**: PRD-0003 patrón → espejo para emitir `Notification` desde `applySubscriptionEvent`.

## Out of Scope

- **Plan anual con descuento**: queda como follow-up; hoy solo mensual.
- **Período de prueba gratuito (trial)**: ya tienen FREE permanente; trial no aporta.
- **Múltiples suscripciones simultáneas**: 1 owner = 1 `Subscription` activa (constraint `userId @unique`).
- **Downgrade automático por impago**: hoy solo notificación; el SUPER_ADMIN decide manualmente si bajarlo.
- **Reembolso / disputes**: si MP reembolsa una cuota, solo emitimos `SubscriptionEvent("payment_failed")` y notificamos; no gestionamos disputas desde la UI.
- **Plan FREE para SUPER_ADMIN**: no aplica (SUPER_ADMIN no tiene plan).
- **Cambio de moneda o precio dinámico desde UI**: precio hardcoded en `lib/subscriptions/pricing.ts`; cambiar requiere deploy.
- **Inbox page para `SubscriptionEvent`**: solo se ven en `/admin/users/[id]` para SUPER_ADMIN.
- **Webhooks de `subscription_preapproval_plan`**: no lo necesitamos; el plan MP se crea una vez y se reusa (idempotente vía `ensurePlan`).

## Further Notes

### Decisión sobre `frequency` y `frequencyType`

Estandarizamos en MP con:

```json
"auto_recurring": {
  "frequency": 1,
  "frequency_type": "months"
}
```

`frequency` y `frequencyType` persisten en la fila `Subscription` por simetría con la API de MP, aunque hoy son siempre 1 / "months". Si en el futuro agregamos anual, ya tenemos el campo.

### Decisión sobre `webhook` vs `IPN`

MP soporta ambos. El PRD usa **webhooks** (push HTTP desde MP a nuestro endpoint) por consistencia con el resto de la integración (`/api/webhooks/mercadopago`). No usamos IPN (polling).

### Decisión sobre el helper `ensurePlan`

El `preapproval_plan` es el template que define monto, frecuencia y moneda. Lo creamos una sola vez (la primera vez que alguien intente upgrade) y guardamos el `mpPlanId` en memoria/env. Si MP lo pierde o cambiamos de cuenta MP, `ensurePlan()` lo recrea. Es idempotente: si el plan ya existe con la misma config, no hace nada.

### Decisión sobre qué pasa si el owner tenía PRO y se vuelve a registrar

No aplica — un owner no puede tener dos cuentas. El caso real es: owner PRO cancela, baja a FREE, luego quiere reactivar. Eso lo cubre `reactivateMySubscription()` (válido solo si la `Subscription` está `CANCELLED` y `currentPeriodEnd > now`).

### Cómo se relaciona con el sistema existente

- `CONTEXT.md:107-110` ya define los planes FREE/PRO y los límites. No hay contradicción.
- `CONTEXT.md:132-138` documenta el comportamiento de calendarios externos (gating PRO). El PRD respeta el patrón: el cron `/api/cron/external-calendars/sync` debe filtrar por `user.plan === "PRO"`.
- ADR-0013 (per-user-mercadopago-tokens) sigue vigente para cobros de reservas. Este PRD agrega una **segunda integración MP** con credenciales centralizadas; ambos coexisten.
- ADR-0018 (external calendar sync) ya define el gating PRO; este PRD no lo modifica, solo agrega un matiz sobre el comportamiento post-downgrade.
- PRD-0003 (notificaciones) ya tiene el `NotificationType.PAYMENT_FAILED`. Este PRD agrega `SUBSCRIPTION_ACTIVATED`, `SUBSCRIPTION_CANCELLED`, `SUBSCRIPTION_EXPIRED` a ese enum.

### Próximos pasos (post-MVP)

- Plan anual con descuento.
- Tabla de `Invoice` propia de RentalPro (boleta/factura chilena) por cada cargo de `authorized_payment`.
- Reactivación automática desde UI con un solo click (hoy requiere reintentar el flujo de upgrade).
- Métricas: MRR, churn, upgrades netos.

## Issues a crear (sub-slice breakdown)

Esta epic se rompe en los siguientes issues independientes (cada uno es un slice tracer-bullet):

1. **Schema + helpers puros** — agregar `Subscription`, `SubscriptionEvent`, `SubscriptionStatus` en Prisma. Implementar `lib/subscriptions/queries.ts`, `lib/subscriptions/state-machine.ts`, `lib/subscriptions/pricing.ts`. Migración. Tests de funciones puras.
2. **Gateway MP central** — implementar `lib/payment/pro-gateway.ts` (interface + `MercadoPagoProGateway`), `ensurePlan`, configuración de `MERCADOPAGO_PRO_*` env vars. Tests con `fetch` mockeado.
3. **Lifecycle + server actions** — `lib/subscriptions/lifecycle.ts` (`applySubscriptionEvent`), `src/lib/actions/subscriptions.ts` (`getCurrentSubscription`, `startProUpgrade`, `cancelMySubscription`, `reactivateMySubscription`). Hooks en `applyPlanChange` + emisión de `Notification` post-commit.
4. **Webhook `/api/webhooks/mercadopago-pro`** — ruta nueva, verificación de firma, dispatch a `applySubscriptionEvent`. Tests de auth, idempotencia, transición de estado.
5. **UI `/settings/billing`** — ruta nueva server + cliente, `PlanCard`, `CancelSubscriptionDialog`. Tests de componente y de flujo (FREE → click → MP → vuelve con PRO).
6. **`/pricing` actualizado** — reemplazar "Consulta" por precio real, CTAs autenticados dinámicos. Tests.
7. **Cleanup de cron iCal post-downgrade** — agregar filtro `user.plan === "PRO"` en `/api/cron/external-calendars/sync`. Test.
8. **Auditoría + notificaciones de cambios de plan auto** — emitir `AdminActionLog` y `Notification` desde `applyPlanChange` cuando el origen es `subscription_lifecycle`. Tests.
9. **ADR-0027: SaaS PRO subscription architecture** — documentar decisiones: credenciales centralizadas, modelo `Subscription`, webhook separado, política de cancelación al fin del período.