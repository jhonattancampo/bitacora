"use strict";
/* =========================================================
   BITÁCORA — registro de entrenamiento offline
   Un solo archivo. Sin internet. Datos en este dispositivo.
   ========================================================= */

/* ---------- utilidades ---------- */
const $ = (s,r=document)=>r.querySelector(s);
const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));
const uid = ()=>Math.random().toString(36).slice(2,10);
const esc = s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num = v=>{ if(v===''||v==null) return null; const n=parseFloat(String(v).replace(',','.')); return isNaN(n)?null:n; };
const fmt = n=>{ if(n==null) return '—'; const r=Math.round(n*100)/100; return String(r).replace('.',','); };
const today = ()=>new Date().toISOString().slice(0,10);
const dnice = iso=>{ const [y,m,d]=iso.split('-'); return d+'/'+m; };
const dlong = iso=>{ const dt=new Date(iso+'T12:00:00'); return dt.toLocaleDateString('es-AR',{weekday:'short',day:'numeric',month:'short'}); };
const daysAgo = iso=>Math.round((new Date(today()+'T12:00:00')-new Date(iso+'T12:00:00'))/864e5);
const e1rm = (w,r)=>(w&&r)?w*(1+r/30):0;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));

/* ---------- almacenamiento ---------- */
const KEY='bitacora_gym_v2';
let STORAGE_OK=true, memBlob=null;
try{ localStorage.setItem('__t','1'); localStorage.removeItem('__t'); }catch(e){ STORAGE_OK=false; }
function readStore(){
  try{ const raw = STORAGE_OK ? localStorage.getItem(KEY) : memBlob; return raw?JSON.parse(raw):null; }catch(e){ return null; }
}
let saveT=null;
function save(now){
  const blob=JSON.stringify(state);
  memBlob=blob;
  if(!STORAGE_OK) return;
  clearTimeout(saveT);
  const w=()=>{ try{ localStorage.setItem(KEY,blob); }catch(e){ STORAGE_OK=false; toast('No se pudo guardar: almacenamiento lleno'); } };
  now ? w() : saveT=setTimeout(w,250);
  if(window.Sync) Sync.schedule(now?1500:5000);
}

/* ---------- grupos musculares ---------- */
const ACCENT_HEX={mostaza:'#FFCC1D',verde:'#3ADB7A',fucsia:'#FF4FA6',violeta:'#9B6BFF',celeste:'#33C4F2',coral:'#FF7A59'};
const GROUPS=['Pecho','Espalda','Deltoides lateral','Deltoides ant/post','Bíceps','Tríceps','Antebrazo','Cuádriceps','Isquios/Glúteo','Gemelos','Aductores','Core'];
const RANGES={'Pecho':[10,20],'Espalda':[10,20],'Deltoides lateral':[8,16],'Deltoides ant/post':[4,10],'Bíceps':[8,16],'Tríceps':[8,16],'Antebrazo':[2,10],'Cuádriceps':[10,18],'Isquios/Glúteo':[10,18],'Gemelos':[6,12],'Aductores':[2,10],'Core':[6,12]};

/* ---------- semilla: ejercicios (guía de ejecución) ---------- */
function E(id,name,group,cues,err,tip){return {id,name,group,cues,err:err||'',tip:tip||'',custom:false};}
const EX_IMAGES = {"press-inc": {"name": "Incline Dumbbell Press", "images": ["https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Incline_Dumbbell_Press/0.jpg", "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Incline_Dumbbell_Press/1.jpg"]}, "press-maq": {"name": "Cable Chest Press", "images": ["https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Cable_Chest_Press/0.jpg", "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Cable_Chest_Press/1.jpg"]}, "press-mil": {"name": "Seated Dumbbell Press", "images": ["https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Seated_Dumbbell_Press/0.jpg", "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Seated_Dumbbell_Press/1.jpg"]}, "lat-polea": {"name": "Cable Seated Lateral Raise", "images": ["https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Cable_Seated_Lateral_Raise/0.jpg", "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Cable_Seated_Lateral_Raise/1.jpg"]}, "face-pull": {"name": "Face Pull", "images": ["https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Face_Pull/0.jpg", "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Face_Pull/1.jpg"]}, "tri-oh": {"name": "Cable Rope Overhead Triceps Extension", "images": ["https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Cable_Rope_Overhead_Triceps_Extension/0.jpg", "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Cable_Rope_Overhead_Triceps_Extension/1.jpg"]}, "tri-cuerda": {"name": "Triceps Pushdown - Rope Attachment", "images": ["https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Triceps_Pushdown_-_Rope_Attachment/0.jpg", "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Triceps_Pushdown_-_Rope_Attachment/1.jpg"]}, "fondos": {"name": "Dips - Chest Version", "images": ["https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Dips_-_Chest_Version/0.jpg", "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Dips_-_Chest_Version/1.jpg"]}, "dominadas": {"name": "Pullups", "images": ["https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Pullups/0.jpg", "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Pullups/1.jpg"]}, "remo-polea": {"name": "Seated Cable Rows", "images": ["https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Seated_Cable_Rows/0.jpg", "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Seated_Cable_Rows/1.jpg"]}, "pullover": {"name": "Straight-Arm Pulldown", "images": ["https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Straight-Arm_Pulldown/0.jpg", "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Straight-Arm_Pulldown/1.jpg"]}, "curl-inc": {"name": "Incline Dumbbell Curl", "images": ["https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Incline_Dumbbell_Curl/0.jpg", "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Incline_Dumbbell_Curl/1.jpg"]}, "curl-martillo": {"name": "Alternate Hammer Curl", "images": ["https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Alternate_Hammer_Curl/0.jpg", "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Alternate_Hammer_Curl/1.jpg"]}, "antebrazo": {"name": "Cable Wrist Curl", "images": ["https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Cable_Wrist_Curl/0.jpg", "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Cable_Wrist_Curl/1.jpg"]}, "crunch-polea": {"name": "Cable Crunch", "images": ["https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Cable_Crunch/0.jpg", "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Cable_Crunch/1.jpg"]}, "sentadilla": {"name": "Barbell Squat", "images": ["https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Squat/0.jpg", "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Squat/1.jpg"]}, "pmr": {"name": "Romanian Deadlift", "images": ["https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Romanian_Deadlift/0.jpg", "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Romanian_Deadlift/1.jpg"]}, "femoral-tum": {"name": "Lying Leg Curls", "images": ["https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Lying_Leg_Curls/0.jpg", "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Lying_Leg_Curls/1.jpg"]}, "ext-cuad": {"name": "Leg Extensions", "images": ["https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Leg_Extensions/0.jpg", "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Leg_Extensions/1.jpg"]}, "gemelo-pie": {"name": "Standing Barbell Calf Raise", "images": ["https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Standing_Barbell_Calf_Raise/0.jpg", "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Standing_Barbell_Calf_Raise/1.jpg"]}, "plancha": {"name": "Plank", "images": ["https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Plank/0.jpg", "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Plank/1.jpg"]}, "banca": {"name": "Barbell Bench Press - Medium Grip", "images": ["https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Bench_Press_-_Medium_Grip/0.jpg", "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Bench_Press_-_Medium_Grip/1.jpg"]}, "cruce-poleas": {"name": "Cable Crossover", "images": ["https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Cable_Crossover/0.jpg", "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Cable_Crossover/1.jpg"]}, "remo-maq": {"name": "Leverage High Row", "images": ["https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Leverage_High_Row/0.jpg", "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Leverage_High_Row/1.jpg"]}, "jalon-neutro": {"name": "Close-Grip Front Lat Pulldown", "images": ["https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Close-Grip_Front_Lat_Pulldown/0.jpg", "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Close-Grip_Front_Lat_Pulldown/1.jpg"]}, "curl-polea": {"name": "Standing Biceps Cable Curl", "images": ["https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Standing_Biceps_Cable_Curl/0.jpg", "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Standing_Biceps_Cable_Curl/1.jpg"]}, "tri-recto": {"name": "Triceps Pushdown - V-Bar Attachment", "images": ["https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Triceps_Pushdown_-_V-Bar_Attachment/0.jpg", "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Triceps_Pushdown_-_V-Bar_Attachment/1.jpg"]}, "bulgara": {"name": "Split Squat with Dumbbells", "images": ["https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Split_Squat_with_Dumbbells/0.jpg", "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Split_Squat_with_Dumbbells/1.jpg"]}, "femoral-sent": {"name": "Seated Leg Curl", "images": ["https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Seated_Leg_Curl/0.jpg", "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Seated_Leg_Curl/1.jpg"]}, "gemelo-sent": {"name": "Seated Calf Raise", "images": ["https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Seated_Calf_Raise/0.jpg", "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Seated_Calf_Raise/1.jpg"]}, "aductores": {"name": "Thigh Adductor", "images": ["https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Thigh_Adductor/0.jpg", "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Thigh_Adductor/1.jpg"]}, "elev-piernas": {"name": "Hanging Leg Raise", "images": ["https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Hanging_Leg_Raise/0.jpg", "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Hanging_Leg_Raise/1.jpg"]}, "prensa": {"name": "Leg Press", "images": ["https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Leg_Press/0.jpg", "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Leg_Press/1.jpg"]}};
const SEED_EX=[
E('press-inc','Press inclinado con mancuernas (30°)','Pecho',[
 'Banco a 30° (dos o tres muescas desde plano). Más inclinado que eso y el hombro se lleva el trabajo.',
 'Sentate con las mancuernas apoyadas en los muslos y empujalas con las rodillas al recostarte.',
 'Muñecas rectas, codos a 45-60° del torso: ni pegados al cuerpo ni abiertos en cruz.',
 'Bajá hasta sentir estiramiento en el pecho, con las mancuernas a la altura del pecho alto.',
 'Empujá hacia arriba y apenas hacia adentro, sin chocar las mancuernas ni bloquear los codos.'],
 'Arquear la espalda de más y convertirlo en un press plano. Omóplatos juntos y hacia abajo, cola apoyada.',
 'El mejor constructor de pecho superior. Estiramiento bajo carga: no rebotes abajo.'),
E('press-maq','Press de pecho en máquina o polea (plano)','Pecho',[
 'Ajustá el asiento para que los mangos queden a la altura del medio del pecho, no del cuello.',
 'Omóplatos apretados contra el respaldo durante todo el movimiento.',
 'Empujá hacia adelante hasta casi extender los codos, sin bloquearlos.',
 'Volvé controlando hasta sentir el estiramiento; no dejes que el peso golpee la pila.'],
 'Levantar los hombros hacia adelante al empujar. Si el hombro se despega del respaldo, bajá el peso.',
 'Fatiga menos el hombro que la barra y permite ir cerca del fallo con seguridad.'),
E('press-mil','Press militar sentado con mancuernas','Deltoides ant/post',[
 'Respaldo casi vertical (80-90°). Espalda apoyada, pies firmes en el piso.',
 'Mancuernas a la altura de las orejas, palmas hacia adelante, codos apenas por delante del torso.',
 'Empujá hacia arriba juntando levemente las mancuernas, sin chocarlas.',
 'Bajá hasta que los codos queden a la altura de los hombros o apenas por debajo.'],
 'Arquear la zona lumbar para ayudarse. Apretá el abdomen y mantené las costillas hacia abajo.',
 'Con el press de pecho ya trabajado, 2 series alcanzan.'),
E('lat-polea','Elevaciones laterales en polea (a una mano)','Deltoides lateral',[
 'Polea en la posición más baja, mango simple. Parate de costado, con la polea del lado contrario al brazo que trabaja.',
 'El cable cruza por delante del cuerpo: agarrá el mango con el brazo que queda lejos de la polea.',
 'Codo apenas flexionado y fijo. Subí el brazo al costado hasta la altura del hombro, no más.',
 'Pensá en llevar el codo hacia afuera, no la mano hacia arriba. Bajá lento, resistiendo.'],
 'Encoger el hombro hacia la oreja y usar el trapecio. Hombro abajo: el movimiento nace del deltoides.',
 'Clave para el ancho de hombros. La polea mantiene tensión abajo, donde la mancuerna la pierde.'),
E('face-pull','Face pull en polea','Deltoides ant/post',[
 'Cuerda en una polea a la altura de la cara o un poco más arriba.',
 'Agarrá la cuerda con las palmas enfrentadas, un paso atrás para tensar el cable.',
 'Tirá hacia tu cara separando las manos, como si abrieras la cuerda en dos.',
 'Terminá con las manos a los costados de la cabeza y los codos altos, a la altura de los hombros.',
 'Pausá medio segundo apretando la parte de atrás del hombro y volvé controlando.'],
 'Usar demasiado peso y terminar tirando con la espalda y el torso hacia atrás. Es un ejercicio liviano.',
 'Deltoides posterior + salud del hombro y postura.'),
E('tri-oh','Extensión de tríceps por encima de la cabeza en polea','Tríceps',[
 'Cuerda en polea alta. Agarrala y date vuelta: quedás de espaldas a la polea, con la cuerda pasando detrás de tu cabeza.',
 'Un pie adelante para estabilizarte, torso levemente inclinado hacia adelante.',
 'Codos apuntando al frente y hacia arriba, pegados a la cabeza. No se mueven en todo el ejercicio.',
 'Estirá los brazos hacia adelante y arriba hasta extenderlos, separando las manos al final.',
 'Dejá que las manos vuelvan atrás de la nuca hasta sentir el estiramiento fuerte en la parte de atrás del brazo.'],
 'Abrir los codos hacia los costados o dejar que se muevan hacia atrás. Si no podés fijarlos, bajá el peso.',
 'Porción larga en posición estirada: el mejor ejercicio de tríceps del plan. No lo reemplaces por otro jalón.'),
E('tri-cuerda','Jalón de tríceps en polea con cuerda','Tríceps',[
 'Polea alta con cuerda. Parate de frente, un paso atrás de la torre.',
 'Codos pegados a los costados del torso, torso apenas inclinado hacia adelante.',
 'Estirá los codos hacia abajo y separá las manos al final del recorrido.',
 'Subí controlando solo hasta que los codos formen 90°, sin dejar que suban los hombros.'],
 'Mover los codos hacia atrás y adelante, convirtiéndolo en un empuje de todo el cuerpo. Solo se mueve el antebrazo.',
 'Termina el trabajo en posición acortada (porciones lateral y medial).'),
E('fondos','Fondos en paralelas','Pecho',[
 'Torso inclinado hacia adelante unos 15-20° para llevar el trabajo al pecho inferior.',
 'Bajá hasta sentir estiramiento en el pecho, con el hombro sin colapsar hacia adelante.',
 'Subí sin bloquear los codos de golpe.',
 'Si hacés más de 12 repeticiones limpias, agregá lastre con cinturón.'],
 'Bajar demasiado con los hombros encogidos. Si te molesta el hombro, achicá el recorrido.',
 'Es un básico de empuje, no un aislado de tríceps: si lo sumás, reemplazá el press de pecho en máquina del Día A. No lo agregues encima.'),

E('dominadas','Dominadas (o jalón al pecho)','Espalda',[
 'Agarre prono (palmas hacia adelante), manos un poco más anchas que los hombros.',
 'Antes de tirar, bajá los hombros: alejá las orejas de los hombros. Ese es el inicio real del movimiento.',
 'Tirá llevando los codos hacia abajo y atrás, pensando en llevar el pecho a la barra.',
 'Subí hasta que la barbilla pase la barra; bajá hasta extender casi del todo, sin quedar colgando flojo.',
 'En el jalón al pecho: mismo agarre, torso 10-15° hacia atrás, la barra baja al pecho alto, no a la nuca.'],
 'Tirar primero con los brazos. La espalda inicia, el bíceps acompaña. Si no llegás a 6, usá jalón o banda.',
 'Si hacés más de 12 limpias, agregá lastre.'),
E('remo-polea','Remo en polea baja con agarre neutro','Espalda',[
 'Sentado, pies firmes, rodillas apenas flexionadas, agarre en V (palmas enfrentadas).',
 'Torso vertical o 5-10° hacia atrás, y se queda ahí: el torso no se balancea.',
 'Estirá los brazos adelante dejando que los omóplatos se separen (estiramiento del dorsal).',
 'Tirá el mango hacia el ombligo llevando los codos pegados al cuerpo, hacia atrás.',
 'Pausá medio segundo apretando los omóplatos y volvé controlando.'],
 'Usar el impulso del torso hacia atrás y adelante como un remo de bote. Si necesitás eso, es mucho peso.',
 'Grosor de espalda media.'),
E('pullover','Pullover en polea alta (brazos casi rectos)','Espalda',[
 'Polea alta con barra recta o cuerda. Parate a un paso y medio, torso inclinado 30-45° hacia adelante.',
 'Brazos casi rectos, con una flexión mínima y fija en el codo.',
 'Llevá la barra hacia abajo en arco hasta los muslos.',
 'Volvé arriba controlando, hasta sentir el estiramiento en el costado de la espalda.'],
 'Flexionar los codos y transformarlo en un jalón de tríceps. Los codos quedan bloqueados todo el rato.',
 'Aísla el dorsal sin fatigar el bíceps. Excelente estiramiento bajo carga.'),
E('curl-inc','Curl inclinado con mancuernas (banco a 60°)','Bíceps',[
 'Banco a 60° (más vertical que el press inclinado). Espalda bien apoyada.',
 'Brazos colgando a los costados, atrás de la línea del torso. Palmas hacia adelante.',
 'Flexioná el codo sin mover el brazo: el codo se queda quieto al costado del cuerpo.',
 'Bajá hasta extender casi completamente. Esa posición estirada es el punto fuerte del ejercicio.'],
 'Dejar que el codo viaje hacia adelante para llegar más arriba. El recorrido de abajo es el que importa.',
 'Carga el bíceps en máxima elongación: la variante con más evidencia a favor.'),
E('curl-martillo','Curl martillo (mancuernas o cuerda)','Bíceps',[
 'De pie, palmas enfrentadas (como si agarraras un martillo). Se mantiene así todo el movimiento.',
 'Codos pegados al torso y fijos.',
 'Subí hasta la altura del hombro, sin balancear el cuerpo.',
 'Bajá en 2-3 segundos hasta extender el codo.'],
 'Balancear el torso hacia atrás para arrancar el peso. Si pasa, bajá el peso o apoyá la espalda en una pared.',
 'Braquial y braquiorradial: es lo que engrosa el brazo visto de frente.'),
E('antebrazo','Curl de muñeca o agarre muerto en barra','Antebrazo',[
 'Curl de muñeca: sentado, antebrazos apoyados en los muslos, palmas hacia arriba, barra en las manos.',
 'Dejá que la barra ruede hasta la punta de los dedos, después cerrala y subí solo con la muñeca.',
 'Agarre muerto (alternativa): agarrá dos mancuernas pesadas y sostenelas colgando 30-45 segundos.',
 'En el agarre muerto: hombros abajo, abdomen apretado, respirando normal. Contás tiempo, no repeticiones.'],
 'Usar tanto peso que el movimiento salga del codo. Acá solo se mueve la muñeca.',
 'Si hacés agarre muerto, anotá los segundos en la casilla de repeticiones.'),
E('crunch-polea','Crunch en polea alta arrodillado','Core',[
 'Cuerda en polea alta. Arrodillate a un paso de la torre, cuerda a los costados de la cara.',
 'Cadera fija: no se sienta hacia atrás ni se mueve durante el ejercicio.',
 'Enrollá la columna hacia abajo llevando los codos hacia los muslos, como cerrando el torso.',
 'Volvé arriba controlando hasta estirar el abdomen, sin perder la tensión.'],
 'Flexionar la cadera en vez de la columna (bajar con la espalda recta). El movimiento es de enrollar.',
 'Core con sobrecarga progresiva, que es lo que le falta a la mayoría de los abdominales.'),

E('sentadilla','Sentadilla con barra (o prensa 45°)','Cuádriceps',[
 'Barra sobre el trapecio, pies al ancho de hombros y puntas apenas hacia afuera.',
 'Inspirá, apretá el abdomen, y bajá empujando la cadera hacia atrás y las rodillas hacia afuera.',
 'Bajá hasta que el muslo quede paralelo al piso o un poco más, sin que la espalda baja se redondee.',
 'Subí empujando el piso con el medio del pie, sin que la cadera suba primero.',
 'Prensa 45°: pies a media plataforma, ancho de hombros. Bajá hasta 90° de rodilla sin despegar la cola.'],
 'Levantar los talones o dejar que las rodillas se metan hacia adentro. Si pasa, bajá menos o achicá el peso.',
 'Elegí una variante y quedate con ella 8 semanas.'),
E('pmr','Peso muerto rumano','Isquios/Glúteo',[
 'De pie, barra o mancuernas delante de los muslos, pies al ancho de cadera, rodillas apenas flexionadas.',
 'Llevá la cadera hacia atrás como si empujaras una puerta con la cola, dejando que el peso baje pegado a las piernas.',
 'La espalda se mantiene recta todo el tiempo. Las rodillas casi no se mueven.',
 'Bajá hasta sentir un estiramiento fuerte atrás del muslo, normalmente a media canilla.',
 'Subí apretando los glúteos hasta quedar parado, sin echarte hacia atrás.'],
 'Convertirlo en una sentadilla flexionando las rodillas. Es un movimiento de cadera, no de rodilla.',
 'Isquios + glúteo en estiramiento.'),
E('femoral-tum','Curl femoral tumbado','Isquios/Glúteo',[
 'Boca abajo, el rodillo justo arriba del talón (no en el tendón de Aquiles).',
 'Cadera pegada al banco; si se despega, es mucho peso.',
 'Flexioná las rodillas llevando los talones hacia la cola, todo el recorrido posible.',
 'Bajá en 2-3 segundos hasta casi extender del todo, sin soltar la tensión.'],
 'Levantar la cadera para dar impulso. Apretá glúteos y abdomen contra el banco.',
 'Cubre la flexión de rodilla, que el peso muerto rumano no trabaja.'),
E('ext-cuad','Extensión de cuádriceps','Cuádriceps',[
 'Ajustá el respaldo para que la rodilla quede alineada con el eje de giro de la máquina.',
 'Rodillo sobre el empeine, arriba del tobillo. Agarrate de las manijas.',
 'Estirá las rodillas hasta arriba y pausá 1 segundo apretando el cuádriceps.',
 'Bajá lento, controlando, hasta unos 90° de rodilla.'],
 'Tirar impulso con la cadera y dejar caer el peso. La bajada lenta es donde está el estímulo.',
 'Aísla el recto femoral, el único cuádriceps que la sentadilla trabaja poco.'),
E('gemelo-pie','Elevación de gemelos de pie','Gemelos',[
 'Punta del pie en el escalón o plataforma, talón al aire.',
 'Bajá el talón todo lo que puedas y pausá 1 segundo en el estiramiento.',
 'Subí hasta la máxima punta de pie y pausá 1 segundo arriba.',
 'Rodillas estiradas todo el tiempo (así trabajás el gemelo, no el sóleo).'],
 'Rebotar sin pausas y con medio recorrido. El gemelo solo responde a rango completo y tiempo bajo tensión.',''),
E('plancha','Plancha con peso o rueda abdominal','Core',[
 'Plancha: codos bajo los hombros, cuerpo en línea recta de la cabeza a los talones.',
 'Meté la pelvis y apretá glúteos y abdomen. Si aguantás más de 45 s, agregá un disco en la espalda alta.',
 'Rueda: de rodillas, rueda bajo los hombros, abdomen apretado y cola metida.',
 'Rodá hacia adelante todo lo que puedas sin que la espalda baja se arquee, y volvé tirando con el abdomen.'],
 'Dejar caer la cadera y arquear la lumbar. Si sentís tirón en la espalda baja, achicá el recorrido.',
 'Anti-extensión: protege la lumbar en sentadilla y peso muerto. Si es plancha, anotá segundos.'),

E('banca','Press de banca plano con barra','Pecho',[
 'Ojos debajo de la barra, omóplatos juntos y hacia abajo, pies firmes en el piso.',
 'Agarre un poco más ancho que los hombros. Muñecas rectas, la barra en la base de la palma.',
 'Bajá la barra al pecho bajo / línea del pezón, con los codos a 45-60° del torso.',
 'Tocá el pecho sin rebotar y empujá en diagonal hacia atrás, hacia la vertical de los hombros.',
 'Si entrenás solo cerca del fallo, usá el rack con topes o máquina Smith.'],
 'Abrir los codos a 90° respecto al torso. Es la vía rápida a una lesión de hombro y además rinde menos.',''),
E('cruce-poleas','Cruce de poleas de abajo hacia arriba','Pecho',[
 'Ambas poleas en la posición más baja, mangos simples. Un pie adelante, torso levemente inclinado.',
 'Brazos abiertos y abajo, codos con una flexión leve y fija.',
 'Subí las manos en diagonal hacia adelante y arriba, hasta juntarlas a la altura del pecho alto.',
 'Apretá 1 segundo arriba y volvé abriendo, controlando, hasta sentir el estiramiento.'],
 'Flexionar los codos y convertirlo en un press. El codo mantiene su ángulo del principio al fin.',''),
E('remo-maq','Remo en máquina o remo con barra','Espalda',[
 'Máquina: pecho apoyado en la almohadilla, agarre neutro o prono según disponibilidad.',
 'Barra: torso inclinado 45°, espalda recta, barra colgando de los brazos estirados.',
 'Tirá llevando los codos hacia atrás, el mango o la barra hacia el ombligo.',
 'Apretá los omóplatos al final y volvé estirando los brazos por completo.'],
 'Levantar el torso al tirar (en la versión con barra). El ángulo del torso no cambia durante la serie.',''),
E('jalon-neutro','Jalón al pecho con agarre neutro','Espalda',[
 'Manija en V o agarre paralelo, muslos trabados bajo el rodillo.',
 'Torso 10-15° hacia atrás y fijo. Bajá los hombros antes de tirar.',
 'Tirá hasta que las manos lleguen al pecho alto, codos hacia abajo y atrás.',
 'Volvé arriba controlando, dejando que los hombros suban al final para estirar el dorsal.'],
 'Balancear el torso hacia atrás para bajar la barra. Si el torso se mueve, es mucho peso.',''),
E('curl-polea','Curl en polea baja con barra recta','Bíceps',[
 'Polea baja con barra recta o W. Parate a un paso, brazos estirados hacia abajo.',
 'Codos pegados al torso y fijos, hombros hacia atrás.',
 'Flexioná hasta la altura del pecho, apretando 1 segundo arriba.',
 'Bajá en 2-3 segundos hasta extender casi del todo, sin soltar la tensión.'],
 'Dejar que los codos se vayan hacia adelante al subir, quitándole tensión al bíceps.',''),
E('tri-recto','Jalón de tríceps en polea con agarre recto','Tríceps',[
 'Polea alta con barra recta, agarre prono al ancho de los hombros.',
 'Codos pegados al torso, torso apenas inclinado hacia adelante y estable.',
 'Estirá los codos hasta abajo, sin bloquearlos con violencia.',
 'Subí controlando hasta 90° de codo. Solo se mueve el antebrazo.'],
 'Empujar con todo el cuerpo hacia abajo. Si te tenés que inclinar para bajar la barra, achicá el peso.',''),

E('bulgara','Sentadilla búlgara con mancuernas','Cuádriceps',[
 'Pie de atrás apoyado en un banco, pie de adelante a un paso largo por delante.',
 'Mancuernas colgando a los costados, torso inclinado 20° (más glúteo) o vertical (más cuádriceps).',
 'Bajá recto, dejando que la rodilla de adelante avance sobre el pie, hasta que el muslo quede paralelo.',
 'Subí empujando con el talón del pie de adelante. La pierna de atrás solo equilibra.',
 'Terminá todas las repeticiones de una pierna y después cambiá. Contá la serie como una sola.'],
 'Poner el pie de adelante demasiado cerca del banco. Si la rodilla molesta, alejá el pie un paso más.',
 'Máximo estímulo de glúteo y cuádriceps con poca carga espinal.'),
E('femoral-sent','Curl femoral sentado','Isquios/Glúteo',[
 'Sentado, respaldo ajustado para que la rodilla coincida con el eje de la máquina.',
 'Rodillo superior firme sobre los muslos, rodillo inferior justo arriba del talón.',
 'Flexioná las rodillas hacia abajo y atrás, todo el recorrido posible.',
 'Volvé en 2-3 segundos hasta casi extender, manteniendo la cadera flexionada.'],
 'Despegar la espalda del respaldo para ganar recorrido. La cadera se queda flexionada todo el tiempo.',
 'Superior al tumbado: estira el isquio desde la cadera y genera más crecimiento.'),
E('gemelo-sent','Elevación de gemelos sentado','Gemelos',[
 'Sentado, rodillas a 90° con la almohadilla sobre los muslos, punta del pie en la plataforma.',
 'Bajá el talón hasta el máximo estiramiento y pausá 1 segundo.',
 'Subí a la máxima punta de pie y pausá 1 segundo.',
 'Con la rodilla flexionada el trabajo se lo lleva el sóleo.'],
 'Hacer repeticiones rápidas y cortas. Sin pausas arriba y abajo, este ejercicio no sirve de nada.',''),
E('aductores','Aductores en máquina o polea baja','Aductores',[
 'Máquina: sentado, apertura inicial hasta sentir estiramiento en la ingle, sin dolor.',
 'Cerrá las piernas juntando las rodillas y pausá 1 segundo apretando.',
 'Abrí en 2-3 segundos controlando, hasta el estiramiento.',
 'Polea: tobillera en la pierna interna, de costado a la polea, cruzá la pierna por delante de la otra.'],
 'Arrancar con una apertura excesiva y peso alto. Empezá conservador: es un músculo que rara vez se entrena.',''),
E('elev-piernas','Elevación de piernas colgado o en paralelas','Core',[
 'Colgado de la barra o apoyado en las paralelas, hombros activos (no colgando flojo).',
 'Subí las rodillas hacia el pecho enrollando la pelvis al final, no solo flexionando la cadera.',
 'Bajá en 2-3 segundos, sin balanceo.',
 'Cuando te salgan 15 limpias, hacelas con las piernas estiradas o con una mancuerna entre los pies.'],
 'Balancearse como un péndulo. Si no podés frenar el balanceo, hacelas apoyado en las paralelas.',''),
E('prensa','Prensa 45°','Cuádriceps',[
 'Pies a media plataforma, al ancho de hombros.',
 'Bajá hasta 90° de rodilla sin despegar la cola del respaldo.',
 'Empujá con el medio del pie, sin bloquear las rodillas de golpe.'],
 'Bajar tanto que la pelvis se levante del respaldo. Ahí es donde se lastima la lumbar.',
 'Bloque de pierna del Día D en semanas de 4 días.'),
];

/* ---------- semilla: rutinas ---------- */
function I(exerciseId,sets,repsMin,repsMax,rir,rest,ss,note){return {id:uid(),exerciseId,sets,repsMin,repsMax,rir:rir||'1-2',rest:rest||90,ss:ss||'',note:note||''};}
function SEED_ROUTINES(){return [
 {id:'day-a',name:'A · Empuje',subtitle:'Pecho · Tríceps · Deltoides',mins:55,items:[
   I('press-inc',3,6,10,'1-2',150),I('press-maq',3,8,12,'1',90),I('press-mil',2,8,12,'1-2',90),
   I('lat-polea',3,12,20,'0-1',45,'A'),I('face-pull',3,12,20,'0-1',45,'A'),
   I('tri-oh',3,10,15,'0-1',45,'B'),I('tri-cuerda',2,10,15,'0-1',45,'B')]},
 {id:'day-b',name:'B · Tirón',subtitle:'Espalda · Bíceps · Antebrazo · Core',mins:55,items:[
   I('dominadas',3,6,12,'1-2',150),I('remo-polea',3,8,12,'1-2',120),I('pullover',2,12,15,'0-1',60),
   I('curl-inc',3,8,12,'1',75),
   I('curl-martillo',3,10,15,'0-1',45,'A'),I('antebrazo',2,15,20,'0-1',45,'A'),
   I('crunch-polea',3,10,15,'0-1',60)]},
 {id:'day-c',name:'C · Pierna A',subtitle:'Cuádriceps · Isquios · Gemelo · Core',mins:58,items:[
   I('sentadilla',3,6,10,'1-2',180),I('pmr',3,8,12,'1-2',120),I('femoral-tum',3,10,15,'0-1',75),
   I('ext-cuad',2,12,15,'0-1',60),
   I('gemelo-pie',3,8,15,'0-1',45,'A'),I('plancha',3,8,12,'1',45,'A')]},
 {id:'day-d',name:'D · Torso',subtitle:'Pecho · Espalda · Brazos · Deltoides lateral',mins:55,items:[
   I('banca',3,6,10,'1-2',150),I('cruce-poleas',3,12,15,'0-1',60),I('remo-maq',3,8,12,'1-2',120),
   I('jalon-neutro',3,10,12,'1',90),I('lat-polea',3,12,20,'0-1',45),
   I('curl-polea',2,10,15,'0-1',45,'A'),I('tri-recto',2,10,15,'0-1',45,'A')]},
 {id:'day-d4',name:'D+ · Torso + pierna',subtitle:'Variante de semanas de 4 días',mins:65,items:[
   I('banca',3,6,10,'1-2',150),I('cruce-poleas',3,12,15,'0-1',60),I('remo-maq',3,8,12,'1-2',120),
   I('jalon-neutro',3,10,12,'1',90),I('lat-polea',3,12,20,'0-1',45),
   I('curl-polea',2,10,15,'0-1',45,'A'),I('tri-recto',2,10,15,'0-1',45,'A'),
   I('prensa',2,10,15,'1',60),I('femoral-sent',2,10,15,'0-1',60),I('aductores',2,12,20,'0-1',45)]},
 {id:'day-e',name:'E · Pierna B',subtitle:'Cuádriceps · Isquios · Sóleo · Aductores · Core',mins:55,items:[
   I('bulgara',3,8,12,'1-2',120),I('ext-cuad',3,12,15,'0-1',60),I('femoral-sent',3,10,15,'0-1',75),
   I('gemelo-sent',3,12,20,'0-1',45,'A'),I('aductores',2,12,20,'0-1',45,'A'),
   I('elev-piernas',3,10,15,'0-1',60)]},
];}

function seedState(){return {
  v:1, exercises:SEED_EX.map(x=>{
    const o=Object.assign({},x);
    if(EX_IMAGES[x.id]) o.images=EX_IMAGES[x.id].images.slice();
    return o;
  }), routines:SEED_ROUTINES(),
  sessions:[], bw:[], active:null,
  settings:{rest:90,sound:true,vibrate:true,bar:20,autoTimer:true,wake:true,theme:'dark',accent:'mostaza'},
  ui:{progressEx:'press-inc'}
};}

/* ---------- estado ---------- */
let state = readStore() || seedState();
(function migrate(){
  state.exercises=state.exercises||[]; state.routines=state.routines||[]; state.sessions=state.sessions||[];
  state.exercises.forEach(e=>{
    if(!e.images) e.images = (EX_IMAGES[e.id] && !e.custom) ? EX_IMAGES[e.id].images.slice() : [];
  });
  state.bw=state.bw||[]; state.ui=state.ui||{}; 
  state.settings=Object.assign({rest:90,sound:true,vibrate:true,bar:20,autoTimer:true,wake:true,theme:'dark',accent:'mostaza'},state.settings||{});
})();

let view = state.active ? 'train' : 'train';

/* ---------- helpers de dominio ---------- */
const exById = id=>state.exercises.find(e=>e.id===id);
const exName = id=>{const e=exById(id);return e?e.name:'(ejercicio borrado)';};
const routineById = id=>state.routines.find(r=>r.id===id);
const doneSessions = ()=>state.sessions.filter(s=>s.endedAt).sort((a,b)=>a.date<b.date?1:a.date>b.date?-1:(b.startedAt||0)-(a.startedAt||0));

function lastPerf(exId,excludeSessionId){
  for(const s of doneSessions()){
    if(s.id===excludeSessionId) continue;
    const en=(s.entries||[]).find(e=>e.exerciseId===exId);
    if(en && en.sets.some(x=>x.done)) return {date:s.date, sets:en.sets.filter(x=>x.done)};
  }
  return null;
}
function bestE1RM(exId,excludeSessionId){
  let best=0;
  for(const s of state.sessions){
    if(!s.endedAt || s.id===excludeSessionId) continue;
    const en=(s.entries||[]).find(e=>e.exerciseId===exId); if(!en) continue;
    en.sets.forEach(x=>{ if(x.done) best=Math.max(best,e1rm(num(x.w)||0,num(x.r)||0)); });
  }
  return best;
}
function sessionVolume(s){
  let v=0,sets=0;
  (s.entries||[]).forEach(en=>en.sets.forEach(x=>{ if(x.done){ sets++; v+=(num(x.w)||0)*(num(x.r)||0); }}));
  return {v,sets};
}
function weeklySets(days){
  const lim=new Date(Date.now()-days*864e5).toISOString().slice(0,10);
  const out={}; GROUPS.forEach(g=>out[g]=0);
  state.sessions.filter(s=>s.endedAt&&s.date>=lim).forEach(s=>{
    (s.entries||[]).forEach(en=>{ const ex=exById(en.exerciseId); if(!ex) return;
      const n=en.sets.filter(x=>x.done).length; out[ex.group]=(out[ex.group]||0)+n; });
  });
  return out;
}

/* ---------- toast ---------- */
let toastT=null;
function toast(msg){ const t=$('#toast'); t.textContent=msg; t.classList.add('on'); clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove('on'),2200); }

/* ---------- sheet ---------- */
function openSheet(html){ $('#sheetin').innerHTML=html; $('#sheet').classList.add('on'); $('#scrim').classList.add('on'); $('#sheet').scrollTop=0; }
function closeSheet(){ $('#sheet').classList.remove('on'); $('#scrim').classList.remove('on'); }

/* ---------- temporizador ---------- */
const T={end:0,total:0,int:null,label:'',beeped:false};
function startTimer(sec,label){
  T.total=sec; T.end=Date.now()+sec*1000; T.label=label||'Descanso'; T.beeped=false;
  $('#timer').classList.add('on'); tick();
  clearInterval(T.int); T.int=setInterval(tick,200);
  try{ localStorage.setItem('bitacora_timer',JSON.stringify({end:T.end,total:T.total,label:T.label})); }catch(e){}
}
function stopTimer(){ clearInterval(T.int); T.int=null; $('#timer').classList.remove('on');
  try{ localStorage.removeItem('bitacora_timer'); }catch(e){} }
function restoreTimer(){
  try{ const o=JSON.parse(localStorage.getItem('bitacora_timer')||'null'); if(!o) return;
    const left=(o.end-Date.now())/1000; if(left<-90){ localStorage.removeItem('bitacora_timer'); return; }
    T.total=o.total; T.end=o.end; T.label=o.label; T.beeped=left<=0;
    $('#timer').classList.add('on'); tick(); clearInterval(T.int); T.int=setInterval(tick,200);
  }catch(e){}
}
/* pantalla encendida durante la sesión (iOS 16.4+) */
let wakeLock=null;
async function keepAwake(on){
  try{
    if(on && state.settings.wake && 'wakeLock' in navigator && !wakeLock){ wakeLock=await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release',()=>{wakeLock=null;}); }
    if(!on && wakeLock){ await wakeLock.release(); wakeLock=null; }
  }catch(e){}
}
document.addEventListener('visibilitychange',()=>{ if(!document.hidden && state.active) keepAwake(true); });
function tick(){
  const left=Math.round((T.end-Date.now())/1000);
  const abs=Math.abs(left), mm=Math.floor(abs/60), ss=String(abs%60).padStart(2,'0');
  $('#tnum').textContent=(left<0?'+':'')+mm+':'+ss;
  $('#tnum').classList.toggle('done',left<=0);
  $('#tlbl').textContent=T.label;
  const pct=left<=0?100:clamp(100-(left/T.total)*100,0,100);
  const f=$('#tfill'); f.style.width=pct+'%'; f.classList.toggle('done',left<=0);
  if(left<=0 && !T.beeped){ T.beeped=true; beep(); }
  if(left<-120) stopTimer();
}
function beep(){
  if(state.settings.vibrate && navigator.vibrate) try{navigator.vibrate([120,80,120,80,220]);}catch(e){}
  if(!state.settings.sound) return;
  try{
    const AC=window.AudioContext||window.webkitAudioContext; if(!AC) return;
    const ac=new AC();
    [0,0.22,0.44].forEach((t,i)=>{
      const o=ac.createOscillator(),g=ac.createGain();
      o.type='sine'; o.frequency.value=i===2?1046:784;
      g.gain.setValueAtTime(.0001,ac.currentTime+t);
      g.gain.exponentialRampToValueAtTime(.32,ac.currentTime+t+.02);
      g.gain.exponentialRampToValueAtTime(.0001,ac.currentTime+t+.18);
      o.connect(g); g.connect(ac.destination); o.start(ac.currentTime+t); o.stop(ac.currentTime+t+.2);
    });
    setTimeout(()=>{try{ac.close()}catch(e){}},1200);
  }catch(e){}
}



/* =========================================================
   BLOQUEO CON PIN (queda solo en este dispositivo, no se sincroniza)
   ========================================================= */
const PIN_KEY='bitacora_pin_v1';
function pinHash(s){ let h=5381; for(let i=0;i<s.length;i++) h=((h<<5)+h+s.charCodeAt(i))|0; return String(h); }
function pinInfo(){ try{ return JSON.parse(localStorage.getItem(PIN_KEY)||'null'); }catch(e){ return null; } }
function pinIsSet(){ return !!pinInfo(); }
function pinSet(code){ try{ localStorage.setItem(PIN_KEY, JSON.stringify({h:pinHash(code)})); }catch(e){} }
function pinClear(){ try{ localStorage.removeItem(PIN_KEY); }catch(e){} }
function pinCheck(code){ const i=pinInfo(); return !!i && i.h===pinHash(code); }

let lockMode='unlock'; // unlock | setup1 | setup2 | disable
let lockTemp='';
let lockAttempts=0;
function showLock(mode){
  lockMode=mode; lockAttempts=0;
  if(mode!=='setup2') lockTemp='';
  const titles={unlock:'Ingresá tu PIN',setup1:'Elegí un PIN (4 a 8 dígitos)',setup2:'Repetí el PIN',disable:'Ingresá tu PIN para desactivar'};
  $('#lockTitle').textContent=titles[mode];
  $('#lockMsg').textContent='';
  $('#lockInput').value='';
  $('#lock').classList.add('on');
  setTimeout(()=>$('#lockInput').focus(),50);
}
function hideLock(){ $('#lock').classList.remove('on'); }
function lockSubmit(){
  const val=$('#lockInput').value.trim();
  if(val.length<4){ $('#lockMsg').textContent='Mínimo 4 dígitos.'; return; }
  if(lockMode==='unlock'){
    if(pinCheck(val)){ hideLock(); maybeStartTour(); }
    else{ lockAttempts++; $('#lockMsg').textContent='PIN incorrecto.'; $('#lockInput').value=''; }
    return;
  }
  if(lockMode==='setup1'){ lockTemp=val; showLock('setup2'); return; }
  if(lockMode==='setup2'){
    if(val!==lockTemp){ $('#lockMsg').textContent='No coincide. Empezá de nuevo.'; showLock('setup1'); return; }
    pinSet(val); hideLock(); toast('PIN activado'); render();
    return;
  }
  if(lockMode==='disable'){
    if(pinCheck(val)){ pinClear(); hideLock(); toast('PIN desactivado'); render(); }
    else{ $('#lockMsg').textContent='PIN incorrecto.'; $('#lockInput').value=''; }
    return;
  }
}
$('#lockGo').addEventListener('click', lockSubmit);
$('#lockInput').addEventListener('keydown', e=>{ if(e.key==='Enter') lockSubmit(); });

let appWasHidden=false;
document.addEventListener('visibilitychange', ()=>{
  if(document.hidden){ appWasHidden=true; }
  else if(appWasHidden && pinIsSet()){ appWasHidden=false; showLock('unlock'); }
});

/* =========================================================
   BASE PÚBLICA DE EJERCICIOS (Free Exercise DB, dominio público)
   Se descarga una sola vez (873 ejercicios, ~1 MB) y se guarda
   localmente para buscar sin conexión después.
   ========================================================= */
const EXDB_URL='https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json';
const EXDB_KEY='bitacora_exdb_v1';
let exdbCache=null;
function exdbLoaded(){ if(exdbCache) return exdbCache; try{ exdbCache=JSON.parse(localStorage.getItem(EXDB_KEY)||'null'); }catch(e){} return exdbCache; }
async function exdbEnsure(){
  const have=exdbLoaded(); if(have) return have;
  const res=await fetch(EXDB_URL); if(!res.ok) throw new Error('No se pudo descargar');
  const data=await res.json();
  const slim=data.map(e=>({id:e.id,name:e.name,muscles:e.primaryMuscles||[],instructions:e.instructions||[],images:(e.images||[]).map(p=>'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/'+p)}));
  exdbCache=slim;
  try{ localStorage.setItem(EXDB_KEY, JSON.stringify(slim)); }catch(e){}
  return slim;
}
const MUSCLE_TO_GROUP={chest:'Pecho',lats:'Espalda','middle back':'Espalda','lower back':'Espalda',traps:'Espalda',
  biceps:'Bíceps',triceps:'Tríceps',forearms:'Antebrazo',quadriceps:'Cuádriceps',hamstrings:'Isquios/Glúteo',
  glutes:'Isquios/Glúteo',calves:'Gemelos',adductors:'Aductores',abductors:'Aductores',abdominals:'Core',
  neck:'Core',shoulders:'Deltoides ant/post'};
function guessGroup(name,muscles){
  const m=(muscles&&muscles[0])||'';
  if(m==='shoulders' && /lateral/i.test(name)) return 'Deltoides lateral';
  return MUSCLE_TO_GROUP[m] || 'Pecho';
}
let exdbMode='form';     // 'form' | 'library' | 'routine' | 'replace-item' | 'replace-ex'
let exdbRoutineId=null;  // 'routine' y 'replace-item'
let exdbItemId=null;     // solo usado en modo 'replace-item'
let exdbExId=null;       // solo usado en modo 'replace-ex'
function alreadyImported(sourceId){ return state.exercises.find(x=>x.sourceId===sourceId); }
function sheetExDbSearch(mode, ctx){
  exdbMode=mode||'form'; exdbRoutineId=null; exdbItemId=null; exdbExId=null;
  if(exdbMode==='routine') exdbRoutineId=ctx||null;
  if(exdbMode==='replace-item'){ exdbRoutineId=(ctx&&ctx.routineId)||null; exdbItemId=(ctx&&ctx.itemId)||null; }
  if(exdbMode==='replace-ex') exdbExId=ctx||null;
  const titles={form:'Base pública de ejercicios',library:'Explorar más ejercicios',routine:'Agregar ejercicio a la rutina','replace-item':'Reemplazar ejercicio de la rutina','replace-ex':'Reemplazar ejercicio'};
  const subs={
    form:'873 ejercicios de Free Exercise DB (dominio público), con fotos. Buscá uno y se completa el formulario; después ajustá lo que quieras y guardá.',
    library:'873 ejercicios con fotos. Tocá uno para sumarlo directo a tu biblioteca — podés elegir varios seguidos.',
    routine:'Tocá un ejercicio para agregarlo a esta rutina. Si no estaba en tu biblioteca, se suma solo.',
    'replace-item':'Elegí un reemplazo para esta fila puntual. Series, reps, RIR y descanso ya cargados no se tocan.',
    'replace-ex':'Elegí un reemplazo: se sobrescriben nombre, grupo, pasos y fotos de este ejercicio. Las rutinas que ya lo usan siguen apuntando a él, sin romperse.'
  };
  openSheet(`<div class="between"><div class="h2">${titles[exdbMode]}</div><button class="btn sm ghost" data-act="closesheet">Cerrar</button></div>
    <div class="tiny dim" style="margin:4px 0 10px">${subs[exdbMode]}</div>
    <input type="text" id="exdbQ" placeholder="Buscar en inglés: bench, curl, squat…" autofocus>
    <div id="exdbOut" class="stack" style="margin-top:10px"><div class="tiny dim">Escribí al menos 3 letras.</div></div>`);
  const inp=$('#exdbQ');
  let t=null;
  inp.addEventListener('input',()=>{ clearTimeout(t); t=setTimeout(()=>runExdbSearch(inp.value),250); });
  inp.focus();
}
async function runExdbSearch(q){
  const out=$('#exdbOut'); if(!out) return;
  q=q.trim();
  if(q.length<3){ out.innerHTML='<div class="tiny dim">Escribí al menos 3 letras.</div>'; return; }
  out.innerHTML='<div class="tiny dim">Buscando…</div>';
  let db;
  try{ db=await exdbEnsure(); }catch(e){ out.innerHTML='<div class="warn">No se pudo descargar la base (¿sin internet?). Probá de nuevo con wifi.</div>'; return; }
  const ql=q.toLowerCase();
  const hits=db.filter(e=>e.name.toLowerCase().includes(ql)).slice(0,20);
  if(!hits.length){ out.innerHTML='<div class="tiny dim">Nada con ese término.</div>'; return; }
  out.innerHTML=hits.map(e=>{
    const got=alreadyImported(e.id);
    return `<div class="li" data-act="exdb-pick" data-id="${esc(e.id)}" style="cursor:pointer">
    ${e.images[0]?`<img src="${esc(e.images[0])}" loading="lazy" style="width:52px;height:52px;object-fit:cover;border-radius:8px;flex:0 0 auto" onerror="this.style.display='none'">`:''}
    <div class="grow"><div class="h3 trunc">${esc(e.name)}</div><div class="tiny dim">${esc((e.muscles||[]).join(', ')||'—')}</div></div>
    ${got?'<span class="chip ok">En tu biblioteca</span>':''}
  </div>`;}).join('');
}
function quickImport(e){
  const existing=alreadyImported(e.id);
  if(existing) return existing;
  const created={id:uid(),name:e.name,group:guessGroup(e.name,e.muscles),cues:e.instructions,err:'',tip:'Importado de Free Exercise DB.',images:e.images,custom:false,sourceId:e.id};
  state.exercises.push(created);
  return created;
}
async function pickExdb(id){
  const db=exdbLoaded()||[]; const e=db.find(x=>x.id===id); if(!e) return;

  if(exdbMode==='form'){
    sheetExercise(null, { name:e.name, group:guessGroup(e.name,e.muscles), cues:e.instructions, err:'', tip:'Importado de Free Exercise DB.', images:e.images });
    return;
  }
  if(exdbMode==='library'){
    const before=alreadyImported(e.id);
    const created=quickImport(e);
    save(true);
    toast(before?'Ya estaba en tu biblioteca':'Agregado: '+created.name);
    runExdbSearch($('#exdbQ').value); // refresca la lista para marcar "En tu biblioteca"
    return;
  }
  if(exdbMode==='routine'){
    const created=quickImport(e);
    const r=routineById(exdbRoutineId);
    if(r){
      r.items.push({id:uid(),exerciseId:created.id,sets:3,repsMin:8,repsMax:12,rir:'1-2',rest:90,ss:''});
      save(true);
      toast('Agregado a la rutina: '+created.name);
    }
    closeSheet();
    sheetRoutine(exdbRoutineId);
    return;
  }
  if(exdbMode==='replace-item'){
    const created=quickImport(e);
    const r=routineById(exdbRoutineId);
    const it=r&&r.items.find(x=>x.id===exdbItemId);
    if(it){
      it.exerciseId=created.id;
      save(true);
      toast('Ejercicio reemplazado: '+created.name);
    }
    closeSheet();
    sheetRoutine(exdbRoutineId);
    return;
  }
  if(exdbMode==='replace-ex'){
    const ex=exById(exdbExId); if(!ex) return;
    if(!confirm(`Esto reemplaza el nombre, grupo, pasos y fotos actuales por los de "${e.name}". ¿Seguir?`)) return;
    ex.name=e.name; ex.group=guessGroup(e.name,e.muscles); ex.cues=e.instructions;
    ex.err=''; ex.tip='Reemplazado desde Free Exercise DB.'; ex.images=e.images;
    ex.sourceId=e.id; ex.custom=false;
    save(true);
    toast('Ejercicio reemplazado: '+ex.name);
    sheetExercise(exdbExId);
    return;
  }
}

/* =========================================================
   VISTAS
   ========================================================= */

function applyTheme(){
  document.documentElement.setAttribute('data-theme', state.settings.theme||'dark');
  document.documentElement.setAttribute('data-accent', state.settings.accent||'mostaza');
  const meta=document.querySelector('meta[name=theme-color]');
  if(meta) meta.setAttribute('content', getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()||'#0E1316');
}

function render(){
  applyTheme();
  $$('.nb').forEach(b=>b.classList.toggle('on',b.dataset.v===view));
  const el=$('#app');
  const map={train:viewTrain,routines:viewRoutines,exercises:viewExercises,progress:viewProgress,settings:viewSettings};
  el.innerHTML=(map[view]||viewTrain)();
  window.scrollTo({top:0});
}
function header(eyebrow,title,right){
  return `<header class="top"><div class="wrap"><div class="topbar">
    <div class="grow"><div class="eyebrow">${esc(eyebrow)}</div><div class="h1">${esc(title)}</div></div>
    ${right||''}</div></div></header>`;
}
function storageWarn(){
  return STORAGE_OK?'':`<div class="wrap"><div class="warn" style="margin-top:10px"><b>Vista previa sin guardado.</b> Este entorno bloquea el almacenamiento local. Descargá el archivo y abrilo desde tu celular o compu: ahí sí guarda todo.</div></div>`;
}

/* ---------------- ENTRENAR ---------------- */
function viewTrain(){
  if(state.active) return viewSession();
  const rs=state.routines.map(r=>{
    const last=doneSessions().find(s=>s.routineId===r.id);
    const ago=last?(daysAgo(last.date)===0?'hoy':daysAgo(last.date)===1?'ayer':'hace '+daysAgo(last.date)+' días'):'nunca';
    return `<div class="card" data-act="start" data-id="${r.id}" style="cursor:pointer">
      <div class="between"><div class="grow">
        <div class="h2">${esc(r.name)}</div>
        <div class="small dim trunc">${esc(r.subtitle||'')}</div>
        <div class="row" style="margin-top:8px;gap:6px;flex-wrap:wrap">
          <span class="chip">${r.items.length} ejercicios</span>
          <span class="chip">${r.items.reduce((a,i)=>a+i.sets,0)} series</span>
          <span class="chip">${esc(ago)}</span>
        </div></div>
        <div class="btn primary sm">Empezar</div></div></div>`;
  }).join('');
  const w=weeklySets(7);
  const totalSets=Object.values(w).reduce((a,b)=>a+b,0);
  const last7=state.sessions.filter(s=>s.endedAt&&s.date>=new Date(Date.now()-7*864e5).toISOString().slice(0,10)).length;
  return header('Bitácora','Entrenar',`<button class="btn sm ghost" data-act="quick">Sesión libre</button>`)+storageWarn()+`<div class="wrap">
    <div class="card" style="background:var(--p2)">
      <div class="row" style="gap:16px">
        <div><div class="eyebrow">Últimos 7 días</div><div class="mono" style="font-size:26px;font-weight:800">${last7}<span class="dim" style="font-size:14px"> sesiones</span></div></div>
        <div><div class="eyebrow">Series hechas</div><div class="mono" style="font-size:26px;font-weight:800">${totalSets}</div></div>
      </div>
    </div>
    <div class="eyebrow" style="margin:18px 0 4px">Elegí la sesión de hoy</div>
    ${rs}
    <div class="card flat"><div class="small dim">Regla del plan: no hagas dos días de pierna seguidos y respetá al menos 1 día de descanso cada 3 sesiones.</div></div>
  </div>`;
}

function viewSession(){
  const s=state.active;
  const {v,sets}=sessionVolume(s);
  const total=s.entries.reduce((a,e)=>a+e.sets.length,0);
  const body=s.entries.map((en,idx)=>entryCard(en,idx,s)).join('');
  return header('En curso · '+dlong(s.date),s.name,`<button class="btn sm" data-act="finish">Terminar</button>`)+storageWarn()+`<div class="wrap">
    <div class="card" style="background:var(--p2);padding:11px 14px">
      <div class="between">
        <div><span class="eyebrow">Series</span> <span class="mono" style="font-weight:800">${sets}/${total}</span></div>
        <div><span class="eyebrow">Volumen</span> <span class="mono" style="font-weight:800">${fmt(Math.round(v))} kg</span></div>
        <div><span class="eyebrow">Tiempo</span> <span class="mono" style="font-weight:800" id="elapsed">${elapsed(s)}</span></div>
      </div>
    </div>
    ${body}
    <button class="btn block" data-act="add-ex" style="margin-top:12px">+ Agregar ejercicio a esta sesión</button>
    <label class="f"><span class="eyebrow">Notas de la sesión</span>
      <textarea data-act="s-note" placeholder="Cómo te sentiste, molestias, qué ajustar la próxima…">${esc(s.notes||'')}</textarea></label>
    <div class="grid2" style="margin:12px 0 28px">
      <button class="btn danger" data-act="discard">Descartar</button>
      <button class="btn primary" data-act="finish">Terminar sesión</button>
    </div>
  </div>`;
}
function elapsed(s){
  const ms=Date.now()-(s.startedAt||Date.now()); const m=Math.floor(ms/60000);
  return (m>=60?Math.floor(m/60)+'h ':'')+(m%60)+'m';
}
function entryCard(en,idx,s){
  const ex=exById(en.exerciseId);
  const t=en.target||{};
  const prev=lastPerf(en.exerciseId,s.id);
  const pbest=bestE1RM(en.exerciseId,s.id);
  const rows=en.sets.map((st,i)=>{
    const p=prev&&prev.sets[i];
    const isPR=st.done && pbest>0 && e1rm(num(st.w)||0,num(st.r)||0)>pbest*1.001;
    return `<div class="setgrid setrow ${st.done?'done':''} ${isPR?'pr':''}" data-e="${en.id}" data-i="${i}">
      <div class="setno">${i+1}</div>
      <input type="text" inputmode="decimal" data-f="w" value="${st.w===''?'':esc(st.w)}" placeholder="${p?esc(p.w):'kg'}">
      <input type="text" inputmode="numeric" data-f="r" value="${st.r===''?'':esc(st.r)}" placeholder="${p?esc(p.r):'reps'}">
      <input type="text" inputmode="numeric" data-f="rir" value="${st.rir===''?'':esc(st.rir)}" placeholder="RIR">
      <button class="check" data-act="check">${st.done?(isPR?'★':'✓'):'✓'}</button>
    </div>`;
  }).join('');
  const prevTxt=prev?`Última vez (${dnice(prev.date)}): `+prev.sets.map(x=>`${fmt(num(x.w))}×${x.r}`).join(' · '):'Sin registro previo — esta es tu línea de base.';
  return `<div class="card ${t.ss?'ssgroup':''}">
    <div class="exhead">
      <div class="exnum ${t.ss?'ss':''}">${t.ss?t.ss:idx+1}</div>
      <div class="grow" data-act="guide" data-id="${en.exerciseId}" style="cursor:pointer">
        <div class="h3">${esc(ex?ex.name:'(borrado)')}</div>
        <div class="tiny dim">${esc(ex?ex.group:'')} · objetivo ${t.repsMin||''}-${t.repsMax||''} reps · RIR ${esc(t.rir||'')} · ${t.rest||90}s ${t.ss?' · superserie '+t.ss:''}</div>
      </div>
      <button class="btn icon sm" data-act="entry-menu" data-e="${en.id}">⋯</button>
    </div>
    <div class="setgrid"><div></div><div class="lbl">kg</div><div class="lbl">reps</div><div class="lbl">rir</div><div></div></div>
    ${rows}
    <div class="prevline">${esc(prevTxt)}</div>
    <div class="row" style="margin-top:9px;gap:8px">
      <button class="btn sm" data-act="addset" data-e="${en.id}">+ Serie</button>
      <button class="btn sm" data-act="delset" data-e="${en.id}">− Serie</button>
      <button class="btn sm ghost" data-act="rest" data-e="${en.id}">⏱ ${t.rest||90}s</button>
      <div class="grow"></div>
      <button class="btn sm ghost" data-act="guide" data-id="${en.exerciseId}">Cómo se hace</button>
    </div>
    ${en.note?`<div class="note" style="margin-top:9px">${esc(en.note)}</div>`:''}
  </div>`;
}

/* ---------------- RUTINAS ---------------- */
function viewRoutines(){
  const list=state.routines.map(r=>`<div class="card">
    <div class="between">
      <div class="grow" data-act="r-edit" data-id="${r.id}" style="cursor:pointer">
        <div class="h2">${esc(r.name)}</div>
        <div class="small dim">${esc(r.subtitle||'')}</div>
      </div>
      <button class="btn sm" data-act="r-edit" data-id="${r.id}">Editar</button>
    </div>
    <hr class="sep">
    ${r.items.map((it,i)=>`<div class="row tiny" style="padding:3px 0">
      <span class="mono dim" style="width:20px">${it.ss?it.ss:i+1}</span>
      <span class="grow trunc">${esc(exName(it.exerciseId))}</span>
      <span class="mono dim">${it.sets}×${it.repsMin}-${it.repsMax}</span></div>`).join('')}
    <div class="row" style="margin-top:10px;gap:8px">
      <button class="btn sm ghost" data-act="r-dup" data-id="${r.id}">Duplicar</button>
      <button class="btn sm ghost danger" data-act="r-del" data-id="${r.id}">Borrar</button>
      <div class="grow"></div>
      <button class="btn sm primary" data-act="start" data-id="${r.id}">Empezar</button>
    </div>
  </div>`).join('');
  return header('Tus sesiones','Rutinas',`<button class="btn sm primary" data-act="r-new">+ Nueva</button>`)+`<div class="wrap">${list||'<div class="empty">Todavía no hay rutinas. Creá la primera.</div>'}
    <div class="card flat" style="margin-bottom:28px"><div class="small dim">Mantené los mismos ejercicios 6-10 semanas. Cambiar todo cada semana hace imposible medir el progreso.</div></div></div>`;
}
function sheetRoutine(id){
  const r=id?routineById(id):{id:'',name:'',subtitle:'',items:[]};
  const opts=exOptions();
  const items=r.items.map((it,i)=>`<div class="card" style="padding:11px" data-ri="${i}">
    <div class="row" style="gap:7px">
      <span class="mono dim tiny" style="width:16px">${i+1}</span>
      <select class="grow" data-k="exerciseId">${opts(it.exerciseId)}</select>
      <button class="btn icon sm" data-act="ri-up" data-i="${i}">↑</button>
      <button class="btn icon sm" data-act="ri-down" data-i="${i}">↓</button>
      <button class="btn icon sm" data-act="ri-replace" data-i="${i}" title="Reemplazar ejercicio">⇄</button>
      <button class="btn icon sm danger" data-act="ri-del" data-i="${i}">✕</button>
    </div>
    <div class="grid3" style="margin-top:8px">
      <label class="f" style="margin:0"><span class="eyebrow">Series</span><input type="text" inputmode="numeric" data-k="sets" value="${it.sets}"></label>
      <label class="f" style="margin:0"><span class="eyebrow">Reps mín</span><input type="text" inputmode="numeric" data-k="repsMin" value="${it.repsMin}"></label>
      <label class="f" style="margin:0"><span class="eyebrow">Reps máx</span><input type="text" inputmode="numeric" data-k="repsMax" value="${it.repsMax}"></label>
    </div>
    <div class="grid3" style="margin-top:8px">
      <label class="f" style="margin:0"><span class="eyebrow">RIR</span><input type="text" data-k="rir" value="${esc(it.rir)}"></label>
      <label class="f" style="margin:0"><span class="eyebrow">Descanso s</span><input type="text" inputmode="numeric" data-k="rest" value="${it.rest}"></label>
      <label class="f" style="margin:0"><span class="eyebrow">Superserie</span><input type="text" data-k="ss" value="${esc(it.ss||'')}" placeholder="A, B…"></label>
    </div>
  </div>`).join('');
  openSheet(`<div class="between"><div class="h2">${id?'Editar rutina':'Nueva rutina'}</div><button class="btn sm ghost" data-act="closesheet">Cerrar</button></div>
    <div id="rform" data-id="${esc(r.id)}">
    <label class="f"><span class="eyebrow">Nombre</span><input type="text" data-k="name" value="${esc(r.name)}" placeholder="F · Full body"></label>
    <label class="f"><span class="eyebrow">Subtítulo</span><input type="text" data-k="subtitle" value="${esc(r.subtitle||'')}" placeholder="Músculos que cubre"></label>
    <div class="eyebrow" style="margin:16px 0 6px">Ejercicios</div>
    <div id="ritems">${items||'<div class="empty small">Sin ejercicios todavía.</div>'}</div>
    <div class="grid2" style="margin-top:8px">
      <button class="btn" data-act="ri-add">+ De mi biblioteca</button>
      <button class="btn" data-act="ri-add-db">🔎 Buscar más (873)</button>
    </div>
    <button class="btn block primary" data-act="r-save" style="margin-top:14px">Guardar rutina</button>
    </div>`);
}
function exOptions(){
  const byG={}; state.exercises.forEach(e=>{(byG[e.group]=byG[e.group]||[]).push(e)});
  return sel=>Object.keys(byG).sort().map(g=>`<optgroup label="${esc(g)}">`+byG[g].map(e=>`<option value="${e.id}" ${e.id===sel?'selected':''}>${esc(e.name)}</option>`).join('')+`</optgroup>`).join('');
}

/* ---------------- EJERCICIOS ---------------- */
function viewExercises(){
  const q=(state.ui.exq||'').toLowerCase();
  const list=state.exercises.filter(e=>!q||e.name.toLowerCase().includes(q)||e.group.toLowerCase().includes(q));
  const byG={}; list.forEach(e=>{(byG[e.group]=byG[e.group]||[]).push(e)});
  const blocks=Object.keys(byG).sort().map(g=>`<div class="eyebrow" style="margin:18px 0 2px">${esc(g)} · ${byG[g].length}</div>
    <div class="card">${byG[g].map(e=>`<div class="li">
      <div class="grow" data-act="guide" data-id="${e.id}" style="cursor:pointer">
        <div class="h3 trunc">${esc(e.name)}</div>
        <div class="tiny dim">${e.cues.length} pasos${e.custom?' · propio':''}</div>
      </div>
      <button class="btn sm ghost" data-act="x-edit" data-id="${e.id}">Editar</button>
    </div>`).join('')}</div>`).join('');
  return header('Biblioteca','Ejercicios',`<button class="btn sm primary" data-act="x-new">+ Nuevo</button>`)+`<div class="wrap">
    <input type="text" placeholder="Buscar ejercicio o músculo…" value="${esc(state.ui.exq||'')}" data-act="exq" style="margin-top:6px">
    <button class="btn block ghost" data-act="x-search-db-lib" style="margin-top:10px">🔎 Explorar más ejercicios (873, con fotos)</button>
    ${blocks||'<div class="empty">Nada con ese nombre.</div>'}
    <div style="height:24px"></div></div>`;
}
function sheetGuide(id){
  const e=exById(id); if(!e) return;
  const hist=exerciseHistory(id).slice(0,5);
  const photos=(e.images&&e.images.length)?`<div class="row" style="gap:8px;margin-top:12px;overflow-x:auto" data-photos='${esc(JSON.stringify(e.images))}'>
    ${e.images.map((u,i)=>`<img src="${esc(u)}" loading="lazy" data-act="photo" data-idx="${i}" style="height:150px;border-radius:10px;border:1px solid var(--line);flex:0 0 auto;cursor:zoom-in" onerror="this.style.display='none'">`).join('')}
    </div><div class="tiny dim" style="margin-top:5px">Fotos: Free Exercise DB (dominio público)</div>`:'';
  openSheet(`<div class="between"><div class="grow"><div class="eyebrow">${esc(e.group)}</div><div class="h2">${esc(e.name)}</div></div>
    <button class="btn sm ghost" data-act="closesheet">Cerrar</button></div>
    ${photos}
    ${e.tip?`<div class="note" style="margin-top:12px">${esc(e.tip)}</div>`:''}
    <div class="eyebrow" style="margin:16px 0 4px">Ejecución</div>
    ${e.cues.map((c,i)=>`<div class="cue"><b>${i+1}</b><span>${esc(c)}</span></div>`).join('')}
    ${e.err?`<div class="eyebrow" style="margin:14px 0 4px">Error común</div><div class="warn">${esc(e.err)}</div>`:''}
    ${hist.length?`<div class="eyebrow" style="margin:16px 0 4px">Últimas sesiones</div>
      <table class="t"><tr><th>Fecha</th><th>Mejor serie</th><th class="n">1RM est.</th></tr>
      ${hist.map(h=>`<tr><td>${dnice(h.date)}</td><td>${fmt(h.bw)}×${h.br}</td><td class="n">${fmt(Math.round(h.e))}</td></tr>`).join('')}</table>`:''}
    <button class="btn block" data-act="x-edit" data-id="${e.id}" style="margin-top:16px">Editar este ejercicio</button>`);
}
function sheetExercise(id, prefill){
  const base = id?exById(id):{id:'',name:'',group:'Pecho',cues:[],err:'',tip:'',images:[]};
  const e = prefill ? Object.assign({}, base, prefill, {id: base.id}) : base;
  const photos=(e.images&&e.images.length)?`<div class="row" style="gap:8px;margin:8px 0;overflow-x:auto" data-photos='${esc(JSON.stringify(e.images))}'>
    ${e.images.map((u,i)=>`<img src="${esc(u)}" loading="lazy" data-act="photo" data-idx="${i}" style="height:80px;border-radius:8px;border:1px solid var(--line);flex:0 0 auto;cursor:zoom-in" onerror="this.style.display='none'">`).join('')}
    </div>`:'';
  openSheet(`<div class="between"><div class="h2">${id?'Editar ejercicio':'Nuevo ejercicio'}</div><button class="btn sm ghost" data-act="closesheet">Cerrar</button></div>
    ${id?`<button class="btn block ghost" data-act="x-replace-db" data-id="${esc(e.id)}" style="margin-top:4px">Reemplazar por otro de la base pública</button>`:'<button class="btn block ghost" data-act="x-search-db" style="margin-top:4px">Buscar en la base pública (con fotos)</button>'}
    <div id="xform" data-id="${esc(e.id)}" data-images='${esc(JSON.stringify(e.images||[]))}'>
    ${photos}
    <label class="f"><span class="eyebrow">Nombre</span><input type="text" data-k="name" value="${esc(e.name)}"></label>
    <label class="f"><span class="eyebrow">Grupo muscular</span><select data-k="group">${GROUPS.map(g=>`<option ${g===e.group?'selected':''}>${g}</option>`).join('')}</select></label>
    <label class="f"><span class="eyebrow">Pasos de ejecución (uno por línea)</span><textarea data-k="cues" style="min-height:130px">${esc((e.cues||[]).join('\n'))}</textarea></label>
    <label class="f"><span class="eyebrow">Error común</span><textarea data-k="err" style="min-height:60px">${esc(e.err||'')}</textarea></label>
    <label class="f"><span class="eyebrow">Nota / por qué está elegido</span><textarea data-k="tip" style="min-height:60px">${esc(e.tip||'')}</textarea></label>
    <button class="btn block primary" data-act="x-save" style="margin-top:14px">Guardar</button>
    ${id?`<button class="btn block danger ghost" data-act="x-del" data-id="${e.id}" style="margin-top:8px">Borrar ejercicio</button>`:''}
    </div>`);
}

/* ---------------- VISOR DE FOTOS ---------------- */
let lbImgs=[], lbIdx=0;
function openLightbox(imgs, idx){
  if(tourActive || !imgs || !imgs.length) return;
  lbImgs=imgs; lbIdx=clamp(idx||0,0,imgs.length-1);
  renderLightbox();
  $('#lightbox').classList.add('on');
}
function closeLightbox(){ $('#lightbox').classList.remove('on'); }
function renderLightbox(){
  $('#lbImgs').innerHTML=`<img src="${esc(lbImgs[lbIdx])}" alt="" onerror="this.style.display='none'">`;
  const many=lbImgs.length>1;
  $('#lbPrev').style.display=many?'flex':'none';
  $('#lbNext').style.display=many?'flex':'none';
}
$('#lightbox').addEventListener('click', ev=>{ if(ev.target.id==='lightbox') closeLightbox(); });
document.addEventListener('keydown', ev=>{ if(ev.key==='Escape' && $('#lightbox').classList.contains('on')) closeLightbox(); });

/* ---------------- PROGRESO ---------------- */
function exerciseHistory(exId){
  const out=[];
  doneSessions().forEach(s=>{
    const en=(s.entries||[]).find(e=>e.exerciseId===exId); if(!en) return;
    let bw=0,br=0,best=0,vol=0,sets=0;
    en.sets.forEach(x=>{ if(!x.done) return; const w=num(x.w)||0,r=num(x.r)||0; sets++; vol+=w*r;
      const e=e1rm(w,r); if(e>best){best=e;bw=w;br=r;} });
    if(sets) out.push({date:s.date,bw,br,e:best,vol,sets});
  });
  return out;
}
function viewProgress(){
  const tab=state.ui.ptab||'ex';
  const tabs=`<div class="row" style="gap:8px;margin:8px 0 2px">
    ${[['ex','Ejercicio'],['vol','Volumen'],['hist','Historial'],['bw','Peso corporal']].map(([k,l])=>
      `<button class="btn sm ${tab===k?'primary':'ghost'}" data-act="ptab" data-t="${k}">${l}</button>`).join('')}</div>`;
  let body='';
  if(tab==='ex') body=progExercise();
  if(tab==='vol') body=progVolume();
  if(tab==='hist') body=progHistory();
  if(tab==='bw') body=progBW();
  return header('Lo que se mide, mejora','Progreso')+`<div class="wrap">${tabs}${body}<div style="height:28px"></div></div>`;
}
function progExercise(){
  const id=state.ui.progressEx||state.exercises[0].id;
  const h=exerciseHistory(id);
  const opts=exOptions()(id);
  const chart=h.length>1?lineChart(h.map(x=>({x:x.date,y:x.e}))):'<div class="empty small">Registrá al menos dos sesiones con este ejercicio para ver la curva.</div>';
  const rows=h.slice().reverse().map(x=>`<tr><td>${dnice(x.date)}</td><td>${fmt(x.bw)}×${x.br}</td><td class="n">${fmt(Math.round(x.e))}</td><td class="n">${fmt(Math.round(x.vol))}</td></tr>`).join('');
  const first=h[0],last=h[h.length-1];
  const delta=(first&&last&&h.length>1)?((last.e-first.e)/first.e*100):null;
  return `<label class="f"><span class="eyebrow">Ejercicio</span><select data-act="pex">${opts}</select></label>
    <div class="card">
      <div class="between" style="margin-bottom:6px">
        <div><div class="eyebrow">1RM estimado</div><div class="mono" style="font-size:24px;font-weight:800">${last?fmt(Math.round(last.e)):'—'}<span class="dim" style="font-size:13px"> kg</span></div></div>
        ${delta!=null?`<div style="text-align:right"><div class="eyebrow">Desde el inicio</div><div class="mono" style="font-size:24px;font-weight:800;color:${delta>=0?'var(--ok)':'var(--hot)'}">${delta>=0?'+':''}${fmt(Math.round(delta*10)/10)}%</div></div>`:''}
      </div>
      ${chart}
    </div>
    ${h.length?`<table class="t"><tr><th>Fecha</th><th>Mejor serie</th><th class="n">1RM est.</th><th class="n">Volumen</th></tr>${rows}</table>`:''}`;
}
function lineChart(pts){
  const W=320,H=120,pad=10;
  const ys=pts.map(p=>p.y), mn=Math.min(...ys), mx=Math.max(...ys), span=(mx-mn)||1;
  const X=i=>pad+(i/(pts.length-1))*(W-pad*2);
  const Y=v=>H-pad-((v-mn)/span)*(H-pad*2-10);
  const d=pts.map((p,i)=>(i?'L':'M')+X(i).toFixed(1)+' '+Y(p.y).toFixed(1)).join(' ');
  const area=d+` L ${X(pts.length-1).toFixed(1)} ${H-pad} L ${X(0).toFixed(1)} ${H-pad} Z`;
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block">
    <path d="${area}" fill="rgba(255,204,29,.10)"/>
    <path d="${d}" fill="none" stroke="#FFCC1D" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    ${pts.map((p,i)=>`<circle cx="${X(i).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="2.6" fill="#0E1316" stroke="#FFCC1D" stroke-width="1.6"/>`).join('')}
    <text x="${pad}" y="11" fill="#5F6E75" font-size="9" font-family="monospace">${fmt(Math.round(mx))}</text>
    <text x="${pad}" y="${H-1}" fill="#5F6E75" font-size="9" font-family="monospace">${fmt(Math.round(mn))}</text>
  </svg>`;
}
function progVolume(){
  const w=weeklySets(7);
  const rows=GROUPS.map(g=>{
    const n=w[g]||0, [lo,hi]=RANGES[g], max=Math.max(hi*1.35,n);
    const pct=clamp(n/max*100,0,100), lp=lo/max*100, hp=hi/max*100;
    const cls=n<lo?'low':n>hi?'hi':'';
    return `<div style="padding:9px 0;border-bottom:1px solid var(--line)">
      <div class="between" style="margin-bottom:5px">
        <div class="small" style="font-weight:700">${esc(g)}</div>
        <div class="mono tiny ${n<lo?'dim':''}">${n} <span class="dim">/ ${lo}-${hi}</span></div>
      </div>
      <div class="bar"><i class="${cls}" style="width:${pct}%"></i><span class="zone" style="left:${lp}%;width:${hp-lp}%"></span></div>
    </div>`;
  }).join('');
  const hist=weekBars();
  return `<div class="card"><div class="eyebrow">Series efectivas · últimos 7 días</div>
    <div class="tiny dim" style="margin:2px 0 8px">Las líneas marcan el rango óptimo del plan. Solo cuentan las series que marcaste como hechas.</div>
    ${rows}</div>
    <div class="card"><div class="eyebrow">Volumen por semana (kg totales)</div>${hist}</div>`;
}
function weekBars(){
  const weeks=[];
  for(let i=7;i>=0;i--){
    const end=new Date(Date.now()-i*7*864e5), start=new Date(end-7*864e5);
    const a=start.toISOString().slice(0,10), b=end.toISOString().slice(0,10);
    let v=0,n=0;
    state.sessions.filter(s=>s.endedAt&&s.date>a&&s.date<=b).forEach(s=>{const r=sessionVolume(s);v+=r.v;n++;});
    weeks.push({label:dnice(b),v,n});
  }
  const mx=Math.max(1,...weeks.map(w=>w.v));
  if(mx<=1) return '<div class="empty small">Sin sesiones registradas todavía.</div>';
  return `<div class="row" style="align-items:flex-end;gap:5px;height:110px;margin-top:10px">
    ${weeks.map(w=>`<div class="grow" style="text-align:center">
      <div style="height:${Math.round(w.v/mx*84)}px;background:${w.v?'var(--sig)':'var(--p3)'};border-radius:4px 4px 0 0;min-height:3px"></div>
      <div class="tiny dim mono" style="margin-top:4px">${w.label}</div></div>`).join('')}</div>
    <div class="tiny dim" style="margin-top:6px">Cada barra = una semana que termina en esa fecha.</div>`;
}
function progHistory(){
  const ss=doneSessions();
  if(!ss.length) return '<div class="empty">Todavía no terminaste ninguna sesión.</div>';
  return ss.map(s=>{const r=sessionVolume(s);return `<div class="card">
    <div class="between">
      <div class="grow" data-act="sess-view" data-id="${s.id}" style="cursor:pointer">
        <div class="h3">${esc(s.name)}</div>
        <div class="tiny dim">${dlong(s.date)} · ${r.sets} series · ${fmt(Math.round(r.v))} kg${s.dur?' · '+s.dur:''}</div>
      </div>
      <button class="btn sm ghost" data-act="sess-view" data-id="${s.id}">Ver</button>
    </div></div>`;}).join('');
}
function sheetSession(id){
  const s=state.sessions.find(x=>x.id===id); if(!s) return;
  const r=sessionVolume(s);
  openSheet(`<div class="between"><div class="grow"><div class="eyebrow">${dlong(s.date)}</div><div class="h2">${esc(s.name)}</div></div>
    <button class="btn sm ghost" data-act="closesheet">Cerrar</button></div>
    <div class="row" style="gap:8px;margin:10px 0"><span class="chip">${r.sets} series</span><span class="chip">${fmt(Math.round(r.v))} kg</span>${s.dur?`<span class="chip">${esc(s.dur)}</span>`:''}</div>
    ${s.entries.map(en=>`<div class="card" style="padding:11px">
      <div class="h3">${esc(exName(en.exerciseId))}</div>
      <div class="mono small dim" style="margin-top:4px">${en.sets.filter(x=>x.done).map(x=>`${fmt(num(x.w))}×${x.r}${x.rir!==''?' (RIR '+x.rir+')':''}`).join(' · ')||'sin series'}</div>
    </div>`).join('')}
    ${s.notes?`<div class="note">${esc(s.notes)}</div>`:''}
    <button class="btn block ghost" data-act="sess-repeat" data-id="${s.id}" style="margin-top:12px">Repetir esta sesión</button>
    <button class="btn block danger ghost" data-act="sess-del" data-id="${s.id}" style="margin-top:8px">Borrar del historial</button>`);
}
function progBW(){
  const b=state.bw.slice().sort((a,c)=>a.date<c.date?1:-1);
  const avg=(from,to)=>{const sl=b.filter(x=>x.date>from&&x.date<=to);return sl.length?sl.reduce((a,c)=>a+c.kg,0)/sl.length:null;};
  const t=today(), w1=new Date(Date.now()-7*864e5).toISOString().slice(0,10), w2=new Date(Date.now()-14*864e5).toISOString().slice(0,10);
  const a1=avg(w1,t), a2=avg(w2,w1);
  const diff=(a1!=null&&a2!=null)?a1-a2:null;
  const pct=(diff!=null&&a2)?diff/a2*100:null;
  let verdict='Cargá 4-5 pesadas por semana, en ayunas, para tener un promedio confiable.';
  if(pct!=null){
    if(Math.abs(diff)<=0.3) verdict='Peso estable. Si la fuerza sube, estás en recomposición: no toques nada.';
    else if(pct<-0.7) verdict='Estás bajando rápido (más de 0,7%). Sumá 150-200 kcal al día o vas a perder músculo.';
    else if(pct<0) verdict='Bajada suave. Sostenida está bien; si además la fuerza cae, subí un poco las calorías.';
    else if(pct>0.5) verdict='Subida marcada. Revisá aceites, bebidas y picoteos sin registrar; bajá 200-250 kcal.';
    else verdict='Subida leve. Puede ser agua o sal: mirá la tendencia de otra semana antes de tocar calorías.';
  }
  const chart=b.length>1?lineChart(b.slice().reverse().map(x=>({x:x.date,y:x.kg}))):'';
  return `<div class="card">
      <div class="row" style="gap:8px">
        <input type="text" inputmode="decimal" id="bwkg" placeholder="kg de hoy" style="flex:1">
        <button class="btn primary" data-act="bw-add">Anotar</button>
      </div>
      <div class="row" style="gap:16px;margin-top:12px">
        <div><div class="eyebrow">Promedio 7 días</div><div class="mono" style="font-size:24px;font-weight:800">${a1!=null?fmt(Math.round(a1*10)/10):'—'}</div></div>
        <div><div class="eyebrow">vs semana previa</div><div class="mono" style="font-size:24px;font-weight:800;color:${diff==null?'var(--dim)':Math.abs(diff)<=0.3?'var(--ok)':'var(--sig)'}">${diff!=null?(diff>0?'+':'')+fmt(Math.round(diff*10)/10):'—'}</div></div>
      </div>
      ${chart}
      <div class="note" style="margin-top:10px">${esc(verdict)}</div>
    </div>
    ${b.length?`<table class="t"><tr><th>Fecha</th><th class="n">kg</th><th></th></tr>${b.map(x=>`<tr><td>${dnice(x.date)}</td><td class="n">${fmt(x.kg)}</td><td class="n"><button class="btn sm ghost danger" data-act="bw-del" data-d="${x.date}">✕</button></td></tr>`).join('')}</table>`:'<div class="empty small">Sin pesadas cargadas.</div>'}`;
}

/* ---------------- AJUSTES ---------------- */
function viewSettings(){
  const s=state.settings;
  const ACCENTS=[['mostaza','Mostaza'],['verde','Verde'],['fucsia','Fucsia'],['violeta','Violeta'],['celeste','Celeste'],['coral','Coral']];
  return header('Tu copia, tus datos','Ajustes')+`<div class="wrap">
    ${accountCard()}
    <div class="card">
      <div class="eyebrow">Apariencia</div>
      <div class="row" style="gap:8px;margin:10px 0 14px">
        <button class="btn ${s.theme!=='light'?'primary':''}" style="flex:1" data-act="theme" data-v="dark">Oscuro</button>
        <button class="btn ${s.theme==='light'?'primary':''}" style="flex:1" data-act="theme" data-v="light">Claro</button>
      </div>
      <div class="eyebrow" style="margin-bottom:8px">Color</div>
      <div class="row" style="gap:10px;flex-wrap:wrap">
        ${ACCENTS.map(([v,label])=>`<button data-act="accent" data-v="${v}" title="${label}" style="width:38px;height:38px;border-radius:99px;border:2px solid ${s.accent===v?'var(--tx)':'transparent'};background:${ACCENT_HEX[v]};padding:0;flex:0 0 auto"></button>`).join('')}
      </div>
    </div>
    <div class="card">
      <div class="eyebrow">Entrenamiento</div>
      <div class="switch"><div><div class="h3">Arrancar el descanso solo</div><div class="tiny dim">Al marcar una serie como hecha</div></div>
        <div class="tog ${s.autoTimer?'on':''}" data-act="tog" data-k="autoTimer"><i></i></div></div>
      <div class="switch"><div><div class="h3">Sonido al terminar</div><div class="tiny dim">Tres pitidos</div></div>
        <div class="tog ${s.sound?'on':''}" data-act="tog" data-k="sound"><i></i></div></div>
      <div class="switch"><div><div class="h3">Vibración</div><div class="tiny dim">Si el dispositivo la soporta</div></div>
        <div class="tog ${s.vibrate?'on':''}" data-act="tog" data-k="vibrate"><i></i></div></div>
      <div class="switch" style="border-bottom:none"><div><div class="h3">Pantalla siempre encendida</div><div class="tiny dim">Mientras dura la sesión</div></div>
        <div class="tog ${s.wake?'on':''}" data-act="tog" data-k="wake"><i></i></div></div>
      <label class="f"><span class="eyebrow">Descanso por defecto (segundos)</span>
        <input type="text" inputmode="numeric" data-act="set-rest" value="${s.rest}"></label>
    </div>

    <div class="card">
      <div class="eyebrow">Calculadora de discos</div>
      <div class="tiny dim" style="margin:2px 0 8px">Cuántos discos por lado para el peso total que querés.</div>
      <div class="row" style="gap:8px">
        <input type="text" inputmode="decimal" id="plateW" placeholder="peso total" style="flex:1">
        <input type="text" inputmode="decimal" id="plateBar" value="${s.bar}" style="width:88px" title="barra">
        <button class="btn primary" data-act="plate">Calcular</button>
      </div>
      <div id="plateOut" class="mono small" style="margin-top:10px;color:var(--sig)"></div>
    </div>

    <div class="card">
      <div class="eyebrow">Privacidad</div>
      <div class="small dim" style="margin:4px 0 10px">Un PIN para abrir la app en este dispositivo. Se guarda solo acá, no viaja a la nube ni a otros dispositivos.</div>
      ${pinIsSet()
        ? `<div class="grid2"><button class="btn" data-act="pin-change">Cambiar PIN</button><button class="btn ghost danger" data-act="pin-disable">Desactivar</button></div>`
        : `<button class="btn block primary" data-act="pin-enable">Activar PIN</button>`}
    </div>
    <div class="card">
      <div class="eyebrow">Copia de seguridad</div>
      <div class="tiny dim" style="margin:2px 0 10px">Los datos viven solo en este navegador. Exportá de vez en cuando y guardate el archivo.</div>
      <div class="grid2">
        <button class="btn" data-act="export">Exportar .json</button>
        <button class="btn" data-act="import">Importar .json</button>
      </div>
      <input type="file" id="fileIn" accept="application/json,.json" style="display:none">
      <button class="btn block ghost" data-act="export-csv" style="margin-top:8px">Exportar historial .csv</button>
    </div>

    <div class="card">
      <div class="eyebrow">Datos</div>
      <div class="row" style="gap:12px;margin-top:8px">
        <div><div class="mono" style="font-size:22px;font-weight:800">${state.sessions.filter(x=>x.endedAt).length}</div><div class="tiny dim">sesiones</div></div>
        <div><div class="mono" style="font-size:22px;font-weight:800">${state.exercises.length}</div><div class="tiny dim">ejercicios</div></div>
        <div><div class="mono" style="font-size:22px;font-weight:800">${state.routines.length}</div><div class="tiny dim">rutinas</div></div>
      </div>
      <button class="btn block ghost" data-act="tutorial" style="margin-top:14px">Ver el tutorial</button>
      <button class="btn block ghost" data-act="update" style="margin-top:8px">Buscar actualización de la app</button>
      <button class="btn block danger ghost" data-act="reset" style="margin-top:8px">Restaurar el plan original</button>
      <button class="btn block danger ghost" data-act="wipe" style="margin-top:8px">Borrar todo</button>
    </div>

    <div class="card flat" style="margin-bottom:28px">
      <div class="small dim">Bitácora · basada en tu plan Push-Pull-Legs + Torso-Pierna. Guía general de entrenamiento, no consejo médico.
      Doble progresión: cuando llegás al techo de repeticiones en todas las series, subí 2,5 kg arriba / 5 kg abajo y volvé al piso del rango.</div>
    </div>
  </div>`;
}


/* =========================================================
   CUENTA Y SINCRONIZACIÓN (interfaz)
   ========================================================= */
function syncBadge(){
  const S=window.Sync?Sync.state:{status:'unconfigured'};
  const map={ ok:['ok','Al día'], syncing:['sig','Sincronizando…'], offline:['','Sin conexión'],
              error:['','Error'], local:['','Solo este dispositivo'], unconfigured:['','Solo este dispositivo'] };
  const [cls,txt]=map[S.status]||['',''];
  return `<span class="chip ${cls}">${esc(S.msg||txt)}</span>`;
}
function accountCard(){
  const S=window.Sync?Sync.state:{status:'unconfigured'};
  if(S.status==='unconfigured'){
    return `<div class="card">
      <div class="eyebrow">Cuenta</div>
      <div class="small dim" style="margin-top:4px">La sincronización está apagada porque falta cargar las claves de Firebase en <span class="mono">config.js</span>. La app funciona igual: los datos quedan guardados en este dispositivo.</div>
    </div>`;
  }
  if(!S.user){
    return `<div class="card">
      <div class="between"><div class="eyebrow">Cuenta</div>${syncBadge()}</div>
      <div class="small dim" style="margin:4px 0 10px">Iniciá sesión para que tu historial se guarde en la nube y lo tengas en cualquier dispositivo.</div>
      <button class="btn block primary" data-act="auth-open">Entrar o crear cuenta</button>
    </div>`;
  }
  return `<div class="card">
    <div class="between"><div class="eyebrow">Cuenta</div>${syncBadge()}</div>
    <div class="h3" style="margin-top:4px">${esc(S.user.email||'')}</div>
    <div class="tiny dim">${S.last?'Última sincronización: '+new Date(S.last).toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'}):'Todavía no sincronizó'}</div>
    <div class="grid2" style="margin-top:10px">
      <button class="btn" data-act="sync-now">Sincronizar ahora</button>
      <button class="btn ghost" data-act="auth-out">Cerrar sesión</button>
    </div>
  </div>`;
}
function sheetAuth(mode){
  const reg=mode==='reg';
  openSheet(`<div class="between"><div class="h2">${reg?'Crear cuenta':'Entrar'}</div><button class="btn sm ghost" data-act="closesheet">Cerrar</button></div>
    <label class="f"><span class="eyebrow">Email</span><input type="text" id="auEmail" inputmode="email" autocapitalize="none" autocomplete="email" placeholder="vos@email.com"></label>
    <label class="f"><span class="eyebrow">Contraseña</span><input type="password" id="auPass" autocomplete="${reg?'new-password':'current-password'}" placeholder="mínimo 6 caracteres"></label>
    <div id="auErr" class="warn" style="display:none;margin-top:10px"></div>
    <button class="btn block primary" data-act="${reg?'auth-signup':'auth-signin'}" style="margin-top:14px">${reg?'Crear cuenta':'Entrar'}</button>
    <button class="btn block ghost" data-act="auth-toggle" data-m="${reg?'in':'reg'}" style="margin-top:8px">${reg?'Ya tengo cuenta':'Crear una cuenta nueva'}</button>
    ${reg?'':'<button class="btn block ghost" data-act="auth-reset" style="margin-top:8px">Olvidé la contraseña</button>'}
    <div class="row" style="align-items:center;gap:10px;margin:16px 0"><hr class="sep" style="flex:1;margin:0"><span class="tiny dim">o</span><hr class="sep" style="flex:1;margin:0"></div>
    <button class="btn block" data-act="auth-google">
      <svg width="17" height="17" viewBox="0 0 18 18" style="margin-right:2px"><path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.56 2.7-3.87 2.7-6.62z"/><path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.96v2.33A9 9 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.03l2.99-2.33z"/><path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.97l2.99 2.33C4.66 5.17 6.65 3.58 9 3.58z"/></svg>
      Continuar con Google
    </button>
    <div class="tiny dim" style="margin:14px 0 4px">Al entrar, lo que ya tengas en la nube se descarga y se junta con lo de este dispositivo. Nada se pisa sin avisar.</div>`);
}
function authErr(e){
  const c=(e&&e.code)||'';
  const map={'auth/invalid-email':'Ese email no es válido.','auth/missing-password':'Falta la contraseña.',
    'auth/weak-password':'La contraseña necesita al menos 6 caracteres.','auth/email-already-in-use':'Ya existe una cuenta con ese email. Entrá en vez de crearla.',
    'auth/invalid-credential':'Email o contraseña incorrectos.','auth/wrong-password':'Contraseña incorrecta.',
    'auth/user-not-found':'No hay cuenta con ese email.','auth/network-request-failed':'Sin conexión. Probá de nuevo con internet.',
    'auth/too-many-requests':'Demasiados intentos. Esperá un rato.','auth/operation-not-allowed':'Falta habilitar Email/Contraseña en la consola de Firebase.',
    'auth/popup-closed-by-user':'Cerraste la ventana antes de terminar. Probá de nuevo.',
    'auth/popup-blocked':'El navegador bloqueó la ventana emergente. Permitila e intentá de nuevo.',
    'auth/cancelled-popup-request':'Ventana cancelada, probá de nuevo.',
    'auth/unauthorized-domain':'Este dominio no está autorizado en Firebase todavía.'};
  const el=$('#auErr'); if(el){ el.style.display='block'; el.textContent=map[c]||('No se pudo: '+(c||(e&&e.message)||'error desconocido')); }
}

/* =========================================================
   ACCIONES
   ========================================================= */
function startSession(routineId){
  const r=routineById(routineId); if(!r) return;
  state.active={ id:uid(), routineId:r.id, name:r.name, date:today(), startedAt:Date.now(), notes:'',
    entries:r.items.map(it=>({ id:uid(), exerciseId:it.exerciseId,
      target:{sets:it.sets,repsMin:it.repsMin,repsMax:it.repsMax,rir:it.rir,rest:it.rest,ss:it.ss},
      sets:Array.from({length:it.sets},()=>({w:'',r:'',rir:'',done:false})) })) };
  save(true); view='train'; keepAwake(true); render();
}
function finishSession(){
  const s=state.active; if(!s) return;
  const r=sessionVolume(s);
  s.entries=s.entries.filter(e=>e.sets.some(x=>x.done));
  if(!s.entries.length){ if(!confirm('No marcaste ninguna serie. ¿Descartar la sesión?')) return; state.active=null; save(true); render(); return; }
  s.endedAt=Date.now(); s.dur=elapsed(s);
  const prs=[];
  s.entries.forEach(en=>{
    const best=bestE1RM(en.exerciseId,s.id);
    let cur=0; en.sets.forEach(x=>{ if(x.done) cur=Math.max(cur,e1rm(num(x.w)||0,num(x.r)||0)); });
    if(best>0 && cur>best*1.001) prs.push(exName(en.exerciseId));
  });
  state.sessions.push(s); state.active=null; save(true); stopTimer(); keepAwake(false); render();
  if(window.Sync) Sync.schedule(800);
  openSheet(`<div class="h2">Sesión guardada</div>
    <div class="row" style="gap:8px;margin:12px 0"><span class="chip">${r.sets} series</span><span class="chip">${fmt(Math.round(r.v))} kg movidos</span><span class="chip">${esc(s.dur)}</span></div>
    ${prs.length?`<div class="eyebrow" style="margin-top:10px">Récords personales</div>${prs.map(p=>`<div class="cue"><b>★</b><span>${esc(p)}</span></div>`).join('')}`:
      `<div class="note">Sin récords hoy. La próxima vez, apuntá a una repetición más en al menos un ejercicio: eso es doble progresión.</div>`}
    <button class="btn block primary" data-act="closesheet" style="margin-top:14px">Listo</button>`);
}
function entryOf(id){ return state.active && state.active.entries.find(e=>e.id===id); }

function readSetRow(row){
  const en=entryOf(row.dataset.e), i=+row.dataset.i; if(!en) return null;
  const st=en.sets[i];
  $$('input',row).forEach(inp=>{
    let v=inp.value.trim();
    if(v==='' && inp.placeholder && /^[\d.,]+$/.test(inp.placeholder)) v=inp.placeholder;
    st[inp.dataset.f]=v;
  });
  return {en,st,i};
}
function toggleSet(row){
  const r=readSetRow(row); if(!r) return;
  const {en,st}=r;
  st.done=!st.done;
  if(st.done){
    $$('input',row).forEach(inp=>{ if(inp.value==='' && st[inp.dataset.f]) inp.value=st[inp.dataset.f]; });
    const pbest=bestE1RM(en.exerciseId,state.active.id);
    const isPR=pbest>0 && e1rm(num(st.w)||0,num(st.r)||0)>pbest*1.001;
    row.classList.toggle('pr',isPR);
    $('.check',row).textContent=isPR?'★':'✓';
    if(isPR) toast('★ Récord en '+exName(en.exerciseId));
    if(state.settings.autoTimer){
      const rest=(en.target&&en.target.rest)||state.settings.rest;
      startTimer(rest, exName(en.exerciseId));
    }
  }else{ row.classList.remove('pr'); $('.check',row).textContent='✓'; }
  row.classList.toggle('done',st.done);
  save();
  updateStats();
}
function updateStats(){
  const s=state.active; if(!s) return;
  const r=sessionVolume(s); const total=s.entries.reduce((a,e)=>a+e.sets.length,0);
  const bar=$('#app .card .between'); if(!bar) return;
  const spans=$$('#app .card .between .mono');
  if(spans[0]) spans[0].textContent=r.sets+'/'+total;
  if(spans[1]) spans[1].textContent=fmt(Math.round(r.v))+' kg';
  if(spans[2]) spans[2].textContent=elapsed(s);
}

function exportJSON(){
  const blob=new Blob([JSON.stringify(state,null,1)],{type:'application/json'});
  dl(blob,'bitacora-'+today()+'.json'); toast('Archivo descargado');
}
function exportCSV(){
  const lines=['fecha;sesion;ejercicio;grupo;serie;kg;reps;rir'];
  doneSessions().slice().reverse().forEach(s=>s.entries.forEach(en=>{
    const ex=exById(en.exerciseId);
    en.sets.forEach((x,i)=>{ if(x.done) lines.push([s.date,s.name,ex?ex.name:'?',ex?ex.group:'',i+1,x.w,x.r,x.rir].join(';')); });
  }));
  dl(new Blob([lines.join('\n')],{type:'text/csv'}),'bitacora-'+today()+'.csv'); toast('CSV descargado');
}
function dl(blob,name){
  const a=document.createElement('a'), u=URL.createObjectURL(blob);
  a.href=u; a.download=name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(u),3000);
}

/* =========================================================
   EVENTOS
   ========================================================= */
document.addEventListener('click',ev=>{
  const row=ev.target.closest('.setrow');
  const el=ev.target.closest('[data-act]'); if(!el) return;
  const a=el.dataset.act;

  if(a==='check' && row){ toggleSet(row); return; }
  if(a==='nav'){ view=el.dataset.v; closeSheet(); render(); return; }
  if(a==='closesheet'){ closeSheet(); return; }

  /* timer */
  if(a==='t-add'){ T.end+=15000; T.total+=15; T.beeped=false; tick(); return; }
  if(a==='t-sub'){ T.end-=15000; tick(); return; }
  if(a==='t-skip'){ stopTimer(); return; }

  /* entrenar */
  if(a==='start'){ if(state.active && !confirm('Tenés una sesión sin terminar. ¿La descartás y empezás otra?')) return; startSession(el.dataset.id); return; }
  if(a==='quick'){
    const name=prompt('Nombre de la sesión libre:','Sesión libre'); if(!name) return;
    state.active={id:uid(),routineId:null,name,date:today(),startedAt:Date.now(),notes:'',entries:[]};
    save(true); render(); return;
  }
  if(a==='finish'){ finishSession(); return; }
  if(a==='discard'){ if(confirm('¿Descartar esta sesión sin guardar?')){ state.active=null; stopTimer(); save(true); render(); } return; }
  if(a==='addset'){ const en=entryOf(el.dataset.e); const l=en.sets[en.sets.length-1]||{w:'',r:'',rir:''};
    en.sets.push({w:l.w,r:'',rir:'',done:false}); save(true); render(); return; }
  if(a==='delset'){ const en=entryOf(el.dataset.e); if(en.sets.length>1){en.sets.pop(); save(true); render();} return; }
  if(a==='rest'){ const en=entryOf(el.dataset.e); startTimer((en.target&&en.target.rest)||state.settings.rest, exName(en.exerciseId)); return; }
  if(a==='guide'){ sheetGuide(el.dataset.id); return; }
  if(a==='add-ex'){
    openSheet(`<div class="h2">Agregar ejercicio</div>
      <label class="f"><span class="eyebrow">Ejercicio</span><select id="addExSel">${exOptions()('')}</select></label>
      <div class="grid3"><label class="f"><span class="eyebrow">Series</span><input id="addExSets" type="text" inputmode="numeric" value="3"></label>
      <label class="f"><span class="eyebrow">Reps</span><input id="addExReps" type="text" value="8-12"></label>
      <label class="f"><span class="eyebrow">Descanso s</span><input id="addExRest" type="text" inputmode="numeric" value="90"></label></div>
      <button class="btn block primary" data-act="add-ex-ok" style="margin-top:14px">Agregar</button>`);
    return;
  }
  if(a==='add-ex-ok'){
    const id=$('#addExSel').value, n=parseInt($('#addExSets').value)||3;
    const rr=($('#addExReps').value||'8-12').split('-');
    state.active.entries.push({id:uid(),exerciseId:id,target:{sets:n,repsMin:rr[0]||8,repsMax:rr[1]||rr[0]||12,rir:'1-2',rest:parseInt($('#addExRest').value)||90,ss:''},
      sets:Array.from({length:n},()=>({w:'',r:'',rir:'',done:false}))});
    save(true); closeSheet(); render(); return;
  }
  if(a==='entry-menu'){
    const id=el.dataset.e, en=entryOf(id);
    openSheet(`<div class="h2">${esc(exName(en.exerciseId))}</div>
      <label class="f"><span class="eyebrow">Nota para esta sesión</span><textarea id="enNote" placeholder="Ej: molestia en el hombro, bajé el peso">${esc(en.note||'')}</textarea></label>
      <button class="btn block primary" data-act="entry-note" data-e="${id}" style="margin-top:10px">Guardar nota</button>
      <button class="btn block ghost" data-act="guide" data-id="${en.exerciseId}" style="margin-top:8px">Ver ejecución</button>
      <button class="btn block danger ghost" data-act="entry-del" data-e="${id}" style="margin-top:8px">Quitar de la sesión</button>`);
    return;
  }
  if(a==='entry-note'){ const en=entryOf(el.dataset.e); en.note=$('#enNote').value.trim(); save(true); closeSheet(); render(); return; }
  if(a==='entry-del'){ state.active.entries=state.active.entries.filter(e=>e.id!==el.dataset.e); save(true); closeSheet(); render(); return; }

  /* rutinas */
  if(a==='r-new'){ sheetRoutine(null); return; }
  if(a==='r-edit'){ sheetRoutine(el.dataset.id); return; }
  if(a==='r-dup'){ const r=routineById(el.dataset.id);
    state.routines.push({id:uid(),name:r.name+' (copia)',subtitle:r.subtitle,items:r.items.map(i=>Object.assign({},i,{id:uid()}))});
    save(true); render(); toast('Rutina duplicada'); return; }
  if(a==='r-del'){ if(!confirm('¿Borrar esta rutina? El historial no se toca.')) return;
    state.routines=state.routines.filter(x=>x.id!==el.dataset.id); save(true); render(); return; }
  if(a==='ri-add'){ const f=$('#rform'); const items=collectItems(); items.push({id:uid(),exerciseId:state.exercises[0].id,sets:3,repsMin:8,repsMax:12,rir:'1-2',rest:90,ss:''});
    stashRoutine(items); return; }
  if(a==='ri-add-db'){
    const f=$('#rform'); let rid=f.dataset.id;
    if(!rid){
      const items=collectItems();
      const name=$('[data-k=name]',f).value.trim()||'Sesión sin nombre';
      const subtitle=$('[data-k=subtitle]',f).value.trim();
      rid=uid();
      state.routines.push({id:rid,name,subtitle,items});
      save(true);
    }
    sheetExDbSearch('routine', rid);
    return;
  }
  if(a==='x-search-db-lib'){ sheetExDbSearch('library'); return; }
  if(a==='ri-replace'){
    const f=$('#rform'); let rid=f.dataset.id;
    const items=collectItems();
    const itemId=items[+el.dataset.i]&&items[+el.dataset.i].id;
    if(!itemId) return;
    const name=$('[data-k=name]',f).value.trim()||'Sesión sin nombre';
    const subtitle=$('[data-k=subtitle]',f).value.trim();
    if(rid){ const r=routineById(rid); r.name=name; r.subtitle=subtitle; r.items=items; }
    else{ rid=uid(); state.routines.push({id:rid,name,subtitle,items}); }
    save(true);
    sheetExDbSearch('replace-item', {routineId:rid, itemId});
    return;
  }
  if(a==='ri-del'){ const items=collectItems(); items.splice(+el.dataset.i,1); stashRoutine(items); return; }
  if(a==='ri-up'){ const i=+el.dataset.i; const items=collectItems(); if(i>0){[items[i-1],items[i]]=[items[i],items[i-1]];} stashRoutine(items); return; }
  if(a==='ri-down'){ const i=+el.dataset.i; const items=collectItems(); if(i<items.length-1){[items[i+1],items[i]]=[items[i],items[i+1]];} stashRoutine(items); return; }
  if(a==='r-save'){
    const f=$('#rform'), id=f.dataset.id;
    const name=$('[data-k=name]',f).value.trim()||'Sesión sin nombre';
    const subtitle=$('[data-k=subtitle]',f).value.trim();
    const items=collectItems();
    if(id){ const r=routineById(id); r.name=name; r.subtitle=subtitle; r.items=items; }
    else state.routines.push({id:uid(),name,subtitle,items});
    save(true); closeSheet(); render(); toast('Rutina guardada'); return;
  }

  /* ejercicios */
  if(a==='x-new'){ sheetExercise(null); return; }
  if(a==='x-search-db'){ sheetExDbSearch(); return; }
  if(a==='x-replace-db'){ sheetExDbSearch('replace-ex', el.dataset.id); return; }
  if(a==='exdb-pick'){ pickExdb(el.dataset.id); return; }
  if(a==='x-edit'){ sheetExercise(el.dataset.id); return; }
  if(a==='x-save'){
    const f=$('#xform'), id=f.dataset.id;
    let images=[]; try{ images=JSON.parse(f.dataset.images||'[]'); }catch(e){}
    const o={ name:$('[data-k=name]',f).value.trim(), group:$('[data-k=group]',f).value,
      cues:$('[data-k=cues]',f).value.split('\n').map(x=>x.trim()).filter(Boolean),
      err:$('[data-k=err]',f).value.trim(), tip:$('[data-k=tip]',f).value.trim(), images };
    if(!o.name){ toast('Ponele un nombre'); return; }
    if(id) Object.assign(exById(id),o); else state.exercises.push(Object.assign({id:uid(),custom:true},o));
    save(true); closeSheet(); render(); toast('Ejercicio guardado'); return;
  }
  if(a==='x-del'){
    const id=el.dataset.id;
    const used=state.routines.filter(r=>r.items.some(i=>i.exerciseId===id)).map(r=>r.name);
    if(used.length && !confirm('Está en: '+used.join(', ')+'. ¿Borrar igual?')) return;
    if(!used.length && !confirm('¿Borrar este ejercicio?')) return;
    state.exercises=state.exercises.filter(x=>x.id!==id);
    state.routines.forEach(r=>r.items=r.items.filter(i=>i.exerciseId!==id));
    save(true); closeSheet(); render(); return;
  }

  /* progreso */
  if(a==='ptab'){ state.ui.ptab=el.dataset.t; save(); render(); return; }
  if(a==='sess-view'){ sheetSession(el.dataset.id); return; }
  if(a==='sess-del'){ if(!confirm('¿Borrar esta sesión del historial?')) return;
    state.sessions=state.sessions.filter(x=>x.id!==el.dataset.id); save(true); closeSheet(); render(); return; }
  if(a==='sess-repeat'){
    const s=state.sessions.find(x=>x.id===el.dataset.id);
    state.active={id:uid(),routineId:s.routineId,name:s.name,date:today(),startedAt:Date.now(),notes:'',
      entries:s.entries.map(en=>({id:uid(),exerciseId:en.exerciseId,target:en.target,
        sets:en.sets.map(x=>({w:'',r:'',rir:'',done:false}))}))};
    save(true); closeSheet(); view='train'; render(); return;
  }
  if(a==='bw-add'){
    const kg=num($('#bwkg').value); if(kg==null){ toast('Poné un número'); return; }
    state.bw=state.bw.filter(x=>x.date!==today()); state.bw.push({date:today(),kg});
    save(true); render(); toast('Pesada anotada'); return;
  }
  if(a==='bw-del'){ state.bw=state.bw.filter(x=>x.date!==el.dataset.d); save(true); render(); return; }

  /* ajustes */
  if(a==='theme'){ state.settings.theme=el.dataset.v; save(true); applyTheme(); render(); return; }
  if(a==='accent'){ state.settings.accent=el.dataset.v; save(true); applyTheme(); render(); return; }
  if(a==='tog'){ const k=el.dataset.k; state.settings[k]=!state.settings[k]; save(true); render(); return; }
  if(a==='plate'){
    const total=num($('#plateW').value), bar=num($('#plateBar').value)||20;
    if(total==null){ $('#plateOut').textContent='Poné el peso total.'; return; }
    state.settings.bar=bar; save();
    let per=(total-bar)/2;
    if(per<0){ $('#plateOut').textContent='Menos que la barra sola.'; return; }
    const plates=[25,20,15,10,5,2.5,1.25,0.5], out=[];
    plates.forEach(p=>{ const n=Math.floor((per+1e-9)/p); if(n>0){ out.push(n+'×'+fmt(p)); per=Math.round((per-n*p)*100)/100; } });
    $('#plateOut').textContent=(out.length?'Por lado: '+out.join(' + '):'Solo la barra')+(per>0.01?'  (faltan '+fmt(per)+' kg)':'');
    return;
  }
  if(a==='auth-open'){ sheetAuth('in'); return; }
  if(a==='auth-toggle'){ sheetAuth(el.dataset.m); return; }
  if(a==='auth-signin'||a==='auth-signup'){
    const em=$('#auEmail').value.trim(), pw=$('#auPass').value;
    if(!em||!pw){ authErr({code:'auth/missing-password'}); return; }
    el.textContent='Un momento…';
    (a==='auth-signup'?Sync.signUp(em,pw):Sync.signIn(em,pw))
      .then(()=>{ closeSheet(); toast('Sesión iniciada'); render(); })
      .catch(e=>{ authErr(e); el.textContent=a==='auth-signup'?'Crear cuenta':'Entrar'; });
    return;
  }
  if(a==='auth-google'){
    el.disabled=true;
    Sync.signInGoogle()
      .then(()=>{ closeSheet(); toast('Sesión iniciada'); render(); })
      .catch(e=>{ authErr(e); el.disabled=false; });
    return;
  }
  if(a==='auth-reset'){
    const em=$('#auEmail').value.trim(); if(!em){ authErr({code:'auth/invalid-email'}); return; }
    Sync.reset(em).then(()=>toast('Te mandamos un mail para recuperarla')).catch(authErr); return;
  }
  if(a==='auth-out'){ if(!confirm('Se cierra la sesión. Los datos quedan en la nube y también en este dispositivo.')) return;
    Sync.signOut().then(()=>{ toast('Sesión cerrada'); render(); }); return; }
  if(a==='sync-now'){ Sync.run('manual'); toast('Sincronizando…'); return; }
  if(a==='update'){
    if('serviceWorker' in navigator){
      navigator.serviceWorker.getRegistrations().then(rs=>Promise.all(rs.map(r=>r.update())))
        .then(()=>caches.keys()).then(ks=>Promise.all(ks.map(k=>caches.delete(k))))
        .then(()=>{ toast('Actualizando…'); setTimeout(()=>location.reload(true),600); });
    } else location.reload();
    return;
  }
  if(a==='pin-enable'){ showLock('setup1'); return; }
  if(a==='pin-change'){ showLock('setup1'); return; }
  if(a==='pin-disable'){ showLock('disable'); return; }
  if(a==='export'){ exportJSON(); return; }
  if(a==='export-csv'){ exportCSV(); return; }
  if(a==='import'){ $('#fileIn').click(); return; }
  if(a==='reset'){ if(!confirm('Vuelve a las rutinas y ejercicios originales del plan. El historial y las pesadas se conservan.')) return;
    const seed=seedState(); state.exercises=seed.exercises; state.routines=seed.routines; save(true); render(); toast('Plan restaurado'); return; }
  if(a==='wipe'){ if(!confirm('Borra TODO: historial, rutinas, pesadas. ¿Seguro?')) return;
    state=seedState(); save(true); render(); toast('Todo borrado'); return; }

  /* visor de fotos */
  if(a==='photo'){
    const group=el.closest('[data-photos]'); if(!group) return;
    let imgs=[]; try{ imgs=JSON.parse(group.dataset.photos||'[]'); }catch(e){}
    openLightbox(imgs, +el.dataset.idx||0); return;
  }
  if(a==='lightbox-close'){ closeLightbox(); return; }
  if(a==='lightbox-prev'){ lbIdx=(lbIdx-1+lbImgs.length)%lbImgs.length; renderLightbox(); return; }
  if(a==='lightbox-next'){ lbIdx=(lbIdx+1)%lbImgs.length; renderLightbox(); return; }

  /* tutorial guiado */
  if(a==='tutorial'){ startTour(); return; }
  if(a==='tour-skip'){ endTour(); return; }
  if(a==='tour-prev'){ tourGoTo(tourIdx-1,-1); return; }
  if(a==='tour-next'){
    if(tourIdx>=TOUR_STEPS.length-1){ endTour(); view='train'; render(); return; }
    tourGoTo(tourIdx+1,1); return;
  }
});

function collectItems(){
  return $$('#ritems [data-ri]').map(d=>({
    id:uid(),
    exerciseId:$('[data-k=exerciseId]',d).value,
    sets:clamp(parseInt($('[data-k=sets]',d).value)||3,1,12),
    repsMin:parseInt($('[data-k=repsMin]',d).value)||6,
    repsMax:parseInt($('[data-k=repsMax]',d).value)||12,
    rir:$('[data-k=rir]',d).value.trim()||'1-2',
    rest:parseInt($('[data-k=rest]',d).value)||90,
    ss:$('[data-k=ss]',d).value.trim().toUpperCase().slice(0,1)
  }));
}
function stashRoutine(items){
  const f=$('#rform'), id=f.dataset.id;
  const name=$('[data-k=name]',f).value, subtitle=$('[data-k=subtitle]',f).value;
  const tmp={id,name,subtitle,items};
  if(id){ const r=routineById(id); r.name=name; r.subtitle=subtitle; r.items=items; save(true); sheetRoutine(id); }
  else{ const nid=uid(); state.routines.push({id:nid,name,subtitle,items}); save(true); sheetRoutine(nid); }
}

document.addEventListener('change',ev=>{
  const el=ev.target, a=el.dataset.act;
  if(a==='pex'){ state.ui.progressEx=el.value; save(); render(); return; }
  if(a==='exq'){ return; }
  if(a==='set-rest'){ state.settings.rest=parseInt(el.value)||90; save(); return; }
  if(a==='s-note'){ if(state.active){ state.active.notes=el.value; save(); } return; }
  const row=el.closest('.setrow'); if(row && el.tagName==='INPUT'){ readSetRow(row); save(); updateStats(); }
  if(el.id==='fileIn' && el.files && el.files[0]){
    const fr=new FileReader();
    fr.onload=()=>{ try{ const o=JSON.parse(fr.result);
      if(!o.exercises||!o.routines) throw 0;
      if(!confirm('Reemplaza los datos actuales por los del archivo. ¿Seguir?')) return;
      state=o; state.settings=Object.assign({rest:90,sound:true,vibrate:true,bar:20,autoTimer:true,wake:true,theme:'dark',accent:'mostaza'},state.settings||{});
      state.ui=state.ui||{}; save(true); render(); toast('Datos importados');
    }catch(e){ toast('El archivo no es una copia válida'); } };
    fr.readAsText(el.files[0]); el.value='';
  }
});
document.addEventListener('input',ev=>{
  const el=ev.target;
  if(el.dataset.act==='exq'){ state.ui.exq=el.value; const pos=el.selectionStart; render();
    const n=$('[data-act=exq]'); if(n){ n.focus(); n.setSelectionRange(pos,pos); } }
});

/* reloj de la sesión */
setInterval(()=>{ if(state.active && view==='train') updateStats(); },30000);
window.addEventListener('beforeunload',()=>save(true));

/* ---------- puente con sync.js ---------- */
window.App={
  getState:()=>state,
  adoptState:function(next){
    const act=state.active;
    state=next; state.active=act;
    save(true);
    if(!$('#sheet').classList.contains('on')) render();
  },
  render, toast
};

/* =========================================================
   TUTORIAL GUIADO
   ========================================================= */
const TOUR_SEEN_KEY='bitacora_tutorial_seen';
const TOUR_STEPS=[
  { view:null, selector:null,
    title:'Bienvenido a Bitácora',
    text:'Registrá tus entrenamientos, seguí tu progreso y no perdés nada aunque cambies de teléfono. Este recorrido dura menos de un minuto y podés repetirlo cuando quieras desde Ajustes.' },
  { view:null, selector:'nav',
    title:'Las 5 pestañas',
    text:'Entrenar arranca tu sesión de hoy. Rutinas son tus plantillas. Ejercicios es tu biblioteca con fotos. Progreso muestra tus gráficos. Ajustes tiene cuenta, PIN, tema y backup.' },
  { view:'train', selector:'.card[data-act="start"]',
    title:'Elegí tu sesión',
    text:'Tocá una rutina para arrancar. Bitácora carga automáticamente los ejercicios, series y objetivos que definiste para ese día.' },
  { view:'train', selector:'.setrow',
    title:'Anotá cada serie',
    text:'Cargá peso, reps y RIR, y tocá ✓ para marcarla como hecha. Lo que ves en gris es lo que hiciste la vez pasada, para que sepas contra qué superarte.' },
  { view:'train', selector:'#timer',
    title:'Descanso automático',
    text:'Al marcar una serie, el cronómetro de descanso arranca solo acá abajo. Podés sumar o restar 15 segundos, o saltarlo con Listo.' },
  { view:'train', selector:'.exnum.ss',
    title:'Superseries',
    text:'Si ves una letra en vez de un número, esos ejercicios van encadenados sin descanso entre uno y otro: es una superserie.' },
  { view:'routines', selector:'.card',
    title:'Tus rutinas',
    text:'Editá los ejercicios, series y objetivos de cada rutina, o duplicala para armar una variante sin tocar la original.' },
  { view:'routines',
    before:()=>{ const r=state.routines[0]; sheetRoutine(r?r.id:null); },
    selector:()=>{ const b=document.querySelector('[data-act="ri-add"]'); return b?b.parentElement:null; },
    title:'Sumar ejercicios',
    text:'Desde una rutina agregás ejercicios de tu biblioteca, o buscás entre los 873 de la base pública con fotos incluidas.' },
  { view:'exercises', selector:'.li [data-act="guide"]',
    title:'Guía de ejecución',
    text:'Tocá cualquier ejercicio para ver fotos, los pasos de ejecución y tu historial con ese movimiento.' },
  { view:'exercises', selector:'[data-act="x-search-db-lib"]',
    title:'873 ejercicios más',
    text:'Si no encontrás el ejercicio que buscás en tu biblioteca, explorá la base pública: trae fotos de la posición inicial y final.' },
  { view:'progress',
    selector:()=>{ const b=document.querySelector('[data-act="ptab"]'); return b?b.parentElement:null; },
    title:'Cuatro formas de ver tu progreso',
    text:'Ejercicio muestra tu 1RM estimado, Volumen tus series por grupo muscular, Historial tus sesiones pasadas y Peso corporal tu evolución de peso.' },
  { view:'settings', selector:null,
    title:'Tu cuenta, tus reglas',
    text:'Desde Ajustes sincronizás tus datos, activás un PIN para bloquear la app, elegís tema y color, y hacés una copia de seguridad de todo.' },
  { view:null, selector:null, cta:'Empezar a entrenar',
    title:'Listo para arrancar',
    text:'Eso es todo. Podés repetir este recorrido cuando quieras desde Ajustes → Ver el tutorial.' },
];
let tourActive=false, tourIdx=0;
function maybeStartTour(){
  if(tourActive) return;
  let seen=false; try{ seen=!!localStorage.getItem(TOUR_SEEN_KEY); }catch(e){}
  if(seen) return;
  startTour();
}
function startTour(){
  if($('#lock').classList.contains('on')) return;
  tourActive=true;
  $('#tour').classList.add('on');
  window.addEventListener('resize', onTourResize);
  window.addEventListener('orientationchange', onTourResize);
  tourGoTo(0,1);
}
function endTour(){
  tourActive=false;
  $('#tour').classList.remove('on');
  window.removeEventListener('resize', onTourResize);
  window.removeEventListener('orientationchange', onTourResize);
  try{ localStorage.setItem(TOUR_SEEN_KEY,'1'); }catch(e){}
}
function tourResolveTarget(step){
  try{ return typeof step.selector==='function' ? step.selector() : document.querySelector(step.selector); }
  catch(e){ return null; }
}
function tourVisible(el){
  if(!el || !el.isConnected) return false;
  const r=el.getBoundingClientRect();
  return r.width>0 && r.height>0;
}
function tourGoTo(idx, dir){
  if(idx<0) return;
  if(idx>=TOUR_STEPS.length){ endTour(); return; }
  const step=TOUR_STEPS[idx];
  if(step.view && step.view!==view){
    const btn=document.querySelector('.nb[data-v="'+step.view+'"]');
    if(btn) btn.click(); else closeSheet();
  } else closeSheet();
  if(step.before) step.before();
  const target = step.selector ? tourResolveTarget(step) : null;
  if(step.selector && !tourVisible(target)){ tourGoTo(idx+dir, dir); return; }
  if(target) target.scrollIntoView({block:'center', inline:'center'});
  tourIdx=idx;
  showTourCard(step, target);
}
function showTourCard(step, target){
  $('#tourProgress').textContent=(tourIdx+1)+' / '+TOUR_STEPS.length;
  $('#tourTitle').textContent=step.title;
  $('#tourText').textContent=step.text;
  const isLast=tourIdx===TOUR_STEPS.length-1;
  const nextBtn=$('[data-act="tour-next"]');
  nextBtn.textContent = isLast ? (step.cta||'Entendido') : 'Siguiente';
  $('[data-act="tour-prev"]').disabled = tourIdx===0;
  tourLayout(target?target.getBoundingClientRect():null);
  nextBtn.focus();
}
function onTourResize(){
  if(!tourActive) return;
  const step=TOUR_STEPS[tourIdx];
  const target = step.selector ? tourResolveTarget(step) : null;
  tourLayout(target?target.getBoundingClientRect():null);
}
function tourLayout(rect){
  const vw=innerWidth, vh=innerHeight, pad=8, margin=12;
  const top=$('#tour .tourmask.top'), bottom=$('#tour .tourmask.bottom'), left=$('#tour .tourmask.left'), right=$('#tour .tourmask.right');
  const ring=$('#tourring'), card=$('#tourcard');
  let box=null;
  if(rect && rect.width>0 && rect.height>0 && rect.bottom>0 && rect.right>0 && rect.top<vh && rect.left<vw){
    const x=Math.max(rect.left-pad,0), y=Math.max(rect.top-pad,0);
    const w=Math.min(rect.width+pad*2, vw-x), h=Math.min(rect.height+pad*2, vh-y);
    box={x,y,w,h};
  }
  if(!box){
    top.style.cssText='left:0;top:0;width:100%;height:100%';
    [bottom,left,right].forEach(m=>m.style.cssText='width:0;height:0');
    ring.style.display='none';
    card.classList.add('floating');
    card.style.top=''; card.style.left='';
    return;
  }
  card.classList.remove('floating');
  const cr=card.getBoundingClientRect();
  top.style.cssText=`left:0;top:0;width:100%;height:${box.y}px`;
  bottom.style.cssText=`left:0;top:${box.y+box.h}px;width:100%;height:${Math.max(vh-box.y-box.h,0)}px`;
  left.style.cssText=`left:0;top:${box.y}px;width:${box.x}px;height:${box.h}px`;
  right.style.cssText=`left:${box.x+box.w}px;top:${box.y}px;width:${Math.max(vw-box.x-box.w,0)}px;height:${box.h}px`;
  ring.style.cssText=`display:block;left:${box.x}px;top:${box.y}px;width:${box.w}px;height:${box.h}px`;
  const spaceBelow=vh-(box.y+box.h), spaceAbove=box.y;
  let cardTop = (spaceBelow>=cr.height+margin || spaceBelow>=spaceAbove) ? box.y+box.h+margin : box.y-cr.height-margin;
  cardTop=Math.max(margin, Math.min(cardTop, vh-cr.height-margin));
  let cardLeft = box.x+box.w/2-cr.width/2;
  cardLeft=Math.max(margin, Math.min(cardLeft, vw-cr.width-margin));
  card.style.top=cardTop+'px';
  card.style.left=cardLeft+'px';
}

/* ---------- arranque ---------- */
applyTheme();
restoreTimer();
if(state.active) keepAwake(true);
render();
if(pinIsSet()) showLock('unlock'); else maybeStartTour();
if(window.Sync){
  Sync.on(()=>{ if(view==='settings') render(); });
  Sync.init();
}
if('serviceWorker' in navigator){
  window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
}