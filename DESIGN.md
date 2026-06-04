# RentalPro - Design System

## Overview

RentalPro es un SaaS de gestión de arriendos de propiedades. Este documento establece las reglas de diseño para mantener consistencia visual en toda la aplicación.

---

## Color Palette

### Light Mode

| Token | Value (oklch) | Usage |
|-------|---------------|-------|
| `--background` | `1.0000 0 0` | Fondo principal |
| `--foreground` | `0.3211 0 0` | Texto principal |
| `--card` | `1.0000 0 0` | Cards y contenedores |
| `--card-foreground` | `0.3211 0 0` | Texto en cards |
| `--primary` | `0.6231 0.1880 259.8145` | Botones primarios, accents |
| `--primary-foreground` | `1.0000 0 0` | Texto sobre primary |
| `--secondary` | `0.9670 0.0029 264.5419` | Elementos secundarios |
| `--secondary-foreground` | `0.4461 0.0263 256.8018` | Texto sobre secondary |
| `--muted` | `0.9846 0.0017 247.8389` | Fondos apagados |
| `--muted-foreground` | `0.5510 0.0234 264.3637` | Texto apagado |
| `--accent` | `0.9514 0.0250 236.8242` | Highlights, hover states |
| `--accent-foreground` | `0.3791 0.1378 265.5222` | Texto sobre accent |
| `--destructive` | `0.6368 0.2078 25.3313` | Estados de error |
| `--destructive-foreground` | `1.0000 0 0` | Texto sobre destructive |
| `--border` | `0.9276 0.0058 264.5313` | Bordes |
| `--input` | `0.9276 0.0058 264.5313` | Inputs |
| `--ring` | `0.6231 0.1880 259.8145` | Focus rings |

### Dark Mode

| Token | Value (oklch) | Usage |
|-------|---------------|-------|
| `--background` | `0.2046 0 0` | Fondo principal |
| `--foreground` | `0.9219 0 0` | Texto principal |
| `--card` | `0.2686 0 0` | Cards y contenedores |
| `--card-foreground` | `0.9219 0 0` | Texto en cards |
| `--primary` | `0.6231 0.1880 259.8145` | Botones primarios (sin cambio) |
| `--muted` | `0.2393 0 0` | Fondos apagados |
| `--muted-foreground` | `0.7155 0 0` | Texto apagado |
| `--accent` | `0.3791 0.1378 265.5222` | Highlights |
| `--accent-foreground` | `0.8823 0.0571 254.1284` | Texto sobre accent |
| `--border` | `0.3715 0 0` | Bordes |
| `--input` | `0.3715 0 0` | Inputs |

### Sidebar Palette (Unified)

El sidebar utiliza variables CSS propias para mantener contraste en navegación:

| Token | Light | Dark |
|-------|-------|------|
| `--sidebar` | `0.9846 0.0017 247.8389` | `0.2046 0 0` |
| `--sidebar-foreground` | `0.3211 0 0` | `0.9219 0 0` |
| `--sidebar-primary` | `0.6231 0.1880 259.8145` | `0.6231 0.1880 259.8145` |
| `--sidebar-primary-foreground` | `1.0000 0 0` | `1.0000 0 0` |
| `--sidebar-accent` | `0.9514 0.0250 236.8242` | `0.3791 0.1378 265.5222` |
| `--sidebar-accent-foreground` | `0.3791 0.1378 265.5222` | `0.8823 0.0571 254.1284` |
| `--sidebar-border` | `0.9276 0.0058 264.5313` | `0.3715 0 0` |
| `--sidebar-ring` | `0.6231 0.1880 259.8145` | `0.6231 0.1880 259.8145` |

> **IMPORTANTE**: El sidebar usar bg-slate-900 hardcodeado es una INCOSISTENCIA. El sidebar DEBE usar `bg-sidebar` y `text-sidebar-foreground`. Ver corrección en `dashboard-sidebar.tsx`.

---

## Typography

### Font Families

```css
--font-sans: Inter, ui-sans-serif, sans-serif, system-ui;
--font-serif: Source Serif 4, serif;
--font-mono: JetBrains Mono, monospace;
```

### Scale

| Element | Size | Weight | Line Height |
|---------|------|--------|-------------|
| Page Title (h1) | `text-2xl sm:text-3xl` | `font-bold` (700) | `leading-tight` |
| Section Title (h2) | `text-lg` | `font-medium` (500) | `leading-snug` |
| Card Title | `text-base` / `text-sm` (sm cards) | `font-medium` (500) | `leading-snug` |
| Body | `text-sm` | `font-normal` (400) | `leading-normal` |
| Small/Labels | `text-xs` | `font-medium` (500) | `leading-none` |
| Muted Text | `text-sm` / `text-xs` | (inherit) | (inherit) |
| Button | `text-sm` / `text-[0.8rem]` (sm) | `font-medium` (500) | (auto) |

### Usage Rules

- **Headings**: Usar `font-heading` class para elementos que siguen la jerarquía de títulos de cards
- **Body**: Usar `text-sm` por defecto para contenido
- **Form labels**: Usar `text-sm font-medium`
- **Muted text**: Usar `text-muted-foreground`

---

## Spacing

### Base Unit: 0.25rem (4px)

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

### Responsive Spacing

- **Mobile** (`<640px`): `p-4`
- **Desktop** (`≥640px`): `p-6`

---

## Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-sm` | `calc(0.375rem - 4px)` = 2px | Badges |
| `--radius-md` | `calc(0.375rem - 2px)` = 4px | Buttons sm, inputs |
| `--radius-lg` | `0.375rem` = 6px | Default buttons, cards |
| `--radius-xl` | `calc(0.375rem + 4px)` = 10px | Modals, large containers |

### Usage by Component

- **Buttons**: `rounded-lg` (6px)
- **Inputs**: `rounded-lg` (6px)
- **Cards**: `rounded-xl` (10px)
- **Badges**: `rounded-4xl` (pill shape)
- **Modals/Dialogs**: `rounded-xl` (10px)

---

## Shadows

| Token | Usage |
|-------|-------|
| `--shadow-2xs` | Subtle separators |
| `--shadow-xs` | Card headers |
| `--shadow-sm` | Cards, buttons |
| `--shadow-md` | Dropdowns, popovers |
| `--shadow-lg` | Modals |
| `--shadow-xl` | Large modals |
| `--shadow-2xl` | Special emphasis |

---

## Component Specifications

### Button

| Property | Value |
|-----------|-------|
| Height (default) | `h-8` (32px) |
| Height (sm) | `h-7` (28px) |
| Height (lg) | `h-9` (36px) |
| Height (icon) | `size-8` (32px) |
| Height (icon-sm) | `size-7` (28px) |
| Height (icon-xs) | `size-6` (24px) |
| Padding | `px-2.5` horizontal |
| Border Radius | `rounded-lg` |
| Font Size | `text-sm` / `text-[0.8rem]` (sm) |
| Font Weight | `font-medium` (500) |
| Icon Gap | `gap-1` / `gap-1.5` |

**Variants**:
- `default`: `bg-primary text-primary-foreground`
- `outline`: `border-border bg-background hover:bg-muted`
- `secondary`: `bg-secondary text-secondary-foreground`
- `ghost`: `hover:bg-muted hover:text-foreground`
- `destructive`: `bg-destructive/10 text-destructive hover:bg-destructive/20`
- `link`: `text-primary underline-offset-4 hover:underline`

**Botones de acción primaria**: Los botones para crear nueva entidad ("Nueva Propiedad", "Nueva Reserva", etc.) deben usar el tamaño **default** (`h-8`). No usar `size="sm"` en estos botones.

### Input

| Property | Value |
|-----------|-------|
| Height | `h-8` (32px) |
| Padding | `px-2.5 py-1` |
| Border | `border border-input` |
| Radius | `rounded-lg` |
| Font Size | `text-base` mobile, `md:text-sm` desktop |

### Select

| Property | Value |
|-----------|-------|
| Height (default) | `h-8` (32px) |
| Height (sm) | `h-7` (28px) |
| Padding | `py-2 pr-2 pl-2.5` |
| Border Radius | `rounded-lg` (default), `rounded-[min(var(--radius-md),10px)]` (sm) |

### Card

| Property | Value |
|-----------|-------|
| Padding | `py-4 px-4` (default), `py-3 px-3` (sm) |
| Border Radius | `rounded-xl` |
| Gap | `gap-4` (default), `gap-3` (sm) |

**Sub-components**:
- `CardHeader`: `px-4` (`px-3` sm)
- `CardContent`: `px-4` (`px-3` sm)
- `CardFooter`: `p-4` with `bg-muted/50` background

### Badge

| Property | Value |
|-----------|-------|
| Height | `h-5` (20px) |
| Padding | `px-2 py-0.5` |
| Border Radius | `rounded-4xl` (pill) |
| Font Size | `text-xs` |
| Icon Size | `size-3!` |

---

## Layout

### Sidebar

| Property | Value |
|-----------|-------|
| Width | `w-64` (256px) |
| Background | `bg-sidebar` (NO hardcoded slate) |
| Text Color | `text-sidebar-foreground` |
| Active Item | `bg-sidebar-accent text-sidebar-accent-foreground` |
| Inactive Item | `text-sidebar-foreground hover:bg-sidebar-accent` |
| Mobile | `fixed`, overlay con `bg-black/50` |

**Navigation Items**:
- Icon size: `h-5 w-5`
- Gap: `gap-3`
- Padding: `px-3 py-2`
- Border Radius: `rounded-lg`

### Page Layout

| Property | Value |
|-----------|-------|
| Page Padding (mobile) | `p-4` |
| Page Padding (desktop) | `p-6` |
| Content Max Width | Sin límite (full width) |
| Card Grid Gap | `gap-4 lg:gap-6` |
| Card Grid | `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` |

### Navbar

| Property | Value |
|-----------|-------|
| Height | `h-16` (64px) |
| Border | `border-b` |
| Background | `bg-background` |
| Sticky | `sticky top-0 z-30` |

**Theme Toggle**:
- Icon: `Moon` (light mode) / `Sun` (dark mode)
- Size: `h-5 w-5`
- Position: Antes del icono de Bell
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

### Icon Usage Rules

- Siempre usar `shrink-0` para evitar distorsión
- Usar `pointer-events-none` cuando el icono no es clickeable
- En buttons: `[*_svg:not([class*='size-'])]:size-4` aplica tamaño por defecto

---

## Form Elements

### Label

| Property | Value |
|-----------|-------|
| Font Size | `text-sm` |
| Font Weight | `font-medium` |
| Gap | `gap-2` |
| Line Height | `leading-none` |

### Textarea

| Property | Value |
|-----------|-------|
| Min Height | `min-h-16` |
| Padding | `px-2.5 py-2` |
| Border Radius | `rounded-lg` |

### Focus States

Siempre usar:
- `focus-visible:border-ring`
- `focus-visible:ring-3`
- `focus-visible:ring-ring/50`

### Error States

- `aria-invalid:border-destructive`
- `aria-invalid:ring-3`
- `aria-invalid:ring-destructive/20`

---

## Animations

### Transitions

- **Default duration**: `duration-100` (100ms)
- **Sidebar slide**: `duration-300`
- **Hover transitions**: `transition-colors`

### Variants

- `data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95`
- `data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95`
- `data-[side=bottom]:slide-in-from-top-2`

---

## Responsive Breakpoints

| Breakpoint | Value | Usage |
|------------|-------|-------|
| sm | 640px | Tables, cards |
| lg | 1024px | Sidebar, layout |
| xl | 1280px | (available) |
| 2xl | 1536px | (available) |

---

## Inconsistencias Corregidas

### 1. Sidebar con colores hardcodeados

**Antes** (INCORRECTO):
```tsx
className="... bg-slate-900 text-white ..."
```

**Después** (CORRECTO):
```tsx
className="... bg-sidebar text-sidebar-foreground ..."
```

Los estados hover/active deben usar:
```tsx
isActive 
  ? "bg-sidebar-accent text-sidebar-accent-foreground" 
  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
```

### 2. Botones con alturas inconsistentes

Verificar que todos los botones usen los tamaños estandarizados del CVA.

### 3. Espaciado de página inconsistente

Usar siempre `p-4 lg:p-6` para contenido principal.

---

## Dark Mode Implementation

El dark mode se activa con la clase `.dark` en el elemento html. El toggle está en el navbar (DashboardNavbar) y usa el provider local de tema:

```tsx
// Toggle button
const { theme, setTheme } = useTheme();
<Button onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
  {theme === "dark" ? <Sun /> : <Moon />}
</Button>
```

Todas las variables CSS usan el patrón:

```css
:root {
  --primary: oklch(0.6231 0.1880 259.8145);
}

.dark {
  --primary: oklch(0.6231 0.1880 259.8145); /* Se mantiene igual en dark mode */
}
```

Para elementos que requieren contraste específico (sidebar):
```css
.dark {
  --sidebar: oklch(0.2046 0 0);
  --sidebar-foreground: oklch(0.9219 0 0);
}
```

**ThemeProvider setup** en `app/layout.tsx`:
```tsx
<ThemeProvider attribute="class" defaultTheme="system" enableSystem>
  {children}
</ThemeProvider>
```

---

## Checklist de Implementación

- [ ] Sidebar actualizado para usar variables CSS (no hardcoded slates)
- [ ] Todas las páginas usan padding consistente `p-4 lg:p-6`
- [ ] Cards usan gap consistente `gap-4 lg:gap-6`
- [ ] Botones usan los variants del CVA
- [ ] Focus states implementados en todos los inputs
- [ ] Dark mode testeado en todos los componentes
