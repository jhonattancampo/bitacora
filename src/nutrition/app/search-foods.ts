/* =========================================================
   nutrition/app/search-foods.ts — POST /foods/search

   The catalog lookup on its own, for a box the user types into
   while they pick a food by hand. Same search the parser uses,
   so what the autocomplete offers and what the parser resolves
   can never drift apart.
   ========================================================= */

import type { Food, FoodBasis, Macros } from "../domain/types";
import { searchFoods as searchCatalog } from "../domain/search";
import type { Notice } from "./notices";
import { notice } from "./notices";

export const DEFAULT_LIMIT = 10;

export interface SearchRequest {
  q: string;
  limit?: number;
}

/** A catalog entry as the outside sees it: enough to show it and to log it. */
export interface FoodHit {
  id: string;
  name: string;
  basis: FoodBasis;
  macros: Macros;
  unitGrams?: number;
  score: number;
}

export interface SearchResponse {
  q: string;
  matches: FoodHit[];
  notices: Notice[];
}

export interface SearchDeps {
  catalog: Food[];
}

export function searchFoods(deps: SearchDeps, req: SearchRequest): SearchResponse {
  const q = (req.q ?? "").trim();
  if (q === "") {
    return { q, matches: [], notices: [notice("empty", "Escribí algo para buscar.")] };
  }

  const limit = req.limit && req.limit > 0 ? req.limit : DEFAULT_LIMIT;
  const matches = searchCatalog(deps.catalog, q)
    .slice(0, limit)
    .map(({ food, score }) => ({
      id: food.id,
      name: food.name,
      basis: food.basis,
      macros: food.macros,
      ...(food.unitGrams === undefined ? {} : { unitGrams: food.unitGrams }),
      score,
    }));

  const notices =
    matches.length === 0
      ? [notice("unresolved", `No encontré nada para "${q}" en el catálogo.`, [q])]
      : [];

  return { q, matches, notices };
}
