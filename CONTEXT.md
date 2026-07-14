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
- **Transición a CONFIRMED**: una reserva pasa a `CONFIRMED` solo cuando la suma de `Payment` con `status: COMPLETED`, `paymentType: RESERVATION` y `deletedAt: null` alcanza `totalPrice`. Pagos `PENDING` o `paymentType: EXTRA` no participan en esta transición.
- **Fechas de cobranza y recordatorios** (vencidos / vencen hoy / próximos 7 días) se calculan en wall-time `America/Santiago`, no en UTC. Ver ADR-0020.

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

- Vista por defecto: **Timeline** (no grid). El toggle grid↔timeline está en el header.
- Reservas **diarias** → mostradas como barra (inicio → fin)
- Reservas **mensuales** → NO aparecen en calendario visual, solo en lista de reservas
- Las semanas del calendario empiezan en lunes y terminan en domingo.
- Las fechas de reserva en el calendario son **date-only** del dominio. Aunque el backend pueda serializarlas como ISO (`toISOString()`), la UI debe calcular posiciones usando solo `YYYY-MM-DD` para evitar desfases por timezone. `end_date` es inclusivo: una reserva 25→30 ocupa 6 noches y debe visualizarse hasta el 30.
- La vista mensual (grid) calcula cuántas barras completas caben en la altura por defecto de cada semana. Si sobran eventos, se colapsan en un raíl compacto de líneas finas superpuestas con un indicador `+N`, sin crecer la fila; al pasar el mouse se previsualiza toda la semana expandida. El botón global (`Expandir todas`/`Colapsar todas`) permite fijar la expansión de todas las semanas con overflow.

### Calendarios Externos

- **Disponibilidad** suma `Reservation.unitsBooked` + 1 por cada **Bloqueo de Canal Externo** activo que cubra ese día.
- Cada **Bloqueo de Canal Externo** activo consume 1 unidad de disponibilidad por día cubierto.
- **Calendario Externo** se identifica por `(channel, propertyId, feedUrl)`; **Bloqueos** se identifican por `(externalCalendarId, externalUid)`.
- Sync diario de **Calendarios Externos** vía Vercel Cron a las 06:00 UTC.
- Cuando un evento desaparece del feed: **Bloqueo** se marca `INACTIVE` (no delete físico).
- Cuando sync falla: se conserva último `lastSyncedAt` válido y se persiste `lastSyncError`.
- Solo plan PRO. Sync manual vía server action, automático vía Vercel Cron con auth `Bearer ${ICAL_CRON_SECRET}`.
- **iCal NO es fuente financiera**: el sync nunca crea `Payment`, `ReservationClient` ni `Reservation`; la conversión de un **Bloqueo de Canal Externo** a **Reserva** es siempre manual desde la UI. Ver ADR-0018 ("Semántica de fuente").
- Todas las fechas importadas/exportadas vía iCal se interpretan en wall-time `America/Santiago`. Ver ADR-0020.

### Timeline (vista por defecto)

- Contenedor **sin altura fija**: se adapta al contenido (cantidad de propiedades × 76px por fila + header).
- El ancho de cada día es dinámico: mínimo `42px`, pero se expande para llenar el viewport disponible si sobra espacio horizontal (`dayWidth = max(42, (viewportWidth - propertyColumnWidth) / nDays)`).
- Si no alcanza el ancho, aparece scroll horizontal.
- Cada propiedad es una fila con sticky label a la izquierda. En mobile usa una columna compacta (`156px`) para liberar espacio a los días; desde `sm` usa `224px`.
- Las reservas se renderizan como barras horizontales en un solo carril por fila (sin lane stacking).

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
- **Ticket de Soporte** — conversación creada por un **Owner** para reportar un problema o pedir ayuda, atendida por un **SUPER_ADMIN**.
- **Estado de Ticket de Soporte** — etapa de atención de un **Ticket de Soporte**: abierto, en progreso, resuelto o cerrado.
- **Prioridad de Ticket de Soporte** — nivel de impacto declarado para ordenar la atención de un **Ticket de Soporte**: baja, media o alta.
- **Categoría de Ticket de Soporte** — área afectada por un **Ticket de Soporte**: reservas, pagos, propiedades, cuenta u otro.
- **Adjunto de Ticket de Soporte** — imagen asociada a un mensaje de un **Ticket de Soporte** para evidenciar un problema.
- **Última Actividad de Ticket de Soporte** — momento más reciente en que un **Ticket de Soporte** fue creado, respondido o cambió de estado.

## Relaciones

- Un **Bloqueo de Canal Externo** usa la misma convención de **Última Noche** que una **Reserva**: si el canal entrega un día de salida exclusivo, RentalPro lo interpreta como la noche anterior.
- Una propiedad puede tener varios **Calendarios Externos** activos, incluso del mismo **Canal Externo**.
- Un **Calendario Externo** puede sincronizarse manualmente y también en una cadencia automática diaria.
- El calendario exportado de una propiedad incluye **Reservas** activas y **Bloqueos de Canal Externo** activos, evitando reexportar bloqueos hacia el mismo **Canal Externo** que los originó.
- Un **Feed de Exportación iCal** se identifica por `(propertyId, channel)` y genera una URL tokenizada por canal. El token se almacena como hash SHA-256 (no bcrypt). La URL es válida para polling de canales externos. El token raw solo se muestra una vez al crear o regenerar el feed.
- Cuando una **Reserva** interna se solapa con un **Bloqueo de Canal Externo**, la **Reserva** prevalece y el bloqueo externo queda como conflicto visible para el owner.
- Para disponibilidad, una **Reserva** y un **Bloqueo de Canal Externo** consumen unidades de la propiedad; cada bloqueo externo consume 1 unidad y solo la **Reserva** afecta pagos y reportes financieros.
- Un **Recordatorio de Pago** pertenece a un **Pago** pendiente, se dirige al **Owner** y solo se emite para reservas en estado **PENDING** o **CONFIRMED**.
- Un **Documento de Reserva** pertenece a una **Reserva** con **Billing Type** mensual.
- Un **Documento de Reserva** se conserva aunque la **Reserva** sea cancelada.
- Un **Reporte de Cobranza** agrupa datos de **Reservas** y **Pagos**; puede mostrarse para todos los **Billing Type** o filtrado por diario/mensual, y separa los **Payment Type** extra en columnas de pagado y pendiente.
- Un **Ticket de Soporte** pertenece a un **Owner**, es creado por ese **Owner**, puede ser atendido por un **SUPER_ADMIN** y puede tener múltiples mensajes de seguimiento.
- El **Owner** de un **Ticket de Soporte** no cambia después de su creación.
- Un **Owner** solo ve sus propios **Tickets de Soporte**.
- Un **Owner** puede crear **Tickets de Soporte** independientemente de su plan.
- La creación in-app de **Tickets de Soporte** está disponible para **Owners** activos.
- Un **SUPER_ADMIN** puede ver todos los **Tickets de Soporte**.
- La **Prioridad de Ticket de Soporte** y la **Categoría de Ticket de Soporte** pueden ser declaradas por el **Owner** al crear el ticket y ajustadas después por un **SUPER_ADMIN**.
- Un **Ticket de Soporte** solo puede ser marcado como resuelto por un **SUPER_ADMIN** y puede ser cerrado por su **Owner** o por un **SUPER_ADMIN**.
- Un **Ticket de Soporte** abierto pasa a en progreso cuando un **SUPER_ADMIN** agrega su primera respuesta, salvo que lo marque directamente como resuelto.
- Un **Ticket de Soporte** cerrado puede reabrirse cuando su **Owner** agrega un nuevo mensaje de seguimiento.
- Un **Owner** y un **SUPER_ADMIN** pueden responder un **Ticket de Soporte** abierto, en progreso o resuelto; en un ticket cerrado, solo el **Owner** puede responder para reabrirlo.
- Los mensajes de un **Ticket de Soporte** son visibles para su **Owner** y para los **SUPER_ADMIN**; no hay mensajes internos de soporte por defecto.
- Cada mensaje de **Ticket de Soporte** pertenece a un autor: el **Owner** del ticket o un **SUPER_ADMIN**.
- Un mensaje de **Ticket de Soporte** puede tener hasta tres **Adjuntos de Ticket de Soporte**.
- La atención de **Tickets de Soporte** se informa dentro de RentalPro; no implica notificaciones externas por defecto.
- Cada participante puede distinguir si un **Ticket de Soporte** tiene mensajes nuevos desde su última lectura.
- Un **Ticket de Soporte** puede referenciar opcionalmente una **Reserva**, un **Pago** o una **Propiedad** afectada.
- Un **SUPER_ADMIN** puede ver la entidad afectada referenciada por un **Ticket de Soporte**.
- El contenido inicial de un **Ticket de Soporte** no se edita; la información adicional se agrega como mensajes de seguimiento.
- Los mensajes de un **Ticket de Soporte** no se editan ni eliminan; las correcciones se agregan como nuevos mensajes.
- Los **Tickets de Soporte** no se eliminan desde la UI; se cierran cuando ya no requieren acción.

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

**Patrón** `*PageClient` (similar a `*LayoutClient` pero para páginas pesadas con datos pre-computados): cuando una página combina mucho data fetching server-side (server actions sobre Promise.all) con mucha interactividad client-side (filtros, paginación, exports), se divide en `page.tsx` Server Component async + `_<recurso>/_components/<recurso>-client.tsx` Client Component. Solo pasan datos serializables.

```tsx
// page.tsx (Server Component, async)
export const dynamic = "force-dynamic"; // si usa cookies() o headers()
export default async function ReportsPage() {
  const [stats, revenueData, /*...*/] = await Promise.all([...]);
  return <ReportsClient initialStats={stats} initialRevenueData={revenueData} /*...*/ />;
}

// _components/reports-client.tsx (Client Component)
"use client";
export function ReportsClient({ initialStats, /*...*/ }) {
  // filtros + paginación + re-fetch desde client (llamadas directas a server actions)
}
```

Requiere `export const dynamic = "force-dynamic"` en el page.tsx si las server actions usan `cookies()`. Ejemplo canónico: `src/app/(dashboard)/reports/page.tsx` + `_components/reports-client.tsx` (commit `bdc48e9`).

### Error Handling

Cada route group debe tener `error.tsx` y `not-found.tsx`.

### Metadata

Todos los layouts deben exportar `metadata` para SEO.

### Middleware (Next.js 16+)

Usar `src/proxy.ts` con exports `proxy` y `config` en lugar de `middleware.ts`.

### Guards de Ruta por Rol

Los guards de ruta usan dos capas:

1. **proxy.ts** — guard de autenticación temprano (valida JWT). Solo redirige a `/login` si no hay sesión. No decide por rol — el rol siempre se resuelve desde DB.
2. **Layouts** con guards server-side (`requireOwner`, `requireSuperAdmin`) que consultan `getSession()` (DB). Son la fuente autoritativa de rol.

**Cadena de guards:**
```
proxy.ts (auth gate) → layout.tsx (role guard via DB) → children
```

**Funciones disponibles en `src/lib/actions/auth.ts`:**
- `getSession()` — retorna `SessionUser | null` (consulta DB)
- `requireAuth()` — redirect a `/login` si no hay sesión
- `requireOwner()` — redirect SUPER_ADMIN a `/admin`
- `requireSuperAdmin()` — redirect no-SUPER_ADMIN a `/dashboard`

**En layouts:**
```tsx
// (dashboard)/layout.tsx — solo owners
const session = await requireOwner();

// admin/layout.tsx — solo super admins
const session = await requireSuperAdmin();
```

**Helper de rutas por defecto en `src/lib/auth/role-routes.ts`:**
- `getDefaultPathForRole(role)` — retorna `/admin` para SUPER_ADMIN, `/dashboard` para cualquier otro
- Usado en `page.tsx` (root redirect) y `login-form.tsx` (post-login redirect).

### Card wrapping en páginas de tabla

**Decisión de diseño**: las tablas NO se envuelven en `<Card>`. El `<DataTable>` primitive ya provee su propio framing con `rounded-md border border-border bg-card` (ver `src/components/ui/data-table.tsx:14`). Envolver la tabla en un `<Card>` adicional genera doble borde y rompe la jerarquía visual.

Patrón canónico:
- Página de lista → `PageHeader` + barra de filtros + `<DataTable>` directo (sin Card)
- Sección de página (ej: `/admin/users/[id]` tab "Reservas") → título/descripción como bloque standalone + `<DataTable>` directo
- `/dashboard` sección "Reservas Diarias" → título + link "Ver todas" como bloque standalone + `<DataTable>` directo
- `/reports` sección "Reporte de Cobranza" → título + filtros standalone + `<DataTable>` directo

`<Card>` se reserva para: KPIs (no tablas), settings, forms, secciones de detalle sin tabla, integración de Mercado Pago. **NO** usar Card para envolver tablas.

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
- ADR-0018: `docs/adr/0018-external-calendar-sync.md` — iCal import + semántica de fuente no financiera
- ADR-0019: `docs/adr/0019-ical-export-feed.md` — iCal export por canal con anti-eco
- ADR-0020: `docs/adr/0020-business-dates-timezone.md` — fechas de negocio en `America/Santiago`
- ADR-0025: `docs/adr/0025-reservations-domain-seam.md` — `src/lib/reservations/` como seam canónico de lógica de dominio de Reservation (transiciones de estado, confirmación, validaciones)

## Seams de dominio en `src/lib/`

Además de las acciones en `src/lib/actions/`, los siguientes módulos puros encapsulan lógica de dominio y deben consultarse antes de duplicarla en código nuevo:

- **`lib/reservations/confirmation.ts`** — `confirmReservationIfPaid(reservationId, adapter?)` (ver ADR-0025). Acepta `Prisma.TransactionClient` o `prisma` global como adapter opcional para `$transaction`.
- **`lib/reservations/state-machine.ts`** — `canTransition({from, to, completedReservationPayments})`. Tabla de transiciones de `Reservation.status` codificada (4×4); fuente autoritativa para validar updates.
- **`lib/payments/calculations.ts`** — `getReservationPaidAmount(payments)`, `getReservationPendingAmount(payments, totalPrice)`. Lógica pura sobre `Payment[]` (sin DB), opera sobre shape `PaymentLike`.
- **`lib/payments/monthly.ts`** — `generateMonthlyPayments(startDate, months, monthlyPrice, unitsBooked)`. Genera inputs `Payment` para reservas `MONTHLY`. **Decisión de dominio** (per ADR-0012): `dueDate` = día 1 del **mismo mes** que `startDate`, no del mes siguiente. Ejemplo canónico: `Sep 1 → Sep 1, Oct 1, Nov 1`.
- **`lib/payments/queries.ts`** (Tier 2 #7) — Seam canónico de queries Prisma para `Payment`. 11 helpers:
  - Lookup: `getPaymentById`, `getPaymentByMercadoPagoId`
  - Por reserva: `getAllPaymentsForReservation`, `getActivePaymentsForReservation`
  - Aggregates: `sumCompletedPaymentsForOwner`, `sumPendingPaymentsForOwner`, `countPendingPaymentsForOwner`, `sumCompletedPaymentsAll`
  - Updates: `markPaymentCompleted`, `markPaymentStatus`, `revertPaymentToPending`
  - Counters: `countCompletedPaymentsForReservation`
  - Patrón adapter: cada helper acepta un tercer argumento `adapter: QueryAdapter = prisma` para participar en `$transaction`. Mismo patrón que `lib/reservations/confirmation.ts`.
  - **Decisión de dominio** KPI revenue: usa `paidAt` (cash basis: cuándo entró el dinero), NO `createdAt`. Alineado con `getPaymentsKpis` en `payments.ts` (más reciente, financieramente correcto). Migrado en commits `2029f90` y `8d1e23d`.
- **`lib/support/queries.ts`** (Bloque 5 T6) — Seam canónico de queries Prisma para `SupportTicket`. Consolida la query duplicada entre `lib/actions/support.ts` y `lib/actions/admin-support.ts` (~12 líneas de `findMany` con `include: { user, messages }` repetidas). 9 helpers:
  - Helpers puros (sin DB): `resolveAffectedEntityAdmin` (orden PROPERTY → RESERVATION → PAYMENT), `resolveAffectedEntityOwner` (orden RESERVATION → PAYMENT → PROPERTY). Solo chequean las **relations** populadas, no los FKs.
  - Builds: `buildUnreadMap(userId, ticketIds)` retorna `Map<ticketId, lastReadAt>`. Batched: una sola `findMany({ ticketId: { in: [...] } })`. Si `ticketIds` está vacío, retorna `Map` sin tocar la DB.
  - Owner list: `getOwnerSupportTickets(userId, { page, limit, status })` — paginado, `orderBy: { lastActivityAt: "desc" }`, filtra por `userId` en `where`.
  - Owner detail: `getOwnerSupportTicketDetail(userId, ticketId)` — `findUnique` con `userId` en el `where` (defense in depth contra acceso cross-owner). Retorna `null` si no pertenece.
  - Admin list: `getAdminSupportTickets({ statusFilter, filters })` — sin paginación (limit 20 fijo), `orderBy: [{ priority: "desc" }, { status: "asc" }, { lastActivityAt: "desc" }]`. Default `statusFilter` oculta CLOSED.
  - Admin detail: `getAdminSupportTicketDetail(ticketId)` — `findUnique` sin filtro de `userId` (admin ve todos).
  - Aggregates KPI: `countTicketsByStatusForOwner(userId)`, `getOwnerTicketsForResponseTime(userId)`.
  - Patrón adapter: cada helper acepta un tercer argumento `adapter: QueryAdapter = prisma` para participar en `$transaction`. Mismo patrón que `lib/payments/queries.ts`.
  - Tipos exportados: `SupportTicketWithUnreadMessages`, `AdminSupportTicketWithRelations`, `OwnerSupportTicketDetail`, `AdminSupportTicketDetail`, `StatusFilter`, `AdminTicketFilters`.

Los callsites que NO encajan en estos helpers (select+groupby custom, where+include complejo) quedan inline. Si un patrón repetido aparece, agregar helper.

## Estado del proyecto / Backlog activo

**Última verificación de baseline** (commit `58407a9` en `origin/master`, 2026-07-14):
- `npm run typecheck` → 0 errores
- `npm run lint --quiet` → 0 errores (476 warnings de `no-explicit-any` y `no-unused-vars` en 350 archivos, ver decisión abajo)
- `npm run test:run` → 1140/1140 verde (77s)
- **Perf audit 2026-07-12**: cerrado al 100% (4/4 HIGH + 3/3 MED + 3 errores de lint restantes)

### Backlog activo (en orden sugerido)

1. **PRD-0002 — Copiar/Eliminar links Mercado Pago** (`docs/prd/PRD-0002-payments-copy-delete.md`)
   Tamaño: S. Bloqueable. Independiente. Recomendado como próximo: aporta UX directa al owner y no toca modelo de datos.

2. **PRD-0003 — Sistema de Notificaciones in-app + email** (`docs/prd/PRD-0003-notifications.md`)
   Épica grande. Arquitectura ya decidida en ADR-0021. Implementar por slices tracer-bullet (issue tracker).

3. **PRD-0001 — Arquitectura: profundización de módulos** (`docs/prd/PRD-0001-arquitectura-deepening.md`)
   Refactor técnico (ChangeRecorder, PaymentGateway, seam calendar, etc.). Usar skill `improve-codebase-architecture` antes de tacklearlo.

4. **Admin user management** (`docs/prd/admin-user-management-roadmap.md` + `docs/prd/super-admin-panel.md`)
   Roadmap y PRD se solapan (roadmap es sucesor del PRD inicial). Decidir si se actualiza `super-admin-panel.md` con referencia al roadmap, o se elimina el PRD absorbed.

5. **PLAN.md — Rediseño UI Ocean Breeze** (`PLAN.md`)
   4 fases (Fase 0 auditoría → Fase 1 design system en Stitch → Fase 2 pantallas piloto → Fase 3 migración por lotes → Fase 4 implementación). **Bloqueado hasta responder las 4 preguntas abiertas** del §Preguntas abiertas: color de acento, top 3-5 pantallas prioritarias, screenshots, estado del proyecto.

### Decisiones pendientes

- **Lint warnings (476)**: bajo impacto real, alto ruido en CI. Opciones: (a) override `no-explicit-any` a `warn` en `eslint.config.mjs` (3 líneas, cero código tocado); (b) refactor archivo por archivo; (c) ignorar. Decisión del usuario cuando quiera tacklearlo.
- **Handoffs en `docs/handoffs/_archive/`**: documentos históricos de sesiones cerradas. No usar como guía de implementación (sus conteos y distribuciones no reflejan el código actual).
