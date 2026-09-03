/**
 * Plan efectivo del owner — LA fuente de verdad.
 *
 * El plan no se guarda: se deriva de la `Subscription`, con una excepción
 * explícita para las concesiones manuales de un admin (`planOverride`).
 *
 * ## Por qué derivado y no cacheado
 *
 * `UserProfile.plan` existe como columna y era la autoridad hasta este cambio.
 * Era una caché de un valor derivable, y la invalidación fallaba de tres
 * formas distintas, todas encontradas en producción:
 *
 * 1. `expired_check` —el único evento que detecta el vencimiento, porque MP no
 *    emite `expired` para `preapproval`— no estaba en `eventTriggersPlanChange`,
 *    así que el cron marcaba la subscription EXPIRED y dejaba el plan en PRO.
 * 2. Cancelar sin `currentPeriodEnd` dejaba PRO indefinidamente: la regla
 *    anterior solo podía degradar comparando contra una fecha, y sin fecha la
 *    comparación nunca era verdadera.
 * 3. Cada superficie leía una fuente distinta (la columna, la subscription, o
 *    su propia regla), así que arreglar una no arreglaba las otras.
 *
 * Derivar elimina las tres: no hay caché que invalidar. `UserProfile.plan`
 * queda como dato denormalizado para las vistas de admin, y NINGUNA superficie
 * de owner lo lee — ver el test de guardia en `__tests__/effective-plan.test.ts`.
 *
 * ## La regla del período nulo
 *
 * `currentPeriodEnd` nulo NO significa lo mismo en todos los estados, y
 * tratarlo uniformemente fue el origen del defecto (2):
 *
 * - `AUTHORIZED` + nulo + **con `mpPreapprovalId`** → **PRO**. La subscription
 *   se acaba de autorizar y MP todavía no devolvió las fechas del período.
 *   Negar PRO acá le cobraría al owner sin darle el plan.
 * - `AUTHORIZED` + nulo + **sin `mpPreapprovalId`** → **FREE**. Esa fila nunca
 *   fue autorizada por MP: el flujo real (`startProUpgrade`) crea la
 *   subscription, pide el preapproval y recién ahí guarda el id, así que un
 *   AUTHORIZED sin id es una fila en estado inconsistente. Encontrada en
 *   producción: status AUTHORIZED, sin id, un solo evento `created`, 13 días
 *   sin tocarse. La versión anterior de esta regla le habría dado PRO gratis.
 * - `CANCELLED`/`PAUSED` + nulo → **FREE**. No hay período pagado que honrar.
 *   Conceder PRO acá es plata regalada, y para siempre.
 */

/** Estados que pueden dar derecho a PRO, cada uno con su regla de período. */
export type EffectivePlanSubscriptionInput = {
  status: string;
  currentPeriodEnd: Date | null;
  /**
   * Prueba de que MP autorizó de verdad. Solo se consulta en el borde
   * `AUTHORIZED` + período nulo, que es el único ambiguo.
   */
  mpPreapprovalId: string | null;
} | null;

export type EffectivePlan = "FREE" | "PRO";

/**
 * Deriva el plan de la subscription, sin considerar overrides.
 *
 * `AUTHORIZED` es el único estado donde un período nulo concede PRO (ver el
 * bloque "La regla del período nulo" arriba). `PAUSED` se trata como
 * `CANCELLED` —PRO hasta el fin del período pagado, si hay uno— para no
 * degradar a alguien que pausó a mitad de un mes ya pagado.
 */
export function derivePlanFromSubscription(
  subscription: EffectivePlanSubscriptionInput,
  now: Date = new Date(),
): EffectivePlan {
  if (!subscription) {
    return "FREE";
  }

  const { status, currentPeriodEnd } = subscription;

  if (status === "AUTHORIZED") {
    if (currentPeriodEnd === null) {
      // Recién autorizada (MP no devolvió fechas) vs. fila que quedó en
      // AUTHORIZED sin que MP autorizara nada. Las distingue el preapproval.
      //
      // Chequeo por verdad y no `!== null`: si el campo llegara `undefined`
      // —un select que lo olvida, un mock viejo— `!== null` daría PRO. Acá el
      // default tiene que ser denegar: es la diferencia entre cobrar y regalar.
      return subscription.mpPreapprovalId ? "PRO" : "FREE";
    }
    return currentPeriodEnd > now ? "PRO" : "FREE";
  }

  if (status === "CANCELLED" || status === "PAUSED") {
    // Sin fecha no hay nada que honrar; con fecha, hasta que venza.
    return currentPeriodEnd !== null && currentPeriodEnd > now ? "PRO" : "FREE";
  }

  // PENDING (nunca se autorizó), EXPIRED, FAILED.
  return "FREE";
}

/**
 * Plan efectivo = concesión manual del admin, si existe; si no, lo derivado.
 *
 * `planOverride` solo guarda `"PRO"` o `null` por diseño: un override de
 * `FREE` sería un bloqueo que le quitaría a un owner un plan que está pagando,
 * y para cortar el acceso ya existe cancelar la subscription. El panel de admin
 * traduce "FREE" a `null` (revocar la concesión, volver a derivar), no a un
 * override de FREE. Ver `updateUserPlan`.
 */
export function resolveEffectivePlan(
  planOverride: string | null,
  subscription: EffectivePlanSubscriptionInput,
  now: Date = new Date(),
): EffectivePlan {
  if (planOverride === "PRO") {
    return "PRO";
  }

  return derivePlanFromSubscription(subscription, now);
}
