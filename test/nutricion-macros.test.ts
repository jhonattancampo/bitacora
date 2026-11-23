/* =========================================================
   nutricion-macros.test.ts — Escalar el catalogo a lo que se
   comio de verdad, y devolver null en vez de inventar cuando
   la conversion no se puede hacer.
   ========================================================= */

import { describe, expect, it } from "vitest";
import { macrosFor, sumMacros, subtractToFloor, zeroMacros } from "../src/nutrition/domain/macros";
import type { Food, Macros } from "../src/nutrition/domain/types";

const m = (kcal: number, protein: number, carbs: number, fat: number): Macros => ({
  kcal,
  protein,
  carbs,
  fat,
});

const POLLO: Food = {
  id: "pollo",
  name: "Pechuga de pollo cocida",
  basis: "per100g",
  macros: m(165, 31, 0, 3.6),
};

const LECHE: Food = {
  id: "leche",
  name: "Leche descremada",
  basis: "per100ml",
  macros: m(35, 3.4, 4.8, 0.1),
};

const HUEVO: Food = {
  id: "huevo",
  name: "Huevo",
  basis: "perUnit",
  macros: m(78, 6.3, 0.6, 5.3),
  unitGrams: 50,
};

const PAN: Food = { id: "pan", name: "Pan", basis: "perUnit", macros: m(80, 3, 15, 1) };

describe("escalar por peso", () => {
  it("150 g de pollo son una vez y media los valores de 100 g", () => {
    expect(macrosFor(POLLO, { qty: 150, unit: "g" })).toEqual(m(248, 46.5, 0, 5.4));
  });

  it("redondea las kcal a entero y los gramos a un decimal", () => {
    const r = macrosFor(POLLO, { qty: 37, unit: "g" });
    expect(Number.isInteger(r?.kcal)).toBe(true);
    expect(r?.protein).toBe(11.5);
  });
});

describe("escalar por volumen", () => {
  it("200 ml de leche son el doble de 100 ml", () => {
    expect(macrosFor(LECHE, { qty: 200, unit: "ml" })).toEqual(m(70, 6.8, 9.6, 0.2));
  });
});

describe("escalar por unidad", () => {
  it("2 huevos son dos huevos, no 2 g de huevo", () => {
    expect(macrosFor(HUEVO, { qty: 2, unit: "unit" })).toEqual(m(156, 12.6, 1.2, 10.6));
  });

  it("si piden gramos y sabemos cuanto pesa uno, convierte", () => {
    expect(macrosFor(HUEVO, { qty: 100, unit: "g" })).toEqual(m(156, 12.6, 1.2, 10.6));
  });
});

describe("cuando la conversion no se puede hacer", () => {
  it("devuelve null, que es un valor que el llamador tiene que atender", () => {
    // Un cero inventado se guarda sin que nadie se entere. Un null, no.
    expect(macrosFor(PAN, { qty: 60, unit: "g" })).toBeNull();
    expect(macrosFor(POLLO, { qty: 100, unit: "ml" })).toBeNull();
    expect(macrosFor(LECHE, { qty: 100, unit: "g" })).toBeNull();
    expect(macrosFor(POLLO, { qty: 1, unit: "unit" })).toBeNull();
  });
});

describe("la aritmetica del dia", () => {
  it("suma una lista vacia como cero, no como NaN", () => {
    expect(sumMacros([])).toEqual(zeroMacros());
  });

  it("restar nunca da negativo: pasarse del objetivo deja 0, no deuda", () => {
    expect(subtractToFloor(m(2000, 150, 200, 60), m(2300, 170, 180, 55))).toEqual(m(0, 0, 20, 5));
  });
});
