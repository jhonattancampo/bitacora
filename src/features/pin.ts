/* =========================================================
   features/pin.ts — The device PIN.

   It never leaves this device: it is not part of the state, it
   is not synced, and signing in on another phone does not carry
   it over. That is the point — it locks *this* screen, not the
   account.

   What is stored is a hash, so the code is not sitting in
   localStorage in the clear. It is a djb2 hash and not a real
   password KDF, and it does not pretend to be one: anything with
   access to this device's storage can brute-force four digits.
   The PIN keeps a screen private from whoever picks up the
   phone, not from an attacker with the disk.

   La pantalla de bloqueo esta al final del archivo.
   ========================================================= */
import { $ } from "../lib/dom";
import { render } from "../ui/shell";
import { toast } from "../ui/toast";
import { maybeStartTour } from "./tour";
import type { ActionMap } from "../events/types";

const PIN_KEY = "bitacora_pin_v1";

/** djb2, kept exactly as it was: changing it would lock out every existing PIN. */
export function pinHash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return String(h);
}

function pinInfo(): { h: string } | null {
  try {
    return JSON.parse(localStorage.getItem(PIN_KEY) || "null");
  } catch (e) {
    return null;
  }
}

/** Whether this device has a PIN set. Ajustes asks before drawing its buttons. */
export function pinIsSet(): boolean {
  return !!pinInfo();
}

export function pinSet(code: string): void {
  try {
    localStorage.setItem(PIN_KEY, JSON.stringify({ h: pinHash(code) }));
  } catch (e) {
    /* sin almacenamiento no hay PIN que guardar */
  }
}

export function pinClear(): void {
  try {
    localStorage.removeItem(PIN_KEY);
  } catch (e) {
    /* nada que borrar */
  }
}

export function pinCheck(code: string): boolean {
  const i = pinInfo();
  return !!i && i.h === pinHash(code);
}

/* ---------- la pantalla de bloqueo ---------- */

/** En que paso esta la pantalla de bloqueo. */
type LockMode = "unlock" | "setup1" | "setup2" | "disable";

let lockMode: LockMode = "unlock";
let lockTemp = "";
export function showLock(mode: LockMode): void {
  lockMode = mode;
  if (mode !== "setup2") lockTemp = "";
  const titles: Record<LockMode, string> = {
    unlock: "Ingresá tu PIN",
    setup1: "Elegí un PIN (4 a 8 dígitos)",
    setup2: "Repetí el PIN",
    disable: "Ingresá tu PIN para desactivar",
  };
  $("#lockTitle").textContent = titles[mode];
  $("#lockMsg").textContent = "";
  $("#lockInput").value = "";
  $("#lock").classList.add("on");
  setTimeout(() => $("#lockInput").focus(), 50);
}
function hideLock() {
  $("#lock").classList.remove("on");
}
function lockSubmit() {
  const val = $("#lockInput").value.trim();
  if (val.length < 4) {
    $("#lockMsg").textContent = "Mínimo 4 dígitos.";
    return;
  }
  if (lockMode === "unlock") {
    if (pinCheck(val)) {
      hideLock();
      maybeStartTour();
    } else {
      $("#lockMsg").textContent = "PIN incorrecto.";
      $("#lockInput").value = "";
    }
    return;
  }
  if (lockMode === "setup1") {
    lockTemp = val;
    showLock("setup2");
    return;
  }
  if (lockMode === "setup2") {
    if (val !== lockTemp) {
      $("#lockMsg").textContent = "No coincide. Empezá de nuevo.";
      showLock("setup1");
      return;
    }
    pinSet(val);
    hideLock();
    toast("PIN activado");
    render();
    return;
  }
  if (lockMode === "disable") {
    if (pinCheck(val)) {
      pinClear();
      hideLock();
      toast("PIN desactivado");
      render();
    } else {
      $("#lockMsg").textContent = "PIN incorrecto.";
      $("#lockInput").value = "";
    }
    return;
  }
}
/**
 * Cuelga los listeners de la pantalla de bloqueo. La llama el arranque.
 *
 * Antes esto pasaba al importar el modulo. Colgarlos aca en vez de al vuelo
 * tiene dos ventajas: el modulo se puede importar sin que exista el HTML de
 * la app — que es lo que necesitan los tests — y queda a la vista que el
 * arranque es quien enciende cada cosa.
 */
export function initPinLock(): void {
  $("#lockGo").addEventListener("click", lockSubmit);
  $("#lockInput").addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key === "Enter") lockSubmit();
  });

  /* Al volver a la app despues de dejarla en segundo plano, el PIN se vuelve
     a pedir. Es lo unico que separa la bitacora de quien levanta el telefono
     de la mesa. */
  let appWasHidden = false;
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      appWasHidden = true;
    } else if (appWasHidden && pinIsSet()) {
      appWasHidden = false;
      showLock("unlock");
    }
  });
}

let appWasHidden = false;
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    appWasHidden = true;
  } else if (appWasHidden && pinIsSet()) {
    appWasHidden = false;
    showLock("unlock");
  }
});

export const pinActions: ActionMap = {
  /* Activar y cambiar son el mismo flujo: elegir un PIN y repetirlo. Cambiar
     no pide el anterior — quien ya esta adentro de la app ya paso el PIN. */
  "pin-enable": () => showLock("setup1"),
  "pin-change": () => showLock("setup1"),
  "pin-disable": () => showLock("disable"),
};
