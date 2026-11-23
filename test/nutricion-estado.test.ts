/* =========================================================
   nutricion-estado.test.ts — La coleccion nueva dentro del
   estado de la app: que aparezca en los estados viejos, que no
   comparta el plan con los valores por defecto, y que el
   adaptador no deje cascaras vacias dando vueltas.
   ========================================================= */

import { beforeEach, describe, expect, it } from "vitest";
import { migrate, defaultNutrition, mergeNutrition } from "../src/state/migrate";
import { seedState, setState, state } from "../src/state/store";
import {
  addItems,
  currentPlan,
  dayLogReader,
  removeItem,
} from "../src/nutrition/adapters/state-store";
import type { AppState } from "../src/types";
import type { LoggedItem } from "../src/nutrition/domain/types";

const viejo = (over: Partial<AppState> = {}): AppState => ({ ...over }) as AppState;

const item = (id: string): LoggedItem => ({
  id,
  name: "Pollo",
  qty: 100,
  unit: "g",
  macros: { kcal: 165, protein: 31, carbs: 0, fat: 3.6 },
  source: "catalog",
});

describe("un estado escrito por una version anterior", () => {
  it("llega con la coleccion de comidas vacia en vez de undefined", () => {
    expect(migrate(viejo()).dayLogs).toEqual([]);
  });

  it("y con un plan completo", () => {
    const s = migrate(viejo());
    expect(s.settings.nutrition.slots).toHaveLength(4);
    expect(s.settings.nutrition.daily.kcal).toBe(2000);
  });

  it("sin pisar el plan que el usuario ya habia editado", () => {
    const s = migrate(
      viejo({
        settings: {
          nutrition: { daily: { kcal: 2500 } },
        },
      } as unknown as Partial<AppState>),
    );
    expect(s.settings.nutrition.daily.kcal).toBe(2500);
    // y lo que no toco sigue viniendo del default
    expect(s.settings.nutrition.daily.protein).toBe(150);
    expect(s.settings.nutrition.slots).toHaveLength(4);
  });
});

describe("el plan por defecto no se comparte entre estados", () => {
  it("editar el de un estado no toca el del siguiente", () => {
    const a = migrate(viejo());
    a.settings.nutrition.daily.kcal = 9999;
    const b = migrate(viejo());
    expect(b.settings.nutrition.daily.kcal).toBe(2000);
  });

  it("ni toca los valores por defecto", () => {
    const a = mergeNutrition();
    a.slots.push({ id: "x", name: "X" });
    expect(defaultNutrition().slots).toHaveLength(4);
  });
});

describe("el reparto por defecto suma exactamente el objetivo del dia", () => {
  it("porque si no, cada objetivo recalculado se corre sin que nadie lo pida", () => {
    const n = defaultNutrition();
    for (const k of ["kcal", "protein", "carbs", "fat"] as const) {
      const suma = n.slots.reduce((a, s) => a + n.perSlot[s.id][k], 0);
      expect(suma).toBeCloseTo(n.daily[k], 6);
    }
  });

  it("y cada slot del plan tiene su reparto", () => {
    const n = defaultNutrition();
    for (const s of n.slots) expect(n.perSlot[s.id]).toBeDefined();
  });
});

describe("el adaptador de estado", () => {
  beforeEach(() => {
    setState(migrate(seedState()));
  });

  it("arma el dia y la comida la primera vez", () => {
    addItems("2026-11-23", "almuerzo", [item("a")]);
    expect(dayLogReader.get("2026-11-23")?.slots[0].items).toHaveLength(1);
  });

  it("no crea nada cuando no hay items que agregar", () => {
    addItems("2026-11-23", "almuerzo", []);
    expect(dayLogReader.get("2026-11-23")).toBeNull();
  });

  it("al borrar el ultimo item no deja la cascara vacia", () => {
    // Un dia con slots vacios contaria como registrado y viajaria por sync.
    addItems("2026-11-23", "almuerzo", [item("a")]);
    removeItem("2026-11-23", "almuerzo", "a");
    expect(dayLogReader.get("2026-11-23")).toBeNull();
    expect(state.dayLogs).toEqual([]);
  });

  it("borrar algo que no existe no rompe nada", () => {
    expect(() => removeItem("2026-11-23", "almuerzo", "fantasma")).not.toThrow();
  });

  it("sobrevive a un estado que llego por sync sin la coleccion", () => {
    // adoptState reemplaza el estado entero con lo que mando el otro
    // dispositivo, y migrate solo corre al arrancar.
    delete (state as Partial<AppState>).dayLogs;
    expect(dayLogReader.get("2026-11-23")).toBeNull();
    expect(() => addItems("2026-11-23", "cena", [item("b")])).not.toThrow();
  });

  it("el plan para el dominio saca el orden de los slots", () => {
    expect(currentPlan().order).toEqual(["desayuno", "almuerzo", "merienda", "cena"]);
  });
});
