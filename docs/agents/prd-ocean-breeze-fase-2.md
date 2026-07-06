# PRD — Migración Ocean Breeze Fase 2

> **Status**: Draft — `ready-for-agent` (can be picked up by AFK agent)
> **Issue tracker**: GitHub Issues (`edurikelm/saas-arriendos-v3`)
> **Design source of truth**: Stitch project `projects/1529269251022042678` ("RentalPro - Rediseño UI")
> **Baseline**: issue #173 cerrado en `f19d424` (refactor UI/UX de tokens semánticos)
> **Audit**: comparación código actual ↔ 15 pantallas Stitch + 7 áreas out-of-scope de #173 (ver `docs/agents/audit-ocean-breeze-fase-2.md`)

---

## Problem Statement

El proyecto está a medio migrar de un sistema visual viejo (azul-violeta, Inter + Source Serif 4, sombras pesadas) a uno nuevo llamado **"Ocean Breeze"** inspirado en Linear/Stripe/Vercel. El lado derecho (los tokens de `globals.css` y la mayoría de componentes core) está al ~95 %. El lado izquierdo (varias pantallas específicas, dos archivos de admin, todo el calendario, dos archivos de auth-adjacent, los archivos `out-of-scope` que quedaron del refactor #173) sigue con hex hardcodeados, sombras donde no corresponden y tablas no envueltas en `Card`.

**El problema concreto, desde el punto de vista del Owner** (usuario primario):

> "Cuando entro a `/admin` o al `/calendar`, los badges de status se ven desalineados con el resto: el rojo y el verde son otros rojos y otros verdes, los hex hardcodeados no armonizan con el teal del sidebar, y los modales pequeños flotan a la izquierda en mobile porque les falta el ancho de viewport. No se siente como la misma app."

**Desde el punto de vista del Developer**:

> "Tengo que memorizar un montón de excepciones: 'esta tabla sí, esta tabla no usa Card', 'este modal sí usa w-[95vw]', 'este badge sí usa la variante semántica'. El design system tiene la regla pero el código la viola en 6 áreas. Cualquier pantalla nueva que toque un área sucia va a propagar el drift."

**Desde el punto de vista del SUPER_ADMIN**:

> "La vista `/admin` tiene plan badges en violeta, status badges en emerald/amber/red con hex hardcodeados. No puedo leer de un vistazo cuántos owners están al día."

**Tres síntomas raíz identificados por el audit**:

1. **Drift tokens ↔ runtime**: `globals.css` declara `--font-serif: Lora` y `--font-mono: IBM Plex Mono` (líneas 54-55), pero ninguna de las dos fuentes está importada en `layout.tsx`. El browser hace fallback a serif/monospace genéricos. El equipo asume que están cargadas porque existen como tokens.
2. **Hex fallback inconsistente**: `reservation-table.tsx:155,164,367,384` usa `|| "#6366F1"` (indigo Tailwind v3) y `reservation-detail-dialog.tsx:638` usa `|| "#3B82F6"` (azul Tailwind v3) cuando `property.color` es null. Ninguno armoniza con `--primary` (teal `oklch(0.7227 0.1920 149.58)`). Resultado: si una propiedad se crea sin color, su badge renderiza un tono que rompe la paleta Ocean Breeze.
3. **Una pantalla entera sin contraparte**: Stitch define una pantalla dedicada "Pagos" (`screens/8d0d9945b3b64f91bc74f830139c1973`). En el código, no existe `src/app/(dashboard)/payments/page.tsx`. La cobranza vive como widget en `dashboard/urgent-collection-card.tsx` y como tab dentro de `reports/page.tsx`. Esto genera dependencia cruzada Dashboard↔Reportes y deja sin hogar a filtros de pagos (por método, por propiedad, por rango de fechas).

---

## Solution

Ejecutar **6 vertical slices** secuenciales, cada una cerrando una clase de problema. Cada slice termina con commits individuales, typecheck/build verde y verificación visual con Chrome DevTools. Al final, sincronizar `DESIGN.md` con el designMd real de Stitch para que la docs refleje la realidad.

**Orden de ejecución** (pensado para que cada slice compile standalone y entregue valor visible):

| # | Slice | Effort | Outcome visible |
|---|---|---|---|
| 1 | **Layout & shadows** | S | Sidebar/navbar limpios de sombras innecesarias. App se siente más plana y consistente. |
| 2 | **Fonts cargadas** | S | Lora e IBM Plex Mono se cargan en `layout.tsx`. Drift token↔runtime cerrado. |
| 3 | **Calendar (timeline + grid + view)** | M | Calendar totalmente tokenizado. `bg-zinc-*` y hex `#6366F1` desaparecen. |
| 4 | **Admin (page + users/[id])** | M | Admin reimplementa status badges con `Badge variant` semántico. |
| 5 | **Tablas & modales** | M | `<DataTable>` primitive creado. 6 tablas envueltas en Card. 4 modales con `w-[95vw]`. |
| 6 | **Pantalla `/payments`** | L | Nueva ruta dedicada. Cierra el gap con Stitch y elimina dependencia Dashboard↔Reportes. |

**Criterio transversal**: ningún slice introduce hex hardcodeado nuevo. Si una paleta externa (Airbnb, Booking.com) necesita color, se decide vía `grill-with-docs` y se documenta en DESIGN.md.

**Bonus transversal** (no son slices, son tareas transversales):
- Sincronizar `DESIGN.md` con el designMd de Stitch (línea 1, en paralelo con slice 1).
- Hex fallback de `property.color` → `var(--primary)` (atómico, se hace en slice 5).

---

## User Stories

### Slice 1 — Layout & shadows

1. As an **Owner**, I want the sidebar to feel flat and modern, so that the app looks like Linear/Stripe instead of a 2010s dashboard.
2. As an **Owner**, I want consistent depth across pages, so that I'm not distracted by random shadows that don't correspond to functional surfaces.
3. As a **Developer**, I want all sidebar/navbar shadows removed or replaced with `ring-1 ring-foreground/10`, so that future agents don't re-introduce them.

### Slice 2 — Fonts cargadas

4. As a **Developer**, I want `--font-serif` and `--font-mono` to actually resolve to Lora and IBM Plex Mono in the browser, so that tokens match runtime.
5. As a **Owner** landing on `/`, I want testimonials in `font-serif italic` to use Lora (real italic, not the system serif fallback), so that the marketing page feels curated.
6. As a **Developer** working with money/token UIs, I want `font-mono` to actually render in IBM Plex Mono, so that numeric columns align predictably.

### Slice 3 — Calendar tokenizado

7. As an **Owner** on `/calendar`, I want reservation pills to use semantic teal/orange/green tokens, so that the calendar feels integrated with the rest of the app.
8. As an **Owner**, I want CANCELLED/COMPLETED reservations to look distinct without using `bg-zinc-*` (which is dim everywhere else), so that the calendar still reads clearly.
9. As a **Developer**, I want `channelDotClass` (Airbnb/Booking/VRBO/Other) to map to `info/primary/accent/muted-foreground`, so that all external channel markers share the same palette logic.
10. As an **Owner**, I want the calendar timeline to not have 7 random `shadow-sm` instances, so that the visual hierarchy comes from spacing, not decoration.
11. As a **Developer**, I want the calendar grid and timeline to share the same token-mapping logic, so that future changes are atomic.

### Slice 4 — Admin refactor

12. As a **SUPER_ADMIN**, I want the `/admin` overview to use semantic status badges (`success/warning/destructive`), so that I can scan owner health at a glance.
13. As a **SUPER_ADMIN**, I want the per-user detail page (`admin/users/[id]`) to use `MetricCard tone` variants for its 4 KPIs, so that they look identical to the Owner dashboard's metrics.
14. As a **SUPER_ADMIN**, I want the Mercado Pago integration status card to use `bg-success/10 text-success-foreground`, so that "connected" reads unambiguously green.
15. As a **Developer**, I want the `getPlanBadgeClass`/`getStatusBadgeClass`/`getHealthBadgeClassName` helpers in admin removed, so that there's only one way to render a status badge.

### Slice 5 — Tablas, modales y DataTable primitive

16. As an **Owner**, I want the reservations table to look identical to the clients table (same Card wrapper, same ring, same hover), so that the app feels coherent.
17. As an **Owner** on mobile, I want every modal to use `w-[95vw]` instead of just `max-w-*`, so that small modals like "RevealTokenDialog" don't float on the left.
18. As a **Developer**, I want a `<DataTable>` primitive in `src/components/ui/`, so that adding a new table doesn't require re-deciding the wrapper.
19. As an **Owner**, I want `property.color` fallback to use the Ocean Breeze teal (`var(--primary)`) instead of indigo/blue Tailwind v3 defaults, so that a new property without an explicit color still feels branded.

### Slice 6 — Nueva pantalla `/payments`

20. As an **Owner**, I want a dedicated `/payments` route, so that I can manage payments independently of the dashboard and reports views.
21. As an **Owner**, I want to filter payments by property, method (CASH/TRANSFER/MERCADO_PAGO), status (PENDING/COMPLETED/FAILED), and date range, so that I can answer "cuánto se cobró por X propiedad en Y mes".
22. As an **Owner**, I want the existing Cobranza tab in `/reports` to migrate to `/payments`, so that `/reports` becomes purely financial reporting (no mixed cobranza).
23. As an **Owner**, I want the `UrgentCollectionCard` widget currently in `/dashboard` to also live in `/payments`, so that I have a "today's attention" view on both surfaces.
24. As a **Developer**, I want the new `/payments` page to consume the same `getPayments` server action that the dashboard uses, so that there's no duplicated logic.

### Bonus — DESIGN.md sincronizado

25. As a **Developer** joining the project, I want `DESIGN.md` to reflect Ocean Breeze (not the old purple), so that I don't accidentally re-introduce legacy tokens.
26. As a **Developer**, I want `DESIGN.md` to explicitly document the hex-fallback convention for `property.color` and the external channel markers (Airbnb/Booking), so that the next agent doesn't re-litigate them.

---

## Implementation Decisions

### ID-1: Módulos a crear

- **`src/components/ui/data-table.tsx`** (nuevo, slice 5): wrapper primitivo que recibe `headers: string[]`, `children: ReactNode` (las filas) y opcionalmente `emptyState`. Internamente renderiza `<Card className="ring-1 ring-foreground/10 overflow-hidden"><div className="overflow-x-auto"><table>...`. Encapsula el patrón repetido en 6 tablas.
- **`src/lib/calendar/channel-colors.ts`** (nuevo, slice 3): mapa `Record<Channel, { dotClass: string; labelClass: string }>` con los tokens semánticos. Consume el primitive `metric-card.tsx:23-28` o crea su propio subset. Una sola fuente para `calendar-timeline.tsx` y `calendar-grid.tsx`.
- **`src/components/admin/health-badge.tsx`** (nuevo, slice 4): wrapper sobre `<Badge variant="success|warning|destructive|info|secondary">` con prop `status: 'healthy' | 'attention' | 'overdue' | 'dormant'`. Reemplaza los helpers `getHealthBadgeClassName`, `getStatusBadgeClass`, `getPlanBadgeClass`.
- **`src/app/(dashboard)/payments/page.tsx`** (nuevo, slice 6): server component que llama a la server action existente de pagos. Re-exporta el widget `urgent-collection-card.tsx` y la tabla paginada.
- **`src/app/(dashboard)/payments/_components/payments-filters.tsx`** (nuevo, slice 6): filtros por property/method/status/date range. Usa `useState` + URL params (siguiendo `CONTEXT.md`: sin Zustand).
- **`src/app/(dashboard)/payments/_components/payments-table.tsx`** (nuevo, slice 6): tabla paginada que consume el primitive `<DataTable>`.

### ID-2: Módulos a modificar

- **`src/app/layout.tsx`** (slice 2): importar `Lora` y `IBM_Plex_Mono` desde `next/font/google`. Asignar a `--font-serif` y `--font-mono` como CSS variables en `<body>`. Mantener `--font-sans: DM Sans` (ya cargado).
- **`src/components/layout/dashboard-sidebar.tsx`** (slice 1): `shadow-xl backdrop-blur-xl` → `border-r border-sidebar-border` (mantener `backdrop-blur-xl` opcional). `shadow-sm ring-1 ring-sidebar-ring/10` → solo `ring-1 ring-sidebar-ring/20`.
- **`src/components/layout/dashboard-navbar.tsx`** (slice 1): remover `shadow-sm` de header. Mantener `border-b`. `shadow-xs` en chips → eliminar.
- **`src/components/layout/dashboard-layout-client.tsx`** (slice 1): `shadow-sm backdrop-blur-xl` en mobile header → eliminar shadow.
- **`src/components/calendar/calendar-timeline.tsx`** (slice 3): reemplazar todas las clases `bg-zinc-*`/`text-zinc-*`/`border-zinc-*` por `bg-card`/`text-muted-foreground`/`border-border`. Reemplazar `bg-orange-50` → `bg-warning/10`, `bg-blue-100` → `bg-info/10`, `bg-green-100` → `bg-success/10`. Hex `style={{ backgroundColor: res.property.color || "#6366F1" }}` → `style={{ backgroundColor: res.property.color || "var(--primary)" }}`. Agregar `w-[95vw]` al DialogContent.
- **`src/components/calendar/calendar-view.tsx`** (slice 3): remover `shadow-sm` del toggle. Reemplazar `border-l-amber-500 bg-amber-50` → `border-l-warning bg-warning/10`.
- **`src/components/calendar/calendar-grid.tsx`** (slice 3): unificar `channelDotClass` con la nueva utility `lib/calendar/channel-colors.ts`. Remover sombras innecesarias.
- **`src/app/admin/page.tsx`** (slice 4): reemplazar `getPlanBadgeClass`, `iconClass`, `accentClass` por `<Badge variant>` y `MetricCard tone`. Reemplazar status bars hex (`bg-red-500/10` etc.) por `Badge variant`.
- **`src/app/admin/users/[id]/page.tsx`** (slice 4): mismo refactor que `admin/page.tsx`. Quitar `shadow-sm` del avatar. Envolver tabla interna en `<DataTable>`.
- **`src/components/admin/admin-users-client.tsx`** (slice 4): reemplazar `getHealthBadgeClassName` con el nuevo `<HealthBadge>`.
- **`src/components/clients/clients-table.tsx`** (slice 5): reemplazar wrapper `rounded-2xl border border-zinc-200/70 bg-zinc-950/[0.02] p-2 shadow-sm` por `<DataTable>`. Remover `shadow-sm` y `shadow-lg` de celdas y avatares.
- **`src/components/reservations/reservation-table.tsx`** (slice 5): mismo wrapper. Hex fallback `#6366F1` → `var(--primary)`.
- **`src/components/reservations/reservation-detail-dialog.tsx`** (slice 5): hex fallback `#3B82F6` → `var(--primary)`.
- **`src/components/properties/properties-client.tsx`** (slice 5): agregar `w-[95vw]` a DialogContent l. 162 y 226.
- **`src/app/(dashboard)/properties/new/page.tsx`** (slice 5): agregar `w-[95vw]` al DialogContent l. 44.
- **`src/app/(dashboard)/properties/[id]/_components/RevealTokenDialog.tsx`** (slice 5): agregar `w-[95vw]` al DialogContent l. 117. Cambiar `max-w-lg` → `max-w-md` (token no necesita lg).
- **`src/components/dashboard/urgent-collection-card.tsx`** (slice 6): sin cambios de UI, pero extraer a una utility `getCollectionAlerts()` que pueda ser consumida por `/payments`. Esto es la única duplicación permitida (UI reusada, lógica no).
- **`src/app/(dashboard)/reports/page.tsx`** (slice 6): remover tab "Cobranza" (ahora vive en `/payments`). Mantener tabs de reporting puro (ingresos por período, por propiedad, etc.).
- **`src/app/(dashboard)/dashboard/page.tsx`** (slice 6): `urgent-collection-card.tsx` se mantiene aquí (es widget del dashboard), pero la lista completa de pagos migra a `/payments`. Validar que el widget solo muestre top-5 y link "Ver todos" → `/payments`.

### ID-3: Decisiones arquitectónicas

- **Sin nuevo estado global**: la pantalla `/payments` usa `useState` para filtros y URL params para query state (per `CONTEXT.md`). Si en el futuro los filtros crecen, se evalúa Zustand.
- **Server Components por defecto**: `/payments/page.tsx` es server component que llama a la server action de pagos. Solo los filtros son client component.
- **Sin charts**: el audit confirma 0 uso de Recharts o cualquier capa `<Chart>`. La pantalla Stitch "Reportes" se implementa con tablas + cards, no charts. Esta convención se mantiene.
- **Hex de propiedad (decisión de dominio)**: el `color` de una propiedad es **data del usuario** (lo elige el owner al crear la propiedad para diferenciar visualmente sus reservas en el calendario). No es decoración. Por lo tanto, **NO se migra a tokens semánticos** — permanece como hex arbitrario. Lo único que se hace es arreglar el fallback (`#6366F1`/`#3B82F6` → `var(--primary)`).

### ID-4: Schema changes

**Ninguno**. Este PRD no toca DB. Solo CSS, componentes y rutas.

### ID-5: API contracts

**Sin nuevos endpoints**. La pantalla `/payments` reusa la server action existente `getPayments` (o como se llame; ver `src/lib/actions/payments.ts`). Si los filtros necesitan nuevas combinaciones, se evalúa ampliar el filtro de esa server action. Si no es suficiente, se introduce `getPaymentsFiltered({ propertyId?, method?, status?, dateRange? })`.

### ID-6: Convenciones específicas

- **Sombras**: solo en `DialogContent`, `DropdownMenuContent`, `PopoverContent`, `TooltipContent`, `SheetContent`. Todo lo demás usa border + ring. Se documenta en `DESIGN.md`.
- **Tablas**: cualquier `<table>` debe estar envuelta en `<DataTable>` (que internamente es `<Card>` con `ring-1 ring-foreground/10` + `overflow-x-auto`).
- **Modales**: `w-[95vw]` + `max-w-{size}`. La excepción `confirm-dialog.tsx:39` con `w-[92vw]` se documenta como excepción consciente.
- **External channel markers** (Airbnb/Booking/VRBO/Other): mapeo fijo en `lib/calendar/channel-colors.ts`. AIRBNB → `bg-info`, BOOKING_COM → `bg-primary`, VRBO → `bg-accent`, OTHER → `bg-muted-foreground`. Decisión via `grill-with-docs` antes de slice 3.
- **`property.color` fallback**: `var(--primary)` (teal Ocean Breeze). Documentado en `DESIGN.md`.

---

## Testing Decisions

### TD-1: Qué hace un buen test

- Solo **comportamiento externo**, nunca detalles de implementación.
- Un test de migración de tokens NO verifica "este componente tiene `bg-success`". Verifica: "este componente se renderiza sin errores con la paleta Ocean Breeze".
- Para tokens visuales, **preferimos verificación visual manual con Chrome DevTools** (siguiendo el patrón del commit `6a214aa`) sobre tests automatizados que solo contarían clases CSS.

### TD-2: Módulos a testear

- **`src/lib/calendar/channel-colors.ts`** (nuevo): unit tests que verifican que cada `Channel` mapea a una clase CSS válida. Trivial y rápido.
- **`src/components/admin/health-badge.tsx`** (nuevo): unit tests que verifican que cada `status` mapea a la variante semántica correcta. Similar a `src/components/ui/__tests__/badge.test.tsx`.
- **`src/components/ui/data-table.tsx`** (nuevo): smoke test que verifica que renderiza children, headers, y empty state.
- **`src/app/(dashboard)/payments/_components/payments-table.tsx`** (nuevo): unit test con mock de `Payment[]` que verifica filtros y paginación.
- **`src/components/auth/login-form.tsx`** y **`register-form.tsx`**: ya tienen tests. Solo verificar que siguen verdes después del slice 2 (carga de fonts).

### TD-3: Prior art en el codebase

- `src/components/ui/__tests__/badge.test.tsx`: patrón para testear variantes semánticas. Aplicar a `health-badge.tsx`.
- `src/components/calendar/__tests__/calendar-timeline.test.tsx`: patrón para mockear props y verificar render. Aplicar a `payments-table.tsx`.
- `src/components/reservations/__tests__/reservation-table.test.tsx`: patrón para tests de tablas con estado. Aplicar a `<DataTable>` y a las tablas que lo consuman.

### TD-4: Verificación por slice

Cada slice termina con:

1. `npm run typecheck` verde.
2. `npm run build` verde.
3. `npm test` con el mismo baseline de fallos pre-existentes (836 pass / 4 fail según `f19d424`).
4. Captura visual con Chrome DevTools en light + dark para las superficies afectadas. Screenshots se mueven a `Temp\opencode\` (no en repo).
5. Commit con mensaje conventional en español técnico siguiendo el estilo de `bd43fa8`, `f19d424`, `0699c05`, etc. Referencias a este PRD.

---

## Out of Scope

Lo siguiente queda explícitamente fuera de este PRD:

1. **Refactor de la landing page (`src/components/landing/landing-page.tsx`)**. La landing es marketing, no producto. Mantiene sus `shadow-lg`/`shadow-2xl` y `font-serif italic` con Lora. Los tokens semánticos sí se aplican si conviene, pero no es prioridad.
2. **Charts (Recharts u otra librería)**. El audit confirma 0 uso. La pantalla "Reportes" sigue siendo tablas + cards. Si en el futuro se piden gráficos, será un PRD separado.
3. **Mobile-first redesign**. Las 15 pantallas de Stitch son todas desktop (2560×2048). El responsive existe por breakpoints pero no hay pantalla Stitch mobile. Esto se mantiene.
4. **Reorganización mayor del sidebar**. El orden de items, el agrupamiento, los iconos — todo queda igual. Solo se limpia sombra y se armoniza el ring.
5. **Cambios al esquema de BD**. Ninguna tabla ni campo cambia.
6. **Cambios a la lógica de negocio**. Esto es puramente UI. No se tocan server actions, validaciones Zod, ni reglas de cálculo.
7. **Refactor del `landing-page.tsx` para Lora**. Lora se carga en `layout.tsx` y queda disponible para quien la quiera usar. No se fuerza su adopción en landing.
8. **Componente `KpiTile`**. El audit sugirió crear un componente que unifique `MetricCard tone` + barra lateral de color. Se evalúa post-Fase 2 si hay demanda real; en este PRD se usa `MetricCard tone` con workaround inline si hace falta.
9. **Card hover con `transform: translateY(-2px)`**. La utility `card-hover` en `globals.css:400-407` se mantiene (es solo para landing). No se elimina ni se generaliza.
10. **`confirm-dialog.tsx` con `w-[92vw]`**. Excepción documentada, no se toca.

---

## Further Notes

### Vínculo con #173

Este PRD es **Fase 2** del refactor UI/UX iniciado en #173. La Fase 1 cerró los archivos de reservations/dashboard/forms/settings. La Fase 2 cierra admin, calendar, clients, propiedades (forms), auth (fonts), y suma la pantalla `/payments` que no estaba en el alcance original.

### Decisiones pendientes vía `grill-with-docs`

Antes de slice 3 y slice 6, se sugiere cargar `grill-with-docs` para:
- **Slice 3**: confirmar el mapeo AIRBNB → `bg-info`, BOOKING_COM → `bg-primary`, etc. Es debatable si las marcas externas deben seguir siendo cromáticamente distintas (UX de "marca conocida") o normalizarse (consistencia visual).
- **Slice 6**: confirmar si la tab "Cobranza" actual de `/reports` debe moverse íntegra a `/payments` o quedarse duplicada. Mi recomendación: mover, pero hay trade-offs.

### Referencias

- `CONTEXT.md` (raíz) — vocabulario de dominio
- `DESIGN.md` (raíz) — design system actual (a sincronizar con este PRD)
- `docs/adr/0014-theme-architecture.md` — decisión original de arquitectura de tokens
- Stitch project `projects/1529269251022042678` — fuente visual
- Commit `f19d424` — último cierre de #173 con lista explícita de archivos out-of-scope
- Audit completo: `docs/agents/audit-ocean-breeze-fase-2.md` (a generar al cerrar slice 1)

### Riesgos conocidos

- **Drift token↔runtime en fonts**: si slice 2 falla, las clases `font-serif` y `font-mono` siguen sin cargar fuentes reales. Impacto bajo (cosmético) pero rompe el principio "el token hace lo que dice".
- **Hex fallback inconsistente**: si no se arregla, nuevas propiedades sin color rompen la paleta. Impacto medio (UX confunde al owner).
- **`<DataTable>` primitive adoption**: si los developers no lo adoptan, el patrón se pierde en 1 sprint. Mitigación: documentar en DESIGN.md y revisar en PRs.
- **Calendar refactor es grande** (3 archivos): el audit encontró ~50 ocurrencias. Riesgo de regresión visual. Mitigación: capturas antes/después con Chrome DevTools.