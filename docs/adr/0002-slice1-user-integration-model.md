## Parent

Issue #22 (Mercado Pago webhook fix)

## What to build

Crear tabla `UserIntegration` en Prisma para almacenar tokens de Mercado Pago de cada arrendador.

## Acceptance criteria

- [ ] Agregar modelo `UserIntegration` en schema.prisma con campos: userId, provider (MERCADO_PAGO), accessToken, isActive, createdAt, updatedAt
- [ ] Crear migración Prisma
- [ ] Agregar relación UserProfile → UserIntegration
- [ ] Verificar que la migración se aplica correctamente

## Blocked by

None - can start immediately