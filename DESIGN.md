# RentalPro - Design System

> **Status**: Sincronizado con "Ocean Breeze" — `projects/1529269251022042678` (Stitch) · 2026-07-06
> **Source of truth visual**: Stitch project `projects/1529269251022042678`
> **Tokens runtime**: `src/app/globals.css`
> **Migración**: Fase 1 cerrada en `f19d424` (issue #173). Fase 2 en issues #174, #175, #176.

## Overview

RentalPro es un SaaS de gestión de arriendos de propiedades. Este documento establece las reglas de diseño para mantener consistencia visual en toda la aplicación. **"Ocean Breeze"** es el tema vigente desde la migración cerrada en `6a214aa`. Inspirado en Linear, Stripe Dashboard y Vercel. Denso-pero-limpio, minimalista, B2B. Sin decoración, sin ilustraciones, sin gradientes en cards de contenido.

---

## Color Palette

### Light Mode (Ocean Breeze)

| Token | Value (oklch) | hex equivalente | Usage |
|-------|---------------|-----------------|-------|
| `--background` | `0.9751 0.0127 244.25` | `#F8FAFC` | Fondo principal (off-white con tinte azul sutil) |
| `--foreground` | `0.3729 0.0306 259.73` | `#3D4666` | Texto principal (slate blue oscuro) |
| `--card` | `1.0000 0 0` | `#FFFFFF` | Cards y contenedores |
| `--card-foreground` | `0.3729 0.0306 259.73` | `#3D4666` | Texto en cards |
| `--primary` | `0.7227 0.1920 149.58` | `#2DBE85` | Botones primarios, CTAs (teal vibrante) |
| `--primary-foreground` | `1.0000 0 0` | `#FFFFFF` | Texto sobre primary |
| `--secondary` | `0.9514 0.0250 236.82` | `#EAF0F4` | Elementos secundarios |
| `--secondary-foreground` | `0.4461 0.0263 256.80` | `#5C6685` | Texto sobre secondary |
| `--muted` | `0.9670 0.0029 264.54` | `#F5F6FA` | Fondos apagados |
| `--muted-foreground` | `0.5510 0.0234 264.36` | `#6F7897` | Texto apagado |
| `--accent` | `0.9505 0.0507 163.05` | `#E0F3EC` | Highlights, hover states (pale mint) |
| `--accent-foreground` | `0.3729 0.0306 259.73` | `#3D4666` | Texto sobre accent |
| `--border` | `0.9276 0.0058 264.53` | `#DEE1EB` | Bordes |
| `--input` | `0.9276 0.0058 264.53` | `#DEE1EB` | Inputs |
| `--ring` | `0.7227 0.1920 149.58` | `#2DBE85` | Focus rings (mismo que primary) |

### Dark Mode (Ocean Breeze)

| Token | Value (oklch) | hex equivalente | Usage |
|-------|---------------|-----------------|-------|
| `--background` | `0.2077 0.0398 265.75` | `#15192B` | Fondo principal (azul oscuro) |
| `--foreground` | `0.8717 0.0093 258.34` | `#D4D6DE` | Texto principal |
| `--card` | `0.2795 0.0368 260.03` | `#1F2236` | Cards y contenedores |
| `--card-foreground` | `0.8717 0.0093 258.34` | `#D4D6DE` | Texto en cards |
| `--primary` | `0.7729 0.1535 163.22` | `#3DDFB5` | Botones primarios (mint más claro en dark) |
| `--primary-foreground` | `0.2077 0.0398 265.75` | `#15192B` | Texto sobre primary |
| `--border` | `0.4461 0.0263 256.80` | `#5C6685` | Bordes |
| `--ring` | `0.7729 0.1535 163.22` | `#3DDFB5` | Focus rings |

### Semantic Tokens (Project-specific)

Estos tokens cubren los 4 estados canónicos del dominio. **Calibrados en `511c9cf` para igualar la viveza de Tailwind por defecto**.

| Concepto | Token | Light | Dark |
|----------|-------|-------|------|
| Pagado, CONFIRMED, sin alertas | `--success` | `0.65 0.16 150` | `0.70 0.17 150` |
| (foreground para texto sobre bg-success) | `--success-foreground` | `0.30 0.10 150` | `0.85 0.15 150` |
| Vence hoy, saldo pendiente, atención | `--warning` | `0.78 0.16 75` | `0.78 0.17 75` |
| (foreground) | `--warning-foreground` | `0.30 0.10 60` | `0.85 0.15 75` |
| Próximos 7 días, próximo check-in, info | `--info` | `0.65 0.13 230` | `0.70 0.15 230` |
| (foreground) | `--info-foreground` | `0.30 0.12 210` | `0.85 0.12 210` |
| Vencido, CANCELLED, errores | `--destructive` | `0.6368 0.2078 25.3313` | `0.6368 0.2078 25.3313` |
| (foreground) | `--destructive-foreground` | `1.0000 0 0` | `0.2077 0.0398 265.75` |

**Mapeo semántico (regla de uso)**:

| Estado de dominio | Token |
|-------------------|-------|
| Reserva CONFIRMED | `success` |
| Pago COMPLETED | `success` |
| KPI "ocupación ≥85%" | `success` |
| Pago vence hoy | `warning` |
| Reserva con saldo | `warning` |
| KPI "por cobrar" | `warning` |
| Próximos 7 días | `info` |
| Próximo check-in | `info` |
| Duración DAILY/MONTHLY | `info` (diferenciación por label, no por color) |
| Pago vencido | `destructive` |
| Reserva CANCELLED | `destructive` |
| KPI crítico | `destructive` |

### Project-specific tokens (Ocean Breeze additions)

| Token | Light oklch | Dark oklch | Uso |
|-------|-------------|------------|-----|
| `--navbar` | `0.99 0.005 244` | `0.23 0.03 260` | Background navbar superior |
| `--navbar-foreground` | `0.3729 0.0306 259.73` | `0.8717 0.0093 258.34` | Texto navbar |
| `--beige` | `0.97 0.02 200` | `0.30 0.02 200` | Acento neutral cálido |
| `--brand-secondary` | `0.72 0.15 195` | `0.72 0.15 195` | Acento de marca alternativo |

### Sidebar Palette

| Token | Light | Dark |
|-------|-------|------|
| `--sidebar` | `0.9514 0.0250 236.82` | `0.2795 0.0368 260.03` |
| `--sidebar-foreground` | `0.3729 0.0306 259.73` | `0.8717 0.0093 258.34` |
| `--sidebar-primary` | `0.7227 0.1920 149.58` | `0.7729 0.1535 163.22` |
| `--sidebar-accent` | `0.9505 0.0507 163.05` | `0.3729 0.0306 259.73` |
| `--sidebar-border` | `0.9276 0.0058 264.53` | `0.4461 0.0263 256.80` |

> **IMPORTANTE**: El sidebar usa `bg-sidebar` y `text-sidebar-foreground`. **Nunca** `bg-slate-900` o cualquier hex hardcodeado.

### Chart tokens (5 gradiente teal)

| Token | Uso |
|-------|-----|
| `--chart-1` | Principal (teal vibrante) |
| `--chart-2` | Verde medio |
| `--chart-3` | Teal oscuro |
| `--chart-4` | Teal profundo |
| `--chart-5` | Teal muy oscuro |

> **Estado actual**: la app no usa Recharts ni capa `<Chart>` propia (audit 2026-07-06, 0 matches). Estos tokens quedan disponibles para futura implementación.

---

## Typography

### Font Families

```css
--font-sans: DM Sans, sans-serif;        /* body + headings (weight variation only) */
--font-serif: Lora, serif;               /* solo marketing (landing) */
--font-mono: IBM Plex Mono, monospace;   /* precios, fechas, IDs, tokens */
```

### Estado de carga en `layout.tsx`

| Font | Cargada en `layout.tsx` | Notas |
|------|------------------------|-------|
| DM Sans | ✅ Sí (`next/font/google`) | Única en uso en producto |
| Lora | ❌ **NO** (declarada en tokens, no importada) | Drift conocido — slice S2 del PRD |
| IBM Plex Mono | ❌ **NO** (declarada en tokens, no importada) | Drift conocido — slice S2 del PRD |

**Hasta que se cierre el issue #174**, las clases `font-serif` y `font-mono` caen a fallback genérico (serif/monospace del SO). El fix está en el alcance de #174.

### Scale (DM Sans)

| Element | Size | Weight | Line Height |
|---------|------|--------|-------------|
| Page Title (h1) | `text-2xl sm:text-3xl` | `font-bold` (700) | `leading-tight` |
| Section Title (h2) | `text-lg` | `font-medium` (500) | `leading-snug` |
| Card Title | `text-base` / `text-sm` (sm cards) | `font-medium` (500) | `leading-snug` |
| Body | `text-sm` | `font-normal` (400) | `leading-normal` |
| Small/Labels | `text-xs` | `font-medium` (500) | `leading-none` |
| Muted Text | `text-sm` / `text-xs` | (inherit) | (inherit) |
| Button | `text-sm` / `text-[0.8rem]` (sm) | `font-medium` (500) | (auto) |

### Reglas de uso

- **Jerarquía por tamaño y peso, NO por color**. El diseño Ocean Breeze no usa color como diferenciador de heading.
- **Body siempre `text-sm`** por defecto.
- **Form labels**: `text-sm font-medium`.
- **Muted text**: `text-muted-foreground`.
- **Datos numéricos** (precios, fechas, IDs): `font-mono text-foreground/70 text-xs` cuando se quiere señalar "data técnica".

---

## Spacing

Base: `0.25rem` (4px). Per `globals.css:75` → `--spacing: 0.25rem`.

| Token | Value | Usage |
|-------|-------|-------|
| `px-1` | 4px | Espaciado mínimo |
| `px-2` | 8px | Inputs padding |
| `px-2.5` | 10px | Buttons padding |
| `px-3` | 12px | Sidebar items |
| `px-4` | 16px | Card padding, page margins |
| `px-6` | 24px | Section gaps |
| `gap-1` | 4px | Icon-text spacing |
| `gap-2` | 8px | Between elements |
| `gap-3` | 12px | Between sections |
| `gap-4` | 16px | Between cards |
| `gap-6` | 24px | Major sections |

### Responsive spacing

- **Mobile** (`<640px`): `p-4`
- **Desktop** (`≥640px`): `p-6`

---

## Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--radius` | `0.5rem` (8px) | Base |
| `--radius-sm` | `calc(0.5rem - 4px)` = 4px | Badges |
| `--radius-md` | `calc(0.5rem - 2px)` = 6px | Buttons sm, inputs |
| `--radius-lg` | `0.5rem` = 8px | Default buttons, cards |
| `--radius-xl` | `calc(0.5rem + 4px)` = 12px | Modals, large containers |

### Usage

- **Buttons**: `rounded-lg` (8px)
- **Inputs**: `rounded-lg` (8px)
- **Cards**: `rounded-xl` (12px) (vía `card.tsx`)
- **Badges**: `rounded-4xl` (pill)
- **Modals/Dialogs**: `rounded-xl` (12px)

---

## Shadows — REGLA ESTRICTA

> **"Sombras solo en componentes flotantes. El resto usa bordes."**
> Esta es la regla más violada del codebase antes de Ocean Breeze. Toda adición de `shadow-*` en componentes no-flotantes es drift.

### Dónde SÍ se permiten shadows

- `DialogContent` (`src/components/ui/dialog.tsx`) — `shadow-lg`
- `DropdownMenuContent` — `shadow-md`
- `PopoverContent` — `shadow-md`
- `TooltipContent` — shadow sutil
- `SheetContent` — `shadow-lg`
- Hover intencional de `<Card>` con imagen (`property-card.tsx`) — `hover:shadow-lg`

### Dónde NO se permiten shadows

- Cualquier `<Card>` no-flotante → usar `ring-1 ring-foreground/10` para jerarquía.
- Cualquier `<table>` o fila de tabla → `border-y`.
- Avatares → `ring-1 ring-foreground/10`, NO `shadow-lg`.
- Inputs → `border`, focus `ring-3 ring-ring/50`.
- Botones sobre superficie plana → `border` opcional, NO shadow.
- Header/Navbar/Sidebar → `border-b`/`border-r`, NO shadow.

### Excepciones documentadas

- `src/app/globals.css:400-407` define `.card-hover` con `transform: translateY(-2px) + shadow`. Es **solo para landing** (`landing-page.tsx`). No generalizar.
- Landing page mantiene `shadow-lg`/`shadow-2xl`/`shadow-primary/20` como estética marketing intencional.

---

## Conventions nuevas (Ocean Breeze)

### 1. Tablas → usar `<DataTable>` primitive

> **Pendiente**: primitive en `src/components/ui/data-table.tsx` (issue #176).

Wrapper estándar para cualquier `<table>`:

```tsx
<Card className="ring-1 ring-foreground/10 overflow-hidden">
  <div className="overflow-x-auto">
    <table className="w-full">{/* ... */}</table>
  </div>
</Card>
```

**Tablas que DEBEN migrarse a `<DataTable>`** (audit 2026-07-06):

- `clients-table.tsx` (l. 187)
- `reservation-table.tsx` (l. 268)
- `reports/page.tsx` (l. 615)
- `admin/users/[id]/page.tsx` (l. 614)
- `admin-users-client.tsx` (l. 484)
- `admin/support/admin-support-list.tsx` (l. 180)

### 2. Modales → `w-[95vw]` + `max-w-{size}`

```tsx
<DialogContent className="w-[95vw] max-w-lg">
  {/* ... */}
</DialogContent>
```

**Modales que NO cumplen** (issue #176 los arregla):

- `calendar-timeline.tsx:727` — solo `max-w-2xl`
- `properties-client.tsx:162, 226` — solo `max-w-2xl`
- `properties/new/page.tsx:44` — solo `max-w-2xl`
- `properties/[id]/_components/RevealTokenDialog.tsx:117` — solo `max-w-lg`

**Excepción consciente**: `confirm-dialog.tsx:39` usa `w-[92vw]` (no `95vw`). Documentado.

### 3. Status badges → siempre `<Badge variant>`

```tsx
import { Badge } from "@/components/ui/badge";

<Badge variant="success">Pagado</Badge>
<Badge variant="warning">Vence hoy</Badge>
<Badge variant="destructive">Vencido</Badge>
<Badge variant="info">Próximo</Badge>
<Badge variant="secondary">Inactivo</Badge>
```

**Variantes disponibles** (per `badge.tsx:13-21`):
- `default`, `secondary`, `destructive`, `success`, `warning`, `info`, `outline`, `ghost`.

**Reglas**:
- Todo badge que indique estado DEBE usar uno de los 4 tokens semánticos (`success`/`warning`/`info`/`destructive`).
- En estilos inline cuando se necesita fondo + texto: `bg-success/10 text-success-foreground`.
- **Prohibido**: hex hardcodeado (`bg-emerald-500`, `text-red-600`, `bg-amber-100`, etc.).

**Excepción documentada**: chrome `bg-zinc-*` del `reservation-table.tsx` es estética dark/Notion-like intencional. No migrar.

### 4. Hex fallback de `property.color` → `var(--primary)`

`property.color` es **data del usuario** (color elegido por el owner al crear la propiedad). Permanece como hex arbitrario en BD y se renderiza vía `style={{ backgroundColor: ... }}`. El único punto donde se aplica convención es el **fallback** cuando la propiedad no tiene color:

```tsx
style={{ backgroundColor: reservation.property.color || "var(--primary)" }}
```

**Antes**: `|| "#6366F1"` (indigo Tailwind v3) o `|| "#3B82F6"` (azul Tailwind v3).
**Ahora**: `|| "var(--primary)"` (teal Ocean Breeze).

Aplica a `reservation-table.tsx:155,164,367,384` y `reservation-detail-dialog.tsx:638` y `calendar-timeline.tsx:180,470,508,594,699,735`.

### 5. External channel markers (Calendar)

> **Pendiente**: utility `src/lib/calendar/channel-colors.ts` (issue #174).

| Channel | Dot class | Uso |
|---------|-----------|-----|
| AIRBNB | `bg-info` | iCal feed de Airbnb |
| BOOKING_COM | `bg-primary` | iCal feed de Booking.com |
| VRBO | `bg-accent` | iCal feed de VRBO |
| OTHER | `bg-muted-foreground` | Cualquier otro canal |

**NO** usar `bg-blue-500` / `bg-rose-500` / `bg-indigo-500` como antes. Consumir siempre la utility para que un cambio de paleta se propague atómicamente.

### 6. Filters y searchbars → texto visible, no iconos solos

```tsx
// ✅ Correcto
<Button variant="outline">
  <Filter />
  Filtrar
</Button>

// ❌ Incorrecto
<Button variant="outline" size="icon">
  <Filter />
</Button>
```

Excepción: si es un toggle binario conocido (mostrar/ocultar filtros), el icono solo es aceptable **acompañado de label accesible** (`aria-label`).

### 7. KPIs → número grande + label pequeño, sin íconos dominantes

```tsx
<Card className="p-4">
  <p className="text-sm text-muted-foreground">Cobrado este mes</p>
  <p className="text-2xl font-bold tabular-nums">$1.234.567</p>
</Card>
```

**No** hacer:
```tsx
<Card className="p-4">
  <DollarSign className="h-8 w-8 text-success mb-2" />
  <p className="text-3xl font-bold">$1.234.567</p>
</Card>
```

Si la métrica necesita ícono (ej. notification bell), que sea `<Badge>` lateral, no elemento dominante.

---

## Layout

### Sidebar

| Property | Value |
|----------|-------|
| Width | `w-64` (256px) |
| Background | `bg-sidebar` (NO hardcoded slate) |
| Text Color | `text-sidebar-foreground` |
| Active Item | `bg-sidebar-accent text-sidebar-accent-foreground` + `ring-1 ring-sidebar-ring/20` |
| Inactive Item | `text-sidebar-foreground hover:bg-sidebar-accent` |
| Mobile | `fixed`, overlay con `bg-black/50` |

**Sin shadows**. Si se necesita jerarquía: `ring-1`.

### Page Layout

| Property | Value |
|----------|-------|
| Page Padding (mobile) | `p-4` |
| Page Padding (desktop) | `p-6` |
| Content Max Width | Sin límite (full width) |
| Card Grid Gap | `gap-4 lg:gap-6` |
| Card Grid | `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` |

### Navbar

| Property | Value |
|----------|-------|
| Height | `h-16` (64px) |
| Border | `border-b` |
| Background | `bg-navbar` (token propio, distinto del fondo) |
| Sticky | `sticky top-0 z-30` |

**Sin shadows**. `border-b` provee la separación.

### Theme Toggle

- Icon: `Moon` (light mode) / `Sun` (dark mode)
- Size: `h-5 w-5`
- Position: Antes del icono de Bell en navbar
- Implementation: `@/components/providers/theme-provider` con `useTheme()` hook

---

## Iconography

### Lucide React Icons

| Context | Size |
|---------|------|
| Sidebar nav | `h-5 w-5` |
| Buttons (default) | `size-4` (16px) |
| Buttons (sm) | `size-3.5` (14px) |
| Buttons (xs) | `size-3` (12px) |
| Form icons | `h-4 w-4` (16px) |
| Card actions | `h-4 w-4` (16px) |
| Navbar icons | `h-5 w-5` (20px) |

### Reglas

- Siempre `shrink-0` para evitar distorsión.
- `pointer-events-none` cuando el icono no es clickeable.
- En buttons: `[*_svg:not([class*='size-'])]:size-4` aplica tamaño por defecto.

---

## Form Elements

### Label

| Property | Value |
|----------|-------|
| Font Size | `text-sm` |
| Font Weight | `font-medium` |
| Gap | `gap-2` |
| Line Height | `leading-none` |

### Textarea

- Min Height: `min-h-16`
- Padding: `px-2.5 py-2`
- Border Radius: `rounded-lg`

### Focus States (siempre)

```
focus-visible:border-ring
focus-visible:ring-3
focus-visible:ring-ring/50
```

### Error States (siempre)

```
aria-invalid:border-destructive
aria-invalid:ring-3
aria-invalid:ring-destructive/20
```

---

## Animations

### Transitions

- **Default duration**: `duration-100` (100ms)
- **Sidebar slide**: `duration-300`
- **Hover transitions**: `transition-colors`

### Variants (Dialogs)

```css
data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95
data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95
data-[side=bottom]:slide-in-from-top-2
```

(Ver `globals.css:220-275` para keyframes `rentalpro-dialog-*`.)

---

## Responsive Breakpoints

| Breakpoint | Value | Usage |
|------------|-------|-------|
| `sm` | 640px | Tables, cards |
| `lg` | 1024px | Sidebar, layout |
| `xl` | 1280px | (available) |
| `2xl` | 1536px | (available) |

---

## Dark Mode Implementation

Toggle con clase `.dark` en `<html>`. Implementación: `@/components/providers/theme-provider` con `useTheme()`. Anti-flash script inline en `layout.tsx` head. Ver `docs/adr/0014-theme-architecture.md` para detalles completos.

---

## Checklist de Migración Ocean Breeze

### Fase 1 (cerrada en `f19d424`)

- [x] Tokens `globals.css` migrados a oklch Ocean Breeze
- [x] Tipografía: `--font-sans: DM Sans` cargada
- [x] Tokens semánticos (`success`/`warning`/`info`/`destructive`) calibrados
- [x] `<Badge>` con variantes semánticas
- [x] `<MetricCard>` con `tone` variants
- [x] Refactor dashboard, reservations, forms (5 files), settings, reservation detail dialog
- [x] Issue #173 cerrado
- [x] `f19d424` — cleanup residual hex

### Fase 2 (en issues #174, #175, #176)

- [ ] **#174** — Calendar tokenizado (timeline + grid + view) + layout cleanup + fonts cargadas
- [ ] **#175** — Admin refactor (status badges, plan badges, health badges, KPIs)
- [ ] **#176** — `<DataTable>` primitive + 6 tablas migradas + 4 modales con `w-[95vw]` + hex fallback + nueva ruta `/payments`

### Inconsistencias conocidas (a cerrar en Fase 2)

- ❌ `dashboard-sidebar.tsx:40` — `shadow-xl backdrop-blur-xl`
- ❌ `dashboard-navbar.tsx:47,74,85` — `shadow-sm`/`shadow-xs`
- ❌ `layout.tsx` — Lora + IBM Plex Mono no importadas
- ❌ `admin/page.tsx` + `admin/users/[id]/page.tsx` — 50+ hex en badges
- ❌ `calendar-timeline.tsx` + `calendar-grid.tsx` — 50+ `bg-zinc-*` y 6 hex `#6366F1`
- ❌ `clients-table.tsx` + `reservation-table.tsx` — tablas no envueltas en Card
- ❌ 4 `DialogContent` sin `w-[95vw]`
- ❌ Hex fallback `#6366F1`/`#3B82F6` en lugar de `var(--primary)`
- ❌ `src/app/(dashboard)/payments/page.tsx` no existe (gap Stitch #11)

---

## References

- **Stitch project**: `projects/1529269251022042678` ("RentalPro - Rediseño UI") — fuente visual
- **PRD**: `docs/agents/prd-ocean-breeze-fase-2.md` — plan completo de Fase 2
- **ADR-0014**: `docs/adr/0014-theme-architecture.md` — arquitectura de theme
- **Audit visual**: memoria de Engram (`audit/ocean-breeze-vs-stitch`)
- **Issues abiertas**: #174, #175, #176
- **Issue cerrado**: #173 (Fase 1)