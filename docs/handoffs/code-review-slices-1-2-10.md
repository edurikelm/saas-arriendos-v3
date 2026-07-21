# Code Review — Slices 1, 2, 10 (Foundation)

**Fecha**: 2026-07-21
**Rama**: `feature/saas-pro-subscription`
**Commits revisados**: `4c786d3`, `8c20796`, `260d13f`, `173d4cf`
**Rama base**: `master` @ `c24111b`
**Issues**: #186, #187, #188

## Resumen ejecutivo

Los 3 slices sin dependencias del PRD-0005 quedaron bien implementados. Baseline verde (1379 tests passing, typecheck 0 errores, migración aplicada). Se encontraron **2 hallazgos preocupantes de severidad media** que deben abordarse en el Slice 3 (lifecycle), no en estos commits.

**Recomendación**: mergear los 3 commits a `master` después de:

1. Decidir el approach para idempotencia de webhooks (ver Hallazgo #1).
2. Confirmar que el cambio `select → include` en el cron iCal no rompe nada en producción (ver Hallazgo #2).

---

## Lo que cambió (resumen)

```
.gitignore                                                         |   2 +
.env.example                                                       |  13 +
docs/adr/0027-saas-pro-subscription-architecture.md                | 241 ++++++
docs/prd/PRD-0005-saas-pro-subscription.md                         | 374 +++++
prisma/migrations/20260721000000_add_subscription_model/migration.sql |  59 ++
prisma/schema.prisma                                               |  55 ++
src/app/api/cron/external-calendars/sync/route.ts                  |   6 +-
src/app/api/cron/external-calendars/sync/__tests__/route.test.ts   | 102 +++-
src/lib/payment/__tests__/pro-gateway.test.ts                      | 402 ++++++
src/lib/payment/pro-gateway.ts                                     | 195 +++
src/lib/subscriptions/__tests__/pricing.test.ts                    |  39 ++
src/lib/subscriptions/__tests__/queries.test.ts                    | 246 +++++
src/lib/subscriptions/__tests__/state-machine.test.ts              | 206 ++++
src/lib/subscriptions/pricing.ts                                   |  21 +
src/lib/subscriptions/queries.ts                                   |  97 ++
src/lib/subscriptions/state-machine.ts                             |  94 ++
```

**Total**: 16 archivos, +2144 líneas, -8 líneas.

---

## Hallazgos positivos (lo que está bien)

### ✅ ADR-0013 intacto

`git diff master..HEAD -- src/lib/payment/gateway.ts` retorna vacío. La integración per-owner de MP para cobros de reservas NO fue tocada. La nueva integración PRO vive en archivo separado (`pro-gateway.ts`) con prefijo `Pro` en todos los nombres.

### ✅ Migración aplicada

`npx prisma migrate status` reporta `Database schema is up to date!`. La nueva migración `20260721000000_add_subscription_model` está corriendo en la DB.

### ✅ State machine correcta

`src/lib/subscriptions/state-machine.ts` codifica la tabla 6x6 del PRD § A exactamente. Caso especial `(null) → PENDING` manejado explícitamente para creación desde cero. Cobertura de tests: **68 asserts** (todos los pares from/to).

### ✅ Pricing como single source of truth

`PRO_PRICING.monthly = { amount: 9990, currency: "CLP", frequency: 1, frequencyType: "months" }`. Constante `as const` con tipo derivado `ProPricing`. Hardcoded según ADR § Decisión 7.

### ✅ Gateway bien aislado

- Lee `MERCADOPAGO_PRO_ACCESS_TOKEN` en cada llamada (no caché stale).
- Lanza `Error("MERCADOPAGO_PRO_ACCESS_TOKEN is not configured")` si falta env var.
- Factory singleton con `clearProGatewayCache()` para tests.
- `ensurePlan()` retorna env var si existe, sino crea el plan via POST `/v1/preapproval_plan`.

### ✅ Queries con adapter pattern

4 helpers en `src/lib/subscriptions/queries.ts`, todos con `adapter: QueryAdapter = prisma`. Espejo perfecto de `lib/payments/queries.ts`. Permite participar en `$transaction` desde callers.

### ✅ Migración SQL limpia

59 líneas, enum + 2 tablas + 6 índices + 2 FKs. Constraint `userId @unique` correcto. Tipos `DECIMAL(65,2)` para `amount`, `TIMESTAMP(3)` para fechas.

### ✅ Cron iCal filtrado correctamente

Diff de 4 líneas (+2 con comentario, +2 con filtro+include). Comentario cita ADR-0018 + ADR-0027 § Decisión 5. Tests agregados validan el comportamiento.

---

## Hallazgos preocupantes (a abordar)

### ⚠️ #1 — Same-state transitions bloquean idempotencia de webhooks

**Severidad**: Media
**Archivo**: `src/lib/subscriptions/state-machine.ts:86-94`
**Impacto**: cuando se implemente el webhook en Slice 4, webhooks duplicados de MP (reintentos legítimos) serán rechazados como "transición inválida" en vez de procesarse idempotentemente.

**Detalle**:

```ts
// canTransition("AUTHORIZED", "AUTHORIZED") → false
// canTransition("PENDING", "PENDING") → false
```

Si MP reintenta un webhook con status `authorized` después de que el lifecycle ya aplicó la transición, la validación de transición falla, MP seguirá reintentando, y eventualmente MP desiste (HTTP 4xx persistente). Eso es ruido en logs y posible duplicación de emails/notificaciones.

**Mitigación propuesta para Slice 3 (lifecycle.ts)**:

```ts
// Antes de validar transición, verificar idempotencia
if (currentSubscription.status === event.targetStatus) {
  // Es un webhook duplicado. Registrar evento "duplicate" y retornar 200.
  await recordSubscriptionEvent({ type: "duplicate", payload: event });
  return { subscription: currentSubscription };
}

// Solo si el estado difiere, validar transición
if (!canTransition(currentSubscription.status, event.targetStatus)) {
  throw new Error(`Invalid transition: ${from} → ${to}`);
}
```

**Decisión del usuario**: ¿querés que el Slice 3 (lifecycle) incluya esta lógica de idempotencia? Es pequeño (~10 líneas) pero conceptual: define que `applySubscriptionEvent` es idempotente, no estricto.

### ⚠️ #2 — Cambio `select → include` en cron iCal

**Severidad**: Baja
**Archivo**: `src/app/api/cron/external-calendars/sync/route.ts:16-19`
**Impacto**: comportamiento correcto, pero ahora el query retorna el campo `user` que antes no retornaba.

**Detalle**:

```ts
// Antes
{ where: { isActive: true }, select: { id: true } }

// Ahora
{ where: { isActive: true, user: { plan: "PRO" } }, include: { user: true } }
```

El loop del cron (`for (const cal of calendars)`) solo usa `cal.id` para llamar `syncExternalCalendarPipeline(cal.id)`. Verificado: el cambio es compatible. El campo `user` extra que retorna el query es ignorado.

**Verificación adicional recomendada**:
- Confirmar que `syncExternalCalendarPipeline` no rompe si recibe un `user` extra en el calendar
- Verificar performance: el query ahora trae más datos (1 query + N rows con JOIN). Para calendarios con muchos eventos podría ser marginal más lento. Aceptable.

### 📝 #3 — Carrera de archivos entre Slice 1 y Slice 2

**Severidad**: Baja (cosmética)
**Detalle**: Slice 2 creó `src/lib/subscriptions/pricing.ts` y Slice 1 lo modificó después para agregar `frequency` y `frequencyType` (cuando el typecheck del gateway reveló que faltaban). Resultado final correcto, pero fue necesaria coordinación.

**Acción recomendada**: en futuros PRDs con slices paralelos, definir claramente quién crea archivos compartidos o evitar paralelizar si hay dependencias implícitas.

### 📝 #4 — Falta hook en `applyPlanChange` para emitir `AdminActionLog`

**Severidad**: Media (no bloqueante para este PR, pero deuda)
**Detalle**: PRD-0027 § H menciona emitir `AdminActionLog` cuando el plan cambia automáticamente por el lifecycle. Esto NO está implementado en estos slices (no era su scope).

**Acción recomendada**: incluirlo en el Slice 3 (lifecycle + server actions).

---

## Verificación de baseline

| Check | Resultado |
|-------|-----------|
| `npm run typecheck` | ✅ 0 errores |
| `npm run lint --quiet` | ✅ 0 errores (warnings pre-existentes no introducidos) |
| `npm run test:run` | ✅ **1379 passing / 2 skipped** (116 files, ~94s) |
| `npx prisma migrate status` | ✅ Database schema is up to date |
| `git diff master..HEAD -- src/lib/payment/gateway.ts` | ✅ Vacío (ADR-0013 intacto) |
| Tests nuevos | +109 (1243 → 1379, incluye +87 subscriptions, +19 pro-gateway, +3 cron iCal) |

---

## Recomendación

**Mergeable después de**:

1. ✅ Decisión sobre idempotencia de webhooks (Hallazgo #1) — recomendado incluir en Slice 3.
2. ✅ Confirmar que no hay issues de performance con el nuevo `include` en el cron (Hallazgo #2).

**No bloqueante para merge**:
- Hallazgo #3 (carrera de archivos): solo afecta el proceso de desarrollo, no el código.
- Hallazgo #4 (AdminActionLog): pendiente para Slice 3.

## Próximo paso

Si mergear esto a master y luego abrir rama nueva para Slice 3 (#189 — Lifecycle + server actions), o seguir en la misma rama acumulando.

Slice 3 es el corazón del backend:
- `lifecycle.ts` con `applySubscriptionEvent` (incluye idempotencia del Hallazgo #1)
- `applyPlanChange` helper (incluye AdminActionLog del Hallazgo #4)
- 4 server actions: `getCurrentSubscription`, `startProUpgrade`, `cancelMySubscription`, `reactivateMySubscription`
- Validaciones Zod
- Tests con Prisma mockeado

Nivel 3 (Nivel crítico de dominio): `architect` revisará diseño → `implementer` ejecuta → `tester` valida → `reviewer` aprueba.
