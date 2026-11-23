/* =========================================================
   nutrition/domain/types.ts — The shapes the nutrition module
   reasons about, before anything is stored or rendered.

   This module is pure and transport-agnostic on purpose: the
   same entities travel from a browser click, from localStorage
   and, later, from an HTTP body, without a single field knowing
   which one it came from. That is what makes the use cases in
   nutrition/app mountable behind an API later on.
   ========================================================= */

/** The four numbers every food, item, slot and day is measured in. */
export interface Macros {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

/** The keys of `Macros`, so the maths can iterate instead of repeating itself four times. */
export const MACRO_KEYS = ["kcal", "protein", "carbs", "fat"] as const;

export type MacroKey = (typeof MACRO_KEYS)[number];

/**
 * How a catalog entry states its macros, and therefore how a quantity scales them.
 * `perUnit` is the one that bites: those foods are counted, not weighed.
 */
export type FoodBasis = "per100g" | "per100ml" | "perUnit";

/** A quantity, once the text has been read. Never a household measure: those are resolved away. */
export type QuantityUnit = "g" | "ml" | "unit";

export interface Quantity {
  qty: number;
  unit: QuantityUnit;
  /** The household measure the number came from ("taza"), when it came from one. */
  measure?: string;
}

/** One entry of the local catalog. */
export interface Food {
  id: string;
  name: string;
  /** Extra words that should find this food but do not belong in its name. */
  aliases?: string[];
  basis: FoodBasis;
  /** Macros for 100 g, for 100 ml, or for one unit, as `basis` says. */
  macros: Macros;
  /** What one unit weighs. Only meaningful for `perUnit` foods, and only when known. */
  unitGrams?: number;
}

/**
 * Where an item's numbers came from. The distinction is not cosmetic: `estimated`
 * means a language model guessed them, and the UI has to say so.
 */
export type ItemSource = "catalog" | "estimated";

/** One thing eaten, already resolved to numbers. */
export interface LoggedItem {
  id: string;
  name: string;
  qty: number;
  unit: QuantityUnit;
  macros: Macros;
  source: ItemSource;
  /** Set only when `source` is `catalog`. */
  foodId?: string;
}

/** One meal of the day, as the plan names it. */
export interface MealSlot {
  id: string;
  name: string;
}

/** What was logged in one slot. A slot with an empty `items` counts as not logged yet. */
export interface SlotLog {
  slotId: string;
  items: LoggedItem[];
}

export interface DayLog {
  /** ISO date, `YYYY-MM-DD`. */
  date: string;
  slots: SlotLog[];
}

/** The plan the day is measured against: the daily total and how it was split across slots. */
export interface DayPlan {
  daily: Macros;
  /** The original split, keyed by slot id. This never changes as the day is logged. */
  perSlot: Record<string, Macros>;
  /** Slot ids in the order they are eaten. */
  order: string[];
}
