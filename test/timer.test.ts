/* =========================================================
   timer.test.ts — The rest timer's arithmetic: the countdown
   text, the progress bar, and the three sounds (start, almost
   done, done) that have to fire exactly once each.
   ========================================================= */
import { describe, expect, it } from "vitest";
import {
  REST_WARN_AT,
  REST_WARN_MIN,
  newTimer,
  restoreTimer,
  timerFrame,
  type TimerState,
} from "../src/lib/timer";

const NOW = 1_800_000_000_000;

/** Runs the timer forward one second at a time and records what fired. */
function playOut(t: TimerState, from: number, to: number) {
  const fired = { warn: 0, finish: 0, expired: 0 };
  const texts: string[] = [];
  for (let s = from; s <= to; s++) {
    const f = timerFrame(t, NOW + s * 1000);
    texts.push(f.text);
    if (f.warn) {
      fired.warn++;
      t.warned = true;
    }
    if (f.finish) {
      fired.finish++;
      t.beeped = true;
    }
    if (f.expired) fired.expired++;
  }
  return { fired, texts };
}

describe("newTimer", () => {
  it("ends the given number of seconds from now", () => {
    const t = newTimer(90, "Press banca", NOW);
    expect(t.total).toBe(90);
    expect(t.end).toBe(NOW + 90_000);
    expect(t.label).toBe("Press banca");
    expect(t.beeped).toBe(false);
  });

  it("falls back to a generic label", () => {
    expect(newTimer(60, "", NOW).label).toBe("Descanso");
  });

  it("arms the warning for a normal rest", () => {
    expect(newTimer(90, "x", NOW).warned).toBe(false);
  });

  it("skips the warning on a very short rest, so three sounds do not collide", () => {
    expect(newTimer(REST_WARN_MIN, "x", NOW).warned).toBe(true);
    expect(newTimer(5, "x", NOW).warned).toBe(true);
  });
});

describe("timerFrame", () => {
  it("shows minutes and seconds while counting down", () => {
    const t = newTimer(90, "x", NOW);
    expect(timerFrame(t, NOW).text).toBe("1:30");
    expect(timerFrame(t, NOW + 31_000).text).toBe("0:59");
    expect(timerFrame(t, NOW + 90_000).text).toBe("0:00");
  });

  it("switches to a + prefix once the rest is over", () => {
    const t = newTimer(60, "x", NOW);
    expect(timerFrame(t, NOW + 72_000).text).toBe("+0:12");
    expect(timerFrame(t, NOW + 135_000).text).toBe("+1:15");
  });

  it("fills the bar from empty to full and stops there", () => {
    const t = newTimer(100, "x", NOW);
    expect(timerFrame(t, NOW).pct).toBeCloseTo(0, 5);
    expect(timerFrame(t, NOW + 50_000).pct).toBeCloseTo(50, 5);
    expect(timerFrame(t, NOW + 100_000).pct).toBe(100);
    expect(timerFrame(t, NOW + 300_000).pct).toBe(100);
  });

  it("marks the rest as done from the moment it hits zero", () => {
    const t = newTimer(30, "x", NOW);
    expect(timerFrame(t, NOW + 29_000).done).toBe(false);
    expect(timerFrame(t, NOW + 30_000).done).toBe(true);
  });

  it("warns once, and only inside the last few seconds", () => {
    const t = newTimer(30, "x", NOW);
    expect(timerFrame(t, NOW + (30 - REST_WARN_AT - 1) * 1000).warn).toBe(false);
    expect(timerFrame(t, NOW + (30 - REST_WARN_AT) * 1000).warn).toBe(true);
    // Already warned: it must not fire again.
    expect(timerFrame({ ...t, warned: true }, NOW + 28_000).warn).toBe(false);
  });

  it("does not warn once the rest is already over", () => {
    const t = newTimer(30, "x", NOW);
    expect(timerFrame(t, NOW + 31_000).warn).toBe(false);
  });

  it("plays each of the three moments exactly once over a full rest", () => {
    const t = newTimer(30, "x", NOW);
    const { fired } = playOut(t, 0, 35);
    // beepStart() is fired by startTimer, not by the frames; these are the
    // other two.
    expect(fired.warn).toBe(1);
    expect(fired.finish).toBe(1);
  });

  it("plays no warning at all on a rest shorter than the warning window", () => {
    const t = newTimer(5, "x", NOW);
    const { fired } = playOut(t, 0, 10);
    expect(fired.warn).toBe(0);
    expect(fired.finish).toBe(1);
  });

  it("hides itself two minutes past the end", () => {
    const t = newTimer(60, "x", NOW);
    expect(timerFrame(t, NOW + 179_000).expired).toBe(false);
    expect(timerFrame(t, NOW + 181_000).expired).toBe(true);
  });
});

describe("restoreTimer", () => {
  const stored = { end: NOW + 40_000, total: 90, label: "Press banca" };

  it("picks a running rest back up where it was", () => {
    const t = restoreTimer(stored, NOW)!;
    expect(t.end).toBe(stored.end);
    expect(t.total).toBe(90);
    expect(t.label).toBe("Press banca");
    expect(t.beeped).toBe(false);
    expect(t.warned).toBe(false);
  });

  it("does not replay the end sound for a rest that finished while away", () => {
    const t = restoreTimer({ ...stored, end: NOW - 10_000 }, NOW)!;
    expect(t.beeped).toBe(true);
    expect(t.warned).toBe(true);
  });

  it("does not replay the warning when returning inside the last seconds", () => {
    const t = restoreTimer({ ...stored, end: NOW + 2_000 }, NOW)!;
    expect(t.warned).toBe(true);
    expect(t.beeped).toBe(false);
  });

  it("throws away a rest that is more than 90 seconds stale", () => {
    expect(restoreTimer({ ...stored, end: NOW - 91_000 }, NOW)).toBeNull();
  });

  it("keeps a rest that just barely ended", () => {
    expect(restoreTimer({ ...stored, end: NOW - 89_000 }, NOW)).not.toBeNull();
  });

  it("handles nothing stored at all", () => {
    expect(restoreTimer(null, NOW)).toBeNull();
  });
});
