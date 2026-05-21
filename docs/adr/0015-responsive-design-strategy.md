# ADR-0015: Estrategia de Diseño Responsive

## Status

Aceptado

## Context

RentalPro necesita adaptarse correctamente a todas las resoluciones: móvil (320px+), tablet (640px-1024px), y desktop (1024px+). Se detectaron 7 áreas con problemas de responsividad: formularios de auth con ancho fijo, calendario con celdas demasiado grandes, diálogo de detalle de reserva que desborda, página de reportes con filtros que no envuelven, tablas sin scroll horizontal, y barras de búsqueda/filtro con anchos fijos.

Se evaluaron dos enfoques:
1. **Adaptive design** — vistas separadas para mobile y desktop (ej: calendario grid → lista)
2. **Responsive design** con Tailwind — una sola vista que se adapta con breakpoints

## Decision

Usar **Tailwind CSS v4 responsive utilities** con enfoque **mobile-first**. Una sola vista que se adapta con breakpoints. El calendario mantiene grid de 7 columnas en todas las resoluciones (no cambia a lista).

### Breakpoints estándar de Tailwind

| Prefijo | Min-width | Dispositivo típico |
|---------|-----------|---------------------|
| (base)  | 0px       | Móvil portrait      |
| `sm`    | 640px     | Móvil landscape / tablet pequeño |
| `md`    | 768px     | Tablet              |
| `lg`    | 1024px    | Desktop             |
| `xl`    | 1280px    | Desktop grande      |

### Patrones obligatorios

#### Tablas
Toda tabla DEBE estar envuelta en `<div className="overflow-x-auto">`. No se esconden columnas en mobile — el scroll horizontal es preferible a perder información.

#### Barras de filtro
Los filtros se apilan verticalmente en mobile y se alinean horizontalmente en desktop:
`flex flex-col sm:flex-row sm:items-center gap-2`

Inputs y selects usan `w-full sm:w-auto` para ocupar el ancho completo en mobile.

#### Diálogos
Todo `DialogContent` debe usar `w-[95vw]` como ancho base + `max-w-{tamaño}` apropiado:
- Formularios complejos (propiedades, reservas): `max-w-2xl`
- Formularios simples (clientes, pagos): `max-w-sm` o `max-w-md`
- Detalle de reserva: `max-w-2xl`

#### Grids de cards
Progresión estándar: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` o `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` según densidad.

#### Sidebar/Layout
El patrón de sidebar con toggle en mobile (`lg:hidden` hamburger + `lg:pl-64` offset) ya está implementado en `DashboardLayoutClient` y `AdminLayoutClient`. Se mantiene sin cambios.

#### Calendario
El grid de 7 columnas se mantiene. Las celdas reducen su altura mínima progresivamente: `min-h-12 sm:min-h-20 lg:min-h-24`. Las labels de reserva se truncan a ~6 caracteres en mobile y muestran nombre completo en `sm+`.

## Implementation

Los 7 issues de implementación están en GitHub:
- [#102](https://github.com/edurikelm/saas-arriendos-v3/issues/102): Auth forms
- [#103](https://github.com/edurikelm/saas-arriendos-v3/issues/103): Calendar grid
- [#104](https://github.com/edurikelm/saas-arriendos-v3/issues/104): Reservation detail dialog
- [#105](https://github.com/edurikelm/saas-arriendos-v3/issues/105): Dialogs + minor polish
- [#106](https://github.com/edurikelm/saas-arriendos-v3/issues/106): Reports page
- [#107](https://github.com/edurikelm/saas-arriendos-v3/issues/107): Dashboard Variant C
- [#108](https://github.com/edurikelm/saas-arriendos-v3/issues/108): List page filters

Archivos principales a modificar (~17 archivos en `src/components/` y `src/app/`).

## Consequences

### Positive
- Una sola codebase, sin bifurcaciones mobile/desktop
- Las utilidades responsive de Tailwind son declarativas y predecibles
- El patrón `overflow-x-auto` en tablas preserva toda la información
- Los diálogos con `w-[95vw]` nunca desbordan el viewport
- El grid del calendario se mantiene consistente visualmente

### Negative
- El scroll horizontal en tablas puede ser menos usable que esconder columnas
- El grid de 7 columnas del calendario es denso en pantallas < 360px
- Requiere disciplina: todo componente nuevo debe seguir estos patrones
