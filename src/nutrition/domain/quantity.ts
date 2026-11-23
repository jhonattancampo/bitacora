/* =========================================================
   nutrition/domain/quantity.ts — How much of it was eaten.

   Four rules, tried in this order, and the order is the whole
   point:

     1. Grams or millilitres written down. Nothing beats being told.
     2. The food is COUNTED, not weighed. Then the number is a
        number of units and no table may touch it. This is the
        rule that is easy to get wrong: "2 rebanadas de pan",
        with bread defined per unit, is 2 units — not 2 x 30 g,
        even though a "rebanada" is 30 g in the table below.
        Reading it as 60 g logs a plausible, wrong number that
        nobody notices.
     3. A household measure, through the configurable table.
     4. Nothing was said: 100 g, or one unit for counted foods.
   ========================================================= */

import type { Food, Quantity } from "./types";
import { normalize, stem, tokens } from "./text";
import { measureForRoot } from "./measures";

/** Written-out numbers, as people actually type them. */
const WORD_NUMBERS: Record<string, number> = {
  medio: 0.5,
  media: 0.5,
  un: 1,
  uno: 1,
  una: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
  once: 11,
  doce: 12,
};

/** Longest spellings first, so "gramos" is not read as a "g" with leftovers. */
const EXPLICIT =
  /(\d+(?:[.,]\d+)?)\s*(kilogramos|kilogramo|kilos|kilo|kg|gramos|gramo|gr|g|litros|litro|lt|l|ml|cc)\b/;

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** A token as a number, whether it was typed in digits or in words. */
export const numberOf = (token: string | undefined): number | null => {
  if (!token) return null;
  if (/^\d/.test(token)) {
    const n = parseFloat(token.replace(",", "."));
    return isNaN(n) ? null : n;
  }
  return WORD_NUMBERS[token] ?? null;
};

const firstNumber = (ts: string[]): number | null => {
  for (const t of ts) {
    const n = numberOf(t);
    if (n !== null) return n;
  }
  return null;
};

/**
 * Reads the quantity out of one line of text.
 *
 * `food` is optional because the quantity is sometimes parsed before anything
 * is known about what was eaten; pass it whenever the catalog already matched,
 * or rule 2 cannot fire and counted foods come out in grams.
 */
export function parseQuantity(text: string, food?: Pick<Food, "basis">): Quantity {
  const norm = normalize(text);

  // 1. Grams or millilitres, written down.
  const explicit = EXPLICIT.exec(norm);
  if (explicit) {
    const n = parseFloat(explicit[1].replace(",", "."));
    const unit = explicit[2];
    if (/^(kilogramos|kilogramo|kilos|kilo|kg)$/.test(unit))
      return { qty: round2(n * 1000), unit: "g" };
    if (/^(litros|litro|lt|l)$/.test(unit)) return { qty: round2(n * 1000), unit: "ml" };
    if (/^(ml|cc)$/.test(unit)) return { qty: round2(n), unit: "ml" };
    return { qty: round2(n), unit: "g" };
  }

  const ts = tokens(norm);

  // 2. Counted foods: the number is how many, and the measures table stays out of it.
  if (food?.basis === "perUnit") {
    return { qty: firstNumber(ts) ?? 1, unit: "unit" };
  }

  // 3. A household measure, with whatever number sits in front of it.
  for (let i = 0; i < ts.length; i++) {
    const hit = measureForRoot(stem(ts[i]));
    if (!hit) continue;
    const n = numberOf(ts[i - 1]) ?? 1;
    if (hit.measure.grams != null) {
      return { qty: round2(n * hit.measure.grams), unit: "g", measure: hit.name };
    }
    if (hit.measure.ml != null) {
      return { qty: round2(n * hit.measure.ml), unit: "ml", measure: hit.name };
    }
  }

  // 4. Nothing was said.
  return { qty: 100, unit: food?.basis === "per100ml" ? "ml" : "g" };
}
