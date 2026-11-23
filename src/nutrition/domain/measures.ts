/* =========================================================
   nutrition/domain/measures.ts — What a household measure
   weighs.

   People do not weigh a spoonful of oil, they say "a spoonful
   of oil". These are the equivalences the parser falls back to
   when no grams were written, and they are meant to be edited:
   a cup is 180 g here because that is what this user's cup
   holds, not because it is a universal truth.

   The table is written the way a person would read it. The root
   index below is built from it at load, so "taza" and "tazas"
   both find the same row without the table having to spell both.
   ========================================================= */

import { normalize } from "./text";

export interface Measure {
  /** What one of them weighs. Set this or `ml`, never both. */
  grams?: number;
  /** What one of them holds, for liquids. */
  ml?: number;
}

export const HOUSEHOLD_MEASURES: Record<string, Measure> = {
  taza: { grams: 180 },
  cucharada: { grams: 12 },
  rebanada: { grams: 30 },
  lata: { grams: 120 },
  scoop: { grams: 30 },
  copa: { ml: 150 },
  puñado: { grams: 25 },
  vaso: { ml: 200 },
};

/**
 * The spellings a row answers to: the word itself and its plural.
 *
 * Deliberately NOT the stem. Stemming the table merges rows with words that
 * have nothing to do with them: "copos" and "copa" share the root "cop", so
 * "2 copos de avena" was being read as two wine glasses, 300 ml of oats.
 */
const spellings = (name: string): string[] => {
  const w = normalize(name);
  return /[aeiou]$/.test(w) ? [w, w + "s"] : [w, w + "s", w + "es"];
};

const BY_WORD: Map<string, { name: string; measure: Measure }> = new Map(
  Object.entries(HOUSEHOLD_MEASURES).flatMap(([name, measure]) =>
    spellings(name).map((w) => [w, { name, measure }] as const),
  ),
);

/** The measure a single written word names, or null when it names none. */
export const measureForWord = (word: string): { name: string; measure: Measure } | null =>
  BY_WORD.get(word) ?? null;
