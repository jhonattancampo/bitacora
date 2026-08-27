/* =========================================================
   events/change.ts — Las acciones de `change`, aparte de las de
   click.

   Son pocas y no comparten nombre con ninguna de click, pero la
   tabla vive en su propio archivo por la misma razon de siempre:
   asi se puede importar sin colgar los listeners globales, que
   es lo que necesita el test que compara la tabla con el markup.
   ========================================================= */
import { save, state } from "../state/store";
import { render } from "../ui/shell";
import { mergeActions } from "./types";

/** Rest por defecto cuando el campo queda vacio o con basura. */
const DEFAULT_REST_S = 90;

export const CHANGE_ACTIONS = mergeActions({
  pex: ({ el }) => {
    state.ui.progressEx = el.value;
    save();
    render();
  },
  /* El buscador de la biblioteca se atiende en `input`, no en `change`. Esta
     entrada existe para que no siga de largo hasta la lectura de fila. */
  exq: () => {},
  "set-rest": ({ el }) => {
    state.settings.rest = parseInt(el.value) || DEFAULT_REST_S;
    save();
  },
  "s-note": ({ el }) => {
    if (state.active) {
      state.active.notes = el.value;
      save();
    }
  },
});
