/* =========================================================
   exdb-search.test.ts — Buscar en español contra una base
   escrita en inglés.

   Es la parte del proyecto con más reglas escondidas: plurales,
   frases de dos palabras, sinónimos, y un puntaje que decide qué
   sale primero. Todo puro, así que se prueba sin tocar nada.
   ========================================================= */
import { describe, expect, it } from "vitest";
import {
  exdbMatch,
  exdbTerms,
  exdbTokens,
  guessGroup,
  noAccent,
  type ExdbEntry,
} from "../src/features/exdb/search";

const ej = (over: Partial<ExdbEntry>): ExdbEntry => ({
  id: "x",
  name: "Barbell Squat",
  muscles: ["quadriceps"],
  equipment: "barbell",
  instructions: [],
  images: [],
  ...over,
});

describe("noAccent", () => {
  it("saca los acentos, porque nadie los escribe al buscar apurado", () => {
    expect(noAccent("Bíceps")).toBe("biceps");
    expect(noAccent("SENTADILLA")).toBe("sentadilla");
    expect(noAccent("Cuádriceps")).toBe("cuadriceps");
  });
});

describe("exdbTokens", () => {
  it("parte la consulta y tira las palabras que no aportan", () => {
    expect(exdbTokens("press de banca")).toEqual(["press", "banca"]);
  });

  it("traduce las frases de varias palabras antes que nada", () => {
    // "peso muerto" tiene que volverse "deadlift" ENTERO: token por token,
    // "peso" y "muerto" por separado no encuentran nada.
    expect(exdbTokens("peso muerto")).toEqual(["deadlift"]);
    expect(exdbTokens("pesa rusa")).toEqual(["kettlebells"]);
  });

  it("no se rompe con signos ni con espacios de más", () => {
    expect(exdbTokens("  press,  inclinado!! ")).toEqual(["press", "inclinado"]);
  });

  it("devuelve vacío si el usuario solo escribió palabras de relleno", () => {
    expect(exdbTokens("de la con el")).toEqual([]);
  });
});

describe("exdbTerms", () => {
  it("prueba también el singular, porque la base está en singular", () => {
    expect(exdbTerms("mancuernas")).toContain("dumbbell");
  });

  it("no le corta la s a una palabra corta y la arruina", () => {
    // 3 letras o menos se dejan como están: "abs" no debe volverse "ab".
    expect(exdbTerms("abs")).toEqual(["abs"]);
  });

  it("suma todas las traducciones posibles de un término", () => {
    const t = exdbTerms("polea");
    expect(t).toContain("polea");
    expect(t.length).toBeGreaterThan(1);
  });
});

describe("exdbMatch", () => {
  const tk = (q: string) => exdbTokens(q);

  it("descarta el ejercicio al que le falta aunque sea un término", () => {
    // Todos los tokens tienen que pegar. Si uno no pega, no es un resultado
    // peor: no es un resultado.
    expect(exdbMatch(ej({ name: "Barbell Squat" }), tk("squat"), "squat")).toBeGreaterThanOrEqual(
      0,
    );
    expect(exdbMatch(ej({ name: "Barbell Squat" }), tk("squat curl"), "squatcurl")).toBe(-1);
  });

  it("puntúa más alto al que lo tiene en el nombre que al que lo tiene en el músculo", () => {
    const enNombre = exdbMatch(
      ej({ name: "Cable Crossover", muscles: [], equipment: "" }),
      tk("cable"),
      "cable",
    );
    const enEquipo = exdbMatch(
      ej({ name: "Chest Fly", muscles: [], equipment: "cable" }),
      tk("cable"),
      "cable",
    );
    expect(enNombre).toBeGreaterThan(enEquipo);
  });

  it("puntúa más alto una traducción de dos palabras que una suelta", () => {
    // "leg press" es mucho más específico que "leg", y por eso vale más.
    const dos = exdbMatch(
      ej({ name: "Leg Press", muscles: [], equipment: "" }),
      tk("prensa"),
      "prensa",
    );
    const una = exdbMatch(
      ej({ name: "Leg Extension", muscles: [], equipment: "" }),
      tk("pierna"),
      "pierna",
    );
    expect(dos).toBeGreaterThan(una);
  });

  it("premia al que contiene la consulta entera, y más todavía al que empieza con ella", () => {
    const empieza = exdbMatch(ej({ name: "Squat Jump" }), tk("squat"), "squat");
    const contiene = exdbMatch(ej({ name: "Barbell Squat" }), tk("squat"), "squat");
    expect(empieza).toBeGreaterThan(contiene);
  });

  it("encuentra por músculo y por equipo, no solo por nombre", () => {
    const e = ej({ name: "Zercher Something", muscles: ["hamstrings"], equipment: "kettlebells" });
    expect(exdbMatch(e, tk("isquios"), "isquios")).toBeGreaterThanOrEqual(0);
    expect(exdbMatch(e, tk("pesa rusa"), "pesarusa")).toBeGreaterThanOrEqual(0);
  });

  it("aguanta un ejercicio sin músculos ni equipo", () => {
    const pelado = {
      id: "y",
      name: "Plank",
      muscles: [],
      equipment: "",
      instructions: [],
      images: [],
    };
    expect(() => exdbMatch(pelado, tk("plank"), "plank")).not.toThrow();
  });
});

describe("guessGroup", () => {
  it("mapea el músculo primario de la base al grupo del plan", () => {
    expect(guessGroup("Barbell Squat", ["quadriceps"])).toBe("Cuádriceps");
    expect(guessGroup("Seated Cable Rows", ["middle back"])).toBe("Espalda");
    expect(guessGroup("Cable Crunch", ["abdominals"])).toBe("Core");
  });

  it("separa el deltoides lateral del resto del hombro mirando el nombre", () => {
    // La base junta todo el hombro en "shoulders", pero el plan cuenta las
    // laterales aparte: tienen su propio rango semanal.
    expect(guessGroup("Cable Lateral Raise", ["shoulders"])).toBe("Deltoides lateral");
    expect(guessGroup("Seated Dumbbell Press", ["shoulders"])).toBe("Deltoides ant/post");
  });

  it("cae en Pecho cuando no reconoce el músculo, en vez de dejarlo sin grupo", () => {
    // Un ejercicio sin grupo no aparecería en ninguna parte de la biblioteca.
    expect(guessGroup("Cosa Rara", ["tail"])).toBe("Pecho");
    expect(guessGroup("Cosa Rara", [])).toBe("Pecho");
  });
});
