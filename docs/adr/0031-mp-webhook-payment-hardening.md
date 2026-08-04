# ADR-0031: Mercado Pago Webhook & Payment Hardening

## Status

Aceptado (2026-08-04)

## Context

Una auditoria del flujo de pagos de Mercado Pago en RentalPro (commits contra `master` previos a #197) detectó **8 brechas** entre la implementacion actual y la documentacion oficial de MP. Las mas serias eran:

### Tier 1 - Seguridad HMAC (critico)

1. **No se normaliza `data.id` a lowercase antes del HMAC**: la doc oficial establece que cuando MP envie `data.id` alfanumerico en MAYUSCULAS (formato `ORDTST01ABC...` del topico `order`), el integrator debe convertirlo a minusculas antes de computar el manifest. Sin el fix, los futuros webhooks del topico `order` fallarian la verificacion de firma y se descartarian como 401.

2. **No se valida frescura del `ts` (anti-replay)**: si un atacante captura un webhook valido, puede reenviarlo indefinidamente porque la firma pasa pero no hay ventana de tolerancia.

3. **Comparacion HMAC vulnerable a timing attack**: el codigo usa `computedSignature !== v1`, vulnerable a timing attacks. La doc oficial de MP exige `crypto.timingSafeEqual` o equivalente.

### Tier 2 - Robustez

4. **Iteracion O(N) de integraciones cuando no hay `paymentId` hint**: `findTokenForPayment` itera todas las integraciones activas, haciendo un GET a `/v1/payments/{id}` por cada owner. Si no hay hint, esto es O(N) llamadas externas por webhook, vulnerable a DoS.

5. **Sin timeout en outbound calls**: los `fetch` a `api.mercadopago.com` no tienen `AbortSignal.timeout`. Si MP esta degradado, el handler cuelga hasta el timeout de Vercel, MP espera 22s y re-intenta 8 veces.

6. **Sin `X-Idempotency-Key` en `/v1/preapproval`**: si el owner hace doble-click en "Suscribirse a PRO", se crean 2 suscripciones. La doc oficial recomienda el header para este caso.

7. **Preferencia Checkout Pro sin `expires`**: `Payment.expiresAt` se setea a 7 dias en la DB local, pero la preferencia en MP no incluye `expires: true` ni `expiration_date_to`. La UI muestra "Expirado" via el campo local, pero el link publico en MP sigue funcional.

8. **Sin validacion de `NEXT_PUBLIC_APP_URL` en startup**: trailing slash produce URLs malformadas (`https://app.com//api/...`) que MP rechaza.

### Tier 3 - Cobertura de tests

- No habia test E2E del webhook (solo unit tests por capa).
- Mocks duplicados entre `mercadopago/signature.test.ts` y `mercadopago-pro/route.test.ts`.

## Decision

Implementar el hardening completo en **19 commits** (10 RED + 8 GREEN + 1 follow-up), agrupados en issues #197-#214. Estrategia TDD estricta: cada comportamiento documentado primero con test rojo, luego implementado con fix verde. Issue derivado cuando se descubre un bug latente.

### Tier 1: HMAC hardening

#### A. Normalizacion de `data.id` (#197/#206)

Helper exportado `normalizeDataId(dataId: string): string` en `src/lib/payment/webhook-helpers.ts`:

```ts
export function normalizeDataId(dataId: string): string {
  return dataId.toLowerCase();
}
```

Aplicado en `verifyMercadoPagoSignature` y `verifyMpProWebhookSignature` antes de construir el manifest:

```ts
const manifest = `id:${normalizeDataId(dataId)};request-id:${requestId};ts:${ts};`;
```

**Justificacion**: para IDs numericos, `.toLowerCase()` es no-op, asi que la funcion es segura de aplicar universalmente. No hace falta branching por tipo.

**Doc MP**: https://www.mercadopago.com/developers/es/docs/checkout-pro/payment-notifications

#### B. Validacion de timestamp tolerance (#198/#207)

Constante exportada `WEBHOOK_TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000` (5 minutos por default). Override via env var `MERCADOPAGO_WEBHOOK_TIMESTAMP_TOLERANCE_MS`. Aplicado en ambos webhooks despues de parsear formato, antes de HMAC:

```ts
const tsMs = parseInt(ts, 10) * 1000; // Convert Unix seconds → ms
const nowMs = Date.now();
if (Number.isFinite(tsMs) && Math.abs(nowMs - tsMs) > toleranceMs) {
  console.warn(`[MP Webhook] Signature rejected: ts ${ts} is outside tolerance window`);
  return false;
}
```

**Bug detectado durante RED phase**: el primer corte del fix tenia `parseInt(ts, 10)` sin `* 1000`, comparando segundos de Unix con milisegundos de `Date.now()`. Esto rechazaria TODOS los webhooks por diferencia de ~55 anios. Commit follow-up `9d73dc2` corrigio a `* 1000` para alinear unidades.

**Doc MP**: "puedes usar el timestamp extraido del header para compararlo con un timestamp generado en el momento de la recepcion de la notificacion, con el fin de establecer una tolerancia de demora".

#### C. Comparacion timing-safe (#199/#208)

Reemplazo `computedSignature !== v1` por `crypto.timingSafeEqual` con length check previo (la funcion lanza `RangeError` si los buffers tienen longitud distinta):

```ts
if (
  computedSignature.length !== v1.length ||
  !crypto.timingSafeEqual(Buffer.from(computedSignature), Buffer.from(v1))
) {
  console.error(`[MP Webhook] Signature mismatch...`);
  // ...
}
```

**Doc MP**: todos los SDKs oficiales usan `crypto.timingSafeEqual`, `hash_equals`, o `hmac.compare_digest`. Defensa en profundidad contra timing attacks.

### Tier 2: Robustez

#### D. No iterar integraciones sin hint (#200/#209)

Cuando no hay `paymentId` hint Y `getPaymentByMercadoPagoId` no resuelve, retornar 200 con warning **inmediatamente**, sin iterar `findTokenForPayment`. Antes:

```ts
} else if (!hintedPaymentId) {
  const tokenResult = await findTokenForPayment(paymentId); // O(N) external calls
  // ...
}
```

Despues:

```ts
} else {
  console.warn(`[MP Webhook] Could not resolve payment for ${paymentId}...`);
  return NextResponse.json({ received: true, warning: "Could not resolve payment" });
}
```

**Justificacion**: el `paymentId` hint es el patron recomendado por MP para resolver al owner sin ambiguedad. Sin hint, no hay manera confiable de saber a que owner pertenece el pago. La doc de `notification_url` lo enfatiza.

**Nota**: `findTokenForPayment` sigue usandose en la rama `merchant_order` (out of scope de #209). Ese path tiene logica diferente (iteracion de payments dentro de una merchant_order), no es amplificable de la misma manera.

#### E. Timeout en outbound calls (#201/#210)

Helper `mpFetch(url, options, timeoutMs = 5000)` en `src/lib/payment/mp-fetch.ts`:

```ts
export async function mpFetch(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = 5_000,
): Promise<Response> {
  return fetch(url, {
    ...options,
    signal: AbortSignal.timeout(timeoutMs),
  });
}
```

Reemplaza los `fetch` directos a `api.mercadopago.com` en:
- `src/app/api/webhooks/mercadopago/route.ts` (getPaymentStatus, merchant_orders)
- `src/lib/payment/pro-gateway.ts` (ensurePlan, createPreapproval, cancelPreapproval, fetchPreapproval)

**Justificacion**: MP espera respuesta en 22s; si llegamos tarde, re-intenta 8 veces. Abortar a 5s evita la cascada. Tambien libera al handler de Vercel (max 10s default).

#### F. X-Idempotency-Key en preapproval (#202/#211)

Header `X-Idempotency-Key: <randomUUID()>` en `createPreapproval` de `pro-gateway.ts`:

```ts
import { randomUUID } from 'crypto';

const response = await fetch(`${BASE_URL}/v1/preapproval`, {
  method: "POST",
  headers: {
    ...this.headers(),
    "X-Idempotency-Key": randomUUID(),
  },
  // ...
});
```

**Justificacion**: la doc oficial dice explicitamente "deberas enviar obligatoriamente el atributo `X-Idempotency-Key` para asegurar la ejecucion y reejecucion de las solicitudes sin el riesgo de realizar la misma accion mas de una vez por error". Aplica especialmente a `createPreapproval` donde doble-click del owner crearia 2 suscripciones.

#### G. `expires` en preferencia (#203/#212)

Helper `toMercadoPagoIso8601(date: Date): string` en `src/lib/payment/mp-fetch.ts`. Construye el formato `aaaa-MM-dd'T'HH:mm:ss.SSS±HH:MM` que MP espera (ej. `2026-08-11T15:30:00.000-04:00`), NO el `Z` sufijo de `Date.toISOString()`.

Aplicado en `createPaymentLink` (`src/lib/payment/gateway.ts`):

```ts
expires: true,
expiration_date_from: toMercadoPagoIso8601(new Date()),
expiration_date_to: toMercadoPagoIso8601(expirationDate),
```

**Justificacion**: ADR-0001 ya establecia que el link vence en 7 dias. Pero esa logica vivia solo en la DB local. Ahora MP tambien sabe la fecha de expiracion, asi que la UI y la realidad del link estan sincronizadas.

#### H. Validacion `NEXT_PUBLIC_APP_URL` (#204/#213)

Helper `validateAppUrl(url: string | undefined): AppUrlValidation` en `src/lib/config/env-validation.ts`:

```ts
export interface AppUrlValidation {
  valid: boolean;
  reason?: string;
}

export function validateAppUrl(url: string | undefined): AppUrlValidation {
  if (!url) return { valid: false, reason: 'NEXT_PUBLIC_APP_URL is required' };
  if (url.endsWith('/')) return { valid: false, reason: 'NEXT_PUBLIC_APP_URL must not end with /' };
  
  const isProd = process.env.NODE_ENV === 'production';
  if (isProd && url.startsWith('http://')) {
    return { valid: false, reason: 'NEXT_PUBLIC_APP_URL must use HTTPS in production' };
  }
  
  return { valid: true };
}
```

Usado en `oauth/start/route.ts` (redirect a `/settings?mp=config_error` si inválido) y `gateway.ts` (warning log).

**Justificacion**: ADR-0001 advertia sobre trailing slash pero no validaba en runtime. La validacion preventiva en startup es mejor que un fallo silencioso en produccion.

### Tier 3: Cobertura de tests

#### I. Shared mocks/helpers (#205)

Extraccion de `buildManifest`, `computeSignature`, `prismaMock`, `getMercadoPagoTokenMock`, `processMercadoPagoWebhookMock` a `src/app/api/webhooks/__tests__/helpers/`. Refactor sin cambio de comportamiento.

#### J. E2E con MSW (#214)

Test integration en `src/app/api/webhooks/mercadopago/__tests__/integration.test.ts` valida 3 escenarios end-to-end:
- Webhook valido con `paymentId` hint → actualiza DB
- Webhook con `data.id` alfanumérico en mayúsculas (gracias a #206)
- Webhook con `ts` stale → 401 (gracias a #207)

**Nota tecnica**: MSW v2 no intercepta bien con `AbortSignal.timeout()`, asi que los tests usan `vi.spyOn(global, 'fetch')` directamente. El server MSW de `src/__mocks__/` queda como infraestructura para futuros tests que no usen `mpFetch`.

## Consequences

### Positive

- 3 vulnerabilidades reales cerradas (HMAC normalization, replay protection, timing attack). Bug de unidad en timestamp (detectado durante RED phase) hubiera rechazado todos los webhooks en produccion.
- 5 mejoras de robustez (no-iteration, timeout, idempotency, expires, URL validation) que reducen superficie de DoS, errores de runtime, y duplicaciones.
- 23 tests nuevos (+23 sobre 1640 baseline = 1.4% mas cobertura).
- Coherencia entre BD y Mercado Pago en expiracion de preferencias.
- Helper `mpFetch` reusado en 6 lugares (todos los `fetch` a MP).
- E2E test cierra el gap de cobertura unitaria.

### Negative

- 19 commits en master sin push (riesgo de merge conflicts si el usuario toca el codigo).
- `findTokenForPayment` aun existe para la rama `merchant_order` (no amplificada de la misma manera, pero deberia auditarse en futuro).
- El ADMIN_URL validator no bloquea en `NODE_ENV=development` (solo warning). Aceptable, pero documentado.
- Tests con MSW tienen un workaround (no usan `mpFetch`).

### Neutral

- ADR-0001 ("Integracion Mercado Pago Checkout Pro y Webhook") queda como **complementado** por este ADR. No se modifica para preservar su estado historico.
- 18 issues cerradas en GitHub sin PR explicito (puedes crearlos al pushear).

## Issues Relacionados

- #197, #198, #199, #200, #201, #202, #203, #204, #205 — RED tests
- #206, #207, #208, #209, #210, #211, #212, #213, #214 — GREEN fixes
- ADR-0001 — Contexto historico del flujo de pagos
- ADR-0013 — Tokens OAuth por owner
- ADR-0026 — Storage de metadata MP

## Implementation Files

- `src/lib/payment/webhook-helpers.ts` — `normalizeDataId`, `WEBHOOK_TIMESTAMP_TOLERANCE_MS`
- `src/lib/payment/mp-fetch.ts` — `mpFetch`, `toMercadoPagoIso8601`
- `src/lib/payment/gateway.ts` — preference creation
- `src/lib/payment/pro-gateway.ts` — preapproval with X-Idempotency-Key
- `src/lib/config/env-validation.ts` — `validateAppUrl`
- `src/app/api/webhooks/mercadopago/route.ts` — main webhook
- `src/app/api/webhooks/mercadopago-pro/route.ts` — PRO webhook
- `src/app/api/webhooks/__tests__/helpers/` — shared test infrastructure
- `src/app/api/webhooks/mercadopago/__tests__/integration.test.ts` — E2E
- `src/app/api/integrations/mercadopago/oauth/start/route.ts` — URL validation integration

## References

- Doc MP: https://www.mercadopago.com/developers/es/docs/checkout-pro/payment-notifications
- Doc MP: https://www.mercadopago.com/developers/es/docs/checkout-pro/additional-settings/term-of-preference
- Doc MP: https://www.mercadopago.com/developers/es/docs/your-integrations/notifications/webhooks
- Doc MP: https://www.mercadopago.com/developers/es/docs/checkout-bricks/payment-brick/payment-submission/cards
- Doc MP: https://www.mercadopago.com/developers/es/docs/mp-point/optional-notifications
- ADR-0001, ADR-0013, ADR-0026 (contexto existente)
