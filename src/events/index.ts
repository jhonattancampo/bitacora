/* =========================================================
   events/index.ts — Los tres listeners globales de la app.

   No hay un handler por boton: hay uno por documento, y la
   tabla dice quien atiende cada `data-act`. Eso es lo que hace
   que repintar toda la pantalla con un `innerHTML` no cueste
   nada — no hay listeners que volver a colgar.

   Este archivo no sabe que hace ninguna accion. Solo junta las
   tablas que declara cada dominio y busca en ellas.
   ========================================================= */
import { $ } from "../lib/dom";
import { backupActions, importJSON } from "../features/backup";
import { accountActions } from "../features/cuenta";
import { exdbActions } from "../features/exdb";
import { exerciseActions } from "../features/ejercicios";
import { lightboxActions } from "../features/lightbox";
import { pinActions } from "../features/pin";
import { progressActions } from "../features/progreso";
import { routineActions } from "../features/rutinas";
import { readSetRow, sessionActions, updateStats } from "../features/sesion";
import { settingsActions } from "../features/ajustes";
import { swapActions } from "../features/swap";
import { timerActions } from "../features/timer";
import { tourActions } from "../features/tour";
import { save, state } from "../state/store";
import { sheetActions } from "../ui/sheet";
import { render, shellActions } from "../ui/shell";
import { CHANGE_ACTIONS } from "./change";
import { mergeActions } from "./types";

/** Cada dominio declara lo suyo; `mergeActions` explota si dos pisan la misma. */
const CLICK_ACTIONS = mergeActions(
  shellActions,
  sheetActions,
  timerActions,
  sessionActions,
  swapActions,
  routineActions,
  exerciseActions,
  exdbActions,
  progressActions,
  settingsActions,
  accountActions,
  pinActions,
  backupActions,
  lightboxActions,
  tourActions,
);

document.addEventListener("click", (ev: any) => {
  const row = ev.target.closest(".setrow");
  const el = ev.target.closest("[data-act]");
  if (!el) return;
  const act = el.dataset.act;
  const handler = CLICK_ACTIONS[act];
  if (handler) handler({ el, row, act });
});

document.addEventListener("change", (ev: any) => {
  const el = ev.target;
  const act = el.dataset.act;
  const handler = act ? CHANGE_ACTIONS[act] : undefined;
  if (handler) {
    handler({ el, row: null, act });
    return;
  }
  /* Los inputs de una serie no llevan `data-act`: son tres por fila y lo que
     importa es la fila entera, no cual de los tres se toco. */
  const row = el.closest(".setrow");
  if (row && el.tagName === "INPUT") {
    readSetRow(row);
    save();
    updateStats();
  }
  if (el.id === "fileIn" && el.files && el.files[0]) {
    importJSON(el.files[0]);
    el.value = "";
  }
});

/* El buscador de la biblioteca filtra mientras se escribe, asi que repinta en
   cada tecla y despues devuelve el foco y el cursor a donde estaban. */
document.addEventListener("input", (ev: any) => {
  const el = ev.target;
  if (el.dataset.act !== "exq") return;
  state.ui.exq = el.value;
  const pos = el.selectionStart;
  render();
  const n = $("[data-act=exq]");
  if (n) {
    n.focus();
    n.setSelectionRange(pos, pos);
  }
});
