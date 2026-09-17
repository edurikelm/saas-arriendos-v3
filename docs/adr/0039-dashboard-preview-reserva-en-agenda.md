# ADR-0039: `/dashboard` — click en la agenda abre el preview de la reserva

## Status

Accepted (2026-09-16)

## Context

Cada fila de la agenda del inicio (ADR-0036) es un `<a href="/reservations/[id]">`: un click navega
a la página completa de la reserva. `/calendar` ya resuelve el mismo gesto distinto — un click sobre
un bloque de reserva abre `ReservationPreviewDialog`, un modal con lo esencial (cliente, fechas,
monto, estado) y un link "Ver reserva completa" para cuando hace falta actuar. La agenda del inicio
es, en los hechos, una segunda vista de las mismas llegadas y salidas que muestra el calendario, así
que el mismo click producía dos experiencias distintas según la pantalla: una navegación completa en
el inicio, un preview liviano en el calendario.

## Decision

**Un click simple en una fila de la agenda abre el mismo `ReservationPreviewDialog` que
`/calendar`, sin navegar. La fila sigue siendo un link real.**

- Nuevo `ReservationPreviewLink` (`src/app/(dashboard)/dashboard/_components/reservation-preview-link.tsx`,
  client component): envuelve el contenido de la fila en un `<Link href="/reservations/[id]">` y en
  el click izquierdo simple hace `preventDefault`, trae el detalle y abre el diálogo. Ctrl/cmd/shift/
  alt + click, click del medio y la navegación sin JS siguen abriendo la página, porque siguen siendo
  las interacciones nativas de un `<a>` — el componente no las intercepta.
- El detalle se trae **al click**, con `GET /api/reservations/[id]` — la misma ruta que usa
  `/calendar` para su propio preview, no una nueva. La agenda del inicio no carga notas, canal de
  origen ni pagos serializados de cada reserva visible; pagar ese costo por fila para un modal que
  casi nunca se abre no se justifica.
- Si la petición falla, el componente navega a `/reservations/[id]` en vez de fallar en silencio: el
  dueño igual llega a la reserva, que es lo que pidió con el click.
- Mientras carga, la fila queda con `aria-busy` y atenuada (`opacity-70`, cursor de progreso); un
  segundo click durante la carga no dispara una segunda petición.
- Alcance: solo la agenda. Las filas de "Cobros pendientes" y del tablero de propiedades siguen
  navegando directo a `/reservations/[id]` y `/properties/[id]` — ninguna de las dos pide el mismo
  vistazo rápido que la agenda, que es la sección con más filas y más tráfico de "¿quién es este?".

## Implementation

- `src/app/(dashboard)/dashboard/_components/reservation-preview-link.tsx` (nuevo).
- `src/app/(dashboard)/dashboard/_components/dashboard-agenda.tsx` — la fila usa
  `ReservationPreviewLink` en vez de `<Link>` directo.
- Reutiliza sin cambios `ReservationPreviewDialog` (`src/components/reservations/reservation-preview-dialog.tsx`)
  y `GET /api/reservations/[id]`.

## Consequences

### Positive

- La agenda del inicio y `/calendar` responden el mismo gesto de la misma forma.
- El costo de datos del preview se paga solo cuando se abre uno, no por cada fila renderizada.
- Ctrl/cmd/shift/alt + click, click del medio, "Abrir en pestaña nueva" y la navegación sin
  JavaScript siguen funcionando sin código adicional, porque el elemento sigue siendo un `<a>` real.

### Negative

- Un click agrega una petición de red antes de mostrar el preview (sin caché entre filas): abrir dos
  reservas seguidas las trae dos veces.
- Si `/api/reservations/[id]` fallara de forma sostenida, el click parece "más lento" antes de caer a
  la navegación normal, en vez de navegar directo como antes.

## Related

- ADR-0036 — diseño de la agenda del inicio por eventos.
- `/calendar` (`calendar-timeline.tsx`, `calendar-view.tsx`) — origen de `ReservationPreviewDialog`.
- `CONTEXT.md` — sección "`/dashboard` — agenda, propiedades y el mes".
