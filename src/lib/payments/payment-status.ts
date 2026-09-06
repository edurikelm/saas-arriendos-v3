import { daysFromTodayDateOnly } from "@/lib/domain/timezone";

/**
 * Estado de despliegue de un pago: el tono con que se pinta y la palabra que
 * lo nombra.
 *
 * Existe porque el detalle de reserva tenía dos derivaciones distintas para el
 * mismo hecho: `PaymentTimelineNode` (mensuales) calculaba cuatro etiquetas
 * desde el vencimiento, y `PaymentCard` (diarias) mapeaba `status` a secas, así
 * que un pago atrasado se mostraba "Pendiente" en ámbar debajo de un KPI que
 * anunciaba el mismo monto como vencido. La lista diaria literalmente no sabía
 * decir "Vencido". Ahora las dos consumen esto.
 *
 * `--warning` para todo PENDING no atrasado (coincide con el KPI "Por cobrar")
 * y `--destructive` sólo para lo vencido: el color marca urgencia real, no
 * "hay algo por cobrar".
 */
export type PaymentDisplayTone = "success" | "warning" | "destructive";

export interface PaymentDisplayStatus {
  tone: PaymentDisplayTone;
  label: string;
}

/**
 * Días desde hoy hasta el vencimiento, en día calendario de America/Santiago
 * (ADR-0020: `dueDate` es date-only, no se reinterpreta en zona).
 *
 * Un pago sin `dueDate` no puede estar atrasado, así que devuelve `null` y
 * quien lo consuma lo trata como futuro lejano.
 */
export function getDaysUntilDue(dueDate: string | null | undefined): number | null {
  if (!dueDate) return null;
  return daysFromTodayDateOnly(dueDate);
}

export function getPaymentDisplayStatus(
  status: string,
  daysUntilDue: number | null,
): PaymentDisplayStatus {
  if (status === "COMPLETED") return { tone: "success", label: "Pagado" };
  if (status === "FAILED") return { tone: "destructive", label: "Fallido" };
  if (daysUntilDue === null) return { tone: "warning", label: "Pendiente" };
  if (daysUntilDue < 0) return { tone: "destructive", label: "Vencido" };
  if (daysUntilDue === 0) return { tone: "warning", label: "Vence hoy" };
  return { tone: "warning", label: "Pendiente" };
}

/**
 * Ordena por urgencia de cobro: lo que vence antes va primero, y lo que no
 * tiene vencimiento va al final. La lista diaria no ordenaba, así que el pago
 * más atrasado podía quedar último bajo un KPI que gritaba que había vencidos.
 */
export function sortByDueDate<T extends { dueDate?: string | null }>(payments: T[]): T[] {
  return [...payments].sort((a, b) => {
    if (!a.dueDate && !b.dueDate) return 0;
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return a.dueDate.slice(0, 10).localeCompare(b.dueDate.slice(0, 10));
  });
}
