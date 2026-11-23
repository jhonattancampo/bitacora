/* =========================================================
   nutrition/adapters/draft.ts — The items proposed but not yet
   logged.

   The contract says the parse endpoint returns PROPOSED items:
   the user looks at them and decides. That makes them transient
   — they belong to this tab, right now, and must never reach
   localStorage or sync.

   It lives in its own module because the view has to read it
   and the feature has to write it, and in this codebase views
   never import features. Same reason `features/timer.ts` keeps
   its countdown outside AppState.
   ========================================================= */

import type { LoggedItem } from "../domain/types";
import type { Notice } from "../app/notices";

export interface Draft {
  date: string;
  slotId: string;
  items: LoggedItem[];
  unresolved: string[];
  notices: Notice[];
  /** True while the model is being asked, so the view can say so. */
  pending: boolean;
}

let draft: Draft | null = null;

export const getDraft = (): Draft | null => draft;

export const setDraft = (next: Draft | null): void => {
  draft = next;
};

export const clearDraft = (): void => {
  draft = null;
};
