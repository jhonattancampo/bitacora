/* =========================================================
   types.ts — The shapes the app stores and syncs.

   Until now these lived only in the JSON: every view guessed
   the fields from how the object next to it was built. Declaring
   them once means a typo in `repsMin` is a compile error instead
   of a blank cell in the routine editor.

   `lib/calc.ts` keeps its own, looser interfaces on purpose: it
   is a pure module and states the minimum it needs to read, not
   the full entity. Everything here is assignable to those.
   ========================================================= */

/** One movement in the library, whether it came from the plan, the public DB, or the user. */
export interface Exercise {
  id: string;
  name: string;
  group: string;
  /** Execution steps, one per line in the editor. */
  cues: string[];
  /** The single most common mistake. Empty string when there is nothing to warn about. */
  err: string;
  /** Why this exercise is in the plan. */
  tip: string;
  /** True when the user wrote it by hand, false for seeded or imported ones. */
  custom: boolean;
  images?: string[];
  /** Set when the photo is a near variant rather than this exact movement. */
  photoNote?: string;
  /** Free Exercise DB id, present only on imported exercises. */
  sourceId?: string;
}

/** One row of a routine: the target, before any weight is lifted. */
export interface RoutineItem {
  id: string;
  exerciseId: string;
  sets: number;
  repsMin: number;
  repsMax: number;
  /** Reps in reserve, written as a range: "1-2". */
  rir: string;
  /** Rest in seconds. */
  rest: number;
  /** Superset letter. Empty string means it runs on its own. */
  ss: string;
  note?: string;
}

export interface Routine {
  id: string;
  name: string;
  subtitle: string;
  /** Rough duration shown in the seed. Not maintained for routines the user creates. */
  mins?: number;
  items: RoutineItem[];
}

/**
 * One set as typed during the workout. The three numbers stay strings
 * because that is what the inputs hold, including the empty string for
 * "not filled in yet" — `num()` in lib/calc reads them.
 */
export interface SetRow {
  w: string;
  r: string;
  rir: string;
  done: boolean;
}

/**
 * The target copied onto an entry when the session starts.
 *
 * Every field is optional because the app has always read them that way:
 * the session card writes `t.rest || 90` and `t.repsMin || ""`, and
 * "cambiar el descanso de hoy" starts a target from `{}` when an entry
 * has none. `repsMin`/`repsMax` widen to string because the "agregar
 * ejercicio" sheet splits a `8-12` text field straight into them.
 */
export interface EntryTarget {
  sets?: number;
  repsMin?: number | string;
  repsMax?: number | string;
  rir?: string;
  rest?: number;
  ss?: string;
}

/** One exercise inside a session, with the sets actually performed. */
export interface SessionEntry {
  id: string;
  exerciseId: string;
  target?: EntryTarget;
  sets: SetRow[];
  /** Note for this exercise on this day only. */
  note?: string;
}

export interface Session {
  id: string;
  /** Null for a free session that came from no routine. */
  routineId: string | null;
  name: string;
  /** ISO date, `YYYY-MM-DD`. */
  date: string;
  startedAt: number;
  /** Set the moment the session is finished; absent while it is still active. */
  endedAt?: number;
  /** Human duration, e.g. "1h 12m". Written once, at finish. */
  dur?: string;
  notes: string;
  entries: SessionEntry[];
}

export interface BodyWeight {
  date: string;
  kg: number;
}

export interface Settings {
  /** Default rest in seconds, used when the item has none. */
  rest: number;
  sound: boolean;
  vibrate: boolean;
  /** Barbell weight for the plate calculator. */
  bar: number;
  autoTimer: boolean;
  wake: boolean;
  theme: string;
  accent: string;
}

/** Where the user last was. Persisted so the app reopens where they left it. */
export interface UiState {
  progressEx?: string;
  ptab?: string;
  exq?: string;
}

export interface AppState {
  v?: number;
  exercises: Exercise[];
  routines: Routine[];
  sessions: Session[];
  bw: BodyWeight[];
  /** The workout in progress, or null. Never synced: it belongs to this device. */
  active: Session | null;
  settings: Settings;
  ui: UiState;
  /** Stamped by sync.ts for last-write-wins. */
  updatedAt?: number;
}

/** The five screens the bottom nav switches between. */
export type ViewName = "train" | "routines" | "exercises" | "progress" | "settings";
