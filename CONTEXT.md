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
- `paymentType: RESERVATION | EXTRA` — `RESERVATION` corresponde al arriendo; `EXTRA` es un cobro independiente (multa, limpieza, etc.) que no afecta el `totalPrice` de la reserva
- `method: MERCADO_PAGO | CASH | TRANSFER`
- `status: PENDING | COMPLETED | FAILED`
- `mercadoPagoId` — preference_id de MP (para tracking de webhook)
- `initPoint` — URL del link de pago de MP
- `expiresAt` — fecha de expiración del link (7 días)
- `installment_index?` — ordinal de cuota en arriendos mensuales (1, 2, 3...)
- `due_date?` — fecha de vencimiento de la cuota (día 1 del mes correspondiente)
- `paid_at` — fecha y hora cuando el pago fue completado
- `receiptUrl?` — comprobante de pago subido manualmente por el propietario vía Cloudinary (aplica a todos los métodos: CASH, TRANSFER, MERCADO_PAGO). La API de MP no expone `receipt_url` para pagos con tarjeta.
- `deleted_at?` — soft delete para auditoría
- `title?` — título del pago (obligatorio solo para `EXTRA`)
- `description?` — descripción opcional (solo para `EXTRA`)

### Integración Mercado Pago

**OAuth:** Cada owner conecta su cuenta de Mercado Pago en `/settings` mediante OAuth Authorization Code + PKCE. El access token y refresh token se guardan encriptados en `UserIntegration` (provider `MERCADO_PAGO`). En producción no se usa `MERCADOPAGO_ACCESS_TOKEN`; el token manual solo existe para desarrollo/admin si `MP_MANUAL_TOKEN_ENABLED=true`. Ver ADR-0013.

**Checkout Pro:** Al generar link, RentalPro crea un `Payment` PENDING, llama a `/checkout/preferences` con el token del owner, guarda el `preference_id` en `Payment.mercadoPagoId` y guarda `init_point` en `Payment.initPoint`. Checkout Pro actual usa `init_point`; `sandbox_init_point` solo se conserva como metadata de respuesta.

El `external_reference` enviado a MP tiene formato: `reservationId:paymentId:timestamp`. La `notification_url` incluye `source_news=webhooks&paymentId=<paymentId>` para resolver el owner sin iterar integraciones.

**Flujo del webhook:**
1. Recibir `POST /api/webhooks/mercadopago` con firma `x-signature`/`x-request-id`.
2. Extraer evento desde body JSON (`action`, `data.id`) o query params (`data.id/type`, `id/topic`).
3. Resolver el owner por `paymentId` hint o por matching de pago.
4. Obtener token válido del owner con `getMercadoPagoToken(userId)`; refresca OAuth si expiró.
5. Consultar Mercado Pago con el token del owner (`GET /v1/payments/{id}` o `/merchant_orders/{id}`).
6. Procesar actualización (mapear status MP → status interno, setear `paidAt` con `date_approved`). El `receiptUrl` no se recibe del webhook — se sube manualmente desde la UI.
7. Responder 200 para errores no recuperables de negocio (pago no encontrado/token ausente) y evitar reintentos inútiles; responder 401 solo si la firma es inválida.

El webhook intenta matchear el pago en este orden:
1. Por `paymentId` hint de la `notification_url`.
2. Por `paymentId` extraído del `external_reference` (validado con regex `/^[a-z0-9]{20,}$/i`).
3. Por `preference_id` contra `Payment.mercadoPagoId`.
4. Por `mercadoPagoId = payment_id`.
5. Si ninguno funciona → error "Pago no encontrado" (sin fallback por fecha).

### ReservationChange (Auditoría de Cambios)
- Registra por **cada campo modificado**: `{field, old_value, new_value, created_at}`
- Incluye auditoría de: fechas, estado, cliente, propiedad, billing type, notas

## Reglas de Negocio

### Disponibilidad
- La reserva verifica disponibilidad por fecha completa (Option A)
- Si cualquier día del rango no tiene suficientes unidades disponibles, se rechaza

### Precio
- Si `billing_type: DAILY` → total = noches × daily_price (noches = end_date - start_date + 1)
- Si `billing_type: MONTHLY` → total = meses inclusivos × monthly_price (ej: 1 sept → 30 nov = 3 meses; precio fijo, no se mezcla con diario)
- El precio monthly es un descuento para estadías largas, no un umbral automático

### Pagos
- Diferido: la reserva se crea sin pago obligatorio
- Mercado Pago: webhook actualiza estado de pago
- Pagos manuales: el propietario registra efectivo/transferencia con `paid_at` y `method`; puede adjuntar comprobante (imagen) al crear el pago, al marcarlo como pagado, o después en un pago ya completado. Esto también aplica a pagos de Mercado Pago ya completados.
- Reservas pueden estar CONFIRMED con saldo pendiente
- **Arriendos mensuales (MONTHLY):** se generan N pagos pendientes al crear la reserva, uno por cada mes
- **Generación de pagos:** `amount = monthly_price × units_booked`, `due_date` = día 1 de cada mes cubierto, empezando por el mes de `start_date`
- **Link MP:** se genera bajo demanda (no al crear la reserva), vence en 7 días
- Al cancelar: DELETE pagos PENDING, KEEP pagos COMPLETED (auditoría financiera)

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

- **Imágenes de propiedades y comprobantes de pago** → Cloudinary (25GB gratis en tier gratuito)
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
- Las fechas de reserva en el calendario son **date-only** del dominio. Aunque el backend pueda serializarlas como ISO (`toISOString()`), la UI debe calcular posiciones usando solo `YYYY-MM-DD` para evitar desfases por timezone. `end_date` es inclusivo: una reserva 25→30 ocupa 6 noches y debe visualizarse hasta el 30.
- La vista mensual prioriza no generar scroll vertical en desktop: si una semana tiene más de 2 reservas superpuestas, muestra 2 barras y un botón `+N más`; al hacer click, esa semana se expande y el botón cambia a `Ocultar`. La vista timeline sigue siendo la vista densa para revisar todas las reservas por propiedad.

## Términos del Dominio

- **Owner** — propietario que usa el sistema para gestionar sus propiedades
- **ReservationClient** — huesped/Cliente que arrienda
- **Billing Type** — DAILY o MONTHLY, elegido al momento de crear la reserva
- **Units Booked** — cantidad de unidades reservadas dentro de la misma propiedad
- **Última Noche** — `end_date` representa la última noche que duerme el huésped, no el día de check-out. El cálculo de noches es `(end_date - start_date + 1)`
- **Payment Type** — `RESERVATION` (parte de la tarifa de arriendo, cuenta para `paidAmount`) o `EXTRA` (cobro independiente: multa, limpieza extra, etc., no cuenta para `paidAmount`)
- **Canal Externo** — plataforma externa desde la cual se origina o sincroniza una reserva, como Airbnb, Booking.com o VRBO. Evitar usar "Booking" solo, porque se confunde con **Reserva**.
- **Bloqueo de Canal Externo** — ocupación importada desde un **Canal Externo** que bloquea disponibilidad pero no cuenta como **Reserva** hasta que el owner la convierta manualmente.
- **Calendario Externo** — feed de calendario de un **Canal Externo** asociado a una propiedad para importar ocupaciones.
- **Recordatorio de Pago** — aviso asociado a un pago pendiente o vencido de una **Reserva** activa.
- **Documento de Reserva** — archivo asociado a una **Reserva** mensual, como contrato, anexo, inventario o respaldo firmado. No incluye comprobantes de pago.
- **Reporte de Cobranza** — vista financiera que muestra total reservado, pagado, pendiente y vencido de reservas, con segmentación general o por **Billing Type**, y pagos extra separados del saldo de arriendo.

## Relaciones

- Un **Bloqueo de Canal Externo** usa la misma convención de **Última Noche** que una **Reserva**: si el canal entrega un día de salida exclusivo, RentalPro lo interpreta como la noche anterior.
- Una propiedad puede tener varios **Calendarios Externos** activos, incluso del mismo **Canal Externo**.
- Un **Calendario Externo** puede sincronizarse manualmente y también en una cadencia automática diaria.
- El calendario exportado de una propiedad incluye **Reservas** activas y **Bloqueos de Canal Externo** activos, evitando reexportar bloqueos hacia el mismo **Canal Externo** que los originó.
- Cuando una **Reserva** interna se solapa con un **Bloqueo de Canal Externo**, la **Reserva** prevalece y el bloqueo externo queda como conflicto visible para el owner.
- Para disponibilidad, una **Reserva** y un **Bloqueo de Canal Externo** consumen unidades de la propiedad; cada bloqueo externo consume 1 unidad y solo la **Reserva** afecta pagos y reportes financieros.
- Un **Recordatorio de Pago** pertenece a un **Pago** pendiente, se dirige al **Owner** y solo se emite para reservas en estado **PENDING** o **CONFIRMED**.
- Un **Documento de Reserva** pertenece a una **Reserva** con **Billing Type** mensual.
- Un **Documento de Reserva** se conserva aunque la **Reserva** sea cancelada.
- Un **Reporte de Cobranza** agrupa datos de **Reservas** y **Pagos**; puede mostrarse para todos los **Billing Type** o filtrado por diario/mensual, y separa los **Payment Type** extra en columnas de pagado y pendiente.

## Patrones Next.js

### Componentes Server vs Client

Los layouts y páginas son Server Components por defecto. `'use client'` solo cuando es necesario.

**Patrón** `*LayoutClient`: Cuando un layout tiene datos de servidor (session) Y estado interactivo (sidebar toggle), se divide en:

```tsx
// layout.tsx (Server Component)
import { getSession } from "@/lib/actions/auth";
export default async function DashboardLayout({ children }) {
  const session = await getSession();
  return <DashboardLayoutClient children={children} userName={session.email} />;
}

// components/*LayoutClient.tsx (Client Component)
"use client";
export function DashboardLayoutClient({ children, userName }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // ...
}
```

### Error Handling

Cada route group debe tener `error.tsx` y `not-found.tsx`.

### Metadata

Todos los layouts deben exportar `metadata` para SEO.

### Middleware (Next.js 16+)

Usar `src/proxy.ts` con exports `proxy` y `config` en lugar de `middleware.ts`.

### Card wrapping en páginas de tabla

Todas las páginas que contienen tablas (clientes, reservas, admin/users) envuelven el contenido en el componente `<Card>` de shadcn/ui con `<CardHeader>` (título, descripción, acción principal) y `<CardContent>` (búsqueda, filtros, tabla). Esto da framing visual con `ring-1 ring-foreground/10` y separa claramente el área de datos del fondo. El layout (sidebar, navbar) provee el `bg-background` general; el Card aporta elevación sobre ese fondo.

### Diseño Responsive

Estrategia mobile-first con breakpoints estándar de Tailwind v4. Ver ADR-0015.

#### Tablas
Toda tabla DEBE envolverse en `<div className="overflow-x-auto">`. No se esconden columnas.

#### Barras de filtro y búsqueda
Se apilan vertical en mobile: `flex flex-col sm:flex-row sm:items-center gap-2`. Inputs y selects usan `w-full sm:w-auto`.

En páginas de datos con varios filtros (ej. `/reservations`), la barra de filtros puede ser colapsable. Debe conservar visible el encabezado con icono, título y contador de resultados (`filtradas / total`) aunque los controles estén ocultos. El botón de alternancia usa copy explícito `Ocultar`/`Mostrar`; `Limpiar filtros` solo aparece cuando hay filtros activos.

#### Diálogos modales
Todo `DialogContent` usa `w-[95vw]` como ancho base + `max-w-{tamaño}`.

#### Grids de cards
Progresión: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` (o 4).

#### Calendario
Grid de 7 columnas en todas las resoluciones. Celdas: `min-h-12 sm:min-h-20 lg:min-h-24`.

### Base UI / Botones y Links

- El componente `Button` (Base UI) asume botón nativo (`nativeButton=true` por defecto).
- Para navegación, **no** usar `render={<Link .../>}` en `Button`, porque rompe la semántica esperada y genera warning en consola.
- Enlaces con apariencia de botón deben implementarse con `Link` + `buttonVariants(...)` desde `src/components/ui/button.tsx`.
- Mantener `Button` para acciones reales (`onClick`, submit de formularios, etc.).

### Ver también

- ADR-0002: `docs/adr/0002-nextjs-app-router-patterns.md`
- ADR-0012: `docs/adr/0012-monthly-payment-generation.md`
- ADR-0015: `docs/adr/0015-responsive-design-strategy.md`
