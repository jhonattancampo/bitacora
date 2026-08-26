/* =========================================================
   state/selectors.ts — Reading the state, in the words the
   views use.

   Two kinds live here. The lookups (`exById`, `routineById`)
   are trivial finds. The rest are the pure maths of lib/calc.ts
   with the current state already handed over, so a view can ask
   `bestE1RM(id)` without knowing where the sessions live.
   ========================================================= */
import {
  bestE1RM as calcBestE1RM,
  doneSessions as calcDoneSessions,
  e1rm,
  lastPerf as calcLastPerf,
  num,
  sessionVolume as calcSessionVolume,
  weeklySets as calcWeeklySets,
} from "../lib/calc";
import { state } from "./store";
import type { Exercise, Routine, Session, SessionEntry } from "../types";

export const exById = (id: string): Exercise | undefined =>
  state.exercises.find((e) => e.id === id);

/** The name to print. Falls back to a placeholder so a deleted exercise never blanks a row. */
export const exName = (id: string): string => {
  const e = exById(id);
  return e ? e.name : "(ejercicio borrado)";
};

export const routineById = (id: string): Routine | undefined =>
  state.routines.find((r) => r.id === id);

/** The entry with this id inside the session in progress, if there is one. */
export const entryOf = (id: string): SessionEntry | undefined =>
  (state.active && state.active.entries.find((e) => e.id === id)) || undefined;

/** Finished sessions, newest first. */
export const doneSessions = (): Session[] => calcDoneSessions(state.sessions) as Session[];

/** The last time this exercise was actually performed. Drives the grey "última vez" placeholders. */
export const lastPerf = (exId: string, excludeSessionId?: string) =>
  calcLastPerf(state.sessions, exId, excludeSessionId);

/** Best estimated 1RM ever recorded for this exercise. Drives the ★ personal record. */
export const bestE1RM = (exId: string, excludeSessionId?: string): number =>
  calcBestE1RM(state.sessions, exId, excludeSessionId);

/** Total kilos moved and sets completed in one session. */
export const sessionVolume = (s: Session): { v: number; sets: number } => calcSessionVolume(s);

/** Completed sets per muscle group over the last `days` days. */
export const weeklySets = (days: number): Record<string, number> =>
  calcWeeklySets(days, state.sessions, state.exercises);

/** One finished session's summary for a single exercise. */
export interface ExercisePoint {
  date: string;
  /** Weight and reps of the best set that day — the one that produced `e`. */
  bw: number;
  br: number;
  /** Estimated 1RM of that best set. */
  e: number;
  /** Kilos moved on this exercise that day. */
  vol: number;
  /** Sets marked done. */
  sets: number;
}

/**
 * Every finished session that has at least one completed set of this
 * exercise — the series behind the curve in Progreso and the "últimas
 * sesiones" list in the execution guide.
 *
 * **Newest first**, because it walks `doneSessions()` and that is the
 * order it returns. The guide relies on it (`.slice(0, 5)` is the five
 * most recent).
 *
 * Sessions where the exercise was present but nothing was ticked are
 * left out: they are not a data point, they are an exercise that was
 * skipped.
 */
export function exerciseHistory(exId: string): ExercisePoint[] {
  const out: ExercisePoint[] = [];
  doneSessions().forEach((s) => {
    const en = (s.entries || []).find((e) => e.exerciseId === exId);
    if (!en) return;
    let bw = 0,
      br = 0,
      best = 0,
      vol = 0,
      sets = 0;
    en.sets.forEach((x) => {
      if (!x.done) return;
      const w = num(x.w) || 0,
        r = num(x.r) || 0;
      sets++;
      vol += w * r;
      const e = e1rm(w, r);
      if (e > best) {
        best = e;
        bw = w;
        br = r;
      }
    });
    if (sets) out.push({ date: s.date, bw, br, e: best, vol, sets });
  });
  return out;
}
