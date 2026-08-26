/* =========================================================
   features/tour.ts — El recorrido guiado de la primera vez.

   Trece pasos que apuntan a un elemento real de la pantalla:
   navega solo a la vista que hace falta, resalta el elemento
   recortando una mascara de cuatro rectangulos a su alrededor,
   y acomoda la tarjeta arriba o abajo segun donde haya lugar.

   Un paso cuyo elemento no esta visible se saltea en la
   direccion en la que ibas: en una instalacion nueva no hay
   sesion en curso, y los pasos de la serie y del cronometro no
   tienen a que apuntar.
   ========================================================= */
import { $ } from "../lib/dom";
import { state } from "../state/store";
import { closeSheet } from "../ui/sheet";
import { render, setView, view } from "../ui/shell";
import { sheetRoutine } from "../views/rutinas";

/** Marca de "ya lo vio", para no repetirlo en cada arranque. */
const TOUR_SEEN_KEY = "bitacora_tutorial_seen";
const TOUR_STEPS = [
  {
    view: null,
    selector: null,
    title: "Bienvenido a Bitácora",
    text: "Registrá tus entrenamientos, seguí tu progreso y no perdés nada aunque cambies de teléfono. Este recorrido dura menos de un minuto y podés repetirlo cuando quieras desde Ajustes.",
  },
  {
    view: null,
    selector: "nav",
    title: "Las 5 pestañas",
    text: "Entrenar arranca tu sesión de hoy. Rutinas son tus plantillas. Ejercicios es tu biblioteca con fotos. Progreso muestra tus gráficos. Ajustes tiene cuenta, PIN, tema y backup.",
  },
  {
    view: "train",
    selector: '.card[data-act="start"]',
    title: "Elegí tu sesión",
    text: "Tocá una rutina para arrancar. Bitácora carga automáticamente los ejercicios, series y objetivos que definiste para ese día.",
  },
  {
    view: "train",
    selector: ".setrow",
    title: "Anotá cada serie",
    text: "Cargá peso, reps y RIR, y tocá ✓ para marcarla como hecha. Lo que ves en gris es lo que hiciste la vez pasada, para que sepas contra qué superarte.",
  },
  {
    view: "train",
    selector: "#timer",
    title: "Descanso automático",
    text: "Al marcar una serie, el cronómetro de descanso arranca solo acá abajo. Podés sumar o restar 15 segundos, o saltarlo con Listo.",
  },
  {
    view: "train",
    selector: ".exnum.ss",
    title: "Superseries",
    text: "Si ves una letra en vez de un número, esos ejercicios van encadenados sin descanso entre uno y otro: es una superserie.",
  },
  {
    view: "routines",
    selector: ".card",
    title: "Tus rutinas",
    text: "Editá los ejercicios, series y objetivos de cada rutina, o duplicala para armar una variante sin tocar la original.",
  },
  {
    view: "routines",
    before: () => {
      const r = state.routines[0];
      sheetRoutine(r ? r.id : null);
    },
    selector: () => {
      const b = document.querySelector('[data-act="ri-add"]');
      return b ? b.parentElement : null;
    },
    title: "Sumar ejercicios",
    text: "Desde una rutina agregás ejercicios de tu biblioteca, o buscás entre los 873 de la base pública con fotos incluidas.",
  },
  {
    view: "exercises",
    selector: '.li [data-act="guide"]',
    title: "Guía de ejecución",
    text: "Tocá cualquier ejercicio para ver fotos, los pasos de ejecución y tu historial con ese movimiento.",
  },
  {
    view: "exercises",
    selector: '[data-act="x-search-db-lib"]',
    title: "873 ejercicios más",
    text: "Si no encontrás el ejercicio que buscás en tu biblioteca, explorá la base pública: trae fotos de la posición inicial y final.",
  },
  {
    view: "progress",
    selector: () => {
      const b = document.querySelector('[data-act="ptab"]');
      return b ? b.parentElement : null;
    },
    title: "Cuatro formas de ver tu progreso",
    text: "Ejercicio muestra tu 1RM estimado, Volumen tus series por grupo muscular, Historial tus sesiones pasadas y Peso corporal tu evolución de peso.",
  },
  {
    view: "settings",
    selector: null,
    title: "Tu cuenta, tus reglas",
    text: "Desde Ajustes sincronizás tus datos, activás un PIN para bloquear la app, elegís tema y color, y hacés una copia de seguridad de todo.",
  },
  {
    view: null,
    selector: null,
    cta: "Empezar a entrenar",
    title: "Listo para arrancar",
    text: "Eso es todo. Podés repetir este recorrido cuando quieras desde Ajustes → Ver el tutorial.",
  },
];
export let tourActive = false;
let tourIdx = 0;
export function maybeStartTour() {
  if (tourActive) return;
  let seen = false;
  try {
    seen = !!localStorage.getItem(TOUR_SEEN_KEY);
  } catch (e) {}
  if (seen) return;
  startTour();
}
export function startTour() {
  if ($("#lock").classList.contains("on")) return;
  tourActive = true;
  $("#tour").classList.add("on");
  window.addEventListener("resize", onTourResize);
  window.addEventListener("orientationchange", onTourResize);
  tourGoTo(0, 1);
}
export function endTour() {
  tourActive = false;
  $("#tour").classList.remove("on");
  window.removeEventListener("resize", onTourResize);
  window.removeEventListener("orientationchange", onTourResize);
  try {
    localStorage.setItem(TOUR_SEEN_KEY, "1");
  } catch (e) {}
}
function tourResolveTarget(step) {
  try {
    return typeof step.selector === "function"
      ? step.selector()
      : document.querySelector(step.selector);
  } catch (e) {
    return null;
  }
}
function tourVisible(el) {
  if (!el || !el.isConnected) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}
export function tourGoTo(idx, dir) {
  if (idx < 0) return;
  if (idx >= TOUR_STEPS.length) {
    endTour();
    return;
  }
  const step = TOUR_STEPS[idx];
  if (step.view && step.view !== view) {
    const btn = document.querySelector('.nb[data-v="' + step.view + '"]');
    if (btn) (btn as HTMLElement).click();
    else closeSheet();
  } else closeSheet();
  if (step.before) step.before();
  const target = step.selector ? tourResolveTarget(step) : null;
  if (step.selector && !tourVisible(target)) {
    tourGoTo(idx + dir, dir);
    return;
  }
  if (target) target.scrollIntoView({ block: "center", inline: "center" });
  tourIdx = idx;
  showTourCard(step, target);
}
function showTourCard(step, target) {
  $("#tourProgress").textContent = tourIdx + 1 + " / " + TOUR_STEPS.length;
  $("#tourTitle").textContent = step.title;
  $("#tourText").textContent = step.text;
  const isLast = tourIdx === TOUR_STEPS.length - 1;
  const nextBtn = $('[data-act="tour-next"]');
  nextBtn.textContent = isLast ? step.cta || "Entendido" : "Siguiente";
  $('[data-act="tour-prev"]').disabled = tourIdx === 0;
  tourLayout(target ? target.getBoundingClientRect() : null);
  nextBtn.focus();
}
function onTourResize() {
  if (!tourActive) return;
  const step = TOUR_STEPS[tourIdx];
  const target = step.selector ? tourResolveTarget(step) : null;
  tourLayout(target ? target.getBoundingClientRect() : null);
}
function tourLayout(rect) {
  const vw = innerWidth,
    vh = innerHeight,
    pad = 8,
    margin = 12;
  const top = $("#tour .tourmask.top"),
    bottom = $("#tour .tourmask.bottom"),
    left = $("#tour .tourmask.left"),
    right = $("#tour .tourmask.right");
  const ring = $("#tourring"),
    card = $("#tourcard");
  let box = null;
  if (
    rect &&
    rect.width > 0 &&
    rect.height > 0 &&
    rect.bottom > 0 &&
    rect.right > 0 &&
    rect.top < vh &&
    rect.left < vw
  ) {
    const x = Math.max(rect.left - pad, 0),
      y = Math.max(rect.top - pad, 0);
    const w = Math.min(rect.width + pad * 2, vw - x),
      h = Math.min(rect.height + pad * 2, vh - y);
    box = { x, y, w, h };
  }
  if (!box) {
    top.style.cssText = "left:0;top:0;width:100%;height:100%";
    [bottom, left, right].forEach((m) => (m.style.cssText = "width:0;height:0"));
    ring.style.display = "none";
    card.classList.add("floating");
    card.style.top = "";
    card.style.left = "";
    return;
  }
  card.classList.remove("floating");
  const cr = card.getBoundingClientRect();
  top.style.cssText = `left:0;top:0;width:100%;height:${box.y}px`;
  bottom.style.cssText = `left:0;top:${box.y + box.h}px;width:100%;height:${Math.max(vh - box.y - box.h, 0)}px`;
  left.style.cssText = `left:0;top:${box.y}px;width:${box.x}px;height:${box.h}px`;
  right.style.cssText = `left:${box.x + box.w}px;top:${box.y}px;width:${Math.max(vw - box.x - box.w, 0)}px;height:${box.h}px`;
  ring.style.cssText = `display:block;left:${box.x}px;top:${box.y}px;width:${box.w}px;height:${box.h}px`;
  const spaceBelow = vh - (box.y + box.h),
    spaceAbove = box.y;
  let cardTop =
    spaceBelow >= cr.height + margin || spaceBelow >= spaceAbove
      ? box.y + box.h + margin
      : box.y - cr.height - margin;
  cardTop = Math.max(margin, Math.min(cardTop, vh - cr.height - margin));
  let cardLeft = box.x + box.w / 2 - cr.width / 2;
  cardLeft = Math.max(margin, Math.min(cardLeft, vw - cr.width - margin));
  card.style.top = cardTop + "px";
  card.style.left = cardLeft + "px";
}

/** Avanza un paso; en el ultimo, cierra el recorrido y vuelve a Entrenar. */
export function tourNext(): void {
  if (tourIdx >= TOUR_STEPS.length - 1) {
    endTour();
    setView("train");
    render();
    return;
  }
  tourGoTo(tourIdx + 1, 1);
}

/** Retrocede un paso. En el primero no hace nada: el boton esta deshabilitado. */
export function tourPrev(): void {
  tourGoTo(tourIdx - 1, -1);
}
