/* =========================================================
   state/store.ts — The single copy of everything the app knows,
   and the only place that writes it to disk.

   `state` is exported as a live binding: importing modules read
   and mutate the same object, and they see the swap when
   `setState()` replaces it wholesale (import, wipe, sync).
   Nothing outside this file assigns to `state` directly.
   ========================================================= */
import { EX_IMAGES, EX_PHOTO_NOTE, SEED_EX } from "../data/exercises";
import { SEED_ROUTINES } from "../data/routines";
import { toast } from "../ui/toast";
import { DEFAULT_SETTINGS, migrate } from "./migrate";
import type { AppState } from "../types";

export { DEFAULT_SETTINGS } from "./migrate";

const KEY = "bitacora_gym_v2";
/** How long a burst of edits is allowed to coalesce before hitting localStorage. */
const SAVE_DEBOUNCE_MS = 250;

/**
 * False when localStorage throws — a private window, or the sandboxed
 * preview. The app keeps working against `memBlob` and Ajustes shows a
 * warning instead of pretending the data is safe.
 */
export let STORAGE_OK = true;
let memBlob: string | null = null;

try {
  localStorage.setItem("__t", "1");
  localStorage.removeItem("__t");
} catch (e) {
  STORAGE_OK = false;
}

function readStore(): AppState | null {
  try {
    const raw = STORAGE_OK ? localStorage.getItem(KEY) : memBlob;
    return raw ? (JSON.parse(raw) as AppState) : null;
  } catch (e) {
    return null;
  }
}

/** A brand-new state: the plan's exercises and routines, no history. */
export function seedState(): AppState {
  return {
    v: 1,
    exercises: SEED_EX.map((x) => {
      const o: any = Object.assign({}, x);
      if (EX_IMAGES[x.id]) o.images = EX_IMAGES[x.id].images.slice();
      if (EX_PHOTO_NOTE[x.id]) o.photoNote = EX_PHOTO_NOTE[x.id];
      return o;
    }),
    routines: SEED_ROUTINES(),
    sessions: [],
    bw: [],
    active: null,
    settings: { ...DEFAULT_SETTINGS },
    ui: { progressEx: "press-inc" },
  };
}

/**
 * Everything the app knows. Mutate it in place; call `setState()` only
 * when the whole object is being replaced.
 */
export let state: AppState = readStore() || seedState();

migrate(state);

/**
 * Swaps the whole state — importing a backup, wiping, or adopting what
 * sync pulled down.
 *
 * Deliberately a plain swap: it does NOT re-run `migrate()`. Each caller
 * already fills in what it needs (the importer tops up settings and ui;
 * `adoptState` trusts what sync sends), and running the full migration
 * here would quietly start rewriting photos on imported files, which is
 * a behaviour change and not this refactor's job.
 */
export function setState(next: AppState): void {
  state = next;
}

let saveT: ReturnType<typeof setTimeout> | null = null;

/**
 * Persists the state and tells sync there is something new.
 * Debounced by default so typing into a set row does not write on every
 * keystroke; pass `now` for anything the user would be upset to lose.
 */
export function save(now?: boolean): void {
  const blob = JSON.stringify(state);
  memBlob = blob;
  if (!STORAGE_OK) return;
  if (saveT) clearTimeout(saveT);
  const w = () => {
    try {
      localStorage.setItem(KEY, blob);
    } catch (e) {
      STORAGE_OK = false;
      toast("No se pudo guardar: almacenamiento lleno");
    }
  };
  if (now) w();
  else saveT = setTimeout(w, SAVE_DEBOUNCE_MS);
  if (window.Sync) Sync.schedule(now ? 1500 : 5000);
}
