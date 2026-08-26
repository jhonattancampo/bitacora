/* =========================================================
   calc.ts — Pure training maths, lifted out of app.ts so it
   can be tested without booting the DOM.
   The bodies are the same expressions the app has always run;
   the only change is that the state they read is passed in
   instead of closed over.
   ========================================================= */

export interface SetRow {
  w?: string | number | null;
  r?: string | number | null;
  rir?: string | number | null;
  done?: boolean;
}

export interface Entry {
  id?: string;
  exerciseId: string;
  sets: SetRow[];
  target?: { rest?: number; [k: string]: unknown };
}

export interface Session {
  id: string;
  date: string;
  name?: string;
  routineId?: string | null;
  dur?: string;
  notes?: string;
  startedAt?: number;
  endedAt?: number | null;
  entries?: Entry[];
}

export interface Exercise {
  id: string;
  name: string;
  group: string;
  [k: string]: unknown;
}

export const GROUPS = [
  "Pecho",
  "Espalda",
  "Deltoides lateral",
  "Deltoides ant/post",
  "Bíceps",
  "Tríceps",
  "Antebrazo",
  "Cuádriceps",
  "Isquios/Glúteo",
  "Gemelos",
  "Aductores",
  "Core",
];

/** Reads a number the way the inputs write it: "72,5" and "72.5" both work. */
export const num = (v: unknown): number | null => {
  if (v === "" || v == null) return null;
  const n = parseFloat(String(v).replace(",", "."));
  return isNaN(n) ? null : n;
};

export const clamp = (n: number, a: number, b: number): number => Math.max(a, Math.min(b, n));

/** Epley estimated one-rep max. Zero when either input is missing or zero. */
export const e1rm = (w: number, r: number): number => (w && r ? w * (1 + r / 30) : 0);

/** Finished sessions, newest first. */
export const doneSessions = (sessions: Session[]): Session[] =>
  (sessions || [])
    .filter((s) => s.endedAt)
    .sort((a, b) =>
      a.date < b.date ? 1 : a.date > b.date ? -1 : (b.startedAt || 0) - (a.startedAt || 0),
    );

/** Last time this exercise was actually performed (at least one set marked done). */
export function lastPerf(
  sessions: Session[],
  exId: string,
  excludeSessionId?: string,
): { date: string; sets: SetRow[] } | null {
  for (const s of doneSessions(sessions)) {
    if (s.id === excludeSessionId) continue;
    const en = (s.entries || []).find((e) => e.exerciseId === exId);
    if (en && en.sets.some((x) => x.done))
      return { date: s.date, sets: en.sets.filter((x) => x.done) };
  }
  return null;
}

/** Best estimated 1RM ever recorded for this exercise. Drives the ★ personal record. */
export function bestE1RM(sessions: Session[], exId: string, excludeSessionId?: string): number {
  let best = 0;
  for (const s of sessions || []) {
    if (!s.endedAt || s.id === excludeSessionId) continue;
    const en = (s.entries || []).find((e) => e.exerciseId === exId);
    if (!en) continue;
    en.sets.forEach((x) => {
      if (x.done) best = Math.max(best, e1rm(num(x.w) || 0, num(x.r) || 0));
    });
  }
  return best;
}

/** Total kilos moved and sets completed in one session. */
export function sessionVolume(s: Session): { v: number; sets: number } {
  let v = 0,
    sets = 0;
  (s.entries || []).forEach((en) =>
    en.sets.forEach((x) => {
      if (x.done) {
        sets++;
        v += (num(x.w) || 0) * (num(x.r) || 0);
      }
    }),
  );
  return { v, sets };
}

/** Completed sets per muscle group over the last `days` days. */
export function weeklySets(
  days: number,
  sessions: Session[],
  exercises: Exercise[],
  now: number = Date.now(),
): Record<string, number> {
  const lim = new Date(now - days * 864e5).toISOString().slice(0, 10);
  const out: Record<string, number> = {};
  GROUPS.forEach((g) => (out[g] = 0));
  (sessions || [])
    .filter((s) => s.endedAt && s.date >= lim)
    .forEach((s) => {
      (s.entries || []).forEach((en) => {
        const ex = (exercises || []).find((e) => e.id === en.exerciseId);
        if (!ex) return;
        const n = en.sets.filter((x) => x.done).length;
        out[ex.group] = (out[ex.group] || 0) + n;
      });
    });
  return out;
}
