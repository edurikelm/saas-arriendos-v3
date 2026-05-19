# ADR-0014: Arquitectura de Theme (Dark/Light Mode)

## Status

Aceptado

## Context

RentalPro necesita soportar modo claro y oscuro en toda la aplicación, respetando la preferencia del sistema operativo del usuario y permitiendo cambio manual. La app usa Next.js 16 App Router con Tailwind CSS v4 y componentes shadcn/ui.

Las opciones evaluadas fueron:
1. **CSS-only** con `prefers-color-scheme` media query — no permite toggle manual
2. **next-themes** — librería estándar del ecosistema Next.js/shadcn, maneja React context + localStorage + class toggling
3. **Implementación propia** con React context — reinventa lo que next-themes ya resuelve

## Decision

Usar **next-themes** con estrategia `attribute="class"` sobre Tailwind v4 CSS custom properties.

### Por qué `attribute="class"` y no `data-theme`

La estrategia `class` pone `.dark` directamente en `<html>`, lo que permite usar el `@custom-variant dark` de Tailwind v4 sin selectores de atributo adicionales. Es el enfoque recomendado por shadcn/ui para Tailwind v4.

### Arquitectura en 4 capas

```
Capa 1: CSS (globals.css)
  :root { --background: oklch(...); }     ← variables light
  .dark { --background: oklch(...); }     ← variables dark
  @theme inline { --color-background: var(--background); }  ← mapeo a tokens Tailwind
  @layer base { body { @apply bg-background text-foreground; } }

Capa 2: next-themes (theme-provider.tsx + layout.tsx)
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
    → inyecta script anti-flash
    → maneja localStorage + React context
    → toggles .dark class en <html>

Capa 3: Theme Toggle (dashboard-navbar.tsx)
  useTheme() → setTheme("light" | "dark" | "system")
  DropdownMenu con 3 opciones (patrón shadcn/ui estándar)

Capa 4: Componentes (shadcn/ui)
  Usan dark: variants + bg-background, text-foreground
  No necesitan lógica de tema propia
```

## Implementation

### Archivos clave

- **`src/app/globals.css`** — Variables CSS en `:root` y `.dark`, mapeo `@theme inline`, `@custom-variant dark (&:where(.dark, .dark *))`, estilos base en `@layer base`
- **`src/components/providers/theme-provider.tsx`** — Wrapper de `next-themes`, `"use client"`
- **`src/app/layout.tsx`** — `<ThemeProvider>` envuelve `{children}` y `<Toaster />`, `<html suppressHydrationWarning>`, `<meta name="color-scheme">`
- **`src/components/layout/dashboard-navbar.tsx`** — Toggle con dropdown (Claro / Oscuro / Sistema)
- **`src/components/ui/sonner.tsx`** — Toaster que consume `useTheme()` para heredar el tema

### Dependencia

- `next-themes` — manejo de estado de tema, localStorage, detección de sistema
- `lucide-react` — iconos Sun/Moon para el toggle

## Consequences

### Positive

- El tema sigue la preferencia del SO por defecto (`defaultTheme="system"`)
- El usuario puede sobrescribir manualmente y volver a "Sistema"
- La preferencia persiste en localStorage entre sesiones
- `suppressHydrationWarning` + script inline de next-themes previenen flash al cargar
- `disableTransitionOnChange` previene animaciones indeseadas al cambiar tema
- `<meta name="color-scheme">` asegura que scrollbars y form controls nativos sigan el tema
- Todos los componentes shadcn/ui responden automáticamente via `dark:` variants
- `@theme inline` genera utility classes (`bg-background`, `text-primary`) desde variables CSS

### Negative

- `next-themes` es una dependencia externa (aunque mantenida por el ecosistema shadcn)
- El Toaster DEBE estar dentro del ThemeProvider para recibir el contexto — si se mueve fuera, los toasts pierden el tema
- Los layouts anidados que no usan `bg-background` (colores hardcodeados) rompen la consistencia visual
- Variables duplicadas en `:root` y `.dark` requieren mantenimiento sincronizado al agregar nuevos tokens

## References

- [next-themes](https://github.com/pacocoursey/next-themes)
- [shadcn/ui Dark Mode](https://ui.shadcn.com/docs/dark-mode/next)
- [Tailwind v4 Custom Variants](https://tailwindcss.com/docs/adding-custom-styles#custom-variants)
- Skill: `.agents/skills/tailwind-v4-shadcn/`
- Issues relacionados: #88, #89, #90, #91
