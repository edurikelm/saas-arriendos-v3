# ADR-0014: Arquitectura de Theme (Dark/Light Mode)

## Status

Aceptado

## Context

RentalPro necesita soportar modo claro y oscuro en toda la aplicación, respetando la preferencia del sistema operativo del usuario y permitiendo cambio manual. La app usa Next.js 16 App Router con Tailwind CSS v4 y componentes shadcn/ui.

Las opciones evaluadas fueron:
1. **CSS-only** con `prefers-color-scheme` media query — no permite toggle manual
2. **next-themes** — librería estándar del ecosistema Next.js/shadcn, maneja React context + localStorage + class toggling, pero en React 19/Next.js 16 emite un `<script>` inline desde un Client Component y genera warning de consola
3. **Implementación propia** con React context + `next/script` en root layout — mantiene la UX sin renderizar scripts desde componentes cliente

## Decision

Usar un **ThemeProvider propio** con estrategia `attribute="class"` sobre Tailwind v4 CSS custom properties. El bootstrap anti-flash se ejecuta con `<Script strategy="beforeInteractive">` en `src/app/layout.tsx`, y el estado de tema vive en `src/components/providers/theme-provider.tsx`.

### Por qué `attribute="class"` y no `data-theme`

La estrategia `class` pone `.dark` directamente en `<html>`, lo que permite usar el `@custom-variant dark` de Tailwind v4 sin selectores de atributo adicionales. Es el enfoque recomendado por shadcn/ui para Tailwind v4.

### Arquitectura en 4 capas

```
Capa 1: CSS (globals.css)
  :root { --background: oklch(...); }     ← variables light
  .dark { --background: oklch(...); }     ← variables dark
  @theme inline { --color-background: var(--background); }  ← mapeo a tokens Tailwind
  @layer base { body { @apply bg-background text-foreground; } }
```

### Separación visual de 3 zonas (ADR-0014-amendment-1)

El layout tiene 3 zonas con tokens distintos para evitar que se fundan visualmente:

| Zona | Token | Light | Dark |
|---|---|---|---|
| Contenido principal | `--background` / `bg-background` | `oklch(1.0 0 0)` blanco puro | `oklch(0.2046 0 0)` casi negro |
| Navbar superior | `--navbar` / `bg-navbar` | `oklch(0.99 0.005 255)` blanco con tinte azul | `oklch(0.23 0.005 260)` gris medio azulado |
| Sidebar | `--sidebar` / `bg-sidebar` | `oklch(0.9846 0.0017 247.8389)` gris muy claro | `oklch(0.26 0 0)` gris más claro |

Jerarquía visual: en light el contenido principal es el más claro (blanco puro), el navbar tiene un tinte sutil, y el sidebar es el más oscuro de los tres. En dark la jerarquía se invierte: contenido principal más oscuro, navbar más claro, sidebar más claro aún.

Los tokens `--navbar` y `--navbar-foreground` se registran en `@theme inline` igual que el resto de variables.

## Implementation

### Archivos clave

- **`src/app/globals.css`** — Variables CSS en `:root` y `.dark`, mapeo `@theme inline`, `@custom-variant dark (&:where(.dark, .dark *))`, estilos base en `@layer base`
- **`src/components/providers/theme-provider.tsx`** — Context local de tema, `localStorage`, detección de sistema y class toggling en `<html>`, `"use client"`
- **`src/app/layout.tsx`** — `<ThemeProvider>` envuelve `{children}` y `<Toaster />`, `<html suppressHydrationWarning>`, `<meta name="color-scheme">`
- **`src/components/layout/dashboard-navbar.tsx`** — Toggle con dropdown (Claro / Oscuro / Sistema) + `bg-navbar`
- **`src/components/layout/dashboard-layout-client.tsx`** — Layout principal, mobile top bar usa `bg-navbar`
- **`src/components/layout/admin-layout-client.tsx`** — Layout admin, mobile top bar usa `bg-navbar`
- **`src/components/layout/dashboard-sidebar.tsx`** — Sidebar con `bg-sidebar`
- **`src/components/ui/sonner.tsx`** — Toaster que consume `useTheme()` para heredar el tema

### Dependencia

- `lucide-react` — iconos Sun/Moon para el toggle

## Consequences

### Positive

- El tema sigue la preferencia del SO por defecto (`defaultTheme="system"`)
- El usuario puede sobrescribir manualmente y volver a "Sistema"
- La preferencia persiste en localStorage entre sesiones
- `suppressHydrationWarning` previene advertencias de hidratación cuando el tema guardado difiere del SSR por defecto
- `disableTransitionOnChange` previene animaciones indeseadas al cambiar tema
- `<meta name="color-scheme">` asegura que scrollbars y form controls nativos sigan el tema
- Todos los componentes shadcn/ui responden automáticamente via `dark:` variants
- `@theme inline` genera utility classes (`bg-background`, `text-primary`) desde variables CSS

### Negative

- La implementación propia debe mantenerse alineada con los cambios de React/Next.js
- El Toaster DEBE estar dentro del ThemeProvider para recibir el contexto — si se mueve fuera, los toasts pierden el tema
- Los layouts anidados que no usan `bg-background` (colores hardcodeados) rompen la consistencia visual
- Variables duplicadas en `:root` y `.dark` requieren mantenimiento sincronizado al agregar nuevos tokens

## References

- [shadcn/ui Dark Mode](https://ui.shadcn.com/docs/dark-mode/next)
- [Tailwind v4 Custom Variants](https://tailwindcss.com/docs/adding-custom-styles#custom-variants)
- Skill: `.agents/skills/tailwind-v4-shadcn/`
- Issues relacionados: #88, #89, #90, #91
