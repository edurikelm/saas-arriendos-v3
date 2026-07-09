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
