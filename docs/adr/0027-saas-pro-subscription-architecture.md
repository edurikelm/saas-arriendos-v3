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
- Propiedades y clientes que excedan límites FREE (3 / 5): siguen visibles. Solo se impide crear nuevos. Esto contradice el FAQ actual que dice "quedan ocultos" — actualizamos el FAQ para reflejar el comportamiento real.
- Documentos de reserva: la UI los oculta al FREE, pero los endpoints siguen accesibles. Esto es un gap pre-existente que queda fuera de scope de este PRD.

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
- `SubscriptionEvent` se crea con un índice compuesto `(subscriptionId, type, createdAt)` para que la lógica de dedupe viva en el caller si es necesario.

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

Constraint `userId @unique` en `Subscription`. Si un owner cancela y luego quiere volver a PRO, NO se crea una nueva fila: se reactiva la existente (transición `CANCELLED → AUTHORIZED`) llamando `reactivateMySubscription()`.

**Rationale:**

- Mantiene el historial en una sola fila (más simple de consultar).
- Permite `listSubscriptionEvents` para auditar todo el ciclo de vida.

**Excepción:** si la `Subscription` ya pasó a `EXPIRED` (más de 1 ciclo cerrado), se crea una nueva fila para empezar de cero. Esta lógica vive en `startProUpgrade()`.

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