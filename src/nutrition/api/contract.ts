/* =========================================================
   nutrition/api/contract.ts — The three endpoints, as data.

   This is the whole point of the shape of this module. Nothing
   under nutrition/ knows whether it is running in a browser, in
   a worker or behind a server; the use cases take a request and
   give back a response, and this file names them and says which
   verb and path each one answers to.

   Mounting it on an HTTP server is a loop, not a rewrite:

     const api = createNutritionApi(deps);
     for (const route of ROUTES) {
       server[route.method.toLowerCase()](route.path, async (req, res) =>
         res.json(await api[route.handler]({ ...req.params, ...req.body })),
       );
     }

   Which is also how Nutrect gets to read the same numbers the
   app shows, without a second implementation drifting out of
   step with this one.
   ========================================================= */

import type { Food } from "../domain/types";
import type { LlmPort } from "../ports/llm";
import { NO_LLM } from "../ports/llm";
import type { DayLogReader, PlanReader } from "../ports/storage";
import type { ParseRequest, ParseResponse } from "../app/parse-day-log";
import { parseDayLog } from "../app/parse-day-log";
import type { SearchRequest, SearchResponse } from "../app/search-foods";
import { searchFoods } from "../app/search-foods";
import type { RemainingRequest, RemainingResponse } from "../app/get-remaining";
import { getRemaining } from "../app/get-remaining";

export interface Route {
  method: "GET" | "POST";
  path: string;
  handler: keyof NutritionApi;
  /** The names taken from the path, which a server merges into the request. */
  params: readonly string[];
}

export const ROUTES: readonly Route[] = [
  { method: "POST", path: "/day-logs/:date/parse", handler: "parseDayLog", params: ["date"] },
  { method: "POST", path: "/foods/search", handler: "searchFoods", params: [] },
  { method: "GET", path: "/day-logs/:date/remaining", handler: "getRemaining", params: ["date"] },
];

/**
 * Every handler is async, including the two that have nothing to wait for.
 * A uniform signature is what lets the loop above exist at all.
 */
export interface NutritionApi {
  parseDayLog(req: ParseRequest): Promise<ParseResponse>;
  searchFoods(req: SearchRequest): Promise<SearchResponse>;
  getRemaining(req: RemainingRequest): Promise<RemainingResponse>;
}

export interface NutritionDeps {
  catalog: Food[];
  plan: PlanReader;
  dayLogs: DayLogReader;
  /** Left out means no estimates: the catalog answers alone and says so. */
  llm?: LlmPort;
  /** Injected by the tests that need the ids to be predictable. */
  newId?: () => string;
  timeoutMs?: number;
}

export function createNutritionApi(deps: NutritionDeps): NutritionApi {
  const llm = deps.llm ?? NO_LLM;
  return {
    parseDayLog: (req) =>
      parseDayLog(
        { catalog: deps.catalog, llm, newId: deps.newId, timeoutMs: deps.timeoutMs },
        req,
      ),
    searchFoods: (req) => Promise.resolve(searchFoods({ catalog: deps.catalog }, req)),
    getRemaining: (req) =>
      Promise.resolve(getRemaining({ plan: deps.plan, dayLogs: deps.dayLogs }, req)),
  };
}
