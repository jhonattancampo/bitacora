/* =========================================================
   ui/shell.ts — Which screen is showing, and redrawing it.

   The whole app is one `innerHTML` write: a view is a function
   that returns markup, and every click is caught by the global
   dispatcher. Redrawing costs nothing because there is no state
   in the DOM to lose — except the sheet, which is a separate
   element and survives a render untouched.
   ========================================================= */
import { $, $$ } from "../lib/dom";
import { applyTheme } from "./theme";
import { viewExercises } from "../views/ejercicios";
import { viewProgress } from "../views/progreso";
import { viewRoutines } from "../views/rutinas";
import { viewSettings } from "../views/ajustes";
import { viewTrain } from "../views/entrenar";
import type { ViewName } from "../types";
import type { ActionMap } from "../events/types";
import { closeSheet } from "./sheet";

const VIEWS: Record<ViewName, () => string> = {
  train: viewTrain,
  routines: viewRoutines,
  exercises: viewExercises,
  progress: viewProgress,
  settings: viewSettings,
};

/**
 * The screen currently showing. Exported as a live binding, so
 * importers always read the current one; writes go through `setView`.
 *
 * Always starts on Entrenar: with a session in progress that screen
 * *is* the session, and without one it is where you pick today's.
 */
export let view: ViewName = "train";

export function setView(v: ViewName): void {
  view = v;
}

/** Redraws the current screen and returns the page to the top. */
export function render(): void {
  applyTheme();
  $$(".nb").forEach((b) => b.classList.toggle("on", b.dataset.v === view));
  const el = $("#app");
  el.innerHTML = (VIEWS[view] || viewTrain)();
  window.scrollTo({ top: 0 });
}

export const shellActions: ActionMap = {
  /* La hoja se cierra al navegar: quedaria flotando sobre una pantalla que
     ya no es la suya. */
  nav: ({ el }) => {
    setView(el.dataset.v);
    closeSheet();
    render();
  },
};
