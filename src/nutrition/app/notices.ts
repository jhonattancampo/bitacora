/* =========================================================
   nutrition/app/notices.ts — What the flow has to say for
   itself.

   The rule this file exists for: nothing may fail silently.
   Every path that cannot do what it was asked ends in one of
   these, and every response carries the list. A caller that
   renders `notices` cannot accidentally hide a failure, and a
   caller that ignores it is visibly ignoring something.

   `kind` is for code, `message` is for a person. An HTTP client
   switches on the first; a view prints the second.
   ========================================================= */

export type NoticeKind =
  /** There was nothing to read in the first place. */
  | "empty"
  /** Lines nobody could turn into numbers. */
  | "unresolved"
  /** The model answered for fewer lines than it was given. */
  | "partial"
  /** The model was not callable, so it was never called. */
  | "llm-unavailable"
  /** The call was made and did not come back usable. */
  | "llm-failed"
  /** The call came back, but some items in it could not be believed. */
  | "llm-rejected"
  /** There is no plan for this date to measure the day against. */
  | "no-plan";

export interface Notice {
  kind: NoticeKind;
  /** One sentence, ready to show as it is. */
  message: string;
  /** The lines this is about, when it is about some of them. */
  lines?: string[];
}

export const notice = (kind: NoticeKind, message: string, lines?: string[]): Notice =>
  lines && lines.length > 0 ? { kind, message, lines } : { kind, message };

/** A readable sentence out of whatever was thrown, without leaking a stack trace. */
export const errText = (e: unknown): string => {
  if (e instanceof Error && e.message) return e.message;
  const s = String(e ?? "").trim();
  return s === "" || s === "[object Object]" ? "Error desconocido" : s;
};
