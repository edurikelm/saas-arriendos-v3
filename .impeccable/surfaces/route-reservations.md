---
version: 1
slug: "route-reservations"
primary_target: "route:/reservations"
related_targets: ["src/components/reservations/reservations-list-client.tsx","src/components/reservations/reservation-table.tsx","src/components/reservations/reservation-list-item.tsx","src/components/reservations/reservation-finance.ts","src/components/reservations/reservation-actions-menu.tsx"]
---

# /reservations — lista de reservas

**Modo: Operate.** El owner abre esta página para triar, no para leer: quién le
debe, cuánto, y qué fila hay que tocar hoy. Escaneabilidad por encima de todo lo
demás. El detalle de una reserva es otra superficie (`/reservations/[id]`) y no
se rige por este brief.

## Alcance

`reservations-list-client.tsx` (contenedor, filtros, contador), y las dos vistas
de la misma lista: `reservation-table.tsx` (≥768px) y `reservation-list-item.tsx`
(móvil). El seam `reservation-finance.ts` y el menú `reservation-actions-menu.tsx`
son compartidos por las dos a propósito: cada vez que la lógica vivió duplicada,
las dos vistas terminaron diciendo cosas distintas de la misma reserva.

## Decisiones durables

**Una sola magnitud por columna de dinero.** La columna se llama por la cantidad
que contiene ("Por cobrar"), no por el tema ("Finanzas"). Un encabezado que
nombra un tema tolera una cifra distinta en cada fila, que es como llegó a tener
una palabra, un saldo, un total y otro total según el estado. La cantidad es **lo
que falta cobrar**; el subtexto dice lo que ya entró. Alineada a la derecha con
`tabular-nums`: la columna existe para compararse en vertical.

**El subtexto explica el monto, nunca nombra otro.** El bug canónico fue
"$420.000 / Restante de $620.000": dos cifras y la palabra pegada a la que no
describe.

**Tres tonos de urgencia, derivados así:** si la reserva tiene calendario de
cuotas (`dueDate`, que en producción solo traen los MONTHLY), vencido es una
cuota no COMPLETED con vencimiento pasado. Si no lo tiene (DAILY), vencido es que
la estadía ya empezó y queda saldo. Sin esa distinción, un arriendo mensual al
día se pinta igual que uno moroso, porque "la estadía empezó" no separa a uno del
otro. Los tonos van en el monto y en ningún otro lado de la fila: nada de barras
verticales de color ni bordes laterales teñidos.

**El color no puede ser el único portador.** La columna Estado ya dice ACTIVA /
FINALIZADA frente a PRÓXIMA en la misma fila, y eso es lo que sostiene la
distinción para quien no ve el tono.

**Móvil es la misma tabla en otro ancho**, no un formato distinto: filas
divididas dentro de un contenedor único con el framing del `DataTable`, no una
card por reserva. Las etiquetas sobre cada dato y la barra de tres botones eran
lo que hacía que entraran menos de dos reservas por pantalla.

**Las acciones viven en el ⋮ en las dos vistas.** Un solo componente, mismo
conjunto de acciones y mismas condiciones de aparición.

**El contador dice lo que hay en pantalla.** El rango sale del offset de página
más las filas dibujadas. Mientras haya un filtro de cliente activo (búsqueda o
pago), esos recortan solo la página cargada, así que el contador cambia de forma
en vez de prometer un rango contra el total del servidor.

## Restricciones

- **El ancho útil real es 959px**, no el viewport: en un laptop de 1280 el
  sidebar se lleva 256 y el padding 48. Toda columna nueva se mide contra eso.
- La columna de acciones va `sticky` al borde derecho. Las filas no son
  clickeables (The Row Isolation Rule), así que si el ⋮ se sale del área visible
  la lista queda de solo lectura sin que nada lo señale.
- Una columna que repite lo que otra ya dice no entra. "Tipo" (DIARIA/MENSUAL)
  salió porque el sublabel de Estancia distingue lo mismo y además dice cuánto
  dura.

## Sin resolver

- **DAILY no tiene vencimiento real.** Sus pagos no llevan `dueDate`, así que su
  urgencia es una aproximación por fecha de inicio. Si algún día se les asigna
  vencimiento, la rama de cuotas ya lo cubre sin tocar la UI.
- La lista no está agrupada por estado. Si alguna vez se agrupa, aplica The
  Grouped Status Rule y el color del monto se va al encabezado del grupo.
