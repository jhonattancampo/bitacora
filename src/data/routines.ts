/* =========================================================
   data/routines.ts — The plan's own training days: which
   exercises, how many sets, what rep range, how long to rest.

   Same data app.ts always shipped. `SEED_ROUTINES()` is a
   function and not a constant because every item gets a fresh
   `uid()`: two calls must not hand out the same ids.
   ========================================================= */
import { uid } from "../lib/dom";
import type { Routine, RoutineItem } from "../types";

/** Shorthand the seed list is written in. Local on purpose: nothing else builds items this way. */
function I(
  exerciseId: string,
  sets: number,
  repsMin: number,
  repsMax: number,
  rir?: string,
  rest?: number,
  ss?: string,
  note?: string,
): RoutineItem {
  return {
    id: uid(),
    exerciseId,
    sets,
    repsMin,
    repsMax,
    rir: rir || "1-2",
    rest: rest || 90,
    ss: ss || "",
    note: note || "",
  };
}

export function SEED_ROUTINES(): Routine[] {
  return [
    {
      id: "day-a",
      name: "A · Empuje",
      subtitle: "Pecho · Tríceps · Deltoides",
      mins: 55,
      items: [
        I("press-inc", 3, 6, 10, "1-2", 150),
        I("press-maq", 3, 8, 12, "1", 90),
        I("press-mil", 2, 8, 12, "1-2", 90),
        I("lat-polea", 3, 12, 20, "0-1", 45, "A"),
        I("face-pull", 3, 12, 20, "0-1", 45, "A"),
        I("tri-oh", 3, 10, 15, "0-1", 45, "B"),
        I("tri-cuerda", 2, 10, 15, "0-1", 45, "B"),
      ],
    },
    {
      id: "day-b",
      name: "B · Tirón",
      subtitle: "Espalda · Bíceps · Antebrazo · Core",
      mins: 55,
      items: [
        I("dominadas", 3, 6, 12, "1-2", 150),
        I("remo-polea", 3, 8, 12, "1-2", 120),
        I("pullover", 2, 12, 15, "0-1", 60),
        I("curl-inc", 3, 8, 12, "1", 75),
        I("curl-martillo", 3, 10, 15, "0-1", 45, "A"),
        I("antebrazo", 2, 15, 20, "0-1", 45, "A"),
        I("crunch-polea", 3, 10, 15, "0-1", 60),
      ],
    },
    {
      id: "day-c",
      name: "C · Pierna A",
      subtitle: "Cuádriceps · Isquios · Gemelo · Core",
      mins: 58,
      items: [
        I("sentadilla", 3, 6, 10, "1-2", 180),
        I("pmr", 3, 8, 12, "1-2", 120),
        I("femoral-tum", 3, 10, 15, "0-1", 75),
        I("ext-cuad", 2, 12, 15, "0-1", 60),
        I("gemelo-pie", 3, 8, 15, "0-1", 45, "A"),
        I("plancha", 3, 8, 12, "1", 45, "A"),
      ],
    },
    {
      id: "day-d",
      name: "D · Torso",
      subtitle: "Pecho · Espalda · Brazos · Deltoides lateral",
      mins: 55,
      items: [
        I("banca", 3, 6, 10, "1-2", 150),
        I("cruce-poleas", 3, 12, 15, "0-1", 60),
        I("remo-maq", 3, 8, 12, "1-2", 120),
        I("jalon-neutro", 3, 10, 12, "1", 90),
        I("lat-polea", 3, 12, 20, "0-1", 45),
        I("curl-polea", 2, 10, 15, "0-1", 45, "A"),
        I("tri-recto", 2, 10, 15, "0-1", 45, "A"),
      ],
    },
    {
      id: "day-d4",
      name: "D+ · Torso + pierna",
      subtitle: "Variante de semanas de 4 días",
      mins: 65,
      items: [
        I("banca", 3, 6, 10, "1-2", 150),
        I("cruce-poleas", 3, 12, 15, "0-1", 60),
        I("remo-maq", 3, 8, 12, "1-2", 120),
        I("jalon-neutro", 3, 10, 12, "1", 90),
        I("lat-polea", 3, 12, 20, "0-1", 45),
        I("curl-polea", 2, 10, 15, "0-1", 45, "A"),
        I("tri-recto", 2, 10, 15, "0-1", 45, "A"),
        I("prensa", 2, 10, 15, "1", 60),
        I("femoral-sent", 2, 10, 15, "0-1", 60),
        I("aductores", 2, 12, 20, "0-1", 45),
      ],
    },
    {
      id: "day-e",
      name: "E · Pierna B",
      subtitle: "Cuádriceps · Isquios · Sóleo · Aductores · Core",
      mins: 55,
      items: [
        I("bulgara", 3, 8, 12, "1-2", 120),
        I("ext-cuad", 3, 12, 15, "0-1", 60),
        I("femoral-sent", 3, 10, 15, "0-1", 75),
        I("gemelo-sent", 3, 12, 20, "0-1", 45, "A"),
        I("aductores", 2, 12, 20, "0-1", 45, "A"),
        I("elev-piernas", 3, 10, 15, "0-1", 60),
      ],
    },
  ];
}
