# Plan de mejora — `/dashboard`

**Fecha**: 2026-08-24
**Alcance**: `src/app/(dashboard)/dashboard/page.tsx` (601 líneas) + sus `_components` + los datos que consume.
**Estado**: propuesta (input para issues; no implementado).

## Objetivo

Responder: *¿qué necesita ver un OWNER al abrir `/dashboard` para operar su día, y qué falla hoy?*

El dashboard es el home diario del anfitrión. Según `PRODUCT.md`, entra "a actuar, no a entretenerse", y las tres preguntas que trae en la cabeza son:

1. **¿Quién llega y quién sale hoy?** (operación)
2. **¿Quién me debe y a quién le cobro ahora?** (plata)
3. **¿Cómo voy este mes?** (negocio)

La página ya tiene la estructura correcta para eso (KPIs → próximas reservas + cobranza → franja de ocupación). El problema no es el layout: **es que los números que muestra son falsos, y que la página informa pero no deja actuar.**

---

## Resumen ejecutivo

| # | Hallazgo | Severidad | Efecto para el cliente |
|---|---|---|---|
| C1 | Todos los KPIs se calculan sobre **solo 10 reservas** | 🔴 Crítico | Ingresos, ocupación, pendientes y cobranza están mal en cuanto el owner pasa de 10 reservas |
| C2 | El contador de vencidos y el monto de vencidos vienen de **poblaciones distintas** | 🔴 Crítico | "Tienes 3 cobros vencidos por $0" es un estado alcanzable |
| C3 | Los pagos que **vencen hoy** no aparecen en Cobros pendientes | 🔴 Crítico | Se pierde el cobro más accionable del día |
| C4 | "Ingresos Mensuales" no respeta la semántica de ADR-0028 | 🟠 Alto | El dashboard y `/reports` muestran cifras distintas del mismo mes |
| E1 | No existe bloque **"Hoy"** (check-ins / check-outs del día) | 🟠 Alto | La pregunta #1 del owner requiere leer una tabla |
| E2 | Cero acciones desde el dashboard (no se puede cobrar, marcar pagado ni contactar) | 🟠 Alto | Todo termina en un click de salida a otra página |
| E3 | No hay estado vacío / onboarding para cuenta nueva | 🟠 Alto | Primer login = 4 ceros y tres cajas vacías |
| E4 | Reservas **PENDING sin confirmar** no tienen señal propia | 🟡 Medio | Reservas se caen por falta de seguimiento |
| Q1 | Sin `loading.tsx` (la página bloquea entera) | 🟡 Medio | Navegación se siente colgada |
| Q2 | Reservas MONTHLY excluidas de la tabla sin señal en los KPIs | 🟡 Medio | Un owner 100% mensual ve una tabla vacía todo el tiempo |
| Q3 | Componentes muertos y a11y del progress bar | 🟢 Bajo | Deuda |

---

## Parte 1 — Los números están mal (bloqueante)

### C1 · El dashboard entero se calcula sobre 10 reservas

`page.tsx:126` llama `getReservations()` **sin parámetros**. En `src/lib/actions/reservations.ts:46` eso resuelve a `limit = 10`, `page = 1`, con `orderBy: { startDate: "desc" }` (`reservations.ts:122`).

Es decir: el dashboard ve **las 10 reservas con fecha de inicio más lejana en el futuro**, y sobre ese subconjunto calcula *todo*:

- `monthlyIncome` (`page.tsx:221`) — los pagos cobrados este mes pertenecen sobre todo a estadías **pasadas o en curso**, que son justamente las que el `desc` deja fuera. El KPI de ingresos está sistemáticamente subvaluado.
- `pendingPaymentsList` / `overdueCount` (`page.tsx:255`) — una deuda vencida vive en una reserva vieja. **Las cobranzas vencidas son casi invisibles**: la funcionalidad de cobranza falla en silencio.
- `occupancyRate` (`page.tsx:270`) — el denominador (`totalUnits`) sí usa **todas** las propiedades (`getProperties` no pagina), pero el numerador sale de las reservas activas dentro de esas 10. Error asimétrico: la ocupación siempre se ve más baja de lo real.
- `cobranzaItems`, `tableReservations` y `<OccupancyStrip>` heredan el mismo recorte.

Esto además contradice ADR-0028 §3, que ya decidió que los KPIs de cobranza **agregan sobre el set completo, nunca sobre la página**.

**Fix**: no subir el `limit` a un número mágico. Mover el cálculo al servidor con queries agregadas y acotadas por rango:

- Ingresos del mes y del mes anterior → reutilizar `sumCompletedPaymentsForOwner` / `getDecisionSummary` (`src/lib/reports/decision-summary.ts`), que ya implementan la semántica aprobada.
- Cobranza → `getCollectionReport` con sus `totals` (set completo, ADR-0028 §3).
- Ocupación de hoy → query de reservas que intersectan hoy, no "las últimas 10".
- Tabla y franja → `getReservationsByDateRange(start, end)` (`reservations.ts:915`), que ya filtra por ventana temporal y es la primitiva correcta para "próximos 14 días".

Criterio de aceptación: con una cuenta semilla de 50+ reservas repartidas en 6 meses, cada KPI del dashboard coincide con el mismo período en `/reports`.

### C2 · Cantidad y monto de vencidos salen de fuentes distintas

`page.tsx:359` arma el subtítulo así:

```
`Tienes ${overdueCount} cobros vencidos por ${formatCLP(overdueAmount)}`
```

- `overdueCount` (`page.tsx:255`) = todos los pagos `PENDING` con `dueDate < today`, **sin filtrar** `paymentType` ni el estado de la reserva.
- `overdueAmount` (`page.tsx:356`) = suma de `collectionAlerts.vencidos`, que **sí** filtra `paymentType === "RESERVATION"` y `reservation.status ∈ {PENDING, CONFIRMED}` (`src/lib/alerts/collection-alerts.ts`).

Dos poblaciones, una frase. El mismo desalineo aparece entre el KPI "Pagos Pendientes → *N* vencidos" (`page.tsx:403`) y la lista "Cobros pendientes": el badge puede decir 3 y la lista mostrar 1.

**Fix**: una sola fuente de verdad. `classifyCollectionAlerts` es la definición de dominio; el KPI, el subtítulo y la lista deben derivar de ella (o del `totals` de `getCollectionReport`). Ningún conteo de vencidos debe recalcularse inline en el page.

Bonus: `new Date(p.dueDate) < today` compara instantes, no días hábiles SCL. El mismo archivo aplica ADR-0020 (wall-time Santiago) para las reservas pero no para los pagos. Usar `daysFromNowInBusinessTz` como hace `collection-alerts.ts`.

### C3 · Los cobros que vencen HOY desaparecen

`classifyCollectionAlerts` devuelve tres buckets: `vencidos`, `vencenHoy`, `proximos7Dias`. `page.tsx:294` arma `cobranzaItems` con **`vencidos` + `proximos7Dias`** y omite `vencenHoy`.

Un pago que vence hoy no está vencido y no está en los próximos 7 días → **no se muestra en ninguna parte del dashboard**. Es exactamente el cobro que el owner debería estar haciendo esta mañana.

**Fix**: incluir `vencenHoy` entre `vencidos` y `proximos7Dias`, con su propio tratamiento visual ("Vence hoy", tono warning). Test de regresión: pago con `dueDate` = hoy aparece en la lista.

### C4 · "Ingresos Mensuales" no es el mismo ingreso que en `/reports`

ADR-0028 §1 fija que un ingreso cobrado exige: `status COMPLETED` + `paymentType RESERVATION` + `deletedAt null` + `paidAt` dentro del rango.

`page.tsx:221` solo filtra `status === "COMPLETED"` y `paidAt >= monthStart`. Consecuencias:

- Incluye pagos **EXTRA** (limpieza, multas), que ADR-0028 excluye a propósito.
- Incluye plata de reservas **CANCELLED**, que `decision-summary` contabiliza aparte.
- No tiene cota superior: un `paidAt` futuro cuenta como mes actual.

Resultado: el owner ve $X en el dashboard y $Y en `/reports` para el mismo mes. En un producto cuya personalidad de marca es "*Trustworthy — money is on the line*", esto es el daño más caro de la lista.

**Fix**: consumir el mismo módulo de dominio que `/reports`. Cero aritmética financiera nueva en `page.tsx`.

---

## Parte 2 — Lo esencial que le falta al cliente

### E1 · Bloque "Hoy": llegadas, salidas y estadías en curso

Hoy la información existe pero está diluida: `isArrivingToday` solo pinta una fila más oscura dentro de una tabla de 6, y los check-outs de hoy no tienen ninguna señal propia.

Propuesta: una franja bajo el header, antes de los KPIs, con tres cifras y sus nombres:

```
HOY   ·   2 llegadas: Camila R. (Depto Centro), Jorge M. (Cabaña Sur)
          1 salida:   Familia Pérez (Loft Norte) — revisar limpieza
          4 estadías en curso
```

Si no hay movimiento, colapsa a una línea ("Sin llegadas ni salidas hoy"), coherente con la regla "muestra lo urgente, oculta lo estable" que ya sigue `PlanAlertBanner` (`CONTEXT.md:124`).

Los datos ya están calculados: `daysUntilStart === 0` y `daysUntilEnd === 0`.

### E2 · Acciones desde el dashboard

Hoy la página es 100% lectura: todo camino termina en un link a otra pantalla. Las tres acciones que cierran el 80% del día del owner ya existen como componentes y no están aquí:

- **Marcar como pagado** — `<MarkPaidDialog>` (`src/components/dashboard/mark-paid-dialog.tsx`) ya se usa en `/payments` y `/reservations/[id]`. Vive incluso en la carpeta `components/dashboard/` y el dashboard no lo usa.
- **Copiar / reenviar link de pago** — `initPoint` ya viaja en cada `CollectionAlertItem` y se descarta.
- **Contactar al huésped** — `client.phone` se carga y nunca se muestra. Un `wa.me` en la fila de una llegada de hoy o de un cobro vencido es la acción más pedida en este vertical.

Propuesta: cada ítem de "Cobros pendientes" gana un menú de acción con `Marcar pagado` / `Copiar link` / `WhatsApp`. Cada llegada de hoy gana `WhatsApp`.

### E3 · Estado vacío / onboarding

Cuenta recién creada (0 propiedades, 0 reservas): la página renderiza 4 KPIs en cero, una tabla vacía, una lista vacía y una grilla de ocupación vacía. Un muro de nada donde debería haber un camino.

Propuesta: si `properties.length === 0`, reemplazar el cuerpo por un bloque de tres pasos — *Crea tu primera propiedad → Registra un huésped → Agenda tu primera reserva* — con el paso actual destacado. Si hay propiedades pero cero reservas, solo el tercer paso.

### E4 · Reservas por confirmar

Una reserva `PENDING` es plata que todavía se puede caer. Hoy solo se ve como pill de estado dentro de la tabla, sin agregado ni orden por antigüedad.

Propuesta: convertirlo en señal explícita — en el subtítulo data-driven (`page.tsx:357`) o como quinto dato del bloque "Hoy": *"3 reservas esperando confirmación (la más antigua, hace 6 días)"*.

---

## Parte 3 — Calidad y percepción

**Q1 · `loading.tsx`.** No existe ninguno en toda la app. `/dashboard` hace 4 queries antes de pintar el primer píxel. Con `skeleton.tsx` ya disponible, un `loading.tsx` que dibuje header + 4 KPIs + tabla convierte una pausa en blanco en una transición.

**Q2 · Reservas MONTHLY.** La tabla filtra `billingType === "DAILY"` (`page.tsx:327`) y lo explica en el empty state. Correcto como decisión, pero un owner de arriendo mensual ve la sección vacía permanentemente y no tiene ningún KPI mensual propio. Mínimo: mostrar el conteo de contratos mensuales activos en el bloque "Hoy" o en el subtítulo.

**Q3 · Deuda menor.**
- `src/components/dashboard/urgent-collection-card.tsx` y `pending-balances-card.tsx` son **código muerto** (solo referenciados por sus propios tests) y duplican conceptualmente `DashboardCobranzaList`. Borrar, o adoptar uno como base del rediseño de cobranza.
- La barra de ocupación en `<KpiCard>` (`kpi-card.tsx`, bloque `progressBar`) es un `div` sin `role="progressbar"` ni `aria-valuenow`. El primitivo `progress.tsx` ya existe.
- La interfaz `Payment` de `page.tsx` declara `deletedAt: string | null`, pero `getReservations` no lo selecciona (ya filtra en la query). El `.filter(p => !p.deletedAt)` de `page.tsx:215` es un no-op sobre un campo `undefined`. Limpiar el tipo para que no mienta.
- Falta `export const metadata` (title) en la página, presente en `/payments` y `/settings/billing`.

---

## Plan de ejecución

Tres fases. La Fase 1 es prerequisito de todo lo demás: **no tiene sentido agregar widgets sobre números incorrectos.**

### Fase 1 — Corregir la verdad de los datos (Nivel 3 · ADR-0017)

Dominio crítico (plata + agregados): `architect` + `implementer` + `tester` + `reviewer`.

1. Crear un seam server-side `getDashboardSummary()` en `src/lib/actions/` que devuelva, en una sola llamada: KPIs del mes, totales de cobranza, ocupación de hoy, movimientos de hoy, ventana de reservas de 14 días. Reutiliza `decision-summary` / `getCollectionReport` / `getReservationsByDateRange`; **no** reimplementa aritmética.
2. `page.tsx` pasa a consumir ese seam y pierde todo cálculo financiero inline (elimina C1 y C4 de raíz).
3. Unificar los vencidos en `classifyCollectionAlerts` e incluir `vencenHoy` (C2, C3).
4. Migrar las comparaciones de `dueDate` a la convención date-only (`dateOnlyKey`/`daysFromTodayDateOnly` en `@/lib/domain/timezone`), no a wall-time SCL — `dueDate` es date-only, no un instante.

Tests: reserva #11 en adelante entra en los KPIs; pago EXTRA no suma a ingresos; pago con `dueDate` = hoy aparece en cobranza; conteo y monto de vencidos siempre concuerdan; dashboard vs `/reports` coinciden en el mismo mes.

### Fase 2 — Lo esencial operativo (Nivel 2)

5. Bloque "Hoy" (E1) + señal de reservas por confirmar (E4).
6. Acciones en cobranza y en llegadas: `MarkPaidDialog`, copiar `initPoint`, WhatsApp (E2).
7. Estado vacío / onboarding de 3 pasos (E3).

### Fase 3 — Pulido (Nivel 1)

8. `loading.tsx` con skeleton.
9. Señal de contratos MONTHLY (Q2).
10. Limpieza: componentes muertos, a11y del progress bar, tipo `Payment`, `metadata` (Q3).

---

## Qué NO hacer

- **No** subir el `limit` de `getReservations()` a 500 como parche de C1: mueve el techo, no lo quita, y carga todos los pagos de todas las reservas en memoria en cada render.
- **No** agregar gráficos de tendencia al dashboard. Eso es trabajo de `/reports`; aquí un delta porcentual basta y `PRODUCT.md` pide una superficie operativa, no analítica.
- **No** duplicar semántica financiera en `page.tsx`. Toda cifra de plata sale de `src/lib/reports/*` bajo ADR-0028.
