/* =========================================================
   lib/format.ts — Numbers and dates, the way this app writes
   them: comma as the decimal separator, dates in es-AR, and
   `YYYY-MM-DD` as the storage format everywhere.

   Pure functions with no state: the easiest thing in the
   codebase to test, and the thing most screens depend on.
   ========================================================= */

/**
 * Rounds to two decimals and writes the result the Argentine way: `72,5`.
 * Returns an em dash for null/undefined, which is what every grid shows
 * for "no data yet".
 */
export const fmt = (n: number | null | undefined): string => {
  if (n == null) return "—";
  const r = Math.round(n * 100) / 100;
  return String(r).replace(".", ",");
};

/** Today as `YYYY-MM-DD`, in the device's own timezone. */
export const today = (): string => new Date().toISOString().slice(0, 10);

/** `2026-03-07` → `07/03`. The compact form used in history grids and chart labels. */
export const dnice = (iso: string): string => {
  const [, m, d] = iso.split("-");
  return d + "/" + m;
};

/**
 * `2026-03-07` → `sáb, 7 mar`. Parsed at noon on purpose: midnight would
 * shift a day backwards in any timezone west of UTC.
 */
export const dlong = (iso: string): string => {
  const dt = new Date(iso + "T12:00:00");
  return dt.toLocaleDateString("es-AR", { weekday: "short", day: "numeric", month: "short" });
};

/** Whole days between that date and today. Also noon-anchored, so DST cannot make it 0.96 days. */
export const daysAgo = (iso: string): number =>
  Math.round((+new Date(today() + "T12:00:00") - +new Date(iso + "T12:00:00")) / 864e5);
