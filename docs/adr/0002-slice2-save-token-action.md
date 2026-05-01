## Parent

Issue #22 (Mercado Pago webhook fix)

## What to build

Crear acción server para validar y guardar el access token de Mercado Pago del arrendador.

## Acceptance criteria

- [ ] Crear función `saveMercadoPagoToken(userId, token)` en actions
- [ ] Validar token con request a API de MP
- [ ] Guardar/actualizar en tabla UserIntegration
- [ ] Retornar error si el token es inválido

## Blocked by

0002-slice1-user-integration-model.md