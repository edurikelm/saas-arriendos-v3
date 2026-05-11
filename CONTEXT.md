# RentalPro - Context

Sistema SaaS para gestión de arriendos de propiedades.

## Modelo de Datos

### ReservationClient (Cliente)
- Entidad independiente que puede existir sin reservas
- Campos: `id`, `user_id`, `name`, `email`, `phone`, `rut`, `notes?`, `created_at`

### Property (Propiedad)
- `units_available: Int` — todas las unidades son idénticas dentro de la propiedad
- `daily_price: Decimal` — precio por noche
- `monthly_price: Decimal?` — precio fijo mensual (opcional, es un descuento)
- `main_image: String` — imagen principal
- `images: String[]` — imágenes secundarias (máximo 10)
- `amenities: String[]`
- `color: String` — para visualización en calendario

### Reservation (Reserva)
- `units_booked: Int` — cuántas unidades se reservan (puede ser > 1)
- `billing_type: DAILY | MONTHLY` — elegido por el usuario al crear
- `start_date` — fecha de entrada (día de check-in)
- `end_date` — última noche (última noche que duerme el huésped, NO el día de check-out)
- `status: PENDING | CONFIRMED | CANCELLED | COMPLETED`
- `notes?` — notas editables del propietario para esa estadía

### Payment (Pago)
- Una reserva puede tener múltiples pagos parciales
- `method: MERCADO_PAGO | CASH | TRANSFER`
- `status: PENDING | COMPLETED | FAILED`
- `mercado_pago_id?` — para tracking de webhook

### ReservationChange (Auditoría de Cambios)
- Registra por **cada campo modificado**: `{field, old_value, new_value, created_at}`
- Incluye auditoría de: fechas, estado, cliente, propiedad, billing type, notas

## Reglas de Negocio

### Disponibilidad
- La reserva verifica disponibilidad por fecha completa (Option A)
- Si cualquier día del rango no tiene suficientes unidades disponibles, se rechaza

### Precio
- Si `billing_type: DAILY` → total = noches × daily_price (noches = end_date - start_date + 1)
- Si `billing_type: MONTHLY` → total = meses × monthly_price (precio fijo, no se mezcla con diario)
- El precio monthly es un descuento para estadías largas, no un umbral automático

### Pagos
- Diferido: la reserva se crea sin pago obligatorio
- Mercado Pago: webhook actualiza estado de pago
- Pagos manuales: el propietario registra efectivo/transferencia
- Reservas pueden estar CONFIRMED con saldo pendiente

### Cancelación
- Libre — cualquier parte puede cancelar
- Al cancelar: estado → CANCELLED, pagos permanecen como registro
- Sin automática — solo se cambia el estado

## Roles

### SUPER_ADMIN
- Acceso total a todos los propietarios
- Métricas globales: total propietarios, total propiedades, total ingresos
- Puede crear/editar/desactivar propietarios

### OWNER
- Solo ve sus propios datos (filtrado por `user_id`)
- Plan: FREE (3 propiedades, 5 clientes) o PRO (ilimitado)
- Registro automático (no requiere aprobación)

## Storage

- **Imágenes de propiedades** → Cloudinary (25GB gratis en tier gratuito)
- **PDFs y documentos** → Supabase Storage

## Tech Stack

- Next.js 16 App Router
- Server Actions para lógica de servidor
- Zod schemas compartidos en `lib/validations/`
- Sin Zustand — useState + URL params para estado
- Tests: unitarios para lógica de negocio, integración para flujos críticos
- Deploy: Vercel

## Reportes

- **Por propiedad:** reservas en rango, con totales (ingreso, pagado, pendiente)
- **Resumen general:** todas las propiedades, agrupadas

## Calendario

- Reservas **diarias** → mostradas como barra (inicio → fin)
- Reservas **mensuales** → NO aparecen en calendario visual, solo en lista de reservas

## Términos del Dominio

- **Owner** — propietario que usa el sistema para gestionar sus propiedades
- **ReservationClient** — huesped/Cliente que arrienda
- **Billing Type** — DAILY o MONTHLY, elegido al momento de crear la reserva
- **Units Booked** — cantidad de unidades reservadas dentro de la misma propiedad
- **Última Noche** — `end_date` representa la última noche que duerme el huésped, no el día de check-out. El cálculo de noches es `(end_date - start_date + 1)`