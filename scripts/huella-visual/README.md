# Huella visual

Comparar dos ramas mirando capturas de pantalla no escala: la app tiene 12
combinaciones de tema y acento, siete vistas y cientos de nodos. A ojo no se
distingue un margen de 8px de uno de 10px, y esa es exactamente la clase de
error que deja una migración de estilos.

Esto compara **la app real**, nodo por nodo, en las 12 combinaciones.

Funciona porque una migración de estilos solo reescribe atributos `class`: la
estructura del DOM queda igual, así que se puede recorrer en orden de documento
y comparar los estilos computados de cada nodo contra la rama anterior.

Se comparan propiedades de **estilo** (colores, tipografía, espaciado, bordes),
no geometría: el ancho y el alto dependen del texto, y el texto cambia con el
estado (minutos transcurridos, volumen acumulado). El espaciado igual queda
cubierto, porque `margin`, `padding` y `gap` son estilo, no geometría.

## Cómo se usa

Con el servidor de desarrollo levantado:

```bash
node scripts/huella-visual/sumidero.mjs /tmp/huella
```

En la consola del navegador, primero en la rama vieja y después en la nueva:

```js
window.SNAP = 'base';   // 'now' en la rama nueva
fetch('/scripts/huella-visual/escena.js').then(r => r.text()).then(eval)
```

`escena.js` arma siempre la misma escena con las mismas acciones (empezar una
rutina, cargar dos series, abrir la hoja de rutina, abrir el tour) en vez de
restaurar un estado guardado: el `save()` de la app tiene un debounce de 250ms
que pisa cualquier escritura directa a `localStorage` hecha justo antes de
recargar.

Después:

```bash
node scripts/huella-visual/comparar.mjs /tmp/huella          # resumen
node scripts/huella-visual/comparar.mjs /tmp/huella sesion -v # con los caminos de cada nodo
node scripts/huella-visual/comparar.mjs /tmp/huella --ruido   # sin filtrar
```

## Las tres listas

El comparador separa en tres, y no esconde nada:

- **REGRESIONES** — lo que hay que mirar.
- **cambios buscados** — las correcciones de esta migración, listadas aparte
  para que no tapen una regresión nueva.
- **ruido benigno** — el preflight de Tailwind declara `border: 0 solid` en
  todo, normaliza `<option>` y pasa `<img>`/`<svg>` a `vertical-align: middle`.
  Son ~120.000 diferencias que no se ven. Cada regla del filtro afirma *por qué*
  no se ve, y se comprueba contra el valor computado (por ejemplo: un cambio de
  color de borde solo se filtra si ese lado tiene ancho 0).

## enganches.mjs

Aparte, un inventario de todo lo que el JavaScript necesita encontrar en el DOM
(`data-act`, `id`, y los selectores que usa `querySelector`). Reescribir
templates a mano es justo donde se pierde un `data-act` sin que salte un error:
la app simplemente deja de responder.

```bash
node scripts/huella-visual/enganches.mjs > /tmp/enganches.antes.txt
# ... cambios ...
node scripts/huella-visual/enganches.mjs | diff /tmp/enganches.antes.txt -
```

Ojo con esto: `.card`, `.between`, `.mono`, `.setrow`, `.check`, `.nb`,
`.tourmask` **no son estilo, son contrato**. `updateStats()` busca la barra de
totales con `$('#app .card .between .mono')`, y el tour apunta a
`.card[data-act="start"]`. Disolverlas en utilidades rompe la app en silencio.
