# ADR-0035: `/reports` — un solo alcance por cifra

## Status

Accepted (2026-09-12)

## Context

`/reports` había crecido a diez bloques con alcances contradictorios entre sí, sin que la UI
declarara cuál era cuál.

El síntoma más grave: dos de los cuatro KPIs del encabezado — **"Total por Cobrar"** y **"Cobros
Vencidos"** — no salían del rango de fechas del encabezado. Salían de `sumCollectionTotals` sobre
el conjunto que dejaban los selectores de la sección de cobranza, ~800px más abajo en la misma
página. Mover el filtro de esa tabla movía los KPIs de arriba; cambiar el rango de fechas de arriba
no los movía a ellos. Un banner de la propia página afirmaba explícitamente lo contrario — que los
4 KPIs respondían al rango (ADR-0028, punto 4) —, así que el bug no era solo de datos: era un
documento mintiéndole al usuario sobre su propio comportamiento.

Bajo el mismo selector de fechas único convivían, sin distinguirse, cuatro definiciones distintas
de "plata":

1. **Caja del rango** por `paidAt` (`collectedCash`).
2. **Deuda de hoy**, sin rango — los dos KPIs de cobranza descritos arriba.
3. **Saldo pendiente** descontando pagos históricos completos (`outstandingBalance`), que tampoco
   se limita al rango aunque viviera junto a cifras que sí.
4. **Año calendario** — la card de resumen anual con su sparkline, que ignoraba el filtro por
   completo y mostraba siempre el año en curso.

Nada en la página decía cuáles de estas cifras respondían al selector de fechas del encabezado y
cuáles no. El owner no tenía forma de saber, mirando la pantalla, si cambiar el rango iba a mover
el número que tenía enfrente.

## Decision

**En `/reports`, todo número obedece al rango de fechas del encabezado, o declara en su propio
rótulo que es una foto del presente. No hay tercera opción.** Un bloque que no pueda cumplir
ninguna de las dos no va en esta página.

### Estructura resultante: tres secciones

1. **Resultado del período** — todo obedece al rango + propiedad del encabezado: Cobrado
   (`collectedCash`), Facturado del período (`accruedRevenue`), Tasa de cobranza, cobrado por mes,
   reparto diario/mensual, tabla por propiedad.
2. **Dónde está la plata que falta** — foto del **presente**, rotulada como tal en su propio
   subtítulo ("Foto del presente — no cambia con el rango de fechas de arriba"): antigüedad de la
   deuda activa hoy y top deudores. No hay ambigüedad posible porque el rótulo está al lado del
   número.
3. **Llevarse el período** — export Excel/PDF de las reservas del rango.

Cualquier bloque que no encajara en ninguna de las dos reglas se eliminó (ver más abajo), en vez de
forzarlo a una tercera categoría.

### La tasa de cobranza compara dos bases contables a propósito

`computeCollectionRate` (`src/lib/reports/collection-rate.ts`): `collectedCash / accruedRevenue`.

- **Numerador** — `collectedCash`: caja del rango, por `paidAt` (cuándo entró el dinero).
- **Denominador** — `accruedRevenue`: devengado del rango, prorrateado por noches para `DAILY`
  (`prorateRevenueToRange`) o por cuotas de mes calendario para `MONTHLY`
  (`prorateMonthlyRevenueToRange`) — mismas funciones de `kpis.ts` que ya usa el KPI "Revenue
  Proyectado" de `/calendar` (ver CONTEXT.md).

**No son la misma base contable**, y esto es deliberado, no un descuido: un prepago cobrado dentro
del rango pero devengado en un rango futuro cuenta como caja hoy, así que el resultado puede
superar 100%. La función **no clampea** — el valor real se muestra tal cual, y la UI (`sublabel` en
`PeriodResultKpis`) está **obligada** a explicar la diferencia de bases junto a la cifra; no es una
aclaración opcional.

`accruedRevenue` excluye reservas `CANCELLED`, igual que `outstandingBalance` y la ocupación
(ADR-0029). Se agrega como campo nuevo de `ReportDecisionSummary` (antes no existía a nivel
período/propiedad/billing type; solo existía como building block interno).

Esta es la parte más discutible del rediseño: se acepta un indicador que puede leerse como "más del
100% de lo debido cobrado", con el costo de que un lector apurado lo malinterprete si ignora el
sublabel. Se prefirió eso a clampear (que ocultaría el prepago) o a forzar una única base contable
(que rompería la utilidad de comparar caja real contra devengo real — la pregunta que la cifra
existe para responder).

## Implementation

**Eliminado y por qué:**

- **Tabla de cobranza paginada** (con sus filtros de `billingType`, `clientId`, `debtStatus`,
  rango de vencimiento) — duplicaba `/payments` con menos filtros y sin filas accionables, y era la
  fuente directa del bug de KPIs cruzados descrito en Context.
- **Card de resumen anual + sparkline** — ignoraba el filtro de fechas, y el año ya es un rango
  elegible en el selector rápido (`year_to_date`); mantenerla era una segunda respuesta a la misma
  pregunta.
- **Las dos cards de modelo de negocio** (DAILY vs. MONTHLY como cards separadas) — una fila entera
  de pantalla para partir un número en dos; se reemplazan por `BillingTypeSplit`, un componente
  compacto dentro de "Resultado del período".
- **`src/app/api/reports/collection/route.ts`** — ruta huérfana, sin consumidores.
- **Tope de 100 filas en la exportación PDF** — se midió que `jspdf-autotable` pagina automáticamente
  sobre cualquier cantidad de filas, así que el tope no protegía nada; solo truncaba exportaciones
  legítimas.
- **`getCollectionReport`** — la server action paginada de cobranza, con `CollectionReportFilters`.
  Tras eliminar la tabla no tenía consumidor de UI: el mismo motivo por el que se borró la ruta de
  API. La invariante de ADR-0028 §3 (los totales agregan el conjunto completo, nunca una página) no
  se perdió: su test se migró a `getOutstandingSnapshot`.
- **`cash.annual` en `ReportDecisionSummary`** (y el parámetro `annualYear`) — nadie la consumía
  tras quitar la card anual, pero `buildDecisionSummary` la calculaba en cada llamada, y la página
  llama dos veces por cambio de filtro (período actual y anterior). Se reemplaza por
  `cash.byMethod` del rango (ver abajo). `buildAnnualCollectedCash` y `getYearlySummary` siguen
  existiendo; hoy solo los usan sus tests.

**Nuevo:**

- `src/lib/reports/collection-rate.ts` — `computeCollectionRate` (ver arriba).
- `src/lib/reports/format.ts` — `formatPeriodRangeLabel` (etiqueta factual del rango del encabezado)
  y `monthKeyLabel`.
- `src/lib/reports/collection.ts` — `buildAgingBuckets` (agrupa `CollectionReportRow[]` en tramos de
  antigüedad: vence en 7 días, vencido 1–30 / 31–60 / 60+ días) y `daysOverdueForRow` (días de
  atraso de una fila respecto de "hoy", wall-time `America/Santiago`, ADR-0020).
- `src/lib/reports/trend.ts` — `selectTopClientDebtors` (agrupa filas de cobranza por cliente y
  devuelve los N con mayor deuda, con contexto de propiedad y billing type de su deuda más grande).
- `src/lib/reports/revenue-series.ts` — `buildCashByMethod`: caja del rango por método de pago, con
  el mismo predicado `isEligibleCashPayment` que produce `collectedCash` y `cash.byMonth`.
  Invariante con test: `sum(cash.byMethod) === collectedCash`, incluidos pagos de reservas
  canceladas. Alimenta una sección "Por método de pago" en el Excel y en el PDF: la card anual era el
  único lugar donde se veía ese desglose, y el export es donde lo busca quien cierra el mes con el
  contador.
- Componentes de sección: `period-result-kpis.tsx`, `monthly-cash-chart.tsx`,
  `billing-type-split.tsx`, `property-summary-table.tsx`, `aging-buckets-panel.tsx`,
  `top-client-debtors-list.tsx` (`src/components/reports/`).

La sección "Dónde está la plata que falta" necesita el universo **completo** de deuda activa, no una
porción paginada pensada para una tabla que ya no existe. Ese agregado se calcula **en el servidor**,
vía `getOutstandingSnapshot` (`src/lib/actions/reports.ts`), que devuelve solo
`{ aging, topDebtors, totals }` — nunca las filas.

La primera versión de este rediseño pedía el conjunto entero de `CollectionReportRow` al cliente
(con un límite artificial de 10.000) y reducía ahí los 4 tramos y los 5 nombres. Funcionaba, y con
las pocas reservas que hay hoy en producción no se habría notado nunca — que es exactamente por qué
había que atraparlo leyendo y no probando: un owner con cientos de reservas activas cruzaría el
límite servidor→cliente con cientos de objetos de ~17 campos para dibujar cuatro barras.

`getOutstandingSnapshot` arma las filas con el helper interno `loadCollectionReportRows` — una sola
consulta Prisma y un solo `buildCollectionReportRows`, fijo en deuda activa de ambos tipos de
arriendo, que es lo único que la sección necesita.

`getOutstandingSnapshot` toma `now` **una sola vez** y lo pasa explícito a `buildAgingBuckets` y a
`selectTopClientDebtors`, así ambos agregados usan el mismo instante y el cálculo de atraso ocurre
en el servidor en wall-time `America/Santiago` (ADR-0020), sin depender del reloj del browser.

## Consequences

### Positive

- Cada cifra de la página tiene un alcance verificable con solo mirar su rótulo. Ya no hay una
  cifra que cambie con un filtro que el usuario no está mirando.
- El bug de origen (KPIs de cobranza atados a filtros de una tabla 800px más abajo) desaparece
  estructuralmente: esa tabla ya no existe.
- Menos superficie de mantenimiento: una tabla paginada, una card anual y dos cards de modelo de
  negocio salen del código.
- La exportación PDF deja de truncar en 100 filas sin necesidad.

### Negative

- La Tasa de cobranza puede mostrar >100%, lo cual es correcto pero exige que el sublabel se lea —
  un dashboard consumido de reojo puede malinterpretarlo como error de cálculo.
- Quien quería filtrar cobranza por `billingType`/`clientId`/rango de vencimiento en `/reports`
  pierde esa combinación específica; el camino equivalente es `/payments`, que ya cubre ese caso de
  uso con más filtros y filas accionables.
- **Se pierde el desglose por tipo de arriendo más allá de la caja.** Las cards eliminadas mostraban,
  por `DAILY` y `MONTHLY` por separado: `outstandingBalance`, `occupancyRate`,
  `occupiedNightUnits/capacityNightUnits`, `reservationCount` y `cancelledCash`. `BillingTypeSplit`
  solo muestra `collectedCash`. Un owner que se preguntaba "¿cuánta de mi deuda o de mi ocupación es
  diaria vs. mensual?" hoy no tiene dónde verlo: `/payments` filtra por tipo pero no agrega
  ocupación, y `/calendar` no desglosa ocupación por tipo. Se aceptó porque esas cinco cifras ×2
  costaban una fila entera de pantalla en la sección de resultado, y porque el desglose por
  propiedad —que sí se conserva— responde la pregunta operativa más frecuente. Los datos siguen
  calculados en `byBillingType`: si la pregunta reaparece, la superficie se puede devolver sin
  tocar dominio.
- La Sección 2 depende de una segunda server action (`getOutstandingSnapshot`) con su propio estado
  de carga, separada del resumen del período. Son dos viajes en vez de uno, a cambio de que cambiar
  el rango no recalcule la deuda (que no depende del rango) y de que la deuda no viaje como filas.

## Related

- ADR-0028 — semántica de KPIs financieros de `/reports`. Sigue vigente para "Ingresos cobrados",
  ocupación y `paidAt` como base cash. El punto 4 ("`propertyId` afecta los 4 KPIs") queda obsoleto
  en su forma original porque los KPIs de cobranza que citaba ya no existen como tabla filtrable;
  `propertyId` ahora afecta la Sección 1 completa vía `getDecisionSummary`, y la Sección 2 por
  separado vía `getOutstandingSnapshot`. El punto 3 sigue vigente: su invariante ahora se prueba
  sobre `getOutstandingSnapshot`.
- ADR-0029 — `ReportDecisionSummary`. Ninguna semántica de dominio cambia; este ADR agrega
  `accruedRevenue` como campo de primer nivel (período, billing type, propiedad).
- ADR-0030 — series de ingresos cash-basis. `cash.byMonth` es la fuente del gráfico "Cobrado por
  mes" de la Sección 1, sin cambios. `cash.annual` sale de `ReportDecisionSummary` y entra
  `cash.byMethod` del rango, bajo el mismo predicado cash-basis.
- `CONTEXT.md` — sección "Reportes".
