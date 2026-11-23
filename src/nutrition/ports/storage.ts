/* =========================================================
   nutrition/ports/storage.ts — Where the day's numbers are
   read from.

   Interfaces, not implementations, and read-only: the use cases
   in this module propose and compute, they never write. Today
   the adapter behind these reads the browser's state; tomorrow
   it could read a database behind an HTTP handler, and no use
   case would notice.

   `null` is an ordinary answer, not an error: a date nobody has
   logged yet has no day log, and that is the normal case first
   thing in the morning.
   ========================================================= */

import type { DayLog, DayPlan } from "../domain/types";

export interface DayLogReader {
  /** What was logged on this date, or null when nothing was. */
  get(date: string): DayLog | null;
}

export interface PlanReader {
  /** The plan in force on this date, or null when there is none. */
  get(date: string): DayPlan | null;
}

/** An empty day, so a caller never has to invent one. */
export const emptyDayLog = (date: string): DayLog => ({ date, slots: [] });
