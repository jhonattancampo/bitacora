/* =========================================================
   features/progreso.ts — Las acciones de Progreso: cambiar de
   solapa, mirar o borrar una sesion del historial, repetirla,
   y anotar el peso corporal.
   ========================================================= */
import { num } from "../lib/calc";
import { $, uid } from "../lib/dom";
import { today } from "../lib/format";
import { save, state } from "../state/store";
import { closeSheet } from "../ui/sheet";
import { render, setView } from "../ui/shell";
import { toast } from "../ui/toast";
import { sheetSession } from "../views/progreso";
import type { ActionMap } from "../events/types";

export const progressActions: ActionMap = {
  /* La solapa elegida se guarda en el estado: al volver a Progreso, el
     usuario cae donde estaba. Sin `true`, porque no vale una escritura
     inmediata a disco. */
  ptab: ({ el }) => {
    state.ui.ptab = el.dataset.t;
    save();
    render();
  },

  "sess-view": ({ el }) => sheetSession(el.dataset.id),

  "sess-del": ({ el }) => {
    if (!confirm("¿Borrar esta sesión del historial?")) return;
    state.sessions = state.sessions.filter((x) => x.id !== el.dataset.id);
    save(true);
    closeSheet();
    render();
  },

  /* Repetir copia los objetivos y deja los numeros en blanco: es la misma
     sesion para volver a hacerla, no una copia de lo que se levanto. */
  "sess-repeat": ({ el }) => {
    /* El `!` es fiel al original: el boton solo existe dentro de la hoja de
       una sesion que ya se encontro, asi que si no esta es un bug de otro
       lado y conviene que se vea, no que el boton no haga nada en silencio. */
    const s = state.sessions.find((x) => x.id === el.dataset.id)!;
    state.active = {
      id: uid(),
      routineId: s.routineId,
      name: s.name,
      date: today(),
      startedAt: Date.now(),
      notes: "",
      entries: s.entries.map((en) => ({
        id: uid(),
        exerciseId: en.exerciseId,
        target: en.target,
        sets: en.sets.map(() => ({ w: "", r: "", rir: "", done: false })),
      })),
    };
    save(true);
    closeSheet();
    setView("train");
    render();
  },

  /* Una pesada por dia: anotar de nuevo pisa la de hoy en vez de sumar otra
     fila, porque el promedio semanal cuenta dias, no mediciones. */
  "bw-add": () => {
    const kg = num($("#bwkg").value);
    if (kg == null) {
      toast("Poné un número");
      return;
    }
    state.bw = state.bw.filter((x) => x.date !== today());
    state.bw.push({ date: today(), kg });
    save(true);
    render();
    toast("Pesada anotada");
  },

  "bw-del": ({ el }) => {
    state.bw = state.bw.filter((x) => x.date !== el.dataset.d);
    save(true);
    render();
  },
};
