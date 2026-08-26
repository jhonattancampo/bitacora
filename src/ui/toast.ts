/* =========================================================
   ui/toast.ts — The one-line message that slides in at the
   bottom and leaves on its own.
   ========================================================= */
import { $ } from "../lib/dom";

/** How long the message stays up, in milliseconds. */
const TOAST_MS = 2200;

let toastT: ReturnType<typeof setTimeout> | null = null;

/**
 * Shows `msg` for a couple of seconds. A second call replaces the first
 * and restarts the clock, so two quick actions do not queue up.
 */
export function toast(msg: string): void {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("on");
  if (toastT) clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove("on"), TOAST_MS);
}
