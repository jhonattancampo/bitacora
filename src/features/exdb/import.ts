/* =========================================================
   features/exdb/import.ts — Sumar un ejercicio del catalogo
   publico a la biblioteca del usuario.

   Vive aparte de index.ts para que no haya ciclo: la hoja de
   busqueda y el flujo de reemplazo necesitan los dos importar,
   y este archivo no necesita a ninguno de los dos.
   ========================================================= */
import { uid } from "../../lib/dom";
import { state } from "../../state/store";
import { guessGroup } from "./search";
import type { ExdbEntry } from "./search";
import type { Exercise } from "../../types";

/**
 * El ejercicio de la biblioteca que ya vino de esta entrada del catalogo,
 * si es que alguna vez se importo. `sourceId` es lo que los emparenta.
 */
export function alreadyImported(sourceId: string): Exercise | undefined {
  return state.exercises.find((x) => x.sourceId === sourceId);
}

/**
 * Devuelve el ejercicio de la biblioteca correspondiente a esta entrada,
 * creandolo si no estaba. Nunca duplica: importar dos veces el mismo
 * ejercicio devuelve el que ya estaba, con las ediciones del usuario intactas.
 *
 * NO guarda. Quien llama decide cuando escribir, porque casi siempre tiene
 * mas cosas que cambiar en la misma tanda.
 */
export function quickImport(e: ExdbEntry): Exercise {
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
