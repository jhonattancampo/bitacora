/* =========================================================
   views/ajustes.ts — Account, appearance, training defaults,
   the plate calculator, the PIN, backup, and the two buttons
   that throw data away.
   ========================================================= */
import { ACCENT_HEX } from "../data/groups";
import { pinIsSet } from "../features/pin";
import { state } from "../state/store";
import { header } from "../ui/chrome";
import { accountCard } from "./cuenta";

export function viewSettings() {
  const s = state.settings;
  const ACCENTS = [
    ["mostaza", "Mostaza"],
    ["verde", "Verde"],
    ["fucsia", "Fucsia"],
    ["violeta", "Violeta"],
    ["celeste", "Celeste"],
    ["coral", "Coral"],
  ];
  return (
    header("Tu copia, tus datos", "Ajustes") +
    `<div class="wrap">
    ${accountCard()}
    <div class="card">
      <div class="eyebrow">Apariencia</div>
      <div class="flex items-center gap-2 mt-2.5 mx-0 mb-3.5">
        <button class="btn ${s.theme !== "light" ? "primary" : ""} flex-1" data-act="theme" data-v="dark">Oscuro</button>
        <button class="btn ${s.theme === "light" ? "primary" : ""} flex-1" data-act="theme" data-v="light">Claro</button>
      </div>
      <div class="eyebrow mb-2">Color</div>
      <div class="flex items-center gap-2.5 flex-wrap">
        ${ACCENTS.map(([v, label]) => `<button class="w-[38px] h-[38px] rounded-pill p-0 flex-none border-2 ${s.accent === v ? "border-tx" : "border-transparent"}" data-act="accent" data-v="${v}" title="${label}" style="background:${ACCENT_HEX[v]}"></button>`).join("")}
      </div>
    </div>
    <div class="card">
      <div class="eyebrow">Entrenamiento</div>
      <div class="switch"><div><div class="h3">Arrancar el descanso solo</div><div class="text-tiny text-dim">Al marcar una serie como hecha</div></div>
        <div class="tog ${s.autoTimer ? "on" : ""}" data-act="tog" data-k="autoTimer"><i></i></div></div>
      <div class="switch"><div><div class="h3">Sonidos del descanso</div><div class="text-tiny text-dim">Al arrancar, cuando está por terminar y al terminar</div></div>
        <div class="tog ${s.sound ? "on" : ""}" data-act="tog" data-k="sound"><i></i></div></div>
      <div class="switch"><div><div class="h3">Vibración</div><div class="text-tiny text-dim">Si el dispositivo la soporta</div></div>
        <div class="tog ${s.vibrate ? "on" : ""}" data-act="tog" data-k="vibrate"><i></i></div></div>
      <div class="switch border-b-0"><div><div class="h3">Pantalla siempre encendida</div><div class="text-tiny text-dim">Mientras dura la sesión</div></div>
        <div class="tog ${s.wake ? "on" : ""}" data-act="tog" data-k="wake"><i></i></div></div>
      <label class="f"><span class="eyebrow">Descanso por defecto (segundos)</span>
        <input type="text" inputmode="numeric" data-act="set-rest" value="${s.rest}"></label>
    </div>

    <div class="card">
      <div class="eyebrow">Calculadora de discos</div>
      <div class="text-tiny text-dim mt-0.5 mx-0 mb-2">Cuántos discos por lado para el peso total que querés.</div>
      <div class="flex items-center gap-2">
        <input class="flex-1" type="text" inputmode="decimal" id="plateW" placeholder="peso total">
        <input class="w-22" type="text" inputmode="decimal" id="plateBar" value="${s.bar}" title="barra">
        <button class="btn primary" data-act="plate">Calcular</button>
      </div>
      <div id="plateOut" class="mono text-small mt-2.5 text-sig"></div>
    </div>

    <div class="card">
      <div class="eyebrow">Privacidad</div>
      <div class="text-small text-dim mt-1 mx-0 mb-2.5">Un PIN para abrir la app en este dispositivo. Se guarda solo acá, no viaja a la nube ni a otros dispositivos.</div>
      ${
        pinIsSet()
          ? `<div class="grid grid-cols-2 gap-2.5"><button class="btn" data-act="pin-change">Cambiar PIN</button><button class="btn ghost danger" data-act="pin-disable">Desactivar</button></div>`
          : `<button class="btn w-full primary" data-act="pin-enable">Activar PIN</button>`
      }
    </div>
    <div class="card">
      <div class="eyebrow">Copia de seguridad</div>
      <div class="text-tiny text-dim mt-0.5 mx-0 mb-2.5">Los datos viven solo en este navegador. Exportá de vez en cuando y guardate el archivo.</div>
      <div class="grid grid-cols-2 gap-2.5">
        <button class="btn" data-act="export">Exportar .json</button>
        <button class="btn" data-act="import">Importar .json</button>
      </div>
      <input class="hidden" type="file" id="fileIn" accept="application/json,.json">
      <button class="btn w-full ghost mt-2" data-act="export-csv">Exportar historial .csv</button>
    </div>

    <div class="card">
      <div class="eyebrow">Datos</div>
      <div class="flex items-center gap-3 mt-2">
        <div><div class="mono text-[22px] font-extrabold">${state.sessions.filter((x) => x.endedAt).length}</div><div class="text-tiny text-dim">sesiones</div></div>
        <div><div class="mono text-[22px] font-extrabold">${state.exercises.length}</div><div class="text-tiny text-dim">ejercicios</div></div>
        <div><div class="mono text-[22px] font-extrabold">${state.routines.length}</div><div class="text-tiny text-dim">rutinas</div></div>
      </div>
      <button class="btn w-full ghost mt-3.5" data-act="tutorial">Ver el tutorial</button>
      <button class="btn w-full ghost mt-2" data-act="update">Buscar actualización de la app</button>
      <button class="btn w-full danger ghost mt-2" data-act="reset">Restaurar el plan original</button>
      <button class="btn w-full danger ghost mt-2" data-act="wipe">Borrar todo</button>
    </div>

    <div class="card bg-transparent border-dashed mb-7">
      <div class="text-small text-dim">Bitácora · basada en tu plan Push-Pull-Legs + Torso-Pierna. Guía general de entrenamiento, no consejo médico.
      Doble progresión: cuando llegás al techo de repeticiones en todas las series, subí 2,5 kg arriba / 5 kg abajo y volvé al piso del rango.</div>
    </div>
  </div>`
  );
}
