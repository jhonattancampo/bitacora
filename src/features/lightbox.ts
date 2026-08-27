/* =========================================================
   features/lightbox.ts — Ver una foto de ejecucion en grande.

   No se abre durante el tour: el recorrido guiado dibuja su
   propia mascara sobre la pantalla, y una foto a pantalla
   completa encima la taparia.
   ========================================================= */
import { clamp } from "../lib/calc";
import { $, esc } from "../lib/dom";
import { tourActive } from "./tour";
import type { ActionMap } from "../events/types";

let lbImgs: string[] = [];
let lbIdx = 0;
export function openLightbox(imgs: string[], idx: number): void {
  if (tourActive || !imgs || !imgs.length) return;
  lbImgs = imgs;
  lbIdx = clamp(idx || 0, 0, imgs.length - 1);
  renderLightbox();
  $("#lightbox").classList.add("on");
}
export function closeLightbox() {
  $("#lightbox").classList.remove("on");
}
export function renderLightbox() {
  $("#lbImgs").innerHTML =
    `<img src="${esc(lbImgs[lbIdx])}" alt="" onerror="this.style.display='none'">`;
  const many = lbImgs.length > 1;
  $("#lbPrev").style.display = many ? "flex" : "none";
  $("#lbNext").style.display = many ? "flex" : "none";
}
/** Cuelga los listeners del visor. La llama el arranque. */
export function initLightbox(): void {
  /* Tocar el fondo cierra; tocar la foto no. */
  $("#lightbox").addEventListener("click", (ev: any) => {
    if (ev.target.id === "lightbox") closeLightbox();
  });
  document.addEventListener("keydown", (ev: KeyboardEvent) => {
    if (ev.key === "Escape" && $("#lightbox").classList.contains("on")) closeLightbox();
  });
}
document.addEventListener("keydown", (ev) => {
  if (ev.key === "Escape" && $("#lightbox").classList.contains("on")) closeLightbox();
});

/** Mueve el visor `d` fotos, dando la vuelta en los extremos. */
export function stepLightbox(d: number): void {
  lbIdx = (lbIdx + d + lbImgs.length) % lbImgs.length;
  renderLightbox();
}

export const lightboxActions: ActionMap = {
  /* Las fotos viajan en un `data-photos` con JSON en el contenedor, no en
     cada img: asi el visor sabe cuales son sus hermanas para pasar de una a
     la siguiente. */
  photo: ({ el }) => {
    const group = el.closest("[data-photos]");
    if (!group) return;
    let imgs = [];
    try {
      imgs = JSON.parse(group.dataset.photos || "[]");
    } catch (e) {
      /* un data-photos roto no tiene que voltear el click */
    }
    openLightbox(imgs, +el.dataset.idx || 0);
  },
  "lightbox-close": () => closeLightbox(),
  "lightbox-prev": () => stepLightbox(-1),
  "lightbox-next": () => stepLightbox(1),
};
