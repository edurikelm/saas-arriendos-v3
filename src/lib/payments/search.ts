/**
 * Interpretación de lo que el usuario escribe en el buscador de `/payments`.
 *
 * El buscador es un solo campo que cubre cliente, propiedad, concepto y monto.
 * Los tres primeros son texto y van con `contains`; el monto es un `Decimal` y
 * necesita que el texto se convierta en número antes de poder compararlo.
 */

/**
 * Convierte el texto del buscador en un monto, o `null` si no es uno.
 *
 * Acepta las formas en que un monto aparece en pantalla: `450000`, `450.000` y
 * `$450.000`. El punto es separador de MILES en es-CL, no decimal, así que se
 * descarta junto al resto de los símbolos en vez de interpretarse como coma
 * decimal — `450.000` es cuatrocientos cincuenta mil, no cuatrocientos cincuenta.
 *
 * Devuelve `null` cuando no queda ningún dígito, para que una búsqueda por
 * nombre no arrastre una cláusula de monto que nunca va a calzar. También para
 * un número que exceda el entero seguro de JavaScript: comparar contra un valor
 * ya redondeado daría un resultado plausible y equivocado.
 */
export function parseAmountQuery(query: string): number | null {
  const digits = query.replace(/\D/g, "");
  if (digits === "") return null;

  const amount = Number(digits);
  return Number.isSafeInteger(amount) ? amount : null;
}
