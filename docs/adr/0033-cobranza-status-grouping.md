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

### 3. El estado por fila va como `sr-only` dentro de la fila, no como `aria-label`

> **Corregido el 2026-09-02 (issue #237).** La versión original de esta sección documentaba el
> `aria-label` por fila como defecto conocido y sin arreglar. Ya está arreglado: el detalle del
> defecto se conserva abajo porque explica por qué el patrón correcto es el que hay hoy.

Cada fila es un `<Link>` cuyo contenido interno visible es cliente, monto, propiedad, tipo de
arriendo (`Teja 1 · Mensual`) y la línea de vencimiento completa (por ejemplo "2 cuotas vencidas ·
+1 vence mañana"). Ese mismo `<Link>` lleva además:

```
aria-label={`${clientName} — ${formatCLP(amount)} — ${BUCKET_LABEL[bucket]}`}
```

Un `aria-label` en un elemento no **complementa** su contenido interno como nombre accesible: lo
**reemplaza**. Por especificación de accessible name computation, cuando un elemento tiene
`aria-label`, el contenido de texto de sus descendientes deja de formar parte del nombre accesible.
El resultado es que un lector de pantalla anuncia únicamente `"<cliente> — <monto> — <bucket>"` y
**pierde** la propiedad, el tipo de arriendo y toda la línea de vencimiento de esa fila — exactamente
la información que distingue una fila de otra dentro del mismo grupo. Lo único que "sobrevive" es
una sola palabra (`Vencido` / `Vence hoy` / `Pendiente`) que el encabezado del grupo ya comunica una
vez para todas sus filas del grupo.

**Resuelto en #237.** El `aria-label` salió del `<Link>` y la palabra del bucket entró como
`<span className="sr-only">{BUCKET_LABEL[bucket]}</span>` dentro de la fila, así que el nombre
accesible se construye otra vez desde el contenido completo (estado, cliente, monto, propiedad,
tipo, vencimiento) en vez de que tres fragmentos lo reemplacen.

En el mismo cambio se arregló un segundo defecto de la misma línea de clases, previo a este ADR:
`focus-visible:outline-none` eliminaba el anillo de foco y lo reemplazaba por
`focus-visible:bg-muted/40`, que mide ~1.04:1 contra el card (WCAG 1.4.11 exige 3:1 para
indicadores no textuales) y que además es **la misma clase que `hover:`**, así que un usuario de
teclado no podía distinguir "tengo el foco acá" de "el mouse está encima". Ahora la fila lleva
`focus-visible:outline-2 focus-visible:outline-offset-[-2px]
focus-visible:outline-[color:var(--foreground)]!`. Tres decisiones, todas medidas:

- **`outline` y no `ring`**: el card tiene `overflow-hidden`, así que un ring exterior en una fila
  full-bleed se recorta en los bordes laterales. El offset negativo lo dibuja adentro.
- **Color `--foreground` y no `--ring`**: el teal de marca sobre card mide **2.28:1 en claro**
  (opaco) — falla el 3:1 de WCAG 1.4.11. `--foreground` da **16.95:1 en claro / 15.7:1 en oscuro**.
- **El `!` es necesario**: `globals.css` tiene `* { @apply outline-ring/50 }` en `@layer base`, que
  le gana a la utilidad. Sin el `!` el anillo vuelve al teal — verificado en el navegador, no
  deducido.

Ese anillo por defecto falla 1.4.11 en toda la app (1.55:1 en claro al 50% de alfa), no solo acá:
registrado aparte, fuera del alcance de este fix local.

### 4. Los subtotales de grupo cubren la ventana completa

> **Corregido el 2026-09-02 (issue #238).** La versión original de esta sección repartía cada fila
> ENTERA al grupo de su estado, lo que hacía que el encabezado "Vencidos" contara plata no vencida.
> El texto de abajo describe el comportamiento vigente; el defecto original y su razón se conservan
> al final de la sección.

`DashboardCollectionKpi` gana un campo:

```ts
windowGroups: Record<"OVERDUE" | "DUE_SOON", {
  amount: number;
  count: number;
  hiddenAmount: number;  // porción sin fila visible (truncada por collectionLimit)
  hiddenCount: number;
}>;
```

Se computa en `buildDashboardSummary` repartiendo cada fila **por cobro**, no por fila
(`windowSplitForRow`): las cuotas vencidas de la fila van a OVERDUE (`row.overdue` /
`row.overdueCount`) y las que vencen hoy o dentro de 7 días más los extras impagos van a DUE_SOON
(`row.dueSoon + row.extrasPending` / `row.dueSoonCount + row.extrasPendingCount`). Una reserva con
2 cuotas vencidas + 1 por vencer aporta 2 cobros a un grupo y 1 al otro, aunque su fila se
renderice entera bajo "Vencidos".

Los extras impagos caen en DUE_SOON porque no tienen `dueDate` — no hay forma de afirmar que están
vencidos. Su encuadre en esta ventana es una pregunta abierta aparte (issue #232).

**Invariante:** `windowGroups.OVERDUE.<f> + windowGroups.DUE_SOON.<f> === window<F>`, y además
`windowGroups.OVERDUE.count === collection.overdueInstallmentsCount` **por construcción** — el
subtítulo del header de la página y el encabezado del card leen el mismo valor, no dos agregaciones
parecidas.

**Consecuencia visual aceptada:** el subtotal de un grupo puede ser menor que la suma de las filas
que lo acompañan (la fila de arriba lleva plata que se contabilizó en el otro grupo). Lo reconcilia
la línea de vencimiento de cada fila, que ya dice "2 cuotas vencidas · +1 vence en 4 días". La
alternativa —contar la fila entera— produce un encabezado más fácil de sumar y una palabra que
miente; entre las dos, manda la palabra.

Por qué no derivarlos de `items`: `collectionItems` viene truncado a `collectionLimit` (default 4),
así que sumar los items visibles mentiría en cuanto hay más cobros de los que caben en el card. Es
exactamente el motivo por el que el footer ya usaba `windowAmount` y no la suma de `items`.

**Granularidad:** los conteos están en **cobros** (cuotas + extras), no en reservas — coherente con
el footer ("Total · 6 cobros"), e intencionalmente distintos de `overdueCount` / `dueTodayCount`,
que cuentan reservas y alimentan el tono del KPI. Una fila MONTHLY puede agrupar varias cuotas, así
que "Vencidos · 4" sobre 2 filas visibles es correcto, no un error de conteo.

**Defecto original, ya resuelto (#238): el subtotal "Vencidos" no era puro.** `sumWindowCount`/`sumWindowAmount` suman,
para cada fila de `overdueRows`, `row.overdueCount + row.dueSoonCount + row.extrasPendingCount`
(y el monto equivalente vía `amountForRow(row) = row.overdue + row.dueSoon + row.extrasPending`).
Eso significa que el encabezado **"Vencidos · N · $X" incluye cuotas que no están vencidas**: las
`dueSoon` y los extras pendientes de cualquier reserva que además tenga al menos una cuota vencida
(por eso cae en `overdueRows`). Ejemplo: una fila con 2 cuotas vencidas + 1 por vencer, más otra
fila con 1 cuota vencida, producen `Vencidos · 4`, cuando las cuotas efectivamente vencidas son 3.

Esto contrasta con el subtítulo del header de la página (`subtitleText` en `page.tsx`, "Tienes N
cuotas vencidas por $X"), que usa `collection.overdueInstallmentsCount` — suma solo
`row.overdueCount`, sin `dueSoon` ni extras — y por lo tanto **sí** es honesto. El resultado: la
misma pantalla puede mostrar dos números distintos bajo la palabra "vencido" (el subtítulo arriba,
el encabezado de grupo "Vencidos" en el card de cobranza), sin que ninguno de los dos esté mal
computado individualmente — miden cosas distintas con el mismo nombre.

Se protegió la invariante de suma y no la etiqueta: un caso de optimizar la aritmética por sobre el
significado de la palabra. El reparto por cobro descrito arriba conserva las dos.

La invariante `overdueWindow* + dueSoonWindow* === window*` (la sección 4 de más arriba) sigue
cumpliéndose y es la que este ADR protege: la partición entre los dos grupos visuales suma el total
de la ventana. Lo que **no** está protegido es que `overdueWindow*` contenga *solo* cobros vencidos.
Corregirlo requeriría separar, dentro de cada fila de `overdueRows`, el monto/cantidad estrictamente
vencido del monto/cantidad `dueSoon`/extra que esa misma fila arrastra — un cambio de `summary.ts`
fuera de alcance de este documento; queda registrado aquí como deuda, no resuelto en este cambio.

### 5. Tipo de reserva como label, nunca como color

El tipo de arriendo se muestra inline junto a la propiedad: `Teja 1 · Mensual`, `Teja 2 · Diaria`.

Es la regla que `DESIGN.md` ya fijaba en la sección Colors — *"Coastal Mist ... duración
DAILY/MONTHLY. **Diferencia DAILY vs MONTHLY por label, no por color**"*. Usar el token `info`
habría reintroducido un tercer eje cromático en la sección cuyo problema era exactamente ese.

`billingType` ya estaba disponible en `buildCollectionItem` vía `billingTypeByReservationId`, así
que no hubo consultas nuevas.

## Implementation

- `src/lib/dashboard/summary.ts` — campo `windowGroups` en `DashboardCollectionKpi`, helpers
  `windowSplitForRow` / `sumWindowSplit` / `amountForRow`, particiones `orderedWindowRows` /
  `visibleWindowRows` / `hiddenWindowRows` (el corte por `collectionLimit` alimenta tanto la lista
  visible como el `hidden*` de cada grupo, así no pueden divergir), y `billingType` en
  `DashboardCollectionItem`.
- `src/app/(dashboard)/dashboard/_components/dashboard-cobranza-list.tsx` — `GROUP_OF_BUCKET`,
  `GROUP_LABEL`, `GROUP_TEXT`, `GROUP_ORDER`, prop `groupTotals`, render agrupado. `BUCKET_TEXT` y
  el import de `ReservationPill` / `Clock` desaparecen.
- `src/app/(dashboard)/dashboard/page.tsx` — pasa `billingType` y `groupTotals`.

Un grupo se renderiza si tiene filas visibles **o** si su subtotal de ventana es > 0 (corregido en
#238: antes se exigía lo primero, así que con 4+ reservas vencidas el grupo "Por vencer"
desaparecía entero y su plata aparecía solo en el footer, sin señal de por qué). Un grupo sin filas
visibles se renderiza como encabezado + la línea "+N cobros más · $X", que enlaza a "Ver todas".
Esa misma línea aparece al pie de cualquier grupo con cobros truncados.

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
- ~~Un grupo cuyo subtotal es > 0 pero sin filas visibles no aparece.~~ Resuelto en #238: se
  renderiza como encabezado + "+N cobros más".
- ~~El subtotal del encabezado "Vencidos" no es puro.~~ Resuelto en #238 con el reparto por cobro
  (sección 4).
- El subtotal de un grupo puede ser menor que la suma de las filas visibles bajo él, porque una
  fila reparte sus cobros entre los dos grupos. Es el precio de que la palabra del encabezado sea
  verdadera; lo reconcilia la línea de vencimiento de la fila.

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
