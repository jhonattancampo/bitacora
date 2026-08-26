/* =========================================================
   features/rutinas.ts — Las acciones del editor de rutinas.

   El editor es un formulario suelto en la hoja: sus filas viven
   en el DOM hasta que alguien las guarda. `collectItems` las lee
   de vuelta, y `stashRoutine` las guarda y vuelve a abrir la
   hoja, que es como el editor sobrevive a agregar, borrar y
   mover filas sin perder lo que habia escrito.
   ========================================================= */
import { clamp } from "../lib/calc";
import { $, $$, uid } from "../lib/dom";
import { routineById } from "../state/selectors";
import { save, state } from "../state/store";
import { sheetRoutine } from "../views/rutinas";

/** Limites de series por fila, para que un dedo pesado no cargue 300. */
const MIN_SETS = 1;
const MAX_SETS = 12;

export function collectItems() {
  return $$("#ritems [data-ri]").map((d) => ({
    id: uid(),
    exerciseId: $("[data-k=exerciseId]", d).value,
    sets: clamp(parseInt($("[data-k=sets]", d).value) || 3, MIN_SETS, MAX_SETS),
    repsMin: parseInt($("[data-k=repsMin]", d).value) || 6,
    repsMax: parseInt($("[data-k=repsMax]", d).value) || 12,
    rir: $("[data-k=rir]", d).value.trim() || "1-2",
    rest: parseInt($("[data-k=rest]", d).value) || 90,
    ss: $("[data-k=ss]", d).value.trim().toUpperCase().slice(0, 1),
  }));
}
export function stashRoutine(items) {
  const f = $("#rform"),
    id = f.dataset.id;
  const name = $("[data-k=name]", f).value,
    subtitle = $("[data-k=subtitle]", f).value;
  if (id) {
    const r = routineById(id);
    r.name = name;
    r.subtitle = subtitle;
    r.items = items;
    save(true);
    sheetRoutine(id);
  } else {
    const nid = uid();
    state.routines.push({ id: nid, name, subtitle, items });
    save(true);
    sheetRoutine(nid);
  }
}
