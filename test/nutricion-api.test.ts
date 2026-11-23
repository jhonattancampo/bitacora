/* =========================================================
   nutricion-api.test.ts — Los tres endpoints como contrato.
   Si esto pasa, montar el modulo detras de un servidor para que
   lo consuma Nutrect es un loop sobre ROUTES.
   ========================================================= */

import { describe, expect, it } from "vitest";
import { ROUTES, createNutritionApi } from "../src/nutrition/api/contract";
import { FOODS } from "../src/nutrition/data/foods";
import type { DayLog, DayPlan, LoggedItem, Macros } from "../src/nutrition/domain/types";

const m = (kcal: number, protein: number, carbs: number, fat: number): Macros => ({
  kcal,
  protein,
  carbs,
  fat,
});

const PLAN: DayPlan = {
  daily: m(2000, 150, 200, 60),
  perSlot: {
    desayuno: m(500, 30, 60, 15),
    almuerzo: m(700, 60, 70, 20),
    cena: m(800, 60, 70, 25),
  },
  order: ["desayuno", "almuerzo", "cena"],
};

const item = (macros: Macros): LoggedItem => ({
  id: "i",
  name: "algo",
  qty: 100,
  unit: "g",
  macros,
  source: "catalog",
});

const api = (log?: DayLog, plan: DayPlan | null = PLAN) =>
  createNutritionApi({
    catalog: FOODS,
    plan: { get: () => plan },
    dayLogs: { get: () => log ?? null },
  });

describe("el manifiesto de rutas", () => {
  it("declara los tres endpoints del contrato", () => {
    expect(ROUTES.map((r) => `${r.method} ${r.path}`)).toEqual([
      "POST /day-logs/:date/parse",
      "POST /foods/search",
      "GET /day-logs/:date/remaining",
    ]);
  });

  it("cada ruta apunta a un handler que existe de verdad", () => {
    const handlers = api();
    for (const route of ROUTES) expect(typeof handlers[route.handler]).toBe("function");
  });

  it("los handlers son todos async, que es lo que permite montarlos en un loop", async () => {
    const handlers = api();
    for (const route of ROUTES) {
      const call = handlers[route.handler] as (req: unknown) => unknown;
      expect(call({ date: "2026-11-23", slotId: "almuerzo", text: "", q: "" })).toBeInstanceOf(
        Promise,
      );
    }
  });
});

describe("POST /foods/search", () => {
  it("encuentra en el catalogo real", async () => {
    const r = await api().searchFoods({ q: "pechuga de pollo" });
    expect(r.matches.length).toBeGreaterThan(0);
    expect(r.matches[0].name.toLowerCase()).toContain("pollo");
  });

  it("devuelve lo que hace falta para mostrarlo y para registrarlo", async () => {
    const r = await api().searchFoods({ q: "huevo" });
    expect(r.matches[0]).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
      basis: expect.any(String),
      score: expect.any(Number),
    });
    expect(r.matches[0].macros).toMatchObject({ kcal: expect.any(Number) });
  });

  it("respeta el limite", async () => {
    const r = await api().searchFoods({ q: "pollo", limit: 1 });
    expect(r.matches).toHaveLength(1);
  });

  it("sin resultados avisa, no devuelve una lista vacia muda", async () => {
    const r = await api().searchFoods({ q: "xyzqwerty" });
    expect(r.matches).toEqual([]);
    expect(r.notices[0].kind).toBe("unresolved");
  });

  it("con la busqueda vacia tambien avisa", async () => {
    const r = await api().searchFoods({ q: "  " });
    expect(r.notices[0].kind).toBe("empty");
  });
});

describe("GET /day-logs/:date/remaining", () => {
  it("con el dia vacio reparte el plan tal cual", async () => {
    const r = await api().getRemaining({ date: "2026-11-23" });
    expect(r.consumed).toEqual(m(0, 0, 0, 0));
    expect(r.perSlot.almuerzo).toEqual(PLAN.perSlot.almuerzo);
    expect(r.nextSlotId).toBe("desayuno");
  });

  it("recalcula las pendientes con lo que ya se comio", async () => {
    const log: DayLog = {
      date: "2026-11-23",
      slots: [{ slotId: "desayuno", items: [item(m(600, 40, 70, 20))] }],
    };
    const r = await api(log).getRemaining({ date: "2026-11-23" });

    expect(r.remaining).toEqual(m(1400, 110, 130, 40));
    // almuerzo: 1400 * 700 / (700 + 800)
    expect(r.perSlot.almuerzo.kcal).toBeCloseTo(653.33, 2);
    expect(r.perSlot.desayuno).toEqual(PLAN.perSlot.desayuno);
    expect(r.nextSlotId).toBe("almuerzo");
  });

  it("dice cuanto se desvio cada pendiente del plan base", async () => {
    const log: DayLog = {
      date: "2026-11-23",
      slots: [{ slotId: "desayuno", items: [item(m(600, 40, 70, 20))] }],
    };
    const r = await api(log).getRemaining({ date: "2026-11-23" });
    expect(r.deviation.almuerzo.kcal).toBeCloseTo(-0.0667, 3);
    expect(r.deviation.desayuno).toBeUndefined();
  });

  it("sin plan avisa, en vez de devolver cuatro ceros que parecen un dia perfecto", async () => {
    const r = await api(undefined, null).getRemaining({ date: "2026-11-23" });
    expect(r.notices[0].kind).toBe("no-plan");
    expect(r.pending).toEqual([]);
  });
});

describe("POST /day-logs/:date/parse contra el catalogo real", () => {
  it("resuelve el ejemplo del spec sin modelo configurado", async () => {
    const r = await api().parseDayLog({
      date: "2026-11-23",
      slotId: "almuerzo",
      text: "150 g de pollo, una taza de arroz integral, una cucharada de aceite de oliva",
    });

    expect(r.items.length).toBeGreaterThanOrEqual(3);
    expect(r.items.every((i) => i.source === "catalog")).toBe(true);
  });

  it("sin modelo configurado no inventa: avisa que no pudo estimar", async () => {
    const r = await api().parseDayLog({
      date: "2026-11-23",
      slotId: "cena",
      text: "150 g de pollo, el guiso que hizo mi vieja",
    });

    expect(r.items.some((i) => i.source === "catalog")).toBe(true);
    expect(r.notices[0].kind).toBe("llm-unavailable");
  });
});

describe("un puerto de lectura que rompe", () => {
  it("vuelve como aviso, no como excepcion", async () => {
    const roto = createNutritionApi({
      catalog: FOODS,
      plan: {
        get: () => {
          throw new Error("storage caido");
        },
      },
      dayLogs: { get: () => null },
    });

    const r = await roto.getRemaining({ date: "2026-11-23" });
    expect(r.notices[0].message).toContain("storage caido");
  });

  it("y el handler sigue siendo una promesa, no tira en el acto", () => {
    const roto = createNutritionApi({
      catalog: FOODS,
      plan: { get: () => PLAN },
      dayLogs: {
        get: () => {
          throw new Error("caido");
        },
      },
    });
    expect(() => roto.getRemaining({ date: "2026-11-23" })).not.toThrow();
  });
});
