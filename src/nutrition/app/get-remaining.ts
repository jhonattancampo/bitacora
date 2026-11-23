/* =========================================================
   nutrition/app/get-remaining.ts — GET /day-logs/:date/remaining

   How the day is going: what has been eaten, what is left, and
   what each meal still to come is being asked for now that the
   earlier ones have happened.

   This is the endpoint Nutrect reads to show the nutritionist
   where the patient is at, so the response is data and nothing
   else — no wording, no formatting. The sentence a person reads
   is built by whoever is showing it.
   ========================================================= */

import type { DayLog, DayPlan, Macros } from "../domain/types";
import { computeRemaining, deviation } from "../domain/remaining";
import { zeroMacros } from "../domain/macros";
import type { DayLogReader, PlanReader } from "../ports/storage";
import { emptyDayLog } from "../ports/storage";
import type { Notice } from "./notices";
import { errText, notice } from "./notices";

export interface RemainingRequest {
  /** ISO date, `YYYY-MM-DD`. */
  date: string;
}

export interface RemainingResponse {
  date: string;
  consumed: Macros;
  remaining: Macros;
  /** Original target for the meals already logged, recalculated for the ones still to come. */
  perSlot: Record<string, Macros>;
  /** How far each pending meal's target has moved from the plan, as a signed fraction. */
  deviation: Record<string, Macros>;
  /** Slot ids with nothing logged, in plan order. */
  pending: string[];
  /** The meal the user is up to, or null when the day is complete. */
  nextSlotId: string | null;
  notices: Notice[];
}

export interface RemainingDeps {
  plan: PlanReader;
  dayLogs: DayLogReader;
}

const nothing = (date: string, notices: Notice[]): RemainingResponse => ({
  date,
  consumed: zeroMacros(),
  remaining: zeroMacros(),
  perSlot: {},
  deviation: {},
  pending: [],
  nextSlotId: null,
  notices,
});

export function getRemaining(deps: RemainingDeps, req: RemainingRequest): RemainingResponse {
  let plan: DayPlan | null;
  let log: DayLog;
  try {
    plan = deps.plan.get(req.date);
    log = deps.dayLogs.get(req.date) ?? emptyDayLog(req.date);
  } catch (e) {
    // A reader that breaks must not escape as an exception. The rule is that
    // every failure comes back as something the caller can show, and a
    // storage failure is no different from a model failure.
    return nothing(req.date, [
      notice("no-plan", `No se pudieron leer los datos del ${req.date}: ${errText(e)}.`),
    ]);
  }

  if (!plan) {
    // Without a plan there is nothing to be remaining FROM. Saying so beats
    // answering with four zeros that look like a day eaten exactly to target.
    return nothing(req.date, [
      notice(
        "no-plan",
        `No hay un plan cargado para el ${req.date}, así que no hay objetivo que repartir.`,
      ),
    ]);
  }

  const result = computeRemaining(plan, log);

  const drift: Record<string, Macros> = {};
  for (const slotId of result.pending) {
    drift[slotId] = deviation(result.perSlot[slotId], plan.perSlot[slotId] ?? zeroMacros());
  }

  return {
    date: req.date,
    consumed: result.consumed,
    remaining: result.remaining,
    perSlot: result.perSlot,
    deviation: drift,
    pending: result.pending,
    nextSlotId: result.nextSlotId,
    notices: [],
  };
}
