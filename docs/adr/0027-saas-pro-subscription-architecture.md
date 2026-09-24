# ADR-0027: SaaS PRO Self-Service Subscription Architecture

## Estado

Aceptado — 2026-07-20

## Contexto

Hoy RentalPro vende un plan PRO que el owner no puede comprar. El único camino es contactar a soporte y esperar a que un `SUPER_ADMIN` ejecute manualmente `prisma.userProfile.update({ plan: "PRO" })`. Esto bloquea el modelo SaaS: no podemos lanzar planes anuales, descuentos por volumen, ni escalar el producto sin contratar más gente de soporte.

Necesitamos que el owner compre y mantenga su plan PRO de forma autónoma, usando Mercado Pago como procesador de pagos recurrentes (modelo estándar SaaS).

Este ADR documenta las decisiones arquitectónicas que permiten ese flujo. Las user stories, planes de implementación y criterios de aceptación viven en [`docs/prd/PRD-0005-saas-pro-subscription.md`](../prd/PRD-0005-saas-pro-subscription.md).

## Decisiones

### 1. Credenciales MP centralizadas para la suscripción PRO

RentalPro mantiene su **propia cuenta de Mercado Pago** con credenciales dedicadas, separadas de las credenciales por-owner que ya usa para cobrar reservas.

**Variables de entorno nuevas:**

| Variable | Propósito |
|----------|-----------|
| `MERCADOPAGO_PRO_ACCESS_TOKEN` | Token de la cuenta MP de RentalPro (cobros de suscripción) |
| `MERCADOPAGO_PRO_PUBLIC_KEY` | Public key para Checkout Bricks si lo usamos después |
| `MERCADOPAGO_PRO_WEBHOOK_SECRET` | Secret para verificar firma de webhooks de subscription |

**Por qué credenciales centralizadas y no por-owner:**

- El plan PRO se cobra a RentalPro (SaaS), no a un huésped (reserva). El owner paga a RentalPro por usar el software.
- Si usáramos las credenciales del owner, el owner se pagaría a sí mismo (sin sentido).
- Permite a RentalPro gestionar impuestos, facturación y conciliaciones en una sola cuenta.
- Mantiene el patrón de ADR-0013 (per-user tokens) intacto: las dos integraciones MP coexisten sin acoplarse.

**Por qué separadas del token manual que ya existe (`MERCADOPAGO_ACCESS_TOKEN`):**

- Hoy `MERCADOPAGO_ACCESS_TOKEN` se usa solo en dev cuando `MP_MANUAL_TOKEN_ENABLED=true`. Mezclar desarrollo con producción de suscripciones es riesgoso.
- Separación clara: dev/test usa una cuenta, prod usa otra, sin colisión de variables.

**Tabla resumen de las dos integraciones MP:**

| Integración | Credenciales | Cobrado a | Webhook URL |
|-------------|-------------|-----------|-------------|
| Reservas (existente) | Por owner (`UserIntegration`) | Cuenta MP del owner | `/api/webhooks/mercadopago` |
| Suscripción PRO (nuevo) | Central de RentalPro (`MERCADOPAGO_PRO_*`) | Cuenta MP de RentalPro | `/api/webhooks/mercadopago-pro` |

### 2. Modelo `Subscription` dedicado (no extender `UserProfile`)

Creamos un modelo `Subscription` con relación 1:1 a `UserProfile` (constraint `userId @unique`). No agregamos 5-6 campos nuevos a `UserProfile`.

**Rationale:**

- `UserProfile` es la entidad de identidad/auth. Mantenerla limpia hace que el dominio de auth no quede acoplado al de billing.
- Una `Subscription` modela el ciclo de vida completo: `PENDING → AUTHORIZED → CANCELLED → EXPIRED` (o `FAILED`). Codificar esto en una tabla dedicada es más claro que dispersar booleanos en `UserProfile`.
- Permite historial futuro: si un owner mejora → downgrade → mejora de nuevo, queda el rastro en `SubscriptionEvent` aunque la fila `Subscription` se reuse.
- Aísla campos específicos de MP (`mpPreapprovalId`, `mpPlanId`, `currentPeriodEnd`) en un solo lugar.

**Decisión sobre `SubscriptionEvent` separado de `Notification`:**

- `Notification` es **comunicación al usuario** (in-app + email).
- `SubscriptionEvent` es **auditoría técnica** de cambios de estado de la suscripción.
- Dos dominios distintos, dos tablas. Si el sistema lo requiere, `applySubscriptionEvent` emite `Notification` como efecto secundario, pero son registros separados.

### 3. Cancelación al fin del período (NO inmediata)

Cuando el owner cancela, el plan sigue PRO hasta `currentPeriodEnd`. El downgrade a FREE ocurre cuando MP emite el evento de expiración.

**Rationale:**

- Estándar SaaS: el owner no se siente estafado si cancela 3 días antes del cobro.
- Mantiene la promesa del FAQ actual: "Si vuelves a FREE conservas todos tus datos".
- Permite conciliación correcta: si el owner pagó el mes completo, debe tener acceso durante ese mes.

**Implementación:**

- `cancelMySubscription()` marca `status = CANCELLED` y `cancelledAt`, pero NO cambia `UserProfile.plan`.
- El cambio real ocurre cuando el webhook de MP envía el evento de expiración, o cuando un cron diario (`EXPIRED_CHECK`) detecta que `currentPeriodEnd < now AND status IN (AUTHORIZED, CANCELLED)`.

**Por qué NO cancelación inmediata:**

- Si el owner pagó $9.990 el día 1 y cancela el día 15, sería injusto quitarle PRO al toque.
- La cancelación inmediata solo aplica si el owner lo pide explícitamente vía soporte y un SUPER_ADMIN lo ejecuta manualmente (caso edge, fuera de scope del PRD).

**Cancelación de owner y de admin cancelan el mismo preapproval (evita doble cobro):** tanto `cancelMySubscription` como `adminCancelSubscription` (`/admin/users/[id]`) cancelan primero el preapproval en Mercado Pago (vía el helper compartido `ensurePreapprovalCancelled`, `src/lib/subscriptions/mp-preapproval.ts`) y solo después aplican el evento de lifecycle — si la llamada a MP falla, ninguno de los dos toca el estado local ni escribe auditoría (`AdminActionLog` en el caso admin), y el operador puede reintentar. Antes de este fix, `adminCancelSubscription` marcaba `CANCELLED` localmente sin cancelar en MP, así que la cuenta central de RentalPro seguía cobrando al owner cada mes hasta que alguien lo notara manualmente. El evento `admin_cancel`/`owner_cancel` y el `AdminActionLog` correspondiente registran `mpOutcome` (`"cancelled"` | `"already_cancelled"` | `"not_found"` | `"no_preapproval"`, este último solo cuando la fila nunca tuvo `mpPreapprovalId`) para que la auditoría distinga qué encontró RentalPro del lado de MP, no solo si "canceló o no".

Hay una carrera posible entre el webhook de MP y la cancelación del admin: si el webhook `cancelled` de MP llega y se procesa antes que `adminCancelSubscription` alcance a aplicar su propio evento, la fila local ya está `CANCELLED` cuando `admin_cancel` intenta transicionarla — la Idempotencia A de `applySubscriptionEvent` (mismo estado destino) no vuelve a escribir `admin_cancel`, sino que registra el evento como `duplicate`. El `AdminActionLog` sí queda igual (la acción del admin ocurrió), pero el `SubscriptionEvent` de esa cancelación en particular es `duplicate`, no `admin_cancel`.

**`startProUpgrade` también verifica el preapproval anterior antes de reemplazar la fila, para que nunca quede más de un preapproval vivo por owner:** una fila EXPIRED/FAILED/CANCELLED-expirada puede seguir teniendo un preapproval vivo en MP. Dos fuentes conocidas de ese estado inconsistente: (1) `adminCancelSubscription` antes de este fix, que marcaba `CANCELLED` sin cancelar en MP; (2) un webhook de renovación que nunca llegó — el cron `EXPIRED_CHECK` marca localmente EXPIRED por `currentPeriodEnd < now`, sin enterarse de si MP sigue cobrando ese preapproval. `ensurePreviousPreapprovalStopped` (`src/lib/actions/subscriptions.ts`, usa el mismo helper `ensurePreapprovalCancelled`) consulta el estado en MP y cancela si no es `"cancelled"`, ANTES de la transacción de reemplazo — no dentro, ver el docblock de la función para el detalle de por qué. Si la consulta o la cancelación fallan (salvo 404, que se interpreta como "MP ya no lo reconoce"), no se borra la fila vieja ni se crea un preapproval nuevo.

**Preapprovals huérfanos previos a este fix:** esta protección previene casos nuevos hacia adelante, pero no reconcilia retroactivamente preapprovals que hayan quedado vivos por una `adminCancelSubscription` anterior a este cambio. Si hiciera falta esa reconciliación en algún momento: buscar en el panel de MP por `payer_email` o por el prefijo de `external_reference` (`{userId}:`, ver §1), y revisar los eventos `payment_unapplied` y los warnings "Subscription not found" del webhook (`/api/webhooks/mercadopago-pro`) como señal de cobros que ya no tenían dónde aplicarse. A la fecha de este fix, la base de producción no tiene ninguna `Subscription` con `mpPreapprovalId` poblado, así que no hay preapprovals huérfanos que reconciliar hoy — el caso queda documentado para si aparece más adelante.

**No existe "reactivar" una suscripción `CANCELLED` (Issue #195):** `cancelMySubscription` cancela el preapproval en Mercado Pago, y un preapproval cancelado en MP es terminal — no se puede "descancelar". Mientras `currentPeriodEnd` siga vigente, el owner mantiene PRO (lo deriva `resolveEffectivePlan`, no un flag de reactivación); una vez vencido el período, el owner vuelve a PRO con `startProUpgrade` ("Activar PRO"), que crea un preapproval **nuevo**. Una reactivación que hubiera creado ese preapproval nuevo mientras el período viejo seguía vigente habría cobrado de inmediato, duplicando el cobro de los días ya pagados — por eso se eliminó el flujo `reactivateMySubscription` y el botón "Reactivar PRO" de la UI, reemplazado por copy que explica la fecha de vigencia y, en su momento, el mismo CTA de activar PRO.

**Ronda 2 de #195 — la reactivación tampoco era alcanzable desde la UI, por una razón distinta:** `getCurrentSubscription` (la lectura que usan billing, settings, dashboard y pricing) delegaba en `getActiveSubscription`, que filtra `status IN (PENDING, AUTHORIZED, PAUSED)`. Una `CANCELLED` — vigente o no — nunca calzaba ese filtro, así que la UI de owner recibía `null` y mostraba FREE + "Activar PRO" incluso con el período pagado todavía corriendo; al hacer click, `startProUpgrade` chocaba con `userId @unique` (P2002) porque la fila `CANCELLED` seguía viva. `getCurrentSubscription` ahora delega en `getOwnerSubscription` (trae la fila sin filtrar por status) y `startProUpgrade` usa `canStartUpgrade` (`src/lib/subscriptions/upgrade-eligibility.ts`) tanto en su pre-check como en el re-check dentro de la transacción, para dar el mismo error amigable en vez de P2002 si el estado cambió entre medio.

### 4. Downgrade por impago: solo notificación, sin automatización

Si el cobro recurrente falla (tarjeta vencida, fondos insuficientes), MP reintenta automáticamente. RentalPro solo:

1. Registra `SubscriptionEvent("payment_failed")` cada fallo.
2. Emite `Notification` in-app + email al owner avisando.
3. NO cambia `UserProfile.plan` automáticamente.

**Rationale:**

- MP ya gestiona reintentos automáticamente (4-5 intentos en ~15 días).
- Bajar automáticamente al owner tras 1 fallo es agresivo y puede causar churn evitable.
- El owner tiene tiempo de actualizar su tarjeta antes del siguiente reintento.
- Si tras todos los reintentos MP marca la suscripción como `EXPIRED` o el owner no actualiza, recién ahí bajamos a FREE.

**Out of scope para este PRD:** una política configurable de "downgrade tras N fallos". Queda como follow-up si el equipo observa churn por impago persistente.

### 5. Downgrade NO desactiva features existentes

Cuando un owner baja a FREE, sus datos persisten. Solo se desactivan las funciones nuevas (crear calendarios iCal, subir documentos, crear más propiedades/clientes). Los datos existentes quedan visibles y editables.

**Rationale (mantiene lo que el FAQ ya promete):**

- "Tus reservas, clientes, propiedades y pagos no se eliminan."
- "Solo se desactivan las funciones que exceden los límites del plan FREE."

**Implicaciones técnicas:**

- Calendarios externos configurados: el cron `/api/cron/external-calendars/sync` filtra por `user.plan === "PRO"` para no sincronizar. Los calendarios no se borran (el owner puede volver a PRO y recuperarlos).
- Feeds iCal exportados: siguen siendo consultables por canales externos (no se revocan automáticamente). El owner FREE no puede revocarlos desde la UI (acción gated PRO); un SUPER_ADMIN puede hacerlo manualmente.
- Propiedades y clientes que excedan límites FREE (3 / 5): siguen visibles. Solo se impede crear nuevos. Esto contradice el FAQ actual que dice "quedan ocultos" — actualizamos el FAQ para reflejar el comportamiento real.
- Documentos de reserva: la UI los oculta al FREE, pero los endpoints siguen accesibles. Esto es un gap pre-existente que queda fuera de scope de este PRD.

**Restauración al reactivar PRO (Issue #224):** cuando el owner reactiva PRO después de un downgrade, los Calendarios Externos y Bloqueos de Canal Externo soft-stoppeados se restauran vía `restoreExternalCalendars(userId, snapshot, tx)`. El snapshot se persiste en `SubscriptionEvent.payload.downgradeSnapshot` del evento `expired`/`expired_check` correspondiente. La búsqueda del snapshot es por `userId` (no por `subscriptionId`) para sobrevivir tanto al reuso de fila de Subscription como a una eventual creación de nueva fila.

### 6. Webhook separado para suscripciones

`/api/webhooks/mercadopago-pro` (nuevo) maneja solo topics `preapproval` y `authorized_payment`. El webhook existente `/api/webhooks/mercadopago` (reservas) sigue manejando `payment` y `merchant_order`.

**Rationale:**

- Separación de dominios: cada webhook tiene un solo `secret` y una sola responsabilidad.
- Permite escalar: si MP suspende una integración, no afecta la otra.
- Permite distintos `MERCADOPAGO_PRO_WEBHOOK_SECRET` y `MERCADOPAGO_WEBHOOK_SECRET`.
- Reduce blast radius: un bug en la lógica de suscripción no rompe cobros de reservas.

**Idempotencia:**

- Ambos webhooks son idempotentes por `mpPreapprovalId` o `mpPaymentId` (unique).
- Reintentos de MP para el mismo evento llegan al mismo registro y solo actualizan.
- `SubscriptionEvent` tiene un índice `(subscriptionId, createdAt)`; la lógica de dedupe vive en el caller cuando es necesaria.

**Correlación de cobros (#190):** el topic `authorized_payment` solo trae el id del cobro, no el preapproval al que pertenece — el webhook consulta `GET /authorized_payments/{id}` para obtener `preapproval_id` y el resultado del payment, y recién ahí resuelve la `Subscription` local por `mpPreapprovalId`. Buscar "cualquier" subscription `AUTHORIZED` (como hacía la versión original) renovaba la del owner equivocado en cuanto había 2+ suscripciones PRO vigentes. Un cobro `approved` sobre una subscription que sigue `AUTHORIZED` dispara `renewed`, con `currentPeriodEnd` tomado del `next_payment_date` fresco del preapproval (o `debit_date` + 1 mes si viene ausente o no queda al menos medio período después del débito, porque MP puede no haberlo avanzado todavía cuando emite el webhook). Un cobro `rejected` dispara `payment_failed`, sin tocar el estado. Un `approved` sobre una subscription que no está `AUTHORIZED` (PENDING, PAUSED, CANCELLED, EXPIRED, FAILED) se registra como `payment_unapplied`, solo auditoría — reactivarla automáticamente es una decisión de producto pendiente. La idempotencia de estos tres casos vive en `SubscriptionEvent.payload` (`mpAuthorizedPaymentId` / `mpPaymentId`), no en una columna única, porque un mismo `authorized_payment` puede reintentar cobros rechazados con `payment_id` distinto cada vez.

### 7. Precio hardcoded en `lib/subscriptions/pricing.ts`

```ts
export const PRO_PRICING = {
  monthly: { amount: 9990, currency: "CLP" },
} as const;
```

**Rationale:**

- El precio puede vivir en código porque cambiarlo requiere deploy (decisión de negocio).
- Cualquier UI o server action que necesite el precio importa de aquí. No hay magic numbers.
- Migrar a una tabla `Plan` configurable desde UI es un follow-up cuando haya necesidad real (ej. planes anuales con descuento).

### 8. `preapproval_plan` reutilizable e idempotente

El template de plan (`/v1/preapproval_plan`) se crea una sola vez. `MercadoPagoProGateway.ensurePlan()` lo crea si no existe, y guarda el `mpPlanId` en una env var (`MERCADOPAGO_PRO_PLAN_ID`).

**Rationale:**

- No queremos crear un plan MP por cada suscripción nueva (contaminaría el panel de MP).
- `ensurePlan()` es idempotente: si MP ya tiene el plan con la misma config, no hace nada.
- Si cambiamos de cuenta MP, `ensurePlan()` lo recrea con la nueva cuenta.

### 9. Una sola `Subscription` activa por owner

Constraint `userId @unique` en `Subscription`. Mientras la fila `CANCELLED` sigue con `currentPeriodEnd` vigente, ocupa el `userId @unique` y el owner no puede iniciar un upgrade nuevo (`startProUpgrade` lo bloquea explícitamente — no hay reactivación, ver §3). La transición `CANCELLED → AUTHORIZED` se mantiene en `state-machine.ts` por completitud del modelo (out of scope de #195 tocarla), pero ningún flujo de owner la dispara hoy.

**Rationale:**

- Mantiene el historial en una sola fila (más simple de consultar).
- Permite `listSubscriptionEvents` para auditar todo el ciclo de vida.

**Excepción (EXPIRED / FAILED — Issue #225):** cuando el owner intenta reactivarse desde estado `EXPIRED` o `FAILED`, `startProUpgrade()` ejecuta dentro de una transacción atómica:
1. Borra los `SubscriptionEvent` de la fila vieja (FK `RESTRICT` lo exige).
2. Hard-delete la fila `Subscription` vieja.
3. Crea la nueva fila `Subscription(PENDING)` vía `applySubscriptionEvent({ type: "created" }, tx)`.

El `AdminActionLog` con action `SUBSCRIPTION_REPLACED` registra el reemplazo (`adminId = userId` del owner, no un placeholder del sistema).

Si el delete o el create falla, la transacción entera aborta → la fila vieja se mantiene intacta y el owner recibe error. Esto es failure-safe: nunca perdemos la fila EXPIRED sin haber creado el reemplazo.

La búsqueda del downgrade snapshot para restaurar recursos externos en la reactivación usa `userId` (no `subscriptionId`) — esto es independiente del replace porque el snapshot se registra en `SubscriptionEvent.payload.downgradeSnapshot` del evento `expired`/`expired_check`, que sobrevive al delete de la fila (los eventos se borran primero, y el snapshot se busca por `userId`). Ver ADR-0027 §5 para el detalle de restauración.

## Consecuencias

### Positivas

- El owner puede comprar PRO de forma autónoma, sin esperar a un SUPER_ADMIN.
- RentalPro puede lanzar planes anuales, descuentos y trials sin reescribir el modelo.
- El modelo `Subscription` es testeable de forma aislada (pure functions + mocks).
- El sistema de notificaciones existente (PRD-0003) se reutiliza para avisar al owner.
- El sistema de auditoría admin (AdminActionLog) se reutiliza para registrar cambios de plan automáticos.

### Negativas / trade-offs

- Dos integraciones MP separadas incrementan la superficie a mantener. Mitigación: ADR-0026 ya establece el patrón de gateway, lo replicamos.
- Si el owner olvida renovar su método de pago, baja a FREE silenciosamente tras los reintentos de MP. Mitigación: notificaciones in-app + email durante el período de reintentos.
- El constraint `userId @unique` requiere migración cuidadosa si en el futuro queremos múltiples subscriptions (ej. plan anual + add-ons). Mitigación: la decisión se documenta y se puede revertir en un ADR futuro.
- El precio hardcoded requiere deploy para cambiarlo. Mitigación: trivial (un cambio de un número) y permite control de versión del pricing.

### Riesgos conocidos

- **MP rechaza el cargo del primer intento**: el owner ve un error y debe reintentar. La UI muestra el mensaje de MP claramente. Si el problema es sistémico (ej. MP caído), no hay fallback — depende de MP.
- **Webhook de MP se pierde**: el cron diario `EXPIRED_CHECK` detecta inconsistencias (Subscription activa pero `currentPeriodEnd < now`) y aplica el downgrade. Esto cubre el caso "MP nunca notificó la expiración".
- **Cuenta MP de RentalPro suspendida por KYC**: si MP suspende la cuenta central, todos los upgrades nuevos fallan. Mitigación: documentar runbook de contingencia (cambiar de cuenta MP, regenerar `preapproval_plan`).

## Alternativas consideradas

### A. Cobrar PRO al MP del owner

Rechazado: contradice el modelo de negocio. El owner no se paga a sí mismo por usar el software; el dinero va del owner a RentalPro.

### B. Extender `UserProfile` con campos de subscription

Rechazado: contamina `UserProfile` con dominio de billing. Hace el modelo más difícil de testear y versionar.

### C. Stripe en vez de Mercado Pago

Rechazado por ahora: el resto del producto usa MP (ADR-0013). Agregar Stripe incrementa la superficie sin un beneficio claro para el owner chileno/latinoamericano. Stripe queda como follow-up si el producto se expande a otros mercados.

### D. Cancelación inmediata

Rechazado: contradice la promesa del FAQ y el estándar SaaS. El owner que paga el mes tiene derecho a usarlo completo.

### E. Downgrade automático tras 1 fallo de cobro

Rechazado: MP ya reintenta. Sería agresivo y causaría churn evitable.

### F. Plan anual desde el MVP

Rechazado: agrega complejidad de pricing, prorrateo y migración de plan. El MVP mensual es suficiente para validar el producto. Anual queda como follow-up.

### G. Trial gratuito de 14 días

Rechazado: el plan FREE ya es "trial permanente". Agregar un trial de PRO encima sería redundante. Si en el futuro queremos trial, se puede agregar creando un `SubscriptionStatus.TRIALING` sin romper el modelo.

## Referencias

- PRD-0005-saas-pro-subscription.md (este ADR lo complementa)
- ADR-0001: Mercado Pago webhook integration (patrón de webhook con verificación de firma)
- ADR-0013: Per-user Mercado Pago tokens (decisión sobre credenciales por-owner para reservas)
- ADR-0018: External calendar sync (gating PRO, comportamiento post-downgrade)
- ADR-0020: Business dates timezone (fechas de `currentPeriodEnd` en `America/Santiago`)
- ADR-0026: MP payment metadata storage (patrón de `gateway.ts` interface + adapter)
- PRD-0003: Notifications (sistema de notificaciones reutilizado para avisar cambios de plan)
- CONTEXT.md:107-110 (definición de planes FREE/PRO)
- CONTEXT.md:352-377 (seams de dominio en `src/lib/`)

## Prerrequisitos de deployment (no técnicos)

- Crear cuenta MP de RentalPro en producción. Documentar en runbook.
- Verificar dominio desde el cual se envían emails (Resend) — ya cubierto por PRD-0003.
- Configurar webhook URL en el panel de MP: apuntar `MERCADOPAGO_PRO_WEBHOOK_SECRET` a `/api/webhooks/mercadopago-pro`.
- Configurar `MERCADOPAGO_PRO_*` env vars en Vercel.
- Verificar que la cuenta MP central tiene habilitada la API de `preapproval` (no todas las cuentas la tienen por defecto — solicitar a MP).