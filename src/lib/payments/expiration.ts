/**
 * Vigencia de los links de pago de Mercado Pago.
 *
 * `Payment.expiresAt` es un INSTANTE, no una fecha de negocio:
 * - se compara contra `new Date()` en UI y acciones
 *   (`new Date(payment.expiresAt) < new Date()`),
 * - se valida como `z.string().datetime()`,
 * - se envia a Mercado Pago como `expiration_date_to`, que MP hace cumplir
 *   como momento absoluto.
 *
 * Por eso la vigencia se modela como una DURACION FIJA (7 x 24h) y no con
 * aritmetica de dias calendario. `addDays` de date-fns suma dias en wall-time
 * de la zona del runtime: al cruzar el cambio de horario de America/Santiago
 * devuelve 167h en un equipo local y 168h en Vercel (UTC). Misma linea de
 * codigo, links con vigencia distinta segun donde corre.
 *
 * ADR-0020 fija wall-time Santiago para fechas de NEGOCIO (Payment.dueDate,
 * disponibilidad, reservas). Un TTL tecnico no entra en esa regla: el ADR
 * excluye explicitamente los timestamps que representan instantes.
 */

/** Dias de vigencia de un link de pago desde su emision. */
export const PAYMENT_LINK_TTL_DAYS = 7;

/** Vigencia de un link de pago en milisegundos (duracion fija, sin DST). */
export const PAYMENT_LINK_TTL_MS = PAYMENT_LINK_TTL_DAYS * 24 * 60 * 60 * 1000;

/**
 * Instante en que expira un link de pago emitido en `from`.
 * Independiente de la zona horaria del runtime y del cambio de horario.
 */
export function paymentLinkExpiresAt(from: Date = new Date()): Date {
  return new Date(from.getTime() + PAYMENT_LINK_TTL_MS);
}
