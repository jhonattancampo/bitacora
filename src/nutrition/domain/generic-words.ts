/* =========================================================
   nutrition/domain/generic-words.ts — The words that describe
   almost any food, and therefore identify none.

   Without this, "pollo cocido" matches "bife de lomo cocido":
   they do share a word, and if that word were worth its length
   the match would clear the threshold on its own. Generic words
   are worth 1 instead, so they can break a tie but never make
   a match by themselves.

   STOP_WORDS go further: they are worth nothing at all. They are
   grammar, not description.

   Both lists are stored as roots, because that is what the search
   compares. Both are meant to be edited as the catalog grows.
   ========================================================= */

import { stem } from "./text";

const asRoots = (list: string[]): Set<string> => new Set(list.map((w) => stem(w)));

/** Articles and prepositions. They never score. */
export const STOP_WORDS: Set<string> = asRoots([
  "de",
  "del",
  "la",
  "el",
  "los",
  "las",
  "un",
  "una",
  "unos",
  "unas",
  "al",
  "a",
  "con",
  "sin",
  "y",
  "e",
  "en",
]);

/**
 * Preparation and qualifier words. They score 1, whatever their length.
 *
 * The variety words at the end matter as much as the cooking ones. "integral"
 * is eight letters long and identifies nothing on its own: without it here,
 * "pan integral" scores 8 against "Arroz integral" and logs the wrong food,
 * which is the exact failure this whole rule exists to prevent.
 */
export const GENERIC_WORDS: Set<string> = asRoots([
  "cocido",
  "cocida",
  "crudo",
  "hervido",
  "asado",
  "frito",
  "plancha",
  "horno",
  "vapor",
  "natural",
  "fresco",
  "light",
  "magra",
  "magro",
  "entero",
  "entera",
  "descremado",
  "desnatado",
  "integral",
  "comun",
  "casero",
  "casera",
  "dietetico",
  "diet",
  "blanco",
  "blanca",
  "negro",
  "negra",
]);

export const isStopWord = (root: string): boolean => STOP_WORDS.has(root);

export const isGenericWord = (root: string): boolean => GENERIC_WORDS.has(root);

/**
 * A real word is worth at least this much, however short it is.
 *
 * Length alone left short foods unreachable: "pan" is worth 3 against a
 * threshold of 4, and so are "papa", "uva", "ajo", "sal" and "pavo" — none of
 * them could ever be found, including the one the spec uses in its own worked
 * example. The floor has to match search.ts's MIN_SCORE, and a test holds the
 * two together.
 *
 * Three letters is where a word starts counting as one. Below that the floor
 * would hand noise like "ya" or "no" the power to match a food on its own.
 */
export const MIN_WORD_WEIGHT = 4;

const REAL_WORD_LENGTH = 3;

/**
 * What one matched root is worth.
 *
 * A descriptive word is worth its length, so "pechuga" outweighs "pollo" and
 * both outweigh noise, but never less than the threshold: a word that names
 * the food is enough on its own. A generic one is worth 1, so it can break a
 * tie and never make a match by itself. Grammar is worth nothing.
 */
export const weightOf = (root: string): number => {
  if (isStopWord(root)) return 0;
  if (isGenericWord(root)) return 1;
  return root.length >= REAL_WORD_LENGTH ? Math.max(root.length, MIN_WORD_WEIGHT) : root.length;
};
