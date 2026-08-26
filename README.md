# Bitácora · Entrenamiento

App de registro de entrenamiento basada en el plan Push-Pull-Legs + Torso-Pierna.
Funciona sin internet, se instala como app en el iPhone y sincroniza el historial
en la nube con Firebase.

---

## 1. Poner la app online (Vercel) — 3 minutos

La app ya no son archivos sueltos que se copian tal cual: antes de publicarse hay
que **compilarla** (juntar y optimizar el código). Vercel hace ese paso solo, pero
necesita el repositorio, no una carpeta arrastrada.

1. Subí el proyecto a GitHub (más abajo, en *Versionarlo en GitHub*).
2. Entrá a **vercel.com/new** → *Import Git Repository* → elegí el repo.
3. Vercel detecta solo que es un proyecto **Vite**; si no, el archivo `vercel.json`
   ya se lo dice (`npm run build`, salida en `dist`). No hace falta tocar nada.
4. Te queda una URL tipo `https://bitacora.vercel.app`, y cada `git push` la actualiza.

> **Nota:** **vercel.com/drop** (arrastrar la carpeta) ya no sirve para este proyecto,
> porque no compila nada: subiría el código sin construir y la app no abriría.

En este punto la app ya sirve: guarda todo en el teléfono. La cuenta es el paso 2.

---

## 2. Crear el proyecto de Firebase — 10 minutos

### 2.1 Proyecto y app web
1. Entrá a **console.firebase.google.com** → **Crear un proyecto**.
   Nombre: `bitacora`. Google Analytics: podés decir que no.
2. Dentro del proyecto, tocá el icono **`</>`** (Web) para registrar una app web.
   Apodo: `bitacora`. **No** marques Firebase Hosting.
3. Te va a mostrar un bloque `const firebaseConfig = { ... }`. Copialo.

### 2.2 Pegar las claves
Abrí **`public/config.js`** y reemplazá los valores `PEGA_TU_...` por los tuyos.
Dejá el campo `sdkVersion` como está.

> Ese archivo sigue siendo JavaScript común y corriente, a propósito: es el único
> que se edita a mano copiando y pegando de la consola de Firebase, así que se
> quedó fuera de todo lo demás para que siga siendo fácil.

> Estas claves no son secretas: identifican al proyecto, no dan acceso.
> Lo que protege tus datos es el login más las reglas del paso 2.4.

### 2.3 Activar el login
Consola → **Compilación → Authentication → Comenzar** →
pestaña **Sign-in method** → **Correo electrónico/contraseña** → **Habilitar** → Guardar.

### 2.4 Crear la base y poner las reglas
1. Consola → **Compilación → Firestore Database → Crear base de datos**.
   Ubicación: `southamerica-east1` (São Paulo, la más cercana).
   Empezá en **modo de producción**.
2. Pestaña **Reglas** → borrá todo y pegá el contenido de `firestore.rules` → **Publicar**.

Esas reglas dicen: cada usuario solo puede leer y escribir su propia carpeta.

### 2.5 Autorizar el dominio
Authentication → **Settings** → **Dominios autorizados** → **Agregar dominio** →
poné tu dominio de Vercel (`bitacora.vercel.app`, sin `https://`).
Sin esto, el login falla en producción.

### 2.6 Volver a subir
Como cambiaste `public/config.js`, hacé `git push`: Vercel compila y publica sola.

---

## 3. Instalar en el iPhone

1. Abrí la URL en **Safari** (tiene que ser Safari, no Chrome).
2. Botón **Compartir** → **Agregar a pantalla de inicio**.
3. Abrila desde el icono. Ahí adentro:
   - Ajustes → **Entrar o crear cuenta** → creá tu cuenta con email y contraseña.
   - Listo: entrenás sin señal y cuando vuelve el wifi sube solo.

Si cambiás de teléfono, instalás la app, entrás con el mismo email y el historial vuelve.

---

## Cómo funciona por dentro

**Local-first.** Todo lo que hacés se escribe primero en `localStorage`, al instante,
tengas o no internet. La nube es un espejo, nunca un requisito.

**Sincronización por entidad.** Cada ejercicio, rutina, sesión terminada y pesada es
un documento suelto en `users/{uid}/items`. Al sincronizar se compara lo local contra
una "sombra" de lo último sincronizado:

- cambió local y no cambió remoto → sube
- cambió remoto y no local → baja
- cambiaron los dos → gana el dispositivo donde estás
- borrado local → sube una lápida para que el borrado llegue a los otros dispositivos

La primera vez que entrás en un dispositivo manda la nube: se baja todo lo que hay
allá y solo se sube lo local que no exista, así no se pisa el historial viejo.

**La sesión en curso no se sincroniza.** Vive solo en el teléfono hasta que la terminás.
Es a propósito: evita que dos dispositivos peleen por la misma serie.

---

## Los archivos

| Archivo | Qué hace |
|---|---|
| `index.html` | Estructura y arranque |
| `src/app.css` | Todos los estilos |
| `src/app.ts` | La app: rutinas, series, temporizador, progreso |
| `src/sync.ts` | Cuenta y sincronización con Firebase |
| `src/lib/calc.ts` | Las cuentas: 1RM estimado, volumen, series semanales |
| `src/lib/timer.ts` | La cuenta regresiva del descanso |
| `src/pwa.ts` | Registro del service worker y el botón de actualizar |
| `public/config.js` | Tus claves de Firebase (lo único que editás) |
| `public/manifest.webmanifest` | Que se instale como app |
| `test/` | Pruebas automáticas (se corren con `npm test`) |
| `firestore.rules` | Reglas de seguridad para pegar en la consola |
| `vercel.json` | Cabeceras de cache y cómo compilar |
| `vite.config.ts` | Cómo se compila y cómo se genera el service worker |

El service worker (`sw.js`, el que hace que la app abra sin señal) ya **no** se
escribe a mano: lo genera el compilador en cada build, dentro de `dist/`.

---

## Actualizaciones

**Ya no hay que subir ningún número a mano.** Antes había que acordarse de cambiar
`VERSION` en `sw.js` en cada cambio, y si te olvidabas el teléfono seguía mostrando
la versión vieja. Ahora el service worker se genera en cada compilación y se entera
solo de qué archivos cambiaron.

Hacés `git push`, Vercel compila, y el teléfono toma la versión nueva la próxima vez
que abrís la app. Si querés forzarlo en el momento: Ajustes → **Buscar actualización**.

## Probarlo en la compu antes de subir

La primera vez, instalá las herramientas (una sola vez, necesita internet):

```bash
npm install
```

Después, para trabajar:

```bash
npm run dev
```

Y entrás a `http://localhost:5173`. Se actualiza solo cada vez que guardás un archivo.

Para probar **exactamente lo que va a ver el teléfono** (incluido el modo sin señal):

```bash
npm run build
npm run preview
```

Y entrás a `http://localhost:4173`.

### Revisar que no rompiste nada

```bash
npm run check
```

Corre las cuatro verificaciones de una: que los tipos cierren, que el código no tenga
errores obvios, que las pruebas pasen y que compile. Las mismas cuatro corren solas en
cada Pull Request de GitHub, así que si algo se rompe te vas a enterar ahí también.

---

## Versionarlo en GitHub (recomendado)

Con el repo conectado, cada `git push` actualiza la misma URL. Sin GitHub, cada
subida a Vercel Drop crea un proyecto y una dirección nueva.

### Crear el repo

```bash
cd bitacora-gym
git init -b main
git add .
git commit -m "Bitacora: primera version"
```

Después, con GitHub CLI:

```bash
gh repo create bitacora --private --source=. --push
```

O a mano: creá el repositorio vacío en github.com y luego

```bash
git remote add origin https://github.com/TU_USUARIO/bitacora.git
git push -u origin main
```

### Conectarlo a Vercel

**Si ya deployaste con Drop y querés conservar la URL:** entrá al proyecto en Vercel →
**Settings → Git → Connect Git Repository** → elegí el repo. Desde ahí en adelante se
actualiza solo con cada push.

**Si arrancás de cero:** **vercel.com/new** → Import Git Repository → elegí el repo →
Framework Preset: **Vite** → Root Directory: `./` → **Deploy**. Si quedó en **Other**
tampoco pasa nada: `vercel.json` ya trae el comando de compilación y la carpeta de
salida, y eso manda por encima de lo que diga el panel.

Cada rama que subas genera además una URL de preview, así podés probar un cambio sin
tocar la app que usás en el gimnasio.

### Al hacer cambios

1. `npm run check` (que pase todo).
2. `git commit` + `git push`.
3. En el teléfono: Ajustes → **Buscar actualización**, o simplemente abrila más tarde.

### ¿Repo público o privado?

**Poné el repo en privado.** Las claves de `config.js` no son secretas (identifican al
proyecto, no dan acceso a los datos: eso lo cortan las reglas de Firestore), pero con
el repo público cualquiera podría apuntar una copia de la app a tu proyecto de Firebase
y crear cuentas ahí, consumiendo tu cuota.

Si igual lo querés público, agregá estas dos defensas:

1. **Dominios autorizados** (ya lo hacés en el paso 2.5): el login solo funciona desde
   tu dominio de Vercel. Es la protección más efectiva contra copias.
2. **Restringir la API key**: Google Cloud Console → APIs y servicios → Credenciales →
   tu clave de navegador → Restricciones de aplicación → **Sitios web** → agregá
   `https://tu-proyecto.vercel.app/*`.

Nunca hay datos personales en el repo: tu historial vive en el navegador y en Firestore,
nunca en los archivos. El `.gitignore` además excluye los `.json` y `.csv` que exporta
la app, por si los guardás en la misma carpeta.

---

Guía general de entrenamiento, no consejo médico.
