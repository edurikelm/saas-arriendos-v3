/**
 * Seam compartido para la columna de dinero de la lista de reservas.
 *
 * Consumido por `reservation-table.tsx` (desktop) y `reservation-list-item.tsx`
 * (móvil). Antes esta lógica vivía duplicada y divergente en los dos: la tabla
 * mostraba "$1.080.000 completado" donde la tarjeta mostraba "pagado", y solo
 * la tabla tenía la rama de CANCELLED.
 *
 * **El subtexto dice lo que entró, en las cuatro ramas.** El label es lo que
 * falta cobrar y el subtexto lo ya cobrado: juntos son los dos números que
 * importan para cobrar, y el total sale de sumarlos. La primera versión ponía
 * `"$200.000 de $620.000 abonado"`, que a 10px no cabe en la columna y partía
 * la fila en tres líneas — las alturas quedaban entre 77 y 97px y una tabla que
 * se lee en vertical no puede tener el renglón bailando.
 *
 * **Una sola magnitud por columna.** La versión anterior ponía en negrita cosas
 * distintas según la fila — "Saldado" (una palabra), lo que falta cobrar, el
 * precio total cuando no había abonos, y el total otra vez cuando estaba
 * cancelada. Una columna que se lee en vertical tiene que contener siempre la
 * misma cantidad, o deja de compararse. Acá esa cantidad es **lo que falta
 * cobrar**: es la que dispara acción y la que el owner compara entre filas
 * (PRODUCT.md: "who's paid, what needs action"). El total y lo abonado bajan al
 * subtexto, que ahora explica el número en vez de nombrar otro.
 *
 * **Sin tinte semántico en el monto.** DESIGN.md ya lo dice para las listas
 * agrupadas — "el monto nunca se tiñe con el color del estado: es el dato que
 * el usuario compara ENTRE filas, y un monto que cambia de color por fila deja
 * de ser escaneable como columna" — y el argumento vale igual acá. Queda un
 * binario: si hay algo por cobrar el monto va en `text-foreground`; si no, en
 * `text-muted-foreground`. El estado temporal de la reserva sigue viviendo en
 * su pill, que es su lugar.
 *
 * **Regla de CANCELLED:** una reserva cancelada no debe nada. Antes salía con
 * el precio total en rojo y el subtexto "Pendiente de pago" — al revés, porque
 * la cancelada es la única que NO está pendiente de cobro. Los pagos
 * completados se conservan como registro financiero.
 */

import { getReservationPaidAmount } from "@/lib/payments/calculations";
import { formatPrice } from "./reservations-utils";
import type { Reservation, ReservationPayment } from "./types";

export interface FinanceDisplay {
  /** Lo que falta cobrar. 0 cuando está saldada o cancelada. */
  amountDue: number;
  /** El monto formateado, o "—" cuando no hay nada que cobrar por estar cancelada. */
  label: string;
  /** Línea de apoyo: explica el monto, no nombra otro distinto. */
  subtext: string;
  /** Color del monto. Binario: se debe algo, o no. */
  labelClassName: string;
}

const DUE = "text-foreground";
const SETTLED = "text-muted-foreground";

export function getFinanceDisplay(
  payments: ReservationPayment[],
  totalPriceRaw: Reservation["totalPrice"],
  status: string,
): FinanceDisplay {
  const paidAmount = getReservationPaidAmount(payments);
  const totalPrice = Number(totalPriceRaw);

  if (status === "CANCELLED") {
    return {
      amountDue: 0,
      label: "—",
      subtext: paidAmount > 0 ? `${formatPrice(paidAmount)} cobrado` : "sin cobros",
      labelClassName: SETTLED,
    };
  }

  if (paidAmount >= totalPrice && totalPrice > 0) {
    return {
      amountDue: 0,
      label: formatPrice(0),
      subtext: `${formatPrice(paidAmount)} cobrado`,
      labelClassName: SETTLED,
    };
  }

  if (paidAmount > 0) {
    return {
      amountDue: totalPrice - paidAmount,
      label: formatPrice(totalPrice - paidAmount),
      subtext: `${formatPrice(paidAmount)} cobrado`,
      labelClassName: DUE,
    };
  }

  return {
    amountDue: totalPrice,
    label: formatPrice(totalPrice),
    subtext: "sin abonos",
    labelClassName: DUE,
  };
}
