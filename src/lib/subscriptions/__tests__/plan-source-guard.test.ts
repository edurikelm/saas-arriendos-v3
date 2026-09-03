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
