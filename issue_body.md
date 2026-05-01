## Parent

<!-- Reference to parent issue if any -->

## What to build

Investigar y corregir el webhook de Mercado Pago para que procese correctamente las notificaciones de pago entrantes. El problema específico es que Mercado Pago envía notificaciones como GET con query params (`?data.id=...&type=payment`) pero el webhook actual solo procesa requests POST con JSON body.

## Contexto

### Estado actual
- El webhook manual POST funciona correctamente y actualiza el estado del pago en la BD
- El webhook GET con query params NO funciona desde el servidor de producción
- Las notificaciones GET de Mercado Pago no llegan al endpoint (o no se procesan)
- El servidor local procesa GET pero tiene problemas de CORS/origin

### Archivos relevantes
- `src/app/api/webhooks/mercadopago/route.ts` - Endpoint del webhook
- `src/lib/actions/payments.ts` - Función `processMercadoPagoWebhook`
- `next.config.ts` - Configuración con `allowedDevOrigins`

### Flujo actual
1. `generateMercadoPagoLink` crea preferencia y guarda `preference ID` como `mercadoPagoId`
2. Mercado Pago envía webhook con `payment ID` (diferente al preference ID)
3. Webhook busca pago por `mercadoPagoId` pero no lo encuentra (ID mismatch)
4. Se agregó fallback para buscar por `reservationId` en external_reference

### Queries involucradas
- GET: `?data.id=157208028416&type=payment&reservation_id=cmomcigil0000o4kvfcg3ku12`
- POST: `{"id":"...","status":"approved","external_reference":"test"}`

## Acceptance criteria

- [ ] El webhook GET de Mercado Pago procesa correctamente las notificaciones
- [ ] El webhook POST manual sigue funcionando
- [ ] Los pagos se actualizan a COMPLETED cuando Mercado Pago confirma el pago
- [ ] Los logs muestran el flujo completo del webhook
- [ ] Configuración de ngrok actualizada para pruebas locales

## Blocked by

None - can start immediately

## Notas

- El problema puede estar en:
  1. El webhook de Mercado Pago enviando a URL incorrecta
  2. El formato del request (GET vs POST)
  3. El mismatch entre preference ID y payment ID
  4. CORS/configuración de ngrok

- Necesidad de verificar: ¿Mercado Pago envía POST en vez de GET si se configura?