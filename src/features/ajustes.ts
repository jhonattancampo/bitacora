/* =========================================================
   features/ajustes.ts — Apariencia, preferencias de
   entrenamiento, la calculadora de discos, y los dos botones
   que tiran datos a la basura.
   ========================================================= */
import { num } from "../lib/calc";
import { $ } from "../lib/dom";
import { fmt } from "../lib/format";
import { checkForUpdate } from "../pwa";
import { save, seedState, setState, state } from "../state/store";
import { render } from "../ui/shell";
import { applyTheme } from "../ui/theme";
import { toast } from "../ui/toast";
import type { ActionMap } from "../events/types";

/** Los ajustes que son un interruptor de si/no. */
type BooleanSetting = "sound" | "vibrate" | "autoTimer" | "wake";

/** Los discos que hay en un gimnasio normal, del mas pesado al mas liviano. */
const PLATES = [25, 20, 15, 10, 5, 2.5, 1.25, 0.5];
/** Barra olimpica, cuando el campo esta vacio. */
const DEFAULT_BAR_KG = 20;
/** Margen para que 0,1 + 0,2 no deje "faltan 0.0000001 kg". */
const EPSILON = 1e-9;
/** Lo que espera antes de buscar la actualizacion, para que se vea el aviso. */
const UPDATE_DELAY_MS = 600;

export const settingsActions: ActionMap = {
  theme: ({ el }) => {
    state.settings.theme = el.dataset.v;
    save(true);
    applyTheme();
    render();
  },
  accent: ({ el }) => {
    state.settings.accent = el.dataset.v;
    save(true);
    applyTheme();
    render();
  },
  tog: ({ el }) => {
    /* Los interruptores son los cuatro booleanos de settings, y el boton
       trae cual en su data-k. */
    const k = el.dataset.k as BooleanSetting;
    state.settings[k] = !state.settings[k];
    save(true);
    render();
  },

  /* Reparte el peso de a un disco por vez, del mas pesado al mas liviano.
     Escribe el resultado directo en el DOM y no repinta: la pantalla tiene
     dos inputs con lo que el usuario acaba de escribir. */
  plate: () => {
    const total = num($("#plateW").value),
      bar = num($("#plateBar").value) || DEFAULT_BAR_KG;
    if (total == null) {
      $("#plateOut").textContent = "Poné el peso total.";
      return;
    }
    state.settings.bar = bar;
    save();
    let per = (total - bar) / 2;
    if (per < 0) {
      $("#plateOut").textContent = "Menos que la barra sola.";
      return;
    }
    const out: string[] = [];
    PLATES.forEach((p) => {
      const n = Math.floor((per + EPSILON) / p);
      if (n > 0) {
        out.push(n + "×" + fmt(p));
        per = Math.round((per - n * p) * 100) / 100;
      }
    });
    $("#plateOut").textContent =
      (out.length ? "Por lado: " + out.join(" + ") : "Solo la barra") +
      (per > 0.01 ? "  (faltan " + fmt(per) + " kg)" : "");
  },

  update: () => {
    toast("Actualizando…");
    setTimeout(() => {
      void checkForUpdate();
    }, UPDATE_DELAY_MS);
  },

  /* Restaurar toca ejercicios y rutinas y nada mas: el historial y las
     pesadas son del usuario, no del plan. */
  reset: () => {
    if (
      !confirm(
        "Vuelve a las rutinas y ejercicios originales del plan. El historial y las pesadas se conservan.",
      )
    )
      return;
    const seed = seedState();
    state.exercises = seed.exercises;
    state.routines = seed.routines;
    save(true);
    render();
    toast("Plan restaurado");
  },

  wipe: () => {
    if (!confirm("Borra TODO: historial, rutinas, pesadas. ¿Seguro?")) return;
    setState(seedState());
    save(true);
    render();
    toast("Todo borrado");
  },
};
