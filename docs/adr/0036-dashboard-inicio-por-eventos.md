# ADR-0036: `/dashboard` — inicio por eventos, no por reserva

## Status

Accepted (2026-09-14)

## Context

Medido en producción el 2026-09-14, sobre el único owner con reservas (7 propiedades, 8 reservas):

1. La vista por defecto ("Próximas") de la tabla "Agenda de reservas" estaba vacía, y el KPI
   "Próximas Reservas" decía "0 · Sin check-ins próximos", el mismo día en que llegaba un huésped.
   Una reserva que empieza hoy caía en la vista "Activas", que no se ve por defecto.
2. La franja `OccupancyStrip` decía "9% de ocupación" justo debajo del KPI "Ocupación Actual" en
   57%. La franja filtraba solo reservas `DAILY`; con los 2 contratos mensuales de la cuenta, los
   próximos 14 días estaban al 38%.
3. La franja dibujaba 2 de 7 propiedades: solo las que tenían reservas diarias en el rango.
   Escondía las 2 con contrato mensual y las 3 libres.
4. Las salidas no aparecían en ninguna parte. `endDate` es la última noche, así que el día de salida
   la reserva ya está "Finalizada" y sale de la tabla, del KPI y de la franja.
5. La franja era un segundo calendario que no recibió las decisiones ya tomadas en `/calendar`:
   mensuales incluidas, carriles para reservas simultáneas, y relleno sin `bg-primary`/
   `text-primary-foreground` (mide 2.28:1, bajo AA).
6. La página repetía cada cifra — "próximas" en el KPI, la tabla y la franja; vencidos en el
   subtítulo, el KPI y la lista — mientras salidas, propiedades libres y fines de contrato no
   aparecían nunca.
7. 3 de las 4 cuentas owner en producción no tenían reservas (2 tampoco propiedades): veían cuatro
   ceros y tres cajas vacías.
8. Ya hubo un intento de bloque "Hoy": commit `8d17e61` (2026-08-30), revertido en `e63ce02`
   (2026-08-31) porque no convenció al usuario. Agregaba una franja de texto arriba y dejaba intactas
   la tabla y la franja de ocupación, así que era una copia más de lo mismo que ya repetía la cifra.
   La diferencia de este cambio es que reemplaza esas dos piezas en vez de sumar una tercera.

## Decision

La página pasa a tener cuatro zonas. Cada una responde una pregunta propia y ninguna cifra se
repite entre zonas.

### 1. Agenda · próximos 7 días

Reemplaza la tabla "Agenda de reservas" (con su toggle Próximas/Activas), la franja de ocupación y
el KPI "Próximas Reservas". La unidad pasa de ser la RESERVA (un registro con estado) a ser el
EVENTO — algo que el dueño atiende un día concreto:

- Llegada el día de `startDate`; salida el día `endDate + 1`, por la convención de Última Noche.
- `DAILY` y `MONTHLY` entran igual: el inicio de un contrato es una llegada y su fin una salida.
  Aparecen solo la semana en que ocurren — no ocupan filas el mes entero. Ese fue el problema de
  `54203da`, que metió los contratos en la tabla por sus dos eventos y dejó dos de ellos ocupando 2
  de 6 filas durante un mes; `e63ce02` lo cita como la causa de los dos intentos anteriores.
- Reservas `CANCELLED` quedan fuera. Hoy siempre aparece, tenga o no eventos; los demás días solo si
  tienen alguno. Dentro de un día, salidas antes que llegadas — la unidad se libera antes de volver
  a ocuparse.
- El monto de la fila (`amountDue`) es el mismo que esa reserva tiene en "Por cobrar": mismo cálculo
  (`amountForRow`), sobre la ventana de cobranza completa y no sobre los items visibles de esa
  lista. Va sin color — el color de la plata vive en "Por cobrar".
- Una semana sin eventos dice cuándo es el próximo movimiento en vez de quedar en blanco.
- Cada fila lleva el punto de color de su propiedad (`PropertyDot`, `property.color` con fallback
  `--primary`) — la misma clave que identifica la propiedad en `/calendar`. Es identidad, no estado.
- Una llegada `DAILY` agrega "última noche `<día relativo>`", con `lastNightDateKey = endDate`
  (la misma convención de Última Noche); `MONTHLY` no la muestra, porque ahí la fecha que importa
  ya la nombra la salida (fin del contrato). **Actualizado (2026-09-17):** la fila pasa a tres
  líneas con el esqueleto de una fila de cobros — cliente y monto; propiedad y "sin pagos"/"saldo";
  duración, unidades y última noche a todo el ancho —, porque en la columna de 1/3 la línea
  "propiedad · noches · unidades" se truncaba en 8 de 12 filas de una semana cargada. Las salidas
  dejan de mostrar última noche y duración (la primera es siempre la víspera, la segunda ya no se
  coordina) y solo nombran las unidades si son varias; con eso `relativeDayInline` pierde el caso
  "ayer", que solo existía para ellas.
- **Tope de 6 filas (2026-09-17)**, el mismo que "Por cobrar": hoy y mañana siempre completos,
  después días enteros mientras quepan (`cutAgendaDays`), y el resto al pie como "+N movimientos
  más · hasta el `<día>`" con link a `/calendar`. Sin tope, una semana de 12 movimientos medía
  1106px contra 626px de cobros a 1280 y dejaba el mes a 1286px, fuera de la primera pantalla.
- Hoy sin eventos ya no ocupa una fila propia: la banda del día dice "Sin llegadas ni salidas" — el
  subtítulo de la página ya anuncia un día vacío, así que una fila entera para repetirlo empujaba
  hacia abajo los días con eventos (PR #303).
- Un click simple en una fila abre el mismo preview que `/calendar` en vez de navegar (ver
  ADR-0039); Cobros y Propiedades siguen navegando directo.

### 2. Por cobrar

Sin cambios: sigue vigente ADR-0033 (agrupación por urgencia en dos grupos, color solo en el
encabezado del grupo).

### 3. Propiedades

Reemplaza la franja de ocupación con una línea por propiedad, todas incluidas:

- Ocupación de la noche de hoy: Σ `unitsBooked` de reservas no canceladas que cubren hoy, más 1 por
  cada Bloqueo de Canal Externo `ACTIVE` que cubre hoy — la misma regla que la disponibilidad. Por
  eso la consulta de bloqueos se agregó a `src/lib/actions/dashboard.ts`, con tenencia vía
  `property.userId`.
- Estados `OCCUPIED` / `PARTIAL` / `FREE`, mostrados como frase: "Ocupada · libre desde vie 18",
  "Mensual · libre desde jue 1 oct", "Airbnb · libre desde lun 21", "Libre · llega sáb 26".
- **Toda fecha de una propiedad ocupada es el día en que se puede volver a arrendar** (última noche
  + 1), nunca la última noche. La primera versión mezclaba dos referencias en la misma columna:
  "sale vie 18" nombraba el día de salida de una diaria, y "hasta 30 sept" la última noche de una
  mensual. Además, el dueño leyó "sale vie 18" como "el 18 sigue ocupada", cuando ese día ya puede
  llegar otro huésped (la disponibilidad se cuenta por noches). La salida como evento sigue en la
  agenda, con la misma fecha.
- Con varias unidades, cuenta unidades en vez de nombrar a un ocupante. Una propiedad parcial dice
  cuántas quedan libres ("1 libre · 2 de 3 ocupadas"): ya se puede arrendar. Una completa dice desde
  cuándo hay lugar ("Completa · libre desde mié 30"), sin prometer cuántas unidades se liberan ese
  día, porque de sus ocupantes solo se conoce el que sale primero.
- Sobreventa (consumidas > disponibles) se marca en ámbar (`text-warning-text`), no en rojo: el
  mismo tono que ya usa la alarma de sobreventa de `/calendar`, reservado para lo accionable. La
  frase nombra la cantidad exacta: "Sobreventa · 2 ocupaciones para 1 unidad".
- El encabezado agrega "N de M ocupadas hoy", con `min(ocupadas, disponibles)` por propiedad para
  que la sobreventa no infle el total.
- Contesta "¿qué tengo libre?" en palabras; la grilla espacial por día sigue siendo trabajo de
  `/calendar`.

### 4. El mes

Reemplaza los 4 KPIs anteriores ("Ingresos Mensuales", "Pagos Pendientes", "Próximas Reservas",
"Ocupación Actual") por dos `KpiCard`: "Cobrado" y "Ocupación del mes".

- Cobrado se compara contra el MISMO tramo del mes anterior (día 1 a `min(día de hoy, último día de
  ese mes)`), en monto, no en porcentaje. Antes comparaba el mes en curso parcial contra el mes
  anterior completo, así que cada comienzo de mes marcaba una caída que no existía.
- Ocupación: mes calendario completo, noches ya reservadas incluidas, vía `buildDecisionSummary`
  (ADR-0028/0029).
- "Pagos Pendientes" y "Próximas Reservas" repetían lo que ya dicen "Por cobrar" y la agenda;
  "Ocupación Actual" lo dice ahora el tablero de propiedades.

### Cuenta sin reservas

En vez de las cuatro zonas (cuatro ceros y cajas vacías para 3 de las 4 cuentas owner de
producción), se muestra "Primeros pasos": dos pasos, agregar la primera propiedad y crear la primera
reserva. No son tres porque el formulario de reserva crea al cliente en el mismo flujo ("Crear
nuevo cliente...").

### Título y subtítulo

El título es la fecha ("Lunes 14 de septiembre"); "Dashboard:" queda solo para lectores de
pantalla, que se orientan por el `h1`. El subtítulo resume movimientos de hoy más cobros vencidos —
los vencidos salen de `collection.windowGroups.OVERDUE`, el mismo dato que ya alimenta el
encabezado "Vencidos" de "Por cobrar" (ADR-0033), no una segunda agregación.

### Layout

> **Actualizado (PRs #302/#303, 2026-09-16).** Esta sección describía dos columnas desde `xl`, con
> agenda y propiedades en `xl:col-span-2` (2/3 del ancho). A ese ancho las filas de agenda y
> propiedades — nombre + una cifra corta — dejaban un hueco horizontal, y la card de agenda se
> estiraba a la altura de la de cobros. El layout vigente es el que se describe abajo; la razón por
> la que dos columnas esperan a `xl` (más abajo no entra monto y vencimiento en la misma fila) sigue
> siendo válida para el mismo salto de dos a tres columnas.

> **Actualizado (2026-09-17).** El mes iba bajo la agenda, con `xl:col-start`/`row-span-2` sobre
> una sola grilla. Eso equilibraba las columnas con datos parecidos a producción, pero con una
> semana cargada la agenda (sin tope entonces) medía 1106px y dejaba el mes a 1286px, fuera de la
> primera pantalla a 1280×800, con ~700px vacíos bajo cobros y propiedades. Con el tope de 6 filas
> de la agenda, el layout vigente es el de abajo.

Tres columnas desde `xl`, dos desde `lg`, apiladas en móvil. A `lg` (1024px, con sidebar) una
columna de más dejaría cada una en ~224px, sin espacio para monto y vencimiento en la misma fila.

Agenda y cobros van en una grilla propia (`xl:col-span-2`, `lg:grid-cols-2`) y **se estiran al
mismo alto**: son las dos listas que piden acción, con el mismo tope de 6 filas, y leídas lado a
lado su pie ("+N movimientos más", "Total") queda a la misma altura (`DashboardSection` es una
columna flex de alto completo y cada pie lleva `mt-auto`). Propiedades y el mes van en la tercera
columna, uno sobre otro y cada uno del alto de su contenido (`items-start`): estirar agenda y
cobros al alto de esa columna los vaciaría con muchas propiedades. No hay acomodo visual: el DOM y
la pantalla siguen el mismo orden — agenda, cobros, propiedades, mes —, el del móvil, el teclado y
un lector de pantalla, y el criterio original de lo que pide acción primero.

Medido con el harness (semana de 12 movimientos, 11 cobros, 7 propiedades): a 1280px agenda y
cobros terminan en 782px y el mes empieza en 555px; a 1658px, 765px y 506px; con una semana quieta
a 1280, 427px y 506px. Los dos `KpiCard` del mes van lado a lado solo desde `2xl` (columna ~435px);
entre 1280 y 1535px siguen apilados porque a ~304px un monto en CLP no cabe en media columna.

### Fuera de alcance (pendiente)

- **Acciones en "Por cobrar"** (resuelto en ADR-0037) (marcar pagado, enviar link) quedan para un cambio aparte de Nivel 3
  (ADR-0017), porque tocan pagos. Medido: de los 4 cobros del día, solo 1 tenía un `Payment`
  `PENDING` sobre el cual `MarkPaidDialog` pudiera actuar; las 2 reservas `DAILY` con deuda no
  tenían ninguna fila de `Payment`, así que ahí la acción real es "registrar pago" (crear), no
  "marcar pagado". Una fila `MONTHLY` puede agrupar varias cuotas, y falta decidir sobre cuál se
  actúa. Solo 2 de 4 clientes con reservas tienen teléfono, así que WhatsApp no puede ser la única
  vía de contacto.
- **"Reservas por confirmar"** (hallazgo E4 de `docs/plans/dashboard-improvement-plan.md`) se
  descarta como señal propia: una reserva pasa a `CONFIRMED` sola cuando se completa el pago
  (`confirmReservationIfPaid`, ADR-0025), así que `PENDING` equivale a "tiene saldo" — señal que ya
  está en "Por cobrar".

## Implementation

- `src/lib/dashboard/summary.ts` — agrega `agenda` (`DashboardAgenda` / `DashboardAgendaDay` /
  `DashboardAgendaEvent`), `propertyBoard` (`DashboardPropertyBoard` / `DashboardPropertyStatus` /
  `DashboardPropertyOccupant`) y `month` (`DashboardMonthPulse`) a `DashboardSummary`; nuevo input
  opcional `externalBlocks` (`DashboardExternalBlockInput`) y constante `AGENDA_HORIZON_DAYS = 7`.
  `collection` / `collectionItems` no cambian (ADR-0033).
- `src/lib/actions/dashboard.ts` — agrega la consulta de `ExternalChannelBlock` `ACTIVE` con
  tenencia vía `property.userId`, y un margen de 2 días sobre `endDate` para no perder un bloqueo
  por la hora a la que quedó guardado.
- Componentes nuevos en `src/app/(dashboard)/dashboard/_components/`: `dashboard-home.tsx` (cuerpo
  de la página, separado de `page.tsx` para poder renderizarse con datos armados a mano, sin sesión
  ni base — tests y revisión visual), `dashboard-agenda.tsx`, `dashboard-property-board.tsx`,
  `dashboard-month-pulse.tsx`, `dashboard-onboarding.tsx`, `day-labels.ts` (fechas relativas: "hoy",
  "mañana", "vie 18").
- PRs #302/#303 (2026-09-16) agregan `dashboard-section.tsx` (`DashboardSection`, banda de título
  tonal reutilizada por agenda, cobros y propiedades — ver DESIGN.md, "The Banded Section Rule") y
  `property-dot.tsx` (`PropertyDot`). `summary.ts` suma `lastNightDateKey` a `DashboardAgendaEvent`
  y `propertyColor` opcional a `DashboardAgendaEvent` / `DashboardPropertyStatus`; `day-labels.ts`
  suma el caso "ayer" a `relativeDayInline`.
- 2026-09-17: `dashboard-agenda.tsx` suma `AGENDA_ROW_LIMIT` y `cutAgendaDays` (tope de filas) y
  reordena la fila en tres líneas; `dashboard-home.tsx` pasa a dos grillas anidadas (agenda y cobros
  del mismo alto; propiedades y mes en la tercera columna); `DashboardSection` es columna flex de
  alto completo; `day-labels.ts` quita "ayer"; `globals.css` suma `--primary-text` para los links
  de las bandas (ver DESIGN.md, The Fill-vs-Text Rule).
- `src/app/(dashboard)/dashboard/page.tsx` — pasa a cargar datos y delegar el render a
  `DashboardHome`; conserva el fallback de error.
- Eliminados, con sus tests: `DashboardReservasTable` (tabla "Agenda de reservas" y su toggle
  Próximas/Activas) y `OccupancyStrip`. De `summary.ts`: `income`, `upcoming`, `occupancy`, `today`,
  `upcomingReservations`, `activeReservations`, `occupancyStrip`.

## Consequences

### Positive

- Cada zona responde una pregunta distinta y ninguna cifra se repite: agenda, cobros, propiedades y
  mes cubren juntos, sin superposición, lo que antes competía por el mismo espacio bajo tres
  nombres.
- Las salidas son visibles por primera vez: antes desaparecían el mismo día en que ocurrían.
- `DAILY` y `MONTHLY` conviven en la agenda y en el tablero sin señal aparte: un owner 100% mensual
  deja de ver una sección vacía de forma permanente.
- Todas las propiedades tienen una línea, también las libres: "¿qué tengo disponible?" se contesta
  sin filtrar nada.
- Una cuenta sin reservas ve un camino de dos pasos en vez de cuatro ceros y tres cajas vacías.

### Negative

- El inicio pierde la grilla espacial de 14 días que tenía la franja de ocupación; para ver la
  ocupación día a día hay que ir a `/calendar`. Se acepta porque esa grilla ya solo cubría 2 de 7
  propiedades.
- El horizonte de la agenda es de 7 días: una llegada de aquí a 8–14 días no aparece en el inicio,
  salvo que la semana visible esté vacía (ahí se anuncia como "próximo movimiento"). Un horizonte
  más largo vuelve a acercarse al problema que tumbó los intentos anteriores (filas ocupadas todo un
  mes), pero un owner que planifica a dos semanas sigue necesitando `/reservations` o `/calendar`.
- Las acciones sobre un cobro (marcar pagado, enviar link, contactar por WhatsApp) siguen sin
  existir en el inicio: cualquier acción real obliga a navegar a `/payments` o al detalle de la
  reserva.
- Con una cartera grande (~20 propiedades) el tablero es una lista larga de scroll, sin paginación
  ni agrupación propia.

## Related

- ADR-0017 — niveles de cambio; las acciones de cobro diferidas son Nivel 3.
- ADR-0018 — iCal no es fuente financiera: los Bloqueos de Canal Externo alimentan el tablero de
  propiedades, nunca una cifra de plata ni un evento de agenda.
- ADR-0025 — `confirmReservationIfPaid`, por qué `PENDING` no necesita señal propia.
- ADR-0028 / 0029 / 0030 — semántica de KPIs financieros y `buildDecisionSummary`, fuente de
  `month.collected` y la ocupación del mes.
- ADR-0033 — agrupación de "Por cobrar" por urgencia; sigue vigente, sin cambios en este ADR.
- ADR-0037 — acciones de cobro sobre `nextCharge`.
- ADR-0039 — click en la agenda abre el preview de la reserva.
- `docs/plans/dashboard-improvement-plan.md` — diagnóstico previo (ver nota de estado al inicio del
  documento).
- `DESIGN.md` — "The Banded Section Rule" (patrón de `DashboardSection`).
- `CONTEXT.md` — sección "`/dashboard` — agenda, propiedades y el mes".
