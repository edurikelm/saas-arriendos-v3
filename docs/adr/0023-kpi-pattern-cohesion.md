# ADR-0023: KPI Pattern Cohesion — Introducing the Horizontal Compact Variant

## Status

Accepted

## Context

Durante el rediseño de `/support` (sesión post-Fase 2), la página necesitaba renderizar 3 KPI cards (Tickets abiertos, Resueltos, Tiempo medio de respuesta) en grid horizontal compacto. El mockup Stitch de `code.html` mostraba un patrón específico:

- Icono circular a la izquierda (`h-10 w-10 rounded-full bg-{tone}/10`)
- Label pequeño (`text-[10px] font-bold uppercase tracking-wider`)
- Valor grande a la derecha (`text-2xl font-bold tabular-nums`)

Los 3 primitives de KPI ya establecidos en el codebase son verticales:

| Primitive | Layout | Uso actual |
|---|---|---|
| `<MetricCard>` | Vertical (title + value + detail + status dot + icon) | `/admin/users/[id]` |
| `<StitchKpiCard>` | Vertical (label + value + indicator + progressBar) | `/reports`, `/dashboard` |
| `<ExecutiveKpiCard>` | Vertical (label + value + trend/sublabel) | `/payments` |

Ninguno matcheaba la forma horizontal compacta del mockup. Las opciones eran:

1. **Forzar `<MetricCard>`**: layout vertical que rompe la dirección visual del mockup.
2. **Crear primitive `<CompactKpiCard>`**: añade un 4to variant pero abstrae prematuramente (un solo consumer actual).
3. **Inline en `/support`**: trabaja para el caso actual pero no es reutilizable.

El problema subycente es la **cohesión de patrones**: con 3 primitives verticales y cero horizontales, no había precedente claro para esta forma. Sin documentación, el siguiente developer facing un mockup similar no sabría si crear un 4to primitive, forzar uno existente, o inline-copypaste.

## Decision

**Inline del patrón horizontal compacto en `/support` por ahora**, usando semantic tokens y el mismo lenguaje visual del resto de la app (sin shadow, sin hex). Documentarlo como **4ta variante de KPI** con guía explícita de cuándo usar cuál, y definir la regla para extracción a primitive (cuándo aparece un segundo consumer).

### Cuándo usar cuál (4 KPI variants)

| Variante | Layout | Cuándo usar | Ejemplo |
|---|---|---|---|
| `<MetricCard>` | Vertical, icon + status dot + detail | Admin pages con jerarquía visual fuerte | `/admin/users/[id]` |
| `<StitchKpiCard>` | Vertical, minimal + indicator + progress | Grid denso, dashboard executive summary | `/reports`, `/dashboard` |
| `<ExecutiveKpiCard>` | Vertical, trend/sublabel | Executive summaries con tendencia | `/payments` |
| **Horizontal compacto (inline)** | Horizontal, icon circular + label + value | Owner-facing pages con exactamente 3 KPI en grid compacto | `/support` |

### Reglas duras del horizontal compacto

- Container: `rounded border border-border bg-card p-4 flex items-center gap-4`
- Icon container: `h-10 w-10 shrink-0 rounded-full bg-{tone}/10 text-{tone}` con `<Icon className="size-5" />`
- Label: `text-[10px] font-bold uppercase tracking-wider text-muted-foreground`
- Value: `text-2xl font-bold tabular-nums text-foreground`
- Tonos permitidos: `warning`, `success`, `info` (semantic tokens). NO `destructive` ni `neutral` para acentos de KPI — reservados para overlays de estado críticos.
- NO `shadow-*` en el container (viola regla de sombras en superficies planas).
- NO hex (`bg-orange-50`, `text-blue-600`, etc.) — siempre vía `bg-{tone}/10` y `text-{tone}`.
- NO envolver en `<Card>` primitive — el framing ya está en las clases del container.
- NO status dot, NO `detail` debajo del value. Si necesitas jerarquía extra, usa `<MetricCard>`.

### Por qué inline en lugar de primitive

Un solo consumer actual. Extraer un primitive con prop API completa (`{ title, value, icon, tone }`) antes de tener segunda usuaria sería abstracción prematura. La regla de extracción:

> **Si una segunda pantalla pide el mismo layout, refactor a `src/components/ui/compact-kpi-card.tsx` con prop API minimal. Hasta entonces, mantener inline.**

Esta regla es similar al approach de `ReservationPill` (definido inline en `reservation-table.tsx:18-45`) — se mantiene donde se usa y se extrae solo cuando hay demanda real.

### Patrones complementarios establecidos en la misma sesión

Además del KPI horizontal compacto, la sesión `/support` también estableció:

- **Filter pills (segmented control compacto)** — sección 9 de DESIGN.md. Patrón para filtros inline de estado (3–7 opciones).
- **Row click isolation** — sección 10 de DESIGN.md. Regla de no `onClick` en `<tr>` para navegación; solo el action button navega.

Ambos están documentados como convenciones nuevas en DESIGN.md.

## Implementation

- Inline en `src/components/support/support-list.tsx:124-162` (KPI horizontal compacto) y `:168-186` (filter pills).
- Documentado en DESIGN.md:
  - Sección 8 "KPI horizontal compacto"
  - Sección 9 "Filter pills (segmented control compacto)"
  - Sección 10 "Row click isolation en tablas"
  - Tabla de primitives UI actualizada con la 4ta variante.
  - `/support` agregado a "Patrones de página" como referencia.
- Reglas #6 y #7 agregadas a "Reglas para futuros rediseños".

## Consequences

### Positive

- El KPI variant matchea el mockup Stitch exactamente sin comprometer el lenguaje visual Ocean Breeze.
- Los 4 variants cubren el espectro realista de KPI SaaS (admin hierarchy, dashboard density, executive summary, owner compact).
- La regla de extracción evita abstracción prematura (mismo approach que `ReservationPill`).
- La fila de `<tr>` sin `onClick` previene conflictos con selección de texto, doble-trigger y accesibilidad.
- El filter pill pattern replica el mockup sin violar la regla de sombras.

### Negative

- Una futura pantalla que necesite horizontal compact KPIs tiene que o inline-copypaste, o refactor primero.
- La consistencia visual entre los 4 KPI variants depende del criterio del developer al elegir — no hay enforcement automático.
- El `<tr>` sin `cursor-pointer` puede sentirse "menos interactivo" en algunos contextos; el `hover:bg-muted/30` compensa parcialmente pero requiere acostumbramiento.

### Neutral

- El conteo total de primitives se mantiene en 5 (`DataTable`, `MetricCard`, `StitchKpiCard`, `CurrencyInput`, `ReceiptUpload`). `ExecutiveKpiCard` permanece en `src/components/reports/` (no es primitive global, es específico de reports). El horizontal compacto queda inline hasta cumplir la regla de extracción.

## References

- `src/components/support/support-list.tsx` — implementación inline
- DESIGN.md secciones 8, 9, 10 — especificación operativa
- DESIGN.md "Patrones de página > `/support`" — referencia canónica
- ADR-0016: `docs/adr/0016-radius-and-control-shape-system.md` — base del lenguaje rectangular/pill
- ADR-0014: `docs/adr/0014-theme-architecture.md` — semantic tokens de `success/warning/info/destructive`