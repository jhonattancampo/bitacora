/* =========================================================
   state/migrate.ts — Filling in what a state written by an
   older build is missing.

   Every field the app added after v1 has to arrive with a value
   on states that predate it, or a view crashes on the first
   `.map()`. The rules here are not cosmetic: which exercises get
   the public-domain photos, and which are left alone, decides
   whether a user's own exercise silently grows someone else's
   picture.
   ========================================================= */
import { EX_IMAGES, EX_PHOTO_NOTE } from "../data/exercises";
import type { AppState, NutritionSettings, Settings } from "../types";
import type { Macros } from "../nutrition/domain/types";

/**
 * The defaults every stored state is filled in against, so a field added
 * in a later build never lands as undefined.
 */
const macros = (kcal: number, protein: number, carbs: number, fat: number): Macros => ({
  kcal,
  protein,
  carbs,
  fat,
});

/**
 * A starting plan, meant to be edited. The four meals split the day
 * 25 / 35 / 15 / 25, which adds up exactly to the daily target: the per-slot
 * figures are what the recalculation divides proportionally, so a split that
 * does not add up would quietly move every target.
 */
export const defaultNutrition = (): NutritionSettings => ({
  daily: macros(2000, 150, 200, 60),
  slots: [
    { id: "desayuno", name: "Desayuno" },
    { id: "almuerzo", name: "Almuerzo" },
    { id: "merienda", name: "Merienda" },
    { id: "cena", name: "Cena" },
  ],
  perSlot: {
    desayuno: macros(500, 37.5, 50, 15),
    almuerzo: macros(700, 52.5, 70, 21),
    merienda: macros(300, 22.5, 30, 9),
    cena: macros(500, 37.5, 50, 15),
  },
});

/** The stored plan filled in against the defaults, as a fresh object every time. */
export const mergeNutrition = (stored?: Partial<NutritionSettings>): NutritionSettings => {
  const base = defaultNutrition();
  if (!stored) return base;
  return {
    daily: { ...base.daily, ...(stored.daily ?? {}) },
    slots: stored.slots?.length ? stored.slots.map((s) => ({ ...s })) : base.slots,
    perSlot: stored.perSlot ? { ...stored.perSlot } : base.perSlot,
  };
};

export const DEFAULT_SETTINGS: Settings = {
  rest: 90,
  sound: true,
  vibrate: true,
  bar: 20,
  autoTimer: true,
  wake: true,
  theme: "dark",
  accent: "mostaza",
  get nutrition() {
    // A getter so every read hands back a fresh plan: spreading
    // DEFAULT_SETTINGS would otherwise share one object with every state.
    return defaultNutrition();
  },
};

/**
 * Brings a state read from disk up to what the current build expects.
 * Mutates in place, because that state is the one the app is about to run on.
 *
 * The photo rules, which are the only non-obvious part:
 * - an exercise with no `images` gets the seeded ones, but only if it is
 *   not the user's own — someone's custom "Press raro" must not inherit a
 *   stranger's photos just because it shares an id;
 * - `photoNote` is only added to a seeded exercise that is still seeded:
 *   `custom` or `sourceId` mean the entry was written or replaced by the
 *   user, and the note would then describe a photo that is no longer there.
 */
export function migrate(s: AppState): AppState {
  s.exercises = s.exercises || [];
  s.routines = s.routines || [];
  s.sessions = s.sessions || [];
  s.exercises.forEach((e) => {
    if (!e.images) e.images = EX_IMAGES[e.id] && !e.custom ? EX_IMAGES[e.id].images.slice() : [];
    if (!e.photoNote && EX_PHOTO_NOTE[e.id] && !e.custom && !e.sourceId)
      e.photoNote = EX_PHOTO_NOTE[e.id];
  });
  s.bw = s.bw || [];
  s.dayLogs = s.dayLogs || [];
  s.ui = s.ui || {};
  s.settings = Object.assign({ ...DEFAULT_SETTINGS }, s.settings || {});
  // Rebuilt rather than spread: DEFAULT_SETTINGS is spread shallowly, so
  // without this every state would share ONE plan object with the defaults,
  // and editing the plan would edit the defaults for the next state too.
  s.settings.nutrition = mergeNutrition(s.settings.nutrition);
  return s;
}
