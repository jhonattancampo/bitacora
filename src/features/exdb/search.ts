/* =========================================================
   features/exdb/search.ts — Buscar en espaniol contra una base
   escrita en ingles.

   Traduce los terminos antes de buscar, y busca tambien contra
   musculo y equipo, no solo contra el nombre: "polea" tiene que
   encontrar los ejercicios de cable aunque la palabra no este
   en el titulo.

   Todo lo de aca es puro: entra texto, sale un puntaje. Sin DOM,
   sin estado, sin red.
   ========================================================= */
import { EXDB_PHRASES, EXDB_STOP, EXDB_WORDS, MUSCLE_TO_GROUP } from "./dictionary";

/** Un ejercicio de la base publica, ya adelgazado por `exdbEnsure`. */
export interface ExdbEntry {
  id: string;
  name: string;
  muscles: string[];
  equipment: string;
  instructions: string[];
  images: string[];
}

export const noAccent = (s) =>
  String(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
// un token puede coincidir por sí mismo, por su singular o por cualquiera de sus traducciones
export function exdbTerms(tok) {
  const out = [];
  const add = (x) => {
    if (x && out.indexOf(x) < 0) out.push(x);
  };
  const forms = [tok];
  if (tok.length > 3 && /es$/.test(tok)) forms.push(tok.slice(0, -2));
  if (tok.length > 3 && /s$/.test(tok)) forms.push(tok.slice(0, -1));
  forms.forEach(add);
  forms.forEach((f) => {
    const v = EXDB_WORDS[f];
    if (v) v.forEach(add);
  });
  return out;
}
export function exdbTokens(q) {
  let n =
    " " +
    noAccent(q)
      .replace(/[^a-z0-9]+/g, " ")
      .trim() +
    " ";
  EXDB_PHRASES.forEach(([es, en]) => {
    n = n.split(" " + es + " ").join(" " + en + " ");
  });
  return n
    .trim()
    .split(/\s+/)
    .filter((t) => t && !EXDB_STOP.has(t));
}
export function exdbMatch(e, tokens, full) {
  const name = noAccent(e.name);
  const rest = noAccent((e.muscles || []).join(" ") + " " + (e.equipment || ""));
  let score = 0;
  for (const tok of tokens) {
    let hit = 0;
    // una traducción de varias palabras ("leg press") es más específica que una suelta
    for (const t of exdbTerms(tok)) {
      if (name.includes(t)) hit = Math.max(hit, t.indexOf(" ") >= 0 ? 5 : 3);
      else if (rest.includes(t)) hit = Math.max(hit, 1);
    }
    if (!hit) return -1;
    score += hit;
  }
  if (full && name.includes(full)) score += 6;
  if (full && name.startsWith(full)) score += 3;
  return score;
}

export function guessGroup(name, muscles) {
  const m = (muscles && muscles[0]) || "";
  if (m === "shoulders" && /lateral/i.test(name)) return "Deltoides lateral";
  return MUSCLE_TO_GROUP[m] || "Pecho";
}
