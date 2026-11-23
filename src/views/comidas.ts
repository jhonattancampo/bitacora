/* =========================================================
   views/comidas.ts — Lo que se comió hoy, y lo que falta.

   La vista no decide nada: lee el estado, le pregunta al caso
   de uso cómo viene el día y arma el markup. Toda la cuenta —
   el reparto de lo que queda entre las comidas pendientes —
   vive en el dominio y está testeada ahí.

   Dos cosas que la vista SÍ tiene que hacer, porque son parte
   del contrato: marcar cuál es la próxima comida pendiente, y
   mostrar distinto un ítem del catálogo de uno estimado. Un
   número estimado que se ve igual que uno real es una mentira
   silenciosa.
   ========================================================= */

import { state } from "../state/store";
import { esc } from "../lib/dom";
import { today } from "../lib/format";
import { header, storageWarn } from "../ui/chrome";
import { getRemaining } from "../nutrition/app/get-remaining";
import { dayLogReader, planReader } from "../nutrition/adapters/state-store";
import { getDraft } from "../nutrition/adapters/draft";
import type { LoggedItem, Macros } from "../nutrition/domain/types";

const kcal = (n: number): string => String(Math.round(n));
const g = (n: number): string => String(Math.round(n * 10) / 10);

/** Cuándo un objetivo recalculado se corrió lo bastante como para avisar. */
const DESVIO_AVISO = 0.1;

const macroChips = (m: Macros): string =>
  `<span class="chip mono">${g(m.protein)} P</span>
   <span class="chip mono">${g(m.carbs)} C</span>
   <span class="chip mono">${g(m.fat)} G</span>`;

const itemRow = (date: string, slotId: string, it: LoggedItem): string => {
  const estimado = it.source === "estimated";
  const unidad = it.unit === "unit" ? (it.qty === 1 ? "unidad" : "unidades") : it.unit;
  return `<div class="between border-b border-line py-2">
    <div class="flex-1 min-w-0">
      <div class="text-small truncate">${esc(it.name)}</div>
      <div class="text-small text-dim mono">${g(it.qty)} ${esc(unidad)} · ${kcal(it.macros.kcal)} kcal · ${g(it.macros.protein)} P</div>
    </div>
    <span class="chip${estimado ? " border-dashed" : ""}">${estimado ? "estimado" : "catálogo"}</span>
    <button class="btn sm ghost" data-act="meal-del" data-id="${esc(it.id)}" data-e="${esc(slotId)}" data-v="${esc(date)}">Borrar</button>
  </div>`;
};

const draftCard = (): string => {
  const d = getDraft();
  if (!d) return "";

  const avisos = d.notices
    .map((n) => `<div class="text-small text-dim">${esc(n.message)}</div>`)
    .join("");

  if (d.pending) {
    return `<div class="card bg-p2"><div class="eyebrow">Calculando</div>
      <div class="text-small text-dim">Buscando en el catálogo y estimando lo que falte…</div></div>`;
  }

  const filas = d.items.map((it) => itemRowPreview(it)).join("");
  const total = d.items.reduce((a, it) => a + it.macros.kcal, 0);

  return `<div class="card bg-p2">
    <div class="between"><div class="eyebrow">Propuesta</div>
      <span class="chip mono">${kcal(total)} kcal</span></div>
    ${filas || `<div class="text-small text-dim">No se pudo calcular nada de lo que escribiste.</div>`}
    ${avisos}
    <div class="flex gap-2 mt-3">
      ${d.items.length > 0 ? `<button class="btn primary sm" data-act="meal-save">Guardar</button>` : ""}
      <button class="btn sm ghost" data-act="meal-discard">Descartar</button>
    </div>
  </div>`;
};

const itemRowPreview = (it: LoggedItem): string => {
  const estimado = it.source === "estimated";
  const unidad = it.unit === "unit" ? (it.qty === 1 ? "unidad" : "unidades") : it.unit;
  return `<div class="between border-b border-line py-2">
    <div class="flex-1 min-w-0">
      <div class="text-small truncate">${esc(it.name)}</div>
      <div class="text-small text-dim mono">${g(it.qty)} ${esc(unidad)} · ${kcal(it.macros.kcal)} kcal</div>
    </div>
    <span class="chip${estimado ? " border-dashed" : ""}">${estimado ? "estimado" : "catálogo"}</span>
  </div>`;
};

export function viewMeals(): string {
  const date = today();
  const plan = planReader.get(date);
  const r = getRemaining({ plan: planReader, dayLogs: dayLogReader }, { date });
  const log = dayLogReader.get(date);
  const draft = getDraft();

  if (r.notices.length > 0) {
    return (
      header("Bitácora", "Comidas") +
      storageWarn() +
      `<div class="wrap"><div class="card">
        <div class="text-small text-dim">${esc(r.notices[0].message)}</div>
      </div></div>`
    );
  }

  const faltan = r.pending.length;
  const cierre =
    faltan === 0
      ? "Día completo. No queda ninguna comida sin registrar."
      : `Te faltan ${kcal(r.remaining.kcal)} kcal y ${g(r.remaining.protein)} g de proteína en ${faltan} ${faltan === 1 ? "comida" : "comidas"}.`;

  const resumen = `<div class="card bg-p2">
    <div class="eyebrow">Hoy</div>
    <div class="between items-end">
      <div><span class="mono text-2xl">${kcal(r.consumed.kcal)}</span>
        <span class="text-small text-dim mono"> / ${kcal(plan?.daily.kcal ?? 0)} kcal</span></div>
      <div class="flex gap-1.5">${macroChips(r.consumed)}</div>
    </div>
    <div class="text-small text-dim mt-2">${esc(cierre)}</div>
  </div>`;

  const tarjetas = state.settings.nutrition.slots
    .map((slot) => {
      const objetivo = r.perSlot[slot.id];
      const registrado = log?.slots.find((s) => s.slotId === slot.id);
      const items = registrado?.items ?? [];
      const esProxima = r.nextSlotId === slot.id;
      const desvio = r.deviation[slot.id];
      const corrido = desvio && Math.abs(desvio.kcal) >= DESVIO_AVISO;

      const toca = items.length
        ? ""
        : `<div class="text-small mt-1">Te toca ${g(objetivo.protein)} g de proteína, ${kcal(objetivo.kcal)} kcal, ${g(objetivo.carbs)} g de carbos.</div>`;

      const aviso = corrido
        ? `<div class="text-small text-dim mt-1">Se corrió ${desvio.kcal > 0 ? "+" : ""}${Math.round(desvio.kcal * 100)}% respecto del plan, por lo que ya comiste hoy.</div>`
        : "";

      const caja =
        draft && draft.slotId === slot.id
          ? ""
          : `<div class="mt-3">
            <textarea class="w-full" rows="2" data-act="meal-text" data-e="${esc(slot.id)}"
              placeholder="150 g de pollo, una taza de arroz integral">${esc(state.ui.mealText?.[slot.id] ?? "")}</textarea>
            <button class="btn primary sm mt-2" data-act="meal-parse" data-e="${esc(slot.id)}">Calcular</button>
          </div>`;

      return `<div class="card" data-slot="${esc(slot.id)}">
        <div class="between">
          <div class="h2">${esc(slot.name)}</div>
          ${esProxima ? `<span class="chip">próxima</span>` : ""}
        </div>
        ${toca}
        ${aviso}
        ${items.map((it) => itemRow(date, slot.id, it)).join("")}
        ${caja}
        ${draft && draft.slotId === slot.id ? draftCard() : ""}
      </div>`;
    })
    .join("");

  return (
    header("Bitácora", "Comidas") + storageWarn() + `<div class="wrap">${resumen}${tarjetas}</div>`
  );
}
