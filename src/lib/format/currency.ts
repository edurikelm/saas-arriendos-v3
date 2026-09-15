/**
 * Formats a CLP amount as a currency string using Intl.NumberFormat.
 * Used across payments, reports, and dashboard components.
 */
export function formatCLP(amount: number): string {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Formatea un monto para un INPUT de texto editable: separador de miles, sin
 * símbolo de moneda (el `$` va aparte, como prefijo visual del input, igual
 * que en `AddPaymentDialog`). Descarta cualquier carácter no numérico antes
 * de formatear, así que sirve tanto para prellenar como para reformatear en
 * cada tecleo.
 */
export function formatCLPInput(value: string): string {
  const numericValue = value.replace(/\D/g, "");
  if (!numericValue) return "";
  return new Intl.NumberFormat("es-CL", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(numericValue));
}

/** Inversa de `formatCLPInput`: quita los separadores de miles y devuelve el número. */
export function parseCLPInput(value: string): number {
  return Number(value.replace(/\./g, ""));
}
