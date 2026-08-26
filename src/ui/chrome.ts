/* =========================================================
   ui/chrome.ts — The two pieces of markup every screen starts
   with: the header that stays pinned at the top and, when storage
   is unavailable, the warning that says so.

   Kept apart from ui/shell.ts on purpose. The views import from
   here, and shell imports the views; if these lived in shell the
   two would import each other.
   ========================================================= */
import { esc } from "../lib/dom";
import { STORAGE_OK } from "../state/store";

/**
 * The screen's pinned header: a small eyebrow, the title, and
 * whatever action the screen wants on the right.
 * `right` is raw markup and is NOT escaped — callers pass a button.
 */
export function header(eyebrow: string, title: string, right?: string): string {
  return `<header class="top"><div class="wrap"><div class="topbar">
    <div class="flex-1 min-w-0"><div class="eyebrow">${esc(eyebrow)}</div><div class="h1">${esc(title)}</div></div>
    ${right || ""}</div></div></header>`;
}

/**
 * Shown only where localStorage throws — a private window, or a
 * sandboxed preview. Nothing typed there survives a reload, and the
 * user deserves to know before they log a whole session into it.
 */
export function storageWarn(): string {
  return STORAGE_OK
    ? ""
    : `<div class="wrap"><div class="warn mt-2.5"><b>Vista previa sin guardado.</b> Este entorno bloquea el almacenamiento local. Descargá el archivo y abrilo desde tu celular o compu: ahí sí guarda todo.</div></div>`;
}
