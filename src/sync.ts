/* =========================================================
   sync.js — Cuenta y sincronización con Firebase
   ---------------------------------------------------------
   Filosofía: la app funciona igual sin internet y sin cuenta.
   El estado local (localStorage) siempre manda para escribir.
   La nube es respaldo + puente entre dispositivos.

   Cada entidad viaja como un documento suelto en
   users/{uid}/items/{docId}, con docId:
     settings          → ajustes
     ex_<id>           → ejercicio
     rt_<id>           → rutina
     se_<id>           → sesión terminada
     bw_<fecha>        → pesada
   Los borrados dejan lápida ({deleted:true}) para que se
   propaguen a los otros dispositivos.

   Resolución de conflictos: last-write-wins real por reloj.
   Cuando la misma entidad cambió de los dos lados desde la
   última sincronización, gana la versión con updatedAt más
   alto — nunca "el que sincronizó último".
   Nunca se borra por ausencia: que un dispositivo no tenga
   una entidad no significa que esté borrada. Solo se borra
   con lápida explícita para ese id.

   La sombra (SHADOW_KEY) guarda por documento:
     h  hash del contenido local en la última sincronización
     t  updatedAt remoto con el que quedó conciliado
     lt momento en que se detectó el cambio local pendiente
     lh hash del contenido local cuando se estampó lt

   Ninguna espera de red es infinita: toda llamada a la nube corre
   contra un reloj (NET_TIMEOUT). Sin eso, una promesa que no resuelve
   ni rechaza deja la tarjeta girando en "Sincronizando…" y —peor—
   deja S.busy en true, con lo que "Sincronizar ahora" deja de hacer
   nada para siempre.
   ========================================================= */
const Sync: SyncApi = (function () {
  "use strict";

  /* Tipos internos. Solo anotaciones: no cambia una linea de logica ni el
     formato del archivo, que sigue fuera de Prettier. */
  /** Un documento tal como viaja a Firestore y vuelve. */
  interface Doc { type: string; data: any; deleted?: boolean; updatedAt?: number }
  /**
   * Lo que quedo sincronizado la vez pasada, por id de documento.
   * `h`/`t` son la huella y la fecha de lo ultimo que se confirmo con la nube.
   * `lt`/`lh` son la estampa local de un cambio hecho en este dispositivo que
   * todavia no se confirmo: se agregan y se borran sobre la misma entrada.
   */
  interface ShadowEntry { h: number; t: number; lt?: number; lh?: number }
  type Shadow = Record<string, ShadowEntry>;

  const SHADOW_KEY = "bitacora_shadow_v2";
  const S: SyncState = { ready: false, user: null, status: "local", msg: "", last: null, busy: false };
  const listeners: ((s: SyncState) => void)[] = [];
  let mods: any = null, fb: any = null, timer: ReturnType<typeof setTimeout> | null = null, bootP: Promise<any> | null = null;

  /* ---------- infraestructura ---------- */
  function on(cb: (s: SyncState) => void) { listeners.push(cb); }
  function emit() { listeners.forEach(cb => { try { cb(S); } catch (e) {} }); }
  function setStatus(status: string, msg?: string) { S.status = status; S.msg = msg || ""; emit(); }

  function configured() {
    const c = window.FIREBASE_CONFIG;
    return !!(c && c.apiKey && c.projectId && !/^(PEGA|TU_|xxx)/i.test(c.apiKey));
  }

  /* Firestore no le pone límite de tiempo a nada. Una escritura que el
     servidor nunca confirma, o un cliente trabado por IndexedDB, devuelve
     una promesa que no resuelve ni rechaza: el catch de run() no se entera
     y la UI queda pensando que todavía está en curso. Acá cualquier demora
     se convierte en un error de verdad, visible y reintentable. */
  const NET_TIMEOUT = 45000;
  function withTimeout<T>(promise: Promise<T>, label: string, ms?: number) {
    let t: ReturnType<typeof setTimeout> | null = null;
    const limit = new Promise((_, reject) => {
      t = setTimeout(() => {
        const e: any = new Error(label + ": la nube no respondió en " + Math.round((ms || NET_TIMEOUT) / 1000) + "s");
        e.code = "sync/timeout";
        reject(e);
      }, ms || NET_TIMEOUT);
    });
    return Promise.race([promise, limit]).finally(() => { if (t) clearTimeout(t); });
  }

  // Mensaje corto y entendible para el badge; el detalle completo va a la consola.
  function errText(e: any) {
    if (!e) return "Falló la sincronización";
    if (e.code === "sync/timeout") return e.message;
    if (e.code === "permission-denied") return "La nube rechazó el permiso (reglas de Firestore)";
    if (e.code === "unauthenticated") return "Sesión vencida: volvé a entrar";
    if (e.code === "failed-precondition") return "Falta un índice en Firestore (ver consola)";
    if (e.code === "unavailable") return "No se pudo llegar a la nube";
    const txt = String(e.message || e.code || "Falló la sincronización");
    return txt.length > 90 ? txt.slice(0, 90) + "…" : txt;
  }

  async function loadSDK() {
    if (mods) return mods;
    const v = (window.FIREBASE_CONFIG && window.FIREBASE_CONFIG.sdkVersion) || "12.17.1";
    const base = "https://www.gstatic.com/firebasejs/" + v + "/";
    const [app, auth, fs] = await Promise.all([
      import(/* @vite-ignore */ base + "firebase-app.js"),
      import(/* @vite-ignore */ base + "firebase-auth.js"),
      import(/* @vite-ignore */ base + "firebase-firestore.js"),
    ]);
    mods = { app, auth, fs };
    return mods;
  }

  // Memoizado por promesa: dos run() simultáneos no pueden inicializar dos veces.
  function boot() {
    if (fb) return Promise.resolve(fb);
    if (!bootP) bootP = withTimeout(bootOnce(), "Cargando Firebase").catch(e => { bootP = null; throw e; });
    return bootP;
  }

  async function bootOnce() {
    const m = await loadSDK();
    const application = m.app.initializeApp(window.FIREBASE_CONFIG);
    let db;
    try {
      db = m.fs.initializeFirestore(application, {
        localCache: m.fs.persistentLocalCache({ tabManager: m.fs.persistentMultipleTabManager() }),
      });
    } catch (e) {
      db = m.fs.getFirestore(application);
    }
    fb = { app: application, auth: m.auth.getAuth(application), db, m };
    return fb;
  }

  /* ---------- utilidades de estado ---------- */
  // huella de lo que queda local después de aplicar un documento remoto
  const hashOf = (R: Doc | null) => (R && !R.deleted ? hash(JSON.stringify({ type: R.type, data: R.data })) : 0);
  const hash = (s: string) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return h; };
  const shadow = (): Shadow => { try { return JSON.parse(localStorage.getItem(SHADOW_KEY) || "null") || {}; } catch (e) { return {}; } };
  const saveShadow = (o: Shadow) => { try { localStorage.setItem(SHADOW_KEY, JSON.stringify(o)); } catch (e) {} };

  function flatten(st: any): Record<string, Doc> {
    const m: Record<string, Doc> = {};
    m["settings"] = { type: "settings", data: { settings: st.settings } };
    (st.exercises || []).forEach((e: any) => (m["ex_" + e.id] = { type: "ex", data: e }));
    (st.routines || []).forEach((r: any) => (m["rt_" + r.id] = { type: "rt", data: r }));
    (st.sessions || []).filter((s: any) => s.endedAt).forEach((s: any) => (m["se_" + s.id] = { type: "se", data: s }));
    (st.bw || []).forEach((b: any) => (m["bw_" + b.date] = { type: "bw", data: b }));
    return m;
  }
  function parseId(docId: string) {
    if (docId === "settings") return { type: "settings" };
    const i = docId.indexOf("_");
    return { type: docId.slice(0, i), ref: docId.slice(i + 1) };
  }
  const ARR: Record<string, [string, string]> = { ex: ["exercises", "id"], rt: ["routines", "id"], se: ["sessions", "id"], bw: ["bw", "date"] };

  function applyRemote(st: any, docId: string, doc: Doc) {
    const p = parseId(docId);
    if (p.type === "settings") {
      if (!doc.deleted && doc.data && doc.data.settings) st.settings = Object.assign({}, st.settings, doc.data.settings);
      return;
    }
    const spec = ARR[p.type];
    if (!spec) return;
    const [key, idf] = spec;
    st[key] = st[key] || [];
    const i = st[key].findIndex((x: any) => String(x[idf]) === String(p.ref));
    if (doc.deleted) { if (i >= 0) st[key].splice(i, 1); return; }
    if (!doc.data) return;
    if (i >= 0) st[key][i] = doc.data; else st[key].push(doc.data);
  }

  /* ---------- sincronización ---------- */
  async function run(_reason?: string) {
    if (!S.user || S.busy) return;
    if (!navigator.onLine) { setStatus("offline", "Sin conexión — se sincroniza al volver"); return; }
    S.busy = true; setStatus("syncing", "Sincronizando…");
    const startedAt = Date.now();
    try {
      const f = await boot();
      const { collection, doc, getDocs, query, where, writeBatch, waitForPendingWrites } = f.m.fs;
      const col = collection(f.db, "users", S.user.uid, "items");

      // Copia propia: si la sync falla a mitad de camino, el estado vivo de la app
      // no queda con media conciliación aplicada encima.
      const st = JSON.parse(JSON.stringify(App.getState()));
      const local = flatten(st);
      const sh = shadow();
      const first = !Object.keys(sh).length;

      /* 1. traer lo remoto */
      /* El snapshot es de la SDK de Firestore, que se carga por CDN y no
         trae tipos. */
      let snap: any;
      const lastPull = Number(localStorage.getItem("bitacora_lastpull") || 0);
      if (first || !lastPull) snap = await withTimeout(getDocs(col), "Bajando datos");
      else snap = await withTimeout(getDocs(query(col, where("updatedAt", ">", lastPull - 300000))), "Bajando cambios");

      /* Con caché persistente, getDocs() no rechaza cuando el servidor no está:
         el SDK reintenta en silencio y, una vez que se da por vencido, resuelve
         con lo que haya en IndexedDB. La promesa cumple, el snapshot trae
         documentos y nada distingue eso de una lectura real de la nube salvo
         metadata.fromCache. Sin esta guarda, una base inexistente o una red
         caída terminaban en "Al día", con la sombra y lastPull estampados como
         si la conciliación hubiera ocurrido: el dispositivo quedaba convencido
         de haber subido todo. fromCache === true significa exactamente una cosa
         —no hubo ida y vuelta con el servidor— y sin eso no hay sincronización
         que reportar. */
      if (snap.metadata && snap.metadata.fromCache) {
        if (!navigator.onLine) setStatus("offline", "Sin conexión — se sincroniza al volver");
        else setStatus("error", "No se pudo confirmar con el servidor — sin conexión real");
        return;
      }
      const remote: Record<string, Doc> = {};
      snap.forEach((d: any) => (remote[d.id] = d.data()));

      /* 2. resolver */
      const ids = new Set(Object.keys(local).concat(Object.keys(sh), Object.keys(remote)));
      const push: { id: string; body: Doc }[] = [];
      const pushed = new Set();
      const touched = new Set();
      let pulled = 0;
      const now = Date.now();

      // la nube gana para este id: se aplica el documento remoto sobre el estado local
      function takeRemote(id: string, R: Doc) {
        applyRemote(st, id, R);
        sh[id] = { h: hashOf(R), t: R.updatedAt || now };
        touched.add(id); pulled++;
      }
      // lo local gana para este id: se sube (o se sube la lápida si acá se borró)
      function takeLocal(id: string, L: Doc | null, prev: ShadowEntry | null, lHash: number) {
        if (L) push.push({ id, body: { type: L.type, data: L.data, deleted: false, updatedAt: now } });
        else if (prev) push.push({ id, body: { type: parseId(id).type, data: null, deleted: true, updatedAt: now } });
        else return;
        pushed.add(id); touched.add(id);
        sh[id] = { h: lHash, t: now };
      }

      ids.forEach(id => {
        const L = local[id] || null;
        const R = remote[id] || null;
        const prev = sh[id] || null;
        const lJson = L ? JSON.stringify(L) : "";
        const lHash = L ? hash(lJson) : 0;
        const localChanged = !prev ? !!L : prev.h !== lHash;
        const remoteTs = (R && R.updatedAt) || 0;
        const remoteNewer = !!R && (!prev || remoteTs > (prev.t || 0));

        // primer arranque en este dispositivo: traer todo antes de empezar a comparar.
        // Lo local que la nube no tenga se sube después del bucle, no se pierde nada.
        if (first && R) { takeRemote(id, R); return; }

        // Conflicto real: la misma entidad cambió de los dos lados desde la última
        // sincronización. Gana la más reciente por reloj, en toda sincronización
        // (no solo en la primera).
        if (localChanged && remoteNewer) {
          const localTs = (prev && prev.lt) || now;
          if (remoteTs > localTs) takeRemote(id, R);
          else takeLocal(id, L, prev, lHash);
          return;
        }
        if (localChanged) { takeLocal(id, L, prev, lHash); return; }
        if (remoteNewer) { takeRemote(id, R); }
      });

      // en el primer arranque, empujar lo local que no existe en la nube
      if (first) {
        Object.keys(local).forEach(id => {
          if (remote[id] || pushed.has(id)) return;
          const L = local[id];
          push.push({ id, body: { type: L.type, data: L.data, deleted: false, updatedAt: now } });
          sh[id] = { h: hash(JSON.stringify(L)), t: now };
        });
      }

      /* 3. empujar en lotes */
      for (let i = 0; i < push.length; i += 400) {
        const batch = writeBatch(f.db);
        push.slice(i, i + 400).forEach(p => batch.set(doc(col, p.id), p.body));
        await withTimeout(batch.commit(), "Subiendo cambios");
      }

      /* commit() promete confirmación del backend, pero la promesa es por lote y
         no dice nada de lo que el SDK pueda tener encolado de antes. waitForPendingWrites
         resuelve solo cuando el servidor acusó recibo de TODAS las escrituras
         locales pendientes: es la única evidencia dura de que lo que subimos
         salió del dispositivo. Si no llega, el timeout lo convierte en error y
         la sombra queda intacta, así el próximo intento reintenta de verdad. */
      if (push.length && waitForPendingWrites) {
        await withTimeout(waitForPendingWrites(f.db), "Confirmando subida");
      }

      // un save local pudo estampar la sombra mientras corría la red: no lo pisamos
      const during = shadow();
      Object.keys(during).forEach(id => {
        const d = during[id];
        if (!d || !d.lt || d.lt < startedAt) return;
        if (!touched.has(id)) { sh[id] = d; return; }
        sh[id].lt = d.lt; sh[id].lh = d.lh;
      });

      saveShadow(sh);
      localStorage.setItem("bitacora_lastpull", String(now));
      if (pulled) App.adoptState(st);
      S.last = now;
      setStatus("ok", (push.length ? "↑" + push.length + " " : "") + (pulled ? "↓" + pulled : "") || "Al día");
    } catch (e) {
      console.warn("[sync]", e);
      setStatus("error", errText(e));
    } finally {
      S.busy = false;
      emit();
    }
  }

  /* Marca en la sombra cuándo cambió cada documento local, para que la
     resolución de conflictos pueda comparar relojes de verdad. Corre junto
     al save local, así la marca es la hora del cambio y no la de la sync. */
  function stamp() {
    if (!S.user || !window.App) return;
    try {
      const local = flatten(App.getState());
      const sh = shadow();
      const now = Date.now();
      let dirty = false;
      Object.keys(local).forEach(id => {
        const h = hash(JSON.stringify(local[id]));
        const prev = sh[id];
        if (prev && prev.h === h) {
          if (prev.lt) { delete prev.lt; delete prev.lh; dirty = true; }
          return;
        }
        if (prev && prev.lh === h) return;            // ya estampado con este contenido
        sh[id] = Object.assign(prev || { h: 0, t: 0 }, { lt: now, lh: h });
        dirty = true;
      });
      // borrado local: estaba en la sombra con contenido y ya no está en el estado
      Object.keys(sh).forEach(id => {
        if (local[id]) return;
        const prev = sh[id];
        if (!prev.h || prev.lh === 0) return;
        prev.lt = now; prev.lh = 0; dirty = true;
      });
      if (dirty) saveShadow(sh);
    } catch (e) {}
  }

  function schedule(ms?: number) {
    if (!S.user) return;
    stamp();
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => run("auto"), ms || 4000);
  }

  /* ---------- sesión ---------- */
  async function init() {
    if (!configured()) { setStatus("unconfigured", "Sin cuenta: los datos viven solo en este dispositivo"); return; }
    try {
      const f = await boot();
      f.m.auth.onAuthStateChanged(f.auth, (u: any) => {
        S.user = u ? { uid: u.uid, email: u.email } : null;
        S.ready = true;
        if (u) { setStatus("syncing", "Conectando…"); void run("login"); }
        else { setStatus("local", "Sin sesión iniciada"); }
        emit();
      });
    } catch (e) {
      setStatus("error", "No se pudo cargar Firebase (¿sin internet?)");
    }
  }

  async function signIn(email: string, pass: string) {
    const f = await boot();
    await f.m.auth.signInWithEmailAndPassword(f.auth, email.trim(), pass);
  }
  async function signInGoogle() {
    const f = await boot();
    const provider = new f.m.auth.GoogleAuthProvider();
    await f.m.auth.signInWithPopup(f.auth, provider);
  }
  async function signUp(email: string, pass: string) {
    const f = await boot();
    await f.m.auth.createUserWithEmailAndPassword(f.auth, email.trim(), pass);
  }
  async function reset(email: string) {
    const f = await boot();
    await f.m.auth.sendPasswordResetEmail(f.auth, email.trim());
  }
  async function signOut() {
    const f = await boot();
    await f.m.auth.signOut(f.auth);
    localStorage.removeItem(SHADOW_KEY);
    localStorage.removeItem("bitacora_lastpull");
  }

  window.addEventListener("online", () => schedule(1500));
  document.addEventListener("visibilitychange", () => { if (!document.hidden) schedule(1000); });

  // puntos de entrada para pruebas automatizadas (no se usan en producción)
  function _inject(backend: any, user: SyncState["user"]) { fb = backend; S.user = user; bootP = null; }
  // stamp() normalmente lo dispara schedule() desde el save de la app; las
  // pruebas lo necesitan sin arrastrar el temporizador.
  function _stamp() { stamp(); }

  // última vez que este dispositivo trajo datos de la nube (diagnóstico en Ajustes)
  function lastPull() { return Number(localStorage.getItem("bitacora_lastpull") || 0) || null; }

  return { init, on, run, schedule, signIn, signUp, signOut, reset, signInGoogle, configured, lastPull, state: S, _inject, _stamp };
})();
window.Sync = Sync;

// app.ts still reaches Sync through window, exactly as it did with the two
// <script> tags. The named export exists so the tests can drive it directly.
export { Sync };