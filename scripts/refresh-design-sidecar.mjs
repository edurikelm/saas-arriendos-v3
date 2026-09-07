/**
 * Re-extrae la narrativa de DESIGN.md hacia .impeccable/design.json.
 *
 * El sidecar es el que consumen las herramientas; su narrativa debe espejar
 * DESIGN.md sin reformular. Los tokens (colorMeta, componentes, extensions) no
 * se tocan acá: eso es trabajo de `/impeccable document` en modo scan.
 *
 * Las reglas se ubican por índice y se cortan entre inicio y inicio, en vez de
 * con un lookahead: la versión con lookahead dejaba que la primera regla de cada
 * sección se tragara el resto y el sidecar terminaba con 5 de 14.
 */
import fs from "node:fs";

const SECTION_KEY = {
  Colors: "colors",
  Typography: "typography",
  Layout: "layout",
  "Elevation & Depth": "elevation",
  Shapes: "shapes",
  Components: "components",
};

const md = fs.readFileSync("DESIGN.md", "utf8");
const body = md.slice(md.indexOf("\n# Design System:"));

const sections = {};
for (const chunk of body.split(/\n## /).slice(1)) {
  const nl = chunk.indexOf("\n");
  sections[chunk.slice(0, nl).trim()] = chunk.slice(nl);
}

function extractRules(text, section) {
  const starts = [...text.matchAll(/\*\*(The [^*]+?(?:Rule|Doctrine|Split))\.\*\*/g)];
  return starts.map((m, i) => {
    const from = m.index + m[0].length;
    const nextRule = i + 1 < starts.length ? starts[i + 1].index : text.length;
    // Una regla tampoco cruza un subtítulo ni un separador.
    const stop = text.slice(from, nextRule).search(/\n### |\n---\n/);
    const to = stop >= 0 ? from + stop : nextRule;
    return { name: m[1].trim(), body: text.slice(from, to).trim(), section };
  });
}

const rules = [];
for (const [name, text] of Object.entries(sections)) {
  rules.push(...extractRules(text, SECTION_KEY[name] ?? name.toLowerCase()));
}

const ov = sections.Overview ?? "";
const kc = ov.indexOf("**Key Characteristics:**");
const dd = sections["Do's and Don'ts"] ?? "";
const bullets = (heading) => {
  const i = dd.indexOf(`### ${heading}`);
  if (i < 0) return [];
  const rest = dd.slice(i + heading.length + 4);
  const end = rest.search(/\n### |\n## /);
  return [...(end > -1 ? rest.slice(0, end) : rest).matchAll(/^- (.+(?:\n {2}.+)*)$/gm)]
    .map((m) => m[1].replace(/\n\s+/g, " ").trim());
};

const sidecar = JSON.parse(fs.readFileSync(".impeccable/design.json", "utf8"));
sidecar.generatedAt = new Date().toISOString();
sidecar.narrative = {
  northStar: (ov.match(/\*\*Creative North Star:\s*"([^"]+)"\*\*/) ?? [])[1] ?? "",
  overview: ov.slice(0, kc > -1 ? kc : undefined).replace(/\*\*Creative North Star:[^\n]*\n/, "").trim(),
  keyCharacteristics: kc > -1 ? [...ov.slice(kc).matchAll(/^- (.+)$/gm)].map((m) => m[1].trim()) : [],
  rules,
  dos: bullets("Do"),
  donts: bullets("Don't"),
};
fs.writeFileSync(".impeccable/design.json", JSON.stringify(sidecar, null, 2) + "\n");

console.log(`reglas: ${rules.length}`);
for (const r of rules) console.log(`  ${r.section.padEnd(11)} ${r.name}  (${r.body.length} chars)`);
console.log(`dos: ${sidecar.narrative.dos.length}  donts: ${sidecar.narrative.donts.length}`);
const vacias = rules.filter((r) => r.body.length < 40);
if (vacias.length) { console.error("reglas sin cuerpo:", vacias.map((r) => r.name)); process.exit(1); }
