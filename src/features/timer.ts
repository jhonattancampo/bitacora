/* =========================================================
   features/timer.ts — El descanso entre series.

   La cuenta en si vive en lib/timer.ts, sin DOM y con tests.
   Aca esta todo lo que la cuenta no puede hacer sola: escribir
   en la pantalla, sonar, vibrar, sobrevivir a que se cierre la
   app, y pedirle al telefono que no se apague.

   Los tres avisos tienen que distinguirse SIN mirar la pantalla,
   porque el usuario esta debajo de una barra:
     arranca  = un tono grave y corto
     ya viene = dos tonos agudos rapidos
     termino  = tres tonos ascendentes
   ========================================================= */
import { $ } from "../lib/dom";
import { newTimer, restoreTimer as restoredTimerState, timerFrame } from "../lib/timer";
import type { TimerState } from "../lib/timer";
import { state } from "../state/store";
import type { ActionMap } from "../events/types";

/** Donde se guarda el descanso en curso para sobrevivir a un cierre de la app. */
const TIMER_KEY = "bitacora_timer";
/** Cada cuanto se repinta el numero grande. */
const TICK_MS = 200;

export const T: TimerState & { int: any } = {
  end: 0,
  total: 0,
  int: null,
  label: "",
  beeped: false,
  warned: false,
};
export function startTimer(sec: number, label: string): void {
  Object.assign(T, newTimer(sec, label));
  beepStart();
  $("#timer").classList.add("on");
  tick();
  clearInterval(T.int);
  T.int = setInterval(tick, TICK_MS);
  try {
    localStorage.setItem(TIMER_KEY, JSON.stringify({ end: T.end, total: T.total, label: T.label }));
  } catch (e) {}
}
export function stopTimer() {
  clearInterval(T.int);
  T.int = null;
  $("#timer").classList.remove("on");
  try {
    localStorage.removeItem(TIMER_KEY);
  } catch (e) {}
}
export function restoreTimer() {
  try {
    const o = JSON.parse(localStorage.getItem(TIMER_KEY) || "null");
    if (!o) return;
    const t = restoredTimerState(o);
    if (!t) {
      localStorage.removeItem(TIMER_KEY);
      return;
    }
    Object.assign(T, t);
    $("#timer").classList.add("on");
    tick();
    clearInterval(T.int);
    T.int = setInterval(tick, TICK_MS);
  } catch (e) {}
}
/* pantalla encendida durante la sesión (iOS 16.4+) */
let wakeLock: WakeLockSentinel | null = null;
export async function keepAwake(on: boolean): Promise<void> {
  try {
    if (on && state.settings.wake && "wakeLock" in navigator && !wakeLock) {
      wakeLock = await navigator.wakeLock.request("screen");
      wakeLock.addEventListener("release", () => {
        wakeLock = null;
      });
    }
    if (!on && wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  } catch (e) {}
}
/** Cuelga el listener que recupera el wake lock. La llama el arranque. */
export function initWakeLock(): void {
  /* El sistema suelta el wake lock al pasar la app a segundo plano y no lo
     devuelve solo: hay que volver a pedirlo al volver. */
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && state.active) void keepAwake(true);
  });
}
export function tick() {
  const fr = timerFrame(T);
  $("#tnum").textContent = fr.text;
  $("#tnum").classList.toggle("done", fr.done);
  $("#tlbl").textContent = T.label;
  const f = $("#tfill");
  f.style.width = fr.pct + "%";
  f.classList.toggle("done", fr.done);
  if (fr.warn) {
    T.warned = true;
    beepWarn();
  }
  if (fr.finish) {
    T.beeped = true;
    beep();
  }
  if (fr.expired) stopTimer();
}
/* Los tres avisos del descanso tienen que distinguirse sin mirar la pantalla:
   arranca  = un tono grave y corto
   ya viene = dos tonos agudos rápidos
   terminó  = tres tonos ascendentes */
function tones(seq: Tono[], vib: number[] | null) {
  if (state.settings.vibrate && navigator.vibrate && vib)
    try {
      navigator.vibrate(vib);
    } catch (e) {}
  if (!state.settings.sound) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ac = new AC();
    let last = 0;
    seq.forEach((n) => {
      const o = ac.createOscillator(),
        g = ac.createGain();
      o.type = "sine";
      o.frequency.value = n.f;
      const t0 = ac.currentTime + n.t;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(n.g || 0.3, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + n.d);
      o.connect(g);
      g.connect(ac.destination);
      o.start(t0);
      o.stop(t0 + n.d + 0.02);
      last = Math.max(last, n.t + n.d);
    });
    setTimeout(
      () => {
        try {
          void ac.close();
        } catch (e) {}
      },
      (last + 1) * 1000,
    );
  } catch (e) {}
}
function beepStart() {
  tones([{ f: 392, t: 0, d: 0.16, g: 0.24 }], [70]);
}
function beepWarn() {
  tones(
    [
      { f: 1175, t: 0, d: 0.08, g: 0.26 },
      { f: 1175, t: 0.13, d: 0.08, g: 0.26 },
    ],
    [60, 70, 60],
  );
}
function beep() {
  tones(
    [
      { f: 784, t: 0, d: 0.18 },
      { f: 784, t: 0.22, d: 0.18 },
      { f: 1046, t: 0.44, d: 0.2, g: 0.32 },
    ],
    [120, 80, 120, 80, 220],
  );
}

/** Un tono del aviso: frecuencia, cuando arranca, cuanto dura, y que fuerte. */
interface Tono {
  /** Frecuencia en Hz. */
  f: number;
  /** Segundos de retraso desde el inicio de la secuencia. */
  t: number;
  /** Duracion en segundos. */
  d: number;
  /** Ganancia; por defecto 0,3. */
  g?: number;
}

/** Cuanto suma o resta cada toque de los botones del descanso. */
const NUDGE_S = 15;

export const timerActions: ActionMap = {
  /* Sumar tiempo tambien borra `beeped`: si el descanso ya habia sonado y
     el usuario lo estira, tiene que volver a sonar al llegar de nuevo. */
  "t-add": () => {
    T.end += NUDGE_S * 1000;
    T.total += NUDGE_S;
    T.beeped = false;
    tick();
  },
  "t-sub": () => {
    T.end -= NUDGE_S * 1000;
    tick();
  },
  "t-skip": () => stopTimer(),
};
