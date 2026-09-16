# ADR-0038: Caja de reportes por día de negocio de `paidAt`

## Status

Accepted (2026-09-16)

## Context

`Payment.paidAt` es un **instante**. En Postgres es `timestamp(3)` sin zona, guardado en UTC. ADR-0020 dice
que las fechas de negocio se leen en wall-time `America/Santiago`, pero la caja de `/reports` y de
`/dashboard` no leía `paidAt` de una sola forma:

| Cifra | Cómo decidía si el pago estaba en el rango | Cómo decidía el mes |
|---|---|---|
| `collectedCash`, `byBillingType`, `byProperty` (`decision-summary.ts`, `isPaidAtInRange`) | día UTC | — |
| `cash.byMonth` (`buildMonthlyCollectedCash`) | día UTC | mes de Santiago; si no estaba entre los buckets, lo descartaba |
| `cash.byMethod` (`buildCashByMethod`) | día UTC | — |

Entre las 20:00 y las 23:59 de Santiago ya es el día siguiente en UTC. Un pago de Mercado Pago aprobado a
las 22:30 del 31 de agosto queda en `2026-09-01T02:30Z`: contaba en "Cobrado" de septiembre y, dentro de la
serie, en agosto. Así se rompía la invariante `totalCash === sum(byMonth) === sum(byMethod)` de ADR-0030.

Al reproducirlo apareció un segundo defecto. **El rango tampoco se leía de una sola forma.**
`buildMonthlyCollectedCash` calculaba los meses leyendo `rangeStart` y `rangeEnd` en Santiago, y todo lo
demás los leía por día UTC. Los callers mandaban cosas distintas:

- **`/dashboard`** (`summary.ts`): `toUtcDay(key)`, medianoche UTC. Leído en Santiago, el 1 de septiembre es
  el 31 de agosto a las 20:00, así que **un rango de septiembre devolvía una serie `[agosto, septiembre]`**,
  y el pago de las 22:30 aparecía como cobro de agosto dentro de septiembre.
- **`/reports` desde el navegador**: `startOfMonth`/`endOfMonth` de date-fns en la zona del navegador. En
  Chile, fin de septiembre es `2026-10-01T02:59:59.999Z`, que por día UTC es el 1 de octubre: la ocupación
  de septiembre se calculaba sobre **31 noches** y sumaba las estadías y el devengado del 1 de octubre.
- **`/reports` en el servidor** (`page.tsx`, primer render): `startOfMonth(new Date())` en UTC. Desde las
  20:00 o 21:00 del último día del mes, en Vercel ya es el mes siguiente.

No hay una forma de leer un `Date` que sirva para las tres: la medianoche UTC necesita el día UTC y el fin
de día del navegador chileno necesita el de Santiago. El día que eligió el navegador tampoco se puede
recuperar en el servidor.

## Decision

**El rango es un par de DÍAS, y `paidAt` entra por su día de negocio.**

### 1. `paidAt` se compara por su día en Santiago

`isPaidAtInRange(paidAt, startKey, endKey, tz)` (`src/lib/reports/revenue-series.ts`) compara
`getDateKeyInTz(paidAt)` contra las claves `YYYY-MM-DD` del rango, inclusive. Es el único criterio de rango
para caja: lo usan `collectedCash`, `byBillingType`, `byProperty`, `cash.byMonth` y `cash.byMethod`. Como la
serie agrupa por el mes de ese mismo día, un pago dentro del rango siempre tiene su bucket y las cifras
reconcilian por construcción.

### 2. Los bordes del rango son días, leídos con `dateOnlyKey`

`buildDecisionSummary`, `buildMonthlyCollectedCash` y `buildCashByMethod` leen `rangeStart` y `rangeEnd` con
`dateOnlyKey` (día UTC del `Date`), igual que la ocupación, el recorte de estadías y el devengado del mismo
módulo. El caller construye cada borde con `dateOnlyFromKey(key)` (`src/lib/domain/timezone.ts`, nuevo),
que ancla la clave a medianoche UTC. Reemplaza al `toUtcDay` privado de `summary.ts`.

Así conviven las dos clases de fecha del módulo: las estadías (`startDate`/`endDate`, date-only) se comparan
por día; `paidAt` (instante) se convierte a día de Santiago y después se compara igual.

### 3. `getDecisionSummary` recibe claves, no `Date`

`DecisionSummaryFilters` pasa de `{ rangeStart: Date, rangeEnd: Date }` a
`{ rangeStartKey: string, rangeEndKey: string }`. La server action valida `YYYY-MM-DD` y devuelve `null` si
no calza, sin consultar la base.

- **`reports-client.tsx`** arma las claves con `localDateKey`: el día que el usuario ve en su calendario,
  sea cual sea la zona del navegador.
- **`reports/page.tsx`** arma el mes en curso desde `nowKeyInBusinessTz()`, el "hoy" de Santiago, en vez de
  `startOfMonth(new Date())` del servidor.

## Consequences

### Positive

- Un pago de noche cuenta en el mismo día y en el mismo mes en todas las cifras de `/reports` y en
  "Cobrado" de `/dashboard`.
- Una serie mensual de un rango de un mes tiene un solo bucket.
- La ocupación y el devengado de `/reports` dejan de sumar el día siguiente al fin del rango cuando el
  navegador está en Chile.
- El primer render de `/reports` muestra el mes de Santiago, también de noche el último día.

### Negative

- **Contrato implícito en `Date`.** Los módulos puros siguen recibiendo `Date` para el rango, y un `Date` que
  sea un instante de Santiago (por ejemplo `endOfDayInTz`) se lee como el día siguiente. Está documentado
  en los módulos y en `dateOnlyFromKey`, pero el tipo no lo impide. No se cambió la firma a claves porque los
  tests de los dos módulos construyen el rango como `Date` (77 usos de `rangeStart`), y el borde donde se
  pierde el día, la server action, ya recibe claves.
- **Fixtures corregidos.** Cuatro tests de `revenue-series` construían el rango como instantes de Santiago
  (fin de enero = `2026-02-01T02:59:59Z`), y dos de `decision-summary` usaban `paidAt: new Date("YYYY-MM-DD")`,
  medianoche UTC, justo la forma del bug de `MarkPaidDialog` de ADR-0037. Con la regla nueva ese instante es
  el día anterior. Se reescribieron con `dateOnlyFromKey` y con `paidAt` a las 15:00 UTC.
- **El export sigue con `Date` del navegador.** `getReservationsReportCount` y
  `getReservationsReportForExport` filtran estadías con los instantes de `startOfMonth`/`endOfMonth`. En
  Chile funciona porque las estadías se guardan a las 15:00 o 16:00 UTC. Desde otra zona puede correrse un
  día. Queda fuera de este cambio.
- **Hoy no mueve cifras.** Medido en producción, ningún pago cae en la franja (sección siguiente). El
  arreglo es preventivo: el primer webhook de Mercado Pago de noche habría roto la reconciliación.

### Verificación contra producción (2026-09-16, solo lectura)

La columna no tiene zona, así que la hora de Santiago es `(col at time zone 'UTC') at time zone
'America/Santiago'`. `col at time zone 'America/Santiago'` convierte al revés.

```sql
select p.id, p.method, p.amount,
       p."paidAt"                                                    as paid_utc,
       (p."paidAt" at time zone 'UTC') at time zone 'America/Santiago' as paid_scl,
       to_char(p."paidAt", 'YYYY-MM')                                  as mes_utc,
       to_char((p."paidAt" at time zone 'UTC') at time zone 'America/Santiago', 'YYYY-MM') as mes_scl
from "Payment" p
where p.status = 'COMPLETED'
  and p."paidAt" is not null
  and p."deletedAt" is null
  and ((p."paidAt" at time zone 'UTC') at time zone 'America/Santiago')::date <> p."paidAt"::date
order by p."paidAt";
```

Las filas son los pagos cuyo día cambia con este ADR, y las que tienen `mes_utc <> mes_scl` son las que movían
cifras entre meses. **Devolvió 0 filas.** Hay 12 pagos `COMPLETED` no borrados (10 CASH y 1 TRANSFER de
arriendo, 1 CASH extra), entre el 28 de agosto y el 9 de septiembre, **todos a las 15:00 o 16:00 UTC**:
ninguno entre las 00:00 y las 03:59 UTC. Las 6 cuotas que `MarkPaidDialog` había guardado a medianoche UTC
ya estaban corregidas por la migración de ADR-0037, y todavía no hay pagos de Mercado Pago. La misma consulta
sirve para revisar la franja cuando lleguen los primeros webhooks.

## Related

- ADR-0020: día de negocio en `America/Santiago`.
- ADR-0028: `paidAt` como base de caja.
- ADR-0030: la invariante `totalCash === sum(byMonth) === sum(byMethod)`.
- ADR-0037: `paidAt` manual al mediodía de Santiago; dejó esto pendiente.
- Tests: `src/lib/reports/__tests__/paid-at-business-day.test.ts`,
  `src/lib/actions/__tests__/reports-decision-summary-range.test.ts`.
