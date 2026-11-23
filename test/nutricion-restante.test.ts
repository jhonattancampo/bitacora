/* =========================================================
   nutricion-restante.test.ts — El objetivo de cada comida se
   recalcula con lo que ya se comio. Lo que se cubre aca es el
   reparto, el piso en cero, y que las comidas ya registradas
   no se midan contra un numero que se mueve.
   ========================================================= */

import { describe, expect, it } from "vitest";
import { computeRemaining, deviation } from "../src/nutrition/domain/remaining";
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
    merienda: m(300, 20, 30, 10),
    cena: m(500, 40, 40, 15),
  },
  order: ["desayuno", "almuerzo", "merienda", "cena"],
};

const item = (macros: Macros): LoggedItem => ({
  id: "i",
  name: "algo",
  qty: 100,
  unit: "g",
  macros,
  source: "catalog",
});

const log = (slots: Record<string, Macros[]>): DayLog => ({
  date: "2026-11-23",
  slots: Object.entries(slots).map(([slotId, list]) => ({ slotId, items: list.map(item) })),
});

describe("un dia sin nada registrado", () => {
  it("le da a cada comida su objetivo original", () => {
    const r = computeRemaining(PLAN, log({}));
    expect(r.perSlot.almuerzo).toEqual(PLAN.perSlot.almuerzo);
    expect(r.remaining).toEqual(PLAN.daily);
  });

  it("marca el desayuno como la proxima comida", () => {
    expect(computeRemaining(PLAN, log({})).nextSlotId).toBe("desayuno");
  });
});

describe("cuando el desayuno se pasa del plan", () => {
  const r = computeRemaining(PLAN, log({ desayuno: [m(600, 40, 70, 20)] }));

  it("el resto del dia absorbe la diferencia", () => {
    expect(r.consumed).toEqual(m(600, 40, 70, 20));
    expect(r.remaining).toEqual(m(1400, 110, 130, 40));
  });

  it("reparte lo que queda entre las pendientes, en la proporcion del plan", () => {
    // almuerzo: 1400 * 700 / (700+300+500) = 653,33
    expect(r.perSlot.almuerzo.kcal).toBeCloseTo(653.33, 2);
    expect(r.perSlot.merienda.kcal).toBeCloseTo(280, 2);
    expect(r.perSlot.cena.kcal).toBeCloseTo(466.67, 2);
  });

  it("la suma de las pendientes es exactamente lo que falta", () => {
    const suma = r.pending.reduce((a, id) => a + r.perSlot[id].kcal, 0);
    expect(suma).toBeCloseTo(r.remaining.kcal, 6);
  });

  it("recalcula cada macro por separado, no solo las calorias", () => {
    // proteina: 110 * 60 / (60+20+40) = 55
    expect(r.perSlot.almuerzo.protein).toBeCloseTo(55, 6);
  });

  it("al desayuno lo sigue midiendo contra su objetivo original", () => {
    expect(r.perSlot.desayuno).toEqual(PLAN.perSlot.desayuno);
  });

  it("y la proxima comida pasa a ser el almuerzo", () => {
    expect(r.nextSlotId).toBe("almuerzo");
    expect(r.pending).toEqual(["almuerzo", "merienda", "cena"]);
  });
});

describe("el piso en cero", () => {
  it("pasarse del dia entero deja 0 para las que faltan, no numeros negativos", () => {
    const r = computeRemaining(PLAN, log({ desayuno: [m(2500, 200, 250, 80)] }));
    expect(r.remaining).toEqual(m(0, 0, 0, 0));
    expect(r.perSlot.cena).toEqual(m(0, 0, 0, 0));
  });
});

describe("una comida registrada vacia", () => {
  it("sigue contando como pendiente: un slot sin items no se comio", () => {
    const r = computeRemaining(PLAN, {
      date: "2026-11-23",
      slots: [{ slotId: "desayuno", items: [] }],
    });
    expect(r.pending).toContain("desayuno");
    expect(r.nextSlotId).toBe("desayuno");
  });
});

describe("el dia completo", () => {
  const r = computeRemaining(
    PLAN,
    log({
      desayuno: [m(500, 30, 60, 15)],
      almuerzo: [m(700, 60, 70, 20)],
      merienda: [m(300, 20, 30, 10)],
      cena: [m(500, 40, 40, 15)],
    }),
  );

  it("no deja ninguna comida pendiente", () => {
    expect(r.pending).toEqual([]);
    expect(r.nextSlotId).toBeNull();
  });

  it("no divide por cero al no quedar plan por repartir", () => {
    for (const id of PLAN.order) expect(Number.isFinite(r.perSlot[id].kcal)).toBe(true);
  });
});

describe("el aviso de desvio", () => {
  it("dice en que fraccion se corrio el objetivo respecto del plan", () => {
    const r = computeRemaining(PLAN, log({ desayuno: [m(600, 40, 70, 20)] }));
    const d = deviation(r.perSlot.almuerzo, PLAN.perSlot.almuerzo);
    // 653,33 contra 700 planificadas: un 6,7% menos.
    expect(d.kcal).toBeCloseTo(-0.0667, 3);
  });

  it("no se desvia nada cuando el plan no pedia nada", () => {
    expect(deviation(m(10, 10, 10, 10), m(0, 0, 0, 0))).toEqual(m(0, 0, 0, 0));
  });
});
