/* =========================================================
   nutricion-parse.test.ts — El pipeline completo: catalogo
   primero, solo lo que sobra al modelo, y ningun camino de
   error que termine callado.
   ========================================================= */

import { describe, expect, it } from "vitest";
import { parseDayLog, LLM_TIMEOUT_MS, quantityText } from "../src/nutrition/app/parse-day-log";
import type { LlmPort } from "../src/nutrition/ports/llm";
import type { Food } from "../src/nutrition/domain/types";

const food = (id: string, name: string, over: Partial<Food> = {}): Food => ({
  id,
  name,
  basis: "per100g",
  macros: { kcal: 100, protein: 10, carbs: 10, fat: 2 },
  ...over,
});

const CATALOGO: Food[] = [
  food("pollo", "Pechuga de pollo cocida", {
    macros: { kcal: 165, protein: 31, carbs: 0, fat: 3.6 },
  }),
  food("arroz", "Arroz integral cocido", {
    macros: { kcal: 124, protein: 2.7, carbs: 26, fat: 1 },
  }),
  food("pan", "Pan lactal", {
    basis: "perUnit",
    unitGrams: 30,
    macros: { kcal: 80, protein: 3, carbs: 15, fat: 1 },
  }),
  food("pizza", "Pizza tres quesos", {
    basis: "perUnit",
    unitGrams: 120,
    macros: { kcal: 300, protein: 14, carbs: 30, fat: 14 },
  }),
];

/** Un puerto de mentira que anota con que lo llamaron. */
const llmSpy = (
  behaviour: { available?: boolean; payload?: unknown; fail?: unknown; hang?: boolean } = {},
): LlmPort & { calls: string[][] } => {
  const calls: string[][] = [];
  return {
    calls,
    isAvailable: () => behaviour.available ?? true,
    estimate: (lines) => {
      calls.push(lines);
      if (behaviour.hang) return new Promise(() => {});
      if (behaviour.fail !== undefined) return Promise.reject(behaviour.fail);
      return Promise.resolve(behaviour.payload);
    },
  };
};

const ids = () => {
  let n = 0;
  return () => `id${n++}`;
};

const req = (text: string) => ({ date: "2026-11-23", slotId: "almuerzo", text });

const deps = (llm: LlmPort, timeoutMs?: number) => ({
  catalog: CATALOGO,
  llm,
  newId: ids(),
  timeoutMs,
});

describe("el catalogo primero", () => {
  it("resuelve lo que puede sin tocar el modelo", async () => {
    const llm = llmSpy();
    const r = await parseDayLog(deps(llm), req("150 g de pollo, una taza de arroz integral"));

    expect(llm.calls).toEqual([]);
    expect(r.items).toHaveLength(2);
    expect(r.items.every((i) => i.source === "catalog")).toBe(true);
    expect(r.unresolved).toEqual([]);
    expect(r.notices).toEqual([]);
  });

  it("calcula los macros sobre la cantidad leida, no sobre 100 g", async () => {
    const r = await parseDayLog(deps(llmSpy()), req("150 g de pollo"));
    expect(r.items[0].macros).toEqual({ kcal: 248, protein: 46.5, carbs: 0, fat: 5.4 });
  });

  it("deja el foodId puesto, asi despues se sabe de donde salio el numero", async () => {
    const r = await parseDayLog(deps(llmSpy()), req("150 g de pollo"));
    expect(r.items[0].foodId).toBe("pollo");
  });
});

describe("SOLO lo que no se resolvio va al modelo", () => {
  it("manda las lineas desconocidas, nunca el texto completo", async () => {
    const llm = llmSpy({ payload: { items: [] } });
    await parseDayLog(deps(llm), req("150 g de pollo, un plato de guiso de mi abuela"));

    expect(llm.calls).toHaveLength(1);
    expect(llm.calls[0]).toEqual(["un plato de guiso de mi abuela"]);
    expect(llm.calls[0].join(" ")).not.toContain("pollo");
  });

  it("y lo ya resuelto se conserva igual", async () => {
    const llm = llmSpy({ payload: { items: [] } });
    const r = await parseDayLog(deps(llm), req("150 g de pollo, algo rarisimo"));
    expect(r.items).toHaveLength(1);
    expect(r.items[0].source).toBe("catalog");
  });
});

describe("lo que vuelve del modelo es una ESTIMACION", () => {
  const payload = {
    items: [
      { name: "Guiso casero", qty: 350, unit: "g", kcal: 480, protein: 22, carbs: 55, fat: 18 },
    ],
  };

  it("se guarda marcado como estimado, distinto del catalogo", async () => {
    const r = await parseDayLog(deps(llmSpy({ payload })), req("150 g de pollo, un guiso"));
    const fuentes = r.items.map((i) => i.source);
    expect(fuentes).toContain("catalog");
    expect(fuentes).toContain("estimated");
  });

  it("y sin foodId, porque no salio de ningun alimento del catalogo", async () => {
    const r = await parseDayLog(deps(llmSpy({ payload })), req("un guiso"));
    expect(r.items[0].source).toBe("estimated");
    expect(r.items[0].foodId).toBeUndefined();
  });
});

describe("ningun camino de error termina callado", () => {
  it("si el modelo no esta disponible, avisa y NO lo llama", async () => {
    const llm = llmSpy({ available: false });
    const r = await parseDayLog(deps(llm), req("150 g de pollo, un guiso"));

    expect(llm.calls).toEqual([]);
    expect(r.items).toHaveLength(1);
    expect(r.notices[0].kind).toBe("llm-unavailable");
    expect(r.notices[0].lines).toEqual(["un guiso"]);
    expect(r.notices[0].message).toContain("un guiso");
  });

  it("si el modelo falla, guarda lo resuelto y dice que no se pudo calcular", async () => {
    const r = await parseDayLog(
      deps(llmSpy({ fail: new Error("503 del proveedor") })),
      req("150 g de pollo, un guiso"),
    );

    expect(r.items).toHaveLength(1);
    expect(r.unresolved).toEqual(["un guiso"]);
    expect(r.notices[0].kind).toBe("llm-failed");
    expect(r.notices[0].message).toContain("503 del proveedor");
  });

  it("si el modelo cuelga, corta por timeout en vez de esperar para siempre", async () => {
    const r = await parseDayLog(deps(llmSpy({ hang: true }), 20), req("un guiso"));
    expect(r.notices[0].kind).toBe("llm-failed");
    expect(r.unresolved).toEqual(["un guiso"]);
  });

  it("el timeout del contrato son 20 segundos", () => {
    expect(LLM_TIMEOUT_MS).toBe(20_000);
  });

  it("si el puerto rompe al preguntarle si esta disponible, tampoco se cae", async () => {
    const roto: LlmPort = {
      isAvailable: () => {
        throw new Error("configuracion rota");
      },
      estimate: () => Promise.resolve({ items: [] }),
    };
    const r = await parseDayLog(deps(roto), req("150 g de pollo, un guiso"));
    expect(r.items).toHaveLength(1);
    expect(r.notices[0].kind).toBe("llm-failed");
  });

  it("si la respuesta no tiene forma de respuesta, lo dice", async () => {
    const r = await parseDayLog(deps(llmSpy({ payload: { cualquier: "cosa" } })), req("un guiso"));
    expect(r.notices[0].kind).toBe("llm-failed");
  });

  it("descarta los items que no se pueden creer y avisa por que", async () => {
    const payload = {
      items: [
        { name: "Guiso", qty: 350, unit: "g", kcal: 480, protein: 22, carbs: 55, fat: 18 },
        { name: "Fantasia", qty: -5, unit: "g", kcal: 1, protein: 1, carbs: 1, fat: 1 },
      ],
    };
    const r = await parseDayLog(deps(llmSpy({ payload })), req("un guiso, otra cosa"));

    expect(r.items).toHaveLength(1);
    expect(r.notices.map((n) => n.kind)).toContain("llm-rejected");
    expect(r.notices.find((n) => n.kind === "llm-rejected")?.message).toContain(
      "Cantidad invalida",
    );
  });

  it("si el modelo devuelve menos items que lineas, avisa que revise", async () => {
    const payload = {
      items: [{ name: "Guiso", qty: 350, unit: "g", kcal: 480, protein: 22, carbs: 55, fat: 18 }],
    };
    const r = await parseDayLog(deps(llmSpy({ payload })), req("un guiso, otra cosa rarisima"));
    expect(r.notices.map((n) => n.kind)).toContain("partial");
  });

  it("con el texto vacio avisa, no devuelve nada en silencio", async () => {
    const r = await parseDayLog(deps(llmSpy()), req("   "));
    expect(r.notices[0].kind).toBe("empty");
    expect(r.items).toEqual([]);
  });

  it("nunca tira: siempre vuelve una respuesta con avisos", async () => {
    const r = await parseDayLog(deps(llmSpy({ fail: "un string pelado" })), req("un guiso"));
    expect(r.notices[0].message).toContain("un string pelado");
  });
});

describe("sacar del texto las palabras que nombraron al alimento", () => {
  it("es lo que el parser solo nunca podria: 'pizza tres quesos' es UNA pizza", async () => {
    const r = await parseDayLog(deps(llmSpy()), req("pizza tres quesos"));
    expect(r.items[0].qty).toBe(1);
    expect(r.items[0].unit).toBe("unit");
  });

  it("pero un numero que SI es cantidad se respeta", async () => {
    const r = await parseDayLog(deps(llmSpy()), req("2 rebanadas de pan"));
    expect(r.items[0]).toMatchObject({ qty: 2, unit: "unit", name: "Pan lactal" });
  });

  it("deja afuera solo las palabras que matchearon", () => {
    expect(quantityText("2 rebanadas de pan", ["pan"])).toBe("2 rebanadas de");
  });
});
