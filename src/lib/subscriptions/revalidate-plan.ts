/**
 * Invalidación de caché cuando el plan efectivo de un owner cambia.
 *
 * El plan se muestra en dos lugares con ciclos de vida de render distintos:
 * el badge del sidebar, que vive en `(dashboard)/layout.tsx` y por lo tanto
 * en el segmento de LAYOUT, y las páginas que leen límites (`/dashboard`,
 * `/settings/billing`). Revalidar solo las páginas deja el sidebar con el
 * render anterior: Next preserva el layout entre navegaciones del cliente, así
 * que un owner que baja a FREE sigue viendo "PRO" al lado de su nombre —
 * contradiciendo al banner que le dice, en la misma pantalla, que está en FREE.
 *
 * Por eso el target es `("/", "layout")` y no una lista de rutas: el badge
 * aparece en TODAS las páginas del grupo `(dashboard)`, y una lista se
 * desactualiza en cuanto alguien agrega una ruta.
 *
 * Vive acá y no en `lifecycle.ts` a propósito: ese módulo es lógica de dominio
 * pura, sin dependencias de Next, y se testea con adapters de transacción.
 * Meterle `next/cache` lo ataría al framework y obligaría a mockearlo en cada
 * test que aplique un evento. La regla de "cuándo revalidar" es de la capa de
 * entrada (route handlers y server actions), no del dominio.
 */

import { revalidatePath } from "next/cache";
import type { PlanChange } from "@/lib/subscriptions/lifecycle";

/**
 * Revalida el árbol de layouts si el plan efectivamente cambió.
 *
 * No-op cuando `planChange` es `undefined` (el evento no toca el plan: por
 * ejemplo `created` o `renewed` sobre una subscription que ya estaba PRO) o
 * cuando `from === to` (idempotencia: `applyPlanChange` retorna el mismo plan
 * en ambos campos si no hubo transición).
 *
 * Nota sobre alcance: esto invalida la caché del SERVIDOR. Una pestaña ya
 * abierta recibe el plan nuevo en su próxima navegación, no al instante — para
 * un cambio disparado desde el propio navegador (cancelar/reactivar) eso es
 * inmediato, pero un downgrade por cron o webhook se refleja recién cuando el
 * owner navega. Empujarlo en vivo requeriría streaming o polling, que es
 * desproporcionado para un cambio de plan.
 */
export function revalidateAfterPlanChange(planChange?: PlanChange): void {
  if (!planChange || planChange.from === planChange.to) {
    return;
  }

  revalidatePath("/", "layout");
}
