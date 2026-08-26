// Arma la escena con las MISMAS acciones en las dos ramas, en vez de restaurar
// un estado guardado: el save() de la app tiene un debounce que pisa cualquier
// escritura directa a localStorage justo antes de recargar.
(async () => {
  const TAG = window.SNAP;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  const nav = (v) => $(`[data-act="nav"][data-v="${v}"]`).click();
  window.confirm = () => true;

  // --- escena: una sesion en curso con dos series marcadas ---
  if (window.App.getState().active) { $('[data-act="discard"]')?.click(); await wait(80); }
  nav('train'); await wait(60);
  $$('[data-act="start"]')[0].click(); await wait(80);
  const fill = (row, w, r, rir) => {
    for (const [f, v] of [['w', w], ['r', r], ['rir', rir]]) {
      const el = row.querySelector(`[data-f="${f}"]`);
      el.value = v; el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
  };
  let rows = $$('.setrow');
  fill(rows[0], '60', '10', '2'); $('[data-act="check"]', rows[0]).click(); await wait(60);
  rows = $$('.setrow');
  fill(rows[1], '65', '9', '1'); $('[data-act="check"]', rows[1]).click(); await wait(60);
  $('[data-act="t-skip"]')?.click(); await wait(60);   // cortar el descanso: el numero cambia solo

  const dom = await (await fetch('/scripts/huella-visual/dom.js?' + Math.random())).text();
  const results = [];
  const snap = async (name) => { window.SNAP = TAG + '.' + name; results.push(await eval(dom)); };

  await snap('sesion');
  for (const v of ['routines', 'exercises', 'progress', 'settings']) { nav(v); await wait(60); await snap(v); }
  nav('routines'); await wait(60);
  $('[data-act="r-edit"]').click(); await wait(80);
  await snap('sheet');
  $('[data-act="closesheet"]').click(); await wait(60);
  nav('settings'); await wait(60);
  $('[data-act="tutorial"]').click(); await wait(400);
  await snap('tour');
  $('[data-act="tour-skip"]').click(); await wait(60);
  window.SNAP = TAG;
  return results.join(' | ');
})()
