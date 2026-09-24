/**
 * Tripwire: `UserProfile.plan` dejo de ser la autoridad del plan.
 *
 * El plan efectivo se deriva de la subscription + `planOverride`
 * (`resolveEffectivePlan`). La columna sobrevive como dato denormalizado para
 * las vistas de ADMIN, que muestran el registro tal cual a proposito.
 *
 * Este test no valida comportamiento: congela la lista de archivos que pueden
 * seleccionarla. La razon es que el bug se repitio tres veces —los gates de
 * plan, `countOwnerUsage` y el banner del dashboard—, siempre igual: alguien
 * agrega una superficie, elige la fuente que tiene mas a mano, y elige mal. Un
 * archivo nuevo en esta lista tiene que ser una decision consciente.
 *
 * Un segundo guardia cubre un caso que el de arriba no ve: un `where` de
 * Prisma que FILTRA por la columna cruda (`user: { plan: "PRO" }`) en vez de
 * seleccionarla con `plan: true`. Es el bug real de Issue #188 — el cron de
 * iCal filtraba calendarios por `user.plan` y nunca vio una concesion manual
 * (`planOverride`) ni una subscription recien vencida.
 */

import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

/**
 * Archivos autorizados a leer la columna cruda, con el motivo.
 *
 * Vistas de admin: muestran el registro, no el plan efectivo. Es informacion
 * legitima para un admin ("que dice la fila"), y en `admin-users.ts` conviven
 * las dos —la columna como registro y `resolveEffectivePlan` para los limites
 * que el owner realmente choca.
 *
 * `lifecycle.ts`: `applyPlanChange` es quien MANTIENE la columna, asi que
 * necesita leer su valor actual para saber si hay transicion.
 */
const PERMITIDOS = new Set([
  "src/app/api/admin/top-owners/route.ts",
  "src/app/api/admin/users/route.ts",
  "src/app/api/admin/users/[id]/route.ts",
  "src/lib/actions/admin-users.ts",
  "src/lib/actions/super-admin.ts",
  "src/lib/subscriptions/lifecycle.ts",
  // Tickets de soporte vistos por admin: el plan del owner se muestra como
  // dato del registro. Si alguna vez se renderiza a un OWNER, tiene que pasar
  // por resolveEffectivePlan.
  "src/lib/support/queries.ts",
]);

function archivosFuente(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: "utf8" })
    .filter((f) => /\.tsx?$/.test(f))
    .filter((f) => !f.includes("__tests__") && !f.includes(".test."))
    .map((f) => join(dir, f));
}

describe("guardia: quien puede leer UserProfile.plan", () => {
  it("solo los archivos autorizados seleccionan la columna cruda", () => {
    const raiz = join(process.cwd(), "src");
    const infractores = archivosFuente(raiz)
      .filter((abs) => readFileSync(abs, "utf8").includes("plan: true"))
      .map((abs) => relative(process.cwd(), abs).split(sep).join("/"))
      .filter((rel) => !PERMITIDOS.has(rel));

    expect(
      infractores,
      `Estos archivos leen UserProfile.plan directo. Si es una superficie de owner, ` +
        `usa resolveEffectivePlan (@/lib/subscriptions/effective-plan). Si es una ` +
        `vista de admin que muestra el registro, agregalo a PERMITIDOS con el motivo.`,
    ).toEqual([]);
  });

  it("la sesion del owner no selecciona la columna", () => {
    const session = readFileSync(join(process.cwd(), "src/lib/auth/session.ts"), "utf8");

    expect(session).not.toContain("plan: true");
    expect(session).toContain("resolveEffectivePlan");
  });
});

/**
 * Archivos autorizados a filtrar/escribir `plan: "PRO"` / `plan: "FREE"`
 * crudo fuera de un `select`, con el motivo. A diferencia de `PERMITIDOS`
 * (que cubre `plan: true`), este regex tambien captura falsos positivos que
 * no son ni Prisma ni `UserProfile.plan` — se documentan aca en vez de forzar
 * un regex mas complejo que los excluya por sintaxis.
 */
const PERMITIDOS_FILTRO = new Set([
  // Escribe el valor inicial de la columna denormalizada al registrar un
  // owner nuevo (siempre FREE, coincide con el plan efectivo porque todavia
  // no existe subscription). No es un filtro que oculte una concesion.
  "src/lib/actions/auth.ts",
  // Metricas de super-admin (`getSuperAdminMetrics`, `getSuperAdminStats`):
  // cuentan el registro a proposito, igual que las vistas de admin ya
  // permitidas en PERMITIDOS.
  "src/lib/actions/super-admin.ts",
  // `plan` aca es `Subscription.plan` (que solo vale "PRO", es el plan que
  // se esta contratando), no `UserProfile.plan`. Modelo distinto, mismo
  // nombre de campo.
  "src/lib/subscriptions/lifecycle.ts",
  // Estado local del formulario "crear owner" en la UI de admin (valor por
  // defecto "FREE" de un <select>). No es un filtro ni una escritura de
  // Prisma — el server action detras (`createOwner`/`auth.ts`) es quien
  // realmente escribe la columna.
  "src/components/admin/admin-users-client.tsx",
]);

// Empareja `plan: "PRO"` / `plan: "FREE"` como filtro o escritura literal, y
// `plan: {` (un select/filtro anidado). Ignora el caso `plan: "FREE" | "PRO"`
// (anotacion de tipo / union), que no es ni un filtro ni una escritura.
const FILTRO_PLAN_CRUDO = /plan:\s*(?:["'](?:PRO|FREE)["'](?!\s*\|)|\{)/;

describe("guardia: quien puede FILTRAR/ESCRIBIR UserProfile.plan crudo", () => {
  it("solo los archivos autorizados usan plan: \"PRO\"/\"FREE\" fuera de un select", () => {
    const raiz = join(process.cwd(), "src");
    const infractores = archivosFuente(raiz)
      .filter((abs) => FILTRO_PLAN_CRUDO.test(readFileSync(abs, "utf8")))
      .map((abs) => relative(process.cwd(), abs).split(sep).join("/"))
      .filter((rel) => !PERMITIDOS_FILTRO.has(rel));

    expect(
      infractores,
      `Estos archivos filtran o escriben "plan" crudo (PRO/FREE) fuera de un select. Si es ` +
        `un filtro/escritura sobre UserProfile.plan en una superficie de owner, usa ` +
        `resolveEffectivePlan (@/lib/subscriptions/effective-plan) para decidir en memoria — ` +
        `ver Issue #188. Si es Subscription.plan, una vista de admin, o no es Prisma en ` +
        `absoluto, agregalo a PERMITIDOS_FILTRO con el motivo.`,
    ).toEqual([]);
  });
});
