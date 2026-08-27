/* =========================================================
   acciones.test.ts — Que la tabla de acciones y el markup no se
   separen nunca.

   La app entera se maneja con un solo listener y un `data-act`
   por botón. Si alguien escribe un botón con una acción que no
   está en la tabla, o borra un handler que el markup todavía
   emite, no falla nada: el botón simplemente no hace nada, en
   silencio, hasta que un usuario lo toca.

   Estos dos tests son el reemplazo de lo que antes garantizaba
   tenerlo todo en un archivo: que se viera de un vistazo.
   ========================================================= */
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CHANGE_ACTIONS } from "../src/events/change";
import { mergeActions } from "../src/events/types";

const ROOT = resolve(__dirname, "..");

/** Todos los .ts de src/, más el index.html, que también trae botones. */
function fuentes(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const f of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, f.name);
      if (f.isDirectory()) walk(p);
      else if (f.name.endsWith(".ts")) out.push(p);
    }
  };
  walk(join(ROOT, "src"));
  out.push(join(ROOT, "index.html"));
  return out;
}

/**
 * Las acciones que el markup realmente emite.
 *
 * Busca `data-act="algo"` literal. Las que se arman con un ternario dentro
 * del atributo — `data-act="${reg ? 'auth-signup' : 'auth-signin'}"` — no se
 * pueden leer así, y por eso están listadas aparte abajo.
 */
function accionesEmitidas(): Set<string> {
  const out = new Set<string>();
  for (const f of fuentes()) {
    const c = readFileSync(f, "utf8");
    for (const m of c.matchAll(/data-act="([a-z][a-z0-9-]*)"/g)) out.add(m[1]);
  }
  return out;
}

/** Las que el markup arma dinámicamente y el escaneo no puede ver. */
const EMITIDAS_DINAMICAMENTE = ["auth-signin", "auth-signup"];

/** Todas las acciones que la app atiende: las de click mas las de change. */
async function tablaDeAcciones(): Promise<Set<string>> {
  const [
    { shellActions },
    { sheetActions },
    { timerActions },
    { sessionActions },
    { swapActions },
    { routineActions },
    { exerciseActions },
    { exdbActions },
    { progressActions },
    { settingsActions },
    { accountActions },
    { pinActions },
    { backupActions },
    { lightboxActions },
    { tourActions },
  ] = await Promise.all([
    import("../src/ui/shell"),
    import("../src/ui/sheet"),
    import("../src/features/timer"),
    import("../src/features/sesion"),
    import("../src/features/swap"),
    import("../src/features/rutinas"),
    import("../src/features/ejercicios"),
    import("../src/features/exdb"),
    import("../src/features/progreso"),
    import("../src/features/ajustes"),
    import("../src/features/cuenta"),
    import("../src/features/pin"),
    import("../src/features/backup"),
    import("../src/features/lightbox"),
    import("../src/features/tour"),
  ]);
  return new Set([
    ...Object.keys(CHANGE_ACTIONS),
    ...Object.keys(
      mergeActions(
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
      ),
    ),
  ]);
}

describe("la tabla de acciones contra el markup", () => {
  it("atiende cada data-act que la app emite", async () => {
    const tabla = await tablaDeAcciones();
    const emitidas = [...accionesEmitidas(), ...EMITIDAS_DINAMICAMENTE];
    const huerfanas = emitidas.filter((a) => !tabla.has(a)).sort();
    expect(
      huerfanas,
      `Estos botones existen en el markup y NO tienen handler.\n` +
        `Tocarlos no hace nada y no avisa:\n  ${huerfanas.join("\n  ")}`,
    ).toEqual([]);
  });

  it("no declara handlers para acciones que ya nadie emite", async () => {
    const tabla = await tablaDeAcciones();
    const emitidas = new Set([...accionesEmitidas(), ...EMITIDAS_DINAMICAMENTE]);
    const muertas = [...tabla].filter((a) => !emitidas.has(a)).sort();
    expect(
      muertas,
      `Estos handlers no los llama nadie. O falta el botón, o son código muerto:\n  ${muertas.join("\n  ")}`,
    ).toEqual([]);
  });
});

describe("mergeActions", () => {
  it("junta las tablas de todos los dominios", () => {
    const m = mergeActions({ a: () => {} }, { b: () => {} });
    expect(Object.keys(m).sort()).toEqual(["a", "b"]);
  });

  it("explota si dos dominios declaran la misma acción", () => {
    // Con un spread pelado el segundo le ganaría al primero en silencio, y el
    // síntoma sería un botón que hace algo distinto de lo que dice su archivo.
    expect(() => mergeActions({ dup: () => {} }, { dup: () => {} })).toThrow(/dup/);
  });
});
