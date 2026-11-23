/* =========================================================
   nutrition/app/parse-day-log.ts — POST /day-logs/:date/parse

   Takes what the user typed and gives back items with numbers.
   It is written as a request in and a response out, with its
   dependencies handed to it, so the day it sits behind an HTTP
   handler nothing in here changes.

   The pipeline, in the order that matters:

     1. The LOCAL CATALOG first. Free, instant, offline, and the
        numbers are real rather than guessed.
     2. ONLY what is left over goes to the model. Never the whole
        text — what was already resolved is kept and only the
        unknown lines are asked about.
     3. Whatever the model says is an ESTIMATE, and is stored
        saying so.

   Nothing here fails silently. Every path that cannot do its job
   ends in a Notice, and the caller gets the items it could
   compute alongside the reasons for the ones it could not.
   ========================================================= */

import type { Food, LoggedItem } from "../domain/types";
import { bestMatch } from "../domain/search";
import { parseQuantity } from "../domain/quantity";
import { macrosFor, roundMacros } from "../domain/macros";
import { stem, tokens } from "../domain/text";
import type { LlmPort } from "../ports/llm";
import { parseLlmItems } from "../ports/llm";
import type { Notice } from "./notices";
import { errText, notice } from "./notices";
import { splitLines } from "./lines";

/** The contract asks for twenty seconds, and the clock is held here, not in the adapter. */
export const LLM_TIMEOUT_MS = 20_000;

export interface ParseRequest {
  /** ISO date, `YYYY-MM-DD`. */
  date: string;
  slotId: string;
  /** Free text: "150 g de pollo, una taza de arroz integral". */
  text: string;
}

export interface ParseResponse {
  date: string;
  slotId: string;
  /** What was worked out, catalog items and estimates together, each saying which it is. */
  items: LoggedItem[];
  /** Lines that still have no numbers. */
  unresolved: string[];
  /** Everything the flow has to say for itself. Never empty when something went wrong. */
  notices: Notice[];
}

export interface ParseDeps {
  catalog: Food[];
  llm: LlmPort;
  /** Injected so a test can be deterministic. */
  newId?: () => string;
  timeoutMs?: number;
}

const randomId = (): string => "n" + Math.random().toString(36).slice(2, 10);

const quoted = (lines: string[]): string => lines.map((l) => `"${l}"`).join(", ");

/**
 * Runs `work` with a signal, and gives up after `ms` whatever the adapter does.
 *
 * The signal lets a well-behaved adapter cancel its request; the timer makes
 * sure one that ignores it still cannot hang the meal.
 */
function withTimeout<T>(work: (signal: AbortSignal) => Promise<T>, ms: number): Promise<T> {
  const control = new AbortController();
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      control.abort();
      reject(new Error(`La consulta tardó más de ${Math.round(ms / 1000)} s`));
    }, ms);
    work(control.signal).then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/**
 * The part of a line that is left once the words that named the food are gone.
 *
 * This is the piece the parser on its own could never get right: in "pizza
 * tres quesos" the three is part of the name, not a quantity, and only here —
 * where it is known which words matched the catalog — can it be taken out
 * before the number is read.
 */
export function quantityText(line: string, matched: string[]): string {
  const used = new Set(matched);
  return tokens(line)
    .filter((t) => !used.has(stem(t)))
    .join(" ");
}

/** One line against the catalog, or null when the catalog cannot answer for it. */
function fromCatalog(catalog: Food[], line: string, newId: () => string): LoggedItem | null {
  const match = bestMatch(catalog, line);
  if (!match) return null;
  const quantity = parseQuantity(quantityText(line, match.matched), match.food);
  const macros = macrosFor(match.food, quantity);
  // A food we recognise but cannot convert is still unresolved: better asked
  // about than logged with numbers we had to invent.
  if (!macros) return null;
  return {
    id: newId(),
    name: match.food.name,
    qty: quantity.qty,
    unit: quantity.unit,
    macros,
    source: "catalog",
    foodId: match.food.id,
  };
}

export async function parseDayLog(deps: ParseDeps, req: ParseRequest): Promise<ParseResponse> {
  const newId = deps.newId ?? randomId;
  const notices: Notice[] = [];
  const items: LoggedItem[] = [];
  const lines = splitLines(req.text);
  const head = { date: req.date, slotId: req.slotId };

  if (lines.length === 0) {
    return { ...head, items, unresolved: [], notices: [notice("empty", "No escribiste nada.")] };
  }

  const unresolved: string[] = [];
  for (const line of lines) {
    const item = fromCatalog(deps.catalog, line, newId);
    if (item) items.push(item);
    else unresolved.push(line);
  }

  if (unresolved.length === 0) return { ...head, items, unresolved, notices };

  // Everything past this point talks to the outside, so it asks first — and
  // the asking happens INSIDE the try, because a port that throws while
  // reporting its own availability must not take the meal down with it.
  try {
    if (!deps.llm.isAvailable()) {
      notices.push(
        notice(
          "llm-unavailable",
          `Guardé lo que pude calcular. No se pudo calcular ${quoted(unresolved)}: no hay estimación disponible.`,
          unresolved,
        ),
      );
      return { ...head, items, unresolved, notices };
    }

    const raw = await withTimeout(
      (signal) => deps.llm.estimate(unresolved, signal),
      deps.timeoutMs ?? LLM_TIMEOUT_MS,
    );
    const { items: estimated, rejected } = parseLlmItems(raw);

    if (rejected.length > 0) {
      notices.push(
        notice(
          "llm-rejected",
          `Descarté ${rejected.length} ${rejected.length === 1 ? "ítem" : "ítems"} de la estimación: ${rejected
            .map((r) => r.reason)
            .join("; ")}.`,
        ),
      );
    }

    if (estimated.length === 0) {
      notices.push(
        notice(
          "unresolved",
          `Guardé lo que pude calcular. No se pudo calcular ${quoted(unresolved)}.`,
          unresolved,
        ),
      );
      return { ...head, items, unresolved, notices };
    }

    for (const e of estimated) {
      items.push({
        id: newId(),
        name: e.name,
        qty: e.qty,
        unit: e.unit,
        macros: roundMacros(e.macros),
        source: "estimated",
      });
    }

    if (estimated.length < unresolved.length) {
      notices.push(
        notice(
          "partial",
          `Estimé ${estimated.length} de ${unresolved.length} ${unresolved.length === 1 ? "línea" : "líneas"}: revisá ${quoted(unresolved)}.`,
          unresolved,
        ),
      );
    }

    return { ...head, items, unresolved: [], notices };
  } catch (e) {
    notices.push(
      notice(
        "llm-failed",
        `Guardé lo que pude calcular. No se pudo estimar ${quoted(unresolved)}: ${errText(e)}.`,
        unresolved,
      ),
    );
    return { ...head, items, unresolved, notices };
  }
}
