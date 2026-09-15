# ADR-0037: `/dashboard` — acciones de cobro sobre el próximo cobro de cada reserva

## Status

Accepted (2026-09-15)

## Context

ADR-0036 dejó "Por cobrar" sin acciones y registró por qué no bastaba con reutilizar los diálogos
existentes. `MarkPaidDialog` y `SendPaymentLinkDialog` actúan sobre un `Payment`, pero una fila de
"Por cobrar" es una **reserva**, y lo que hay detrás de esa reserva cambia según el caso. Medido en
producción el 2026-09-14:

1. **De los 4 cobros del día, solo 1 tenía un `Payment` PENDING** sobre el cual marcar pagado. Las
   reservas DAILY con deuda no tienen filas de `Payment`: su deuda es `totalPrice − pagado`, así que
   la acción real es **crear** el pago, no marcarlo.
2. **Una fila MONTHLY agrupa varias cuotas impagas** ("2 cuotas vencidas · +1 vence en 4 días"), y hay
   que decidir sobre cuál se actúa.
3. **El owner cobra en efectivo.** Los 12 pagos completados de producción son CASH (11) o TRANSFER (1).
   Nunca se generó un link de Mercado Pago, aunque la cuenta tiene la integración conectada.
4. **Las cuotas mensuales se generan con `method: MERCADO_PAGO` y `status: PENDING`**
   (`generateMonthlyPayments`), así que admiten generar link.
5. **`MarkPaidDialog` guardaba mal la fecha.** Enviaba `new Date("YYYY-MM-DD")`, que es medianoche UTC:
   en Santiago eso cae el **día anterior** a las 21:00 (o 20:00 en horario de invierno). Hay 6 cuotas
   en producción con `paidAt` a las 00:00 UTC exacto, y el detalle de reserva, que formatea `paidAt`
   en Santiago, las muestra pagadas un día antes. `AddPaymentDialog` ya lo hacía bien, con mediodía
   local. Como las cuotas vencen el día 1, el borde es frecuente: un pago marcado el 1 queda en el mes
   anterior para la serie mensual de `/reports`, que agrupa por mes de Santiago.

Además, `generateMercadoPagoLink` crea un `Payment` PENDING nuevo por todo el saldo en cada llamada,
sin revisar si ya existe uno con link vigente.

## Decision

**Cada fila actúa sobre su próximo cobro (`nextCharge`), calculado en el seam puro del dashboard.
Ninguna server action de pagos cambia: la UI solo decide cuál de las existentes llamar.**

### 1. `nextCharge` (`computeNextCharge` en `src/lib/dashboard/summary.ts`)

En orden de prioridad:

1. **El `Payment` RESERVATION impago más antiguo**: PENDING o FAILED, no borrado, ordenado por `dueDate`
   ascendente (null al final), luego `createdAt` y luego `id` → `EXISTING`. Es lo que el cliente debe
   primero. "Impago" es la misma definición que usa `buildCollectionReportRows` para las cuotas.
2. **Si no hay ninguno pero el arriendo tiene saldo** (`getReservationPendingAmount`) →
   `{ kind: "NEW", amount: saldo }`.
3. **Si el arriendo está saldado**, el primer EXTRA impago por `createdAt` → `EXISTING`.
4. **Nada que cobrar** → `null`.

### 2. "Registrar pago"

- **`EXISTING`** → `MarkPaidDialog` → `markPaymentAsPaid(paymentId)`. El diálogo nombra el cobro
  ("Cuota 3 de 4", el título de un extra, o "Arriendo"). Si el cobro es de Mercado Pago con link
  vigente, advierte que marcarlo a mano no anula ese link: si el cliente también lo paga, se cobra dos
  veces.
- **`NEW`** → `RegisterPaymentDialog` → `createPayment({ status: "COMPLETED", paymentType:
  "RESERVATION", … })`.
  - El monto se prellena con el saldo y es editable, con el saldo como tope, porque los pagos
    parciales existen.
  - El comprobante se sube aparte por `/api/upload` y viaja como URL: las server actions tienen límite
    de tamaño de cuerpo.
- **Varias cuotas:** con una mensual que debe varias, se registra la más antigua. Si el cliente paga
  dos meses, se registra dos veces; la fila se actualiza sola entre una y otra.

### 3. "Enviar link"

Solo aparece con Mercado Pago conectado (`getMercadoPagoIntegration().isConnected`). Nunca aparece
para cobros en efectivo o transferencia, ni para un FAILED con link vigente: es la misma matriz de
`PaymentRowActions`, que refleja lo que acepta cada server action.

| `nextCharge` | Acción |
|---|---|
| `EXISTING` PENDING con link vigente | Abre `SendPaymentLinkDialog` directo, sin llamar al servidor |
| `EXISTING` PENDING sin link | `generatePaymentLink(paymentId)` |
| `EXISTING` con link vencido, o FAILED sin link | `regeneratePaymentLink(paymentId)` |
| `NEW` | `generateMercadoPagoLink(reservationId)`, sin monto: el servidor usa el saldo |

**Links duplicados.** Entre que el servidor crea el link y llega `router.refresh()`, la fila sigue
viendo el `nextCharge` viejo. Un segundo clic en esa ventana crearía otro `Payment` PENDING por el
mismo saldo, así que la fila recuerda el link recién creado **por cobrar** y lo reabre. El recuerdo se
descarta cuando el cobro cambia de identidad, para no reabrir el link de un pago que se borró en otra
pestaña. La protección es del cliente: el servidor sigue sin deduplicar.

### 4. Fecha de pago: el mediodía de Santiago del día elegido

Los tres diálogos que registran un pago manual (`AddPaymentDialog`, `MarkPaidDialog` y
`RegisterPaymentDialog`) construyen `paidAt` con `businessNoonOfDateKey(dateKey)`
(`src/lib/domain/timezone.ts`), y su fecha por defecto es el "hoy" de Santiago.

- **Por qué el mediodía de Santiago.** `paidAt` se lee de dos formas: por día de Santiago
  (`formatInstant`, meses de `revenue-series`) y por día UTC (rangos de `decision-summary`). El
  mediodía de Santiago son las 15:00 o 16:00 UTC, así que cae en el día elegido en las dos, desde
  cualquier zona y también en los días de cambio de hora.
- **Por qué no el mediodía local.** El primer arreglo fue `new Date(y, m - 1, d, 12, 0, 0)`, que ya
  usaba `AddPaymentDialog`, y el `tester` demostró que tampoco alcanza: es el mediodía del
  **navegador**. Medido con `TZ` real, desde Sídney, Auckland o Fiji ese instante ya es el día anterior
  en Santiago, y desde Tokio también en el invierno chileno.
- **Por qué los tests de antes no lo vieron.** Construían la fecha con hora local y la leían con
  getters locales, así que coincidían en cualquier zona y no probaban nada. Los tests nuevos leen el
  día de negocio del instante enviado con el proceso en cinco zonas. Revertir el arreglo pone en rojo
  los casos de Sídney y Kiritimati (verificado).
- **Alcance.** El arreglo alcanza a `/payments` y al detalle de reserva, que usan `MarkPaidDialog` y
  `AddPaymentDialog`.


### 5. Estructura de la fila

La fila deja de ser un `<Link>` que envuelve todo, porque un botón dentro de un `<a>` es HTML
inválido. Pasa a ser `<li flex>` con el link y, a su lado, un contenedor de acciones de **ancho fijo
(76px)**: así montos e íconos quedan en columna aunque una fila no tenga "Enviar link". El ancho
cuenta el padding: con 60px, el segundo botón no cabía y, como `Button` no se comprime, se salía 14px
hasta quedar a 3px del borde de la card (medido a 1440px).

La fila llama `router.refresh()` después de cada acción, **también cuando el servidor la rechaza**: las
server actions de pagos no revalidan `/dashboard`, y un rechazo casi siempre significa que la fila
quedó vieja, porque el pago se completó o se borró en otra pestaña. Sin refrescar, cada reintento
repetía el mismo error hasta recargar la página. Para eso, `MarkPaidDialog` y `RegisterPaymentDialog`
aceptan un `onError` opcional.

## Implementation

- `src/lib/dashboard/summary.ts`:
  - Agrega `DashboardNextCharge` y `computeNextCharge`, y suma `nextCharge` y `clientEmail` a
    `DashboardCollectionItem`.
  - Quita `paymentId`, `initPoint` y `expiresAt` del item (la UI no los usaba) y el enriquecimiento con
    `classifyCollectionAlerts`.
  - El input suma `client.email` y `createdAt`/`installmentIndex`/`title` de cada pago.
- `src/lib/actions/dashboard.ts`: los campos nuevos en el `select`.
- `src/app/(dashboard)/dashboard/_components/cobranza-row-actions.tsx` (nuevo): la matriz de acciones
  y el guard de links duplicados.
- `src/components/dashboard/register-payment-dialog.tsx` (nuevo).
- `src/components/dashboard/mark-paid-dialog.tsx`: `paidAt` con `businessNoonOfDateKey`, las props
  opcionales `notice` y `onError`, y el campo de comprobante con nombre accesible (`htmlFor`/`id`).
- `src/components/reservations/add-payment-dialog.tsx`: `paidAt` con `businessNoonOfDateKey` y la
  fecha por defecto en el "hoy" de Santiago.
- `src/lib/domain/timezone.ts`: `businessNoonOfDateKey`.
- `src/app/(dashboard)/dashboard/_components/dashboard-cobranza-list.tsx`: la fila en dos hermanos y la
  prop `canSendPaymentLinks`. `dashboard-home.tsx` y `page.tsx` la conectan.
- `src/lib/format/currency.ts`: `formatCLPInput` / `parseCLPInput` para el monto editable.

## Consequences

### Positive

- El caso más común de producción, cobrar en efectivo una reserva diaria sin pagos creados, se
  resuelve desde el inicio en un diálogo, sin navegar.
- Ninguna regla financiera nueva: cada escritura pasa por una server action existente, con sus
  validaciones de tenencia, tope de monto y confirmación de la reserva.
- Los pagos manuales que se registran desde cualquier pantalla quedan con el día que eligió el owner,
  sin importar la zona horaria del navegador.

### Negative

- **Una cuota por vez.** Registrar dos meses pagados juntos toma dos confirmaciones.
- **Extras sin fila.** Una reserva con el arriendo pagado y solo extras pendientes no llega a "Por
  cobrar": `buildCollectionReportRows` no le asigna vencimiento a los extras (issue #232), así que la
  regla 3 de `nextCharge` hoy no se alcanza desde esta sección.
- **El doble cobro con link vigente se advierte, no se previene.** Marcar a mano un cobro con link de
  Mercado Pago vivo no anula la preferencia.
- **La deduplicación de links es solo del cliente.** Otra pestaña, u otra pantalla, puede crear un
  segundo link para el mismo saldo.
- **Los datos viejos no se tocan.** Las 6 cuotas guardadas a medianoche UTC siguen mostrándose un día
  antes. Ninguna cruza un borde de mes, así que no mueven cifras; corregirlas es una migración de datos
  que queda para decidir aparte.
- **Queda pendiente el día de negocio en `/reports`.** `decision-summary.ts` y `revenue-series.ts`
  comparan `paidAt` por día UTC para el rango, pero `revenue-series` lo agrupa por mes de Santiago. Un
  pago real entre las 20:00 y las 23:59 de Santiago (por ejemplo, un webhook de Mercado Pago de noche)
  sigue quedando en días distintos según la cifra. Es trabajo aparte, porque es dominio de reportes.
- **La fila y el diálogo usan palabras distintas.** La fila dice "Registrar pago" y, para un cobro
  existente, el diálogo se titula "Marcar como pagado", el título compartido con `/payments`.

## Related

- ADR-0017: Nivel 3.
- ADR-0020: día de negocio.
- ADR-0033: agrupación de "Por cobrar".
- ADR-0036: diseño del inicio y por qué las acciones quedaron fuera.
- CONTEXT.md, secciones "Pagos" y "`/dashboard` — sección Cobros pendientes".
