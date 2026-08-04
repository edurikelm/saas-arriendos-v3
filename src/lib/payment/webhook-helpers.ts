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
