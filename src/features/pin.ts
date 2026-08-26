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

   Only the storage side lives here so far. The lock screen
   itself is still in app.ts and lands in the next PR.
   ========================================================= */

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
