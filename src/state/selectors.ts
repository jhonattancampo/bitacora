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
  lastPerf as calcLastPerf,
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
