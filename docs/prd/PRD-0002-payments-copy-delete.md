# PRD-0002: Botones Copiar/Eliminar para links de pago Mercado Pago

## Problem Statement

El propietario de una propiedad necesita gestionar links de pago de Mercado Pago cuando estos expiran o necesitan ser reenviados. No existe forma de copiar el link para reenviarlo manualmente, ni de eliminar un registro cuando el link ya no es valido.

## Solution

Agregar funcionalidad en el listado de pagos de cada reserva:

1. **Copiar link de pago** - boton para copiar initPoint al portapapeles
2. **Eliminar registro de pago** - con confirmacion y undo de 5 segundos
3. **Badge Expirado** - cuando el link esta vencido y pago PENDING
4. **Regenerar link** - cuando un link expiro, generar uno nuevo
5. **Generar Link** - flujo simplificado: generar link -> ver listado -> copiar link

## User Stories

1. Como propietario, quiero copiar el link de pago de Mercado Pago para poder reenviarlo por WhatsApp o email al cliente
2. Como propietario, quiero eliminar un registro de pago cuando el link expiro y necesito crear uno nuevo, sin dejar registros orfanos
3. Como propietario, quiero ver claramente cuando un link de pago ha expirado, para saber que debo regenerarlo
4. Como propietario, quiero tener confirmacion antes de eliminar un pago, para evitar clics accidentales
5. Como propietario, quiero poder deshacer una eliminacion accidental dentro de los 5 segundos posteriores
6. Como propietario, quiero regenerar un link de pago cuando el anterior expiro, sin perder el registro del pago

## Implementation Decisions

**Schema - Payment model:**
- `initPoint String?` - URL del link de pago de Mercado Pago
- `expiresAt DateTime?` - fecha de expiracion del link (7 dias por defecto)
- `deletedAt DateTime?` - soft delete para permitir recuperacion

**API - deletePayment:**
- Cambiar de hard delete a soft delete (`deletedAt = now()`)
- Filtrar `deletedAt: null` en todas las queries existentes

**API - restorePayment:**
- Nuevo action para limpiar `deletedAt` (undo)
- Endpoint PUT `/api/payments/[id]`

**API - regeneratePaymentLink:**
- Verifica que el link este expirado (`expiresAt < now()`)
- Llama a Mercado Pago para generar nueva preferencia
- Actualiza `initPoint` y `expiresAt` en el registro
- Endpoint POST `/api/payments/[id]`

**UI - Pago listing:**
- Badge Expirado (rojo) cuando `expiresAt < now && status === PENDING`
- Boton Copiar (icono clipboard) visible cuando `initPoint` existe Y `method === MERCADO_PAGO` Y `status === PENDING` Y `!isExpired`
- Boton Regenerar (icono refresh) visible cuando `method === MERCADO_PAGO` Y `status === PENDING` Y `isExpired`
- Boton Eliminar con `confirm()` antes de ejecutar
- Toast "Pago eliminado" con boton "Deshacer" por 5 segundos

**UI - Generar Link de Pago (Mercado Pago):**
- Formulario de nuevo pago: campos Monto + Metodo (MERCADO_PAGO)
- Botones "Generar Link de Pago" y "Cancelar" lado a lado
- Despues de generar: toast "Link generado - Copia el link desde el listado de pagos", form se limpia, listado se refresca
- El pago aparece en el listado con boton Copiar disponible
- El boton "Registrar Pago" para MERCADO_PAGO permanece deshabilitado hasta generar link (no hay registro manual)
- Para cambiar metodo de pago: click en "Cancelar" del form, seleccionar otro metodo

**UX - Visibilidad de botones:**

| Payment status | Link status | Copiar | Regenerar |
|---------------|------------|--------|----------|
| PENDING | No expiró | ✅ | ❌ |
| PENDING | Expiró | ❌ | ✅ |
| COMPLETED | Cualquiera | ❌ | ❌ |

- Copiar disponible cuando el link existe y es utilizable (no expiró)
- Regenerar solo cuando el link expiró y el pago sigue pendiente
- Si expiró, no tiene sentido copiar → solo regenerar tiene sentido

## Testing Decisions

- El badge Expirado solo aparece cuando `expiresAt` esta en el pasado Y `status` es PENDING
- El boton Copiar solo aparece cuando `initPoint` existe Y `method === MERCADO_PAGO` Y `status === PENDING` Y link no expiró
- El boton Regenerar solo aparece cuando `method === MERCADO_PAGO` Y `status === PENDING` Y `expiresAt` en el pasado
- El undo limpia `deletedAt` y el pago vuelve a aparecer en el listado
- `regeneratePaymentLink` retorna error si el link aun no ha expirado

## Out of Scope

- Cancelacion de pagos en Mercado Pago API al eliminar localmente
- Filtrar pagos eliminados en otros listados fuera de la vista de reserva
- Historico de pagos eliminados con recuperacion por soporte

## Further Notes

Los links de Mercado Pago expiran por defecto a los 7 dias. El campo `expiresAt` se guarda explicitamente para casos donde el link fue generado hace mas tiempo.

## Issues Relacionados

- #39 - DB: Agregar campos initPoint, expiresAt, deletedAt a Payment
- #40 - API: Soft delete y restorePayment
- #41 - API: Guardar initPoint y expiresAt al crear pago
- #42 - API: Regenerar link de pago expirado
- #43 - UI: Botones Copiar/Eliminar + Badge Expirado