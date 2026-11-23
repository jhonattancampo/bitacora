/* =========================================================
   nutricion-cantidad.test.ts — El orden de las cuatro reglas
   para leer una cantidad. El orden no es un detalle: si la
   tabla de medidas caseras le gana a los alimentos que se
   cuentan por unidad, la app guarda numeros plausibles y
   equivocados, que es la peor clase de error.
   ========================================================= */

import { describe, expect, it } from "vitest";
import { parseQuantity } from "../src/nutrition/domain/quantity";
import { HOUSEHOLD_MEASURES } from "../src/nutrition/domain/measures";

const PESADO = { basis: "per100g" } as const;
const LIQUIDO = { basis: "per100ml" } as const;
const CONTADO = { basis: "perUnit" } as const;

describe("1. gramos o ml escritos", () => {
  it("le gana a todo lo demas", () => {
    expect(parseQuantity("150 g de pollo", PESADO)).toMatchObject({ qty: 150, unit: "g" });
    expect(parseQuantity("200 ml de leche", LIQUIDO)).toMatchObject({ qty: 200, unit: "ml" });
  });

  it("acepta como lo escribe la gente: pegado, abreviado o entero", () => {
    expect(parseQuantity("150g", PESADO).qty).toBe(150);
    expect(parseQuantity("150 gr", PESADO).qty).toBe(150);
    expect(parseQuantity("150 gramos", PESADO).qty).toBe(150);
  });

  it("pasa los kilos y los litros a la unidad chica", () => {
    expect(parseQuantity("1,2 kg de carne", PESADO)).toMatchObject({ qty: 1200, unit: "g" });
    expect(parseQuantity("1 litro de leche", LIQUIDO)).toMatchObject({ qty: 1000, unit: "ml" });
  });

  it("no confunde 'lata' con un litro por empezar igual", () => {
    expect(parseQuantity("1 lata de atun", PESADO)).toMatchObject({ qty: 120, unit: "g" });
  });
});

describe("2. ALIMENTOS QUE SE CUENTAN POR UNIDAD", () => {
  it("'2 rebanadas de pan' da 2 UNIDADES, no 60 g", () => {
    // El bug facil: 'rebanada' vale 30 g en la tabla, y con el pan definido
    // por unidad esa tabla no tiene que tocarse. 2 unidades, punto.
    expect(parseQuantity("2 rebanadas de pan", CONTADO)).toEqual({ qty: 2, unit: "unit" });
    expect(HOUSEHOLD_MEASURES.rebanada.grams).toBe(30);
  });

  it("cuenta igual con el numero escrito en letras", () => {
    expect(parseQuantity("dos huevos", CONTADO)).toEqual({ qty: 2, unit: "unit" });
  });

  it("sin numero es una unidad, no cien gramos", () => {
    expect(parseQuantity("un huevo", CONTADO)).toEqual({ qty: 1, unit: "unit" });
    expect(parseQuantity("huevo", CONTADO)).toEqual({ qty: 1, unit: "unit" });
  });

  it("pero si escribieron los gramos, mandan los gramos", () => {
    expect(parseQuantity("60 g de pan", CONTADO)).toMatchObject({ qty: 60, unit: "g" });
  });

  it("sin saber que alimento es, la regla no puede aplicarse", () => {
    // Por eso parseQuantity recibe el alimento: sin el, '2 rebanadas' son 60 g.
    expect(parseQuantity("2 rebanadas de pan")).toMatchObject({ qty: 60, unit: "g" });
  });
});

describe("3. medidas caseras", () => {
  it("una taza de arroz son 180 g", () => {
    expect(parseQuantity("una taza de arroz integral", PESADO)).toMatchObject({
      qty: 180,
      unit: "g",
      measure: "taza",
    });
  });

  it("una cucharada de aceite son 12 g", () => {
    expect(parseQuantity("una cucharada de aceite", PESADO)).toMatchObject({ qty: 12, unit: "g" });
  });

  it("multiplica por el numero que tenga adelante", () => {
    expect(parseQuantity("3 cucharadas de aceite", PESADO).qty).toBe(36);
    expect(parseQuantity("1,5 tazas de arroz", PESADO).qty).toBe(270);
    expect(parseQuantity("medio vaso de leche", LIQUIDO)).toMatchObject({ qty: 100, unit: "ml" });
  });

  it("sin numero adelante es una", () => {
    expect(parseQuantity("taza de arroz", PESADO).qty).toBe(180);
  });

  it("las medidas de volumen salen en ml, no en g", () => {
    expect(parseQuantity("un vaso de agua", LIQUIDO)).toMatchObject({ qty: 200, unit: "ml" });
    expect(parseQuantity("una copa de vino", LIQUIDO)).toMatchObject({ qty: 150, unit: "ml" });
  });

  it("entiende el puñado con o sin la enie", () => {
    expect(parseQuantity("un puñado de almendras", PESADO).qty).toBe(25);
    expect(parseQuantity("un punado de almendras", PESADO).qty).toBe(25);
  });

  it("y el plural", () => {
    expect(parseQuantity("2 latas de atun", PESADO).qty).toBe(240);
  });
});

describe("4. cuando no dijeron nada", () => {
  it("asume 100 g para lo que se pesa", () => {
    expect(parseQuantity("pollo", PESADO)).toEqual({ qty: 100, unit: "g" });
  });

  it("asume 100 ml para lo que se toma", () => {
    expect(parseQuantity("leche", LIQUIDO)).toEqual({ qty: 100, unit: "ml" });
  });

  it("asume 100 g cuando ni siquiera sabe que alimento es", () => {
    expect(parseQuantity("algo rarisimo")).toEqual({ qty: 100, unit: "g" });
  });
});
