import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Regresion de #242: el anillo de foco del sistema fallaba WCAG 2.1 SC 1.4.11
 * (3:1 para indicadores de interfaz) en los dos temas.
 *
 * A diferencia del resto de los tests de diseno, este NO se conforma con mirar
 * clases: parsea los tokens de `globals.css`, compone el anillo sobre cada
 * superficie real y calcula el ratio. El criterio de aceptacion del issue pide
 * "medido y no evaluado a ojo", y jsdom no resuelve custom properties ni pinta
 * pixeles — asi que la medicion se hace aca, sobre los mismos valores que el
 * navegador recibe.
 *
 * La opacidad NO esta hardcodeada: sale de las clases que el producto usa de
 * verdad, para que bajarla vuelva a poner el test en rojo.
 */

const ROOT = path.resolve(__dirname, "../../..");
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");

const GLOBALS = read("src/app/globals.css");

// --- color: oklch / hex -> sRGB lineal -> luminancia relativa (WCAG) ---

type Rgb = [number, number, number];

function oklchToSrgb(L: number, C: number, hDeg: number): Rgb {
  const h = (hDeg * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;
  const lin = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  return lin.map((v) => {
    const x = Math.min(1, Math.max(0, v));
    return x > 0.0031308 ? 1.055 * x ** (1 / 2.4) - 0.055 : 12.92 * x;
  }) as Rgb;
}

function parseColor(raw: string): Rgb {
  const value = raw.trim();
  const hex = value.match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    const n = hex[1];
    return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255) as Rgb;
  }
  const oklch = value.match(/^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)$/);
  if (oklch) {
    return oklchToSrgb(Number(oklch[1]), Number(oklch[2]), Number(oklch[3]));
  }
  throw new Error(`Color no soportado en globals.css: "${raw}"`);
}

function luminance([r, g, b]: Rgb): number {
  const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** El navegador compone el alpha del anillo sobre la superficie que hay detras. */
function composite(fg: Rgb, bg: Rgb, alpha: number): Rgb {
  return fg.map((c, i) => alpha * c + (1 - alpha) * bg[i]) as Rgb;
}

// --- tokens ---

function themeBlock(theme: "light" | "dark"): string {
  const start = GLOBALS.indexOf(theme === "light" ? ":root {" : ".dark {");
  expect(start, `no se encontro el bloque de tema ${theme}`).toBeGreaterThan(-1);
  return GLOBALS.slice(start, GLOBALS.indexOf("\n}", start));
}

function token(theme: "light" | "dark", name: string): Rgb {
  const block = themeBlock(theme);
  const prefix = `--${name}:`;
  const line = block
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.startsWith(prefix));
  expect(line, `falta el token --${name} en el tema ${theme}`).toBeDefined();
  const raw = line!.slice(prefix.length).replace(";", "").trim();
  const alias = raw.match(/^var\(--([\w-]+)\)$/);
  return alias ? token(theme, alias[1]) : parseColor(raw);
}

/** Superficies opacas reales sobre las que se dibuja un anillo de foco. */
const SURFACES = ["card", "background", "muted", "secondary", "accent", "popover"];

/** Opacidad que el producto le da al anillo, leida del codigo, no supuesta. */
function ringAlpha(): number {
  const fromButton = read("src/components/ui/button.tsx").match(/focus-visible:ring-ring\/(\d+)/);
  const fromBase = GLOBALS.match(/outline-ring\/(\d+)/);
  expect(fromButton, "button.tsx dejo de declarar focus-visible:ring-ring/N").not.toBeNull();
  expect(fromBase, "globals.css dejo de declarar outline-ring/N").not.toBeNull();
  expect(
    fromBase![1],
    "la regla base y la convencion de componentes usan opacidades distintas"
  ).toBe(fromButton![1]);
  return Number(fromButton![1]) / 100;
}

const PRIMITIVES = [
  "button",
  "input",
  "textarea",
  "select",
  "badge",
  "switch",
  "checkbox",
  "combobox",
  "tabs",
  "calendar",
].map((name) => [name, read(`src/components/ui/${name}.tsx`)] as const);

describe("#242 — anillo de foco vs WCAG 1.4.11", () => {
  it.each(["light", "dark"] as const)(
    "el anillo alcanza 3:1 contra toda superficie real en tema %s",
    (theme) => {
      const alpha = ringAlpha();
      const ring = token(theme, "ring");

      for (const name of SURFACES) {
        const surface = token(theme, name);
        const painted = composite(ring, surface, alpha);
        const ratio = contrast(painted, surface);

        expect(
          ratio,
          `--ring al ${alpha * 100}% sobre --${name} (${theme}) mide ${ratio.toFixed(2)}:1`
        ).toBeGreaterThanOrEqual(3);
      }
    }
  );

  it("el borde de estado invalido tambien alcanza 3:1, porque es la unica senal de invalido", () => {
    for (const theme of ["light", "dark"] as const) {
      const destructive = token(theme, "destructive");
      const card = token(theme, "card");
      const ratio = contrast(destructive, card);
      expect(
        ratio,
        `--destructive sobre --card (${theme}) mide ${ratio.toFixed(2)}:1`
      ).toBeGreaterThanOrEqual(3);
    }
  });

  it("ninguna primitiva tine el anillo de foco con un tono semantico", () => {
    // Medido en #242: en claro ningun tono semantico llega a 3:1 ni opaco
    // (warning topa en 2.05:1, info en 2.98:1), asi que un anillo propio por
    // variante no es salvable subiendo la opacidad. El anillo es uno solo.
    for (const [name, source] of PRIMITIVES) {
      const offenders = source.match(
        /(?:dark:)?(?:aria-invalid:)?focus-visible:ring-(?:destructive|success|warning|info)[\w/[\]-]*/g
      );
      expect(offenders, `${name}.tsx sobrescribe el anillo de foco con un tono semantico`).toBeNull();
    }
  });

  it("ninguna primitiva reemplaza el anillo de foco cuando el control es invalido", () => {
    // Un `aria-invalid:ring-destructive/20` le ganaba al anillo de foco y dejaba
    // el campo invalido enfocado en 1.30:1 — el control que mas necesita el
    // indicador era el unico sin uno valido.
    for (const [name, source] of PRIMITIVES) {
      const offenders = source.match(/aria-invalid:ring-[\w/[\]-]+/g);
      expect(offenders, `${name}.tsx le da al estado invalido un anillo propio`).toBeNull();
    }
  });
});
