/* =========================================================
   nutrition/domain/text.ts — Turning what the user typed into
   comparable words.

   The catalog is written in one form ("Pechuga de pollo cocida")
   and people type another ("pollo cocido"). Comparing the strings
   as they are finds nothing, so both sides are reduced to roots
   before they meet. The rule is deliberately small: Spanish
   gender and number endings, nothing else. A real stemmer would
   be more accurate and far harder to predict, and a food catalog
   does not need one.
   ========================================================= */

/** Lowercase, accents removed, so "Pollo" and "pollo" and "pollò" are one word. */
export const normalize = (s: string): string =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Splits on anything that is not a letter or a digit, dropping the empties. */
export const words = (s: string): string[] =>
  normalize(s)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

/**
 * The root of a Spanish word, so "cocida", "cocido" and "cocidos" meet at "cocid".
 *
 * Plural first, then gender, because "aceites" has to lose both to reach the
 * same place as "aceite". Short words are left alone: cutting "pan" or "uva"
 * would merge foods that have nothing to do with each other.
 */
export const stem = (w: string): string => {
  let r = w;
  if (r.length > 4 && r.endsWith("es")) r = r.slice(0, -2);
  else if (r.length > 4 && r.endsWith("s")) r = r.slice(0, -1);
  if (r.length > 3 && /[oae]$/.test(r)) r = r.slice(0, -1);
  return r;
};

/** Every root in a phrase, duplicates included, in the order they were written. */
export const stems = (s: string): string[] => words(s).map(stem);

/** The distinct roots in a phrase. What the search actually compares. */
export const stemSet = (s: string): Set<string> => new Set(stems(s));

/**
 * Words and numbers, in the order they were written, with decimals kept whole.
 *
 * `words()` is not enough here: it splits on every non-letter, so "1,5 tazas"
 * would arrive as "1", "5", "tazas" and the parser would read five cups.
 */
export const tokens = (s: string): string[] => normalize(s).match(/\d+(?:[.,]\d+)?|[a-z]+/g) ?? [];
