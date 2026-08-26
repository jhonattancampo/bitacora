/* =========================================================
   format.test.ts — How the app writes numbers and dates.
   Small functions, but every screen prints through them: a
   change here shows up in the history, the charts and the CSV
   at the same time.
   ========================================================= */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { daysAgo, dlong, dnice, fmt, today } from "../src/lib/format";

describe("fmt", () => {
  it("writes the decimal separator the way the keyboard does here", () => {
    expect(fmt(72.5)).toBe("72,5");
    expect(fmt(80)).toBe("80");
  });

  it("rounds to two decimals, so a computed volume does not print 15 digits", () => {
    expect(fmt(1 / 3)).toBe("0,33");
    expect(fmt(2.005)).toBe("2,01");
  });

  it("prints an em dash rather than 'null' when there is no data yet", () => {
    expect(fmt(null)).toBe("—");
    expect(fmt(undefined)).toBe("—");
  });

  it("prints a real zero, because 0 kg is data and no data is not", () => {
    expect(fmt(0)).toBe("0");
  });

  it("keeps the sign on a negative, which is how the weight delta shows a loss", () => {
    expect(fmt(-0.4)).toBe("-0,4");
  });
});

describe("dnice", () => {
  it("turns the stored ISO date into the short form the grids use", () => {
    expect(dnice("2026-03-07")).toBe("07/03");
    expect(dnice("2026-12-31")).toBe("31/12");
  });
});

describe("dlong", () => {
  it("reads the date at noon, so no timezone can shift it a day back", () => {
    // The bug this guards: `new Date("2026-03-07")` is midnight UTC, which is
    // still 6 March in Buenos Aires. Parsing at 12:00 local puts it out of reach.
    expect(dlong("2026-03-07")).toContain("7");
    expect(dlong("2026-03-07")).not.toContain("6");
  });
});

describe("daysAgo", () => {
  const FIXED = new Date("2026-03-10T09:30:00");

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("counts today as zero — 'hoy' on the routine card depends on it", () => {
    expect(daysAgo(today())).toBe(0);
  });

  it("counts whole days back", () => {
    expect(daysAgo("2026-03-09")).toBe(1);
    expect(daysAgo("2026-03-03")).toBe(7);
  });

  it("counts whole days: both ends are read at noon, never at a boundary", () => {
    // The subtraction happens between two `YYYY-MM-DDT12:00:00` dates, so it
    // can never come out as 0.96 of a day and round the wrong way.
    for (const iso of ["2026-03-09", "2026-03-01", "2026-02-28"]) {
      expect(Number.isInteger(daysAgo(iso))).toBe(true);
    }
  });

  it("goes negative for a date in the future rather than clamping", () => {
    expect(daysAgo("2026-03-12")).toBe(-2);
  });

  /* PENDIENTE, no lo arregla este PR: `today()` es
     `new Date().toISOString().slice(0,10)`, que es la fecha en UTC, no la
     local. Al este de UTC-0 eso adelanta el día en las últimas horas de la
     noche: en Buenos Aires (UTC-3), a partir de las 21:00 `today()` ya
     devuelve mañana, y una sesión de un lunes a la noche queda archivada
     como martes. Está así, textual, desde antes de la Fase 1; cambiarlo es
     un cambio de comportamiento y va en su propio PR.
     El test fija la conducta actual para que nadie la cambie sin querer. */
  it("hoy se resuelve en UTC, no en la hora local (comportamiento conocido)", () => {
    vi.setSystemTime(new Date("2026-03-10T23:59:00"));
    const offsetHoras = new Date().getTimezoneOffset() / 60;
    const cruzaDeDía = offsetHoras > 0; // al oeste de UTC, la noche ya es el día siguiente allá
    expect(today()).toBe(cruzaDeDía ? "2026-03-11" : "2026-03-10");
  });
});
