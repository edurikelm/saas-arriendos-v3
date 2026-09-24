"use server";

/**
 * Server actions para gestión de suscripciones PRO.
 *
 * Principios de diseño:
 * - Todas las acciones que modifican estado usan `applySubscriptionEvent`.
 * - La cancelación es al fin del período: `cancelMySubscription` marca
 *   `CANCELLED` pero NO cambia `UserProfile.plan`.
 * - `startProUpgrade` crea la subscription en PENDING, el plan cambia cuando
 *   MP envía el webhook de "authorized".
 *
 * Decisiones documentadas (no cambiar sin coordinar con el equipo):
 * - `userId @unique`: 1 owner = 1 subscription activa.
 * - No existe reactivar una suscripción CANCELLED: un preapproval cancelado
 *   en MP es terminal, y crear uno nuevo cobraría de inmediato (doble cobro
 *   del período ya pagado). Mientras el período vigente no termine, PRO sigue
 *   activo (`resolveEffectivePlan`); una vez vencido, el owner vuelve con
 *   `startProUpgrade` ("Activar PRO") (#195, ver ADR-0027 §3).
 * - Si la subscription está EXPIRED o FAILED, `startProUpgrade` ejecuta
 *   delete+create dentro de una transacción atómica (ADR-0027 §9).
 */

import { requireOwner } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { revalidatePath } from "next/cache";
import { getProGateway } from "@/lib/payment/pro-gateway";
import {
  applySubscriptionEvent,
  getCurrentSubscription,
} from "@/lib/subscriptions/lifecycle";
import { cancelSubscriptionSchema } from "@/lib/validations/subscriptions";
import { recordSubscriptionNotification } from "@/lib/notifications/subscription-events";
import { resolveEffectivePlan } from "@/lib/subscriptions/effective-plan";
import { revalidateAfterPlanChange } from "@/lib/subscriptions/revalidate-plan";
import { canStartUpgrade } from "@/lib/subscriptions/upgrade-eligibility";

// ────────────────────────────────────────────────────────────────────────────
// getCurrentSubscription
// ────────────────────────────────────────────────────────────────────────────

/**
 * Devuelve la fila de `Subscription` del owner actual, cualquiera sea su
 * status, o `null` si nunca tuvo una. Retornable desde server component.
 *
 * No filtra por status a propósito: las superficies de owner (billing,
 * settings, dashboard, pricing) necesitan ver también `CANCELLED` (para
 * decidir si el período pagado sigue vigente) y `EXPIRED`/`FAILED` (para
 * ofrecer "Activar PRO" de nuevo) — ver `getOwnerSubscription` (#195 ronda 2).
 */
export async function getCurrentSubscriptionAction() {
  const session = await requireOwner();
  return getCurrentSubscription(session.userId);
}

// ────────────────────────────────────────────────────────────────────────────
// startProUpgrade
// ────────────────────────────────────────────────────────────────────────────

/**
 * Traduce `canStartUpgrade` en el error que ve el owner cuando su fila actual
 * no es reemplazable. Un solo lugar para el pre-check (fuera de tx) y el
 * re-check (dentro de tx) de `startProUpgrade`, así ambos dan el mismo mensaje
 * en vez de que el segundo choque con `userId @unique` (P2002).
 */
function throwIfNotEligibleForUpgrade(
  existing: { status: string; currentPeriodEnd: Date | null } | null,
): void {
  if (canStartUpgrade(existing)) return;

  if (existing?.status === "PENDING") {
    // El segundo click del dueño mientras la PENDING inicial aún existe.
    throw new Error(
      "Tienes un pago PRO pendiente de autorizar. Complétalo antes de iniciar otro.",
    );
  }

  if (existing?.status === "CANCELLED") {
    // No elegible acá significa período vigente (currentPeriodEnd futuro):
    // canStartUpgrade ya deriva FREE — y por lo tanto elegible — para
    // currentPeriodEnd nulo o vencido (ADR-0034).
    const endDate = existing.currentPeriodEnd
      ? existing.currentPeriodEnd.toLocaleDateString("es-CL", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        })
      : "que termine tu período actual";
    throw new Error(`Tu suscripción PRO sigue activa hasta ${endDate}`);
  }

  // AUTHORIZED / PAUSED.
  throw new Error("Ya tienes PRO activo");
}

/**
 * Antes de reemplazar una fila EXPIRED/FAILED/CANCELLED-expirada (ver
 * `throwIfNotEligibleForUpgrade`), confirma que su preapproval en Mercado
 * Pago ya no está vivo, y lo cancela si todavía lo está.
 *
 * Previene un doble cobro: una fila local EXPIRED no siempre implica que MP
 * también dejó de cobrar — por ejemplo, el cron `EXPIRED_CHECK` puede marcar
 * localmente EXPIRED una subscription que seguía `AUTHORIZED` en MP porque el
 * webhook de renovación nunca llegó. Si `startProUpgrade` reemplazara la fila
 * y creara un preapproval nuevo sin chequear esto, el owner terminaría con
 * dos preapprovals vivos y dos cobros mensuales.
 *
 * No hay I/O de red dentro de la transacción de DB del replace (Prisma no lo
 * permite de forma segura), así que este chequeo va ANTES de esa tx, no
 * dentro. La ventana de carrera que queda — el estado cambia entre este
 * chequeo y la tx — es la misma ventana de doble-click que ya cubre el
 * re-check `fresh` dentro de la tx (`userId @unique`); no se amplía.
 */
async function ensurePreviousPreapprovalStopped(existing: {
  mpPreapprovalId: string | null;
}): Promise<void> {
  if (!existing.mpPreapprovalId) return;

  try {
    const info = await getProGateway().fetchPreapproval(existing.mpPreapprovalId);
    if (info.status !== "cancelled") {
      await getProGateway().cancelPreapproval(existing.mpPreapprovalId);
    }
  } catch (error) {
    console.error(
      `[startProUpgrade] failed to verify/cancel previous preapproval ${existing.mpPreapprovalId}`,
      error,
    );
    throw new Error(
      "No pudimos verificar tu suscripción anterior en Mercado Pago. Intenta de nuevo en unos minutos.",
    );
  }
}

/**
 * Inicia el flujo de upgrade a PRO.
 *
 * 1. Pre-check: verifica que no tenga subscription activa.
 * 1b. Si la fila existente es reemplazable y tiene `mpPreapprovalId`, confirma
 *     con MP que ya no está vivo (`ensurePreviousPreapprovalStopped`).
 * 2. Dentro de tx: si EXPIRED/FAILED existe → delete eventos + hard-delete la fila.
 * 3. Crea `Subscription(PENDING)` vía `applySubscriptionEvent("created", tx)`.
 * 4. Post-commit: registra `AdminActionLog.SUBSCRIPTION_REPLACED`.
 * 5. Obtiene `planId` de MP vía `ensurePlan()`.
 * 6. Crea el preapproval en MP y obtiene `initPoint`.
 * 7. Actualiza la subscription con los IDs de MP y fechas.
 *
 * El plan se activa cuando MP envía el webhook "authorized".
 */
export async function startProUpgrade(): Promise<{
  initPoint: string;
  subscriptionId: string;
}> {
  const session = await requireOwner();
  const { userId, email } = session;

  // Pre-check (existente, fuera de tx — solo bloquea casos no elegibles).
  // `canStartUpgrade` es la MISMA regla que el re-check dentro de la tx más
  // abajo (ver upgrade-eligibility.ts): sin subscription, o EXPIRED/FAILED, o
  // CANCELLED cuyo plan efectivo ya es FREE.
  const existing = await getCurrentSubscription(userId);
  throwIfNotEligibleForUpgrade(existing);

  // Si llegamos acá, `existing` es null o reemplazable — defensa en
  // profundidad contra el doble cobro descrito arriba antes de tocar la DB.
  if (existing) {
    await ensurePreviousPreapprovalStopped(existing);
  }

  // ── REEMPLAZAR: dentro de tx, si existe fila EXPIRED/FAILED/CANCELLED-FREE → delete + create ──
  // (mover el try/catch interno al bloque tx para atomicidad)

  let subscription: import("@prisma/client").Subscription;
  let replacedSubscriptionId: string | null = null;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Re-check dentro de tx (doble-click concurrente, o el estado cambió
      // entre el pre-check y acá — p.ej. un webhook concurrente autorizó la
      // subscription). Frena con el mismo error amigable del pre-check en vez
      // de dejar que el create de abajo choque con `userId @unique` (P2002).
      const fresh = await tx.subscription.findUnique({ where: { userId } });
      throwIfNotEligibleForUpgrade(fresh);

      if (fresh) {
        // Reemplazable (EXPIRED/FAILED/CANCELLED-expirado): la fila sigue
        // ocupando el `userId @unique` aunque ya no honre ningún período
        // pagado. El cron eventualmente la convertiría a EXPIRED, pero no
        // podemos esperar al cron aquí.
        // Borrar eventos de la subscription vieja (FK RESTRICT lo exige)
        await tx.subscriptionEvent.deleteMany({
          where: { subscriptionId: fresh.id },
        });
        // Hard delete la fila vieja
        await tx.subscription.delete({
          where: { id: fresh.id },
        });
        replacedSubscriptionId = fresh.id;
      }

      // Crear la nueva subscription PENDING via applySubscriptionEvent
      // (participa en la tx vía adapter pattern — ver lifecycle.ts:374-384)
      const { subscription: created } = await applySubscriptionEvent(
        {
          type: "created",
          userId,
          payload: { initiatedBy: "owner", email },
        },
        tx,
      );
      return { subscription: created };
    });
    subscription = result.subscription;
  } catch (error) {
    // Si falla el delete o el create, nada se persiste (rollback automático)
    console.error("[startProUpgrade] failed to replace existing subscription", error);
    throw error;
  }

  // Auditar el reemplazo si ocurrió (FUERA de tx — best-effort)
  if (replacedSubscriptionId) {
    try {
      await prisma.adminActionLog.create({
        data: {
          adminId: userId, // owner como actor (no el placeholder "system")
          targetId: userId,
          action: "SUBSCRIPTION_REPLACED",
          details: JSON.stringify({
            replacedSubscriptionId,
            newSubscriptionId: subscription.id,
            reason: "owner_reactivate_from_expired_or_failed",
          }),
        },
      });
    } catch (error) {
      console.error("[startProUpgrade] failed to record SUBSCRIPTION_REPLACED log", error);
      // No-op: el reemplazo ocurrió, solo perdimos la auditoría
    }
  }

  // ── Continuar con MP (idéntico al código actual) ──
  try {
    const { planId } = await getProGateway().ensurePlan();

    const {
      preapprovalId,
      initPoint,
      nextPaymentDate,
      autoRecurringStartDate,
    } = await getProGateway().createPreapproval({
      userId,
      payerEmail: email,
      planId,
    });

    // currentPeriodStart:
    //   Preferimos `auto_recurring.start_date` que devuelve MP en el response
    //   (timestamp exacto del primer cobro). Si no viene, usamos `now` como
    //   fallback (el webhook de "authorized" sobreescribe este valor con la
    //   fecha real de MP en la práctica).
    // currentPeriodEnd / nextPaymentDate:
    //   Mercado Pago devuelve `next_payment_date` en la raíz del response.
    //   Para un preapproval con `status: "authorized"`, equivale al final del
    //   período actual. Si MP no lo incluye (caso raro / respuesta parcial),
    //   usamos `now + 30 días` como placeholder hasta que llegue el primer
    //   webhook de "authorized" — ese valor se reconciliará en lifecycle.ts.
    const now = new Date();
    const periodStart = autoRecurringStartDate
      ? new Date(autoRecurringStartDate)
      : now;
    const periodEnd = nextPaymentDate
      ? new Date(nextPaymentDate)
      : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // placeholder — webhook authorized corrige

    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        mpPreapprovalId: preapprovalId,
        mpPlanId: planId,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        nextPaymentDate: periodEnd,
      },
    });

    revalidatePath("/settings/billing");

    return { initPoint, subscriptionId: subscription.id };
  } catch (error) {
    // Si falla la creación del preapproval, limpiar la subscription PENDING huérfana
    await prisma.subscription.delete({
      where: { id: subscription.id },
    }).catch(() => {});
    throw error;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// cancelMySubscription
// ────────────────────────────────────────────────────────────────────────────

/**
 * El owner cancela su suscripción.
 *
 * Marca `status = CANCELLED` + `cancelledAt` pero NO cambia `UserProfile.plan`.
 * El downgrade a FREE ocurre cuando MP envía el webhook "expired" o cuando
 * el cron detecta `currentPeriodEnd < now` (ADR-0027 § Decisión 3).
 */
export async function cancelMySubscription(
  reason?: "too_expensive" | "not_using" | "switching_provider" | "other",
): Promise<{ success: true; currentPeriodEnd: Date | null }> {
  // Validación Zod (defensa en profundidad, también para callers programáticos)
  cancelSubscriptionSchema.parse({ reason });

  const session = await requireOwner();
  const { userId } = session;

  const subscription = await getCurrentSubscription(userId);

  if (!subscription) {
    throw new Error("No tienes una suscripción activa");
  }

  if (subscription.status !== "AUTHORIZED" && subscription.status !== "PAUSED") {
    throw new Error(
      `No puedes cancelar una suscripción en estado "${subscription.status}"`,
    );
  }

  // Cancelar primero en Mercado Pago para que MP deje de cobrar.
  // Si falla, el estado local queda intacto y el owner puede reintentar.
  // La subscription local se mantiene AUTHORIZED hasta que MP confirme la
  // cancelación vía webhook (que marcará CANCELLED + creará evento).
  if (subscription.mpPreapprovalId) {
    try {
      await getProGateway().cancelPreapproval(subscription.mpPreapprovalId);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[cancelMySubscription] MP cancel failed for ${subscription.mpPreapprovalId}:`, msg);
      throw new Error(
        "No pudimos cancelar la suscripción en Mercado Pago. Por favor intenta de nuevo en unos minutos."
      );
    }
  }

  const { planChange: cancelPlanChange } = await applySubscriptionEvent({
    type: "owner_cancel",
    subscriptionId: subscription.id,
    payload: { reason: reason ?? null, userId },
  });
  revalidateAfterPlanChange(cancelPlanChange);

  // Notificar al owner que su plan fue cancelado (best-effort)
  recordSubscriptionNotification({
    userId,
    type: "SUBSCRIPTION_CANCELLED",
    subscriptionId: subscription.id,
  }).catch((error) => {
    console.error(
      "[cancelMySubscription] Failed to record SUBSCRIPTION_CANCELLED notification:",
      error,
    );
  });

  // Obtener fecha fin del período para informar al owner
  const updated = await prisma.subscription.findUnique({
    where: { id: subscription.id },
    select: { currentPeriodEnd: true },
  });

  revalidatePath("/settings/billing");

  return {
    success: true,
    currentPeriodEnd: updated?.currentPeriodEnd ?? null,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// countOwnerUsage — helper para la UI de /settings/billing
// ────────────────────────────────────────────────────────────────────────────

export type OwnerUsage = {
  properties: number;
  clients: number;
  propertiesLimit: number;
  clientsLimit: number;
};

/**
 * Cuenta el uso actual del owner para mostrar en la UI de billing.
 *
 * Límites FREE: 3 propiedades, 5 clientes.
 * Límites PRO: Infinity (sin límite).
 *
 * El plan sale de `resolveEffectivePlan`, el MISMO cálculo que hace
 * `getSession` para los gates — nunca de la columna `UserProfile.plan`, que es
 * dato denormalizado para admin. Leer la columna acá dejaba al banner del
 * dashboard diciendo "PRO, sin límites" mientras la creación fallaba por
 * límite FREE: la UI contradiciendo al backend, en la pantalla del plan.
 */
export async function countOwnerUsage(userId: string): Promise<OwnerUsage> {
  const [propertyCount, clientCount] = await Promise.all([
    prisma.property.count({ where: { userId } }),
    prisma.reservationClient.count({ where: { userId } }),
  ]);

  // Determinar plan actual del owner
  const user = await prisma.userProfile.findUnique({
    where: { id: userId },
    select: {
      planOverride: true,
      subscription: { select: { status: true, currentPeriodEnd: true, mpPreapprovalId: true } },
    },
  });

  const plan = resolveEffectivePlan(user?.planOverride ?? null, user?.subscription ?? null);
  const isPro = plan === "PRO";

  return {
    properties: propertyCount,
    clients: clientCount,
    propertiesLimit: isPro ? Infinity : 3,
    clientsLimit: isPro ? Infinity : 5,
  };
}
