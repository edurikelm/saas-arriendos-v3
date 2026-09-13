/**
 * Guardián: el disparador de un Select muestra la ETIQUETA, no el valor.
 *
 * `SelectValue` (sobre `@base-ui/react/select`) sin hijos no busca el texto del
 * `SelectItem` elegido: renderiza el valor crudo del Select. Un
 * `<SelectValue />` muestra el enum o el id interno —"ACTIVE", "HIGH", el cuid
 * de una propiedad— y `placeholder` no lo arregla, porque solo aparece mientras
 * no hay valor. Se vio en /reports (el selector de propiedad decía `all`) y el
 * mismo patrón estaba repetido en nueve archivos.
 *
 * Lo correcto es pasarle una función hija que traduzca valor → etiqueta con el
 * mismo mapa que alimenta los `SelectItem`:
 *
 *   <SelectValue>{(value) => labels[value] ?? "Placeholder"}</SelectValue>
 *
 * Ojo: con función hija Base UI ya no usa `placeholder`; la función recibe
 * `null` sin valor y debe devolver ella el texto de relleno.
 *
 * Este test falla ante cualquier `<SelectValue … />` autocerrado. Las
 * excepciones van abajo, con la razón por la que su valor ya es legible.
 */

import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

const RAIZ = join(process.cwd(), "src");

/**
 * Archivos donde el valor crudo ES la etiqueta. Cada entrada debe seguir
 * teniendo un `<SelectValue />` desnudo: si se arregla, sale de la lista.
 */
const EXCEPCIONES: Record<string, string> = {
  "src/components/ui/pagination.tsx":
    "el valor es String(size) y el SelectItem muestra el mismo número",
};

function archivosFuente(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: "utf8" })
    .filter((f) => /\.tsx$/.test(f))
    .filter((f) => !f.split(/[\\/]/).includes("__tests__"))
    .map((f) => join(dir, f));
}

/**
 * Líneas de cada `<SelectValue …/>` autocerrado. Recorre la etiqueta a mano en
 * vez de usar una regex porque los atributos pueden traer `{…}` con `>` dentro
 * (`placeholder={a > b ? … : …}`) y ocupar varias líneas.
 */
function selectValueSinHijos(contenido: string): number[] {
  const lineas: number[] = [];
  const apertura = /<SelectValue\b/g;
  let m: RegExpExecArray | null;

  while ((m = apertura.exec(contenido)) !== null) {
    let profundidad = 0;
    let comilla: string | null = null;
    let i = m.index + m[0].length;

    for (; i < contenido.length; i++) {
      const c = contenido[i];
      if (comilla) {
        if (c === comilla && contenido[i - 1] !== "\\") comilla = null;
      } else if (c === '"' || c === "'" || c === "`") {
        comilla = c;
      } else if (c === "{") {
        profundidad++;
      } else if (c === "}") {
        profundidad--;
      } else if (c === ">" && profundidad === 0) {
        break;
      }
    }

    if (contenido[i - 1] === "/") {
      lineas.push(contenido.slice(0, m.index).split("\n").length);
    }
  }

  return lineas;
}

describe("guardia: SelectValue muestra la etiqueta", () => {
  it("el detector distingue autocerrado de función hija", () => {
    expect(selectValueSinHijos(`<SelectValue />`)).toEqual([1]);
    expect(selectValueSinHijos(`<SelectValue placeholder="Todas" />`)).toEqual([1]);
    expect(
      selectValueSinHijos(`\n<SelectValue\n  placeholder={a > b ? "x" : \`y \${c}\`}\n/>`),
    ).toEqual([2]);
    expect(
      selectValueSinHijos(`<SelectValue>{(v) => labels[v] ?? "Todas"}</SelectValue>`),
    ).toEqual([]);
    expect(selectValueSinHijos(`<SelectValue placeholder="x">{label}</SelectValue>`)).toEqual([]);
  });

  it("ningún archivo de src/ usa <SelectValue /> sin función hija", () => {
    const violaciones = archivosFuente(RAIZ).flatMap((abs) => {
      const rel = relative(process.cwd(), abs).split(sep).join("/");
      if (rel in EXCEPCIONES) return [];
      return selectValueSinHijos(readFileSync(abs, "utf8")).map((line) => `${rel}:${line}`);
    });

    const mensaje = violaciones
      .map(
        (v) =>
          `${v} usa <SelectValue /> sin hijos: el disparador mostrará el valor crudo. ` +
          `Usa <SelectValue>{(value) => etiqueta}</SelectValue>.`,
      )
      .join("\n");

    expect(violaciones, violaciones.length > 0 ? `\n${mensaje}\n` : undefined).toEqual([]);
  });

  it("cada excepción sigue siendo necesaria", () => {
    const obsoletas = Object.keys(EXCEPCIONES).filter(
      (rel) => selectValueSinHijos(readFileSync(join(process.cwd(), rel), "utf8")).length === 0,
    );

    expect(obsoletas, "Estas excepciones ya no tienen <SelectValue /> desnudo: sácalas").toEqual([]);
  });
});
