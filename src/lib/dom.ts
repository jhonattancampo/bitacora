/* =========================================================
   lib/dom.ts — The four one-liners every template and view
   reaches for. They were the first thing in app.ts and they are
   used by almost every module, so they get their own file.
   ========================================================= */

/**
 * First match, or null. Returns `any` on purpose: every caller already
 * knows which element it asked for, and narrowing each call site to the
 * right HTMLElement subtype is noise for no safety we do not already have.
 */
export const $ = (s: string, r: ParentNode = document): any => r.querySelector(s);

/** All matches, as a real array. Same `any` reasoning as `$`. */
export const $$ = (s: string, r: ParentNode = document): any[] => Array.from(r.querySelectorAll(s));

/** Short random id. Collisions do not matter: ids are only unique within one device's state. */
export const uid = (): string => Math.random().toString(36).slice(2, 10);

/**
 * HTML-escapes a value for interpolation into a template string.
 * Every piece of user text — exercise names, notes, routine titles —
 * goes through this before it reaches innerHTML.
 */
export const esc = (s: unknown): string =>
  String(s == null ? "" : s).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );

/** Hands the browser a blob to download under the given filename. */
export function dl(blob: Blob, name: string): void {
  const a = document.createElement("a"),
    u = URL.createObjectURL(blob);
  a.href = u;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 3000);
}
