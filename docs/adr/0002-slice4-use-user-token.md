## Parent

Issue #22 (Mercado Pago webhook fix)

## What to build

Modificar `generateMercadoPagoLink` para usar el token del arrendador en vez del token global.

## Acceptance criteria

- [ ] Modificar función para buscar UserIntegration del arrendador
- [ ] Usar accessToken del arrendador en vez de MERCADOPAGO_ACCESS_TOKEN del env
- [ ] Si no existe token configurado, retornar error indicando que debe configurar Mercado Pago
- [ ] Mantener fallback al token global si existe (para backward compatibility)

## Blocked by

0002-slice3-settings-ui.md