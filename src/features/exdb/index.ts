/* =========================================================
   features/exdb/index.ts — La base publica de ejercicios:
   descarga, cache y la hoja de busqueda.

   Free Exercise DB (dominio publico): 873 ejercicios con fotos.
   Se baja una sola vez (~1 MB), se adelgaza a los campos que
   usamos y queda en localStorage para buscar sin conexion.

   La hoja es una sola, pero se abre desde seis lugares distintos
   y cada uno quiere algo distinto con el ejercicio elegido. Eso
   es lo que guarda `mode`, con su contexto al lado.
   ========================================================= */
import { $, esc, uid } from "../../lib/dom";
import { exById, entryOf, routineById } from "../../state/selectors";
import { save, state } from "../../state/store";
import { closeSheet, openSheet } from "../../ui/sheet";
import { render } from "../../ui/shell";
import { toast } from "../../ui/toast";
import { sheetExercise } from "../../views/ejercicios";
import { sheetRoutine } from "../../views/rutinas";
import { sheetSwapScope } from "../swap";
import { exdbMatch, exdbTokens, guessGroup, noAccent } from "./search";
import type { ExdbEntry } from "./search";

/** Cuanto espera despues de la ultima tecla antes de buscar. */
const DEBOUNCE_MS = 250;
/** Cuantos resultados se muestran. */
const MAX_HITS = 20;
/** Menos que esto no dispara busqueda: devolveria media base. */
const MIN_CHARS = 3;

const EXDB_URL =
  "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json";
const EXDB_KEY = "bitacora_exdb_v2";
let exdbCache = null;
export function exdbLoaded() {
  if (exdbCache) return exdbCache;
  try {
    exdbCache = JSON.parse(localStorage.getItem(EXDB_KEY) || "null");
  } catch (e) {}
  return exdbCache;
}
export async function exdbEnsure() {
  const have = exdbLoaded();
  if (have) return have;
  const res = await fetch(EXDB_URL);
  if (!res.ok) throw new Error("No se pudo descargar");
  const data = await res.json();
  const slim = data.map((e) => ({
    id: e.id,
    name: e.name,
    muscles: e.primaryMuscles || [],
    equipment: e.equipment || "",
    instructions: e.instructions || [],
    images: (e.images || []).map(
      (p) => "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/" + p,
    ),
  }));
  exdbCache = slim;
  try {
    localStorage.removeItem("bitacora_exdb_v1");
  } catch (e) {}
  try {
    localStorage.setItem(EXDB_KEY, JSON.stringify(slim));
  } catch (e) {}
  return slim;
}

let exdbMode = "form"; // 'form' | 'library' | 'routine' | 'replace-item' | 'replace-ex' | 'session-item'
let exdbRoutineId = null; // 'routine' y 'replace-item'
let exdbItemId = null; // solo usado en modo 'replace-item'
let exdbExId = null; // solo usado en modo 'replace-ex'
let exdbEntryId = null; // solo usado en modo 'session-item'
let exdbPending = null; // ejercicio elegido en 'session-item', esperando el alcance
function alreadyImported(sourceId) {
  return state.exercises.find((x) => x.sourceId === sourceId);
}
export function sheetExDbSearch(mode?, ctx?) {
  exdbMode = mode || "form";
  exdbRoutineId = null;
  exdbItemId = null;
  exdbExId = null;
  exdbEntryId = null;
  exdbPending = null;
  if (exdbMode === "routine") exdbRoutineId = ctx || null;
  if (exdbMode === "replace-item") {
    exdbRoutineId = (ctx && ctx.routineId) || null;
    exdbItemId = (ctx && ctx.itemId) || null;
  }
  if (exdbMode === "replace-ex") exdbExId = ctx || null;
  if (exdbMode === "session-item") exdbEntryId = ctx || null;
  const titles = {
    form: "Base pública de ejercicios",
    library: "Explorar más ejercicios",
    routine: "Agregar ejercicio a la rutina",
    "replace-item": "Reemplazar ejercicio de la rutina",
    "replace-ex": "Reemplazar ejercicio",
    "session-item": "Reemplazar ejercicio",
  };
  const subs = {
    form: "873 ejercicios de Free Exercise DB (dominio público), con fotos. Buscá uno y se completa el formulario; después ajustá lo que quieras y guardá.",
    library:
      "873 ejercicios con fotos. Tocá uno para sumarlo directo a tu biblioteca — podés elegir varios seguidos.",
    routine:
      "Tocá un ejercicio para agregarlo a esta rutina. Si no estaba en tu biblioteca, se suma solo.",
    "replace-item":
      "Elegí un reemplazo para esta fila puntual. Series, reps, RIR y descanso ya cargados no se tocan.",
    "replace-ex":
      "Elegí un reemplazo: se sobrescriben nombre, grupo, pasos y fotos de este ejercicio. Las rutinas que ya lo usan siguen apuntando a él, sin romperse.",
    "session-item":
      "Elegí con qué cubrís este bloque. Se mantienen series, reps, RIR y descanso; se borran los números ya cargados. Después elegís si el cambio es solo por hoy o queda en la rutina.",
  };
  openSheet(`<div class="between"><div class="h2">${titles[exdbMode]}</div><button class="btn sm ghost" data-act="closesheet">Cerrar</button></div>
    <div class="text-tiny text-dim mt-1 mx-0 mb-2.5">${subs[exdbMode]}</div>
    <input type="text" id="exdbQ" placeholder="Buscar en español o inglés: polea, sentadilla, bench…" autofocus>
    <div id="exdbOut" class="stack mt-2.5"><div class="text-tiny text-dim">Escribí al menos 3 letras.</div></div>`);
  const inp = $("#exdbQ");
  let t = null;
  inp.addEventListener("input", () => {
    clearTimeout(t);
    t = setTimeout(() => runExdbSearch(inp.value), DEBOUNCE_MS);
  });
  inp.focus();
}
export async function runExdbSearch(q) {
  const out = $("#exdbOut");
  if (!out) return;
  q = q.trim();
  if (q.length < MIN_CHARS) {
    out.innerHTML = '<div class="text-tiny text-dim">Escribí al menos 3 letras.</div>';
    return;
  }
  out.innerHTML = '<div class="text-tiny text-dim">Buscando…</div>';
  let db;
  try {
    db = await exdbEnsure();
  } catch (e) {
    out.innerHTML =
      '<div class="warn">No se pudo descargar la base (¿sin internet?). Probá de nuevo con wifi.</div>';
    return;
  }
  const full = noAccent(q)
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  const tokens = exdbTokens(q);
  if (!tokens.length) {
    out.innerHTML = '<div class="text-tiny text-dim">Escribí al menos 3 letras.</div>';
    return;
  }
  const hits = db
    .map((e) => ({ e, sc: exdbMatch(e, tokens, full) }))
    .filter((x) => x.sc >= 0)
    .sort((a, b) => b.sc - a.sc || a.e.name.length - b.e.name.length)
    .slice(0, MAX_HITS)
    .map((x) => x.e);
  if (!hits.length) {
    out.innerHTML = `<div class="text-tiny text-dim">Nada con ese término en la base pública. Probá con otra palabra (por músculo o equipo también sirve), o creá el ejercicio a mano con tus propios pasos.</div>
      <button class="btn w-full mt-2.5" data-act="x-new">+ Crear el ejercicio a mano</button>`;
    return;
  }
  out.innerHTML = hits
    .map((e) => {
      const got = alreadyImported(e.id);
      const meta = [(e.muscles || []).join(", "), e.equipment].filter(Boolean).join(" · ") || "—";
      return `<div class="li cursor-pointer" data-act="exdb-pick" data-id="${esc(e.id)}">
    ${e.images[0] ? `<img class="w-13 h-13 object-cover rounded-lg flex-none" src="${esc(e.images[0])}" loading="lazy" onerror="this.style.display='none'">` : ""}
    <div class="flex-1 min-w-0"><div class="h3 truncate">${esc(e.name)}</div><div class="text-tiny text-dim">${esc(meta)}</div></div>
    ${got ? '<span class="chip ok">En tu biblioteca</span>' : ""}
  </div>`;
    })
    .join("");
}
export function quickImport(e) {
  const existing = alreadyImported(e.id);
  if (existing) return existing;
  const created = {
    id: uid(),
    name: e.name,
    group: guessGroup(e.name, e.muscles),
    cues: e.instructions,
    err: "",
    tip: "Importado de Free Exercise DB.",
    images: e.images,
    custom: false,
    sourceId: e.id,
  };
  state.exercises.push(created);
  return created;
}
export async function pickExdb(id) {
  const db = exdbLoaded() || [];
  const e = db.find((x) => x.id === id);
  if (!e) return;

  if (exdbMode === "form") {
    sheetExercise(null, {
      name: e.name,
      group: guessGroup(e.name, e.muscles),
      cues: e.instructions,
      err: "",
      tip: "Importado de Free Exercise DB.",
      images: e.images,
    });
    return;
  }
  if (exdbMode === "library") {
    const before = alreadyImported(e.id);
    const created = quickImport(e);
    save(true);
    toast(before ? "Ya estaba en tu biblioteca" : "Agregado: " + created.name);
    void runExdbSearch($("#exdbQ").value); // refresca la lista para marcar "En tu biblioteca"
    return;
  }
  if (exdbMode === "routine") {
    const created = quickImport(e);
    const r = routineById(exdbRoutineId);
    if (r) {
      r.items.push({
        id: uid(),
        exerciseId: created.id,
        sets: 3,
        repsMin: 8,
        repsMax: 12,
        rir: "1-2",
        rest: 90,
        ss: "",
      });
      save(true);
      toast("Agregado a la rutina: " + created.name);
    }
    closeSheet();
    sheetRoutine(exdbRoutineId);
    return;
  }
  if (exdbMode === "replace-item") {
    const created = quickImport(e);
    const r = routineById(exdbRoutineId);
    const it = r && r.items.find((x) => x.id === exdbItemId);
    if (it) {
      it.exerciseId = created.id;
      save(true);
      toast("Ejercicio reemplazado: " + created.name);
    }
    closeSheet();
    sheetRoutine(exdbRoutineId);
    return;
  }
  if (exdbMode === "session-item") {
    const en = entryOf(exdbEntryId);
    if (!en) return;
    exdbPending = e;
    sheetSwapScope(en, e);
    return;
  }
  if (exdbMode === "replace-ex") {
    const ex = exById(exdbExId);
    if (!ex) return;
    if (
      !confirm(
        `Esto reemplaza el nombre, grupo, pasos y fotos actuales por los de "${e.name}". ¿Seguir?`,
      )
    )
      return;
    ex.name = e.name;
    ex.group = guessGroup(e.name, e.muscles);
    ex.cues = e.instructions;
    ex.err = "";
    ex.tip = "Reemplazado desde Free Exercise DB.";
    ex.images = e.images;
    ex.sourceId = e.id;
    ex.custom = false;
    delete ex.photoNote;
    save(true);
    render();
    toast("Ejercicio reemplazado: " + ex.name);
    sheetExercise(exdbExId);
    return;
  }
}

/* Las entries de la sesión no guardan el id del ítem de la rutina que las originó,
   y durante el entrenamiento se pueden agregar y quitar ejercicios: el índice no
   alcanza para emparejarlas. Se busca por ejercicio y, si la rutina repite el
   mismo ejercicio, se respeta el orden de aparición. */

/**
 * El ejercicio elegido en modo 'session-item' que todavia espera que el
 * usuario diga si el reemplazo es de hoy o para siempre.
 *
 * La eleccion y el alcance son dos pasos y dos hojas distintas, asi que
 * el elegido tiene que sobrevivir entre una y otra.
 */
export function pendingSwap(): ExdbEntry | null {
  return exdbPending;
}

export function clearPendingSwap(): void {
  exdbPending = null;
}
