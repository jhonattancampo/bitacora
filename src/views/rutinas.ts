/* =========================================================
   views/rutinas.ts — The routine list and its editor.

   A routine is the template: which exercises, how many sets,
   what rep range, how long to rest. Nothing here is a workout
   yet — that starts on Entrenar.
   ========================================================= */
import { esc } from "../lib/dom";
import { exName, routineById } from "../state/selectors";
import { state } from "../state/store";
import { header } from "../ui/chrome";
import { openSheet } from "../ui/sheet";
import { exOptions } from "./ejercicios";

export function viewRoutines() {
  const list = state.routines
    .map(
      (r) => `<div class="card">
    <div class="between">
      <div class="flex-1 min-w-0 cursor-pointer" data-act="r-edit" data-id="${r.id}">
        <div class="h2">${esc(r.name)}</div>
        <div class="text-small text-dim">${esc(r.subtitle || "")}</div>
      </div>
      <button class="btn sm" data-act="r-edit" data-id="${r.id}">Editar</button>
    </div>
    <hr class="border-t border-line my-3">
    ${r.items
      .map(
        (it, i) => `<div class="flex items-center gap-2.5 text-tiny py-[3px] px-0">
      <span class="mono text-dim w-5">${it.ss ? it.ss : i + 1}</span>
      <span class="flex-1 min-w-0 truncate">${esc(exName(it.exerciseId))}</span>
      <span class="mono text-dim">${it.sets}×${it.repsMin}-${it.repsMax}</span></div>`,
      )
      .join("")}
    <div class="flex items-center mt-2.5 gap-2">
      <button class="btn sm ghost" data-act="r-dup" data-id="${r.id}">Duplicar</button>
      <button class="btn sm ghost danger" data-act="r-del" data-id="${r.id}">Borrar</button>
      <div class="flex-1 min-w-0"></div>
      <button class="btn sm primary" data-act="start" data-id="${r.id}">Empezar</button>
    </div>
  </div>`,
    )
    .join("");
  return (
    header(
      "Tus sesiones",
      "Rutinas",
      `<button class="btn sm primary" data-act="r-new">+ Nueva</button>`,
    ) +
    `<div class="wrap">${list || '<div class="empty">Todavía no hay rutinas. Creá la primera.</div>'}
    <div class="card bg-transparent border-dashed mb-7"><div class="text-small text-dim">Mantené los mismos ejercicios 6-10 semanas. Cambiar todo cada semana hace imposible medir el progreso.</div></div></div>`
  );
}
export function sheetRoutine(id: string | null): void {
  /* Sin id es una rutina nueva: un molde vacio que todavia no esta en el
     estado. Con id, sale de la lista de rutinas que se acaba de dibujar. */
  const r = (id ? routineById(id) : { id: "", name: "", subtitle: "", items: [] })!;
  const opts = exOptions();
  const items = r.items
    .map(
      (it, i) => `<div class="card p-[11px]" data-ri="${i}">
    <div class="flex items-center gap-[7px]">
      <span class="mono text-dim text-tiny w-4">${i + 1}</span>
      <select class="flex-1 min-w-0" data-k="exerciseId">${opts(it.exerciseId)}</select>
      <button class="btn icon sm" data-act="ri-up" data-i="${i}">↑</button>
      <button class="btn icon sm" data-act="ri-down" data-i="${i}">↓</button>
      <button class="btn icon sm" data-act="ri-replace" data-i="${i}" title="Reemplazar ejercicio">⇄</button>
      <button class="btn icon sm danger" data-act="ri-del" data-i="${i}">✕</button>
    </div>
    <div class="grid grid-cols-3 gap-2.5 mt-2">
      <label class="f m-0"><span class="eyebrow">Series</span><input type="text" inputmode="numeric" data-k="sets" value="${it.sets}"></label>
      <label class="f m-0"><span class="eyebrow">Reps mín</span><input type="text" inputmode="numeric" data-k="repsMin" value="${it.repsMin}"></label>
      <label class="f m-0"><span class="eyebrow">Reps máx</span><input type="text" inputmode="numeric" data-k="repsMax" value="${it.repsMax}"></label>
    </div>
    <div class="grid grid-cols-3 gap-2.5 mt-2">
      <label class="f m-0"><span class="eyebrow">RIR</span><input type="text" data-k="rir" value="${esc(it.rir)}"></label>
      <label class="f m-0"><span class="eyebrow">Descanso s</span><input type="text" inputmode="numeric" data-k="rest" value="${it.rest}"></label>
      <label class="f m-0"><span class="eyebrow">Superserie</span><input type="text" data-k="ss" value="${esc(it.ss || "")}" placeholder="A, B…"></label>
    </div>
  </div>`,
    )
    .join("");
  openSheet(`<div class="between"><div class="h2">${id ? "Editar rutina" : "Nueva rutina"}</div><button class="btn sm ghost" data-act="closesheet">Cerrar</button></div>
    <div id="rform" data-id="${esc(r.id)}">
    <label class="f"><span class="eyebrow">Nombre</span><input type="text" data-k="name" value="${esc(r.name)}" placeholder="F · Full body"></label>
    <label class="f"><span class="eyebrow">Subtítulo</span><input type="text" data-k="subtitle" value="${esc(r.subtitle || "")}" placeholder="Músculos que cubre"></label>
    <div class="eyebrow mt-4 mx-0 mb-1.5">Ejercicios</div>
    <div id="ritems">${items || '<div class="empty text-small">Sin ejercicios todavía.</div>'}</div>
    <div class="grid grid-cols-2 gap-2.5 mt-2">
      <button class="btn" data-act="ri-add">+ De mi biblioteca</button>
      <button class="btn" data-act="ri-add-db">🔎 Buscar más (873)</button>
    </div>
    <button class="btn w-full primary mt-3.5" data-act="r-save">Guardar rutina</button>
    </div>`);
}
