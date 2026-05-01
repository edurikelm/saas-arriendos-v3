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
5. `external_reference` contiene `reservationId:timestamp` que permite encontrar el pago en BD
6. Se actualiza estado a COMPLETED y la reserva a CONFIRMED si corresponde

### Formato de external_reference

```javascript
external_reference: `${reservationId}:${Date.now()}`
```

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