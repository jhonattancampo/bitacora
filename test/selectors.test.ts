/* =========================================================
   selectors.test.ts — Las preguntas que las vistas le hacen al
   estado.

   El foco está en `exerciseHistory`, porque su ORDEN es un
   contrato del que dependen dos pantallas y hoy una de las dos
   lo lee al revés. Ver el bloque del final.
   ========================================================= */
import { beforeEach, describe, expect, it } from "vitest";
import { exerciseHistory, exById, exName, routineById, entryOf } from "../src/state/selectors";
import { seedState, setState, state } from "../src/state/store";
import type { AppState, Session } from "../src/types";

/** Una sesión terminada con una sola serie hecha del ejercicio dado. */
const sesion = (date: string, w: string, exerciseId = "banca"): Session => ({
  id: "s-" + date,
  routineId: "day-d",
  name: "D · Torso",
  date,
  startedAt: +new Date(date + "T10:00:00"),
  endedAt: +new Date(date + "T11:00:00"),
  notes: "",
  entries: [
    {
      id: "e-" + date,
      exerciseId,
      sets: [{ w, r: "8", rir: "1", done: true }],
    },
  ],
});

const conSesiones = (sessions: Session[]): AppState => {
  const s = seedState();
  s.sessions = sessions;
  setState(s);
  return s;
};

beforeEach(() => {
  setState(seedState());
});

describe("las búsquedas por id", () => {
  it("encuentran lo que existe", () => {
    expect(exById("banca")?.name).toContain("banca");
    expect(routineById("day-a")?.name).toBe("A · Empuje");
  });

  it("devuelven undefined y no revientan con un id que no está", () => {
    expect(exById("no-existe")).toBeUndefined();
    expect(routineById("no-existe")).toBeUndefined();
  });

  it("dan un nombre imprimible para un ejercicio borrado, en vez de dejar la fila en blanco", () => {
    expect(exName("no-existe")).toBe("(ejercicio borrado)");
  });
});

describe("entryOf", () => {
  it("no rompe cuando no hay sesión en curso", () => {
    expect(entryOf("lo-que-sea")).toBeUndefined();
  });

  it("encuentra la entry dentro de la sesión activa", () => {
    const s = seedState();
    s.active = sesion("2026-08-01", "80");
    delete s.active.endedAt;
    setState(s);
    expect(entryOf("e-2026-08-01")?.exerciseId).toBe("banca");
    expect(entryOf("otra")).toBeUndefined();
  });
});

describe("exerciseHistory", () => {
  it("deja afuera la sesión donde el ejercicio estuvo pero no se marcó nada", () => {
    // Estar en la rutina y no hacerlo no es un dato: es un ejercicio salteado.
    const saltado = sesion("2026-08-01", "80");
    saltado.entries[0].sets[0].done = false;
    conSesiones([saltado, sesion("2026-08-08", "85")]);
    expect(exerciseHistory("banca").map((h) => h.date)).toEqual(["2026-08-08"]);
  });

  it("deja afuera la sesión que no terminó", () => {
    const abierta = sesion("2026-08-08", "85");
    delete abierta.endedAt;
    conSesiones([sesion("2026-08-01", "80"), abierta]);
    expect(exerciseHistory("banca").map((h) => h.date)).toEqual(["2026-08-01"]);
  });

  it("se queda con la mejor serie del día y suma el volumen de todas", () => {
    const s = sesion("2026-08-01", "80");
    s.entries[0].sets = [
      { w: "80", r: "8", rir: "1", done: true },
      { w: "100", r: "5", rir: "0", done: true },
      { w: "60", r: "12", rir: "2", done: false },
    ];
    conSesiones([s]);
    const [h] = exerciseHistory("banca");
    expect({ bw: h.bw, br: h.br, sets: h.sets }).toEqual({ bw: 100, br: 5, sets: 2 });
    expect(h.vol).toBe(80 * 8 + 100 * 5); // la no marcada no cuenta
    expect(Math.round(h.e)).toBe(117); // 100 * (1 + 5/30)
  });

  /* ---------------------------------------------------------------
     EL ORDEN, que es donde está el problema.

     `exerciseHistory` recorre `doneSessions()`, que devuelve las
     sesiones de la MÁS NUEVA a la más vieja. Así que el resultado
     también sale de la más nueva a la más vieja.

     Dos pantallas lo consumen y solo una lo tiene en cuenta:

     - `sheetGuide` hace `.slice(0, 5)` para mostrar "últimas
       sesiones". Correcto: quiere las cinco más recientes.

     - `progExercise` (Progreso → Ejercicio) hace
       `const first = h[0], last = h[h.length - 1]`, o sea trata el
       PRIMERO como el más viejo. Está al revés, y de ahí salen tres
       síntomas: el "1RM estimado" muestra el valor más viejo, el
       "Desde el inicio" sale con el signo cambiado, y la curva baja
       cuando el usuario progresó. `progBW`, en la misma pantalla, sí
       hace `.reverse()` antes de graficar — de ahí que el peso
       corporal se vea bien y el 1RM no.

     Verificado en el navegador con 60×8 el 20/07 y 80×8 el 18/08
     (una mejora real del +33%): la app muestra "76 kg" y "−25%", y
     la curva cae. La tabla, que sí revierte, sale bien.

     ESTO NO SE ARREGLA ACÁ. Es un bug preexistente, idéntico
     carácter por carácter al de main, y el refactor no cambia
     comportamiento. Este test fija el orden actual para que el
     arreglo, cuando llegue, sea una decisión y no un accidente.
     --------------------------------------------------------------- */
  it("devuelve las sesiones de la más nueva a la más vieja", () => {
    conSesiones([sesion("2026-07-20", "60"), sesion("2026-08-18", "80")]);
    expect(exerciseHistory("banca").map((h) => h.date)).toEqual(["2026-08-18", "2026-07-20"]);
  });

  it("por ese orden, h[0] es la sesión más reciente y no la primera", () => {
    conSesiones([sesion("2026-07-20", "60"), sesion("2026-08-18", "80")]);
    const h = exerciseHistory("banca");
    expect(Math.round(h[0].e)).toBe(101); // 80 x 8, la más NUEVA
    expect(Math.round(h[h.length - 1].e)).toBe(76); // 60 x 8, la más VIEJA
  });
});

describe("el estado sigue siendo el mismo objeto para todos", () => {
  it("los selectores ven lo que setState dejó", () => {
    conSesiones([sesion("2026-08-01", "80")]);
    expect(state.sessions).toHaveLength(1);
    expect(exerciseHistory("banca")).toHaveLength(1);
  });
});
