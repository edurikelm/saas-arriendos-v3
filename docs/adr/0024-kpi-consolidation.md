# ADR-0024: KPI Consolidation — Single `<KpiCard>` Primitive

## Status

Accepted (supersedes ADR-0023)

## Context

ADR-0023 estableció mantener 4 variantes de KPI coexistiendo. En la práctica esto generó drift:
- `/support` recién adoptó un 4to patrón (horizontal compacto inline) documentado como sección 8.
- `/admin` y `/admin/users/[id]` usan `MetricCard` con icon + status dot.
- `/payments` usa `ExecutiveKpiCard` con trend/sublabel/tone.
- `/dashboard`, `/reports`, `/calendar-view` usan `StitchKpiCard` o `ExecutiveKpiCard` sin icon.

Cada primitive aporta valor distinto pero la decisión de "¿cuál uso acá?" recae en el developer y produce inconsistencias visuales (ej: `text-3xl` en admin vs `text-xl` en reports). El usuario aprobó consolidar a un único primitive con API que absorba lo mejor de los 3.

## Decision

Adoptar **`<KpiCard>` como primitive único y obligatorio** para todo KPI del producto, ubicado en `src/components/ui/kpi-card.tsx`. Borrar `StitchKpiCard`, `MetricCard` y `ExecutiveKpiCard`.

### API consolidada

```tsx
<KpiCard
  label="..."
  value="..."
  unit="..."
  icon={LucideIcon}              // opcional
  tone="default" | "success" | "info" | "warning" | "destructive"
  indicator={{ text, variant: "positive" | "warning" | "neutral" }}
  progressBar={{ value: 0-100 }}
  sublabel="..."                 // opcional
/>
```

### Tonos

- `default` → icon container `bg-muted text-muted-foreground`, value `text-foreground`.
- `success` / `info` → icon container `bg-{tone}/10 text-{tone}`, value `text-foreground` (no colorea el número).
- `warning` / `destructive` → icon container `bg-{tone}/10 text-{tone}`, value text coloreado también (`text-warning` / `text-destructive`).

### Layout

```
┌──────────────────────────────────┐
│ LABEL            ┌─────────────┐ │
│ uppercase 10px   │  [icon]     │ │  ← size-9 rounded-xl, esquina superior derecha
│                  └─────────────┘ │
│ $1.234.567                       │  ← text-xl font-bold
│ ↑ +12% vs mes anterior           │  ← indicator (opcional)
│ ▓▓▓▓▓▓▓░░░░░░ 64%               │  ← progressBar (opcional)
└──────────────────────────────────┘
```

Container: `rounded-lg border border-border bg-card p-4` (sin shadow).

## Implementation

- Nuevo file: `src/components/ui/kpi-card.tsx` con la API arriba.
- Migración de 7 consumers: `dashboard/page.tsx`, `reports/page.tsx`, `payments-kpis.tsx`, `calendar-view.tsx`, `admin/page.tsx`, `admin/users/[id]/page.tsx`, `support-list.tsx`.
- Borrado de 3 primitives viejos: `stitch-kpi-card.tsx`, `metric-card.tsx`, `executive-kpi-card.tsx`.
- DESIGN.md actualizado (sección 7 sobre `<KpiCard>`, eliminación de §8 horizontal compacto, referencias).

## Consequences

### Positive

- 1 primitive = 1 API = 1 fuente de verdad. Elimina drift y la pregunta "¿cuál uso?".
- API cubre la unión de features: icon (de MetricCard), indicator/progressBar (de StitchKpiCard), tone/sublabel (de ExecutiveKpiCard).
- Iconos opcionales permiten enriquecer visualmente `/dashboard`, `/reports`, `/payments`, `/calendar-view` sin obligar a quienes quieran minimal.
- ADR-0023 queda formalmente superseded.

### Negative

- `/support` pierde el layout horizontal compacto del mockup Stitch (regresión visual aceptada por el usuario).
- `/admin` y `/admin/users/[id]` pierden el status dot (regresión visual aceptada por el usuario).
- Tests existentes que dependen de `MetricCard` import deben actualizarse (audit + migración).
- Si el usuario después decide recuperar el status dot o el horizontal compacto, hay que re-discutir el contrato del primitive (no es trivial).

### Neutral

- `MetricCard` y `ExecutiveKpiCard` se borran. `StitchKpiCard` también (era el primitive más usado pero el nombre "Stitch" era engañoso post-consolidación).

## References

- `src/components/ui/kpi-card.tsx` — primitive nuevo
- DESIGN.md sección 7 — especificación operativa
- ADR-0023 (superseded): `docs/adr/0023-kpi-pattern-cohesion.md`
- Stitch project `projects/1529269251022042678` — fuente visual original
