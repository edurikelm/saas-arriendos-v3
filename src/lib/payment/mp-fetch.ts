/**
 * Wrapper sobre `fetch` con AbortSignal.timeout para todas las llamadas
 * outbound a Mercado Pago.
 *
 * Doc MP: webhook espera respuesta en 22s. Si llegamos tarde, MP re-intenta
 * 8 veces. Por eso abortamos preventivamente a los 5s.
 */
export async function mpFetch(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = 5_000,
): Promise<Response> {
  return fetch(url, {
    ...options,
    signal: AbortSignal.timeout(timeoutMs),
  });
}
