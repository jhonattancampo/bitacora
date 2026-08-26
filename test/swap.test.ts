/* =========================================================
   swap.test.ts — Emparejar una entry de la sesión con el ítem
   de la rutina que la originó.

   Hace falta porque las entries NO guardan el id del ítem: solo
   el del ejercicio. Cuando el usuario elige "para siempre", hay
   que adivinar qué fila de la rutina tocar, y ahí aparece el
   caso feo — una rutina que repite el mismo ejercicio dos veces.
   ========================================================= */
import { beforeEach, describe, expect, it } from "vitest";
import { routineItemForEntry } from "../src/features/swap";
import { seedState, setState, state } from "../src/state/store";
import type { Routine, Session, SessionEntry } from "../src/types";

const item = (id: string, exerciseId: string) => ({
  id,
  exerciseId,
  sets: 3,
  repsMin: 8,
  repsMax: 12,
  rir: "1-2",
  rest: 90,
  ss: "",
});

const entry = (id: string, exerciseId: string): SessionEntry => ({
  id,
  exerciseId,
  sets: [{ w: "", r: "", rir: "", done: false }],
});

/** Arma un estado con una rutina y una sesión en curso hecha a medida. */
function escenario(items: ReturnType<typeof item>[], entries: SessionEntry[], routineId = "r1") {
  const s = seedState();
  const r: Routine = { id: "r1", name: "Rutina", subtitle: "", items };
  s.routines = [r];
  const activa: Session = {
    id: "s1",
    routineId,
    name: "Rutina",
    date: "2026-08-26",
    startedAt: 1,
    notes: "",
    entries,
  };
  s.active = activa;
  setState(s);
  return { rutina: r, activa };
}

beforeEach(() => {
  setState(seedState());
});

describe("cuando no hay a quién emparejar", () => {
  it("devuelve null sin sesión en curso", () => {
    expect(routineItemForEntry(entry("e1", "banca"))).toBeNull();
  });

  it("devuelve null en una sesión libre, que no salió de ninguna rutina", () => {
    const { activa } = escenario([item("i1", "banca")], [entry("e1", "banca")], null as never);
    activa.routineId = null;
    expect(routineItemForEntry(activa.entries[0])).toBeNull();
  });

  it("devuelve null si la rutina que la originó ya no existe", () => {
    escenario([item("i1", "banca")], [entry("e1", "banca")]);
    state.routines = [];
    expect(routineItemForEntry(state.active!.entries[0])).toBeNull();
  });

  it("devuelve null si el ejercicio se agregó a mano y no está en la rutina", () => {
    const { activa } = escenario([item("i1", "banca")], [entry("e1", "banca"), entry("e2", "pmr")]);
    expect(routineItemForEntry(activa.entries[1])).toBeNull();
  });
});

describe("el caso simple", () => {
  it("empareja por ejercicio, no por posición", () => {
    // La entry está tercera y el ítem primero: el índice no sirve, el id del
    // ejercicio sí. Pasa siempre que el usuario agrega algo arriba.
    const { activa } = escenario(
      [item("i1", "banca"), item("i2", "pmr")],
      [entry("e0", "extra"), entry("e1", "extra2"), entry("e2", "banca")],
    );
    expect(routineItemForEntry(activa.entries[2])?.id).toBe("i1");
  });
});

describe("el caso feo: la rutina repite el mismo ejercicio", () => {
  /* Acá el id del ejercicio ya no alcanza para desempatar, así que se usa el
     orden de aparición: la primera entry de ese ejercicio va con el primer
     ítem de ese ejercicio, la segunda con el segundo. */
  it("respeta el orden de aparición", () => {
    const { activa } = escenario(
      [item("i1", "lat-polea"), item("i2", "face-pull"), item("i3", "lat-polea")],
      [entry("e1", "lat-polea"), entry("e2", "face-pull"), entry("e3", "lat-polea")],
    );
    expect(routineItemForEntry(activa.entries[0])?.id).toBe("i1");
    expect(routineItemForEntry(activa.entries[2])?.id).toBe("i3");
  });

  it("sigue emparejando bien aunque haya ejercicios agregados en el medio", () => {
    const { activa } = escenario(
      [item("i1", "lat-polea"), item("i3", "lat-polea")],
      [entry("e1", "lat-polea"), entry("eX", "agregado"), entry("e3", "lat-polea")],
    );
    expect(routineItemForEntry(activa.entries[0])?.id).toBe("i1");
    expect(routineItemForEntry(activa.entries[2])?.id).toBe("i3");
  });

  it("cae en el primer ítem cuando hay más entries que ítems", () => {
    // El usuario agregó una tercera serie del mismo ejercicio que la rutina
    // solo tiene dos veces. No hay tercer ítem, así que toca el primero:
    // preferible a no hacer nada y que "para siempre" no haga nada.
    const { activa } = escenario(
      [item("i1", "lat-polea"), item("i3", "lat-polea")],
      [entry("e1", "lat-polea"), entry("e2", "lat-polea"), entry("e3", "lat-polea")],
    );
    expect(routineItemForEntry(activa.entries[2])?.id).toBe("i1");
  });

  it("empareja la primera entry con el primer ítem cuando sobran ítems", () => {
    const { activa } = escenario(
      [item("i1", "lat-polea"), item("i3", "lat-polea")],
      [entry("e1", "lat-polea")],
    );
    expect(routineItemForEntry(activa.entries[0])?.id).toBe("i1");
  });
});
