# ADR-0033: Cobranza del dashboard — estado por grupo, no por fila

## Status

Accepted (2026-08-31)

## Context

La sección "Cobros pendientes" de `/dashboard` (`DashboardCobranzaList`) codificaba el estado de
cobranza **tres veces en la misma fila y en el mismo color**:

1. El texto de vencimiento teñido con `BUCKET_TEXT[bucket]`.
2. El monto teñido con el mismo `BUCKET_TEXT[bucket]`.
3. Un `<ReservationPill>` con label (`VENCIDO` / `PENDIENTE`), fondo, borde y punto del mismo tono.

Más un chip ámbar (`border-warning/25 bg-warning/10`) para el sufijo "+N por vencer". En el caso
real de 4 filas eso dejaba **~7 zonas cromáticas en un card de ~266px de ancho** (la columna
`lg:col-span-1` de la grilla de 4 a 1440px). El usuario reportó la sección como "muy saturada de
colores e información que puede llegar a confundir al cliente".

Dos consecuencias concretas, más allá de lo estético:

- **El monto perdió su canal de lectura.** Teñir el monto con el color del bucket lo hacía cambiar
  de color por fila, así que la columna de dinero — el dato que el dueño compara *entre* filas —
  dejaba de ser escaneable como columna.
- **La redundancia no aportaba información.** La lista ya llega ordenada por urgencia desde
  `buildDashboardSummary` (OVERDUE → DUE_TODAY → UPCOMING_7D). Repetir la urgencia en una pill por
  fila codificaba de nuevo algo que el orden ya decía.

Además, el uso de `<ReservationPill>` fuera de la tabla de reservas contradecía la regla ya
documentada en `DESIGN.md` ("Do usar `<ReservationPill>` solo dentro de la tabla de reservas").

En paralelo, el dueño no tenía forma de distinguir en esta sección si un cobro correspondía a una
reserva **diaria** o **mensual** — el dato que explica por qué una fila puede agrupar varias cuotas
y otra no.

## Decision

**El estado de cobranza se expresa una sola vez, en el encabezado del grupo que contiene la fila.**

### 1. Agrupación por urgencia

La lista se agrupa en **dos** grupos visuales, no tres:

| Grupo       | Buckets de dominio          | Token de color            |
|-------------|-----------------------------|---------------------------|
| `OVERDUE`   | `OVERDUE`                   | `text-destructive`        |
| `DUE_SOON`  | `DUE_TODAY`, `UPCOMING_7D`  | `text-warning-foreground` |

Los tres buckets sobreviven en el dato (`DashboardCollectionBucket`) porque describen tres estados
distintos del dominio; la UI los colapsa en dos. La distinción entre "vence hoy" y "vence en N
días" la carga el **texto de vencimiento de cada fila** ("Vence hoy · 27 ago" vs "Vence en 2 días ·
2 sept"), que es más preciso que un encabezado. Un tercer grupo para 4 filas visibles suma más
encabezado que información.

Esto extiende la decisión que ya vivía en el componente antes de este ADR ("dos colores, no tres":
`UPCOMING_7D` mapeaba a `warning`, no a `info`, porque un cobro que vence en 5 días sigue siendo
una acción pendiente y no un dato de contexto).

### 2. Las filas no llevan color

Ninguna fila lleva pill, monto teñido ni chip de color. El monto vuelve a `text-foreground` y el
texto de vencimiento a `text-muted-foreground`. Resultado: **2 bandas de color en todo el card**,
una por encabezado de grupo.

El `<ReservationPill>` desaparece de este componente, resolviendo el drift con `DESIGN.md`.

### 3. El estado exacto sobrevive para lectores de pantalla

El `aria-label` de cada fila conserva el label del bucket original — incluida la distinción
"Vence hoy" vs "Pendiente" que el encabezado fusiona:

```
`${clientName} — ${formatCLP(amount)} — ${BUCKET_LABEL[bucket]}`
```

Un lector de pantalla recibe el estado exacto sin depender de haber leído el encabezado del grupo.

### 4. Los subtotales de grupo cubren la ventana completa

`DashboardCollectionKpi` gana cuatro campos:

```ts
overdueWindowAmount: number;
overdueWindowCount: number;
dueSoonWindowAmount: number;
dueSoonWindowCount: number;
```

Se computan en `buildDashboardSummary` con **las mismas dos expresiones** que `windowAmount` /
`windowCount` (`amountForRow(row)` y `row.overdueCount + row.dueSoonCount +
row.extrasPendingCount`), sobre las particiones `overdueRows` y `dueSoonRows = [...dueTodayRows,
...upcoming7dRows]`.

**Invariante:** `overdueWindow* + dueSoonWindow* === window*`.

Por qué no derivarlos de `items`: `collectionItems` viene truncado a `collectionLimit` (default 4),
así que sumar los items visibles mentiría en cuanto hay más cobros de los que caben en el card. Es
exactamente el motivo por el que el footer ya usaba `windowAmount` y no la suma de `items`.

**Granularidad:** los conteos están en **cobros** (cuotas + extras), no en reservas — coherente con
el footer ("Total · 6 cobros"), e intencionalmente distintos de `overdueCount` / `dueTodayCount`,
que cuentan reservas y alimentan el tono del KPI. Una fila MONTHLY puede agrupar varias cuotas, así
que "Vencidos · 4" sobre 2 filas visibles es correcto, no un error de conteo.

### 5. Tipo de reserva como label, nunca como color

El tipo de arriendo se muestra inline junto a la propiedad: `Teja 1 · Mensual`, `Teja 2 · Diaria`.

Es la regla que `DESIGN.md` ya fijaba en la sección Colors — *"Coastal Mist ... duración
DAILY/MONTHLY. **Diferencia DAILY vs MONTHLY por label, no por color**"*. Usar el token `info`
habría reintroducido un tercer eje cromático en la sección cuyo problema era exactamente ese.

`billingType` ya estaba disponible en `buildCollectionItem` vía `billingTypeByReservationId`, así
que no hubo consultas nuevas.

## Implementation

- `src/lib/dashboard/summary.ts` — 4 campos nuevos en `DashboardCollectionKpi`, helpers
  `sumWindowAmount` / `sumWindowCount` (extraídos de las expresiones inline previas de
  `windowAmount` / `windowCount`, sin cambiar su valor), partición `dueSoonRows`, y `billingType`
  en `DashboardCollectionItem`.
- `src/app/(dashboard)/dashboard/_components/dashboard-cobranza-list.tsx` — `GROUP_OF_BUCKET`,
  `GROUP_LABEL`, `GROUP_TEXT`, `GROUP_ORDER`, prop `groupTotals`, render agrupado. `BUCKET_TEXT` y
  el import de `ReservationPill` / `Clock` desaparecen.
- `src/app/(dashboard)/dashboard/page.tsx` — pasa `billingType` y `groupTotals`.

Un grupo se renderiza **solo si tiene filas visibles**. Como `items` llega ordenado por urgencia y
truncado después, un grupo sin filas visibles no recibe encabezado aunque su subtotal sea > 0; ese
remanente sigue contado en el footer y accesible vía "Ver todas".

`groupTotals` es opcional: sin él, los subtotales se derivan de los items visibles (back-compat con
el resto de props del componente, que siguen el mismo patrón).

## Consequences

### Positive

- El card pasa de ~7 zonas de color a 2. La sección deja de competir consigo misma por atención.
- La columna de montos vuelve a ser escaneable (todos `text-foreground`, `tabular-nums`,
  alineados a la derecha).
- El dueño ve el subtotal por urgencia sin sumar mentalmente, y los subtotales cuadran con el
  footer por construcción.
- Se resuelve el drift de `<ReservationPill>` fuera de la tabla de reservas.
- El tipo de reserva entra sin costo cromático.

### Negative

- Con `collectionLimit = 4`, en el peor caso 2 encabezados sobre 4 filas es overhead vertical.
  Aceptado: cada encabezado es una línea de 10px y aporta el subtotal.
- El conteo del encabezado (cobros) no es comparable con la cantidad de filas visibles (reservas).
  Es correcto pero requiere el modelo mental "una fila puede agrupar varias cuotas" — el mismo que
  el componente ya exponía con "2 cuotas vencidas".
- Un grupo cuyo subtotal es > 0 pero sin filas visibles no aparece. Mitigado por el footer y
  "Ver todas".

### Deuda registrada (no resuelta acá)

`--destructive` en light mode es `oklch(0.6368 0.2078 25.3313)` = `#ef4444`, que sobre `--card`
(blanco) mide **3.76:1** — bajo el mínimo WCAG AA de 4.5:1 para texto normal. El sistema ya resuelve
esto para los otros tres tonos semánticos (`--success-foreground`, `--warning-foreground`,
`--info-foreground` son todos `oklch(0.30 0.1x <hue>)`), pero `--destructive-foreground` rompe el
patrón: es blanco, porque `destructive` es el único tono que además se usa como fondo relleno.

Es previo a este ADR y sistémico (`text-destructive` aparece en 56 archivos de `src/**/*.tsx`).
Este cambio **reduce** la superficie afectada en esta sección de ~8 elementos por card a 1, pero no
lo elimina. Dark mode pasa (4.57:1 sobre `#0d1c2d`), igual que el ámbar en ambos temas (13.93:1 en
light, 10.67:1 en dark).

Registrado en **issue #235** con la medición, el token propuesto (`--destructive-text`,
`oklch(0.55 0.19 25.3313)` = `#c92f32`, 5.35:1 sobre blanco) y el script de verificación. No se
resuelve acá porque agregar un token global excede el alcance de esta sección.

## Related

- ADR-0020 — fechas de negocio en `America/Santiago` (los buckets se calculan en wall-time SCL).
- ADR-0024 — consolidación de KPIs; precedente de "un primitive único, no variantes paralelas".
- ADR-0028 — semántica de KPIs financieros (`collection`, `totalToCollect`).
- `DESIGN.md` — "The Status Color Doctrine" y "The Grouped Status Rule".
- Issue #235 — contraste sub-AA de `text-destructive` en light mode (deuda registrada arriba).
