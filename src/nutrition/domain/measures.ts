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

import { stem, normalize } from "./text";

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

/** Root -> measure, so a plural or an accent-less spelling still lands on the row. */
const BY_ROOT: Map<string, { name: string; measure: Measure }> = new Map(
  Object.entries(HOUSEHOLD_MEASURES).map(([name, measure]) => [
    stem(normalize(name)),
    { name, measure },
  ]),
);

/** The measure a single word names, or null when it names none. */
export const measureForRoot = (root: string): { name: string; measure: Measure } | null =>
  BY_ROOT.get(root) ?? null;
