/* =========================================================
   nutricion-busqueda.test.ts — El catalogo local es el primer
   paso del pipeline, y el unico que no cuesta plata ni tarda.
   Lo que se cubre aca es por que encuentra lo que tiene que
   encontrar, y sobre todo por que descarta lo que no.
   ========================================================= */

import { describe, expect, it } from "vitest";
import { searchFoods, bestFood, MIN_SCORE } from "../src/nutrition/domain/search";
import { stem } from "../src/nutrition/domain/text";
import { weightOf } from "../src/nutrition/domain/generic-words";
import type { Food } from "../src/nutrition/domain/types";

const food = (name: string, over: Partial<Food> = {}): Food => ({
  id: name,
  name,
  basis: "per100g",
  macros: { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  ...over,
});

const CATALOGO: Food[] = [
  food("Pechuga de pollo cocida"),
  food("Bife de lomo cocido"),
  food("Arroz integral cocido"),
  food("Aceite de oliva"),
  food("Yogur natural descremado"),
];

describe("la comparacion por raiz", () => {
  it("hace que 'cocida' y 'cocido' sean la misma palabra", () => {
    expect(stem("cocida")).toBe(stem("cocido"));
    expect(stem("cocidos")).toBe(stem("cocido"));
  });

  it("junta singular y plural sin juntar palabras distintas", () => {
    expect(stem("aceites")).toBe(stem("aceite"));
    expect(stem("pollos")).toBe(stem("pollo"));
    expect(stem("arroz")).not.toBe(stem("aceite"));
  });

  it("deja en paz a las palabras cortas, que cortadas se confunden entre si", () => {
    expect(stem("pan")).toBe("pan");
    expect(stem("uva")).toBe("uva");
  });
});

describe("el peso de cada palabra", () => {
  it("vale 1 si es generica, aunque sea larga", () => {
    expect(weightOf(stem("cocido"))).toBe(1);
    expect(weightOf(stem("natural"))).toBe(1);
    expect(weightOf(stem("descremado"))).toBe(1);
  });

  it("vale lo que mide si describe al alimento", () => {
    expect(weightOf(stem("pollo"))).toBe(4);
    expect(weightOf(stem("pechuga"))).toBe(6);
  });

  it("no vale nada si es gramatica", () => {
    expect(weightOf(stem("de"))).toBe(0);
    expect(weightOf(stem("con"))).toBe(0);
  });
});

describe("buscar 'pollo cocido'", () => {
  it("encuentra la pechuga", () => {
    expect(bestFood(CATALOGO, "pollo cocido")?.name).toBe("Pechuga de pollo cocida");
  });

  it("NO matchea contra 'bife de lomo cocido', que es el bug que esto previene", () => {
    const nombres = searchFoods(CATALOGO, "pollo cocido").map((m) => m.food.name);
    expect(nombres).not.toContain("Bife de lomo cocido");
  });

  it("descarta al bife porque lo unico en comun pesa 1, y el piso es 4", () => {
    const bife = searchFoods(CATALOGO, "pollo cocido", 0).find(
      (m) => m.food.name === "Bife de lomo cocido",
    );
    expect(bife?.score).toBe(1);
    expect(MIN_SCORE).toBe(4);
  });
});

describe("el puntaje minimo", () => {
  it("deja afuera a cualquier coincidencia que sea solo una palabra generica", () => {
    expect(searchFoods(CATALOGO, "cocido")).toEqual([]);
    expect(searchFoods(CATALOGO, "natural")).toEqual([]);
  });

  it("deja pasar una sola palabra si identifica de verdad", () => {
    expect(bestFood(CATALOGO, "arroz")?.name).toBe("Arroz integral cocido");
  });

  it("ignora la gramatica: 'de' repetido no suma", () => {
    expect(searchFoods(CATALOGO, "de de de")).toEqual([]);
  });
});

describe("el orden de los resultados", () => {
  it("pone primero al de mas puntaje", () => {
    const catalogo = [food("Pollo con arroz"), food("Pechuga de pollo cocida")];
    expect(searchFoods(catalogo, "pechuga pollo")[0].food.name).toBe("Pechuga de pollo cocida");
  });

  it("ante el mismo puntaje prefiere el nombre mas corto, que es el mas generico", () => {
    const catalogo = [food("Pollo a la parrilla con piel y hueso"), food("Pollo")];
    expect(searchFoods(catalogo, "pollo")[0].food.name).toBe("Pollo");
  });
});

describe("los alias", () => {
  it("encuentran un alimento por un nombre que no esta en su nombre", () => {
    const catalogo = [food("Pechuga de pollo cocida", { aliases: ["suprema"] })];
    expect(bestFood(catalogo, "suprema")?.name).toBe("Pechuga de pollo cocida");
  });
});

describe("LIMITACION CONOCIDA del piso de 4", () => {
  it("deja afuera a los alimentos de nombre corto: 'pan' pesa 3 y nunca llega", () => {
    const catalogo = [food("Pan integral", { basis: "perUnit", unitGrams: 30 })];
    // Esto NO es el comportamiento deseable, es el que pide la regla del spec.
    // Queda cubierto con un test para que se vea, no para bendecirlo.
    expect(searchFoods(catalogo, "2 rebanadas de pan")).toEqual([]);
    expect(searchFoods(catalogo, "pan", 3)[0].food.name).toBe("Pan integral");
  });
});
