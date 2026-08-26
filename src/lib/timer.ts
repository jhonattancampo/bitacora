/* =========================================================
   timer.ts — The arithmetic behind the rest timer, split out
   of app.ts so it can be tested without a DOM.
   app.ts still owns every element write and every sound; this
   module only answers "given the clock, what should happen now".
   ========================================================= */
import { clamp } from "./calc";

/** Seconds before the end that trigger the "almost done" warning. */
export const REST_WARN_AT = 3;
/** Rests shorter than this skip the warning: three sounds back to back is noise. */
export const REST_WARN_MIN = 8;

export interface TimerState {
  end: number;
  total: number;
  label: string;
  beeped: boolean;
  warned: boolean;
}

export interface StoredTimer {
  end: number;
  total: number;
  label: string;
}

export interface TimerFrame {
  /** Seconds remaining; negative once the rest is over. */
  left: number;
  /** What the big number shows, e.g. "1:30" or "+0:12" when overrun. */
  text: string;
  /** True from the moment the rest is up. */
  done: boolean;
  /** Progress bar width, 0-100. */
  pct: number;
  /** This frame should play the "almost done" warning. */
  warn: boolean;
  /** This frame should play the "rest is over" sound. */
  finish: boolean;
  /** Two minutes past the end: the timer hides itself. */
  expired: boolean;
}

/** State for a rest that starts right now. */
export function newTimer(sec: number, label: string, now: number = Date.now()): TimerState {
  return {
    total: sec,
    end: now + sec * 1000,
    label: label || "Descanso",
    beeped: false,
    warned: sec <= REST_WARN_MIN,
  };
}

/**
 * State for a rest recovered from storage after the app was closed.
 * Returns null when the stored rest is too old to be worth restoring.
 */
export function restoreTimer(
  stored: StoredTimer | null,
  now: number = Date.now(),
): TimerState | null {
  if (!stored) return null;
  const left = (stored.end - now) / 1000;
  if (left < -90) return null;
  return {
    total: stored.total,
    end: stored.end,
    label: stored.label,
    beeped: left <= 0,
    warned: left <= REST_WARN_AT || stored.total <= REST_WARN_MIN,
  };
}

/** Everything one animation frame of the timer needs to know. */
export function timerFrame(t: TimerState, now: number = Date.now()): TimerFrame {
  const left = Math.round((t.end - now) / 1000);
  const abs = Math.abs(left);
  const mm = Math.floor(abs / 60);
  const ss = String(abs % 60).padStart(2, "0");
  return {
    left,
    text: (left < 0 ? "+" : "") + mm + ":" + ss,
    done: left <= 0,
    pct: left <= 0 ? 100 : clamp(100 - (left / t.total) * 100, 0, 100),
    warn: left > 0 && left <= REST_WARN_AT && !t.warned,
    finish: left <= 0 && !t.beeped,
    expired: left < -120,
  };
}
