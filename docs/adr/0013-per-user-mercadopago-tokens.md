# ADR-0013: Tokens OAuth de Mercado Pago por owner

## Status

Aprobado

## Context

RentalPro es multi-owner: cada owner debe cobrar en su propia cuenta de Mercado Pago. El modelo anterior permitia tokens manuales por usuario, pero tambien existian fallbacks a `MERCADOPAGO_ACCESS_TOKEN` global.

Ese fallback global rompe el modelo multi-tenant porque:

1. Un token global no tiene acceso a payments creados por otro owner.
2. Los pagos podrian quedar asociados a la cuenta incorrecta.
3. La conciliacion, comisiones y reportes no pertenecerian al owner real.
4. Rotar o expirar el token global afecta a todos.
5. En produccion no es viable pedir a cada owner que copie access tokens manualmente.

## Decision

El token de Mercado Pago siempre pertenece al owner dueño del recurso y se obtiene mediante OAuth Authorization Code + PKCE.

`MERCADOPAGO_ACCESS_TOKEN` no se usa en produccion ni como fallback en el codigo de pagos.

## Reglas

| Contexto | Token a usar | Si no hay token |
|----------|--------------|-----------------|
| Conectar cuenta | OAuth con app de RentalPro | Error de configuracion o OAuth |
| Generar link | Token valido del `session.userId` | Error: conectar Mercado Pago en Settings |
| Webhook payment | Token del owner del `Payment` | 200 OK con warning, no procesa |
| Webhook merchant_order | Token del owner resuelto por `paymentId` hint | 200 OK con warning, no procesa |
| Refresh token | `refreshTokenEncrypted` del owner | Desactiva integracion y devuelve null |
| Consulta manual de estado | Token del owner del pago | Error: conectar Mercado Pago en Settings |

## Fuente Unica De Tokens

`getMercadoPagoToken(userId)` delega en `getValidMercadoPagoToken(userId)` en `src/lib/actions/mercado-pago.ts`.

La funcion:

1. Busca `UserIntegration` activa del owner (`provider=MERCADO_PAGO`, `isActive=true`).
2. Desencripta `accessToken` si no esta expirado.
3. Si expiro, desencripta `metadata.refreshTokenEncrypted`.
4. Llama `/oauth/token` con `grant_type=refresh_token`.
5. Guarda access token y refresh token renovados, ambos encriptados.
6. Si no puede refrescar, marca la integracion como inactiva.

## Persistencia

`UserIntegration` guarda:

- `accessToken`: access token encriptado.
- `isActive`: si la integracion puede usarse.
- `metadata.connectedAt`: fecha de conexion.
- `metadata.refreshTokenEncrypted`: refresh token encriptado.
- `metadata.expiresAt`: expiracion del access token.
- `metadata.mode`: `test` o `production`.
- `metadata.account`: datos no sensibles de la cuenta (`userId`, `publicKey`, `nickname`).

Durante el inicio OAuth, `metadata.oauthState` y `metadata.oauthCodeVerifier` se guardan temporalmente para validar el callback.

## Configuracion Por Entorno

Produccion:

```env
MERCADOPAGO_OAUTH_CLIENT_ID=app_id_numerico
MERCADOPAGO_OAUTH_CLIENT_SECRET=client_secret_de_la_misma_app
MERCADOPAGO_OAUTH_TEST_TOKEN=false
MP_MANUAL_TOKEN_ENABLED=false
```

Desarrollo/testing:

```env
MERCADOPAGO_OAUTH_CLIENT_ID=app_id_numerico
MERCADOPAGO_OAUTH_CLIENT_SECRET=client_secret_de_la_misma_app
MERCADOPAGO_OAUTH_TEST_TOKEN=true
MP_MANUAL_TOKEN_ENABLED=true # opcional
```

`MERCADOPAGO_OAUTH_CLIENT_ID` debe ser el APP_ID numerico de Mercado Pago, no Public Key, Access Token, `APP_USR-*` ni `TEST-*`.

Si Mercado Pago devuelve `Missing parameters: client_secret`, `MERCADOPAGO_OAUTH_CLIENT_SECRET` es obligatorio para esa app y debe configurarse en el entorno de deploy.

## Token Manual

La carga manual de token queda deshabilitada por defecto y solo puede usarse si `MP_MANUAL_TOKEN_ENABLED=true`.

Uso esperado:

- desarrollo local
- debugging admin
- migraciones puntuales

No es el flujo normal de produccion.

## Webhook Y Owner Resolution

El webhook no debe iterar integraciones si puede resolver el owner por `paymentId` hint.

La `notification_url` de cada preferencia incluye:

```txt
/api/webhooks/mercadopago?source_news=webhooks&paymentId=<paymentId>
```

Ese `paymentId` permite:

1. Buscar el pago local.
2. Obtener `payment.reservation.userId`.
3. Consultar Mercado Pago con token del owner correcto.

Si no hay hint, el sistema puede intentar resolver por `mercadoPagoId`, `external_reference` o `preference_id`, pero no debe usar token global.

## Consequences

### Positive

- Cada owner opera con su propia cuenta de Mercado Pago.
- Los pagos, comisiones y reportes quedan asociados al owner correcto.
- No se almacenan tokens manuales en produccion.
- Refresh token permite mantener la integracion activa sin reconectar cada 180 dias.
- La falta de token afecta solo al owner correspondiente.

### Negative

- Produccion depende de una app Mercado Pago correctamente configurada con OAuth, PKCE y client secret.
- Owners deben completar la conexion desde `/settings` antes de generar links.
- Si el refresh falla, el owner debe reconectar.
- Desarrollo local con webhooks reales requiere URL publica.

## Implementation

Archivos principales:

- `src/app/api/integrations/mercadopago/oauth/start/route.ts`
- `src/app/api/integrations/mercadopago/oauth/callback/route.ts`
- `src/lib/actions/mercado-pago.ts`
- `src/components/settings/MercadoPagoSettings.tsx`
- `src/app/api/webhooks/mercadopago/route.ts`
- `src/lib/actions/payments.ts`

Issues relacionadas historicas:

- [#77](https://github.com/edurikelm/saas-arriendos-v3/issues/77) — Webhook usa token global en vez del token del usuario
- [#80](https://github.com/edurikelm/saas-arriendos-v3/issues/80) — Verificacion de firma x-signature
- [#81](https://github.com/edurikelm/saas-arriendos-v3/issues/81) — paidAt usa fecha del servidor
- [#82](https://github.com/edurikelm/saas-arriendos-v3/issues/82) — Idempotencia en webhook
