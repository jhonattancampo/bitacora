/* =========================================================
   nutricion-catalogo.test.ts — El catalogo es dato, pero dato
   que alguien edita a mano: un id repetido, un perUnit sin
   gramos o un nombre parecido a otro rompen el log en
   silencio. Estos tests son la red de seguridad de esa edicion.
   ========================================================= */

import { describe, expect, it } from "vitest";
import { FOODS } from "../src/nutrition/data/foods";
import { bestFood } from "../src/nutrition/domain/search";

/** Tolerancia de kcal contra 4/4/9: el mayor entre 10 kcal y el 10% del calculo. */
const kcalTolerance = (expected: number): number => Math.max(10, expected * 0.1);

describe("la integridad del catalogo", () => {
  it("no repite ningun id", () => {
    const ids = FOODS.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("usa ids en kebab-case", () => {
    for (const f of FOODS) expect(f.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it("le pone gramos a todo lo que se cuenta por unidad", () => {
    const porUnidad = FOODS.filter((f) => f.basis === "perUnit");
    expect(porUnidad.length).toBeGreaterThan(0);
    for (const f of porUnidad) expect(f.unitGrams, f.id).toBeGreaterThan(0);
  });

  it("no tiene macros negativos ni que no sean numeros", () => {
    for (const f of FOODS) {
      for (const [key, value] of Object.entries(f.macros)) {
        expect(Number.isFinite(value), `${f.id}.${key}`).toBe(true);
        expect(value, `${f.id}.${key}`).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("tiene kcal coherentes con los macros (4/4/9, tolerancia: max(10 kcal, 10%))", () => {
    for (const f of FOODS) {
      const { kcal, protein, carbs, fat } = f.macros;
      const expected = protein * 4 + carbs * 4 + fat * 9;
      expect(Math.abs(kcal - expected), `${f.id}: ${kcal} vs ${expected}`).toBeLessThanOrEqual(
        kcalTolerance(expected),
      );
    }
  });
});

describe("encontrar lo que la gente escribe", () => {
  const id = (query: string): string | undefined => bestFood(FOODS, query)?.id;

  it("resuelve nombres completos", () => {
    expect(id("pechuga de pollo")).toBe("pechuga-pollo-cocida");
    expect(id("arroz integral")).toBe("arroz-integral-cocido");
    expect(id("huevo")).toBe("huevo");
  });

  it("resuelve nombres cortos de tres y cuatro letras", () => {
    expect(id("pan")).toBe("pan-lactal");
    expect(id("papa")).toBe("papa-hervida");
  });

  it("resuelve por alias y por plural", () => {
    expect(id("suprema")).toBe("pechuga-pollo-cocida");
    expect(id("huevos")).toBe("huevo");
  });
});

describe("nombres parecidos que no se pisan", () => {
  const id = (query: string): string | undefined => bestFood(FOODS, query)?.id;

  it("distingue pollo de pavo cuando los dos son pechuga", () => {
    expect(id("pechuga de pollo")).toBe("pechuga-pollo-cocida");
    expect(id("pechuga de pavo")).toBe("pechuga-pavo-cocida");
  });

  it("distingue dulce de leche de la leche", () => {
    expect(id("dulce de leche")).toBe("dulce-de-leche");
    expect(id("leche descremada")).toBe("leche-descremada");
  });

  it("distingue papas fritas de la papa hervida", () => {
    expect(id("papas fritas")).toBe("papas-fritas-paquete");
    expect(id("papa")).toBe("papa-hervida");
  });

  it("distingue el jugo de naranja de la fruta", () => {
    expect(id("jugo de naranja")).toBe("jugo-naranja");
    expect(id("naranja")).toBe("naranja");
  });

  it("distingue la clara del huevo entero", () => {
    expect(id("clara de huevo")).toBe("clara-huevo");
  });

  it("distingue pan integral de arroz integral", () => {
    expect(id("pan integral")).toBe("pan-integral-lactal");
    expect(id("arroz integral")).toBe("arroz-integral-cocido");
  });
});
