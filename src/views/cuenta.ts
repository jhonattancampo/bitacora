/* =========================================================
   views/cuenta.ts — The account card at the top of Ajustes and
   the sign-in sheet behind it.

   Everything here reads `window.Sync`, which is published by
   sync.ts. It stays a global rather than an import so the two
   modules do not have to import each other.
   ========================================================= */
import { $, esc } from "../lib/dom";
import { openSheet } from "../ui/sheet";

function syncBadge() {
  const S: any = window.Sync ? Sync.state : { status: "unconfigured" };
  const map: Record<string, string[]> = {
    ok: ["ok", "Al día"],
    syncing: ["sig", "Sincronizando…"],
    offline: ["", "Sin conexión"],
    error: ["", "Error"],
    local: ["", "Solo este dispositivo"],
    unconfigured: ["", "Solo este dispositivo"],
  };
  const [cls, txt] = map[S.status] || ["", ""];
  return `<span class="chip ${cls}">${esc(S.msg || txt)}</span>`;
}
export function accountCard() {
  const S: any = window.Sync ? Sync.state : { status: "unconfigured" };
  if (S.status === "unconfigured") {
    return `<div class="card">
      <div class="eyebrow">Cuenta</div>
      <div class="text-small text-dim mt-1">La sincronización está apagada porque falta cargar las claves de Firebase en <span class="mono">config.js</span>. La app funciona igual: los datos quedan guardados en este dispositivo.</div>
    </div>`;
  }
  if (!S.user) {
    return `<div class="card">
      <div class="between"><div class="eyebrow">Cuenta</div>${syncBadge()}</div>
      <div class="text-small text-dim mt-1 mx-0 mb-2.5">Iniciá sesión para que tu historial se guarde en la nube y lo tengas en cualquier dispositivo.</div>
      <button class="btn w-full primary" data-act="auth-open">Entrar o crear cuenta</button>
    </div>`;
  }
  const lp = window.Sync && Sync.lastPull ? Sync.lastPull() : null;
  const lpTxt = lp
    ? new Date(lp).toLocaleString("es-AR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "nunca";
  return `<div class="card">
    <div class="between"><div class="eyebrow">Cuenta</div>${syncBadge()}</div>
    <div class="h3 mt-1">${esc(S.user.email || "")}</div>
    <div class="text-tiny text-dim">${S.last ? "Última sincronización: " + new Date(S.last).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }) : "Todavía no sincronizó"}</div>
    <div class="text-tiny text-dim">Último intercambio con la nube: ${esc(lpTxt)}</div>
    <div class="grid grid-cols-2 gap-2.5 mt-2.5">
      <button class="btn" data-act="sync-now">Sincronizar ahora</button>
      <button class="btn ghost" data-act="auth-out">Cerrar sesión</button>
    </div>
  </div>`;
}
export function sheetAuth(mode: string): void {
  const reg = mode === "reg";
  openSheet(`<div class="between"><div class="h2">${reg ? "Crear cuenta" : "Entrar"}</div><button class="btn sm ghost" data-act="closesheet">Cerrar</button></div>
    <label class="f"><span class="eyebrow">Email</span><input type="text" id="auEmail" inputmode="email" autocapitalize="none" autocomplete="email" placeholder="vos@email.com"></label>
    <label class="f"><span class="eyebrow">Contraseña</span><input type="password" id="auPass" autocomplete="${reg ? "new-password" : "current-password"}" placeholder="mínimo 6 caracteres"></label>
    <div id="auErr" class="warn hidden mt-2.5"></div>
    <button class="btn w-full primary mt-3.5" data-act="${reg ? "auth-signup" : "auth-signin"}">${reg ? "Crear cuenta" : "Entrar"}</button>
    <button class="btn w-full ghost mt-2" data-act="auth-toggle" data-m="${reg ? "in" : "reg"}">${reg ? "Ya tengo cuenta" : "Crear una cuenta nueva"}</button>
    ${reg ? "" : '<button class="btn w-full ghost mt-2" data-act="auth-reset">Olvidé la contraseña</button>'}
    <div class="flex items-center gap-2.5 my-4 mx-0"><hr class="border-t border-line my-3 flex-1 m-0"><span class="text-tiny text-dim">o</span><hr class="border-t border-line my-3 flex-1 m-0"></div>
    <button class="btn w-full" data-act="auth-google">
      <svg class="mr-0.5" width="17" height="17" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.56 2.7-3.87 2.7-6.62z"/><path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.96v2.33A9 9 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.03l2.99-2.33z"/><path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.97l2.99 2.33C4.66 5.17 6.65 3.58 9 3.58z"/></svg>
      Continuar con Google
    </button>
    <div class="text-tiny text-dim mt-3.5 mx-0 mb-1">Al entrar, lo que ya tengas en la nube se descarga y se junta con lo de este dispositivo. Nada se pisa sin avisar.</div>`);
}
export function authErr(e: { code?: string; message?: string }): void {
  const c = (e && e.code) || "";
  const map: Record<string, string> = {
    "auth/invalid-email": "Ese email no es válido.",
    "auth/missing-password": "Falta la contraseña.",
    "auth/weak-password": "La contraseña necesita al menos 6 caracteres.",
    "auth/email-already-in-use": "Ya existe una cuenta con ese email. Entrá en vez de crearla.",
    "auth/invalid-credential": "Email o contraseña incorrectos.",
    "auth/wrong-password": "Contraseña incorrecta.",
    "auth/user-not-found": "No hay cuenta con ese email.",
    "auth/network-request-failed": "Sin conexión. Probá de nuevo con internet.",
    "auth/too-many-requests": "Demasiados intentos. Esperá un rato.",
    "auth/operation-not-allowed": "Falta habilitar Email/Contraseña en la consola de Firebase.",
    "auth/popup-closed-by-user": "Cerraste la ventana antes de terminar. Probá de nuevo.",
    "auth/popup-blocked":
      "El navegador bloqueó la ventana emergente. Permitila e intentá de nuevo.",
    "auth/cancelled-popup-request": "Ventana cancelada, probá de nuevo.",
    "auth/unauthorized-domain": "Este dominio no está autorizado en Firebase todavía.",
  };
  const el = $("#auErr");
  if (el) {
    el.style.display = "block";
    el.textContent = map[c] || "No se pudo: " + (c || (e && e.message) || "error desconocido");
  }
}
