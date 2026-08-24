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
   ========================================================= */
const Sync = (function () {
  "use strict";

  const SHADOW_KEY = "bitacora_shadow_v2";
  const S = { ready: false, user: null, status: "local", msg: "", last: null, busy: false };
  const listeners = [];
  let mods = null, fb = null, timer = null;

  /* ---------- infraestructura ---------- */
  function on(cb) { listeners.push(cb); }
  function emit() { listeners.forEach(cb => { try { cb(S); } catch (e) {} }); }
  function setStatus(status, msg) { S.status = status; S.msg = msg || ""; emit(); }

  function configured() {
    const c = window.FIREBASE_CONFIG;
    return !!(c && c.apiKey && c.projectId && !/^(PEGA|TU_|xxx)/i.test(c.apiKey));
  }

  async function loadSDK() {
    if (mods) return mods;
    const v = (window.FIREBASE_CONFIG && window.FIREBASE_CONFIG.sdkVersion) || "12.17.1";
    const base = "https://www.gstatic.com/firebasejs/" + v + "/";
    const [app, auth, fs] = await Promise.all([
      import(base + "firebase-app.js"),
      import(base + "firebase-auth.js"),
      import(base + "firebase-firestore.js"),
    ]);
    mods = { app, auth, fs };
    return mods;
  }

  async function boot() {
    if (fb) return fb;
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
  const hashOf = R => (R && !R.deleted ? hash(JSON.stringify({ type: R.type, data: R.data })) : 0);
  const hash = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return h; };
  const shadow = () => { try { return JSON.parse(localStorage.getItem(SHADOW_KEY)) || {}; } catch (e) { return {}; } };
  const saveShadow = o => { try { localStorage.setItem(SHADOW_KEY, JSON.stringify(o)); } catch (e) {} };

  function flatten(st) {
    const m = {};
    m["settings"] = { type: "settings", data: { settings: st.settings } };
    (st.exercises || []).forEach(e => (m["ex_" + e.id] = { type: "ex", data: e }));
    (st.routines || []).forEach(r => (m["rt_" + r.id] = { type: "rt", data: r }));
    (st.sessions || []).filter(s => s.endedAt).forEach(s => (m["se_" + s.id] = { type: "se", data: s }));
    (st.bw || []).forEach(b => (m["bw_" + b.date] = { type: "bw", data: b }));
    return m;
  }
  function parseId(docId) {
    if (docId === "settings") return { type: "settings" };
    const i = docId.indexOf("_");
    return { type: docId.slice(0, i), ref: docId.slice(i + 1) };
  }
  const ARR = { ex: ["exercises", "id"], rt: ["routines", "id"], se: ["sessions", "id"], bw: ["bw", "date"] };

  function applyRemote(st, docId, doc) {
    const p = parseId(docId);
    if (p.type === "settings") {
      if (!doc.deleted && doc.data && doc.data.settings) st.settings = Object.assign({}, st.settings, doc.data.settings);
      return;
    }
    const spec = ARR[p.type];
    if (!spec) return;
    const [key, idf] = spec;
    st[key] = st[key] || [];
    const i = st[key].findIndex(x => String(x[idf]) === String(p.ref));
    if (doc.deleted) { if (i >= 0) st[key].splice(i, 1); return; }
    if (!doc.data) return;
    if (i >= 0) st[key][i] = doc.data; else st[key].push(doc.data);
  }

  /* ---------- sincronización ---------- */
  async function run(reason) {
    if (!S.user || S.busy) return;
    if (!navigator.onLine) { setStatus("offline", "Sin conexión — se sincroniza al volver"); return; }
    S.busy = true; setStatus("syncing", "Sincronizando…");
    try {
      const f = await boot();
      const { collection, doc, getDocs, query, where, writeBatch } = f.m.fs;
      const col = collection(f.db, "users", S.user.uid, "items");

      const st = App.getState();
      const local = flatten(st);
      const sh = shadow();
      const first = !Object.keys(sh).length;

      /* 1. traer lo remoto */
      let snap;
      const lastPull = Number(localStorage.getItem("bitacora_lastpull") || 0);
      if (first || !lastPull) snap = await getDocs(col);
      else snap = await getDocs(query(col, where("updatedAt", ">", lastPull - 300000)));
      const remote = {};
      snap.forEach(d => (remote[d.id] = d.data()));

      /* 2. resolver */
      const ids = new Set(Object.keys(local).concat(Object.keys(sh), Object.keys(remote)));
      const push = [];
      const pushed = new Set();
      let pulled = 0;
      const now = Date.now();

      ids.forEach(id => {
        const L = local[id] || null;
        const R = remote[id] || null;
        const prev = sh[id] || null;
        const lJson = L ? JSON.stringify(L) : "";
        const lHash = L ? hash(lJson) : 0;
        const localChanged = !prev ? !!L : prev.h !== lHash;
        const remoteNewer = R && (!prev || (R.updatedAt || 0) > (prev.t || 0));

        // primer arranque en este dispositivo: la nube manda, lo local solo suma lo que allá no existe
        if (first && R) { applyRemote(st, id, R); sh[id] = { h: hashOf(R), t: R.updatedAt || now }; pulled++; return; }

        if (localChanged && (!remoteNewer || !first)) {
          if (L) { push.push({ id, body: { type: L.type, data: L.data, deleted: false, updatedAt: now } }); pushed.add(id); }
          else if (prev) { push.push({ id, body: { type: parseId(id).type, data: null, deleted: true, updatedAt: now } }); pushed.add(id); }
          sh[id] = { h: lHash, t: now };
          return;
        }
        if (remoteNewer) { applyRemote(st, id, R); pulled++; sh[id] = { h: hashOf(R), t: R.updatedAt || now }; }
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
        await batch.commit();
      }

      saveShadow(sh);
      localStorage.setItem("bitacora_lastpull", String(now));
      if (pulled) App.adoptState(st);
      S.last = now;
      setStatus("ok", (push.length ? "↑" + push.length + " " : "") + (pulled ? "↓" + pulled : "") || "Al día");
    } catch (e) {
      console.warn("[sync]", e);
      setStatus("error", (e && e.code) || (e && e.message) || "Falló la sincronización");
    } finally {
      S.busy = false;
      emit();
    }
  }

  function schedule(ms) {
    if (!S.user) return;
    clearTimeout(timer);
    timer = setTimeout(() => run("auto"), ms || 4000);
  }

  /* ---------- sesión ---------- */
  async function init() {
    if (!configured()) { setStatus("unconfigured", "Sin cuenta: los datos viven solo en este dispositivo"); return; }
    try {
      const f = await boot();
      f.m.auth.onAuthStateChanged(f.auth, u => {
        S.user = u ? { uid: u.uid, email: u.email } : null;
        S.ready = true;
        if (u) { setStatus("syncing", "Conectando…"); run("login"); }
        else { setStatus("local", "Sin sesión iniciada"); }
        emit();
      });
    } catch (e) {
      setStatus("error", "No se pudo cargar Firebase (¿sin internet?)");
    }
  }

  async function signIn(email, pass) {
    const f = await boot();
    await f.m.auth.signInWithEmailAndPassword(f.auth, email.trim(), pass);
  }
  async function signUp(email, pass) {
    const f = await boot();
    await f.m.auth.createUserWithEmailAndPassword(f.auth, email.trim(), pass);
  }
  async function reset(email) {
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

  // punto de entrada para pruebas automatizadas (no se usa en producción)
  function _inject(backend, user) { fb = backend; S.user = user; }

  return { init, on, run, schedule, signIn, signUp, signOut, reset, configured, state: S, _inject };
})();
window.Sync = Sync;
