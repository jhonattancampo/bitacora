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
import type { AppState, Settings } from "../types";

/**
 * The defaults every stored state is filled in against, so a field added
 * in a later build never lands as undefined.
 */
export const DEFAULT_SETTINGS: Settings = {
  rest: 90,
  sound: true,
  vibrate: true,
  bar: 20,
  autoTimer: true,
  wake: true,
  theme: "dark",
  accent: "mostaza",
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
  s.ui = s.ui || {};
  s.settings = Object.assign({ ...DEFAULT_SETTINGS }, s.settings || {});
  return s;
}
