/* =========================================================
   nutrition/domain/macros.ts — Scaling a catalog entry to the
   amount that was actually eaten, and the small arithmetic the
   rest of the module does on the four numbers.

   `macrosFor` returns null rather than a guess when it cannot
   convert — a per-unit food asked for in grams with no unit
   weight on file, say. Null is a value the caller has to deal
   with; a silently invented 0 is not. The pipeline turns that
   null into a line the user can see.
   ========================================================= */

import type { Food, Macros, Quantity } from "./types";
import { MACRO_KEYS } from "./types";

export const zeroMacros = (): Macros => ({ kcal: 0, protein: 0, carbs: 0, fat: 0 });

/** kcal to the nearest whole number, the grams to one decimal. */
export const roundMacros = (m: Macros): Macros => ({
  kcal: Math.round(m.kcal),
  protein: Math.round(m.protein * 10) / 10,
  carbs: Math.round(m.carbs * 10) / 10,
  fat: Math.round(m.fat * 10) / 10,
});

export const scaleMacros = (m: Macros, factor: number): Macros => ({
  kcal: m.kcal * factor,
  protein: m.protein * factor,
  carbs: m.carbs * factor,
  fat: m.fat * factor,
});

export const addMacros = (a: Macros, b: Macros): Macros => ({
  kcal: a.kcal + b.kcal,
  protein: a.protein + b.protein,
  carbs: a.carbs + b.carbs,
  fat: a.fat + b.fat,
});

export const sumMacros = (list: Macros[]): Macros => list.reduce(addMacros, zeroMacros());

/** `a` minus `b`, never below zero: a day that went over target has 0 left, not -300. */
export const subtractToFloor = (a: Macros, b: Macros): Macros => {
  const out = zeroMacros();
  for (const k of MACRO_KEYS) out[k] = Math.max(0, a[k] - b[k]);
  return out;
};

/**
 * The macros of `qty` of `food`, or null when the two cannot be reconciled.
 *
 * The pairs that work are the ones the parser can produce: a weighed food in
 * grams, a liquid in millilitres, a counted food in units, and a counted food
 * in grams when its unit weight is on file. Everything else would need a
 * density or a weight nobody wrote down.
 */
export function macrosFor(food: Food, q: Quantity): Macros | null {
  const factor = conversionFactor(food, q);
  if (factor === null) return null;
  return roundMacros(scaleMacros(food.macros, factor));
}

const conversionFactor = (food: Food, q: Quantity): number | null => {
  switch (food.basis) {
    case "per100g":
      return q.unit === "g" ? q.qty / 100 : null;
    case "per100ml":
      return q.unit === "ml" ? q.qty / 100 : null;
    case "perUnit":
      if (q.unit === "unit") return q.qty;
      if (q.unit === "g" && food.unitGrams) return q.qty / food.unitGrams;
      return null;
  }
};
