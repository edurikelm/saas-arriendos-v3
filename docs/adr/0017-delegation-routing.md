# ADR-0017: Routing de delegación entre orquestador y subagentes

## Status

Aceptado

## Context

El protocolo de `AGENTS.md` define que el orquestador debe delegar a subagentes cuando aporte velocidad, cobertura o calidad, y exige verificación con `tester` y `reviewer` para cambios críticos (pagos, auth, disponibilidad, roles, webhooks). Sin embargo, **no establece un criterio operativo para decidir cuándo delegar y cuándo ejecutar directamente**.

En la práctica esto generó dos riesgos:

1. **Sobre-delegación**: tareas puramente cosméticas (ajustes de layout, padding, dark mode) terminaban pasando por `implementer` + `reviewer` con un costo de coordinación mayor que el valor entregado. Para un cambio de 50 líneas de Tailwind, escribir el brief, esperar la ejecución, integrar el resultado y revisar costaba más que hacerlo directo con verificación visual.

2. **Sub-delegación**: tareas que parecían cosméticas pero modificaban comportamiento condicional de UI (reglas de breakpoints, estado de colapso, interacciones con hover/touch) se ejecutaban directo sin segunda mirada. Un ejemplo real: un cambio en la regla `xl:grid` rompió el colapso de filtros en desktop y solo se detectó por screenshot tardío, no por revisión.

El tamaño del diff es una **señal débil** del riesgo real. El riesgo depende del **dominio tocado** y de si el cambio altera comportamiento observable por el usuario, no del número de líneas modificadas.

## Decision

Adoptar un modelo de **tres niveles** basado en el riesgo del cambio, no en su tamaño. El orquestador decide el nivel antes de empezar a trabajar.

### Nivel 1 — Cosmético (orquestador ejecuta directo)

**Qué incluye:** cambios de estilo, layout, espaciado, tipografía, color, animaciones puras, refactors sin cambio de comportamiento. Sin tocar lógica, contratos de API, ni persistencia.

**Flujo:**
- El orquestador lee contexto, plantea el plan y aplica los cambios.
- Verificación: `tsc --noEmit`, tests existentes que toquen los archivos modificados, y validación visual con Chrome DevTools en mobile + desktop.
- Sin subagentes.

**Por qué:** el costo de coordinar 3 subagentes para un cambio puramente visual es mayor que el valor que aportan. La verificación visual ya implica una sesión de Chrome DevTools que solo el orquestador puede sostener.

### Nivel 2 — Comportamiento de UI o dominio no crítico

**Qué incluye:** features con estado, validaciones nuevas, CRUDs, refactors de módulos, migraciones de schema no destructivas, nuevos endpoints, cambios en interacciones (hover, focus, click, drag), componentes con condicionales que afectan lo que el usuario ve.

**Flujo:**
- El orquestador plantea el plan.
- `implementer` ejecuta con brief claro (archivos, breakpoints, componentes, reglas de diseño).
- `reviewer` revisa el resultado, buscando regresiones, acoplamiento y convenciones del repo.
- `tester` opcional o por demanda cuando el cambio introduce lógica testeable.

**Por qué:** un revisor externo mira el código con ojos frescos y suele encontrar cosas que el autor obvía. La regresión del `xl:grid` que rompió el colapso en desktop es exactamente el tipo de bug que un `reviewer` cazaría en una pasada.

### Nivel 3 — Dominio crítico

**Qué incluye:** pagos, auth, disponibilidad, roles, webhooks, facturación, migraciones destructivas de schema, todo lo que el `AGENTS.md` ya marca como crítico.

**Flujo:**
- `architect` revisa el diseño si hay ambigüedad sobre límites de dominio.
- `implementer` ejecuta.
- `tester` valida con escenarios reproducibles y tests de integración.
- `reviewer` revisa con foco en seguridad, idempotencia, manejo de errores, regresiones.
- `implementer` no se considera completo hasta que `tester` y `reviewer` aprueban.

**Por qué:** el costo de un bug aquí es desproporcionado. Una regresión en webhooks de Mercado Pago puede dejar reservas sin pagar, o un cambio de roles puede exponer datos. La inversión de tiempo en verificación se paga sola.

### Criterios objetivos para clasificar

**Es Nivel 1 solo si todas estas son verdaderas:**
- No cambia comportamiento observable (solo estilo, layout, color, espaciado).
- No introduce ni modifica `useState`, `useEffect`, hooks, handlers de eventos.
- No modifica server actions, endpoints, ni queries.
- No afecta migraciones de base de datos.
- El cambio no toca archivos en `src/lib/actions/`, `src/lib/mercadopago/`, `src/lib/auth/`, ni lógica de pagos.

**Si cualquiera falla, es Nivel 2 como mínimo.**

**Es Nivel 3 si toca:**
- `src/lib/actions/auth.ts`, `src/lib/actions/reservations.ts` cuando afecta pagos, `src/lib/mercadopago/`, webhooks, OAuth.
- Migraciones en `prisma/migrations/` que alteren datos existentes o cambien constraints.
- Cualquier cosa que mencione roles, permisos, o RLS.

### Política de escalación

Cuando el orquestador dude entre Nivel 1 y Nivel 2, **escala hacia arriba**. Es preferible gastar 5 minutos coordinando un `reviewer` que descubrir la regresión en producción. La duda es una señal de que el cambio es más riesgoso de lo que parece.

### Anti-patrones

- **Delegar todo por defecto**: el orquestador pierde contexto y velocidad en tareas chicas.
- **Nunca delegar por inercia**: el orquestador acumula bugs propios que un revisor externo cazaría.
- **Confundir tamaño con riesgo**: 200 líneas de CSS sin condicionales son Nivel 1; 10 líneas que cambian un webhook son Nivel 3.
- **Saltarse el protocolo en Nivel 3 "porque es urgente"**: los bugs críticos no se vuelvan menos urgentes por apurarse.

## Implementation

Esta decisión se aplica de inmediato en futuras tareas del orquestador. No requiere cambios de código en el producto.

**Documentación relacionada:**
- `AGENTS.md` — agrega referencia breve a este ADR.
- `CONTEXT.md` — sin cambios (este ADR es sobre proceso, no sobre dominio).
- `DESIGN.md` — sin cambios (este ADR no es sobre sistema de diseño).

## Consequences

### Positive

- Criterio explícito y objetivo para decidir delegación, en lugar de juicio caso a caso.
- Reduce sobre-delegación en cambios cosméticos y sub-delegación en cambios de comportamiento.
- Crea una política de escalación que protege contra regresiones en producción.
- Acelera cambios Nivel 1 sin sacrificar calidad.
- Hace explícita la política de "duda → escalar", que captura el sesgo correcto.

### Negative

- El orquestador debe invertir tiempo en clasificar antes de actuar, incluso en tareas chicas.
- El criterio "cambia comportamiento observable" es subjetivo en algunos casos límite (ej. agregar `transition` es Nivel 1, agregar `useState` para controlar un toggle es Nivel 2).
- Los tests existentes no cubren los cambios cosméticos, así que la verificación Nivel 1 depende de la disciplina de validar visualmente con Chrome DevTools.
- Requiere que el equipo esté de acuerdo con la clasificación para que el sistema funcione.
