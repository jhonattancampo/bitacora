/* =========================================================
   nutrition/adapters/llm-fetch.ts — One implementation of the
   LLM port, over HTTP.

   Deliberately provider-agnostic: it posts the unknown lines to
   an endpoint and expects strict JSON back. The endpoint is
   meant to be a small function of your own that holds the API
   key — NOT a model provider called straight from the page,
   which would mean shipping a key to every browser that loads
   the app.

   Until an endpoint is configured, `isAvailable()` is false and
   the pipeline simply never calls it: the app keeps working on
   the catalog alone and says, in as many words, what it could
   not estimate. That is why the check exists.

   The timeout is NOT here. The use case holds the clock, so an
   adapter that forgets one cannot hang a meal.
   ========================================================= */

import type { LlmPort } from "../ports/llm";
import { parseStrictJson } from "../ports/llm";

/**
 * The contract the endpoint has to honour. Exported so whoever writes the
 * function on the other side is reading the same sentence this file is.
 */
export const ESTIMATE_CONTRACT = [
  "Recibís un arreglo de líneas de comida en español rioplatense.",
  "Respondés SOLO con JSON válido, sin texto alrededor, con esta forma exacta:",
  '{ "items": [{ "name": string, "qty": number, "unit": "g" | "ml" | "unit",',
  '  "kcal": number, "protein": number, "carbs": number, "fat": number }] }',
  "Un ítem por línea recibida, en el mismo orden.",
  "Los macros son para la cantidad indicada, no para 100 g.",
  "Si una línea no se puede estimar, omitila en vez de inventar números.",
].join("\n");

export interface LlmFetchConfig {
  /** Where to post. Empty or missing means the port reports itself unavailable. */
  endpoint?: string;
  /** Extra headers, for whatever the endpoint uses to authenticate itself. */
  headers?: Record<string, string>;
  /** Overridden in tests. Defaults to the global fetch. */
  fetchImpl?: typeof fetch;
  /** Overridden in tests. Defaults to the browser's own answer, or true off-browser. */
  online?: () => boolean;
}

const defaultOnline = (): boolean => typeof navigator === "undefined" || navigator.onLine !== false;

export function createFetchLlm(config: LlmFetchConfig = {}): LlmPort {
  const endpoint = (config.endpoint ?? "").trim();
  const online = config.online ?? defaultOnline;

  return {
    isAvailable: () => endpoint !== "" && online(),

    async estimate(lines, signal) {
      const doFetch = config.fetchImpl ?? fetch;
      const response = await doFetch(endpoint, {
        method: "POST",
        signal,
        headers: { "Content-Type": "application/json", ...(config.headers ?? {}) },
        body: JSON.stringify({ contract: ESTIMATE_CONTRACT, lines }),
      });

      if (!response.ok) {
        throw new Error(`El servicio respondió ${response.status}`);
      }

      // Parsed here rather than with response.json() so a non-JSON body fails
      // with a sentence about this service instead of a generic syntax error.
      return parseStrictJson(await response.text());
    },
  };
}
