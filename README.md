# Bitácora · Entrenamiento

App de registro de entrenamiento basada en el plan Push-Pull-Legs + Torso-Pierna.
Funciona sin internet, se instala como app en el iPhone y sincroniza el historial
en la nube con Firebase.

---

## 1. Poner la app online (Vercel) — 3 minutos

1. Entrá a **vercel.com/drop** (necesitás una cuenta de Vercel, el plan gratis alcanza).
2. Arrastrá la carpeta `bitacora-gym` completa (o el `.zip`) a la página.
3. Elegí un nombre de proyecto, por ejemplo `bitacora`, y tocá **Deploy**.
4. Te queda una URL tipo `https://bitacora.vercel.app`.

> **Importante:** cada vez que arrastrás archivos a Vercel Drop se crea un proyecto
> y una URL **nueva**. Para actualizar sin cambiar de dirección, entrá al proyecto
> ya creado en Vercel y conectalo a un repositorio de GitHub: desde ahí cada push
> actualiza la misma URL. Con la cuenta de Firebase andando esto igual deja de ser
> crítico, porque el historial vive en la nube y no en la URL.

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
Abrí `config.js` y reemplazá los valores `PEGA_TU_...` por los tuyos.
Dejá el campo `sdkVersion` como está.

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
Como cambiaste `config.js`, subí de nuevo la carpeta a Vercel (o hacé push si conectaste GitHub).

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
| `app.css` | Todos los estilos |
| `app.js` | La app: rutinas, series, temporizador, progreso |
| `sync.js` | Cuenta y sincronización con Firebase |
| `config.js` | Tus claves de Firebase (lo único que editás) |
| `sw.js` | Service worker: hace que abra sin señal |
| `manifest.webmanifest` | Que se instale como app |
| `firestore.rules` | Reglas de seguridad para pegar en la consola |
| `vercel.json` | Cabeceras de cache |

---

## Actualizaciones

Cuando cambies archivos, subí el número de `VERSION` en `sw.js`
(`bitacora-v1` → `bitacora-v2`). Sin eso el teléfono puede seguir mostrando la
versión vieja. En la app, Ajustes → **Buscar actualización** fuerza la recarga.

## Probarlo en la compu antes de subir

No alcanza con abrir `index.html` haciendo doble clic (los service workers y los
módulos necesitan un servidor). Desde la carpeta:

```bash
npx serve .
# o
python3 -m http.server 8000
```

Y entrás a `http://localhost:8000`.

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
Framework Preset: **Other** → Root Directory: `./` → **Deploy**.

Cada rama que subas genera además una URL de preview, así podés probar un cambio sin
tocar la app que usás en el gimnasio.

### Al hacer cambios

1. Subí el número de `VERSION` en `sw.js` (`bitacora-v1` → `bitacora-v2`).
2. `git commit` + `git push`.
3. En el teléfono: Ajustes → **Buscar actualización**.

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
