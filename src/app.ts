/* =========================================================
   BITÁCORA — registro de entrenamiento offline
   Sin internet. Datos en este dispositivo.

   Este archivo es el arranque, y nada más. Enciende el tema,
   recupera el descanso que hubiera quedado corriendo, dibuja la
   pantalla, y decide qué se ve primero: el PIN si hay uno, el
   tutorial si es la primera vez, o la app.

   Dónde está lo demás:
     types.ts     las entidades que se guardan y se sincronizan
     lib/         funciones puras: cuentas, fechas, DOM
     data/        la semilla del plan
     state/       el estado, su migración y las consultas
     ui/          el shell, el tema, la hoja, el toast
     views/       las cinco pantallas
     features/    temporizador, PIN, tour, base pública, sesión…
     events/      el despachador y la tabla de acciones
     sync.ts      la sincronización con Firestore, su propio dominio
   ========================================================= */
import "./app.css";
import "./sync";
import "./events";
import { registerServiceWorker } from "./pwa";
import { initWakeLock, keepAwake, restoreTimer } from "./features/timer";
import { initPinLock, pinIsSet, showLock } from "./features/pin";
import { initLightbox } from "./features/lightbox";
import { updateStats } from "./features/sesion";
import { maybeStartTour } from "./features/tour";
import { save, setState, state } from "./state/store";
import { sheetIsOpen } from "./ui/sheet";
import { render, view } from "./ui/shell";
import { applyTheme } from "./ui/theme";
import { toast } from "./ui/toast";

/** Cada cuánto se repinta el reloj de la sesión en curso. */
const SESSION_CLOCK_MS = 30000;

/* El reloj corre solo mientras se está entrenando y mirando Entrenar: en
   cualquier otra pantalla no hay nada que actualizar. */
setInterval(() => {
  if (state.active && view === "train") updateStats();
}, SESSION_CLOCK_MS);

/* Cerrar la pestaña a mitad de una serie no puede costar la serie. */
window.addEventListener("beforeunload", () => save(true));

/* ---------- puente con sync.ts ----------
   sync.ts no importa nada de acá: se comunica por este objeto en window,
   igual que antes de la migración a TypeScript. */
window.App = {
  getState: () => state,
  adoptState: function (next) {
    /* La sesión en curso es de este dispositivo y no se sincroniza: sobrevive
       a lo que baje de la nube. */
    const act = state.active;
    setState(next);
    state.active = act;
    save(true);
    /* Repintar con la hoja abierta le borraría al usuario lo que está
       escribiendo debajo. */
    if (!sheetIsOpen()) render();
  },
  render,
  toast,
};

/* ---------- arranque ---------- */
initPinLock();
initLightbox();
initWakeLock();
applyTheme();
restoreTimer();
if (state.active) void keepAwake(true);
render();
if (pinIsSet()) showLock("unlock");
else maybeStartTour();
if (window.Sync) {
  Sync.on(() => {
    if (view === "settings") render();
  });
  void Sync.init();
}
registerServiceWorker();
