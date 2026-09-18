/**
 * Guardián del contraste de la banda de resumen (`--summary`).
 *
 * La banda es la barra sticky del modal de reserva que muestra total y neto.
 * Es un fondo TEÑIDO, y sobre un fondo teñido el contraste deja de ser obvio:
 * el gris de `--muted-foreground` se lava y el verde de `--primary-text` queda
 * cerca del piso. Los valores de `globals.css` se calibraron midiendo; este
 * test lee esos mismos valores y vuelve a medir, así que un ajuste de matiz o
 * de luminosidad que baje un par por debajo de AA falla acá y no en producción.
 *
 * Mide con la fórmula de WCAG sobre la conversión OKLCH → sRGB lineal. No usa
 * `getComputedStyle`: los navegadores devuelven `oklch(...)` o `color(srgb ...)`
 * y parsear eso con regex ya dio números falsos en este repo.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const CSS = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

/** Bloque de un selector (`:root` o `.dark`), hasta su llave de cierre. */
function block(selector: string): string {
  const start = CSS.indexOf(`${selector} {`);
  if (start === -1) throw new Error(`No existe ${selector} en globals.css`);
  let depth = 0;
  for (let i = CSS.indexOf("{", start); i < CSS.length; i++) {
    if (CSS[i] === "{") depth++;
    if (CSS[i] === "}" && --depth === 0) return CSS.slice(start, i);
  }
  throw new Error(`Bloque ${selector} sin cerrar`);
}

/** Valor crudo de un custom property dentro de un bloque, resolviendo `var(--x)`. */
function token(css: string, name: string): string {
  const match = css.match(new RegExp(`--${name}:\\s*([^;]+);`));
  if (!match) throw new Error(`No existe --${name}`);
  const value = match[1].trim();
  const alias = value.match(/^var\(--([\w-]+)\)$/);
  return alias ? token(css, alias[1]) : value;
}

/** sRGB lineal [0,1] desde `oklch(L C h)` o `#rrggbb`. */
function toLinear(value: string): [number, number, number] {
  const hex = value.match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
      const c = v / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    }) as [number, number, number];
  }

  const oklch = value.match(/^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)$/);
  if (!oklch) throw new Error(`Formato de color no soportado: ${value}`);
  const [L, C, h] = oklch.slice(1).map(Number);
  const a = C * Math.cos((h * Math.PI) / 180);
  const b = C * Math.sin((h * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map((x) => Math.min(1, Math.max(0, x))) as [number, number, number];
}

function contrast(fg: string, bg: string): number {
  const lum = ([r, g, b]: [number, number, number]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const [hi, lo] = [lum(toLinear(fg)), lum(toLinear(bg))].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const THEMES = { claro: block(":root"), oscuro: block(".dark") };

describe.each(Object.entries(THEMES))("banda de resumen — tema %s", (_, css) => {
  const band = token(css, "summary");

  it("el texto secundario pasa AA sobre la banda", () => {
    expect(contrast(token(css, "summary-muted-foreground"), band)).toBeGreaterThanOrEqual(4.5);
  });

  it("el neto en verde de marca pasa AA sobre la banda", () => {
    // Es el número más importante de la barra, y el par más justo en claro.
    expect(contrast(token(css, "primary-text"), band)).toBeGreaterThanOrEqual(4.5);
  });

  it("el foreground pasa AA sobre la banda", () => {
    expect(contrast(token(css, "foreground"), band)).toBeGreaterThanOrEqual(4.5);
  });

  it("la banda se distingue del fondo del diálogo", () => {
    // No es texto, así que no aplica 4.5:1, pero una banda idéntica al
    // popover no destacaría nada: exige al menos una diferencia medible.
    expect(contrast(band, token(css, "popover"))).toBeGreaterThan(1.05);
  });
});
