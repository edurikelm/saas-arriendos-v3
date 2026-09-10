/**
 * Guardián de la escala tipográfica (DESIGN.md § Typography → Hierarchy, Don't).
 *
 * La escala tipográfica derivó a seis tamaños arbitrarios (`text-[Npx]` /
 * `text-[N.Nrem]`) antes de esta limpieza: dos escalones reales y documentados
 * (`text-[10px]` — The 10px Whisper Rule, `text-[9px]` — micro-label) y cuatro
 * sin base (`text-[11px]`, `text-[13.5px]`, `text-[8px]`, y `text-[0.8rem]`
 * fuera de los dos primitives shadcn que lo justifican). Este test escanea el
 * source y falla si alguien reintroduce un tamaño de fuente arbitrario fuera
 * de los escalones permitidos.
 *
 * Permitidos:
 *   - `text-[10px]` y `text-[9px]` en cualquier archivo — los dos escalones
 *     documentados en DESIGN.md.
 *   - `text-[0.8rem]` SOLO en `src/components/ui/button.tsx` y
 *     `src/components/ui/calendar.tsx`. Viene de shadcn upstream: cambiarlo
 *     altera el tamaño de los botones `sm` y de las celdas del calendario en
 *     todo el producto — decisión aparte de esta limpieza, no drift de este
 *     repo. Es un allowlist con archivo, no un permiso global para `0.8rem`.
 *
 * Cualquier otro `text-[<número>px]` / `text-[<número>rem]` va en la escala
 * de Tailwind (`text-xs`, `text-sm`, `text-base`...), no como valor arbitrario.
 *
 * La regex exige que el contenido del corchete sea un número seguido de `px`
 * o `rem` — así `text-[color:var(--foreground)]` y clases similares (que no
 * son tamaños) no generan falsos positivos.
 */

import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

const RAIZ = join(process.cwd(), "src");

function archivosFuente(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: "utf8" })
    .filter((f) => /\.tsx?$/.test(f))
    .filter((f) => !f.split(/[\\/]/).includes("__tests__"))
    .map((f) => join(dir, f));
}

// `text-[<número>px]` o `text-[<número>rem]` — exige que el contenido del
// corchete sea puramente un tamaño (número + unidad), para no marcar
// arbitrary values de color como `text-[color:var(--foreground)]`.
const ARBITRARY_FONT_SIZE = /text-\[([\d.]+)(px|rem)\]/g;

const TAMANOS_PERMITIDOS_GLOBAL = new Set(["10px", "9px"]);

// Allowlist con archivo, no global: `text-[0.8rem]` viene de shadcn upstream
// solo en estos dos primitives.
const ARCHIVOS_PERMITIDOS_0_8REM = new Set([
  "src/components/ui/button.tsx",
  "src/components/ui/calendar.tsx",
]);

interface Violation {
  file: string;
  line: number;
  match: string;
}

function esLineaComentario(linea: string): boolean {
  return linea.trim().startsWith("//");
}

function buscarViolaciones(contenido: string, archivoRelativo: string): Violation[] {
  const violaciones: Violation[] = [];
  const lineas = contenido.split("\n");

  lineas.forEach((linea, idx) => {
    if (esLineaComentario(linea)) return;

    ARBITRARY_FONT_SIZE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = ARBITRARY_FONT_SIZE.exec(linea)) !== null) {
      const tamano = `${m[1]}${m[2]}`;

      if (TAMANOS_PERMITIDOS_GLOBAL.has(tamano)) continue;

      if (
        tamano === "0.8rem" &&
        ARCHIVOS_PERMITIDOS_0_8REM.has(archivoRelativo)
      ) {
        continue;
      }

      violaciones.push({ file: archivoRelativo, line: idx + 1, match: m[0] });
    }
  });

  return violaciones;
}

describe("guardia: escala tipográfica", () => {
  it("ningún archivo de src/ introduce un tamaño de fuente arbitrario fuera de los escalones permitidos", () => {
    const violaciones = archivosFuente(RAIZ).flatMap((abs) => {
      const contenido = readFileSync(abs, "utf8");
      const rel = relative(process.cwd(), abs).split(sep).join("/");
      return buscarViolaciones(contenido, rel);
    });

    const mensaje = violaciones
      .map(
        (v) =>
          `${v.file}:${v.line} usa \`${v.match}\`, un tamaño de fuente arbitrario fuera de la escala. ` +
          `Usa \`text-[10px]\`/\`text-[9px]\` (escalones documentados) o un tamaño de Tailwind ` +
          `(\`text-xs\`, \`text-sm\`, ...) en su lugar (DESIGN.md, Typography → Don't).`,
      )
      .join("\n");

    expect(violaciones, violaciones.length > 0 ? `\n${mensaje}\n` : undefined).toEqual([]);
  });
});
