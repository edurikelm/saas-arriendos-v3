# ADR-0001: Integración Mercado Pago Webhook

## Status

Aprobado

## Context

Necesidad de procesar pagos mediante Mercado Pago Checkout Pro con notificaciones webhook para actualizar el estado de pagos en la base de datos.

## Decision

Se implementó un webhook en `POST /api/webhooks/mercadopago` que procesa notificaciones de Mercado Pago.

### Flujo de pago

1. `generateMercadoPagoLink()` crea preferencia de pago en MP y guarda registro en BD con `mercadoPagoId` (preference ID)
2. Usuario es redirigido a Mercado Pago para pagar
3. MP envía webhook POST con JSON:
   ```json
   {
     "action": "payment.updated",
     "type": "payment",
     "data": { "id": "PAYMENT_ID" }
   }
   ```
4. El handler obtiene detalles del pago vía API de MP para extraer `external_reference`
5. `external_reference` contiene `reservationId:paymentId:timestamp` que permite encontrar el pago en BD
6. Se actualiza estado a COMPLETED, se setea `paidAt` con fecha actual, y la reserva a CONFIRMED si corresponde

### Formato de external_reference

```javascript
external_reference: `${reservationId}:${paymentId}:${Date.now()}`
// Ejemplo: "cmp5opegz000c7skvwmx7km9f:cmp5opetk000f7skv21365l2a:1778775058415"
```

Donde:
- `reservationId` — CUID de la reserva en BD (24+ caracteres)
- `paymentId` — CUID del pago en BD (24+ caracteres)
- `timestamp` — Unix timestamp para unicidad

### Algoritmo de matching (prioridad)

1. Buscar por `mercadoPagoId = payment_id` (el ID real del pago en MP)
2. Parsear `external_reference` → extraer `reservationId` y `paymentId` → buscar por `paymentId`
3. Buscar por `preference_id` (el ID de la preferencia)
4. Buscar por `mercadoPagoId + reservationId`
5. Si ninguno funciona → error (NO fallback por createdAt)

> **Importante:** El regex para validar `paymentId` debe ser `/^[a-z0-9]{20,}$/i` para aceptar CUIDs de Prisma (letras minúsculas + números), NO solo hexadecimales.

### Actualización de `paidAt`

Cuando el webhook procesa un pago con status `approved`/`accredited` (COMPLETED), se setea `paidAt = date_approved` (fecha provista por la API de MP). Si `date_approved` no está disponible, se usa `new Date()` como fallback.

### `receiptUrl`

La API de MercadoPago `/v1/payments/{id}` **no** expone un campo `receipt_url` para pagos con tarjeta de crédito/débito. El campo `transaction_details.external_resource_url` solo se llena para pagos offline (Rapipago, OXXO, boleto, etc.). Por lo tanto, `receiptUrl` no se recibe del webhook — los comprobantes se suben manualmente desde la UI vía Cloudinary para todos los métodos de pago (CASH, TRANSFER, MERCADO_PAGO).

## Implementation

### Archivos

- `src/app/api/webhooks/mercadopago/route.ts` — Endpoint webhook
- `src/lib/actions/payments.ts` — Funciones `generateMercadoPagoLink` y `processMercadoPagoWebhook`

### Variables de entorno requeridas

```env
MERCADOPAGO_ACCESS_TOKEN=APP_USR-...    # Token de producción o TEST- para sandbox
NEXT_PUBLIC_APP_URL=https://...          # URL pública para webhooks
```

### Configuración webhook en Mercado Pago

URL: `https://tu-dominio.com/api/webhooks/mercadopago`
Tópico: `payment`

## Consequences

### Positivo

- Pagos se actualizan automáticamente sin polling
- Historial completo de estados de pago
- Compatibilidad con sandbox para pruebas

### Negativo

- Requiere URL pública accesible (no funciona en localhost sin ngrok)
- Token de prueba no envía notificaciones automáticas (solo via dashboard)

## Testing

### Pruebas locales

1. Usar ngrok para exponer localhost: `ngrok http 3000`
2. Configurar `NEXT_PUBLIC_APP_URL` con URL de ngrok
3. Generar link y pagar con tarjeta de prueba: `4509 9535 6623 3704`

### Verificar webhook manual

```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/webhooks/mercadopago" -Method POST -ContentType "application/json" -Body '{"id":"...","status":"approved","external_reference":"test"}'
```

## References

- [Mercado Pago Docs](https://www.mercadopago.com/developers/es/docs/checkout-pro/overview)
- Issue #22: https://github.com/edurikelm/saas-arriendos-v3/issues/22