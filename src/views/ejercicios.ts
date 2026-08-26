/* =========================================================
   views/ejercicios.ts — The exercise library: the list, the
   execution guide, and the editor.

   `exOptions` lives here too. It builds the grouped `<select>`
   of exercises, and both the routine editor and Progreso ask
   for it — it is the exercise picker, so it belongs with the
   exercises.
   ========================================================= */
import { GROUPS } from "../lib/calc";
import { esc } from "../lib/dom";
import { dnice, fmt } from "../lib/format";
import { exById, exerciseHistory } from "../state/selectors";
import { state } from "../state/store";
import { header } from "../ui/chrome";
import { openSheet } from "../ui/sheet";

export function exOptions() {
  const byG = {};
  state.exercises.forEach((e) => {
    (byG[e.group] = byG[e.group] || []).push(e);
  });
  return (sel) =>
    Object.keys(byG)
      .sort()
      .map(
        (g) =>
          `<optgroup label="${esc(g)}">` +
          byG[g]
            .map(
              (e) =>
                `<option value="${e.id}" ${e.id === sel ? "selected" : ""}>${esc(e.name)}</option>`,
            )
            .join("") +
          `</optgroup>`,
      )
      .join("");
}

export function viewExercises() {
  const q = (state.ui.exq || "").toLowerCase();
  const list = state.exercises.filter(
    (e) => !q || e.name.toLowerCase().includes(q) || e.group.toLowerCase().includes(q),
  );
  const byG = {};
  list.forEach((e) => {
    (byG[e.group] = byG[e.group] || []).push(e);
  });
  const blocks = Object.keys(byG)
    .sort()
    .map(
      (g) => `<div class="eyebrow mt-[18px] mx-0 mb-0.5">${esc(g)} · ${byG[g].length}</div>
    <div class="card">${byG[g]
      .map(
        (e) => `<div class="li">
      <div class="flex-1 min-w-0 cursor-pointer" data-act="guide" data-id="${e.id}">
        <div class="h3 truncate">${esc(e.name)}</div>
        <div class="text-tiny text-dim">${e.cues.length} pasos${e.custom ? " · propio" : ""}</div>
      </div>
      <button class="btn icon sm ghost" data-act="x-replace-db" data-id="${e.id}" title="Reemplazar por otro de la base pública">⇄</button>
      <button class="btn sm ghost" data-act="x-edit" data-id="${e.id}">Editar</button>
    </div>`,
      )
      .join("")}</div>`,
    )
    .join("");
  return (
    header(
      "Biblioteca",
      "Ejercicios",
      `<button class="btn sm primary" data-act="x-new">+ Nuevo</button>`,
    ) +
    `<div class="wrap">
    <input class="mt-1.5" type="text" placeholder="Buscar ejercicio o músculo…" value="${esc(state.ui.exq || "")}" data-act="exq">
    <button class="btn w-full ghost mt-2.5" data-act="x-search-db-lib">🔎 Explorar más ejercicios (873, con fotos)</button>
    ${blocks || '<div class="empty">Nada con ese nombre.</div>'}
    <div class="h-6"></div></div>`
  );
}
export function sheetGuide(id) {
  const e = exById(id);
  if (!e) return;
  const hist = exerciseHistory(id).slice(0, 5);
  const photos =
    e.images && e.images.length
      ? `<div class="flex items-center gap-2 mt-3 overflow-x-auto" data-photos='${esc(JSON.stringify(e.images))}'>
    ${e.images.map((u, i) => `<img class="h-[150px] rounded-ctl border border-line flex-none cursor-zoom-in" src="${esc(u)}" loading="lazy" data-act="photo" data-idx="${i}" onerror="this.style.display='none'">`).join("")}
    </div>${e.photoNote ? `<div class="warn mt-2">${esc(e.photoNote)}</div>` : ""}
    <div class="text-tiny text-dim mt-[5px]">Fotos: Free Exercise DB (dominio público)</div>`
      : "";
  openSheet(`<div class="between"><div class="flex-1 min-w-0"><div class="eyebrow">${esc(e.group)}</div><div class="h2">${esc(e.name)}</div></div>
    <button class="btn sm ghost" data-act="closesheet">Cerrar</button></div>
    ${photos}
    ${e.tip ? `<div class="note mt-3">${esc(e.tip)}</div>` : ""}
    <div class="eyebrow mt-4 mx-0 mb-1">Ejecución</div>
    ${e.cues.map((c, i) => `<div class="cue"><b>${i + 1}</b><span>${esc(c)}</span></div>`).join("")}
    ${e.err ? `<div class="eyebrow mt-3.5 mx-0 mb-1">Error común</div><div class="warn">${esc(e.err)}</div>` : ""}
    ${
      hist.length
        ? `<div class="eyebrow mt-4 mx-0 mb-1">Últimas sesiones</div>
      <table class="t"><tr><th>Fecha</th><th>Mejor serie</th><th class="n">1RM est.</th></tr>
      ${hist.map((h) => `<tr><td>${dnice(h.date)}</td><td>${fmt(h.bw)}×${h.br}</td><td class="n">${fmt(Math.round(h.e))}</td></tr>`).join("")}</table>`
        : ""
    }
    <button class="btn w-full mt-4" data-act="x-edit" data-id="${e.id}">Editar este ejercicio</button>`);
}
export function sheetExercise(id, prefill?) {
  const base = id
    ? exById(id)
    : { id: "", name: "", group: "Pecho", cues: [], err: "", tip: "", images: [] };
  const e = prefill ? Object.assign({}, base, prefill, { id: base.id }) : base;
  const photos =
    e.images && e.images.length
      ? `<div class="flex items-center gap-2 my-2 mx-0 overflow-x-auto" data-photos='${esc(JSON.stringify(e.images))}'>
    ${e.images.map((u, i) => `<img class="h-20 rounded-lg border border-line flex-none cursor-zoom-in" src="${esc(u)}" loading="lazy" data-act="photo" data-idx="${i}" onerror="this.style.display='none'">`).join("")}
    </div>`
      : "";
  openSheet(`<div class="between"><div class="h2">${id ? "Editar ejercicio" : "Nuevo ejercicio"}</div><button class="btn sm ghost" data-act="closesheet">Cerrar</button></div>
    ${id ? `<button class="btn w-full ghost mt-1" data-act="x-replace-db" data-id="${esc(e.id)}">Reemplazar por otro de la base pública</button>` : '<button class="btn w-full ghost mt-1" data-act="x-search-db">Buscar en la base pública (con fotos)</button>'}
    <div id="xform" data-id="${esc(e.id)}" data-images='${esc(JSON.stringify(e.images || []))}'>
    ${photos}
    <label class="f"><span class="eyebrow">Nombre</span><input type="text" data-k="name" value="${esc(e.name)}"></label>
    <label class="f"><span class="eyebrow">Grupo muscular</span><select data-k="group">${GROUPS.map((g) => `<option ${g === e.group ? "selected" : ""}>${g}</option>`).join("")}</select></label>
    <label class="f"><span class="eyebrow">Pasos de ejecución (uno por línea)</span><textarea class="min-h-[130px]" data-k="cues">${esc((e.cues || []).join("\n"))}</textarea></label>
    <label class="f"><span class="eyebrow">Error común</span><textarea class="min-h-[60px]" data-k="err">${esc(e.err || "")}</textarea></label>
    <label class="f"><span class="eyebrow">Nota / por qué está elegido</span><textarea class="min-h-[60px]" data-k="tip">${esc(e.tip || "")}</textarea></label>
    <button class="btn w-full primary mt-3.5" data-act="x-save">Guardar</button>
    ${id ? `<button class="btn w-full danger ghost mt-2" data-act="x-del" data-id="${e.id}">Borrar ejercicio</button>` : ""}
    </div>`);
}
