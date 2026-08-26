/* =========================================================
   data/groups.ts — Two lookups keyed by things the user picks:
   muscle group and accent colour.

   `GROUPS` — the ordered list of muscle groups — lives in
   lib/calc.ts, because the weekly-sets maths needs it.
   ========================================================= */

/**
 * Weekly effective-set range per muscle group, as `[min, max]`.
 * These are the plan's own numbers and they draw the zone marks
 * on the volume bars in Progreso.
 */
export const RANGES: Record<string, [number, number]> = {
  Pecho: [10, 20],
  Espalda: [10, 20],
  "Deltoides lateral": [8, 16],
  "Deltoides ant/post": [4, 10],
  Bíceps: [8, 16],
  Tríceps: [8, 16],
  Antebrazo: [2, 10],
  Cuádriceps: [10, 18],
  "Isquios/Glúteo": [10, 18],
  Gemelos: [6, 12],
  Aductores: [2, 10],
  Core: [6, 12],
};

/**
 * The swatch colours in Ajustes → Color. The live accent comes from the
 * `--sig` CSS variable per `[data-accent]`; this map only paints the
 * six buttons the user picks from, which need the value in JS.
 */
export const ACCENT_HEX: Record<string, string> = {
  mostaza: "#FFCC1D",
  verde: "#3ADB7A",
  fucsia: "#FF4FA6",
  violeta: "#9B6BFF",
  celeste: "#33C4F2",
  coral: "#FF7A59",
};
