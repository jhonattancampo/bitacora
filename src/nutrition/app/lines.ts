/* =========================================================
   nutrition/app/lines.ts — Cutting what the user typed into
   the things they ate.

   "150 g de pollo, una taza de arroz integral y una cucharada
   de aceite" is three foods, and every step after this one
   works on one food at a time. Commas, newlines, semicolons
   and a standalone "y" are the separators; "y" needs spaces on
   both sides so it never cuts a word in half.
   ========================================================= */

const SEPARATORS = /[\n\r;,]+|\s+y\s+/gi;

export const splitLines = (text: string): string[] =>
  text
    .split(SEPARATORS)
    .map((s) => s.trim())
    .filter((s) => s !== "");
