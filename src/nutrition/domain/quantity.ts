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

   Known limit, to be closed where it belongs: rules 2 and 4 read
   the number out of the WHOLE line, so a number inside the food's
   own name is mistaken for a quantity ("pizza tres quesos" reads
   as three). The fix is not here — it is in the use case, which
   knows which words the catalog matched and can hand this
   function only what is left.
   ========================================================= */

import type { Food, Quantity, QuantityUnit } from "./types";
import { normalize, tokens } from "./text";
import type { Measure } from "./measures";
import { measureForWord } from "./measures";

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

/** Words that are themselves a count of units: "media docena" is six, not a half. */
const COUNT_WORDS: Record<string, number> = {
  docena: 12,
  docenas: 12,
  decena: 10,
  decenas: 10,
  par: 2,
  pares: 2,
};

/**
 * Longest spellings first, so "gramos" is not read as a "g" with leftovers,
 * and the abbreviations people actually type ("grs", "lts") are in the list:
 * missing one does not fail loudly, it silently falls back to 100 g.
 */
const EXPLICIT =
  /(\d{1,3}(?:\.\d{3})+|\d+(?:[.,]\d+)?)\s*(kilogramos|kilogramo|kilos|kilo|kgs|kg|gramos|gramo|grs|gr|g|mililitros|mililitro|litros|litro|lts|lt|l|ml|cc)\b/;

const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * A written number, read the way it is written here: comma for decimals,
 * dot for thousands. "1.500" is fifteen hundred grams, not one and a half.
 */
export const parseDecimal = (raw: string): number | null => {
  if (/^\d{1,3}(?:\.\d{3})+$/.test(raw)) return parseInt(raw.replace(/\./g, ""), 10);
  if (/^\d+\/\d+$/.test(raw)) {
    const [a, b] = raw.split("/").map(Number);
    return b === 0 ? null : a / b;
  }
  const n = parseFloat(raw.replace(",", "."));
  return isNaN(n) ? null : n;
};

/** A token as a number, whether it was typed in digits, as a fraction, or in words. */
export const numberOf = (token: string | undefined): number | null => {
  if (!token) return null;
  if (/^\d/.test(token)) return parseDecimal(token);
  return WORD_NUMBERS[token] ?? null;
};

/**
 * The number sitting in front of position `i`, with "1 1/2" read as one and a
 * half rather than as a half.
 */
const numberBefore = (ts: string[], i: number): number | null => {
  const n = numberOf(ts[i - 1]);
  if (n === null) return null;
  if (/^\d+\/\d+$/.test(ts[i - 1] ?? "")) {
    const whole = numberOf(ts[i - 2]);
    if (whole !== null && Number.isInteger(whole)) return whole + n;
  }
  return n;
};

const firstNumber = (ts: string[]): number | null => {
  for (let i = 0; i < ts.length; i++) {
    const n = numberOf(ts[i]);
    if (n !== null) return numberBefore(ts, i + 1) ?? n;
  }
  return null;
};

/** How many units a line asks for, counting words like "docena" included. */
const unitCount = (ts: string[]): number => {
  for (let i = 0; i < ts.length; i++) {
    const each = COUNT_WORDS[ts[i]];
    if (each !== undefined) return round2((numberBefore(ts, i) ?? 1) * each);
  }
  return firstNumber(ts) ?? 1;
};

/**
 * Which dimension a household measure is recorded in.
 *
 * A measure describes a PORTION — a spoonful, a cup — and the dimension
 * follows the food, not the table. A tablespoon is listed at 12 g, but olive
 * oil is listed per 100 ml, and refusing to reconcile the two meant "una
 * cucharada de aceite" could not be worked out at all. Liquids are taken at
 * 1 g per ml, which is exactly right for water, milk and juice and a few per
 * cent off for oil: much closer than the nothing it replaces.
 *
 * With no food in hand the table's own dimension stands.
 */
const measureUnit = (measure: Measure, food?: Pick<Food, "basis">): QuantityUnit => {
  if (food?.basis === "per100ml") return "ml";
  if (food?.basis === "per100g") return "g";
  return measure.grams != null ? "g" : "ml";
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
    const n = parseDecimal(explicit[1]);
    const unit = explicit[2];
    if (n !== null) {
      if (/^(kilogramos|kilogramo|kilos|kilo|kgs|kg)$/.test(unit)) {
        return { qty: round2(n * 1000), unit: "g" };
      }
      if (/^(litros|litro|lts|lt|l)$/.test(unit)) return { qty: round2(n * 1000), unit: "ml" };
      if (/^(mililitros|mililitro|ml|cc)$/.test(unit)) return { qty: round2(n), unit: "ml" };
      return { qty: round2(n), unit: "g" };
    }
  }

  const ts = tokens(norm);

  // 2. Counted foods: the number is how many, and the measures table stays out of it.
  if (food?.basis === "perUnit") return { qty: unitCount(ts), unit: "unit" };

  // 3. A household measure, with whatever number sits in front of it.
  for (let i = 0; i < ts.length; i++) {
    const hit = measureForWord(ts[i]);
    if (!hit) continue;
    const amount = hit.measure.grams ?? hit.measure.ml;
    if (amount == null) continue;
    const n = numberBefore(ts, i) ?? 1;
    return { qty: round2(n * amount), unit: measureUnit(hit.measure, food), measure: hit.name };
  }

  // 4. Nothing was said.
  return { qty: 100, unit: food?.basis === "per100ml" ? "ml" : "g" };
}
