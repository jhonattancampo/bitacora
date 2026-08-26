/* =========================================================
   data/exercises.ts — The exercise seed: the plan's own
   catalogue, its execution cues, and the public-domain photos
   matched to each one.

   This is data, not logic. It moved out of app.ts untouched so
   the module that owns the state does not also carry 240 lines
   of prose.
   ========================================================= */
import type { Exercise } from "../types";

/** Shorthand the seed list is written in. Local on purpose: nothing else builds exercises this way. */
function E(
  id: string,
  name: string,
  group: string,
  cues: string[],
  err?: string,
  tip?: string,
): Exercise {
  return { id, name, group, cues, err: err || "", tip: tip || "", custom: false };
}

/** Photos from Free Exercise DB (public domain), keyed by our own exercise id. */
export const EX_IMAGES: Record<string, { name: string; images: string[] }> = {
  "press-inc": {
    name: "Incline Dumbbell Press",
    images: [
      "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Incline_Dumbbell_Press/0.jpg",
      "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Incline_Dumbbell_Press/1.jpg",
    ],
  },
  "press-maq": {
    name: "Cable Chest Press",
    images: [
      "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Cable_Chest_Press/0.jpg",
      "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Cable_Chest_Press/1.jpg",
    ],
  },
  "press-mil": {
    name: "Seated Dumbbell Press",
    images: [
      "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Seated_Dumbbell_Press/0.jpg",
      "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Seated_Dumbbell_Press/1.jpg",
    ],
  },
  "lat-polea": {
    name: "Cable Seated Lateral Raise",
    images: [
      "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Cable_Seated_Lateral_Raise/0.jpg",
      "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Cable_Seated_Lateral_Raise/1.jpg",
    ],
  },
  "face-pull": {
    name: "Face Pull",
    images: [
      "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Face_Pull/0.jpg",
      "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Face_Pull/1.jpg",
    ],
  },
  "tri-oh": {
    name: "Cable Rope Overhead Triceps Extension",
    images: [
      "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Cable_Rope_Overhead_Triceps_Extension/0.jpg",
      "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Cable_Rope_Overhead_Triceps_Extension/1.jpg",
    ],
  },
  "tri-cuerda": {
    name: "Triceps Pushdown - Rope Attachment",
    images: [
      "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Triceps_Pushdown_-_Rope_Attachment/0.jpg",
      "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Triceps_Pushdown_-_Rope_Attachment/1.jpg",
    ],
  },
  fondos: {
    name: "Dips - Chest Version",
    images: [
      "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Dips_-_Chest_Version/0.jpg",
      "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Dips_-_Chest_Version/1.jpg",
    ],
  },
  dominadas: {
    name: "Pullups",
    images: [
      "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Pullups/0.jpg",
      "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Pullups/1.jpg",
    ],
  },
  "remo-polea": {
    name: "Seated Cable Rows",
    images: [
      "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Seated_Cable_Rows/0.jpg",
      "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Seated_Cable_Rows/1.jpg",
    ],
  },
  pullover: {
    name: "Straight-Arm Pulldown",
    images: [
      "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Straight-Arm_Pulldown/0.jpg",
      "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Straight-Arm_Pulldown/1.jpg",
    ],
  },
  "curl-inc": {
    name: "Incline Dumbbell Curl",
    images: [
      "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Incline_Dumbbell_Curl/0.jpg",
      "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Incline_Dumbbell_Curl/1.jpg",
    ],
  },
  "curl-martillo": {
    name: "Alternate Hammer Curl",
    images: [
      "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Alternate_Hammer_Curl/0.jpg",
      "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Alternate_Hammer_Curl/1.jpg",
    ],
  },
  antebrazo: {
    name: "Cable Wrist Curl",
    images: [
      "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Cable_Wrist_Curl/0.jpg",
      "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Cable_Wrist_Curl/1.jpg",
    ],
  },
  "crunch-polea": {
    name: "Cable Crunch",
    images: [
      "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Cable_Crunch/0.jpg",
      "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Cable_Crunch/1.jpg",
    ],
  },
  sentadilla: {
    name: "Barbell Squat",
    images: [
      "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Squat/0.jpg",
      "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Squat/1.jpg",
    ],
  },
  pmr: {
    name: "Romanian Deadlift",
    images: [
      "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Romanian_Deadlift/0.jpg",
      "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Romanian_Deadlift/1.jpg",
    ],
  },
  "femoral-tum": {
    name: "Lying Leg Curls",
    images: [
      "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Lying_Leg_Curls/0.jpg",
      "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Lying_Leg_Curls/1.jpg",
    ],
  },
  "ext-cuad": {
    name: "Leg Extensions",
    images: [
      "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Leg_Extensions/0.jpg",
      "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Leg_Extensions/1.jpg",
    ],
  },
  "gemelo-pie": {
    name: "Standing Barbell Calf Raise",
    images: [
      "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Standing_Barbell_Calf_Raise/0.jpg",
      "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Standing_Barbell_Calf_Raise/1.jpg",
    ],
  },
  plancha: {
    name: "Plank",
    images: [
      "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Plank/0.jpg",
      "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Plank/1.jpg",
    ],
  },
  banca: {
    name: "Barbell Bench Press - Medium Grip",
    images: [
      "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Bench_Press_-_Medium_Grip/0.jpg",
      "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Bench_Press_-_Medium_Grip/1.jpg",
    ],
  },
  "cruce-poleas": {
    name: "Cable Crossover",
    images: [
      "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Cable_Crossover/0.jpg",
      "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Cable_Crossover/1.jpg",
    ],
  },
  "remo-maq": {
    name: "Leverage High Row",
    images: [
      "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Leverage_High_Row/0.jpg",
      "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Leverage_High_Row/1.jpg",
    ],
  },
  "jalon-neutro": {
    name: "Close-Grip Front Lat Pulldown",
    images: [
      "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Close-Grip_Front_Lat_Pulldown/0.jpg",
      "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Close-Grip_Front_Lat_Pulldown/1.jpg",
    ],
  },
  "curl-polea": {
    name: "Standing Biceps Cable Curl",
    images: [
      "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Standing_Biceps_Cable_Curl/0.jpg",
      "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Standing_Biceps_Cable_Curl/1.jpg",
    ],
  },
  "tri-recto": {
    name: "Triceps Pushdown - V-Bar Attachment",
    images: [
      "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Triceps_Pushdown_-_V-Bar_Attachment/0.jpg",
      "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Triceps_Pushdown_-_V-Bar_Attachment/1.jpg",
    ],
  },
  bulgara: {
    name: "Split Squat with Dumbbells",
    images: [
      "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Split_Squat_with_Dumbbells/0.jpg",
      "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Split_Squat_with_Dumbbells/1.jpg",
    ],
  },
  "femoral-sent": {
    name: "Seated Leg Curl",
    images: [
      "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Seated_Leg_Curl/0.jpg",
      "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Seated_Leg_Curl/1.jpg",
    ],
  },
  "gemelo-sent": {
    name: "Seated Calf Raise",
    images: [
      "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Seated_Calf_Raise/0.jpg",
      "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Seated_Calf_Raise/1.jpg",
    ],
  },
  aductores: {
    name: "Thigh Adductor",
    images: [
      "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Thigh_Adductor/0.jpg",
      "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Thigh_Adductor/1.jpg",
    ],
  },
  "elev-piernas": {
    name: "Hanging Leg Raise",
    images: [
      "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Hanging_Leg_Raise/0.jpg",
      "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Hanging_Leg_Raise/1.jpg",
    ],
  },
  prensa: {
    name: "Leg Press",
    images: [
      "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Leg_Press/0.jpg",
      "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Leg_Press/1.jpg",
    ],
  },
};
/* Fotos que no son exactamente del ejercicio descrito: la base pública no tiene
   una foto de esa variante y la aclaramos en vez de hacerla pasar por exacta. */
export const EX_PHOTO_NOTE: Record<string, string> = {
  "lat-polea":
    "Foto de referencia: variante sentada. La ejecución de pie sigue el mismo patrón de movimiento.",
};
export const SEED_EX: Exercise[] = [
  E(
    "press-inc",
    "Press inclinado con mancuernas (30°)",
    "Pecho",
    [
      "Banco a 30° (dos o tres muescas desde plano). Más inclinado que eso y el hombro se lleva el trabajo.",
      "Sentate con las mancuernas apoyadas en los muslos y empujalas con las rodillas al recostarte.",
      "Muñecas rectas, codos a 45-60° del torso: ni pegados al cuerpo ni abiertos en cruz.",
      "Bajá hasta sentir estiramiento en el pecho, con las mancuernas a la altura del pecho alto.",
      "Empujá hacia arriba y apenas hacia adentro, sin chocar las mancuernas ni bloquear los codos.",
    ],
    "Arquear la espalda de más y convertirlo en un press plano. Omóplatos juntos y hacia abajo, cola apoyada.",
    "El mejor constructor de pecho superior. Estiramiento bajo carga: no rebotes abajo.",
  ),
  E(
    "press-maq",
    "Press de pecho en máquina o polea (plano)",
    "Pecho",
    [
      "Ajustá el asiento para que los mangos queden a la altura del medio del pecho, no del cuello.",
      "Omóplatos apretados contra el respaldo durante todo el movimiento.",
      "Empujá hacia adelante hasta casi extender los codos, sin bloquearlos.",
      "Volvé controlando hasta sentir el estiramiento; no dejes que el peso golpee la pila.",
    ],
    "Levantar los hombros hacia adelante al empujar. Si el hombro se despega del respaldo, bajá el peso.",
    "Fatiga menos el hombro que la barra y permite ir cerca del fallo con seguridad.",
  ),
  E(
    "press-mil",
    "Press militar sentado con mancuernas",
    "Deltoides ant/post",
    [
      "Respaldo casi vertical (80-90°). Espalda apoyada, pies firmes en el piso.",
      "Mancuernas a la altura de las orejas, palmas hacia adelante, codos apenas por delante del torso.",
      "Empujá hacia arriba juntando levemente las mancuernas, sin chocarlas.",
      "Bajá hasta que los codos queden a la altura de los hombros o apenas por debajo.",
    ],
    "Arquear la zona lumbar para ayudarse. Apretá el abdomen y mantené las costillas hacia abajo.",
    "Con el press de pecho ya trabajado, 2 series alcanzan.",
  ),
  E(
    "lat-polea",
    "Elevaciones laterales en polea (a una mano)",
    "Deltoides lateral",
    [
      "Polea en la posición más baja, mango simple. Parate de costado, con la polea del lado contrario al brazo que trabaja.",
      "El cable cruza por delante del cuerpo: agarrá el mango con el brazo que queda lejos de la polea.",
      "Codo apenas flexionado y fijo. Subí el brazo al costado hasta la altura del hombro, no más.",
      "Pensá en llevar el codo hacia afuera, no la mano hacia arriba. Bajá lento, resistiendo.",
    ],
    "Encoger el hombro hacia la oreja y usar el trapecio. Hombro abajo: el movimiento nace del deltoides.",
    "Clave para el ancho de hombros. La polea mantiene tensión abajo, donde la mancuerna la pierde.",
  ),
  E(
    "face-pull",
    "Face pull en polea",
    "Deltoides ant/post",
    [
      "Cuerda en una polea a la altura de la cara o un poco más arriba.",
      "Agarrá la cuerda con las palmas enfrentadas, un paso atrás para tensar el cable.",
      "Tirá hacia tu cara separando las manos, como si abrieras la cuerda en dos.",
      "Terminá con las manos a los costados de la cabeza y los codos altos, a la altura de los hombros.",
      "Pausá medio segundo apretando la parte de atrás del hombro y volvé controlando.",
    ],
    "Usar demasiado peso y terminar tirando con la espalda y el torso hacia atrás. Es un ejercicio liviano.",
    "Deltoides posterior + salud del hombro y postura.",
  ),
  E(
    "tri-oh",
    "Extensión de tríceps por encima de la cabeza en polea",
    "Tríceps",
    [
      "Cuerda en polea alta. Agarrala y date vuelta: quedás de espaldas a la polea, con la cuerda pasando detrás de tu cabeza.",
      "Un pie adelante para estabilizarte, torso levemente inclinado hacia adelante.",
      "Codos apuntando al frente y hacia arriba, pegados a la cabeza. No se mueven en todo el ejercicio.",
      "Estirá los brazos hacia adelante y arriba hasta extenderlos, separando las manos al final.",
      "Dejá que las manos vuelvan atrás de la nuca hasta sentir el estiramiento fuerte en la parte de atrás del brazo.",
    ],
    "Abrir los codos hacia los costados o dejar que se muevan hacia atrás. Si no podés fijarlos, bajá el peso.",
    "Porción larga en posición estirada: el mejor ejercicio de tríceps del plan. No lo reemplaces por otro jalón.",
  ),
  E(
    "tri-cuerda",
    "Jalón de tríceps en polea con cuerda",
    "Tríceps",
    [
      "Polea alta con cuerda. Parate de frente, un paso atrás de la torre.",
      "Codos pegados a los costados del torso, torso apenas inclinado hacia adelante.",
      "Estirá los codos hacia abajo y separá las manos al final del recorrido.",
      "Subí controlando solo hasta que los codos formen 90°, sin dejar que suban los hombros.",
    ],
    "Mover los codos hacia atrás y adelante, convirtiéndolo en un empuje de todo el cuerpo. Solo se mueve el antebrazo.",
    "Termina el trabajo en posición acortada (porciones lateral y medial).",
  ),
  E(
    "fondos",
    "Fondos en paralelas",
    "Pecho",
    [
      "Torso inclinado hacia adelante unos 15-20° para llevar el trabajo al pecho inferior.",
      "Bajá hasta sentir estiramiento en el pecho, con el hombro sin colapsar hacia adelante.",
      "Subí sin bloquear los codos de golpe.",
      "Si hacés más de 12 repeticiones limpias, agregá lastre con cinturón.",
    ],
    "Bajar demasiado con los hombros encogidos. Si te molesta el hombro, achicá el recorrido.",
    "Es un básico de empuje, no un aislado de tríceps: si lo sumás, reemplazá el press de pecho en máquina del Día A. No lo agregues encima.",
  ),

  E(
    "dominadas",
    "Dominadas (o jalón al pecho)",
    "Espalda",
    [
      "Agarre prono (palmas hacia adelante), manos un poco más anchas que los hombros.",
      "Antes de tirar, bajá los hombros: alejá las orejas de los hombros. Ese es el inicio real del movimiento.",
      "Tirá llevando los codos hacia abajo y atrás, pensando en llevar el pecho a la barra.",
      "Subí hasta que la barbilla pase la barra; bajá hasta extender casi del todo, sin quedar colgando flojo.",
      "En el jalón al pecho: mismo agarre, torso 10-15° hacia atrás, la barra baja al pecho alto, no a la nuca.",
    ],
    "Tirar primero con los brazos. La espalda inicia, el bíceps acompaña. Si no llegás a 6, usá jalón o banda.",
    "Si hacés más de 12 limpias, agregá lastre.",
  ),
  E(
    "remo-polea",
    "Remo en polea baja con agarre neutro",
    "Espalda",
    [
      "Sentado, pies firmes, rodillas apenas flexionadas, agarre en V (palmas enfrentadas).",
      "Torso vertical o 5-10° hacia atrás, y se queda ahí: el torso no se balancea.",
      "Estirá los brazos adelante dejando que los omóplatos se separen (estiramiento del dorsal).",
      "Tirá el mango hacia el ombligo llevando los codos pegados al cuerpo, hacia atrás.",
      "Pausá medio segundo apretando los omóplatos y volvé controlando.",
    ],
    "Usar el impulso del torso hacia atrás y adelante como un remo de bote. Si necesitás eso, es mucho peso.",
    "Grosor de espalda media.",
  ),
  E(
    "pullover",
    "Pullover en polea alta (brazos casi rectos)",
    "Espalda",
    [
      "Polea alta con barra recta o cuerda. Parate a un paso y medio, torso inclinado 30-45° hacia adelante.",
      "Brazos casi rectos, con una flexión mínima y fija en el codo.",
      "Llevá la barra hacia abajo en arco hasta los muslos.",
      "Volvé arriba controlando, hasta sentir el estiramiento en el costado de la espalda.",
    ],
    "Flexionar los codos y transformarlo en un jalón de tríceps. Los codos quedan bloqueados todo el rato.",
    "Aísla el dorsal sin fatigar el bíceps. Excelente estiramiento bajo carga.",
  ),
  E(
    "curl-inc",
    "Curl inclinado con mancuernas (banco a 60°)",
    "Bíceps",
    [
      "Banco a 60° (más vertical que el press inclinado). Espalda bien apoyada.",
      "Brazos colgando a los costados, atrás de la línea del torso. Palmas hacia adelante.",
      "Flexioná el codo sin mover el brazo: el codo se queda quieto al costado del cuerpo.",
      "Bajá hasta extender casi completamente. Esa posición estirada es el punto fuerte del ejercicio.",
    ],
    "Dejar que el codo viaje hacia adelante para llegar más arriba. El recorrido de abajo es el que importa.",
    "Carga el bíceps en máxima elongación: la variante con más evidencia a favor.",
  ),
  E(
    "curl-martillo",
    "Curl martillo (mancuernas o cuerda)",
    "Bíceps",
    [
      "De pie, palmas enfrentadas (como si agarraras un martillo). Se mantiene así todo el movimiento.",
      "Codos pegados al torso y fijos.",
      "Subí hasta la altura del hombro, sin balancear el cuerpo.",
      "Bajá en 2-3 segundos hasta extender el codo.",
    ],
    "Balancear el torso hacia atrás para arrancar el peso. Si pasa, bajá el peso o apoyá la espalda en una pared.",
    "Braquial y braquiorradial: es lo que engrosa el brazo visto de frente.",
  ),
  E(
    "antebrazo",
    "Curl de muñeca o agarre muerto en barra",
    "Antebrazo",
    [
      "Curl de muñeca: sentado, antebrazos apoyados en los muslos, palmas hacia arriba, barra en las manos.",
      "Dejá que la barra ruede hasta la punta de los dedos, después cerrala y subí solo con la muñeca.",
      "Agarre muerto (alternativa): agarrá dos mancuernas pesadas y sostenelas colgando 30-45 segundos.",
      "En el agarre muerto: hombros abajo, abdomen apretado, respirando normal. Contás tiempo, no repeticiones.",
    ],
    "Usar tanto peso que el movimiento salga del codo. Acá solo se mueve la muñeca.",
    "Si hacés agarre muerto, anotá los segundos en la casilla de repeticiones.",
  ),
  E(
    "crunch-polea",
    "Crunch en polea alta arrodillado",
    "Core",
    [
      "Cuerda en polea alta. Arrodillate a un paso de la torre, cuerda a los costados de la cara.",
      "Cadera fija: no se sienta hacia atrás ni se mueve durante el ejercicio.",
      "Enrollá la columna hacia abajo llevando los codos hacia los muslos, como cerrando el torso.",
      "Volvé arriba controlando hasta estirar el abdomen, sin perder la tensión.",
    ],
    "Flexionar la cadera en vez de la columna (bajar con la espalda recta). El movimiento es de enrollar.",
    "Core con sobrecarga progresiva, que es lo que le falta a la mayoría de los abdominales.",
  ),

  E(
    "sentadilla",
    "Sentadilla con barra (o prensa 45°)",
    "Cuádriceps",
    [
      "Barra sobre el trapecio, pies al ancho de hombros y puntas apenas hacia afuera.",
      "Inspirá, apretá el abdomen, y bajá empujando la cadera hacia atrás y las rodillas hacia afuera.",
      "Bajá hasta que el muslo quede paralelo al piso o un poco más, sin que la espalda baja se redondee.",
      "Subí empujando el piso con el medio del pie, sin que la cadera suba primero.",
      "Prensa 45°: pies a media plataforma, ancho de hombros. Bajá hasta 90° de rodilla sin despegar la cola.",
    ],
    "Levantar los talones o dejar que las rodillas se metan hacia adentro. Si pasa, bajá menos o achicá el peso.",
    "Elegí una variante y quedate con ella 8 semanas.",
  ),
  E(
    "pmr",
    "Peso muerto rumano",
    "Isquios/Glúteo",
    [
      "De pie, barra o mancuernas delante de los muslos, pies al ancho de cadera, rodillas apenas flexionadas.",
      "Llevá la cadera hacia atrás como si empujaras una puerta con la cola, dejando que el peso baje pegado a las piernas.",
      "La espalda se mantiene recta todo el tiempo. Las rodillas casi no se mueven.",
      "Bajá hasta sentir un estiramiento fuerte atrás del muslo, normalmente a media canilla.",
      "Subí apretando los glúteos hasta quedar parado, sin echarte hacia atrás.",
    ],
    "Convertirlo en una sentadilla flexionando las rodillas. Es un movimiento de cadera, no de rodilla.",
    "Isquios + glúteo en estiramiento.",
  ),
  E(
    "femoral-tum",
    "Curl femoral tumbado",
    "Isquios/Glúteo",
    [
      "Boca abajo, el rodillo justo arriba del talón (no en el tendón de Aquiles).",
      "Cadera pegada al banco; si se despega, es mucho peso.",
      "Flexioná las rodillas llevando los talones hacia la cola, todo el recorrido posible.",
      "Bajá en 2-3 segundos hasta casi extender del todo, sin soltar la tensión.",
    ],
    "Levantar la cadera para dar impulso. Apretá glúteos y abdomen contra el banco.",
    "Cubre la flexión de rodilla, que el peso muerto rumano no trabaja.",
  ),
  E(
    "ext-cuad",
    "Extensión de cuádriceps",
    "Cuádriceps",
    [
      "Ajustá el respaldo para que la rodilla quede alineada con el eje de giro de la máquina.",
      "Rodillo sobre el empeine, arriba del tobillo. Agarrate de las manijas.",
      "Estirá las rodillas hasta arriba y pausá 1 segundo apretando el cuádriceps.",
      "Bajá lento, controlando, hasta unos 90° de rodilla.",
    ],
    "Tirar impulso con la cadera y dejar caer el peso. La bajada lenta es donde está el estímulo.",
    "Aísla el recto femoral, el único cuádriceps que la sentadilla trabaja poco.",
  ),
  E(
    "gemelo-pie",
    "Elevación de gemelos de pie",
    "Gemelos",
    [
      "Punta del pie en el escalón o plataforma, talón al aire.",
      "Bajá el talón todo lo que puedas y pausá 1 segundo en el estiramiento.",
      "Subí hasta la máxima punta de pie y pausá 1 segundo arriba.",
      "Rodillas estiradas todo el tiempo (así trabajás el gemelo, no el sóleo).",
    ],
    "Rebotar sin pausas y con medio recorrido. El gemelo solo responde a rango completo y tiempo bajo tensión.",
    "",
  ),
  E(
    "plancha",
    "Plancha con peso o rueda abdominal",
    "Core",
    [
      "Plancha: codos bajo los hombros, cuerpo en línea recta de la cabeza a los talones.",
      "Meté la pelvis y apretá glúteos y abdomen. Si aguantás más de 45 s, agregá un disco en la espalda alta.",
      "Rueda: de rodillas, rueda bajo los hombros, abdomen apretado y cola metida.",
      "Rodá hacia adelante todo lo que puedas sin que la espalda baja se arquee, y volvé tirando con el abdomen.",
    ],
    "Dejar caer la cadera y arquear la lumbar. Si sentís tirón en la espalda baja, achicá el recorrido.",
    "Anti-extensión: protege la lumbar en sentadilla y peso muerto. Si es plancha, anotá segundos.",
  ),

  E(
    "banca",
    "Press de banca plano con barra",
    "Pecho",
    [
      "Ojos debajo de la barra, omóplatos juntos y hacia abajo, pies firmes en el piso.",
      "Agarre un poco más ancho que los hombros. Muñecas rectas, la barra en la base de la palma.",
      "Bajá la barra al pecho bajo / línea del pezón, con los codos a 45-60° del torso.",
      "Tocá el pecho sin rebotar y empujá en diagonal hacia atrás, hacia la vertical de los hombros.",
      "Si entrenás solo cerca del fallo, usá el rack con topes o máquina Smith.",
    ],
    "Abrir los codos a 90° respecto al torso. Es la vía rápida a una lesión de hombro y además rinde menos.",
    "",
  ),
  E(
    "cruce-poleas",
    "Cruce de poleas de abajo hacia arriba",
    "Pecho",
    [
      "Ambas poleas en la posición más baja, mangos simples. Un pie adelante, torso levemente inclinado.",
      "Brazos abiertos y abajo, codos con una flexión leve y fija.",
      "Subí las manos en diagonal hacia adelante y arriba, hasta juntarlas a la altura del pecho alto.",
      "Apretá 1 segundo arriba y volvé abriendo, controlando, hasta sentir el estiramiento.",
    ],
    "Flexionar los codos y convertirlo en un press. El codo mantiene su ángulo del principio al fin.",
    "",
  ),
  E(
    "remo-maq",
    "Remo en máquina o remo con barra",
    "Espalda",
    [
      "Máquina: pecho apoyado en la almohadilla, agarre neutro o prono según disponibilidad.",
      "Barra: torso inclinado 45°, espalda recta, barra colgando de los brazos estirados.",
      "Tirá llevando los codos hacia atrás, el mango o la barra hacia el ombligo.",
      "Apretá los omóplatos al final y volvé estirando los brazos por completo.",
    ],
    "Levantar el torso al tirar (en la versión con barra). El ángulo del torso no cambia durante la serie.",
    "",
  ),
  E(
    "jalon-neutro",
    "Jalón al pecho con agarre neutro",
    "Espalda",
    [
      "Manija en V o agarre paralelo, muslos trabados bajo el rodillo.",
      "Torso 10-15° hacia atrás y fijo. Bajá los hombros antes de tirar.",
      "Tirá hasta que las manos lleguen al pecho alto, codos hacia abajo y atrás.",
      "Volvé arriba controlando, dejando que los hombros suban al final para estirar el dorsal.",
    ],
    "Balancear el torso hacia atrás para bajar la barra. Si el torso se mueve, es mucho peso.",
    "",
  ),
  E(
    "curl-polea",
    "Curl en polea baja con barra recta",
    "Bíceps",
    [
      "Polea baja con barra recta o W. Parate a un paso, brazos estirados hacia abajo.",
      "Codos pegados al torso y fijos, hombros hacia atrás.",
      "Flexioná hasta la altura del pecho, apretando 1 segundo arriba.",
      "Bajá en 2-3 segundos hasta extender casi del todo, sin soltar la tensión.",
    ],
    "Dejar que los codos se vayan hacia adelante al subir, quitándole tensión al bíceps.",
    "",
  ),
  E(
    "tri-recto",
    "Jalón de tríceps en polea con agarre recto",
    "Tríceps",
    [
      "Polea alta con barra recta, agarre prono al ancho de los hombros.",
      "Codos pegados al torso, torso apenas inclinado hacia adelante y estable.",
      "Estirá los codos hasta abajo, sin bloquearlos con violencia.",
      "Subí controlando hasta 90° de codo. Solo se mueve el antebrazo.",
    ],
    "Empujar con todo el cuerpo hacia abajo. Si te tenés que inclinar para bajar la barra, achicá el peso.",
    "",
  ),

  E(
    "bulgara",
    "Sentadilla búlgara con mancuernas",
    "Cuádriceps",
    [
      "Pie de atrás apoyado en un banco, pie de adelante a un paso largo por delante.",
      "Mancuernas colgando a los costados, torso inclinado 20° (más glúteo) o vertical (más cuádriceps).",
      "Bajá recto, dejando que la rodilla de adelante avance sobre el pie, hasta que el muslo quede paralelo.",
      "Subí empujando con el talón del pie de adelante. La pierna de atrás solo equilibra.",
      "Terminá todas las repeticiones de una pierna y después cambiá. Contá la serie como una sola.",
    ],
    "Poner el pie de adelante demasiado cerca del banco. Si la rodilla molesta, alejá el pie un paso más.",
    "Máximo estímulo de glúteo y cuádriceps con poca carga espinal.",
  ),
  E(
    "femoral-sent",
    "Curl femoral sentado",
    "Isquios/Glúteo",
    [
      "Sentado, respaldo ajustado para que la rodilla coincida con el eje de la máquina.",
      "Rodillo superior firme sobre los muslos, rodillo inferior justo arriba del talón.",
      "Flexioná las rodillas hacia abajo y atrás, todo el recorrido posible.",
      "Volvé en 2-3 segundos hasta casi extender, manteniendo la cadera flexionada.",
    ],
    "Despegar la espalda del respaldo para ganar recorrido. La cadera se queda flexionada todo el tiempo.",
    "Superior al tumbado: estira el isquio desde la cadera y genera más crecimiento.",
  ),
  E(
    "gemelo-sent",
    "Elevación de gemelos sentado",
    "Gemelos",
    [
      "Sentado, rodillas a 90° con la almohadilla sobre los muslos, punta del pie en la plataforma.",
      "Bajá el talón hasta el máximo estiramiento y pausá 1 segundo.",
      "Subí a la máxima punta de pie y pausá 1 segundo.",
      "Con la rodilla flexionada el trabajo se lo lleva el sóleo.",
    ],
    "Hacer repeticiones rápidas y cortas. Sin pausas arriba y abajo, este ejercicio no sirve de nada.",
    "",
  ),
  E(
    "aductores",
    "Aductores en máquina o polea baja",
    "Aductores",
    [
      "Máquina: sentado, apertura inicial hasta sentir estiramiento en la ingle, sin dolor.",
      "Cerrá las piernas juntando las rodillas y pausá 1 segundo apretando.",
      "Abrí en 2-3 segundos controlando, hasta el estiramiento.",
      "Polea: tobillera en la pierna interna, de costado a la polea, cruzá la pierna por delante de la otra.",
    ],
    "Arrancar con una apertura excesiva y peso alto. Empezá conservador: es un músculo que rara vez se entrena.",
    "",
  ),
  E(
    "elev-piernas",
    "Elevación de piernas colgado o en paralelas",
    "Core",
    [
      "Colgado de la barra o apoyado en las paralelas, hombros activos (no colgando flojo).",
      "Subí las rodillas hacia el pecho enrollando la pelvis al final, no solo flexionando la cadera.",
      "Bajá en 2-3 segundos, sin balanceo.",
      "Cuando te salgan 15 limpias, hacelas con las piernas estiradas o con una mancuerna entre los pies.",
    ],
    "Balancearse como un péndulo. Si no podés frenar el balanceo, hacelas apoyado en las paralelas.",
    "",
  ),
  E(
    "prensa",
    "Prensa 45°",
    "Cuádriceps",
    [
      "Pies a media plataforma, al ancho de hombros.",
      "Bajá hasta 90° de rodilla sin despegar la cola del respaldo.",
      "Empujá con el medio del pie, sin bloquear las rodillas de golpe.",
    ],
    "Bajar tanto que la pelvis se levante del respaldo. Ahí es donde se lastima la lumbar.",
    "Bloque de pierna del Día D en semanas de 4 días.",
  ),
];
