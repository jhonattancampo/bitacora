/* =========================================================
   nutrition/domain/search.ts — Finding a food in the local
   catalog before anyone thinks about asking a language model.

   The catalog is the first step of the pipeline, not the last
   resort. Every line this file resolves is a line that costs
   nothing, answers instantly, works offline, and carries real
   numbers instead of an estimate.

   Scoring: a query root that the food also has is worth
   `weightOf` it — its length when it describes the food, 1 when
   it could describe anything. Below MIN_SCORE the match is
   thrown away, because a wrong food silently logged is worse
   than no food at all.
   ========================================================= */

import type { Food } from "./types";
import { stemSet } from "./text";
import { weightOf } from "./generic-words";

/** Below this, a match is noise. One generic word in common scores 1; it should never win. */
export const MIN_SCORE = 4;

export interface FoodMatch {
  food: Food;
  score: number;
  /** The roots the query and the food had in common, for explaining a match. */
  matched: string[];
}

/** Every distinct root that identifies a food: its name plus its aliases. */
export const foodRoots = (food: Food): Set<string> =>
  stemSet([food.name, ...(food.aliases ?? [])].join(" "));

/** What this food is worth against an already-rooted query. */
export const scoreFood = (food: Food, queryRoots: Set<string>): FoodMatch => {
  const matched: string[] = [];
  let score = 0;
  for (const root of foodRoots(food)) {
    if (!queryRoots.has(root)) continue;
    const w = weightOf(root);
    if (w === 0) continue;
    matched.push(root);
    score += w;
  }
  return { food, score, matched };
};

/**
 * The catalog entries that match `query`, best first.
 *
 * Ties go to the shorter name: when "Pollo" and "Pollo a la parrilla con piel"
 * score the same, the plain one is what the user meant. The last tiebreak is
 * the name itself, so the order never depends on how the catalog was built.
 */
export function searchFoods(
  catalog: Food[],
  query: string,
  minScore: number = MIN_SCORE,
): FoodMatch[] {
  const queryRoots = stemSet(query);
  if (queryRoots.size === 0) return [];
  return catalog
    .map((food) => scoreFood(food, queryRoots))
    .filter((m) => m.score >= minScore)
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.food.name.length - b.food.name.length ||
        a.food.name.localeCompare(b.food.name),
    );
}

/**
 * The best match with its detail, or null when nothing cleared the threshold.
 *
 * `matched` is the part callers outside this module need: knowing WHICH words
 * named the food is what lets them take those words out before reading a
 * quantity, so the three in "pizza tres quesos" is not mistaken for one.
 */
export const bestMatch = (
  catalog: Food[],
  query: string,
  minScore: number = MIN_SCORE,
): FoodMatch | null => searchFoods(catalog, query, minScore)[0] ?? null;

/** The single best food, for callers that only need the entry itself. */
export const bestFood = (
  catalog: Food[],
  query: string,
  minScore: number = MIN_SCORE,
): Food | null => bestMatch(catalog, query, minScore)?.food ?? null;
