/* =========================================================
   features/ejercicios.ts — Las acciones de la biblioteca:
   crear, editar, guardar y borrar un ejercicio.

   Las pantallas estan en views/ejercicios.ts. Aca esta lo que
   cambia el estado cuando el usuario toca sus botones.
   ========================================================= */
import { $, uid } from "../lib/dom";
import { exById } from "../state/selectors";
import { save, state } from "../state/store";
import { closeSheet } from "../ui/sheet";
import { render } from "../ui/shell";
import { toast } from "../ui/toast";
import { sheetExercise, sheetGuide } from "../views/ejercicios";
import type { ActionMap } from "../events/types";

export const exerciseActions: ActionMap = {
  /* La guia de ejecucion se abre desde tres lados: la ficha del ejercicio en
     la sesion, la lista de la biblioteca, y el menu de la entry. */
  guide: ({ el }) => sheetGuide(el.dataset.id),

  "x-new": () => sheetExercise(null),
  "x-edit": ({ el }) => sheetExercise(el.dataset.id),

  "x-save": () => {
    const f = $("#xform"),
      id = f.dataset.id;
    /* Las fotos no estan en ningun input: viajan en un data-images del
       formulario, porque no se editan a mano. */
    let images = [];
    try {
      images = JSON.parse(f.dataset.images || "[]");
    } catch (e) {
      /* si el data-images esta roto, se guarda sin fotos */
    }
    const o = {
      name: $("[data-k=name]", f).value.trim(),
      group: $("[data-k=group]", f).value,
      cues: $("[data-k=cues]", f)
        .value.split("\n")
        .map((x: string) => x.trim())
        .filter(Boolean),
      err: $("[data-k=err]", f).value.trim(),
      tip: $("[data-k=tip]", f).value.trim(),
      images,
    };
    if (!o.name) {
      toast("Ponele un nombre");
      return;
    }
    if (id) Object.assign(exById(id)!, o);
    else state.exercises.push(Object.assign({ id: uid(), custom: true }, o));
    save(true);
    closeSheet();
    render();
    toast("Ejercicio guardado");
  },

  /* Borrar un ejercicio lo saca tambien de todas las rutinas que lo usaban.
     El historial no se toca: las sesiones viejas guardan el id y la vista
     imprime "(ejercicio borrado)". */
  "x-del": ({ el }) => {
    const id = el.dataset.id;
    const used = state.routines
      .filter((r) => r.items.some((i) => i.exerciseId === id))
      .map((r) => r.name);
    if (used.length && !confirm("Está en: " + used.join(", ") + ". ¿Borrar igual?")) return;
    if (!used.length && !confirm("¿Borrar este ejercicio?")) return;
    state.exercises = state.exercises.filter((x) => x.id !== id);
    state.routines.forEach((r) => (r.items = r.items.filter((i) => i.exerciseId !== id)));
    save(true);
    closeSheet();
    render();
  },
};
