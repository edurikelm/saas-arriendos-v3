# ADR-0034: El plan del owner se deriva, no se cachea

## Status

Accepted (2026-09-03)

## Context

El plan de un owner (FREE / PRO) era `UserProfile.plan`: una columna que se
escribía en respuesta a eventos de Mercado Pago y al cron diario. O sea, una
**caché de un valor derivable** de la `Subscription`. La invalidación falló de
cuatro formas distintas, todas encontradas en producción en dos días:

1. **El cron no bajaba el plan.** `expired_check` —el evento del cron diario y
   el único que detecta el vencimiento en la práctica, porque MP no emite
   `expired` para `preapproval`— no estaba en `eventTriggersPlanChange`. La
   columna marcaba PRO indefinidamente después de un vencimiento.
2. **Cancelar sin `currentPeriodEnd` concedía PRO para siempre.** La regla de
   degradación comparaba `currentPeriodEnd < now`; con `NULL` esa comparación
   nunca es verdadera. Caso real: una subscription `CANCELLED` desde el 22 de
   agosto con período nulo seguía dando PRO.
3. **Cada superficie leía una fuente distinta.** Los gates leían `session.plan`,
   `countOwnerUsage` leía la columna, el badge del sidebar leía la sesión (bien)
   y `PlanAlertBanner` tenía su **propia** regla basada en `subscription.status`.
   Resultado visible: el sidebar decía PRO y el banner decía FREE en la misma
   pantalla.
4. **La concesión manual de un admin era indistinguible de una caché
   desactualizada.** `updateUserPlan` escribía `plan` directo, sin pasar por
   `applyPlanChange`, sin `AdminActionLog` y sin notificación. Un PRO en la
   columna podía significar "un admin lo regaló" o "quedó viejo", y no había
   forma de saber cuál.

Arreglar (1), (2) y (3) por separado —como se venía haciendo— no cierra la
clase de bug: cada superficie nueva vuelve a elegir una fuente.

## Decision

**El plan efectivo se deriva en cada lectura. No se guarda.**

```
planEfectivo = planOverride ?? derivarDe(subscription, now)
```

### 1. `planOverride`: la única excepción legítima

Columna nueva, nullable. `null` = derivar; `"PRO"` = concesión manual de un
admin. **Solo guarda PRO por diseño:** un override de `FREE` sería un bloqueo
que le quitaría el plan a alguien que está pagando, y para cortar el acceso ya
existe cancelar la subscription. El panel de admin traduce su opción "FREE" a
`null` (revocar la concesión y volver a derivar), así que su UI no cambia.

`resolveEffectivePlan` ignora un override de `"FREE"` si alguna vez apareciera
en los datos: no puede quitarle PRO a quien lo tiene derivado.

### 2. La regla del período nulo depende del estado

Tratar `currentPeriodEnd = NULL` de forma uniforme fue el origen del defecto (2).

| Estado | `currentPeriodEnd` | Plan derivado | Por qué |
|---|---|---|---|
| `AUTHORIZED` | `NULL`, **con** `mpPreapprovalId` | **PRO** | Recién autorizada; MP no devolvió fechas todavía. Negar PRO acá le cobra al owner sin darle el plan. |
| `AUTHORIZED` | `NULL`, **sin** `mpPreapprovalId` | **FREE** | Fila que quedó en AUTHORIZED sin que MP autorizara nada — ver abajo. |
| `AUTHORIZED` | futuro | PRO | |
| `AUTHORIZED` | pasado | FREE | El cron no alcanzó a marcarla EXPIRED. |
| `CANCELLED` / `PAUSED` | futuro | PRO | Ya pagó ese período. |
| `CANCELLED` / `PAUSED` | `NULL` | **FREE** | No hay período pagado que honrar. Conceder PRO acá es plata regalada, y para siempre. |
| `PENDING` / `EXPIRED` / `FAILED` | cualquiera | FREE | |

`PAUSED` se trata como `CANCELLED` y no como FREE inmediato, para no degradar a
alguien que pausó a mitad de un mes ya pagado.

**Por qué el `mpPreapprovalId` entra en la regla.** La primera versión daba PRO
a cualquier `AUTHORIZED` con período nulo, justificado en que la ventana entre
la autorización y las fechas de MP es de minutos. Al verificar contra
producción apareció una fila que llevaba **13 días** así: `AUTHORIZED`, sin
`mpPreapprovalId`, con un único evento `created` y sin ningún `authorized`. MP
nunca autorizó nada. El flujo real (`startProUpgrade`) crea la subscription,
pide el preapproval y recién ahí guarda el id, así que un `AUTHORIZED` sin id es
una fila en estado inconsistente — y con la regla original se habría llevado PRO
gratis, indefinidamente.

El chequeo es por verdad y no `!== null`: si el campo llegara `undefined` —un
`select` que lo olvida, un mock viejo— `!== null` concedería PRO. El default
tiene que ser denegar.

### 3. La columna `plan` queda, pero sin autoridad

Se mantiene como dato denormalizado **para las vistas de admin**, que muestran
el registro a propósito. `applyPlanChange` la sigue manteniendo, y se agregó
`expired_check` a `eventTriggersPlanChange` para que deje de derivar.

Ninguna superficie de owner la lee. Eso lo congela un **test tripwire**
(`__tests__/plan-source-guard.test.ts`) con una allowlist explícita: un archivo
nuevo que la seleccione falla el test con instrucciones. El bug se repitió tres
veces por la misma vía —alguien agrega una superficie y elige la fuente que
tiene más a mano—, así que la defensa es hacer esa elección consciente.

### 4. El plan sale del JWT

`login` y `register` firmaban el token con `plan`. Nadie lo leía (`getSession`
solo saca `userId` y vuelve a la base), pero era una trampa: el día que alguien
lo use en un middleware edge —donde no hay Prisma, así que es la salida
tentadora— el downgrade tardaría hasta el próximo login.

### 5. Los cambios de plan por admin quedan auditables

`updateUserPlan` escribe `planOverride`, registra `PLAN_CHANGED_MANUAL` en
`AdminActionLog` reusando el vocabulario que `lifecycle` ya definía para
`source: "admin_manual"`, y revalida el árbol de layouts para que el badge del
sidebar del owner no quede mostrando el plan anterior.

## Consequences

### Positive

- Una sola definición de "qué plan tiene este owner", imposible de leer mal sin
  romper un test.
- El plan efectivo **no depende de que haya corrido un cron**. El cron pasa a
  hacer solo efectos secundarios (apagar recursos iCal, notificar).
- Se cierran dos agujeros de facturación: PRO indefinido tras cancelar sin
  período, y PRO indefinido tras un vencimiento que el cron no propagaba.
- La concesión manual pasa a ser un concepto explícito y auditable, en vez de
  una escritura indistinguible de una caché vieja.

### Negative

- `getSession` hace un join a `subscription` en cada request autenticado. Es
  1:1 sobre FK indexada, pero es un costo por request que antes no existía. Se
  acepta a cambio de cerrar el agujero.
- Conviven dos representaciones del plan: la columna (admin) y el cálculo
  (owner). Es deuda deliberada — dejar de escribir la columna requiere migrar
  las vistas de admin, que es un cambio aparte. El tripwire evita que la
  convivencia degenere.
- Un owner con override de PRO y subscription vencida queda PRO sin pagar. Es
  el comportamiento buscado (una cortesía es una cortesía), pero no hay
  vencimiento para las concesiones: si se necesita, va como campo aparte.

### Migración

`20260903000000_add_plan_override` agrega la columna y hace backfill: los
owners con `plan = 'PRO'` y **sin ninguna fila de `Subscription`** pasan a
`planOverride = 'PRO'`.

Deliberadamente **no** se usa "sin subscription vigente": por el defecto (1) hay
filas con `plan = 'PRO'` y subscription vencida hace meses, y tratarlas como
concesión les regalaría PRO permanente.

Límite conocido: una concesión a un owner que además tuvo alguna subscription no
es recuperable de los datos, porque `updateUserPlan` no registraba nada. Hay que
volver a aplicarla a mano. Al momento de la migración: **0 filas** en esa
situación (verificado contra producción).

## Related

- Issue #245 — el análisis que originó este ADR
- #244 — el parche anterior (`computeEffectivePlan`), que degradaba en tiempo de
  lectura pero mantenía la columna como autoridad. Reemplazado por esto.
- #246 — qué pasa con los recursos que exceden el límite después de un
  downgrade. Este cambio lo activa: un owner que era PRO por período nulo pasa a
  FREE y puede quedar por encima del límite.
- ADR-0027 §3 — el cron EXPIRED_CHECK como fallback cuando MP no notifica.
