# PRD-0006: Comisiones de captadores

## Problem Statement

Un owner de RentalPro no siempre consigue solo a sus arrendatarios. Tiene personas a cargo
—un corredor, un conserje, un familiar— que le traen el arrendatario y se llevan un
porcentaje del arriendo.

Hoy eso no existe en el sistema. El owner lo lleva en una libreta o en una planilla aparte,
y cada vez que cobra una cuota tiene que recalcular a mano cuánto le debe a quién. Los
problemas concretos:

- **No hay dónde anotar al captador.** `ReservationClient` es el arrendatario. No hay
  ninguna entidad para la persona que lo trajo.
- **No hay dónde anotar el porcentaje.** `Reservation` tiene `totalPrice` y nada más.
- **El cálculo se hace fuera del sistema**, con los datos que sí están dentro. En un
  arriendo `MONTHLY` de doce cuotas son doce cálculos manuales que hay que mantener
  cuadrados contra los pagos reales.
- **Ningún reporte lo muestra.** `/reports` sabe exactamente cuánto entró y por qué reserva,
  que es toda la información que la comisión necesita.

Issue [#267](https://github.com/edurikelm/saas-arriendos-v3/issues/267). Las decisiones de
dominio están cerradas en `docs/adr/0040-comisiones-de-captadores.md`.

## Solution

El owner registra a sus captadores como registros propios, con un porcentaje por defecto.
Al crear una reserva elige quién la captó, y el sistema congela el porcentaje en esa reserva.
Después, `/reports` le dice cuánto se le debe a cada captador en el período que está mirando.

La comisión **no se guarda**: se deriva de los pagos ya cobrados de esa reserva por la tasa
congelada. Eso significa que ni el webhook de Mercado Pago ni el registro de pagos manuales
ni la confirmación de reservas cambian una línea. La feature entra entera por el lado de
lectura.

La v1 informa; no paga. El owner ve cuánto debe y le paga por fuera.

## User Stories

### Captadores

1. Como Owner, quiero crear un captador con nombre, contacto y porcentaje por defecto, para
   no tener que tipear el porcentaje en cada reserva.
2. Como Owner, quiero editar el porcentaje por defecto de un captador, y que las reservas ya
   registradas no se muevan, para que corregir el trato a futuro no me reescriba la historia.
3. Como Owner, quiero desactivar un captador con el que dejé de trabajar sin borrar sus
   reservas históricas, para no perder el registro de lo que le pagué.
4. Como Owner, quiero ver cuántas reservas trajo cada captador, para saber cuáles me sirven.

### En la reserva

5. Como Owner, quiero elegir quién captó la reserva al crearla, y que se precargue su
   porcentaje, para hacerlo en un click.
6. Como Owner, quiero ajustar el porcentaje de una reserva puntual antes de guardarla, para
   los casos que se negociaron distinto.
7. Como Owner, quiero dejar una reserva sin captador, porque la mayoría de las reservas las
   consigo yo.
8. Como Owner, quiero ver en el detalle de la reserva quién la captó, con qué porcentaje, y
   cuánta comisión se devengó hasta ahora, para responder una consulta sin abrir un reporte.
9. Como Owner, quiero que un cambio de captador o de porcentaje quede registrado en el
   historial de la reserva, para saber quién cambió qué.

### En reportes

10. Como Owner, quiero ver cuánta comisión se devengó por captador en el período que estoy
    mirando, para pagarle lo que corresponde a fin de mes.
11. Como Owner, quiero abrir el detalle de un captador y ver qué reservas y qué pagos
    componen ese total, para justificarle el monto si me lo discute.
12. Como Owner, quiero que la comisión de un arriendo mensual aparezca a medida que cobro las
    cuotas, no completa al firmar, para no deberle plata que todavía no recibí.

## Implementation Decisions

### A. Modelo Prisma

```prisma
model Broker {
  id                    String   @id @default(cuid())
  userId                String
  name                  String
  email                 String?
  phone                 String?
  rut                   String?
  /// Porcentaje, NO fracción: 10.00 significa 10%. El cálculo divide por 100.
  defaultCommissionRate Decimal  @db.Decimal(5, 2)
  active                Boolean  @default(true)
  notes                 String?
  createdAt             DateTime @default(now())

  user         UserProfile   @relation(fields: [userId], references: [id])
  reservations Reservation[]

  @@index([userId])
}
```

En `Reservation`:

```prisma
  brokerId       String?
  /// Congelado al crear la reserva desde `Broker.defaultCommissionRate`.
  /// Porcentaje, no fracción. Ver ADR-0040 §2.
  commissionRate Decimal? @db.Decimal(5, 2)

  broker Broker? @relation(fields: [brokerId], references: [id])

  @@index([brokerId])
```

**La tasa es un porcentaje de 0 a 100, no una fracción.** Queda dicho en el schema, en el
Zod y en el JSDoc del cálculo: es el error de factor 100 más fácil de cometer y el más
difícil de ver, porque una comisión de 0,1% se parece bastante a un redondeo.

`active` en vez de borrar: un captador con reservas históricas no se puede eliminar sin
perder el registro. El selector de la reserva solo ofrece los activos.

Sin `@@unique([userId, email])`: el email es opcional acá, al revés que en
`ReservationClient`, y dos captadores sin email son perfectamente posibles.

**La migración se aplica con el MCP de Supabase antes de mergear** (ADR-0022). El build de
Vercel no corre `migrate deploy`: si el merge entra primero, producción queda con el código
nuevo y el schema viejo.

### B. Seam de cálculo: `src/lib/brokers/`

Siguiendo ADR-0025. Puede importar de `src/lib/payments/`; `src/lib/payments/` no importa de
acá.

**`src/lib/brokers/commission.ts`** — puro:

```ts
/** Comisión de un pago. `rate` es porcentaje (10 = 10%), no fracción. */
commissionForPayment(amount: number, rate: number): number  // Math.round(amount * rate / 100)

/** Suma de comisiones de una lista de pagos con una tasa única. */
commissionForPayments(payments: { amount: number }[], rate: number): number
```

Redondeo por pago y después suma (ADR-0040 §8), para que el total cuadre con el detalle.

**`src/lib/brokers/queries.ts`** — agregados para la vista:

```ts
getCommissionsForOwner(
  userId: string,
  filters: { rangeStartKey: string; rangeEndKey: string; propertyId?: string },
): Promise<BrokerCommissionRow[]>
```

Trae los pagos `COMPLETED` + `RESERVATION` + `deletedAt: null` cuya reserva tiene
`brokerId`, con `reservation: { brokerId, commissionRate }`, y **reduce en JS**, no en SQL.
Dos razones: la tasa varía por reserva, así que no es un `_sum` de montos; y el filtro de
rango tiene que pasar por `isPaidAtInRange` para leer `paidAt` por su día de Santiago
(ADR-0038). Es la misma forma que `buildDecisionSummary`.

### C. CRUD y ruta

Calcado de clientes, que es el precedente más cercano:

| Clientes | Captadores |
|---|---|
| `src/lib/actions/clients.ts` | `src/lib/actions/brokers.ts` |
| `src/lib/validations/client.ts` | `src/lib/validations/broker.ts` |
| `src/app/(dashboard)/clients/` | `src/app/(dashboard)/brokers/` |

Sin límite de plan (ADR-0040 §9): `brokers.ts` no replica el `FREE_CLIENT_LIMIT` de
`clients.ts:11`.

Zod: `defaultCommissionRate` entre 0 y 100, con hasta dos decimales.

### D. Asignación en la reserva

El formulario de reserva gana un selector opcional de captador y, cuando hay uno elegido, un
campo de porcentaje precargado con su valor por defecto y editable.

Al **crear**: `commissionRate` se escribe con el valor del formulario, ya congelado. No se
lee `Broker.defaultCommissionRate` en ninguna lectura posterior.

Al **editar**: cambiar el captador precarga su porcentaje, pero el owner puede dejar otro.
`brokerId` y `commissionRate` entran a la auditoría de `ReservationChange`, que ya registra
campo por campo.

Reserva sin captador: `brokerId` y `commissionRate` en `null`. Es el caso normal.

### E. Bloque en `/reports`

Va en la sección **"Resultado del período"**, porque obedece al rango y a la propiedad del
encabezado, como exige ADR-0035. No es una foto del presente.

Una fila por captador: nombre, porcentaje, cuánto se cobró de sus reservas en el período, y
la comisión. Expandible al detalle por reserva y pago.

**Ninguna cifra existente cambia** (ADR-0040 §7). "Cobrado" sigue siendo bruto. El bloque de
comisiones se lee al lado, no en vez.

### F. Slices

1. **DB + seam.** Migración, `commission.ts`, `queries.ts`, tests. Nada visible todavía.
2. **CRUD de captadores.** Acciones, validación, ruta `/brokers`, navegación.
3. **Asignación en la reserva.** Formulario, congelado, auditoría, detalle.
4. **Bloque de comisiones en `/reports`.**

La 1 no depende de nada. La 2 y la 3 dependen de la 1. La 4 depende de la 1 y de la 3 (sin
reservas con captador no hay nada que mostrar).

## Testing Decisions

### Funciones puras (`src/lib/brokers/__tests__/commission.test.ts`)

- Porcentaje sobre monto exacto y con redondeo al peso.
- Tasa `0`: comisión cero, no `null`.
- Suma de una lista: el total es la suma de los redondeos, no el redondeo de la suma.
- Tasa de dos decimales (`8.75`), para fijar que es porcentaje y no fracción.

### Agregado (`src/lib/brokers/__tests__/queries.test.ts`)

Con Prisma mockeado, el patrón del módulo de pagos:

- Excluye `EXTRA`, `PENDING` y `deletedAt` distinto de `null`.
- Dos reservas del mismo captador con **tasas distintas** suman cada una con la suya.
- Un `MONTHLY` con tres cuotas de las que dos están cobradas devenga dos.
- **Un pago con `paidAt` a las 22:30 de Santiago** cae en el día de Santiago y no en el
  siguiente día UTC. Los fixtures de fechas van a las 15:00 UTC, no a medianoche: medianoche
  UTC es el día anterior en Santiago y ya nos hizo ver bugs que no existían.

### Server actions y UI

Prisma y sesión mockeados; nada que escriba corre contra la base real. Un test de que
`brokers.ts` no aplica límite de plan.

En los tests de componentes, aserciones con APIs del DOM: este repo no tiene `jest-dom`, así
que `toBeInTheDocument` y `toHaveAttribute` no existen.

### Antes de dar por cerrada la slice 4

Contrastar el total de comisiones de un período contra los pagos reales de la base, no solo
contra los fixtures. Los bugs más caros de este repo salieron de comparar código contra
datos.

## Out of Scope

- **Login del captador.** No entra al sistema, no ve nada. Si se pide, se le asocia un
  `UserProfile` después (ADR-0040 §1).
- **Liquidaciones.** No hay estado pagado/pendiente de la comisión, ni comprobante, ni fecha
  de pago al captador. La v1 informa.
- **Honorario fijo en pesos.** Solo porcentaje.
- **Más de un captador por reserva**, y repartos entre varios.
- **Comisión sobre cobros `EXTRA`.** Explícitamente fuera (ADR-0040 §6).
- **Porcentaje por propiedad** (distinto por casa). El porcentaje es del captador, y se
  ajusta por reserva.
- **Notificaciones al captador.** No tiene cuenta a la que notificarle.
- **Ingresos netos de comisión** en los KPIs existentes, y export de comisiones.

## Further Notes

### Por qué no hay tabla `Commission`

Está argumentado en ADR-0040 §3. En corto: el monto es derivable de los pagos y de una tasa
congelada, y guardarlo aparte sería una caché. Ya pagamos ese precio con el plan del owner
(ADR-0034), donde la invalidación falló de cuatro formas distintas en dos días.

La consecuencia práctica es que esta feature no toca el camino de escritura de pagos. Las
cinco llamadas a `confirmReservationIfPaid` en `src/lib/actions/payments.ts`, el webhook y
`markPaymentAsCompleted` quedan exactamente como están.

### Cuándo dejaría de servir la derivación

El día que haya que marcar una comisión como pagada. Ese es un hecho nuevo, no derivable de
los pagos del arrendatario, y ahí sí entra una tabla. El modelo de esta v1 no estorba: la
tabla nueva referenciaría la reserva y el monto liquidado, y el devengado seguiría
derivándose.

### Qué pasa con las reservas ya existentes

Nada. `brokerId` y `commissionRate` nacen en `null` para todas las reservas históricas, y una
reserva sin captador no aparece en el bloque de comisiones. No hay backfill.
