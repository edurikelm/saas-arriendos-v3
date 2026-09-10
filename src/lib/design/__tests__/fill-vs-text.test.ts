/**
 * Guardián de la Fill-vs-Text Rule (DESIGN.md § Named Rules).
 *
 * La regla existía documentada desde antes de este test y el código nunca la
 * cumplió: 35 violaciones vivas. Una regla escrita sin enforcement es exactamente
 * lo que produjo eso. Este test escanea el source y falla si alguien vuelve a
 * usar un token de RELLENO (`--success`, `--warning`, `--info`, `--destructive`)
 * como color de texto o de ícono.
 *
 * Prohibido como `text-*`:
 *   - `text-success` / `text-warning` / `text-info` / `text-destructive` a secas
 *     (el token de relleno, medido bajo AA sobre `--card` en los cuatro casos).
 *   - `text-success-foreground` / `text-warning-foreground` / `text-info-foreground`
 *     — ese nivel es para texto que va ENCIMA del relleno opaco del mismo tono
 *     (ej. texto de 10px de un badge), no para texto sobre `--card`. Sobre card
 *     pasa AA pero en claro está en L=0.30 y se lee negro: el tono deja de
 *     comunicar.
 *
 * Excepción explícita: `text-destructive-foreground` SÍ es legítimo. Es blanco
 * a propósito — va sobre `bg-destructive` opaco en botones y badges de
 * notificación, y ahí funciona. No tiene compañero prohibido porque
 * `--destructive-foreground` nunca dejó de ser correcto (a diferencia de
 * success/warning/info, que sí mentían — ver el comentario junto a
 * `--success-foreground` en `src/app/globals.css`).
 *
 * Lo correcto en todos los casos de arriba es el compañero `-text`
 * (`text-success-text`, `text-warning-text`, `text-info-text`,
 * `text-destructive-text`), calibrado para leerse sobre `--card` o sobre
 * `bg-{tono}/10` en ambos temas.
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

// Token de relleno usado a secas como color de texto/ícono: `text-success`,
// `text-warning`, `text-info`, `text-destructive`, siempre que NO vaya seguido
// de `-` (lo que lo convertiría en `-text` o `-foreground`, casos aparte) ni de
// otro caracter de palabra.
const BARE_FILL_AS_TEXT = /text-(success|warning|info|destructive)(?![-\w])/g;

// `-foreground` de success/warning/info usado como si fuera texto sobre card.
// `destructive-foreground` queda fuera a propósito: es la única excepción
// legítima (ver comentario de cabecera).
const FOREGROUND_AS_TEXT = /text-(success|warning|info)-foreground\b/g;

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

    for (const regex of [BARE_FILL_AS_TEXT, FOREGROUND_AS_TEXT]) {
      regex.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = regex.exec(linea)) !== null) {
        violaciones.push({ file: archivoRelativo, line: idx + 1, match: m[0] });
      }
    }
  });

  return violaciones;
}

describe("guardia: Fill-vs-Text Rule", () => {
  it("ningún archivo de src/ usa un token de RELLENO como color de texto o ícono", () => {
    const violaciones = archivosFuente(RAIZ).flatMap((abs) => {
      const contenido = readFileSync(abs, "utf8");
      const rel = relative(process.cwd(), abs).split(sep).join("/");
      return buscarViolaciones(contenido, rel);
    });

    const sugerencia = (clase: string): string => {
      const tono = clase.replace(/^text-/, "").replace(/-foreground$/, "");
      return `text-${tono}-text`;
    };

    const mensaje = violaciones
      .map(
        (v) =>
          `${v.file}:${v.line} usa \`${v.match}\` como color de texto/ícono. ` +
          `Usa \`${sugerencia(v.match)}\` en su lugar (Fill-vs-Text Rule, DESIGN.md).`,
      )
      .join("\n");

    expect(violaciones, violaciones.length > 0 ? `\n${mensaje}\n` : undefined).toEqual([]);
  });
});
