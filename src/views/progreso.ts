/* =========================================================
   views/progreso.ts — Four ways of looking at the same history:
   one exercise over time, weekly volume per muscle group, the
   session log, and body weight.

   `lineChart` is the only shared piece: the estimated-1RM curve
   and the body-weight curve are the same SVG with different
   points.
   ========================================================= */
import { clamp, GROUPS, num } from "../lib/calc";
import { esc } from "../lib/dom";
import { dlong, dnice, fmt, today } from "../lib/format";
import { RANGES } from "../data/groups";
import {
  doneSessions,
  exerciseHistory,
  exName,
  sessionVolume,
  weeklySets,
} from "../state/selectors";
import { state } from "../state/store";
import { header } from "../ui/chrome";
import { openSheet } from "../ui/sheet";
import { exOptions } from "./ejercicios";

export function viewProgress() {
  const tab = state.ui.ptab || "ex";
  const tabs = `<div class="flex items-center gap-2 mt-2 mx-0 mb-0.5">
    ${[
      ["ex", "Ejercicio"],
      ["vol", "Volumen"],
      ["hist", "Historial"],
      ["bw", "Peso corporal"],
    ]
      .map(
        ([k, l]) =>
          `<button class="btn sm ${tab === k ? "primary" : "ghost"}" data-act="ptab" data-t="${k}">${l}</button>`,
      )
      .join("")}</div>`;
  let body = "";
  if (tab === "ex") body = progExercise();
  if (tab === "vol") body = progVolume();
  if (tab === "hist") body = progHistory();
  if (tab === "bw") body = progBW();
  return (
    header("Lo que se mide, mejora", "Progreso") +
    `<div class="wrap">${tabs}${body}<div class="h-7"></div></div>`
  );
}
function progExercise() {
  const id = state.ui.progressEx || state.exercises[0].id;
  const h = exerciseHistory(id);
  const opts = exOptions()(id);
  const chart =
    h.length > 1
      ? lineChart(h.map((x) => ({ x: x.date, y: x.e })))
      : '<div class="empty text-small">Registrá al menos dos sesiones con este ejercicio para ver la curva.</div>';
  const rows = h
    .slice()
    .reverse()
    .map(
      (x) =>
        `<tr><td>${dnice(x.date)}</td><td>${fmt(x.bw)}×${x.br}</td><td class="n">${fmt(Math.round(x.e))}</td><td class="n">${fmt(Math.round(x.vol))}</td></tr>`,
    )
    .join("");
  const first = h[0],
    last = h[h.length - 1];
  const delta = first && last && h.length > 1 ? ((last.e - first.e) / first.e) * 100 : null;
  return `<label class="f"><span class="eyebrow">Ejercicio</span><select data-act="pex">${opts}</select></label>
    <div class="card">
      <div class="between mb-1.5">
        <div><div class="eyebrow">1RM estimado</div><div class="mono text-[24px] font-extrabold">${last ? fmt(Math.round(last.e)) : "—"}<span class="text-dim text-small"> kg</span></div></div>
        ${delta != null ? `<div class="text-right"><div class="eyebrow">Desde el inicio</div><div class="mono text-[24px] font-extrabold ${delta >= 0 ? "text-ok" : "text-hot"}">${delta >= 0 ? "+" : ""}${fmt(Math.round(delta * 10) / 10)}%</div></div>` : ""}
      </div>
      ${chart}
    </div>
    ${h.length ? `<table class="t"><tr><th>Fecha</th><th>Mejor serie</th><th class="n">1RM est.</th><th class="n">Volumen</th></tr>${rows}</table>` : ""}`;
}
function lineChart(pts) {
  const W = 320,
    H = 120,
    pad = 10;
  const ys = pts.map((p) => p.y),
    mn = Math.min(...ys),
    mx = Math.max(...ys),
    span = mx - mn || 1;
  const X = (i) => pad + (i / (pts.length - 1)) * (W - pad * 2);
  const Y = (v) => H - pad - ((v - mn) / span) * (H - pad * 2 - 10);
  const d = pts
    .map((p, i) => (i ? "L" : "M") + X(i).toFixed(1) + " " + Y(p.y).toFixed(1))
    .join(" ");
  const area =
    d + ` L ${X(pts.length - 1).toFixed(1)} ${H - pad} L ${X(0).toFixed(1)} ${H - pad} Z`;
  return `<svg class="w-full h-auto block" viewBox="0 0 ${W} ${H}">
    <path d="${area}" fill="rgba(255,204,29,.10)"/>
    <path d="${d}" fill="none" stroke="#FFCC1D" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    ${pts.map((p, i) => `<circle cx="${X(i).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="2.6" fill="#0E1316" stroke="#FFCC1D" stroke-width="1.6"/>`).join("")}
    <text x="${pad}" y="11" fill="#5F6E75" font-size="9" font-family="monospace">${fmt(Math.round(mx))}</text>
    <text x="${pad}" y="${H - 1}" fill="#5F6E75" font-size="9" font-family="monospace">${fmt(Math.round(mn))}</text>
  </svg>`;
}
function progVolume() {
  const w = weeklySets(7);
  const rows = GROUPS.map((g) => {
    const n = w[g] || 0,
      [lo, hi] = RANGES[g],
      max = Math.max(hi * 1.35, n);
    const pct = clamp((n / max) * 100, 0, 100),
      lp = (lo / max) * 100,
      hp = (hi / max) * 100;
    const cls = n < lo ? "low" : n > hi ? "hi" : "";
    return `<div class="py-[9px] px-0 border-b border-line">
      <div class="between mb-[5px]">
        <div class="text-small font-bold">${esc(g)}</div>
        <div class="mono text-tiny ${n < lo ? "text-dim" : ""}">${n} <span class="text-dim">/ ${lo}-${hi}</span></div>
      </div>
      <div class="bar"><i class="${cls}" style="width:${pct}%"></i><span class="zone" style="left:${lp}%;width:${hp - lp}%"></span></div>
    </div>`;
  }).join("");
  const hist = weekBars();
  return `<div class="card"><div class="eyebrow">Series efectivas · últimos 7 días</div>
    <div class="text-tiny text-dim mt-0.5 mx-0 mb-2">Las líneas marcan el rango óptimo del plan. Solo cuentan las series que marcaste como hechas.</div>
    ${rows}</div>
    <div class="card"><div class="eyebrow">Volumen por semana (kg totales)</div>${hist}</div>`;
}
function weekBars() {
  const weeks = [];
  for (let i = 7; i >= 0; i--) {
    const end = new Date(Date.now() - i * 7 * 864e5),
      start = new Date(+end - 7 * 864e5);
    const a = start.toISOString().slice(0, 10),
      b = end.toISOString().slice(0, 10);
    let v = 0,
      n = 0;
    state.sessions
      .filter((s) => s.endedAt && s.date > a && s.date <= b)
      .forEach((s) => {
        const r = sessionVolume(s);
        v += r.v;
        n++;
      });
    weeks.push({ label: dnice(b), v, n });
  }
  const mx = Math.max(1, ...weeks.map((w) => w.v));
  if (mx <= 1) return '<div class="empty text-small">Sin sesiones registradas todavía.</div>';
  return `<div class="flex items-end gap-[5px] h-[110px] mt-2.5">
    ${weeks
      .map(
        (w) => `<div class="flex-1 min-w-0 text-center">
      <div class="rounded-t-[4px] min-h-[3px] ${w.v ? "bg-sig" : "bg-p3"}" style="height:${Math.round((w.v / mx) * 84)}px"></div>
      <div class="text-tiny text-dim mono mt-1">${w.label}</div></div>`,
      )
      .join("")}</div>
    <div class="text-tiny text-dim mt-1.5">Cada barra = una semana que termina en esa fecha.</div>`;
}
function progHistory() {
  const ss = doneSessions();
  if (!ss.length) return '<div class="empty">Todavía no terminaste ninguna sesión.</div>';
  return ss
    .map((s) => {
      const r = sessionVolume(s);
      return `<div class="card">
    <div class="between">
      <div class="flex-1 min-w-0 cursor-pointer" data-act="sess-view" data-id="${s.id}">
        <div class="h3">${esc(s.name)}</div>
        <div class="text-tiny text-dim">${dlong(s.date)} · ${r.sets} series · ${fmt(Math.round(r.v))} kg${s.dur ? " · " + s.dur : ""}</div>
      </div>
      <button class="btn sm ghost" data-act="sess-view" data-id="${s.id}">Ver</button>
    </div></div>`;
    })
    .join("");
}
export function sheetSession(id) {
  const s = state.sessions.find((x) => x.id === id);
  if (!s) return;
  const r = sessionVolume(s);
  openSheet(`<div class="between"><div class="flex-1 min-w-0"><div class="eyebrow">${dlong(s.date)}</div><div class="h2">${esc(s.name)}</div></div>
    <button class="btn sm ghost" data-act="closesheet">Cerrar</button></div>
    <div class="flex items-center gap-2 my-2.5 mx-0"><span class="chip">${r.sets} series</span><span class="chip">${fmt(Math.round(r.v))} kg</span>${s.dur ? `<span class="chip">${esc(s.dur)}</span>` : ""}</div>
    ${s.entries
      .map(
        (en) => `<div class="card p-[11px]">
      <div class="h3">${esc(exName(en.exerciseId))}</div>
      <div class="mono text-small text-dim mt-1">${
        en.sets
          .filter((x) => x.done)
          .map((x) => `${fmt(num(x.w))}×${x.r}${x.rir !== "" ? " (RIR " + x.rir + ")" : ""}`)
          .join(" · ") || "sin series"
      }</div>
    </div>`,
      )
      .join("")}
    ${s.notes ? `<div class="note">${esc(s.notes)}</div>` : ""}
    <button class="btn w-full ghost mt-3" data-act="sess-repeat" data-id="${s.id}">Repetir esta sesión</button>
    <button class="btn w-full danger ghost mt-2" data-act="sess-del" data-id="${s.id}">Borrar del historial</button>`);
}
function progBW() {
  const b = state.bw.slice().sort((a, c) => (a.date < c.date ? 1 : -1));
  const avg = (from, to) => {
    const sl = b.filter((x) => x.date > from && x.date <= to);
    return sl.length ? sl.reduce((a, c) => a + c.kg, 0) / sl.length : null;
  };
  const t = today(),
    w1 = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10),
    w2 = new Date(Date.now() - 14 * 864e5).toISOString().slice(0, 10);
  const a1 = avg(w1, t),
    a2 = avg(w2, w1);
  const diff = a1 != null && a2 != null ? a1 - a2 : null;
  const pct = diff != null && a2 ? (diff / a2) * 100 : null;
  let verdict = "Cargá 4-5 pesadas por semana, en ayunas, para tener un promedio confiable.";
  if (pct != null) {
    if (Math.abs(diff) <= 0.3)
      verdict = "Peso estable. Si la fuerza sube, estás en recomposición: no toques nada.";
    else if (pct < -0.7)
      verdict =
        "Estás bajando rápido (más de 0,7%). Sumá 150-200 kcal al día o vas a perder músculo.";
    else if (pct < 0)
      verdict =
        "Bajada suave. Sostenida está bien; si además la fuerza cae, subí un poco las calorías.";
    else if (pct > 0.5)
      verdict =
        "Subida marcada. Revisá aceites, bebidas y picoteos sin registrar; bajá 200-250 kcal.";
    else
      verdict =
        "Subida leve. Puede ser agua o sal: mirá la tendencia de otra semana antes de tocar calorías.";
  }
  const chart =
    b.length > 1
      ? lineChart(
          b
            .slice()
            .reverse()
            .map((x) => ({ x: x.date, y: x.kg })),
        )
      : "";
  return `<div class="card">
      <div class="flex items-center gap-2">
        <input class="flex-1" type="text" inputmode="decimal" id="bwkg" placeholder="kg de hoy">
        <button class="btn primary" data-act="bw-add">Anotar</button>
      </div>
      <div class="flex items-center gap-4 mt-3">
        <div><div class="eyebrow">Promedio 7 días</div><div class="mono text-[24px] font-extrabold">${a1 != null ? fmt(Math.round(a1 * 10) / 10) : "—"}</div></div>
        <div><div class="eyebrow">vs semana previa</div><div class="mono text-[24px] font-extrabold ${diff == null ? "text-dim" : Math.abs(diff) <= 0.3 ? "text-ok" : "text-sig"}">${diff != null ? (diff > 0 ? "+" : "") + fmt(Math.round(diff * 10) / 10) : "—"}</div></div>
      </div>
      ${chart}
      <div class="note mt-2.5">${esc(verdict)}</div>
    </div>
    ${b.length ? `<table class="t"><tr><th>Fecha</th><th class="n">kg</th><th></th></tr>${b.map((x) => `<tr><td>${dnice(x.date)}</td><td class="n">${fmt(x.kg)}</td><td class="n"><button class="btn sm ghost danger" data-act="bw-del" data-d="${x.date}">✕</button></td></tr>`).join("")}</table>` : '<div class="empty text-small">Sin pesadas cargadas.</div>'}`;
}
