/* =========================================================
   nutrition/ports/llm.ts — The door the language model is
   reached through, and the only place its answer is believed.

   Two things live here on purpose.

   The PORT is an interface, never a concrete client. Nothing in
   the pipeline may reach a network by itself; it asks this port,
   and it asks `isAvailable()` first. A module that imports a
   fetch wrapper directly has made the whole flow depend on a
   service being up, and there is no seam left to test it dry.

   The VALIDATION is here rather than in the adapter so that no
   adapter can skip it. `estimate` returns `unknown` on purpose:
   whatever comes back from outside is a guess until this file
   has looked at it. An item that does not survive is reported,
   not dropped — the caller has to be able to say which lines
   could not be computed.
   ========================================================= */

import type { Macros, QuantityUnit } from "../domain/types";

/** One item the model claims to have recognised, once it has been believed. */
export interface LlmItem {
  name: string;
  qty: number;
  unit: QuantityUnit;
  macros: Macros;
}

export interface LlmPort {
  /**
   * Whether the service can be called at all right now: configured, online,
   * within quota. Checked before every call, never assumed.
   */
  isAvailable(): boolean;
  /**
   * Estimates the lines it is given — only ever the ones the catalog could
   * not resolve, never the whole text.
   *
   * Returns the raw decoded payload. Shaping it is this module's job, not the
   * adapter's, so every adapter is held to the same standard.
   */
  estimate(lines: string[], signal: AbortSignal): Promise<unknown>;
}

/** The spellings a model might answer with, mapped to the three the domain knows. */
const UNITS: Record<string, QuantityUnit> = {
  g: "g",
  gr: "g",
  gram: "g",
  grams: "g",
  gramo: "g",
  gramos: "g",
  ml: "ml",
  cc: "ml",
  mililitro: "ml",
  mililitros: "ml",
  milliliter: "ml",
  milliliters: "ml",
  unit: "unit",
  units: "unit",
  u: "unit",
  unidad: "unit",
  unidades: "unit",
};

export interface LlmRejection {
  /** The item as it arrived, stringified, so the caller can show what was discarded. */
  raw: string;
  reason: string;
}

export interface LlmParseResult {
  items: LlmItem[];
  rejected: LlmRejection[];
}

/**
 * JSON, with one tolerance: a fenced code block around it.
 *
 * The contract asks the model for strict JSON and this still refuses anything
 * that is not JSON. But a ```json fence is the single most common way a model
 * answers "strictly" anyway, and failing a whole meal over three backticks
 * helps nobody.
 */
export function parseStrictJson(text: string): unknown {
  const fenced = /^\s*```(?:json)?\s*([\s\S]*?)\s*```\s*$/.exec(text);
  return JSON.parse(fenced ? fenced[1] : text);
}

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

const macroOf = (v: unknown): number | null => (finite(v) && v >= 0 ? v : null);

/**
 * Turns whatever came back into items the domain can use, and a list of the
 * ones that did not survive, each with the reason it was thrown out.
 *
 * Throws only when the payload has no `items` array at all: that is not a bad
 * item, it is a bad answer, and the caller handles it as a failed call.
 */
export function parseLlmItems(raw: unknown): LlmParseResult {
  const bag = raw as { items?: unknown };
  if (!bag || typeof bag !== "object" || !Array.isArray(bag.items)) {
    throw new Error("La respuesta no trae una lista de items");
  }

  const items: LlmItem[] = [];
  const rejected: LlmRejection[] = [];

  for (const entry of bag.items) {
    const reason = validate(entry);
    if (reason) {
      rejected.push({ raw: JSON.stringify(entry), reason });
      continue;
    }
    const e = entry as Record<string, unknown>;
    items.push({
      name: String(e.name).trim(),
      qty: e.qty as number,
      unit: UNITS[String(e.unit).trim().toLowerCase()],
      macros: {
        kcal: e.kcal as number,
        protein: e.protein as number,
        carbs: e.carbs as number,
        fat: e.fat as number,
      },
    });
  }

  return { items, rejected };
}

/** The reason this entry cannot be believed, or null when it can. */
function validate(entry: unknown): string | null {
  if (!entry || typeof entry !== "object") return "No es un objeto";
  const e = entry as Record<string, unknown>;

  if (typeof e.name !== "string" || e.name.trim() === "") return "Sin nombre";
  if (!finite(e.qty) || e.qty <= 0) return "Cantidad invalida";
  if (typeof e.unit !== "string" || !UNITS[e.unit.trim().toLowerCase()]) {
    return `Unidad desconocida: ${String(e.unit)}`;
  }
  for (const k of ["kcal", "protein", "carbs", "fat"] as const) {
    if (macroOf(e[k]) === null) return `Macro invalido: ${k}`;
  }
  return null;
}

/**
 * The port to use when there is no model configured at all.
 *
 * A null object rather than an optional dependency: the pipeline always has a
 * port and always asks it the same question, so "no model" is an ordinary
 * answer instead of a branch that only runs in production.
 */
export const NO_LLM: LlmPort = {
  isAvailable: () => false,
  estimate: () => Promise.reject(new Error("No hay un modelo configurado")),
};
