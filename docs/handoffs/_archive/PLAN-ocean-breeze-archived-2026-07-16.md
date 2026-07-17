# ARCHIVED — Ocean Breeze Plan (Original Draft)

> **Estado: ARCHIVADO — NO usar como guía de implementación.**
>
> Este documento es el plan original del rediseño UI "Ocean Breeze" (sesiones previas a Fase 1). Fue **completamente ejecutado y cerrado** el 2026-07-06. Los tokens y decisiones que contiene quedaron **supercedidos** por la implementación real.
>
> **Source of truth vigente:** [`DESIGN.md`](../../../DESIGN.md) (raíz del repo).
>
> **Ejecución cerrada:**
> - **Fase 1** (`f19d424`) — issue #173 — design system en `globals.css` + tipografía DM Sans
> - **Fase 2** (2026-07-06) — issues #174 / #175 / #176 — calendar tokenizado, admin refactor, `<DataTable>` primitive + 6 tablas migradas + `w-[95vw]` en 4 modales, hex fallback `var(--primary)`
> - **Refinamientos posteriores**: `/settings` rediseño (#183), `/payments` ruta completa (`b260fcf`), `<KpiCard>` primitive único (ADR-0024), consolidación de h1 3-tier, responsive notification bell, etc.
>
> **Preguntas abiertas — resolución final:**
>
> | Pregunta original | Respuesta implementada |
> |---|---|
> | Color de acento (a/b/c/d) | **(c) Teal** — `oklch(0.7227 0.1920 149.5793)` = `#2DBE85` (light) / `oklch(0.7729 0.1535 163.2231)` (dark) |
> | Top 3-5 pantallas prioritarias | Calendar (Timeline + grid), lista de pagos (`/payments`), lista de reservas, dashboard, settings, soporte, admin |
> | Screenshots / Stitch reference | Stitch project `projects/1529269251022042678` ("RentalPro - Rediseño UI") |
> | Estado del proyecto | En desarrollo, pre-deploy (Vercel sin clientes reales) → migración pantalla por pantalla según lote |
>
> **Por qué sigue aquí:** referencia histórica de la decisión original (Fase 0 auditoría). Útil para entender por qué se eligieron los tokens actuales. **No refleja** los refinamientos posteriores (radio system ADR-0016, KPI consolidation ADR-0024, página-title tiers, etc.).
>
> ---

# RentalPro — Plan de Rediseño UI

## Contexto del proyecto

**RentalPro** es un SaaS B2B para **propietarios (owners)** que gestionan arriendos de propiedades. NO es un marketplace tipo Airbnb para huéspedes: los huéspedes (`ReservationClient`) son entidades de datos registradas por el owner, no usuarios del sistema.

- **Roles:** `SUPER_ADMIN` (acceso total) y `OWNER` (datos filtrados por `user_id`)
- **Planes:** FREE (3 propiedades, 5 clientes) / PRO (ilimitado)
- **Stack:** Next.js 16 App Router, Server Actions, Zod, shadcn/ui + Base UI (style `base-nova`), Supabase, Cloudinary, Vercel
- **Idioma de fechas:** `America/Santiago` (wall-time, no UTC)
- **Calendario:** vista Timeline por defecto (toggle grid↔timeline)
- **Estado del proyecto:** en desarrollo, deployado en Vercel sin clientes reales. Migración pantalla por pantalla.

Lo que ya está decidido y NO se reinventa:
- Next.js 16 App Router con Server Components por defecto
- shadcn/ui + Base UI para componentes base (Botones con `nativeButton=true`)
- Patrón de **Card wrapping** para todas las páginas con tablas (`ring-1 ring-foreground/10`)
- Mobile-first con Tailwind v4 (breakpoints estándar)
- Calendario en Timeline con semanas lunes-domingo, dominio date-only
- Filtros colapsables, tablas con scroll horizontal, modales `w-[95vw]`
- Sin Zustand — useState + URL params
- Tokens semánticos (`--success`, `--warning`, `--info`, `--destructive`) ya implementados
- Sidebar con `bg-sidebar` (no colores hardcodeados)

---

## Dirección de diseño

**"Dense-but-clean B2B dashboard"** — inspirado en Linear, Stripe Dashboard, Vercel.

**Tema elegido: Ocean Breeze** (preset de tweakcn). Aplicado en `src/app/globals.css` y `src/app/layout.tsx` (font DM Sans). Referencia histórica en `src/styles/themes/ocean-breeze.css`.

El usuario owner trabaja con información densa a diario (calendarios, listas de pagos, reservas múltiples). "Minimalista" acá NO significa "vacío" — significa **ordenado, predecible, sin ruido visual**.

**Reglas de composición:**
- Una sola acción primaria por pantalla; el resto, secondary u outlined
- Estados como badges de texto (no iconos sueltos): `Pagado`, `Pendiente`, `Vencido`, `Confirmado`, `Cancelado`
- Filtros siempre con etiqueta visible (no solo iconos)
- KPIs: número grande + label pequeño debajo
- Filas de tabla: `hover:bg-slate-50`, sin zebra striping
- Iconos: `h-4 w-4` inline, `h-5 w-5` para acciones
- Bordes finos en lugar de sombras (`1px slate-200`)
- Bordes muy sutiles (`slate-100`) para divisores internos de filas/listas

### Tokens activos (Ocean Breeze aplicados)

| Token | Light | Dark | Notas |
|---|---|---|---|
| `primary` | `oklch(0.7227 0.1920 149.5793)` | `oklch(0.7729 0.1535 163.2231)` | Teal/aqua vibrante — reemplaza azul anterior |
| `background` | `oklch(0.9751 0.0127 244.2507)` | `oklch(0.2077 0.0398 265.7549)` | Tinte cool sutil en light, azul oscuro profundo en dark |
| `accent` | `oklch(0.9505 0.0507 163.0508)` | `oklch(0.3729 0.0306 259.7328)` | Mint muy claro (light) / slate azulado (dark) |
| `radius` | `0.5rem` (8px) | igual | Cambió de `0.375rem` (6px) — un toque más suave |
| `font-sans` | DM Sans | igual | Cambió de Geist — geométrica, moderna |
| `--success` / `--warning` / `--info` | conservados | conservados | Tokens semánticos del proyecto preservados, armonizados al teal |

**Utilidades que dependen del primary y se actualizaron automáticamente:**
- `.dashboard-shell-bg` — gradient radial con `color-mix(... var(--primary) 10%)` ya hereda teal
- `.hero-gradient` — actualizado a `color-mix` en lugar de OKLCH hardcodeado

**Pendiente menor:** confirmar visualmente en `/dashboard`, `/propiedades`, `/reservations`, `/clients`. Si algo no convence, iteramos antes de seguir.

---

## Sistema de diseño (tokens)

### Colores

| Token | Valor | Uso |
|---|---|---|
| `bg-app` | `#FAFAFA` (slate-50) | Fondo general del dashboard |
| `bg-card` | `#FFFFFF` | Cards, tablas, modales |
| `text-primary` | `#0F172A` (slate-900) | Títulos, contenido principal |
| `text-secondary` | `#64748B` (slate-500) | Fechas, metadatos, precios secundarios |
| `text-tertiary` | `#94A3B8` (slate-400) | Hints, placeholders, ayuda |
| `border-default` | `#E2E8F0` (slate-200) | Bordes de Card, inputs, separadores principales |
| `border-subtle` | `#F1F5F9` (slate-100) | Divisores internos de filas, separadores suaves |
| `accent` | *pendiente* | CTA principal, foco, links activos |
| `success` | `#15803D` (green-700) | Pagado, confirmado, sync OK |
| `warning` | `#B45309` (amber-700) | Vencido, vence hoy |
| `danger` | `#B91C1C` (red-700) | Cancelado, pago fallido, errores |
| `info` | `#1D4ED8` (blue-700) | Info neutral, recordatorios |

### Tipografía

- **Body / todo:** Inter (regular 400, medium 500, semibold 600, bold 700)
- **Sin segunda fuente.** La jerarquía se construye por tamaño y peso.
- Escala sugerida:
  - `text-xs` (12px) — metadata, hints, badges
  - `text-sm` (14px) — cuerpo de tabla, labels
  - `text-base` (16px) — texto general
  - `text-lg` (18px) — subtítulos de sección
  - `text-xl` (20px) — títulos de Card
  - `text-2xl` (24px) — títulos de página
  - `text-3xl` (30px) — KPIs principales
  - `text-4xl` (36px) — solo en landing / hero

### Espaciado

Escala: `4 / 8 / 12 / 16 / 24 / 32 / 48`

- Filas de tabla: `py-3` (12px vertical) — denso pero respirable
- Padding de Card: `p-6` (24px)
- Separación entre secciones: `space-y-6` o `gap-6`
- Entre Cards: `gap-4`
- Dentro de formularios: `space-y-4` entre campos

### Radios

- `rounded-md` (6px) — botones, inputs, badges
- `rounded-lg` (8px) — Cards, contenedores
- `rounded-xl` (12px) — modales, sheets
- `rounded-full` — avatares, pills

### Sombras

Uso **mínimo**. Solo en:
- Modales/Dialogs: `shadow-lg`
- Dropdowns/Popovers: `shadow-md`
- Resto: bordes en lugar de sombras

---

## Inventario de pantallas (~36)

### Públicas (marketing + auth)

1. Landing principal
2. Pricing (FREE vs PRO)
3. Sign in
4. Sign up
5. Forgot password
6. Callback OAuth MercadoPago

### Dashboard Owner — Core

7. Overview / KPIs (ingresos del mes, pagos pendientes, reservas próximas)
8. **Calendario Timeline** *(toggle a grid)* — pantalla crítica
9. Lista de reservas + filtros
10. Detalle de reserva
11. Wizard crear reserva
12. Editar reserva

### Dashboard Owner — Entidades

13. Lista de propiedades (cards)
14. Detalle de propiedad
15. Crear / editar propiedad
16. Lista de clientes
17. Detalle de cliente

### Dashboard Owner — Financiero

18. Lista de pagos (filtros: status, method, type, fechas)
19. Detalle de pago + comprobante (Cloudinary)
20. Reporte de cobranza (segmentado por billing type)
21. Recordatorios de pago (vencidos / hoy / 7 días)

### Dashboard Owner — Integraciones

22. Calendarios externos iCal — setup + lista + estado sync
23. Detalle de calendar externo + log de sync
24. Settings: perfil + plan
25. Settings: conexión MercadoPago (OAuth)

### Dashboard Owner — Soporte

26. Lista de tickets
27. Crear ticket
28. Detalle de ticket (thread de mensajes)

### Admin (SUPER_ADMIN)

29. Admin overview (KPIs globales)
30. Lista de owners (activar/desactivar)
31. Detalle de owner
32. Cola de tickets
33. Detalle de ticket (admin)

### Estados comunes

34. 404
35. Empty states por pantalla (sin propiedades, sin reservas, sin pagos)
36. Error states

---

## Workflow de rediseño (4 fases)

### Fase 0 — Auditoría de pantallas actuales

**Objetivo:** identificar qué falla antes de empezar a diseñar.

- Recibir screenshots / URLs de las pantallas que más duelen hoy
- Recibir top 3-5 pantallas priorizadas por el usuario (mi apuesta: calendario, lista de pagos, wizard de reserva)
- Si no hay screenshots: comparar resultado final contra el código actual

### Fase 1 — Design system en Stitch (1 sesión, BLOQUEAR)

- Crear proyecto Stitch
- Cargar los tokens de arriba (colores, tipografía, espaciado, radios, sombras)
- Generar 3 componentes base: `Button` (primary/secondary/outlined/ghost/destructive), `Card` con `ring-1 ring-foreground/10`, `Badge` de estado (success/warning/danger/info/neutral)
- **Regla de lock:** una vez firmados, no se tocan hasta terminar el producto. Si algo aburre, se ajusta UNA vez al final.

### Fase 2 — Pantallas piloto (5-7)

Empezamos por las que más se usan y definen el tono del resto:

1. **Overview / KPIs** — marca el lenguaje visual
2. **Calendario Timeline** — la más compleja; resolverla primero
3. **Lista de pagos** — prueba densidad alta con filtros
4. **Detalle de reserva** — entidad central del dominio
5. **Wizard crear reserva** — muchos campos, alto riesgo de sobrecarga
6. **Lista de propiedades** — vista principal, cards
7. **Settings MercadoPago** — flujo OAuth + estado

Para cada una: 2-3 variantes en Stitch → elegir → ajustar → lock.

**Lock point:** cuando el usuario diga "esto me gusta" sin peros. Si pasa más de 3 rondas en una pantalla, replantear el design system, no la pantalla.

### Fase 3 — Migración en lotes

Las ~29 pantallas restantes se agrupan en:

- **Lote A — Auth + Settings** (5-6 pantallas): Sign in/up, forgot password, settings perfil, plan, OAuth callback
- **Lote B — Entidades** (6-8 pantallas): Lista + detalle + edit de propiedades y clientes
- **Lote C — Financiero** (4-5 pantallas): Detalle de pago, reporte cobranza, recordatorios, comprobantes
- **Lote D — Integraciones + Soporte** (6-7 pantallas): Calendarios externos, lista tickets, crear/detalle ticket
- **Lote E — Admin** (5-6 pantallas): Overview admin, lista owners, detalle owner, cola tickets

Por cada lote:
1. Generar pantallas en Stitch (2-3 variantes por pantalla)
2. Lock de lote cuando estén aprobadas
3. Implementar en Next.js consumiendo el diseño
4. Revisión al final del lote, no durante

### Fase 4 — Implementación

Por cada pantalla:
- Consumir `Card` de shadcn con `ring-1 ring-foreground/10`
- Usar `Button` de Base UI (sin `render={<Link/>}`)
- Estado con `useState` + URL params (no Zustand)
- Server Component por defecto, `*LayoutClient` solo cuando hay interactividad con datos de sesión
- Validación con Zod en `lib/validations/`
- `error.tsx` y `not-found.tsx` en cada route group

---

## Reglas anti-loop

Para frenar el ciclo "siempre hay algo más que mejorar":

1. **Una revisión por lote, no por pantalla.** Durante la implementación de un lote, no se reabren decisiones de diseño individuales.
2. **Hallazgos se anotan, no se arreglan al instante.** Lista de pendientes al final del lote.
3. **Lock de design system = sagrado.** Solo se toca una vez por producto completo, no por pantalla.
4. **3 rondas máximo por pantalla.** Si una pantalla no cierra en 3 rondas, hay un problema más profundo (token, layout, scope) — no es la pantalla.
5. **Comparar contra el objetivo, no contra otras pantallas.** Cada pantalla tiene que resolver su problema, no ganar un premio de belleza.

---

## Preguntas abiertas

1. **Color de acento** — opciones recomendadas:
   - (a) Negro `#0F172A` — máxima sobriedad, ideal para dashboard denso
   - (b) Indigo `#4F46E5` — confianza, estándar SaaS moderno
   - (c) Teal `#0D9488` — diferenciador, transmite crecimiento/finanzas
   - (d) Otro a definir

2. **Top 3-5 pantallas que más molestan hoy** — ¿coinciden con mi apuesta (calendario, lista de pagos, wizard reserva)?

3. **Screenshots o URLs del estado actual** — para auditar antes de empezar. Si el proyecto está en staging/prod, idealmente con URLs.

4. **Estado del proyecto** — ¿en producción con usuarios activos, en staging, o pre-deploy? Define qué tan agresiva puede ser la migración:
   - Producción → migración pantalla por pantalla
   - Staging → corte grande permitido
   - Pre-deploy → reescritura total aceptable

---

## Próximos pasos

1. Responder las 4 preguntas abiertas
2. Crear proyecto Stitch con design system cargado
3. Generar las 5-7 pantallas piloto
4. Lock de diseño + plan de migración por lotes
