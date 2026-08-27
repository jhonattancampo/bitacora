/* =========================================================
   features/cuenta.ts — Entrar, crear cuenta, salir y
   sincronizar a mano.

   Todo pasa por `window.Sync`, publicado por sync.ts. Los
   botones se apagan mientras hay una llamada en curso: sin eso,
   dos toques seguidos mandan dos pedidos.
   ========================================================= */
import { $ } from "../lib/dom";
import { closeSheet } from "../ui/sheet";
import { render } from "../ui/shell";
import { toast } from "../ui/toast";
import { authErr, sheetAuth } from "../views/cuenta";
import type { ActionContext, ActionMap } from "../events/types";

export const accountActions: ActionMap = {
  "auth-open": () => sheetAuth("in"),
  "auth-toggle": ({ el }) => sheetAuth(el.dataset.m),

  "auth-signin": authWithPassword,
  "auth-signup": authWithPassword,

  "auth-google": ({ el }) => {
    el.disabled = true;
    Sync.signInGoogle()
      .then(() => {
        closeSheet();
        toast("Sesión iniciada");
        render();
      })
      .catch((e) => {
        authErr(e);
        el.disabled = false;
      });
  },

  "auth-reset": () => {
    const em = $("#auEmail").value.trim();
    if (!em) {
      authErr({ code: "auth/invalid-email" });
      return;
    }
    Sync.reset(em)
      .then(() => toast("Te mandamos un mail para recuperarla"))
      .catch(authErr);
  },

  "auth-out": () => {
    if (!confirm("Se cierra la sesión. Los datos quedan en la nube y también en este dispositivo."))
      return;
    void Sync.signOut().then(() => {
      toast("Sesión cerrada");
      render();
    });
  },

  "sync-now": () => {
    void Sync.run("manual");
    toast("Sincronizando…");
  },
};

/**
 * Entrar y crear cuenta son el mismo formulario y el mismo cuerpo: cambia a
 * que metodo de Sync se llama y que dice el boton si falla.
 */
function authWithPassword({ el, act }: ActionContext): void {
  const esAlta = act === "auth-signup";
  const em = $("#auEmail").value.trim(),
    pw = $("#auPass").value;
  if (!em || !pw) {
    authErr({ code: "auth/missing-password" });
    return;
  }
  el.textContent = "Un momento…";
  (esAlta ? Sync.signUp(em, pw) : Sync.signIn(em, pw))
    .then(() => {
      closeSheet();
      toast("Sesión iniciada");
      render();
    })
    .catch((e) => {
      authErr(e);
      el.textContent = esAlta ? "Crear cuenta" : "Entrar";
    });
}
