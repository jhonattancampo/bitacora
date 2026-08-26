/* =========================================================
   ui/theme.ts — Putting the chosen theme and accent on the
   document, where the CSS can see them.

   All twelve combinations (six accents × light/dark) live in
   app.css behind `[data-theme]` and `[data-accent]`. This file
   only sets those two attributes, plus the browser-chrome
   colour that has to be a real value and not a variable.
   ========================================================= */
import { state } from "../state/store";

/** Fallback for the browser chrome when `--bg` cannot be read yet. */
const FALLBACK_BG = "#0E1316";

/** Reflects `settings.theme` and `settings.accent` onto `<html>`. */
export function applyTheme(): void {
  document.documentElement.setAttribute("data-theme", state.settings.theme || "dark");
  document.documentElement.setAttribute("data-accent", state.settings.accent || "mostaza");
  const meta = document.querySelector("meta[name=theme-color]");
  // `theme-color` will not follow a CSS variable, so it gets the resolved value.
  if (meta)
    meta.setAttribute(
      "content",
      getComputedStyle(document.documentElement).getPropertyValue("--bg").trim() || FALLBACK_BG,
    );
}
