/* =========================================================
   views/entrenar.ts — The screen the app opens on.

   Two screens in one, which is why they share a file: with no
   session in progress it lists the routines to pick from, and
   with one it becomes the session itself. `viewTrain` decides.
   ========================================================= */
import { e1rm, num } from "../lib/calc";
import { esc } from "../lib/dom";
import { daysAgo, dlong, dnice, fmt } from "../lib/format";
import {
  bestE1RM,
  doneSessions,
  exById,
  lastPerf,
  sessionVolume,
  weeklySets,
} from "../state/selectors";
import { state } from "../state/store";
import { header, storageWarn } from "../ui/chrome";

export function viewTrain() {
  if (state.active) return viewSession();
  const rs = state.routines
    .map((r) => {
      const last = doneSessions().find((s) => s.routineId === r.id);
      const ago = last
        ? daysAgo(last.date) === 0
          ? "hoy"
          : daysAgo(last.date) === 1
            ? "ayer"
            : "hace " + daysAgo(last.date) + " días"
        : "nunca";
      return `<div class="card cursor-pointer" data-act="start" data-id="${r.id}">
      <div class="between"><div class="flex-1 min-w-0">
        <div class="h2">${esc(r.name)}</div>
        <div class="text-small text-dim truncate">${esc(r.subtitle || "")}</div>
        <div class="flex items-center mt-2 gap-1.5 flex-wrap">
          <span class="chip">${r.items.length} ejercicios</span>
          <span class="chip">${r.items.reduce((a, i) => a + i.sets, 0)} series</span>
          <span class="chip">${esc(ago)}</span>
        </div></div>
        <div class="btn primary sm">Empezar</div></div></div>`;
    })
    .join("");
  const w = weeklySets(7);
  const totalSets = Object.values(w).reduce((a, b) => a + b, 0);
  const last7 = state.sessions.filter(
    (s) => s.endedAt && s.date >= new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10),
  ).length;
  return (
    header(
      "Bitácora",
      "Entrenar",
      `<button class="btn sm ghost" data-act="quick">Sesión libre</button>`,
    ) +
    storageWarn() +
    `<div class="wrap">
    <div class="card bg-p2">
      <div class="flex items-center gap-4">
        <div><div class="eyebrow">Últimos 7 días</div><div class="mono text-h1 font-extrabold">${last7}<span class="text-dim text-ui"> sesiones</span></div></div>
        <div><div class="eyebrow">Series hechas</div><div class="mono text-h1 font-extrabold">${totalSets}</div></div>
      </div>
    </div>
    <div class="eyebrow mt-[18px] mx-0 mb-1">Elegí la sesión de hoy</div>
    ${rs}
    <div class="card bg-transparent border-dashed"><div class="text-small text-dim">Regla del plan: no hagas dos días de pierna seguidos y respetá al menos 1 día de descanso cada 3 sesiones.</div></div>
  </div>`
  );
}

function viewSession() {
  const s = state.active;
  const { v, sets } = sessionVolume(s);
  const total = s.entries.reduce((a, e) => a + e.sets.length, 0);
  const body = s.entries.map((en, idx) => entryCard(en, idx, s)).join("");
  return (
    header(
      "En curso · " + dlong(s.date),
      s.name,
      `<button class="btn sm" data-act="finish">Terminar</button>`,
    ) +
    storageWarn() +
    `<div class="wrap">
    <div class="card bg-p2 py-[11px] px-3.5">
      <div class="between">
        <div><span class="eyebrow">Series</span> <span class="mono font-extrabold">${sets}/${total}</span></div>
        <div><span class="eyebrow">Volumen</span> <span class="mono font-extrabold">${fmt(Math.round(v))} kg</span></div>
        <div><span class="eyebrow">Tiempo</span> <span class="mono font-extrabold" id="elapsed">${elapsed(s)}</span></div>
      </div>
    </div>
    ${body}
    <button class="btn w-full mt-3" data-act="add-ex">+ Agregar ejercicio a esta sesión</button>
    <label class="f"><span class="eyebrow">Notas de la sesión</span>
      <textarea data-act="s-note" placeholder="Cómo te sentiste, molestias, qué ajustar la próxima…">${esc(s.notes || "")}</textarea></label>
    <div class="grid grid-cols-2 gap-2.5 mt-3 mx-0 mb-7">
      <button class="btn danger" data-act="discard">Descartar</button>
      <button class="btn primary" data-act="finish">Terminar sesión</button>
    </div>
  </div>`
  );
}
export function elapsed(s) {
  const ms = Date.now() - (s.startedAt || Date.now());
  const m = Math.floor(ms / 60000);
  return (m >= 60 ? Math.floor(m / 60) + "h " : "") + (m % 60) + "m";
}
function entryCard(en, idx, s) {
  const ex = exById(en.exerciseId);
  const t = en.target || {};
  const prev = lastPerf(en.exerciseId, s.id);
  const pbest = bestE1RM(en.exerciseId, s.id);
  const rows = en.sets
    .map((st, i) => {
      const p = prev && prev.sets[i];
      const isPR = st.done && pbest > 0 && e1rm(num(st.w) || 0, num(st.r) || 0) > pbest * 1.001;
      return `<div class="setgrid setrow ${st.done ? "done" : ""} ${isPR ? "pr" : ""}" data-e="${en.id}" data-i="${i}">
      <div class="setno">${i + 1}</div>
      <input type="text" inputmode="decimal" data-f="w" value="${st.w === "" ? "" : esc(st.w)}" placeholder="${p ? esc(p.w) : "kg"}">
      <input type="text" inputmode="numeric" data-f="r" value="${st.r === "" ? "" : esc(st.r)}" placeholder="${p ? esc(p.r) : "reps"}">
      <input type="text" inputmode="numeric" data-f="rir" value="${st.rir === "" ? "" : esc(st.rir)}" placeholder="RIR">
      <button class="check" data-act="check">${st.done ? (isPR ? "★" : "✓") : "✓"}</button>
    </div>`;
    })
    .join("");
  const prevTxt = prev
    ? `Última vez (${dnice(prev.date)}): ` +
      prev.sets.map((x) => `${fmt(num(x.w))}×${x.r}`).join(" · ")
    : "Sin registro previo — esta es tu línea de base.";
  return `<div class="card ${t.ss ? "ssgroup" : ""}">
    <div class="exhead">
      <div class="exnum ${t.ss ? "ss" : ""}">${t.ss ? t.ss : idx + 1}</div>
      <div class="flex-1 min-w-0 cursor-pointer" data-act="guide" data-id="${en.exerciseId}">
        <div class="h3">${esc(ex ? ex.name : "(borrado)")}</div>
        <div class="text-tiny text-dim">${esc(ex ? ex.group : "")} · objetivo ${t.repsMin || ""}-${t.repsMax || ""} reps · RIR ${esc(t.rir || "")} · ${t.rest || 90}s ${t.ss ? " · superserie " + t.ss : ""}</div>
      </div>
      <button class="btn icon sm" data-act="entry-menu" data-e="${en.id}">⋯</button>
    </div>
    <div class="setgrid"><div></div><div class="lbl">kg</div><div class="lbl">reps</div><div class="lbl">rir</div><div></div></div>
    ${rows}
    <div class="prevline">${esc(prevTxt)}</div>
    <div class="flex items-center mt-[9px] gap-2 flex-wrap">
      <button class="btn sm" data-act="addset" data-e="${en.id}">+ Serie</button>
      <button class="btn sm" data-act="delset" data-e="${en.id}">− Serie</button>
      <button class="btn sm ghost" data-act="rest" data-e="${en.id}">⏱ ${t.rest || 90}s</button>
      <button class="btn icon sm ghost" data-act="rest-edit" data-e="${en.id}" title="Cambiar el descanso de hoy">✎</button>
      <div class="flex-1 min-w-0"></div>
      <button class="btn sm ghost" data-act="guide" data-id="${en.exerciseId}">Cómo se hace</button>
    </div>
    ${en.note ? `<div class="note mt-[9px]">${esc(en.note)}</div>` : ""}
  </div>`;
}
