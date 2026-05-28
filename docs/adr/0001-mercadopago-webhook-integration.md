# ADR-0001: Integracion Mercado Pago Checkout Pro y Webhook

## Status

Aprobado

## Context

RentalPro procesa pagos de reservas con Mercado Pago Checkout Pro. Cada owner cobra en su propia cuenta de Mercado Pago y el sistema debe actualizar los pagos locales cuando Mercado Pago confirma el cobro.

El flujo actual usa OAuth por owner, Checkout Pro con preferencias creadas bajo el token del owner, y webhooks firmados para actualizar `Payment.status` en la base de datos.

## Decision

Se implementa Mercado Pago como integracion multi-owner:

- OAuth Authorization Code + PKCE para conectar cuentas desde `/settings`.
- `POST /api/webhooks/mercadopago` como endpoint unico de notificaciones.
- `notification_url` por preferencia con `paymentId` interno como hint.
- `external_reference` con `reservationId:paymentId:timestamp`.
- Consulta server-side a Mercado Pago para confirmar estado antes de mutar la BD.
- No se confirma pago por redirect del navegador; el redirect solo muestra estado de confirmacion.

## Flujo OAuth

1. Owner autenticado entra a `/settings` y selecciona conectar Mercado Pago.
2. `GET /api/integrations/mercadopago/oauth/start` valida sesion y config.
3. El server genera `state`, `code_verifier` y `code_challenge` PKCE.
4. `state` y `code_verifier` se guardan temporalmente en `UserIntegration.metadata`.
5. El owner es redirigido a `https://auth.mercadopago.com/authorization` con:
   - `client_id` = `MERCADOPAGO_OAUTH_CLIENT_ID` (APP_ID numerico)
   - `response_type=code`
   - `platform_id=mp`
   - `state`
   - `redirect_uri`
   - `scope=offline_access`
   - `code_challenge`
   - `code_challenge_method=S256`
6. Mercado Pago vuelve a `/api/integrations/mercadopago/oauth/callback` con `code` y `state`.
7. El callback valida `state`, intercambia `code` por tokens en `/oauth/token`, y guarda:
   - `accessToken` encriptado en `UserIntegration.accessToken`
   - `refreshTokenEncrypted` en `UserIntegration.metadata`
   - `expiresAt`, `connectedAt`, `mode`, datos de cuenta.

## Flujo Checkout Pro

1. Owner genera un link desde la reserva o desde un pago pendiente.
2. RentalPro obtiene token valido con `getMercadoPagoToken(session.userId)`.
3. Si el access token expiro, se renueva con refresh token antes de crear la preferencia.
4. Se crea/usa un `Payment` local PENDING con `method=MERCADO_PAGO`.
5. Se crea preferencia en `POST https://api.mercadopago.com/checkout/preferences` con:
   - `items[]`
   - `currency_id=CLP`
   - `external_reference=${reservationId}:${paymentId}:${timestamp}`
   - `notification_url=${NEXT_PUBLIC_APP_URL}/api/webhooks/mercadopago?source_news=webhooks&paymentId=${paymentId}`
   - `back_urls` a `/payment/result?paymentId=${paymentId}&status=...`
   - `auto_return=approved`
6. Se guarda `data.id` como `Payment.mercadoPagoId` (preference_id).
7. Se guarda `data.init_point` como `Payment.initPoint`.

Checkout Pro actual debe usar `init_point`. `sandbox_init_point` no se usa como URL principal; solo puede conservarse como metadata de respuesta para debugging.

## Flujo Webhook

1. Mercado Pago llama `POST /api/webhooks/mercadopago`.
2. El route handler verifica firma oficial con:
   - header `x-signature` (`ts=...`, `v1=...`)
   - header `x-request-id`
   - manifest `id:<dataId>;request-id:<x-request-id>;ts:<ts>;`
   - `MERCADOPAGO_WEBHOOK_SECRET`
3. En desarrollo se puede permitir continuar con firma invalida solo si `MERCADOPAGO_WEBHOOK_ALLOW_INVALID_SIGNATURE=true`. En produccion nunca se permite.
4. El evento se extrae desde body JSON o query params:
   - Body: `{ action: "payment.updated", data: { id: "..." } }`
   - Query moderna: `?data.id=...&type=payment`
   - Query legacy: `?id=...&topic=payment`
5. Para `payment`, se resuelve owner usando primero `paymentId` hint y luego `Payment.mercadoPagoId`.
6. Para `merchant_order`, se usa `paymentId` hint para obtener el token del owner antes de consultar `/merchant_orders/{id}`.
7. Se consulta Mercado Pago con token del owner:
   - Payment: `GET /v1/payments/{id}`
   - Merchant order: `GET /merchant_orders/{id}` y luego cada payment aprobado.
8. Se llama `processMercadoPagoWebhook()` con `id`, `status`, `external_reference`, `preference_id`, `date_approved` y `hintedPaymentId`.
9. Se actualiza el pago local y, si corresponde, la reserva a `CONFIRMED`.

## Matching De Pagos

`processMercadoPagoWebhook()` busca el `Payment` en este orden:

1. `hintedPaymentId` desde `notification_url`.
2. `paymentId` extraido de `external_reference`.
3. `preference_id` contra `Payment.mercadoPagoId`.
4. `id` real del pago Mercado Pago contra `Payment.mercadoPagoId`.
5. Si ninguno funciona, devuelve `Pago no encontrado` sin fallback por fecha.

Cuando `external_reference` incluye `reservationId`, cualquier candidato se descarta si pertenece a otra reserva.

El regex para validar `paymentId` debe aceptar CUIDs de Prisma: `/^[a-z0-9]{20,}$/i`.

## Estados

Mapeo Mercado Pago a RentalPro:

- `approved`, `accredited` -> `COMPLETED`
- `pending` -> `PENDING`
- `cancelled`, `rejected`, `refunded`, `charged_back` -> `FAILED`
- Otros -> `PENDING`

Cuando el pago queda `COMPLETED`, `paidAt` usa `date_approved` de Mercado Pago. Si no viene, usa la fecha del servidor como fallback.

## Redirect Post-Pago

`/payment/result` no muta estado. Lee el `Payment` local y muestra:

- exito si la BD ya esta `COMPLETED`
- pendiente/confirmando si Mercado Pago redirigio con exito pero el webhook aun no proceso
- error si el pago local esta `FAILED` o no existe

Esto evita marcar pagos como completados solo por parametros de URL manipulables.

## Variables De Entorno

Produccion:

```env
NEXT_PUBLIC_APP_URL=https://tu-dominio.com
MERCADOPAGO_OAUTH_CLIENT_ID=app_id_numerico
MERCADOPAGO_OAUTH_CLIENT_SECRET=client_secret_de_la_misma_app
MERCADOPAGO_WEBHOOK_SECRET=secret_de_webhooks_de_la_app
MERCADOPAGO_OAUTH_TEST_TOKEN=false
MERCADOPAGO_WEBHOOK_ALLOW_INVALID_SIGNATURE=false
MP_MANUAL_TOKEN_ENABLED=false
```

Desarrollo:

```env
NEXT_PUBLIC_APP_URL=https://url-publica-ngrok-o-cloudflared
MERCADOPAGO_OAUTH_CLIENT_ID=app_id_numerico
MERCADOPAGO_OAUTH_CLIENT_SECRET=client_secret_de_la_misma_app
MERCADOPAGO_WEBHOOK_SECRET=secret_de_webhooks_de_la_app
MERCADOPAGO_OAUTH_TEST_TOKEN=true
MERCADOPAGO_WEBHOOK_ALLOW_INVALID_SIGNATURE=true # solo si el secret local no coincide
MP_MANUAL_TOKEN_ENABLED=true # opcional para pruebas/admin
```

`NEXT_PUBLIC_APP_URL` no debe tener slash final. Los links ya generados conservan la `notification_url` antigua; despues de cambiar env vars hay que generar links nuevos.

## Configuracion Mercado Pago Developers

La aplicacion de Mercado Pago debe tener:

- Redirect URL exacta: `https://tu-dominio.com/api/integrations/mercadopago/oauth/callback`
- Authorization Code con PKCE habilitado.
- Client secret configurado en Vercel si Mercado Pago lo exige.
- Webhook secret copiado a `MERCADOPAGO_WEBHOOK_SECRET`.

Para produccion, el owner conecta una cuenta real de Mercado Pago y el comprador paga con otra cuenta/tarjeta real. No se debe cobrar y pagar con la misma cuenta.

## Troubleshooting

- Pantalla Mercado Pago "la aplicacion no puede conectarse": revisar `MERCADOPAGO_OAUTH_CLIENT_ID` (debe ser APP_ID numerico), redirect URL exacta, PKCE habilitado y pais/cuenta de la app.
- `/settings?mp=oauth_token_error`: revisar logs `[MP OAuth] Token exchange failed`; si dice `Missing parameters: client_secret`, configurar `MERCADOPAGO_OAUTH_CLIENT_SECRET`.
- Webhook 401 `Signature mismatch`: revisar `MERCADOPAGO_WEBHOOK_SECRET`; en desarrollo puede usarse `MERCADOPAGO_WEBHOOK_ALLOW_INVALID_SIGNATURE=true`, nunca en produccion.
- Pago queda "confirmando": revisar que `NEXT_PUBLIC_APP_URL` sea publico y que el link haya sido generado despues de configurar esa URL.
- Webhook llega pero no actualiza: revisar logs `Mercado Pago webhook via ...`, `Failed to fetch payment`, `Pago no encontrado`, y que el owner tenga token OAuth activo.

## Implementation

Archivos principales:

- `src/app/api/integrations/mercadopago/oauth/start/route.ts`
- `src/app/api/integrations/mercadopago/oauth/callback/route.ts`
- `src/app/api/webhooks/mercadopago/route.ts`
- `src/lib/actions/mercado-pago.ts`
- `src/lib/actions/payments.ts`
- `src/lib/payment/gateway.ts`
- `src/app/payment/result/page.tsx`
- `src/lib/payment/result-state.ts`
- `src/components/settings/MercadoPagoSettings.tsx`

## Consequences

### Positivo

- Cada owner cobra en su propia cuenta de Mercado Pago.
- No hay tokens manuales en produccion.
- El webhook confirma pagos con datos server-side de Mercado Pago.
- El redirect del navegador no puede marcar pagos como completados.
- `paymentId` hint reduce iteracion por integraciones y mejora determinismo multi-tenant.

### Negativo

- Requiere configuracion correcta de OAuth, PKCE, client secret, webhook secret y URL publica.
- En local se necesita URL publica para webhooks reales.
- Links antiguos no heredan cambios de env vars.

## References

- [Mercado Pago OAuth](https://www.mercadopago.com/developers/es/docs/security/oauth/creation)
- [Mercado Pago Checkout Pro](https://www.mercadopago.com/developers/es/docs/checkout-pro/overview)
- ADR-0013: Tokens de Mercado Pago por usuario
