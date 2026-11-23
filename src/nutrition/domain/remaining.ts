/* =========================================================
   nutrition/domain/remaining.ts — What is left to eat, and how
   it is shared out across the meals that have not happened yet.

   A per-meal target is not a fixed slice of the day. Eat 200 kcal
   over at lunch and dinner has to absorb it; skip breakfast and
   the rest of the day grows. So a pending slot's target is the
   day's leftover, split between the pending slots in the same
   proportion the plan gave them:

     remaining(slot) = (daily - consumed)
                       x  original(slot) / SUM original(pending slots)

   Each of the four numbers is recalculated on its own, with a
   floor of zero. A slot that has already been logged keeps its
   ORIGINAL target: it is history now, and it is judged against
   what was asked of it at the time, not against a figure that
   moves every time something else is eaten.
   ========================================================= */

import type { DayLog, DayPlan, Macros } from "./types";
import { MACRO_KEYS } from "./types";
import { subtractToFloor, sumMacros, zeroMacros } from "./macros";

export interface RemainingResult {
  /** Everything logged so far today. */
  consumed: Macros;
  /** Day target minus consumed, floored at zero. */
  remaining: Macros;
  /** Per slot: the original target for logged slots, the recalculated one for pending slots. */
  perSlot: Record<string, Macros>;
  /** Slot ids with nothing logged, in plan order. */
  pending: string[];
  /** The meal the user is up to, or null when the day is complete. */
  nextSlotId: string | null;
}

const slotTarget = (plan: DayPlan, slotId: string): Macros => plan.perSlot[slotId] ?? zeroMacros();

/** A slot counts as logged once it holds at least one item. An empty slot is still pending. */
const loggedSlotIds = (log: DayLog): Set<string> =>
  new Set(log.slots.filter((s) => s.items.length > 0).map((s) => s.slotId));

export function computeRemaining(plan: DayPlan, log: DayLog): RemainingResult {
  const logged = loggedSlotIds(log);
  const consumed = sumMacros(log.slots.flatMap((s) => s.items.map((i) => i.macros)));
  const remaining = subtractToFloor(plan.daily, consumed);
  const pending = plan.order.filter((id) => !logged.has(id));

  // The denominator: what the plan had asked of the meals still to come.
  const pendingTotal = sumMacros(pending.map((id) => slotTarget(plan, id)));

  const perSlot: Record<string, Macros> = {};
  for (const id of plan.order) {
    const original = slotTarget(plan, id);
    if (logged.has(id)) {
      perSlot[id] = original;
      continue;
    }
    const share = zeroMacros();
    for (const k of MACRO_KEYS) {
      // No plan left to share out means nothing to ask of this slot, and it
      // also means dividing by zero if we are not careful.
      share[k] =
        pendingTotal[k] > 0 ? Math.max(0, (remaining[k] * original[k]) / pendingTotal[k]) : 0;
    }
    perSlot[id] = share;
  }

  return { consumed, remaining, perSlot, pending, nextSlotId: pending[0] ?? null };
}

/**
 * How far a recalculated target sits from what the plan originally asked, as a
 * signed fraction (+0.25 means a quarter more than planned). The UI uses it to
 * warn that the day has drifted; a slot the plan asked nothing of never drifts.
 */
export const deviation = (recalculated: Macros, original: Macros): Macros => {
  const out = zeroMacros();
  for (const k of MACRO_KEYS) {
    out[k] = original[k] > 0 ? (recalculated[k] - original[k]) / original[k] : 0;
  }
  return out;
};
