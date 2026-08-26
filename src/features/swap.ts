/* =========================================================
   features/swap.ts — Cambiar un ejercicio en medio de la
   sesion, y decidir si el cambio es de hoy o para siempre.
   ========================================================= */
import { esc } from "../lib/dom";
import { routineById } from "../state/selectors";
import { state } from "../state/store";
import { openSheet } from "../ui/sheet";

/* Las entries de la sesión no guardan el id del ítem de la rutina que las originó,
   y durante el entrenamiento se pueden agregar y quitar ejercicios: el índice no
   alcanza para emparejarlas. Se busca por ejercicio y, si la rutina repite el
   mismo ejercicio, se respeta el orden de aparición. */
export function routineItemForEntry(en) {
  const a = state.active;
  if (!a || !a.routineId) return null;
  const r = routineById(a.routineId);
  if (!r) return null;
  const hits = r.items.filter((it) => it.exerciseId === en.exerciseId);
  if (!hits.length) return null;
  const nth = a.entries.filter((x) => x.exerciseId === en.exerciseId).indexOf(en);
  return hits[nth] || hits[0];
}

/* Cambiar el ejercicio de hoy y cambiar la rutina son dos intenciones distintas.
   El alcance se decide acá, con el reemplazo ya elegido, y no antes. */
export function sheetSwapScope(en, e) {
  const done = en.sets.filter((x) => x.done).length;
  const it = routineItemForEntry(en);
  const rt = it ? routineById(state.active.routineId) : null;
  openSheet(`<div class="h2">Reemplazar por ${esc(e.name)}</div>
    <div class="text-tiny text-dim mt-1 mx-0 mb-2.5">Se mantienen series, reps, RIR y descanso.</div>
    ${done ? `<div class="note">Ya marcaste ${done}${done > 1 ? " series hechas" : " serie hecha"} en este ejercicio: al reemplazarlo se borran esos números. El objetivo se mantiene.</div>` : ""}
    <button class="btn w-full primary mt-2.5" data-act="swap-today" data-e="${esc(en.id)}">Solo por hoy</button>
    ${
      rt
        ? `<button class="btn w-full mt-2" data-act="swap-forever" data-e="${esc(en.id)}">Para siempre (actualizar la rutina)</button>
      <div class="text-tiny text-dim mt-1.5">"Para siempre" además deja el cambio hecho en <b>${esc(rt.name)}</b> para las próximas veces.</div>`
        : `<div class="text-tiny text-dim mt-2">Esta es una sesión libre: no hay rutina que actualizar.</div>`
    }`);
}
