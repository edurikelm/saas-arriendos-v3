/**
 * `ensurePreapprovalCancelled` — cancela un preapproval de Mercado Pago de
 * forma idempotente, resolviendo los casos borde donde MP ya no reconoce el
 * preapproval o ya está cancelado del lado de MP.
 *
 * Punto único usado por los tres lugares donde RentalPro necesita detener un
 * preapproval de la suscripción PRO: `cancelMySubscription`,
 * `adminCancelSubscription` (ambos en `src/lib/actions/`) y
 * `ensurePreviousPreapprovalStopped` dentro de `startProUpgrade`. Centraliza
 * la lógica de "ya está cancelado / MP ya no lo tiene / falla de verdad" para
 * que los tres den el mismo resultado ante el mismo estado de MP, en vez de
 * que cada caller reimplemente su propia interpretación de los status codes.
 */

import { getProGateway, MpApiError } from "@/lib/payment/pro-gateway";

export type EnsurePreapprovalCancelledOutcome =
  | "cancelled"
  | "already_cancelled"
  | "not_found";

export interface EnsurePreapprovalCancelledResult {
  outcome: EnsurePreapprovalCancelledOutcome;
  /**
   * Status que MP reportó en el primer `fetchPreapproval` de esta llamada,
   * es decir, el estado del preapproval ANTES de que este helper hiciera
   * nada. `undefined` cuando ese primer fetch nunca llegó a completarse
   * (ej. 404 inmediato) — ahí no hay status previo que reportar.
   */
  previousStatus?: string;
}

/**
 * @param preapprovalId id del preapproval de Mercado Pago a cancelar.
 * @returns
 * - `"already_cancelled"` si MP ya lo reportaba `cancelled` (no se llama a
 *   `cancelPreapproval`), o si la cancelación falló pero un re-fetch
 *   posterior confirma que igual quedó `cancelled` del lado de MP.
 * - `"cancelled"` si este helper fue quien lo canceló.
 * - `"not_found"` si MP responde 404 (nuestra cuenta ya no reconoce el
 *   preapproval — no puede cobrar a través de él, así que no hay riesgo de
 *   doble cobro aunque no podamos confirmar su estado).
 *
 * Cualquier otro error (401/403, 5xx, timeouts, fallas de red) se relanza tal
 * cual — esos SÍ son fallas reales que ameritan reintentar, no un estado
 * terminal que este helper pueda absorber.
 */
export async function ensurePreapprovalCancelled(
  preapprovalId: string,
): Promise<EnsurePreapprovalCancelledResult> {
  const gateway = getProGateway();

  let previousStatus: string | undefined;

  try {
    const info = await gateway.fetchPreapproval(preapprovalId);
    previousStatus = info.status;
    if (info.status === "cancelled") {
      return { outcome: "already_cancelled", previousStatus };
    }
  } catch (error) {
    if (error instanceof MpApiError && error.status === 404) {
      console.error(
        `[ensurePreapprovalCancelled] preapproval ${preapprovalId} no encontrado en MP (404) al consultarlo — nuestra cuenta ya no lo reconoce, así que no puede cobrar a través de él.`,
      );
      return { outcome: "not_found" };
    }
    throw error;
  }

  try {
    await gateway.cancelPreapproval(preapprovalId);
    return { outcome: "cancelled", previousStatus };
  } catch (error) {
    if (error instanceof MpApiError && error.status === 404) {
      console.error(
        `[ensurePreapprovalCancelled] preapproval ${preapprovalId} no encontrado en MP (404) al cancelarlo — nuestra cuenta ya no lo reconoce, así que no puede cobrar a través de él.`,
      );
      return { outcome: "not_found", previousStatus };
    }

    // La cancelación falló, pero puede haber aplicado igual del lado de MP
    // (ej. timeout leyendo la respuesta después de que la mutación ya
    // ocurrió). Re-consultamos una sola vez antes de darnos por vencidos.
    try {
      const refetched = await gateway.fetchPreapproval(preapprovalId);
      if (refetched.status === "cancelled") {
        return { outcome: "already_cancelled", previousStatus };
      }
    } catch {
      // El re-fetch también falló — no aporta información nueva. Se relanza
      // el error original de `cancelPreapproval` abajo, no este.
    }

    throw error;
  }
}
