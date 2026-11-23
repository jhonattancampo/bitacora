/* =========================================================
   features/comidas.ts — Las acciones de la pantalla de comidas.

   Es la capa que conecta los botones con los casos de uso. No
   calcula nada: arma las dependencias, llama, y deja el
   resultado donde la vista lo pueda leer.

   El modelo se consulta a traves del puerto y solo si hay un
   endpoint configurado. Sin endpoint el puerto se declara no
   disponible, la app resuelve con el catalogo y avisa que no
   pudo estimar; nada se cae ni se inventa.
   ========================================================= */

import { save, state } from "../state/store";
import { render } from "../ui/shell";
import { toast } from "../ui/toast";
import { today } from "../lib/format";
import type { ActionMap } from "../events/types";
import { createNutritionApi } from "../nutrition/api/contract";
import { createFetchLlm } from "../nutrition/adapters/llm-fetch";
import { FOODS } from "../nutrition/data/foods";
import { addItems, dayLogReader, planReader, removeItem } from "../nutrition/adapters/state-store";
import { clearDraft, getDraft, setDraft } from "../nutrition/adapters/draft";
import { errText, notice } from "../nutrition/app/notices";

const api = () =>
  createNutritionApi({
    catalog: FOODS,
    plan: planReader,
    dayLogs: dayLogReader,
    llm: createFetchLlm({ endpoint: state.settings.nutrition.llmEndpoint }),
  });

/**
 * Vuelve a dejar la comida a la vista despues de redibujar.
 *
 * render() manda el scroll arriba de todo, que es lo correcto al cambiar de
 * pantalla y molesto cuando lo unico que cambio es una tarjeta: tocar
 * "Calcular" en la cena te mandaba al principio, lejos del resultado.
 */
const volverA = (slotId: string): void => {
  document.querySelector(`[data-slot="${slotId}"]`)?.scrollIntoView({ block: "center" });
};

/** Lo que hay escrito en la caja de una comida, priorizando lo que se ve en pantalla. */
const textoDe = (slotId: string): string => {
  const caja = document.querySelector<HTMLTextAreaElement>(
    `textarea[data-act="meal-text"][data-e="${slotId}"]`,
  );
  return caja?.value ?? state.ui.mealText?.[slotId] ?? "";
};

export const mealActions: ActionMap = {
  "meal-parse": (ctx) => {
    const slotId = String(ctx.el.dataset.e || "");
    if (!slotId) return;
    const date = today();
    const text = textoDe(slotId);

    setDraft({ date, slotId, items: [], unresolved: [], notices: [], pending: true });
    render();
    volverA(slotId);

    api()
      .parseDayLog({ date, slotId, text })
      .then((r) => {
        setDraft({
          date,
          slotId,
          items: r.items,
          unresolved: r.unresolved,
          notices: r.notices,
          pending: false,
        });
        render();
        volverA(slotId);
      })
      .catch((e: unknown) => {
        // El caso de uso no tira, pero si alguna vez lo hiciera esto no puede
        // quedar como una propuesta cargando para siempre.
        setDraft({
          date,
          slotId,
          items: [],
          unresolved: [text],
          notices: [notice("llm-failed", `No se pudo calcular: ${errText(e)}.`)],
          pending: false,
        });
        render();
        volverA(slotId);
      });
  },

  "meal-save": () => {
    const d = getDraft();
    if (!d || d.items.length === 0) return;
    addItems(d.date, d.slotId, d.items);
    if (state.ui.mealText) delete state.ui.mealText[d.slotId];
    const slotId = d.slotId;
    clearDraft();
    save(true);
    render();
    volverA(slotId);
    toast(`Guardé ${d.items.length} ${d.items.length === 1 ? "ítem" : "ítems"}`);
  },

  "meal-discard": () => {
    const slotId = getDraft()?.slotId;
    clearDraft();
    render();
    if (slotId) volverA(slotId);
  },

  "meal-del": (ctx) => {
    const id = String(ctx.el.dataset.id || "");
    const slotId = String(ctx.el.dataset.e || "");
    const date = String(ctx.el.dataset.v || "");
    if (!id || !slotId || !date) return;
    removeItem(date, slotId, id);
    render();
    volverA(slotId);
  },
};

export const mealChangeActions: ActionMap = {
  "meal-text": (ctx) => {
    const slotId = String(ctx.el.dataset.e || "");
    if (!slotId) return;
    state.ui.mealText = state.ui.mealText || {};
    state.ui.mealText[slotId] = String(ctx.el.value ?? "");
    save();
  },
};
