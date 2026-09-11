import type { Prisma } from "@prisma/client";

/**
 * Orden del listado de `/payments`.
 *
 * Las claves son de la VISTA, no de la base: "cliente", no
 * "reservation.client.name". El mapeo vive acá, así que lo que llega por la
 * URL nunca toca un campo directamente — es una lista blanca, no una
 * traducción.
 */

export const PAYMENTS_SORT_KEYS = ["cliente", "monto", "estado"] as const;
export type PaymentsSortKey = (typeof PAYMENTS_SORT_KEYS)[number];

export const SORT_DIRECTIONS = ["asc", "desc"] as const;
export type SortDirection = (typeof SORT_DIRECTIONS)[number];

/**
 * Orden por defecto: el historial se lee del cobro más reciente al más viejo.
 *
 * Es el mismo que fijó el arreglo del orden cronológico, y el que recupera la
 * tabla al apagar el orden de una columna. No se expone como columna ordenable
 * porque la fecha no tiene columna propia: vive en la segunda línea de Estado,
 * donde además cambia de significado según el estado —emitido, vence, pagado—.
 */
export const DEFAULT_PAYMENTS_ORDER: Prisma.PaymentOrderByWithRelationInput = {
  createdAt: "desc",
};

export function isPaymentsSortKey(value: string | undefined): value is PaymentsSortKey {
  return value != null && (PAYMENTS_SORT_KEYS as readonly string[]).includes(value);
}

function isSortDirection(value: string | undefined): value is SortDirection {
  return value != null && (SORT_DIRECTIONS as readonly string[]).includes(value);
}

/**
 * Traduce el orden de la vista a un `orderBy` de Prisma.
 *
 * Cae al orden por defecto ante cualquier cosa que no esté en la lista blanca:
 * los dos valores llegan de la URL, así que cualquiera puede escribir
 * `?sortBy=password`. Sin la lista, eso sería un campo arbitrario.
 *
 * La dirección por defecto es `asc` cuando hay clave válida: se pide un orden
 * por columna para leer de menor a mayor o de la A a la Z.
 */
export function buildPaymentsOrderBy(
  sortBy?: string,
  sortDir?: string,
): Prisma.PaymentOrderByWithRelationInput {
  if (!isPaymentsSortKey(sortBy)) return DEFAULT_PAYMENTS_ORDER;

  const dir: SortDirection = isSortDirection(sortDir) ? sortDir : "asc";

  switch (sortBy) {
    case "cliente":
      return { reservation: { client: { name: dir } } };
    case "monto":
      return { amount: dir };
    case "estado":
      return { status: dir };
  }
}
