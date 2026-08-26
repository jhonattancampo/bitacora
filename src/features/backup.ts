/* =========================================================
   features/backup.ts — Sacar los datos de este dispositivo y
   volver a meterlos.

   Los datos viven en el navegador. Si el usuario borra los
   datos del sitio, se van. El .json es la copia completa y
   restaurable; el .csv es para mirar el historial en una
   planilla, y no se puede reimportar.
   ========================================================= */
import { dl } from "../lib/dom";
import { today } from "../lib/format";
import { doneSessions, exById } from "../state/selectors";
import { DEFAULT_SETTINGS, save, setState, state } from "../state/store";
import { render } from "../ui/shell";
import { toast } from "../ui/toast";
import type { AppState } from "../types";

export function exportJSON() {
  const blob = new Blob([JSON.stringify(state, null, 1)], { type: "application/json" });
  dl(blob, "bitacora-" + today() + ".json");
  toast("Archivo descargado");
}
export function exportCSV() {
  const lines = ["fecha;sesion;ejercicio;grupo;serie;kg;reps;rir"];
  doneSessions()
    .slice()
    .reverse()
    .forEach((s) =>
      s.entries.forEach((en) => {
        const ex = exById(en.exerciseId);
        en.sets.forEach((x, i) => {
          if (x.done)
            lines.push(
              [s.date, s.name, ex ? ex.name : "?", ex ? ex.group : "", i + 1, x.w, x.r, x.rir].join(
                ";",
              ),
            );
        });
      }),
    );
  dl(new Blob([lines.join("\n")], { type: "text/csv" }), "bitacora-" + today() + ".csv");
  toast("CSV descargado");
}

/**
 * Lee un .json exportado y lo adopta como estado.
 *
 * Completa ajustes y `ui` y nada mas, igual que siempre: un archivo
 * viejo NO pasa por la migracion completa. Cambiar eso reescribiria
 * fotos de ejercicios importados, y no es lo que el usuario pidio al
 * tocar "Importar".
 */
export function importJSON(file: File): void {
  const fr = new FileReader();
  fr.onload = () => {
    try {
      const o = JSON.parse(fr.result as string) as AppState;
      if (!o.exercises || !o.routines) throw 0;
      if (!confirm("Reemplaza los datos actuales por los del archivo. ¿Seguir?")) return;
      setState(o);
      state.settings = Object.assign({ ...DEFAULT_SETTINGS }, state.settings || {});
      state.ui = state.ui || {};
      save(true);
      render();
      toast("Datos importados");
    } catch (e) {
      toast("El archivo no es una copia válida");
    }
  };
  fr.readAsText(file);
}
