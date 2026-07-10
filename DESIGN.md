# RentalPro - Design System

> **Status**: Ocean Breeze — Fase 1 + Fase 2 cerradas (issues #173, #174, #175, #176) · 2026-07-09
> **Source of truth visual**: Stitch project `projects/1529269251022042678`
> **Tokens runtime**: `src/app/globals.css` (autoritativo — si hay drift, gana `globals.css`)
> **Migración**: Fase 1 en `f19d424` (#173). Fase 2 cerrada el 2026-07-06 en commits `7fb0892`, `a4bd6c5`, `da9ad0a`, `54bbe28`, `b260fcf`, `2694d9f` (#174, #175, #176).

## Overview

RentalPro es un SaaS de gestión de arriendos de propiedades. Este documento establece las reglas de diseño para mantener consistencia visual en toda la aplicación. **"Ocean Breeze"** es el tema vigente desde la migración cerrada en `6a214aa`. Inspirado en Linear, Stripe Dashboard y Vercel. Denso-pero-limpio, minimalista, B2B. Sin decoración, sin ilustraciones, sin gradientes en cards de contenido.

> **Nota sobre paleta de colores**: la tabla "Light Mode (Ocean Breeze)" debajo documenta los valores semánticos del preset tweakcn aplicados durante Fase 1. El runtime actual (`globals.css`) ha sido **recalibrado** en commits posteriores (alineación con `tweakcn` definitivo + dark mode a hex Stitch). Si necesitas los valores exactos runtime, consulta `src/app/globals.css:5-50` (light) y `:78-130` (dark). La semántica se conserva; cambia la calibración fina.

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
| DM Sans | ✅ Sí (`next/font/google`) | Única en uso intensivo en producto |
| Lora | ✅ Sí (`next/font/google`) | Declarada en tokens `--font-serif`. **Sin uso activo** en UI — disponible para futuros componentes marketing/landing. |
| IBM Plex Mono | ✅ Sí (`next/font/google`, weight 400) | Declarada en tokens `--font-mono`. **Sin uso activo** en UI — disponible para IDs, tokens, datos numéricos si se requiere. |

Las tres fuentes se inyectan vía CSS variables en el `<html>` (layout.tsx:44) y están disponibles globalmente vía `font-serif` / `font-mono`. Hoy el producto solo usa DM Sans — Lora y Mono están precargadas para no introducir flash si se activan.

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

Primitive cerrado en `src/components/ui/data-table.tsx` (commit `7fb0892`, issue #176). Toda tabla del producto DEBE pasar por este primitive.

```tsx
<DataTable
  headers={["Cliente", "Teléfono", "Reservas", "Acciones"]}
  caption="Lista de clientes"
  emptyState={<>No hay clientes</>}
>
  {rows.map((row) => (
    <tr key={row.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
      {/* ... */}
    </tr>
  ))}
</DataTable>
```

**API** (`data-table.tsx:4-10`):
- `headers: string[]` — array de labels para el `<thead>`. Renderiza con `text-[10px] font-bold uppercase tracking-wider text-muted-foreground` y fondo `bg-muted/50`.
- `children: ReactNode` — las filas (`<tr>`). Si está vacío y `emptyState` está definido, se renderiza el empty state centrado.
- `emptyState?: ReactNode` — contenido (típicamente `<p>` + acción opcional) que se muestra cuando no hay filas.
- `caption?: string` — accesible (`<caption className="sr-only">`).
- `className?: string` — se mergea con `overflow-hidden rounded-md border border-border bg-card`.

El wrapper externo aplica `overflow-x-auto` automáticamente. **No** envolver de nuevo en `<div className="overflow-x-auto">`.

**Tipografía por defecto** (NO requiere configuración en celdas individuales):

| Elemento | Tamaño | Clase Tailwind | Dónde |
|----------|--------|----------------|-------|
| Header (`<th>`) | 10px | `text-[10px] font-bold uppercase tracking-wider text-muted-foreground` | `data-table.tsx:23` |
| Body (`<tbody>`) | 12px | `text-xs` | `data-table.tsx:30` |
| Empty state (`<td>`) | 14px | `text-sm text-muted-foreground` | `data-table.tsx:34` |

**Regla**: no especificar `text-xs` en celdas individuales — el `<tbody>` ya lo provee. Si una celda necesita más peso visual (ej: monto destacado), agregar solo `font-bold` o `font-medium`, no cambiar el tamaño. El padding recomendado es `px-4 py-3` (compacto) o `px-6 py-4` (holgado) según densidad.

### Alineación de headers por columna

El primitive acepta headers en dos formas (backward-compatible):

```tsx
// Forma simple — string, alineación por default = "left"
<DataTable headers={["Cliente", "Propiedad", "Estado"]} />

// Forma extendida — objeto con label + align opcional
<DataTable
  headers={[
    "Cliente",
    "Propiedad",
    { label: "Monto", align: "right" },
    { label: "Estado", align: "center" },
  ]}
/>
```

**Cuándo usar cada align**:
- `left` (default) — datos textuales (nombres, descripciones, fechas absolutas)
- `right` — números/montos (Monto, Total, Pagado), acciones de fila
- `center` — estados cortos (badges), contadores pequeños

**Regla crítica**: la alineación del `<th>` DEBE coincidir con la alineación del `<td>` de la misma columna. Si una celda usa `text-right`, el header correspondiente debe usar `align: "right"`. La desalineación es visible sobre todo en dark mode.

**Type exportado**: `DataTableHeader = string | { label: string; align?: "left" | "right" | "center" }` (`data-table.tsx:5-8`). Si construyes el array dinámicamente, anotarlo como `DataTableHeader[]` para que TypeScript no infiera tipos widen.

**Tablas migradas a `<DataTable>`** (cerradas en #176):

- `clients-table.tsx`
- `reservation-table.tsx`
- `reports/page.tsx`
- `admin/users/[id]/page.tsx`
- `admin-users-client.tsx`
- `admin/support/admin-support-list.tsx`

**Patrón de page wrapping** (ver CONTEXT.md:283-285):

```tsx
<Card className="ring-1 ring-foreground/10 overflow-hidden">
  <CardHeader>
    <CardTitle>Título</CardTitle>
    <CardDescription>Descripción</CardDescription>
  </CardHeader>
  <CardContent>
    <DataTable headers={[...]}>{...}</DataTable>
  </CardContent>
</Card>
```

### 2. Modales → `w-[95vw]` + `max-w-{size}`

```tsx
<DialogContent className="w-[95vw] max-w-lg">
  {/* ... */}
</DialogContent>
```

**Modales migrados a `w-[95vw]`** (cerrados en commit `da9ad0a`, #176):

- `calendar-view.tsx:420`, `calendar-timeline.tsx:716` — `w-[95vw] max-w-2xl`
- `properties-client.tsx:314, 341` — `w-[95vw] max-w-2xl p-0 gap-0 overflow-hidden flex flex-col`
- `properties/new/page.tsx:44` — `w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto`
- `properties/[id]/_components/RevealTokenDialog.tsx:117` — `w-[95vw] max-w-md`

**Excepción consciente**: `confirm-dialog.tsx:39` usa `w-[92vw]` (no `95vw`). Es un diálogo de confirmación destructiva donde la jerarquía visual exige menos espacio. Documentado. No migrar.

**Patrón full-screen modal** (sin padding interno, contenido custom): usado en reservation-detail-dialog, reservation-form, reservations-list-client. Ejemplo:

```tsx
<DialogContent className="w-[95vw] max-w-2xl gap-0 p-0 overflow-hidden" showCloseButton={false}>
  {/* contenido custom full-bleed */}
</DialogContent>
```

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
**Ahora**: `|| "var(--primary)"` (teal Ocean Breeze). Harmonizado en commit `54bbe28` (#176).

Aplica en todos los puntos donde se renderiza el color de propiedad como chip/barra: reservation table, reservation-detail-dialog, calendar-timeline.

**Instancias legítimas de hex** (NO migrar):
- `src/lib/validations/property.ts:11` — `z.string().default("#3B82F6")` — default de validación Zod (capa datos, no UI).
- `src/lib/actions/properties.ts:86` y `src/components/properties/property-form.tsx:33,73` — paleta default del color picker (input de usuario). El picker sigue mostrando opciones de color hex porque es data arbitraria.
- Tests (`__tests__/*.tsx`) — mock data, no producción.

### 5. External channel markers (Calendar)

Cerrado en commit `5bc608e` (#174) con la utility `src/lib/calendar/channel-colors.ts`:

```ts
import { channelColors } from "@/lib/calendar/channel-colors";

const { dotClass, labelClass } = channelColors[block.channel];
return (
  <>
    <span className={cn("size-2 rounded-full", dotClass)} />
    <span className={labelClass}>{channelLabel(block.channel)}</span>
  </>
);
```

| Channel | Dot class | Label class |
|---------|-----------|-------------|
| AIRBNB | `bg-info` | `text-info` |
| BOOKING_COM | `bg-primary` | `text-primary` |
| VRBO | `bg-accent` | `text-accent` |
| OTHER | `bg-muted-foreground` | `text-muted-foreground` |

**NO** usar `bg-blue-500` / `bg-rose-500` / `bg-indigo-500` como antes. Consumir siempre la utility para que un cambio de paleta se propague atómicamente. Test de regresión: `src/lib/calendar/__tests__/channel-colors.test.ts`.

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

Layout estructural compartido por los dos sidebars:

| Property | Value |
|----------|-------|
| Width | `w-64` (256px) |
| Background | `bg-sidebar` (NO hardcoded slate, blanco en light / `#0d1c2d` en dark) |
| Border | `border-r border-sidebar-border` |
| Icon size (nav) | `h-5 w-5` (20px) |
| Layout item | `flex items-center gap-3 px-3 py-2 rounded text-sm transition-colors` |
| Mobile | `fixed`, overlay con `bg-black/50` |
| Hover bg (todos los elementos) | `hover:bg-muted` (gray neutral, NO tinte teal) |

**Sin shadows**. Si se necesita jerarquía activa: background tint + font weight.

#### Owner sidebar (`dashboard-sidebar.tsx`)

| Estado | Tipografía | Background | Font weight |
|--------|------------|------------|-------------|
| Inactivo | `text-muted-foreground` (#64748B slate-500, matchea code.html) | transparent | default |
| Inactivo hover | (heredada) | `bg-muted` (pale gray neutral) | default |
| **Activo** | `text-primary` (#2DBE85 teal) | `bg-primary/10` (teal al 10%) | `font-medium` |

#### Admin sidebar (`dashboard-sidebar-admin.tsx`)

| Estado | Tipografía | Background | Font weight |
|--------|------------|------------|-------------|
| Inactivo | `text-muted-foreground` | transparent | default |
| Inactivo hover | (heredada) | `bg-muted` | default |
| **Activo** | `text-sidebar-accent-foreground` (#131f1a) | `bg-sidebar-accent` (pale mint) | `font-medium` |

**Diferencia entre sidebars**: el owner usa teal accent (`bg-primary/10`) para el active state porque matchea `code.html` (Stitch reference). El admin usa el token `bg-sidebar-accent` directamente (pale mint bg + dark text). Son dos patrones intencionales, NO son drift.

#### Reglas de uso de tokens de sidebar

| Token | Cuándo usar | Cuándo NO usar |
|-------|-------------|----------------|
| `bg-sidebar` | Background del container del sidebar | Para hover ni para active |
| `bg-sidebar-accent` | Active state del admin sidebar | Para hover (drift corregido — usar `bg-muted`) |
| `text-sidebar-foreground` | Color base del container (texto e iconos inactivos del shell) | Para nav links (usar `text-muted-foreground`) |
| `text-muted-foreground` | Tipografía de nav links inactivos (slate-500) | Para active state (usar `text-primary` o `text-sidebar-accent-foreground`) |
| `bg-muted` | Hover bg de todos los elementos del sidebar | Para active state |
| `bg-primary/10` + `text-primary` | Active state del owner sidebar | En admin sidebar (usa `bg-sidebar-accent`) |

**Iconografía**: `h-5 w-5` (20px) para nav. `h-4 w-4` (16px) para iconos auxiliares (theme toggle, logout, dropdown trigger). `h-5 w-5` para mobile close button.

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

### Fase 1 (cerrada en `f19d424` — issue #173)

- [x] Tokens `globals.css` migrados a oklch Ocean Breeze
- [x] Tipografía: `--font-sans: DM Sans` cargada
- [x] Tokens semánticos (`success`/`warning`/`info`/`destructive`) calibrados
- [x] `<Badge>` con variantes semánticas
- [x] `<MetricCard>` con `tone` variants
- [x] Refactor dashboard, reservations, forms (5 files), settings, reservation detail dialog
- [x] `f19d424` — cleanup residual hex

### Fase 2 (cerrada el 2026-07-06 — issues #174, #175, #176)

- [x] **#174** — Calendar tokenizado (timeline + view) + layout cleanup + fonts cargadas
  - `5bc608e` — drop CalendarGrid view, remove property.color from calendar
  - `ced81d5` — Stitch replication: page header + KPIs + 2-card layout
  - `748ec55`, `815dac4`, `eb5f2aa`, `1abbf6f` — dashboard calendar + dark mode
  - `62085c2` — load DM Sans italic axis
  - `5fcc8f7` — sidebar structure, `52dde38`, `1fbcdd3`, `7c8b2d2` — text/shell color alignment
  - `7e76886`, `5a47634` — sidebar/navbar text contrast
  - `ad1bf2e`, `bad99c2`, `83c89d8`, `c3fcb91` — dark mode palette + button contrast
  - `6661bb5`, `adf63c2` — sidebar/header link colors
  - `1d20d73`, `3893afe`, `57d2020`, `b0d7a59`, `a2b1bcf`, `dd0f6fe`, `5f8363a`, `065ba1f`, `f324cff` — Reservas Stitch replication
  - `4bf5cd5`, `6c595e6`, `fa1dc93`, `1b9d02c` — modal/dashboard cleanups
- [x] **#175** — Admin refactor (status badges, plan badges, health badges, KPIs)
  - `2694d9f` — migrate admin support list to DataTable
  - Badges semánticos y hex removidos en admin
- [x] **#176** — `<DataTable>` primitive + 6 tablas migradas + 4 modales con `w-[95vw]` + hex fallback + nueva ruta `/payments`
  - `7fb0892` — DataTable primitive + test
  - `a4bd6c5` — migrate clients + reservations tables
  - `da9ad0a` — `w-[95vw]` en 4 modales
  - `54bbe28` — hex fallback property.color → `var(--primary)`
  - `b260fcf` — nueva ruta `/payments` (page + filters + table + extended server action)
  - `177`, `178`, `179`, `180`, `181` — payments work derivado (issues posteriores a #176)
  - `9d17ca8` — remove old `payments-table.tsx` duplicado

### Inconsistencias resueltas (audit 2026-07-09)

- ✅ `dashboard-sidebar.tsx` — `shadow-xl backdrop-blur-xl` eliminados
- ✅ `dashboard-navbar.tsx` — `shadow-sm`/`shadow-xs` eliminados (usa `border-b`)
- ✅ `layout.tsx` — Lora + IBM Plex Mono cargadas vía `next/font/google`
- ✅ `admin/*` — hex en badges migrados a tokens semánticos
- ✅ `calendar-timeline.tsx` + `calendar-view.tsx` — `bg-zinc-*` y `#6366F1` eliminados
- ✅ `clients-table.tsx` + `reservation-table.tsx` — usan `<DataTable>` + `<Card>` wrapper
- ✅ Los 4 `DialogContent` problemáticos ahora usan `w-[95vw]`
- ✅ Hex fallback `var(--primary)` propagado
- ✅ `/payments` route existe con rediseño completo (KPIs + filtros + tabla reusable)

### Drift menor conocido (no es bug — es decisión)

- `src/lib/validations/property.ts` y `src/lib/actions/properties.ts` — `#3B82F6` es el **default de la paleta del color picker**, no un fallback de render. Permanece.
- `src/components/properties/property-form.tsx:33,73` — paleta del color picker (input de usuario).
- Tests con `color: "#3B82F6"` en mocks — sin acción.

---

## Patrones establecidos (post Fase 2)

Primitivas y patrones creados durante la Fase 2 que **deben usarse** en futuras pantallas.

### Primitivas UI (`src/components/ui/`)

| Primitive | Ubicación | Propósito |
|-----------|-----------|-----------|
| `<DataTable>` | `data-table.tsx` | Toda tabla del producto (ver sección 1) |
| `<MetricCard>` | `metric-card.tsx` | KPI con icono, tone semántico y status dot. Usado en `/admin/users/[id]` |
| `<StitchKpiCard>` | `stitch-kpi-card.tsx` | KPI minimal (label + value + indicator + progress bar). Usado en `/reports` |
| `<CurrencyInput>` | `currency-input.tsx` | Input numérico formateado CLP con `Intl.NumberFormat`. Usado en property-form |
| `<ReceiptUpload>` | `receipt-upload.tsx` | Upload de comprobantes de pago (Cloudinary) |

**Cuándo usar cuál:**
- `MetricCard` — KPIs administrativos o de owner que necesitan jerarquía visual fuerte (icono + status dot + detalle).
- `StitchKpiCard` — KPIs agrupados en grid (reports, dashboard executive summary) donde prima densidad sobre jerarquía individual.
- `Badge` — Estados puntuales cortos (pago completado, reserva confirmada). NO usar para KPIs.

### Patrones de página

#### `/payments` (referencia de rediseño denso)

Layout canónico establecido en `7618e78`:

```
┌─────────────────────────────────────────────────┐
│ PageHeader: título + acción principal           │
├─────────────────────────────────────────────────┤
│ <PaymentsKpis>  ← grid 4 KPIs ejecutivos       │
├─────────────────────────────────────────────────┤
│ <Card>                                           │
│   <CardHeader> filtros chip + count             │
│   <CardContent>                                  │
│     <PaymentsTable> ← primitive reusable       │
│   </CardContent>                                 │
│ </Card>                                          │
└─────────────────────────────────────────────────┘
```

#### `/reports` (referencia de sección con chart)

Layout canónico establecido en `8fcb505..c7268f3`:

```
┌─────────────────────────────────────────────────┐
│ Header: "Resumen Ejecutivo"                      │
├─────────────────────────────────────────────────┤
│ [4 KPIs ejecutivos]                              │
├─────────────────────────────────────────────────┤
│ Distribución por Modelo (SVG rings)              │
├─────────────────────────────────────────────────┤
│ Resumen Operativo por Propiedad (progress bars) │
├─────────────────────────────────────────────────┤
│ Histórico de Ingresos (vertical bar chart)      │
├─────────────────────────────────────────────────┤
│ Cobranza (tabla con badges semánticos)          │
└─────────────────────────────────────────────────┘
```

#### `ReservationPill` (estado temporal inline)

Para celdas de tabla donde se muestra el estado temporal de una reserva (Próxima/Activa/Finalizada/Cancelada), se usa un pill **inline** (no `<Badge>`) con clases semánticas. Definido en `src/components/reservations/reservation-table.tsx:18-45`:

```tsx
type PillTone = "success" | "info" | "info-strong" | "warning" | "destructive" | "neutral";

const toneClassNames: Record<PillTone, string> = {
  success: "border-success/20 bg-success/10 text-success",
  info: "border-info/20 bg-info/10 text-info",
  "info-strong": "border-info/30 bg-info/25 text-info",
  warning: "border-warning/25 bg-warning/10 text-warning",
  destructive: "border-destructive/25 bg-destructive/10 text-destructive",
  neutral: "border-muted bg-muted text-muted-foreground",
};
```

**Regla**: usar `ReservationPill` solo dentro de la tabla de reservas. Para otros estados puntuales (pagos, propiedades, etc.) usar `<Badge variant>`. La razón de ser un primitive distinto: el pill admite un `sublabel` (ej. "En 5 días", "3 noches") debajo del label principal, lo que `<Badge>` no soporta nativamente.

### Reglas para futuros rediseños

1. **Las tablas NO se envuelven en `<Card>`**. El `<DataTable>` primitive ya provee su propio framing con `rounded-md border border-border bg-card` (ver `data-table.tsx:14`). Patrón canónico: `PageHeader` + barra de filtros + `<DataTable>` directo. Para tablas dentro de secciones (ej: tabs en `/admin/users/[id]`, secciones en `/dashboard`, secciones en `/reports`): título/descripción como bloque standalone encima + `<DataTable>` directo. Ver CONTEXT.md sección "Card wrapping en páginas de tabla".
2. **Toda página de filtros** debe tener filtros colapsables con `Ocultar`/`Mostrar` (ver CONTEXT.md:296-297) cuando hay más de 3 controles.
3. **Toda KPI** debe usar `<MetricCard>` o `<StitchKpiCard>` según el contexto (admin/dashboard vs. reports).
4. **Todo estado** debe usar `<Badge variant>` o `ReservationPill` (solo en tabla de reservas). No reinventar pills inline.
5. **Todo color hex** debe pasar por tokens semánticos. Excepciones documentadas arriba.

### Cuándo SÍ usar `<Card>`

- KPIs (`<MetricCard>` ya lo usa internamente — no envolver de nuevo)
- Settings (secciones de `/settings`)
- Forms completos (crear propiedad, editar reserva, etc.)
- Secciones de detalle sin tabla (ej: `Marketplace`, `Propiedades` tab en `/admin/users/[id]` cuando solo es metadata)
- Integración de Mercado Pago (`MercadoPagoSettings`)

### Cuándo NO usar `<Card>`

- Alrededor de `<DataTable>` o `<table>` raw (rompe el framing del primitive)
- Como contenedor genérico de página (el `bg-background` ya provee el canvas)

---

#### `/settings` (referencia de página de configuración)

Layout canónico establecido en `8b77651` (commit del rediseño de `/settings`):

```
┌─────────────────────────────────────────────────────────┐
│ PageHeader: título + descripción                       │
├─────────────────────────────────────────────────────────┤
│ <div max-w-6xl>                                         │
│   <grid grid-cols-1 md:grid-cols-2 gap-6 items-start>   │
│     Columna 1: <ProfileForm />                          │
│       ├─ Card Perfil (avatar + nombre + email + tel)    │
│       ├─ Card Empresa                                   │
│       ├─ Card Preferencias                              │
│       └─ Botón Guardar Cambios (footer derecha)         │
│     Columna 2:                                          │
│       ├─ <NotificationSettings /> (Card 2 toggles)      │
│       └─ <MercadoPagoSettings /> (Card OAuth)           │
└─────────────────────────────────────────────────────────┘
```

**Reglas específicas de `/settings`** (cierre `8b77651`):

- **Cards usan `rounded-lg`** (6px per ADR-0016) explícitamente vía `className="rounded-lg"`, no se confía en el default `rounded-xl` del primitive. Desviación local intencional para mantener consistencia con el resto de controles del primitive.
- **Email es read-only** con texto helper "*Para cambiar tu email, contacta a soporte.*" — no editable desde UI porque requiere flujo de verificación externo.
- **Idioma/moneda/timezone** se persisten en `UserProfile` pero **no** afectan formatters ni date-fns locales aún. Cuando se activen, revisar ADR-0020 (timezone de negocio en `America/Santiago`).
- **Notificaciones con guardado instantáneo** (cada toggle es su propio server action). El botón "Guardar Cambios" del form solo persiste Perfil + Empresa + Preferencias.
- **Avatar upload** vía Cloudinary (`uploadImage` con folder `rentalpro/avatars`, max 5MB, MIME `image/*`). Endpoint `/api/upload` ya existente.

---

## References

- **Stitch project**: `projects/1529269251022042678` ("RentalPro - Rediseño UI") — fuente visual
- **PRD**: `docs/agents/prd-ocean-breeze-fase-2.md` — plan de Fase 2 (cerrado)
- **ADR-0014**: `docs/adr/0014-theme-architecture.md` — arquitectura de theme
- **ADR-0016**: `docs/adr/0016-radius-and-control-shape-system.md` — radio y shape system
- **ADR-0022**: `docs/adr/0022-prisma-migrations-via-supabase-mcp.md` — workflow de migraciones Prisma en Supabase
- **Issues cerradas**: #173 (Fase 1), #174 / #175 / #176 (Fase 2, 2026-07-06), #183 (`/settings` rediseño)
- **Issues derivadas abiertas**: #177, #178, #179, #180, #181 (pagos work post-rediseño), #182 (dashboard UrgentCollectionCard refactor)