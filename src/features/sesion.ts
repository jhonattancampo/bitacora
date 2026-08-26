/* =========================================================
   features/sesion.ts — Lo que le pasa a una sesion mientras se
   entrena: arrancarla, marcar series, y cerrarla.

   Las vistas dibujan; esto cambia el estado. `readSetRow` y
   `updateStats` son las dos unicas cosas del proyecto que tocan
   el DOM sin pasar por un render completo, y por una razon: no
   se puede repintar la pantalla mientras el usuario tiene el
   teclado abierto sobre un input.
   ========================================================= */
import { e1rm, num } from "../lib/calc";
import { $, $$, uid } from "../lib/dom";
import { esc } from "../lib/dom";
import { fmt, today } from "../lib/format";
import { bestE1RM, entryOf, exName, routineById, sessionVolume } from "../state/selectors";
import { save, state } from "../state/store";
import { openSheet } from "../ui/sheet";
import { render, setView } from "../ui/shell";
import { toast } from "../ui/toast";
import { elapsed } from "../views/entrenar";
import { keepAwake, startTimer, stopTimer } from "./timer";

/** Cuanto tiene que superar al record anterior para contar como PR. */
const PR_MARGIN = 1.001;

export function startSession(routineId) {
  const r = routineById(routineId);
  if (!r) return;
  state.active = {
    id: uid(),
    routineId: r.id,
    name: r.name,
    date: today(),
    startedAt: Date.now(),
    notes: "",
    entries: r.items.map((it) => ({
      id: uid(),
      exerciseId: it.exerciseId,
      target: {
        sets: it.sets,
        repsMin: it.repsMin,
        repsMax: it.repsMax,
        rir: it.rir,
        rest: it.rest,
        ss: it.ss,
      },
      sets: Array.from({ length: it.sets }, () => ({ w: "", r: "", rir: "", done: false })),
    })),
  };
  save(true);
  setView("train");
  void keepAwake(true);
  render();
}
export function finishSession() {
  const s = state.active;
  if (!s) return;
  const r = sessionVolume(s);
  s.entries = s.entries.filter((e) => e.sets.some((x) => x.done));
  if (!s.entries.length) {
    if (!confirm("No marcaste ninguna serie. ¿Descartar la sesión?")) return;
    state.active = null;
    save(true);
    render();
    return;
  }
  s.endedAt = Date.now();
  s.dur = elapsed(s);
  const prs = [];
  s.entries.forEach((en) => {
    const best = bestE1RM(en.exerciseId, s.id);
    let cur = 0;
    en.sets.forEach((x) => {
      if (x.done) cur = Math.max(cur, e1rm(num(x.w) || 0, num(x.r) || 0));
    });
    if (best > 0 && cur > best * PR_MARGIN) prs.push(exName(en.exerciseId));
  });
  state.sessions.push(s);
  state.active = null;
  save(true);
  stopTimer();
  void keepAwake(false);
  render();
  if (window.Sync) Sync.schedule(800);
  openSheet(`<div class="h2">Sesión guardada</div>
    <div class="flex items-center gap-2 my-3 mx-0"><span class="chip">${r.sets} series</span><span class="chip">${fmt(Math.round(r.v))} kg movidos</span><span class="chip">${esc(s.dur)}</span></div>
    ${
      prs.length
        ? `<div class="eyebrow mt-2.5">Récords personales</div>${prs.map((p) => `<div class="cue"><b>★</b><span>${esc(p)}</span></div>`).join("")}`
        : `<div class="note">Sin récords hoy. La próxima vez, apuntá a una repetición más en al menos un ejercicio: eso es doble progresión.</div>`
    }
    <button class="btn w-full primary mt-3.5" data-act="closesheet">Listo</button>`);
}

export function readSetRow(row) {
  const en = entryOf(row.dataset.e),
    i = +row.dataset.i;
  if (!en) return null;
  const st = en.sets[i];
  $$("input", row).forEach((inp) => {
    let v = inp.value.trim();
    if (v === "" && inp.placeholder && /^[\d.,]+$/.test(inp.placeholder)) v = inp.placeholder;
    st[inp.dataset.f] = v;
  });
  return { en, st, i };
}
export function toggleSet(row) {
  const r = readSetRow(row);
  if (!r) return;
  const { en, st } = r;
  st.done = !st.done;
  if (st.done) {
    $$("input", row).forEach((inp) => {
      if (inp.value === "" && st[inp.dataset.f]) inp.value = st[inp.dataset.f];
    });
    const pbest = bestE1RM(en.exerciseId, state.active.id);
    const isPR = pbest > 0 && e1rm(num(st.w) || 0, num(st.r) || 0) > pbest * PR_MARGIN;
    row.classList.toggle("pr", isPR);
    $(".check", row).textContent = isPR ? "★" : "✓";
    if (isPR) toast("★ Récord en " + exName(en.exerciseId));
    if (state.settings.autoTimer) {
      const rest = (en.target && en.target.rest) || state.settings.rest;
      startTimer(rest, exName(en.exerciseId));
    }
  } else {
    row.classList.remove("pr");
    $(".check", row).textContent = "✓";
  }
  row.classList.toggle("done", st.done);
  save();
  updateStats();
}
export function updateStats() {
  const s = state.active;
  if (!s) return;
  const r = sessionVolume(s);
  const total = s.entries.reduce((a, e) => a + e.sets.length, 0);
  const bar = $("#app .card .between");
  if (!bar) return;
  const spans = $$("#app .card .between .mono");
  if (spans[0]) spans[0].textContent = r.sets + "/" + total;
  if (spans[1]) spans[1].textContent = fmt(Math.round(r.v)) + " kg";
  if (spans[2]) spans[2].textContent = elapsed(s);
}
