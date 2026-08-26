import { readFileSync, existsSync } from 'node:fs';
const DIR = process.argv[2];
const VIEWS = process.argv[3] ? [process.argv[3]] : ['sesion','routines','exercises','progress','settings','sheet','tour'];
const verbose = process.argv.includes('-v');


// ------------------------------------------------------------------
// Clasificacion del ruido del preflight de Tailwind.
// Nada se oculta: lo filtrado se cuenta y se puede ver con --ruido.
// Cada regla es una afirmacion sobre por que ese cambio NO se ve.
// ------------------------------------------------------------------
const SIDE = { Top: 'borderTopWidth', Right: 'borderRightWidth', Bottom: 'borderBottomWidth', Left: 'borderLeftWidth' };
const BENIGN = [
  // preflight declara `border: 0 solid` en todo: normaliza el estilo, no el ancho
  ['borde de ancho 0 que cambia de estilo', (path, k, a, b, pa) => {
    const m = /^border(Top|Right|Bottom|Left)Style$/.exec(k);
    return !!m && b === 'solid' && pa[SIDE[m[1]]] === '0px';
  }],
  // color de un borde que no tiene ancho: no se dibuja
  ['color de borde sin ancho', (path, k, a, b, pa) => {
    const m = /^border(Top|Right|Bottom|Left)Color$/.exec(k);
    return !!m && pa[SIDE[m[1]]] === '0px';
  }],
  // outline-color sin outline-width: no se dibuja
  ['outline-color sin ancho', (path, k, a, b, pa) => k === 'outlineColor' && pa.outlineWidth === '0px'],
  // <hr>: preflight le pone color:inherit. Solo tiene borde superior; el color
  // del elemento no pinta nada.
  ['color de <hr> (y su outline-color derivado)', (path, k) =>
    /hr$/.test(path) && (k === 'color' || k === 'outlineColor')],
  // <img>/<svg>: preflight los pasa a vertical-align:middle. En esta app viven
  // dentro de contenedores flex, donde vertical-align no aplica.
  ['vertical-align de img/svg en contexto flex', (path, k, a, b) =>
    /(svg|img)$/.test(path) && k === 'verticalAlign' && a === 'baseline' && b === 'middle'],
  // <option>/<optgroup>: se dibujan en el desplegable nativo del sistema, que
  // ignora casi todo el CSS de la pagina.
  ['padding de option/optgroup (desplegable nativo)', (path, k) =>
    /(option|optgroup)$/.test(path) && /^padding/.test(k)],
];

const showNoise = process.argv.includes('--ruido');
// Cambios BUSCADOS de esta fase. Se listan aparte para que una regresion nueva
// no quede escondida entre ellos.
const INTENDED = [
  ['campo del PIN, ahora estilado como el resto de la app', (path) => /^#lock\[\d+\]input$/.test(path)],
  ['grid-cols de Tailwind usa minmax(0,1fr) en vez de 1fr', (path, k, a, b) =>
    k === 'gridTemplateColumns' && /^1fr( 1fr)+$/.test(a || '') && /^repeat\(\d+, minmax\(0px, 1fr\)\)$/.test(b || '')],
];
const intendedTally = new Map();
const noiseTally = new Map();
let grand = 0;
for (const view of VIEWS) {
  const fa = `${DIR}/base.${view}.dom.json`, fb = `${DIR}/now.${view}.dom.json`;
  if (!existsSync(fa) || !existsSync(fb)) { console.log(`· ${view}: falta captura`); continue; }
  const A = JSON.parse(readFileSync(fa, 'utf8')), B = JSON.parse(readFileSync(fb, 'utf8'));
  const byProp = new Map();      // "path · prop: antes -> despues" -> combos
  let structural = null;
  for (const combo of Object.keys(A)) {
    const a = A[combo].split('\n'), b = (B[combo] || '').split('\n');
    if (a.length !== b.length) { structural = `${combo}: ${a.length} nodos -> ${b.length}`; continue; }
    for (let i = 0; i < a.length; i++) {
      if (a[i] === b[i]) continue;
      const path = a[i].slice(0, a[i].indexOf('{'));
      const pa = Object.fromEntries(a[i].slice(a[i].indexOf('{') + 1, -1).split(';').map(x => { const j = x.indexOf(':'); return [x.slice(0, j), x.slice(j + 1)]; }));
      const pb = Object.fromEntries(b[i].slice(b[i].indexOf('{') + 1, -1).split(';').map(x => { const j = x.indexOf(':'); return [x.slice(0, j), x.slice(j + 1)]; }));
      for (const k of new Set([...Object.keys(pa), ...Object.keys(pb)])) {
        if (pa[k] === pb[k]) continue;
        const want = INTENDED.find(([, f]) => f(path, k, pa[k] ?? "", pb[k] ?? ""));
        if (want) { intendedTally.set(want[0], (intendedTally.get(want[0]) || 0) + 1); continue; }
        const rule = BENIGN.find(([, f]) => f(path, k, pa[k] ?? '', pb[k] ?? '', pa, pb));
        if (rule && !showNoise) { noiseTally.set(rule[0], (noiseTally.get(rule[0]) || 0) + 1); continue; }
        const key = `${path} · ${k}: ${pa[k]}  ->  ${pb[k]}`;
        if (!byProp.has(key)) byProp.set(key, new Set());
        byProp.get(key).add(combo);
      }
    }
  }
  if (structural) { console.log(`✗ ${view}: CAMBIO ESTRUCTURAL — ${structural}`); grand++; continue; }
  if (!byProp.size) { console.log(`✓ ${view}`); continue; }
  // agrupar por (prop, antes, despues) para no listar 40 nodos iguales
  const kinds = new Map();
  for (const [key, combos] of byProp) {
    const [path, rest] = [key.slice(0, key.indexOf(' · ')), key.slice(key.indexOf(' · ') + 3)];
    if (!kinds.has(rest)) kinds.set(rest, { nodes: new Set(), combos: new Set() });
    kinds.get(rest).nodes.add(path);
    for (const c of combos) kinds.get(rest).combos.add(c);
  }
  grand += kinds.size;
  console.log(`✗ ${view} — ${kinds.size} tipo/s de cambio, ${byProp.size} nodo·prop`);
  for (const [rest, { nodes, combos }] of [...kinds].sort((x, y) => y[1].nodes.size - x[1].nodes.size)) {
    console.log(`   [${nodes.size} nodo/s, ${combos.size}/12 combos] ${rest}`);
    if (verbose) for (const n of [...nodes].slice(0, 6)) console.log(`       ${n}`);
  }
}
if (intendedTally.size) { console.log('\ncambios buscados de esta fase:'); for (const [k, n] of intendedTally) console.log(`  ${String(n).padStart(6)} · ${k}`); }
if (noiseTally.size) { console.log('\nruido del preflight, filtrado (usar --ruido para verlo):'); for (const [k, n] of [...noiseTally].sort((a,b)=>b[1]-a[1])) console.log(`  ${String(n).padStart(6)} · ${k}`); }
console.log(grand === 0 ? '\n✅ IDENTICO: todas las vistas, las 12 combinaciones' : `\n${grand} tipo/s de cambio en total`);
