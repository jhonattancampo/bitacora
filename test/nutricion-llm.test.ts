/* =========================================================
   nutricion-llm.test.ts — El puerto del modelo: lo que vuelve
   de afuera es una suposicion hasta que este archivo la mira.
   ========================================================= */

import { describe, expect, it } from "vitest";
import { parseLlmItems, parseStrictJson, NO_LLM } from "../src/nutrition/ports/llm";
import { createFetchLlm, ESTIMATE_CONTRACT } from "../src/nutrition/adapters/llm-fetch";

const item = (over: Record<string, unknown> = {}) => ({
  name: "Guiso",
  qty: 350,
  unit: "g",
  kcal: 480,
  protein: 22,
  carbs: 55,
  fat: 18,
  ...over,
});

describe("leer la respuesta", () => {
  it("acepta JSON pelado", () => {
    expect(parseStrictJson('{"items":[]}')).toEqual({ items: [] });
  });

  it("tolera el bloque de codigo, que es como contestan los modelos", () => {
    expect(parseStrictJson('```json\n{"items":[]}\n```')).toEqual({ items: [] });
  });

  it("pero no tolera cualquier cosa", () => {
    expect(() => parseStrictJson("claro, aca va:")).toThrow();
  });
});

describe("creerle a un item", () => {
  it("le cree a uno bien formado", () => {
    const r = parseLlmItems({ items: [item()] });
    expect(r.items).toHaveLength(1);
    expect(r.items[0]).toMatchObject({ name: "Guiso", qty: 350, unit: "g" });
    expect(r.items[0].macros).toEqual({ kcal: 480, protein: 22, carbs: 55, fat: 18 });
  });

  it("traduce las unidades como las escribe un modelo", () => {
    expect(parseLlmItems({ items: [item({ unit: "gramos" })] }).items[0].unit).toBe("g");
    expect(parseLlmItems({ items: [item({ unit: "unidades" })] }).items[0].unit).toBe("unit");
    expect(parseLlmItems({ items: [item({ unit: "ML" })] }).items[0].unit).toBe("ml");
  });

  it("rechaza, con motivo, todo lo que no se puede creer", () => {
    const malos = [
      [item({ name: "" }), "Sin nombre"],
      [item({ qty: 0 }), "Cantidad invalida"],
      [item({ qty: -3 }), "Cantidad invalida"],
      [item({ qty: "mucho" }), "Cantidad invalida"],
      [item({ unit: "puñados" }), "Unidad desconocida"],
      [item({ kcal: null }), "Macro invalido"],
      [item({ protein: -1 }), "Macro invalido"],
      [item({ fat: "poco" }), "Macro invalido"],
      ["una string pelada", "No es un objeto"],
    ] as const;

    for (const [malo, motivo] of malos) {
      const r = parseLlmItems({ items: [malo] });
      expect(r.items).toEqual([]);
      expect(r.rejected[0].reason).toContain(motivo);
    }
  });

  it("no le cree a una clave del prototipo disfrazada de unidad", () => {
    // Con un objeto literal, UNITS["constructor"] devuelve una funcion y el
    // item pasaba la validacion con una funcion donde va una unidad.
    for (const u of ["constructor", "toString", "valueOf", "__proto__"]) {
      const r = parseLlmItems({ items: [item({ unit: u })] });
      expect(r.items).toEqual([]);
      expect(r.rejected[0].reason).toContain("Unidad desconocida");
    }
  });

  it("rechaza numeros absurdos, que no son una comida grande sino una respuesta rota", () => {
    expect(parseLlmItems({ items: [item({ qty: 1e15 })] }).rejected).toHaveLength(1);
    expect(parseLlmItems({ items: [item({ kcal: 1e15 })] }).rejected).toHaveLength(1);
  });

  it("se queda con el indice de linea cuando viene, y lo ignora si es basura", () => {
    expect(parseLlmItems({ items: [item({ index: 2 })] }).items[0].index).toBe(2);
    expect(parseLlmItems({ items: [item({ index: -1 })] }).items[0].index).toBeUndefined();
    expect(parseLlmItems({ items: [item({ index: "dos" })] }).items[0].index).toBeUndefined();
    expect(parseLlmItems({ items: [item()] }).items[0].index).toBeUndefined();
  });

  it("un item podrido no se lleva puestos a los sanos", () => {
    const r = parseLlmItems({ items: [item(), item({ qty: -1 }), item({ name: "Tarta" })] });
    expect(r.items.map((i) => i.name)).toEqual(["Guiso", "Tarta"]);
    expect(r.rejected).toHaveLength(1);
  });

  it("una respuesta sin lista de items no es un item malo, es una respuesta mala", () => {
    expect(() => parseLlmItems({ cualquier: "cosa" })).toThrow();
    expect(() => parseLlmItems(null)).toThrow();
    expect(() => parseLlmItems({ items: "no soy un array" })).toThrow();
  });
});

describe("el puerto cuando no hay modelo", () => {
  it("dice que no esta disponible, en vez de fallar al usarlo", () => {
    expect(NO_LLM.isAvailable()).toBe(false);
  });
});

describe("el adaptador HTTP", () => {
  it("sin endpoint configurado se declara no disponible", () => {
    expect(createFetchLlm().isAvailable()).toBe(false);
    expect(createFetchLlm({ endpoint: "   " }).isAvailable()).toBe(false);
  });

  it("con endpoint y conexion, disponible", () => {
    expect(createFetchLlm({ endpoint: "https://x.test/e", online: () => true }).isAvailable()).toBe(
      true,
    );
  });

  it("sin conexion, no disponible aunque haya endpoint", () => {
    expect(
      createFetchLlm({ endpoint: "https://x.test/e", online: () => false }).isAvailable(),
    ).toBe(false);
  });

  it("manda las lineas y el contrato, y pasa la senal de cancelacion", async () => {
    let visto: { body: string; signal: unknown } | null = null;
    const llm = createFetchLlm({
      endpoint: "https://x.test/e",
      online: () => true,
      fetchImpl: ((_url: string, init: RequestInit) => {
        visto = { body: String(init.body), signal: init.signal };
        return Promise.resolve(new Response('{"items":[]}', { status: 200 }));
      }) as unknown as typeof fetch,
    });

    const control = new AbortController();
    await llm.estimate(["un guiso"], control.signal);

    expect(visto!.body).toContain("un guiso");
    expect(visto!.body).toContain(ESTIMATE_CONTRACT.slice(0, 20));
    expect(visto!.signal).toBe(control.signal);
  });

  it("un status de error sale como un error que se puede mostrar", async () => {
    const llm = createFetchLlm({
      endpoint: "https://x.test/e",
      online: () => true,
      fetchImpl: (() =>
        Promise.resolve(new Response("nope", { status: 503 }))) as unknown as typeof fetch,
    });
    await expect(llm.estimate(["x"], new AbortController().signal)).rejects.toThrow("503");
  });
});
