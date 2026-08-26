// Inventario de todo lo que el JavaScript necesita encontrar en el DOM.
// Reescribir templates HTML a mano es exactamente donde se pierde un data-act
// o un id y la app deja de responder sin tirar un solo error.
import { readFileSync } from "node:fs";
const files = ["src/app.ts", "index.html"];
const attrs = new Map(); // atributo -> conjunto de valores
const selectors = new Set();
const ATTR =
  /\b(data-act|data-v|data-f|data-k|data-idx|data-i|id|name|type|for|aria-label|role)="([^"$`]*)"/g;
const SEL = /(?:\$\$?|querySelector(?:All)?|getElementById|closest|matches)\(\s*(['"])([^'"]+)\1/g;
const CLS = /classList\.(?:add|remove|toggle|contains|replace)\(\s*(['"])([^'"]+)\1/g;
for (const f of files) {
  const s = readFileSync(f, "utf8");
  for (const m of s.matchAll(ATTR)) {
    if (!attrs.has(m[1])) attrs.set(m[1], new Set());
    attrs.get(m[1]).add(m[2]);
  }
  for (const m of s.matchAll(SEL)) selectors.add(m[2]);
  for (const m of s.matchAll(CLS)) selectors.add("." + m[2]);
}
const out = [];
for (const k of [...attrs.keys()].sort()) out.push(`${k}: ${[...attrs.get(k)].sort().join(" ")}`);
out.push("SELECTORES: " + [...selectors].sort().join(" "));
console.log(out.join("\n"));
