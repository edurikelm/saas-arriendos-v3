# ADR-0040: La comisión del captador se deriva de los pagos cobrados

## Status

Accepted (2026-09-17)

## Context

Un owner puede tener personas a cargo que le consiguen arrendatarios y se llevan un
porcentaje del arriendo. Hoy no hay dónde poner ni a esa persona ni a ese porcentaje
(issue #267).

El modelo actual, verificado contra `prisma/schema.prisma`:

- **No existe ningún usuario subordinado a un owner.** `UserRole` tiene exactamente dos
  valores, `SUPER_ADMIN` y `OWNER`, y todo el aislamiento de datos es el `userId` del
  owner: `Property`, `ReservationClient`, `Reservation`, `ExternalCalendar`.
- **La comisión no es un `Payment`.** `paymentType` es `RESERVATION | EXTRA` y los dos los
  paga el arrendatario; una comisión la paga el owner al captador. Colgarla de `Payment`
  contaminaría la regla que confirma la reserva: `confirmReservationIfPaid`
  (`src/lib/reservations/confirmation.ts:53`) compara la suma de pagos `COMPLETED` +
  `RESERVATION` contra `totalPrice`.
- **Los ingresos son brutos.** En `/reports` toda cifra obedece al rango del encabezado o
  se rotula como foto del presente (ADR-0035), y `paidAt` entra por su día de negocio en
  Santiago (ADR-0038). No existe hoy ninguna noción de neto del owner.

Cuatro decisiones de producto se tomaron antes de escribir este ADR: el captador no tiene
login, la comisión se ata a la reserva, la base es lo efectivamente cobrado, y la v1 solo
informa cuánto se le debe.

Queda la pregunta que decide el tamaño del cambio: **¿la comisión es un registro que se
escribe, o un número que se lee?**

## Decision

### 1. El captador es un dato del owner, no un usuario

Modelo `Broker` nuevo, con `userId` del owner, calcado de `ReservationClient`
(`prisma/schema.prisma:309`). No inicia sesión, no ve nada del sistema, y el owner le
reporta fuera de la app.

`UserRole` no cambia. Auth no cambia. El aislamiento por `userId` no cambia: un captador es
una fila más del owner, igual que un cliente.

Si más adelante el captador necesita entrar al sistema, se le agrega un `UserProfile`
asociado. Las reservas históricas no se migran, porque apuntan al `Broker`, no al usuario.

### 2. La comisión se ata a la reserva, con la tasa congelada

`Reservation.brokerId?` y `Reservation.commissionRate?`. La tasa se copia del captador al
crear la reserva y **desde ahí es un dato de esa reserva**: cambiar el porcentaje por
defecto del captador no mueve ni un peso de lo ya registrado.

El owner puede editar la tasa de una reserva puntual. Queda auditado en
`ReservationChange`, que ya registra campo por campo.

Si el mismo arrendatario vuelve por su cuenta, esa reserva nueva no lleva captador. La
comisión es explícita por estadía, no una herencia del cliente.

### 3. El monto no se guarda: se deriva en cada lectura

```
comisión(reserva) = Σ  round(pago.amount × reserva.commissionRate)
                   pagos COMPLETED + RESERVATION, deletedAt = null
```

**No hay tabla `Commission`, no hay devengo escrito, no hay hook en el camino de escritura.**
Ni `markPaymentAsCompleted` ni el webhook de Mercado Pago ni las cinco llamadas a
`confirmReservationIfPaid` en `src/lib/actions/payments.ts` se tocan.

Es la lección de ADR-0034 aplicada antes de cometer el error: un monto que se puede derivar
de los pagos y de una tasa congelada, guardado aparte, es una caché — y la invalidación
falla. Con la derivación no hay estado que se pueda desincronizar: la consulta tiene la
misma forma que `sumCompletedPaymentsForOwner` (`src/lib/payments/queries.ts:141`), más el
join a `reservation.brokerId`.

La tasa congelada es lo que hace segura la derivación. Sin ella, corregir un porcentaje
reescribiría la historia.

### 4. La base es el monto del pago, bruto de la comisión de Mercado Pago

No se descuenta `mpFeeAmount` ni se usa `mpNetReceivedAmount`, aunque los tengamos
guardados en `Payment`.

Dos razones. Lo que el owner le prometió al captador es un porcentaje del arriendo, no del
residuo después del costo de procesar la tarjeta. Y `mpFeeAmount` solo existe para pagos de
Mercado Pago: descontarlo haría que el mismo arriendo pagara comisiones distintas según si
el arrendatario transfirió o pasó la tarjeta.

### 5. Se devenga cuando el pago pasa a `COMPLETED`, por el día de negocio de `paidAt`

Base caja, el mismo criterio que "Cobrado". Un arriendo `MONTHLY` devenga cuota por cuota, a
medida que se cobran. El rango de fechas se lee con `isPaidAtInRange`
(`src/lib/reports/revenue-series.ts:73`), para que un pago de las 22:30 caiga en el mismo día
y el mismo mes que en el resto de `/reports` (ADR-0038).

**Las cancelaciones no necesitan reversa.** Cancelar borra los pagos `PENDING` y conserva los
`COMPLETED`, así que la comisión derivada ya es la comisión de lo que efectivamente entró.
Revertir un pago a `PENDING` o borrarlo lo saca de la suma por construcción, sin nada que
recalcular.

### 6. Los cobros `EXTRA` no comisionan

Una multa o una limpieza no es arriendo, y el captador no la consiguió. `paymentType: EXTRA`
queda fuera de la suma, igual que queda fuera del `totalPrice` de la reserva.

### 7. "Ingresos" sigue siendo bruto, y la comisión es un bloque aparte

Ningún KPI existente cambia de significado. `collectedCash`, `accruedRevenue` y la tabla por
propiedad siguen midiendo lo mismo que hoy. La comisión aparece en su propio bloque de
`/reports`, rotulado, obedeciendo el rango del encabezado como exige ADR-0035.

Cambiarle el significado a "ingresos" para volverlo neto ya nos costó caro dos veces
(ADR-0028, ADR-0035): el número se movía y la página no decía por qué.

### 8. Redondeo por pago, a peso entero

`Math.round` sobre cada pago y después se suma, no al revés. Así el total que muestra la
vista es exactamente la suma del detalle que la acompaña.

### 9. Disponible en todos los planes, sin cupo propio

Los captadores no consumen el límite de FREE ni agregan uno nuevo en la v1. Limitarlos
acoplaría la feature a la maquinaria de plan efectivo sin evidencia de que sea un
diferenciador.

## Implementation

Cuatro slices, detalladas en `docs/prd/PRD-0006-comisiones-captadores.md`:

1. **Base de datos y seam.** Migración `Broker` + los dos campos de `Reservation`, y
   `src/lib/brokers/commission.ts` con el cálculo puro y sus tests.
2. **CRUD de captadores.** Calcado de clientes: `src/lib/actions/brokers.ts`,
   `src/lib/validations/broker.ts`, ruta `/brokers`.
3. **Asignación en la reserva.** Selector de captador y tasa en crear/editar, congelada al
   crear, auditada en `ReservationChange`, visible en el detalle.
4. **Bloque de comisiones en `/reports`.** Total por captador y detalle por reserva, bajo el
   rango del encabezado.

Regla de dependencia, siguiendo ADR-0025: `src/lib/brokers/` es lógica pura y puede importar
de `src/lib/payments/`; `src/lib/payments/` no importa de `src/lib/brokers/`.

## Consequences

### Positive

- El camino de escritura de pagos no se toca: cero riesgo de romper la confirmación de
  reservas, el webhook o la cobranza.
- No hay monto que se pueda desincronizar de los pagos que lo justifican.
- Cancelaciones, reversas y borrados de pago quedan resueltos por construcción, sin lógica
  de reversa.
- La v1 no toca roles, auth, aislamiento de datos ni límites de plan.
- Un porcentaje mal digitado se arregla editando la reserva, y la corrección se ve en el
  acto en todas las cifras.

### Negative

- **Solo porcentaje.** Un captador con honorario fijo en pesos no se puede expresar. Habría
  que agregar un tipo de comisión.
- **No hay liquidación.** El sistema dice cuánto se le debe, no si ya se le pagó. Marcar
  pagada una comisión sí necesita una tabla, y entra recién cuando se pida.
- **Corregir la tasa de una reserva mueve toda su comisión histórica**, incluida la de cuotas
  ya cobradas. Es lo correcto para un error de digitación y es lo indeseado para un cambio de
  trato a mitad de camino; el segundo caso no tiene forma de expresarse.
- **La comisión desaparece si el pago se borra**, sin dejar rastro de que existió. Es el
  mismo trato que ya le damos a la caja.
- **Un solo captador por reserva.** Repartir entre dos no se puede.
