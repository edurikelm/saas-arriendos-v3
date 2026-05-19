# ADR-0013: Tokens de Mercado Pago por usuario — sin fallback al token global

## Status

Proposed

## Context

El sistema permite que cada owner configure su propio access token de Mercado Pago en `/settings`. Este token se almacena encriptado en `UserIntegration` (campo `accessToken`, provider `MERCADO_PAGO`).

Sin embargo, múltiples partes del flujo de pagos usaban `process.env.MERCADOPAGO_ACCESS_TOKEN` como fallback cuando el usuario no tenía token configurado:

- **Webhook:** `getPaymentStatus()` en el route handler usaba siempre el token global para consultar `GET /v1/payments/{id}`. Si el pago fue creado con el token de un usuario específico, el token global no tiene acceso y la consulta falla con 401/404.
- **Generación de links:** `generateMercadoPagoLink()`, `generatePaymentLink()`, `regeneratePaymentLink()`, y `checkMercadoPagoPaymentStatus()` hacían `userToken ?? process.env.MERCADOPAGO_ACCESS_TOKEN`.

Esto es problemático porque:
1. Rompe el modelo multi-tenant: el token global no es dueño de los payments creados con tokens de usuario
2. Los webhooks fallan silenciosamente para usuarios con token propio
3. Los links generados con el token global no reflejan la cuenta real del usuario (comisiones, conciliación, etc.)
4. Si el token global se rota o expira, afecta a todos los usuarios que dependían de él

## Decision

**El access token de Mercado Pago siempre debe ser el del usuario dueño del recurso.** `MERCADOPAGO_ACCESS_TOKEN` no debe referenciarse en ninguna parte del código de pagos (webhook, generación de links, consulta de estado).

### Reglas

| Contexto | Token a usar | Si no hay token |
|----------|-------------|-----------------|
| Webhook entrante | Token del `userId` dueño del pago (vía `payment.reservation.userId`) | 200 OK con warning, no se procesa |
| Generar link de pago | Token del usuario autenticado (`session.userId`) | Error: "Conecta tu cuenta de Mercado Pago en Settings" |
| Consultar estado manual | Token del usuario dueño del pago | Error: "Conecta tu cuenta de Mercado Pago en Settings" |
| Merchant order webhook | Token del `userId` dueño del pago | 200 OK con warning, no se procesa |

### Fuente única de tokens

`getMercadoPagoToken(userId)` en `src/lib/actions/mercado-pago.ts` es la única función que recupera tokens. Desencripta desde `UserIntegration.accessToken` filtrando por `isActive = true`.

### Comportamiento en el webhook

```
1. Recibir webhook con payment_id
2. Buscar pago en BD (matching por mercadoPagoId, external_reference, preference_id)
3. Si no se encuentra → 200 OK (no reintentar)
4. Obtener userId = payment.reservation.userId
5. token = getMercadoPagoToken(userId)
6. Si !token → 200 OK, log warning, no procesar
7. Consultar GET /v1/payments/{id} con token del usuario
8. Si falla → 200 OK, log error (no reintentar)
9. Procesar actualización de estado
```

### ¿Qué pasa con MERCADOPAGO_ACCESS_TOKEN?

Se mantiene en `.env` para desarrollo local/testing manual, pero el código de producción no lo referencia. Si un desarrollador quiere probar pagos localmente, debe configurar su propio token en `/settings` como cualquier usuario.

## Implementation

Archivos afectados:
- `src/app/api/webhooks/mercadopago/route.ts` — `getPaymentStatus()` recibe `accessToken` como parámetro
- `src/lib/actions/payments.ts` — `generateMercadoPagoLink()`, `generatePaymentLink()`, `regeneratePaymentLink()`, `checkMercadoPagoPaymentStatus()`, `processMercadoPagoWebhook()`
- `src/lib/payment/gateway.ts` — `MercadoPagoGateway.handleWebhook()`

Issues relacionadas:
- [#77](https://github.com/edurikelm/saas-arriendos-v3/issues/77) — CRÍTICO: Webhook usa token global en vez del token del usuario
- [#80](https://github.com/edurikelm/saas-arriendos-v3/issues/80) — CRÍTICO: Sin verificación de firma x-signature
- [#81](https://github.com/edurikelm/saas-arriendos-v3/issues/81) — ALTO: paidAt usa fecha del servidor
- [#82](https://github.com/edurikelm/saas-arriendos-v3/issues/82) — ALTO: Sin idempotencia en webhook

## Consequences

### Positive

- Cada usuario opera con su propia cuenta de Mercado Pago (comisiones, reportes, conciliación independientes)
- Si un token de usuario expira, solo afecta a ese usuario
- El webhook es determinista: solo procesa pagos de usuarios con token configurado
- No hay dependencia de un token global compartido

### Negative

- El token global deja de ser un "comodín" para desarrollo rápido
- Si un usuario no configura su token, los pagos MP no funcionan para él (pero esto es intencional: sin token, no hay integración)
- Requiere que todos los owners configuren su token individualmente
