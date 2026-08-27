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
import type { RoutineItem } from "../types";
import { save, state } from "../state/store";
import { closeSheet } from "../ui/sheet";
import { render } from "../ui/shell";
import { toast } from "../ui/toast";
import { sheetRoutine } from "../views/rutinas";
import { sheetExDbSearch } from "./exdb";
import type { ActionMap } from "../events/types";

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
export function stashRoutine(items: RoutineItem[]) {
  const f = $("#rform"),
    id = f.dataset.id;
  const name = $("[data-k=name]", f).value,
    subtitle = $("[data-k=subtitle]", f).value;
  if (id) {
    const r = routineById(id)!;
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

/**
 * Escribe el formulario abierto en el estado y devuelve el id de la rutina,
 * creandola si todavia no existia.
 *
 * Recibe los items ya recolectados a proposito: `collectItems()` reparte un
 * `uid()` nuevo en CADA llamada, asi que llamarla dos veces en la misma accion
 * deja un id apuntando a una fila que ya no existe.
 */
function persistOpenForm(items: RoutineItem[]): string {
  const f = $("#rform");
  const name = $("[data-k=name]", f).value.trim() || "Sesión sin nombre";
  const subtitle = $("[data-k=subtitle]", f).value.trim();
  let rid = f.dataset.id;
  if (rid) {
    /* El id sale del `data-id` del formulario abierto, que solo se escribe
       con una rutina que existe. */
    const r = routineById(rid)!;
    r.name = name;
    r.subtitle = subtitle;
    r.items = items;
  } else {
    rid = uid();
    state.routines.push({ id: rid, name, subtitle, items });
  }
  save(true);
  return rid;
}

export const routineActions: ActionMap = {
  "r-new": () => sheetRoutine(null),
  "r-edit": ({ el }) => sheetRoutine(el.dataset.id),

  "r-dup": ({ el }) => {
    const r = routineById(el.dataset.id)!;
    state.routines.push({
      id: uid(),
      name: r.name + " (copia)",
      subtitle: r.subtitle,
      items: r.items.map((i) => Object.assign({}, i, { id: uid() })),
    });
    save(true);
    render();
    toast("Rutina duplicada");
  },

  "r-del": ({ el }) => {
    if (!confirm("¿Borrar esta rutina? El historial no se toca.")) return;
    state.routines = state.routines.filter((x) => x.id !== el.dataset.id);
    save(true);
    render();
  },

  "ri-add": () => {
    const items = collectItems();
    items.push({
      id: uid(),
      exerciseId: state.exercises[0].id,
      sets: 3,
      repsMin: 8,
      repsMax: 12,
      rir: "1-2",
      rest: 90,
      ss: "",
    });
    stashRoutine(items);
  },

  /* Asimetria heredada, y se respeta tal cual: esta accion guarda el
     formulario SOLO si la rutina todavia no existia. Editando una rutina ya
     guardada, lo escrito y sin guardar se pierde al abrir el buscador.
     "ri-replace", aca al lado, si guarda siempre. Cambiarlo seria arreglar un
     bug, y este PR no cambia comportamiento. */
  "ri-add-db": () => {
    const f = $("#rform");
    const rid = f.dataset.id || persistOpenForm(collectItems());
    sheetExDbSearch("routine", rid);
  },

  "ri-replace": ({ el }) => {
    const items = collectItems();
    const itemId = items[+el.dataset.i] && items[+el.dataset.i].id;
    if (!itemId) return;
    // los MISMOS items que se guardan: si se recolectaran de nuevo, itemId
    // apuntaria a una fila con otro id
    sheetExDbSearch("replace-item", { routineId: persistOpenForm(items), itemId });
  },

  "ri-del": ({ el }) => {
    const items = collectItems();
    items.splice(+el.dataset.i, 1);
    stashRoutine(items);
  },

  "ri-up": ({ el }) => {
    const i = +el.dataset.i;
    const items = collectItems();
    if (i > 0) [items[i - 1], items[i]] = [items[i], items[i - 1]];
    stashRoutine(items);
  },

  "ri-down": ({ el }) => {
    const i = +el.dataset.i;
    const items = collectItems();
    if (i < items.length - 1) [items[i + 1], items[i]] = [items[i], items[i + 1]];
    stashRoutine(items);
  },

  "r-save": () => {
    persistOpenForm(collectItems());
    closeSheet();
    render();
    toast("Rutina guardada");
  },
};
