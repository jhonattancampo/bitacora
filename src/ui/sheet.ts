/* =========================================================
   ui/sheet.ts — The bottom sheet every editor, guide and
   picker opens into. One sheet element, reused: whoever opens
   it hands over its full markup.
   ========================================================= */
import { $ } from "../lib/dom";

/** Replaces the sheet's contents, shows it, and scrolls it back to the top. */
export function openSheet(html: string): void {
  $("#sheetin").innerHTML = html;
  $("#sheet").classList.add("on");
  $("#scrim").classList.add("on");
  $("#sheet").scrollTop = 0;
}

/** Hides the sheet. Its markup stays in the DOM until the next `openSheet`. */
export function closeSheet(): void {
  $("#sheet").classList.remove("on");
  $("#scrim").classList.remove("on");
}

/** True while the sheet is open — the state bridge uses it to avoid re-rendering under the user. */
export function sheetIsOpen(): boolean {
  return $("#sheet").classList.contains("on");
}
