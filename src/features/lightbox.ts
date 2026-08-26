/* =========================================================
   features/lightbox.ts — Ver una foto de ejecucion en grande.

   No se abre durante el tour: el recorrido guiado dibuja su
   propia mascara sobre la pantalla, y una foto a pantalla
   completa encima la taparia.
   ========================================================= */
import { clamp } from "../lib/calc";
import { $, esc } from "../lib/dom";
import { tourActive } from "./tour";

let lbImgs: string[] = [];
let lbIdx = 0;
export function openLightbox(imgs, idx) {
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
$("#lightbox").addEventListener("click", (ev) => {
  if (ev.target.id === "lightbox") closeLightbox();
});
document.addEventListener("keydown", (ev) => {
  if (ev.key === "Escape" && $("#lightbox").classList.contains("on")) closeLightbox();
});

/** Mueve el visor `d` fotos, dando la vuelta en los extremos. */
export function stepLightbox(d: number): void {
  lbIdx = (lbIdx + d + lbImgs.length) % lbImgs.length;
  renderLightbox();
}
