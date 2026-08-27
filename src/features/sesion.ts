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
import { closeSheet, openSheet } from "../ui/sheet";
import { render, setView } from "../ui/shell";
import { toast } from "../ui/toast";
import { elapsed } from "../views/entrenar";
import { exOptions } from "../views/ejercicios";
import { sheetExDbSearch } from "./exdb";
import { keepAwake, startTimer, stopTimer } from "./timer";
import type { ActionMap } from "../events/types";

/** Cuanto tiene que superar al record anterior para contar como PR. */
const PR_MARGIN = 1.001;

/** Cual de los tres campos de una serie escribe un input, segun su `data-f`. */
type SetField = "w" | "r" | "rir";

/** Limites del descanso que se puede escribir a mano para la sesion de hoy. */
const MIN_REST_S = 5;
const MAX_REST_S = 900;

export function startSession(routineId: string): void {
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
  const prs: string[] = [];
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

export function readSetRow(row: any) {
  const en = entryOf(row.dataset.e),
    i = +row.dataset.i;
  if (!en) return null;
  const st = en.sets[i];
  /* Los tres inputs de la fila dicen en su `data-f` cual de los tres campos
     de la serie escriben: w, r o rir. */
  $$("input", row).forEach((inp) => {
    let v = inp.value.trim();
    /* Vacio con un placeholder numerico significa "lo mismo que la vez
       pasada": el gris que se ve es lo que se guarda. */
    if (v === "" && inp.placeholder && /^[\d.,]+$/.test(inp.placeholder)) v = inp.placeholder;
    st[inp.dataset.f as SetField] = v;
  });
  return { en, st, i };
}
export function toggleSet(row: any): void {
  const r = readSetRow(row);
  if (!r) return;
  const { en, st } = r;
  st.done = !st.done;
  if (st.done) {
    $$("input", row).forEach((inp) => {
      const f = inp.dataset.f as SetField;
      if (inp.value === "" && st[f]) inp.value = st[f];
    });
    const pbest = bestE1RM(en.exerciseId, state.active!.id);
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

export const sessionActions: ActionMap = {
  /* `check` es la unica accion que vive dentro de una fila de series. Si por
     algun motivo el click no viene de una fila, no hace nada: es lo mismo que
     hacia la cadena de `if`, donde `a==='check' && row` simplemente no
     entraba y ningun otro caso lo atendia. */
  check: ({ row }) => {
    if (row) toggleSet(row);
  },

  start: ({ el }) => {
    if (state.active && !confirm("Tenés una sesión sin terminar. ¿La descartás y empezás otra?"))
      return;
    startSession(el.dataset.id);
  },

  quick: () => {
    const name = prompt("Nombre de la sesión libre:", "Sesión libre");
    if (!name) return;
    state.active = {
      id: uid(),
      routineId: null,
      name,
      date: today(),
      startedAt: Date.now(),
      notes: "",
      entries: [],
    };
    save(true);
    render();
  },

  finish: () => finishSession(),

  discard: () => {
    if (!confirm("¿Descartar esta sesión sin guardar?")) return;
    state.active = null;
    stopTimer();
    save(true);
    render();
  },

  /* La serie nueva hereda el peso de la anterior y nada mas: el peso se
     repite entre series, las repeticiones no. */
  addset: ({ el }) => {
    const en = entryOf(el.dataset.e)!;
    const l = en.sets[en.sets.length - 1] || { w: "", r: "", rir: "" };
    en.sets.push({ w: l.w, r: "", rir: "", done: false });
    save(true);
    render();
  },

  delset: ({ el }) => {
    const en = entryOf(el.dataset.e)!;
    if (en.sets.length > 1) {
      en.sets.pop();
      save(true);
      render();
    }
  },

  rest: ({ el }) => {
    const en = entryOf(el.dataset.e)!;
    startTimer((en.target && en.target.rest) || state.settings.rest, exName(en.exerciseId));
  },

  /* Cambiar el descanso desde la sesion es solo para hoy: escribe en la entry,
     no en el item de la rutina. */
  "rest-edit": ({ el }) => {
    const en = entryOf(el.dataset.e);
    if (!en) return;
    const cur = (en.target && en.target.rest) || state.settings.rest;
    const v = prompt(
      'Descanso de "' + exName(en.exerciseId) + '" para esta sesión (segundos):',
      String(cur),
    );
    if (v === null) return;
    const n = parseInt(v, 10);
    if (!n || n < MIN_REST_S || n > MAX_REST_S) {
      toast("Poné un número entre " + MIN_REST_S + " y " + MAX_REST_S + " segundos");
      return;
    }
    en.target = en.target || {};
    en.target.rest = n;
    save(true);
    render();
    toast("Descanso " + n + "s — solo para hoy");
  },

  "add-ex": () => {
    openSheet(`<div class="h2">Agregar ejercicio</div>
      <label class="f"><span class="eyebrow">Ejercicio</span><select id="addExSel">${exOptions()("")}</select></label>
      <div class="grid grid-cols-3 gap-2.5"><label class="f"><span class="eyebrow">Series</span><input id="addExSets" type="text" inputmode="numeric" value="3"></label>
      <label class="f"><span class="eyebrow">Reps</span><input id="addExReps" type="text" value="8-12"></label>
      <label class="f"><span class="eyebrow">Descanso s</span><input id="addExRest" type="text" inputmode="numeric" value="90"></label></div>
      <button class="btn w-full primary mt-3.5" data-act="add-ex-ok">Agregar</button>`);
  },

  "add-ex-ok": () => {
    const id = $("#addExSel").value,
      n = parseInt($("#addExSets").value) || 3;
    const rr = ($("#addExReps").value || "8-12").split("-");
    state.active!.entries.push({
      id: uid(),
      exerciseId: id,
      target: {
        sets: n,
        repsMin: rr[0] || 8,
        repsMax: rr[1] || rr[0] || 12,
        rir: "1-2",
        rest: parseInt($("#addExRest").value) || 90,
        ss: "",
      },
      sets: Array.from({ length: n }, () => ({ w: "", r: "", rir: "", done: false })),
    });
    save(true);
    closeSheet();
    render();
  },

  "entry-menu": ({ el }) => {
    const id = el.dataset.e,
      en = entryOf(id)!;
    openSheet(`<div class="h2">${esc(exName(en.exerciseId))}</div>
      <label class="f"><span class="eyebrow">Nota para esta sesión</span><textarea id="enNote" placeholder="Ej: molestia en el hombro, bajé el peso">${esc(en.note || "")}</textarea></label>
      <button class="btn w-full primary mt-2.5" data-act="entry-note" data-e="${id}">Guardar nota</button>
      <button class="btn w-full ghost mt-2" data-act="guide" data-id="${en.exerciseId}">Ver ejecución</button>
      <button class="btn w-full ghost mt-2" data-act="entry-replace" data-e="${id}">Reemplazar ejercicio</button>
      <button class="btn w-full danger ghost mt-2" data-act="entry-del" data-e="${id}">Quitar de la sesión</button>`);
  },

  "entry-note": ({ el }) => {
    const en = entryOf(el.dataset.e)!;
    en.note = $("#enNote").value.trim();
    save(true);
    closeSheet();
    render();
  },

  /* Arranca el reemplazo: abre el buscador en modo 'session-item', que al
     elegir uno pregunta si el cambio es de hoy o para siempre. */
  "entry-replace": ({ el }) => sheetExDbSearch("session-item", el.dataset.e),

  "entry-del": ({ el }) => {
    state.active!.entries = state.active!.entries.filter((e) => e.id !== el.dataset.e);
    save(true);
    closeSheet();
    render();
  },
};
