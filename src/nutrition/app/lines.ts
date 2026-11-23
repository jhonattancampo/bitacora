/* =========================================================
   nutrition/app/lines.ts — Cutting what the user typed into
   the things they ate.

   "150 g de pollo, una taza de arroz integral y una cucharada
   de aceite" is three foods, and every step after this one
   works on one food at a time.

   The comma is the trap. It separates foods AND it is how a
   number is written in Spanish, so cutting on every comma turns
   "1,5 tazas de arroz" into "1" and "5 tazas de arroz" — which
   logs five cups, 900 g instead of 270, as a catalog item, with
   no sign that anything went wrong. A comma only separates when
   it does not sit between two digits.

   The same thing happens with "y": "1 y media taza" would split
   the number off from what it counts, so a fragment that is
   nothing but a number is joined back onto the piece after it.
   ========================================================= */

import { isBareNumber } from "../domain/quantity";

/**
 * A comma cuts unless it has a digit on both sides; a semicolon and a newline
 * always cut; and so does a standalone "y", which needs spaces on both sides
 * so it never cuts a word in half.
 */
const SEPARATORS = /[\n\r;]+|(?<!\d),|,(?!\d)|\s+y\s+/gi;

export const splitLines = (text: unknown): string[] => {
  const pieces = (typeof text === "string" ? text : "")
    .split(SEPARATORS)
    .map((s) => s.trim())
    .filter((s) => s !== "");

  const lines: string[] = [];
  let pending = "";

  for (const piece of pieces) {
    const joined = pending === "" ? piece : `${pending} ${piece}`;
    // A piece that is only a number is not a food. It is the front of the
    // next one, which the separator cut it away from.
    if (isBareNumber(piece)) {
      pending = joined;
      continue;
    }
    lines.push(joined);
    pending = "";
  }
  if (pending !== "") lines.push(pending);

  return lines;
};
