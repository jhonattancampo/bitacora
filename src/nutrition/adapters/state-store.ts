/* =========================================================
   nutrition/adapters/state-store.ts — The nutrition ports,
   wired to this app's own state.

   This is the only file in the module that knows localStorage
   and `window` exist. Everything above it talks to the ports,
   which is what lets the same use cases run behind a server
   later without a line of them changing.

   Reads are defensive about `dayLogs`: sync replaces the whole
   state with whatever the other device sent, and a device still
   on an older build sends a state with no `dayLogs` at all.
   `migrate` only runs at boot, so the field can go missing
   after a sync and a view would crash on the first `.map()`.
   ========================================================= */

import { save, state } from "../../state/store";
import type { DayLog, DayPlan, LoggedItem, SlotLog } from "../domain/types";
import type { DayLogReader, PlanReader } from "../ports/storage";

const logs = (): DayLog[] => (state.dayLogs ??= []);

export const dayLogReader: DayLogReader = {
  get: (date) => logs().find((d) => d.date === date) ?? null,
};

export const planReader: PlanReader = {
  get: () => currentPlan(),
};

/** The stored plan as the domain wants it: the order comes from the slots. */
export function currentPlan(): DayPlan {
  const n = state.settings.nutrition;
  return { daily: n.daily, perSlot: n.perSlot, order: n.slots.map((s) => s.id) };
}

const dayOf = (date: string): DayLog => {
  const found = logs().find((d) => d.date === date);
  if (found) return found;
  const fresh: DayLog = { date, slots: [] };
  logs().push(fresh);
  return fresh;
};

const slotOf = (day: DayLog, slotId: string): SlotLog => {
  const found = day.slots.find((s) => s.slotId === slotId);
  if (found) return found;
  const fresh: SlotLog = { slotId, items: [] };
  day.slots.push(fresh);
  return fresh;
};

/** Adds items to a meal and writes through at once: a logged meal must not be lost. */
export function addItems(date: string, slotId: string, items: LoggedItem[]): void {
  if (items.length === 0) return;
  slotOf(dayOf(date), slotId).items.push(...items);
  save(true);
}

export function removeItem(date: string, slotId: string, itemId: string): void {
  const day = logs().find((d) => d.date === date);
  const slot = day?.slots.find((s) => s.slotId === slotId);
  if (!slot) return;
  const i = slot.items.findIndex((it) => it.id === itemId);
  if (i < 0) return;
  slot.items.splice(i, 1);
  // A day with nothing left in it is not a day that was eaten. Dropping the
  // empty shell keeps it out of `consumed` and out of sync as a tombstone.
  if (slot.items.length === 0) day!.slots.splice(day!.slots.indexOf(slot), 1);
  if (day!.slots.length === 0) logs().splice(logs().indexOf(day!), 1);
  save(true);
}
