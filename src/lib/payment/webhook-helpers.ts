/**
 * Normaliza `data.id` antes del cómputo del HMAC del manifest.
 *
 * Doc MP: "Si `data.id` se devuelve con caracteres alfanuméricos en mayúsculas,
 * conviértelo a minúsculas antes de usarlo en el manifest."
 * (Fuente: https://www.mercadopago.com/developers/es/docs/checkout-pro/payment-notifications)
 *
 * Para IDs numéricos, `toLowerCase()` es un no-op, así que la función es segura
 * de aplicar universalmente.
 */
export function normalizeDataId(dataId: string): string {
  return dataId.toLowerCase();
}

/**
 * Constante de tolerancia para validación de timestamp en webhooks de MP.
 * Doc MP: "puedes usar el timestamp extraído del header para compararlo con
 * un timestamp generado en el momento de la recepción de la notificación,
 * con el fin de establecer una tolerancia de demora en la recepción del mensaje."
 * Default: 5 minutos.
 */
export const WEBHOOK_TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000;
