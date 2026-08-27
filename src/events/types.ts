/* =========================================================
   events/types.ts — El contrato de un handler de accion.

   Toda la app se maneja con un solo listener global: cada boton
   lleva un `data-act` y el despachador busca quien lo atiende.
   Antes ese despachador era una cadena de casi ochenta `if`
   dentro de app.ts, que tenia que conocer los detalles de cada
   feature. Ahora cada dominio declara sus acciones y app.ts no
   conoce ninguna.
   ========================================================= */

/** Lo que recibe un handler cuando se dispara su accion. */
export interface ActionContext {
  /**
   * El elemento con `data-act` que se toco. Sus `dataset.*` son los
   * argumentos de la accion: `data-id`, `data-e`, `data-i`, `data-v`.
   * Sin tipar a proposito, igual que `$` en lib/dom.
   */
  el: any;
  /**
   * La fila de series que contiene al elemento, o null. Solo la mira
   * `check`, que es la unica accion que vive dentro de una fila.
   */
  row: any;
  /**
   * El nombre de la accion. Lo miran unicamente los dos handlers que
   * atienden dos acciones parecidas con un solo cuerpo:
   * `swap-today`/`swap-forever` y `auth-signin`/`auth-signup`.
   */
  act: string;
}

export type ActionHandler = (ctx: ActionContext) => void;

/** Las acciones que declara un dominio, indexadas por su `data-act`. */
export type ActionMap = Record<string, ActionHandler>;

/**
 * Junta las tablas de todos los dominios en una sola.
 *
 * Explota si dos dominios declaran la misma accion. Con un spread
 * pelado el segundo le ganaria al primero en silencio, y el sintoma
 * seria un boton que hace algo distinto de lo que dice su archivo:
 * exactamente la clase de bug que esta tabla vino a hacer imposible.
 */
export function mergeActions(...maps: ActionMap[]): ActionMap {
  const out: ActionMap = {};
  for (const map of maps) {
    for (const key of Object.keys(map)) {
      if (key in out) throw new Error(`Accion duplicada en la tabla de eventos: "${key}"`);
      out[key] = map[key];
    }
  }
  return out;
}
