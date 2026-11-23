/* =========================================================
   nutrition/data/foods.ts — The local catalog: the foods an
   Argentine lifter actually logs, with real numbers.

   This is the first step of the pipeline, so it is worth
   curating. Three rules keep it honest:

   - `basis` says how a food is counted. Weighed foods are
     per100g, drinks and oils per100ml, and only things that
     are genuinely counted (an egg, a slice, a pot, a scoop)
     are perUnit. That choice decides whether "2 rebanadas de
     pan" is read as 2 units or as grams.
   - Every perUnit food carries `unitGrams`, otherwise asking
     for it in grams has nothing to convert with.
   - Names must stay distinguishable by the search in
     domain/search.ts. A catalog test holds that line; when
     two names collide, rename or alias one of them.

   Values are typical reference figures, rounded. They are
   meant for logging, not for clinical use.
   ========================================================= */

import type { Food } from "../domain/types";

export const FOODS: Food[] = [
  // Meats and fish
  {
    id: "pechuga-pollo-cocida",
    name: "Pechuga de pollo cocida",
    aliases: ["suprema"],
    basis: "per100g",
    macros: { kcal: 165, protein: 31, carbs: 0, fat: 3.6 },
  },
  {
    id: "muslo-pollo-cocido",
    name: "Muslo de pollo cocido",
    basis: "per100g",
    macros: { kcal: 209, protein: 26, carbs: 0, fat: 11 },
  },
  {
    id: "pechuga-pavo-cocida",
    name: "Pechuga de pavo cocida",
    basis: "per100g",
    macros: { kcal: 135, protein: 30, carbs: 0, fat: 1.5 },
  },
  {
    id: "bife-lomo-cocido",
    name: "Bife de lomo cocido",
    basis: "per100g",
    macros: { kcal: 215, protein: 29, carbs: 0, fat: 10 },
  },
  {
    id: "carne-picada-magra-cocida",
    name: "Carne picada magra cocida",
    basis: "per100g",
    macros: { kcal: 220, protein: 27, carbs: 0, fat: 12 },
  },
  {
    id: "asado-tira-cocido",
    name: "Asado de tira cocido",
    aliases: ["parrilla"],
    basis: "per100g",
    macros: { kcal: 300, protein: 25, carbs: 0, fat: 22 },
  },
  {
    id: "bondiola-cerdo-cocida",
    name: "Bondiola de cerdo cocida",
    basis: "per100g",
    macros: { kcal: 260, protein: 25, carbs: 0, fat: 17 },
  },
  {
    id: "milanesa-carne-horno",
    name: "Milanesa de carne al horno",
    basis: "per100g",
    macros: { kcal: 230, protein: 20, carbs: 14, fat: 10 },
  },
  {
    id: "jamon-cocido",
    name: "Jamón cocido",
    basis: "per100g",
    macros: { kcal: 110, protein: 17, carbs: 1.5, fat: 4 },
  },
  {
    id: "salmon-cocido",
    name: "Salmón cocido",
    basis: "per100g",
    macros: { kcal: 208, protein: 22, carbs: 0, fat: 13 },
  },
  {
    id: "merluza-cocida",
    name: "Merluza cocida",
    basis: "per100g",
    macros: { kcal: 90, protein: 19, carbs: 0, fat: 1.5 },
  },
  {
    id: "atun-lata",
    name: "Atún al natural en lata",
    basis: "perUnit",
    unitGrams: 120,
    macros: { kcal: 110, protein: 26, carbs: 0, fat: 1 },
  },

  // Eggs and dairy
  {
    id: "huevo",
    name: "Huevo",
    basis: "perUnit",
    unitGrams: 50,
    macros: { kcal: 72, protein: 6.3, carbs: 0.4, fat: 4.8 },
  },
  {
    id: "clara-huevo",
    name: "Clara de huevo",
    basis: "perUnit",
    unitGrams: 33,
    macros: { kcal: 17, protein: 3.6, carbs: 0.2, fat: 0.1 },
  },
  {
    id: "leche-entera",
    name: "Leche entera",
    basis: "per100ml",
    macros: { kcal: 61, protein: 3.2, carbs: 4.7, fat: 3.3 },
  },
  {
    id: "leche-descremada",
    name: "Leche descremada",
    basis: "per100ml",
    macros: { kcal: 35, protein: 3.4, carbs: 4.9, fat: 0.1 },
  },
  {
    id: "yogur-descremado",
    name: "Yogur descremado",
    basis: "perUnit",
    unitGrams: 190,
    macros: { kcal: 100, protein: 7, carbs: 14, fat: 1.5 },
  },
  {
    id: "queso-cremoso",
    name: "Queso cremoso",
    basis: "per100g",
    macros: { kcal: 300, protein: 19, carbs: 2, fat: 24 },
  },
  {
    id: "queso-port-salut",
    name: "Queso port salut",
    basis: "per100g",
    macros: { kcal: 330, protein: 23, carbs: 1, fat: 26 },
  },
  {
    id: "ricota",
    name: "Ricota",
    basis: "per100g",
    macros: { kcal: 174, protein: 11, carbs: 3, fat: 13 },
  },
  {
    id: "whey-protein",
    name: "Proteína whey",
    basis: "perUnit",
    unitGrams: 30,
    macros: { kcal: 120, protein: 24, carbs: 3, fat: 1.5 },
  },

  // Grains and legumes
  {
    id: "arroz-blanco-cocido",
    name: "Arroz blanco cocido",
    basis: "per100g",
    macros: { kcal: 130, protein: 2.7, carbs: 28, fat: 0.3 },
  },
  {
    id: "arroz-integral-cocido",
    name: "Arroz integral cocido",
    basis: "per100g",
    macros: { kcal: 123, protein: 2.7, carbs: 26, fat: 1 },
  },
  {
    id: "fideos-cocidos",
    name: "Fideos cocidos",
    aliases: ["pasta", "tallarines"],
    basis: "per100g",
    macros: { kcal: 158, protein: 5.8, carbs: 31, fat: 0.9 },
  },
  {
    id: "avena-arrollada",
    name: "Avena arrollada",
    basis: "per100g",
    macros: { kcal: 379, protein: 13, carbs: 67, fat: 6.5 },
  },
  {
    id: "lentejas-cocidas",
    name: "Lentejas cocidas",
    basis: "per100g",
    macros: { kcal: 116, protein: 9, carbs: 20, fat: 0.4 },
  },
  {
    id: "garbanzos-cocidos",
    name: "Garbanzos cocidos",
    basis: "per100g",
    macros: { kcal: 164, protein: 9, carbs: 27, fat: 2.6 },
  },
  {
    id: "porotos-cocidos",
    name: "Porotos cocidos",
    aliases: ["frijoles"],
    basis: "per100g",
    macros: { kcal: 127, protein: 8.7, carbs: 23, fat: 0.5 },
  },
  {
    id: "quinoa-cocida",
    name: "Quinoa cocida",
    basis: "per100g",
    macros: { kcal: 120, protein: 4.4, carbs: 21, fat: 1.9 },
  },
  {
    id: "papa-hervida",
    name: "Papa hervida",
    basis: "per100g",
    macros: { kcal: 87, protein: 1.9, carbs: 20, fat: 0.1 },
  },
  {
    id: "batata-hervida",
    name: "Batata hervida",
    aliases: ["camote"],
    basis: "per100g",
    macros: { kcal: 90, protein: 2, carbs: 21, fat: 0.1 },
  },

  // Breads and crackers
  {
    id: "pan-lactal",
    name: "Pan lactal",
    aliases: ["molde", "tostada"],
    basis: "perUnit",
    unitGrams: 25,
    macros: { kcal: 66, protein: 2.3, carbs: 12, fat: 0.8 },
  },
  {
    id: "pan-integral-lactal",
    name: "Pan integral lactal",
    aliases: ["molde", "tostada"],
    basis: "perUnit",
    unitGrams: 28,
    macros: { kcal: 70, protein: 3, carbs: 12, fat: 1 },
  },
  {
    id: "pan-frances",
    name: "Pan francés",
    basis: "per100g",
    macros: { kcal: 270, protein: 9, carbs: 55, fat: 1.5 },
  },
  {
    id: "galletitas-agua",
    name: "Galletitas de agua",
    basis: "per100g",
    macros: { kcal: 427, protein: 10, carbs: 72, fat: 11 },
  },

  // Fruit
  {
    id: "banana",
    name: "Banana",
    aliases: ["platano"],
    basis: "perUnit",
    unitGrams: 120,
    macros: { kcal: 110, protein: 1.3, carbs: 26, fat: 0.4 },
  },
  {
    id: "manzana",
    name: "Manzana",
    basis: "perUnit",
    unitGrams: 180,
    macros: { kcal: 95, protein: 0.5, carbs: 25, fat: 0.3 },
  },
  {
    id: "naranja",
    name: "Naranja",
    basis: "perUnit",
    unitGrams: 150,
    macros: { kcal: 62, protein: 1.2, carbs: 15.4, fat: 0.2 },
  },
  {
    id: "frutilla",
    name: "Frutilla",
    aliases: ["fresa"],
    basis: "per100g",
    macros: { kcal: 33, protein: 0.7, carbs: 7.7, fat: 0.3 },
  },
  {
    id: "uva",
    name: "Uva",
    basis: "per100g",
    macros: { kcal: 72, protein: 0.7, carbs: 18, fat: 0.2 },
  },
  {
    id: "palta",
    name: "Palta",
    aliases: ["aguacate"],
    basis: "per100g",
    macros: { kcal: 160, protein: 2, carbs: 8.5, fat: 14.7 },
  },

  // Vegetables
  {
    id: "tomate",
    name: "Tomate",
    basis: "per100g",
    macros: { kcal: 18, protein: 0.9, carbs: 3.9, fat: 0.2 },
  },
  {
    id: "lechuga",
    name: "Lechuga",
    basis: "per100g",
    macros: { kcal: 15, protein: 1.4, carbs: 2.9, fat: 0.2 },
  },
  {
    id: "zanahoria",
    name: "Zanahoria",
    basis: "per100g",
    macros: { kcal: 41, protein: 0.9, carbs: 9.6, fat: 0.2 },
  },
  {
    id: "brocoli",
    name: "Brócoli",
    basis: "per100g",
    macros: { kcal: 34, protein: 2.8, carbs: 7, fat: 0.4 },
  },
  {
    id: "cebolla",
    name: "Cebolla",
    basis: "per100g",
    macros: { kcal: 40, protein: 1.1, carbs: 9.3, fat: 0.1 },
  },
  {
    id: "espinaca",
    name: "Espinaca",
    basis: "per100g",
    macros: { kcal: 23, protein: 2.9, carbs: 3.6, fat: 0.4 },
  },
  {
    id: "zapallo",
    name: "Zapallo",
    basis: "per100g",
    macros: { kcal: 26, protein: 1, carbs: 6.5, fat: 0.1 },
  },

  // Nuts
  {
    id: "almendras",
    name: "Almendras",
    basis: "per100g",
    macros: { kcal: 600, protein: 21, carbs: 22, fat: 50 },
  },
  {
    id: "nueces",
    name: "Nueces",
    basis: "per100g",
    macros: { kcal: 654, protein: 15, carbs: 14, fat: 65 },
  },
  {
    id: "mani",
    name: "Maní",
    basis: "per100g",
    macros: { kcal: 590, protein: 26, carbs: 16, fat: 49 },
  },
  {
    id: "crema-mani",
    name: "Crema de maní",
    basis: "per100g",
    macros: { kcal: 600, protein: 25, carbs: 20, fat: 50 },
  },

  // Oils and condiments
  {
    id: "aceite-oliva",
    name: "Aceite de oliva",
    basis: "per100ml",
    macros: { kcal: 828, protein: 0, carbs: 0, fat: 92 },
  },
  {
    id: "manteca",
    name: "Manteca",
    basis: "per100g",
    macros: { kcal: 717, protein: 0.9, carbs: 0.1, fat: 81 },
  },
  {
    id: "azucar",
    name: "Azúcar",
    basis: "per100g",
    macros: { kcal: 387, protein: 0, carbs: 100, fat: 0 },
  },
  {
    id: "miel",
    name: "Miel",
    basis: "per100g",
    macros: { kcal: 304, protein: 0.3, carbs: 82, fat: 0 },
  },
  {
    id: "dulce-de-leche",
    name: "Dulce de leche",
    basis: "per100g",
    macros: { kcal: 320, protein: 6, carbs: 55, fat: 8 },
  },
  {
    id: "mayonesa",
    name: "Mayonesa",
    basis: "per100g",
    macros: { kcal: 680, protein: 1, carbs: 0.6, fat: 75 },
  },

  // Supplements, snacks and drinks
  {
    id: "creatina",
    name: "Creatina monohidratada",
    basis: "perUnit",
    unitGrams: 5,
    macros: { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  },
  {
    id: "alfajor",
    name: "Alfajor",
    basis: "perUnit",
    unitGrams: 50,
    macros: { kcal: 220, protein: 2, carbs: 32, fat: 9 },
  },
  {
    id: "barra-cereal",
    name: "Barra de cereal",
    basis: "perUnit",
    unitGrams: 25,
    macros: { kcal: 100, protein: 1.5, carbs: 18, fat: 2.5 },
  },
  {
    id: "chocolate-amargo",
    name: "Chocolate amargo",
    basis: "per100g",
    macros: { kcal: 540, protein: 7, carbs: 46, fat: 35 },
  },
  {
    id: "papas-fritas-paquete",
    name: "Papas fritas de paquete",
    basis: "per100g",
    macros: { kcal: 536, protein: 6, carbs: 53, fat: 34 },
  },
  {
    id: "medialuna",
    name: "Medialuna",
    basis: "perUnit",
    unitGrams: 55,
    macros: { kcal: 220, protein: 4, carbs: 25, fat: 11 },
  },
  {
    id: "empanada-carne",
    name: "Empanada de carne",
    basis: "perUnit",
    unitGrams: 100,
    macros: { kcal: 250, protein: 9, carbs: 25, fat: 13 },
  },
  {
    id: "jugo-naranja",
    name: "Jugo de naranja",
    basis: "per100ml",
    macros: { kcal: 45, protein: 0.7, carbs: 10, fat: 0.2 },
  },
];
