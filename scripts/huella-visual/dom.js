// Huella de la APP REAL, no de un banco de pruebas sintetico.
// Como esta migracion solo reescribe atributos class, la estructura del DOM
// tiene que quedar identica. Entonces se puede recorrer nodo por nodo, en orden
// de documento, y comparar los estilos computados contra la rama anterior.
//
// Se comparan propiedades de ESTILO (colores, tipografia, espaciado, bordes),
// no geometria: el ancho y el alto dependen del texto, y el texto cambia con el
// estado (minutos transcurridos, volumen acumulado). El espaciado sigue cubierto
// porque margin/padding/gap son estilo, no geometria.
(async () => {
  const PROPS = [
    'display','position','flexDirection','flexWrap','alignItems','justifyContent','gap','flex','order',
    'gridTemplateColumns','gridTemplateRows','gridColumn','gridRow',
    'marginTop','marginRight','marginBottom','marginLeft',
    'paddingTop','paddingRight','paddingBottom','paddingLeft',
    'backgroundColor','backgroundImage','color','opacity',
    'borderTopWidth','borderRightWidth','borderBottomWidth','borderLeftWidth',
    'borderTopStyle','borderRightStyle','borderBottomStyle','borderLeftStyle',
    'borderTopColor','borderRightColor','borderBottomColor','borderLeftColor',
    'borderTopLeftRadius','borderTopRightRadius','borderBottomRightRadius','borderBottomLeftRadius',
    'fontFamily','fontSize','fontWeight','fontStyle','fontVariantNumeric','letterSpacing','lineHeight',
    'textAlign','textTransform','textDecorationLine','textOverflow','whiteSpace','overflow','overflowX','overflowY',
    'boxShadow','outlineWidth','outlineColor','transform','zIndex','visibility',
    'minWidth','maxWidth','minHeight','maxHeight','objectFit','resize','cursor',
    'stroke','fill','strokeWidth','listStyleType','verticalAlign','boxSizing','textIndent','tabularNums',
  ];

  const ROOTS = ['#app', 'nav', '#timer', '#sheet', '#scrim', '#toast', '#lightbox', '#tour', '#lock'];
  const ACC = ['mostaza','verde','fucsia','violeta','celeste','coral'];
  const root = document.documentElement;
  const prev = [root.getAttribute('data-theme'), root.getAttribute('data-accent')];

  const snapshot = () => {
    const lines = [];
    for (const sel of ROOTS) {
      const host = document.querySelector(sel);
      if (!host) { lines.push(sel + ' AUSENTE'); continue; }
      let i = 0;
      for (const el of [host, ...host.querySelectorAll('*')]) {
        const c = getComputedStyle(el);
        // el path incluye tag + indice, no las clases: justamente las clases
        // son lo que cambia, y no queremos que el path se mueva por eso
        const tag = el.tagName.toLowerCase();
        lines.push(`${sel}[${i++}]${tag}{` + PROPS.map(p => p + ':' + c[p]).join(';') + '}');
      }
    }
    return lines.join('\n');
  };

  const out = {};
  for (const th of ['dark','light']) for (const ac of ACC) {
    root.setAttribute('data-theme', th);
    root.setAttribute('data-accent', ac);
    out[th + '/' + ac] = snapshot();
  }
  root.setAttribute('data-theme', prev[0]);
  root.setAttribute('data-accent', prev[1]);
  await fetch('http://localhost:5399/' + window.SNAP + '.dom.json', { method: 'POST', body: JSON.stringify(out) });
  const n = out['dark/mostaza'].split('\n').length;
  return window.SNAP + ': ' + n + ' nodos x 12 combinaciones';
})()
