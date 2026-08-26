/* =========================================================
   BITÁCORA — registro de entrenamiento offline
   Sin internet. Datos en este dispositivo.

   Fase 3 en curso: este archivo ya no es dueño del estado, de
   las semillas, ni de los helpers. Le quedan las vistas, los
   features y el despachador de eventos, que salen en los PRs
   siguientes.
   ========================================================= */
import "./app.css";
import "./sync";
import { registerServiceWorker, checkForUpdate } from "./pwa";
import { GROUPS, clamp, num, e1rm } from "./lib/calc";
import {
  newTimer,
  restoreTimer as restoredTimerState,
  timerFrame,
  type TimerState,
} from "./lib/timer";
import { $, $$, dl, esc, uid } from "./lib/dom";
import { daysAgo, dlong, dnice, fmt, today } from "./lib/format";
import { ACCENT_HEX, RANGES } from "./data/groups";
import { DEFAULT_SETTINGS, STORAGE_OK, save, seedState, setState, state } from "./state/store";
import {
  bestE1RM,
  doneSessions,
  entryOf,
  exById,
  exName,
  lastPerf,
  routineById,
  sessionVolume,
  weeklySets,
} from "./state/selectors";
import { closeSheet, openSheet, sheetIsOpen } from "./ui/sheet";
import { toast } from "./ui/toast";

let view = state.active ? "train" : "train";

/* ---------- temporizador ---------- */
const T: TimerState & { int: any } = {end:0,total:0,int:null,label:'',beeped:false,warned:false};
function startTimer(sec,label){
  Object.assign(T, newTimer(sec,label));
  beepStart();
  $('#timer').classList.add('on'); tick();
  clearInterval(T.int); T.int=setInterval(tick,200);
  try{ localStorage.setItem('bitacora_timer',JSON.stringify({end:T.end,total:T.total,label:T.label})); }catch(e){}
}
function stopTimer(){ clearInterval(T.int); T.int=null; $('#timer').classList.remove('on');
  try{ localStorage.removeItem('bitacora_timer'); }catch(e){} }
function restoreTimer(){
  try{ const o=JSON.parse(localStorage.getItem('bitacora_timer')||'null'); if(!o) return;
    const t=restoredTimerState(o); if(!t){ localStorage.removeItem('bitacora_timer'); return; }
    Object.assign(T, t);
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
document.addEventListener('visibilitychange',()=>{ if(!document.hidden && state.active) void keepAwake(true); });
function tick(){
  const fr=timerFrame(T);
  $('#tnum').textContent=fr.text;
  $('#tnum').classList.toggle('done',fr.done);
  $('#tlbl').textContent=T.label;
  const f=$('#tfill'); f.style.width=fr.pct+'%'; f.classList.toggle('done',fr.done);
  if(fr.warn){ T.warned=true; beepWarn(); }
  if(fr.finish){ T.beeped=true; beep(); }
  if(fr.expired) stopTimer();
}
/* Los tres avisos del descanso tienen que distinguirse sin mirar la pantalla:
   arranca  = un tono grave y corto
   ya viene = dos tonos agudos rápidos
   terminó  = tres tonos ascendentes */
function tones(seq,vib){
  if(state.settings.vibrate && navigator.vibrate && vib) try{navigator.vibrate(vib);}catch(e){}
  if(!state.settings.sound) return;
  try{
    const AC=window.AudioContext||window.webkitAudioContext; if(!AC) return;
    const ac=new AC();
    let last=0;
    seq.forEach(n=>{
      const o=ac.createOscillator(),g=ac.createGain();
      o.type='sine'; o.frequency.value=n.f;
      const t0=ac.currentTime+n.t;
      g.gain.setValueAtTime(.0001,t0);
      g.gain.exponentialRampToValueAtTime(n.g||.3,t0+.02);
      g.gain.exponentialRampToValueAtTime(.0001,t0+n.d);
      o.connect(g); g.connect(ac.destination); o.start(t0); o.stop(t0+n.d+.02);
      last=Math.max(last,n.t+n.d);
    });
    setTimeout(()=>{try{ void ac.close() }catch(e){}},(last+1)*1000);
  }catch(e){}
}
function beepStart(){ tones([{f:392,t:0,d:.16,g:.24}],[70]); }
function beepWarn(){ tones([{f:1175,t:0,d:.08,g:.26},{f:1175,t:.13,d:.08,g:.26}],[60,70,60]); }
function beep(){ tones([{f:784,t:0,d:.18},{f:784,t:.22,d:.18},{f:1046,t:.44,d:.2,g:.32}],[120,80,120,80,220]); }



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
function showLock(mode){
  lockMode=mode;
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
    else{ $('#lockMsg').textContent='PIN incorrecto.'; $('#lockInput').value=''; }
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
const EXDB_KEY='bitacora_exdb_v2';
let exdbCache=null;
function exdbLoaded(){ if(exdbCache) return exdbCache; try{ exdbCache=JSON.parse(localStorage.getItem(EXDB_KEY)||'null'); }catch(e){} return exdbCache; }
async function exdbEnsure(){
  const have=exdbLoaded(); if(have) return have;
  const res=await fetch(EXDB_URL); if(!res.ok) throw new Error('No se pudo descargar');
  const data=await res.json();
  const slim=data.map(e=>({id:e.id,name:e.name,muscles:e.primaryMuscles||[],equipment:e.equipment||'',instructions:e.instructions||[],images:(e.images||[]).map(p=>'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/'+p)}));
  exdbCache=slim;
  try{ localStorage.removeItem('bitacora_exdb_v1'); }catch(e){}
  try{ localStorage.setItem(EXDB_KEY, JSON.stringify(slim)); }catch(e){}
  return slim;
}

/* ---------- buscador en español contra una base en inglés ----------
   La base pública está toda en inglés. Traducimos los términos de gimnasio
   más comunes antes de buscar, y buscamos también contra músculo y equipo,
   no solo contra el nombre. */
const EXDB_PHRASES=[
  ['peso muerto','deadlift'],['pesa rusa','kettlebells'],['pesas rusas','kettlebells'],
  ['de pie','standing'],['peso corporal','body only'],['sin peso','body only'],
  ['empuje de cadera','hip thrust'],['elevacion de talones','calf raise'],
  ['jalon al pecho','lat pulldown'],['prensa de piernas','leg press']
];
const EXDB_WORDS={
  mancuerna:['dumbbell'], barra:['barbell','bar'], polea:['cable'], maquina:['machine','leverage'],
  banda:['bands'], goma:['bands'], kettlebell:['kettlebells'], balon:['ball'], pelota:['ball'],
  sentado:['seated'], parado:['standing'], pie:['standing'], banco:['bench'], suelo:['floor','lying'],
  acostado:['lying'], tumbado:['lying'], inclinado:['incline'], declinado:['decline'],
  press:['press'], curl:['curl'], remo:['row'], tiron:['row','pull'], jalon:['pulldown','lat pulldown'],
  extension:['extension'], elevacion:['raise'], sentadilla:['squat'], zancada:['lunge'],
  estocada:['lunge'], empuje:['push','thrust'], dominada:['pullups','pull-up','chin'],
  fondo:['dips'], flexion:['pushups','push-up'], apertura:['fly','flyes'], cruce:['crossover'],
  encogimiento:['shrug'], patada:['kickback'], plancha:['plank'], puente:['bridge'],
  martillo:['hammer'], concentrado:['concentration'], alterno:['alternate'], alternado:['alternate'],
  cerrado:['close'], abierto:['wide'], agarre:['grip'], frontal:['front'], trasero:['behind','rear'],
  prensa:['leg press','press'], hiperextension:['hyperextension'],
  pecho:['chest'], pectoral:['chest'], espalda:['lats','back'], dorsal:['lats'],
  hombro:['shoulders'], deltoides:['shoulders','deltoid'], trapecio:['traps'],
  bicep:['biceps'], tricep:['triceps'], antebrazo:['forearms'], muneca:['wrist'],
  cuadricep:['quadriceps'], isquio:['hamstrings'], femoral:['hamstrings'], isquiotibial:['hamstrings'],
  gluteo:['glutes'], cola:['glutes'], cadera:['hip'], aductor:['adductors'], abductor:['abductors'],
  gemelo:['calves','calf'], pantorrilla:['calves','calf'], abdominal:['abdominals','ab '],
  abdomen:['abdominals'], core:['abdominals'], cuello:['neck'], lumbar:['lower back'],
  pierna:['leg'], brazo:['arm'], rodilla:['knee'], cuerpo:['body']
};
const EXDB_STOP=new Set(['de','del','la','el','los','las','en','con','a','al','y','o','un','una','para','por','the','of']);
const noAccent=s=>String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
// un token puede coincidir por sí mismo, por su singular o por cualquiera de sus traducciones
function exdbTerms(tok){
  const out=[];
  const add=x=>{ if(x && out.indexOf(x)<0) out.push(x); };
  const forms=[tok];
  if(tok.length>3 && /es$/.test(tok)) forms.push(tok.slice(0,-2));
  if(tok.length>3 && /s$/.test(tok)) forms.push(tok.slice(0,-1));
  forms.forEach(add);
  forms.forEach(f=>{ const v=EXDB_WORDS[f]; if(v) v.forEach(add); });
  return out;
}
function exdbTokens(q){
  let n=' '+noAccent(q).replace(/[^a-z0-9]+/g,' ').trim()+' ';
  EXDB_PHRASES.forEach(([es,en])=>{ n=n.split(' '+es+' ').join(' '+en+' '); });
  return n.trim().split(/\s+/).filter(t=>t && !EXDB_STOP.has(t));
}
function exdbMatch(e,tokens,full){
  const name=noAccent(e.name);
  const rest=noAccent((e.muscles||[]).join(' ')+' '+(e.equipment||''));
  let score=0;
  for(const tok of tokens){
    let hit=0;
    // una traducción de varias palabras ("leg press") es más específica que una suelta
    for(const t of exdbTerms(tok)){
      if(name.includes(t)) hit=Math.max(hit, t.indexOf(' ')>=0?5:3);
      else if(rest.includes(t)) hit=Math.max(hit,1);
    }
    if(!hit) return -1;
    score+=hit;
  }
  if(full && name.includes(full)) score+=6;
  if(full && name.startsWith(full)) score+=3;
  return score;
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
let exdbMode='form';     // 'form' | 'library' | 'routine' | 'replace-item' | 'replace-ex' | 'session-item'
let exdbRoutineId=null;  // 'routine' y 'replace-item'
let exdbItemId=null;     // solo usado en modo 'replace-item'
let exdbExId=null;       // solo usado en modo 'replace-ex'
let exdbEntryId=null;    // solo usado en modo 'session-item'
let exdbPending=null;    // ejercicio elegido en 'session-item', esperando el alcance
function alreadyImported(sourceId){ return state.exercises.find(x=>x.sourceId===sourceId); }
function sheetExDbSearch(mode?, ctx?){
  exdbMode=mode||'form'; exdbRoutineId=null; exdbItemId=null; exdbExId=null; exdbEntryId=null; exdbPending=null;
  if(exdbMode==='routine') exdbRoutineId=ctx||null;
  if(exdbMode==='replace-item'){ exdbRoutineId=(ctx&&ctx.routineId)||null; exdbItemId=(ctx&&ctx.itemId)||null; }
  if(exdbMode==='replace-ex') exdbExId=ctx||null;
  if(exdbMode==='session-item') exdbEntryId=ctx||null;
  const titles={form:'Base pública de ejercicios',library:'Explorar más ejercicios',routine:'Agregar ejercicio a la rutina','replace-item':'Reemplazar ejercicio de la rutina','replace-ex':'Reemplazar ejercicio','session-item':'Reemplazar ejercicio'};
  const subs={
    form:'873 ejercicios de Free Exercise DB (dominio público), con fotos. Buscá uno y se completa el formulario; después ajustá lo que quieras y guardá.',
    library:'873 ejercicios con fotos. Tocá uno para sumarlo directo a tu biblioteca — podés elegir varios seguidos.',
    routine:'Tocá un ejercicio para agregarlo a esta rutina. Si no estaba en tu biblioteca, se suma solo.',
    'replace-item':'Elegí un reemplazo para esta fila puntual. Series, reps, RIR y descanso ya cargados no se tocan.',
    'replace-ex':'Elegí un reemplazo: se sobrescriben nombre, grupo, pasos y fotos de este ejercicio. Las rutinas que ya lo usan siguen apuntando a él, sin romperse.',
    'session-item':'Elegí con qué cubrís este bloque. Se mantienen series, reps, RIR y descanso; se borran los números ya cargados. Después elegís si el cambio es solo por hoy o queda en la rutina.'
  };
  openSheet(`<div class="between"><div class="h2">${titles[exdbMode]}</div><button class="btn sm ghost" data-act="closesheet">Cerrar</button></div>
    <div class="text-tiny text-dim mt-1 mx-0 mb-2.5">${subs[exdbMode]}</div>
    <input type="text" id="exdbQ" placeholder="Buscar en español o inglés: polea, sentadilla, bench…" autofocus>
    <div id="exdbOut" class="stack mt-2.5"><div class="text-tiny text-dim">Escribí al menos 3 letras.</div></div>`);
  const inp=$('#exdbQ');
  let t=null;
  inp.addEventListener('input',()=>{ clearTimeout(t); t=setTimeout(()=>runExdbSearch(inp.value),250); });
  inp.focus();
}
async function runExdbSearch(q){
  const out=$('#exdbOut'); if(!out) return;
  q=q.trim();
  if(q.length<3){ out.innerHTML='<div class="text-tiny text-dim">Escribí al menos 3 letras.</div>'; return; }
  out.innerHTML='<div class="text-tiny text-dim">Buscando…</div>';
  let db;
  try{ db=await exdbEnsure(); }catch(e){ out.innerHTML='<div class="warn">No se pudo descargar la base (¿sin internet?). Probá de nuevo con wifi.</div>'; return; }
  const full=noAccent(q).replace(/[^a-z0-9]+/g,' ').trim();
  const tokens=exdbTokens(q);
  if(!tokens.length){ out.innerHTML='<div class="text-tiny text-dim">Escribí al menos 3 letras.</div>'; return; }
  const hits=db.map(e=>({e,sc:exdbMatch(e,tokens,full)})).filter(x=>x.sc>=0)
    .sort((a,b)=>b.sc-a.sc||a.e.name.length-b.e.name.length).slice(0,20).map(x=>x.e);
  if(!hits.length){
    out.innerHTML=`<div class="text-tiny text-dim">Nada con ese término en la base pública. Probá con otra palabra (por músculo o equipo también sirve), o creá el ejercicio a mano con tus propios pasos.</div>
      <button class="btn w-full mt-2.5" data-act="x-new">+ Crear el ejercicio a mano</button>`;
    return;
  }
  out.innerHTML=hits.map(e=>{
    const got=alreadyImported(e.id);
    const meta=[(e.muscles||[]).join(', '),e.equipment].filter(Boolean).join(' · ')||'—';
    return `<div class="li cursor-pointer" data-act="exdb-pick" data-id="${esc(e.id)}">
    ${e.images[0]?`<img class="w-13 h-13 object-cover rounded-lg flex-none" src="${esc(e.images[0])}" loading="lazy" onerror="this.style.display='none'">`:''}
    <div class="flex-1 min-w-0"><div class="h3 truncate">${esc(e.name)}</div><div class="text-tiny text-dim">${esc(meta)}</div></div>
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
    void runExdbSearch($('#exdbQ').value); // refresca la lista para marcar "En tu biblioteca"
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
  if(exdbMode==='session-item'){
    const en=entryOf(exdbEntryId); if(!en) return;
    exdbPending=e;
    sheetSwapScope(en, e);
    return;
  }
  if(exdbMode==='replace-ex'){
    const ex=exById(exdbExId); if(!ex) return;
    if(!confirm(`Esto reemplaza el nombre, grupo, pasos y fotos actuales por los de "${e.name}". ¿Seguir?`)) return;
    ex.name=e.name; ex.group=guessGroup(e.name,e.muscles); ex.cues=e.instructions;
    ex.err=''; ex.tip='Reemplazado desde Free Exercise DB.'; ex.images=e.images;
    ex.sourceId=e.id; ex.custom=false; delete ex.photoNote;
    save(true);
    render();
    toast('Ejercicio reemplazado: '+ex.name);
    sheetExercise(exdbExId);
    return;
  }
}

/* Las entries de la sesión no guardan el id del ítem de la rutina que las originó,
   y durante el entrenamiento se pueden agregar y quitar ejercicios: el índice no
   alcanza para emparejarlas. Se busca por ejercicio y, si la rutina repite el
   mismo ejercicio, se respeta el orden de aparición. */
function routineItemForEntry(en){
  const a=state.active; if(!a||!a.routineId) return null;
  const r=routineById(a.routineId); if(!r) return null;
  const hits=r.items.filter(it=>it.exerciseId===en.exerciseId);
  if(!hits.length) return null;
  const nth=a.entries.filter(x=>x.exerciseId===en.exerciseId).indexOf(en);
  return hits[nth]||hits[0];
}

/* Cambiar el ejercicio de hoy y cambiar la rutina son dos intenciones distintas.
   El alcance se decide acá, con el reemplazo ya elegido, y no antes. */
function sheetSwapScope(en, e){
  const done=en.sets.filter(x=>x.done).length;
  const it=routineItemForEntry(en);
  const rt=it?routineById(state.active.routineId):null;
  openSheet(`<div class="h2">Reemplazar por ${esc(e.name)}</div>
    <div class="text-tiny text-dim mt-1 mx-0 mb-2.5">Se mantienen series, reps, RIR y descanso.</div>
    ${done?`<div class="note">Ya marcaste ${done}${done>1?' series hechas':' serie hecha'} en este ejercicio: al reemplazarlo se borran esos números. El objetivo se mantiene.</div>`:''}
    <button class="btn w-full primary mt-2.5" data-act="swap-today" data-e="${esc(en.id)}">Solo por hoy</button>
    ${rt?`<button class="btn w-full mt-2" data-act="swap-forever" data-e="${esc(en.id)}">Para siempre (actualizar la rutina)</button>
      <div class="text-tiny text-dim mt-1.5">"Para siempre" además deja el cambio hecho en <b>${esc(rt.name)}</b> para las próximas veces.</div>`
    :`<div class="text-tiny text-dim mt-2">Esta es una sesión libre: no hay rutina que actualizar.</div>`}`);
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
function header(eyebrow,title,right?){
  return `<header class="top"><div class="wrap"><div class="topbar">
    <div class="flex-1 min-w-0"><div class="eyebrow">${esc(eyebrow)}</div><div class="h1">${esc(title)}</div></div>
    ${right||''}</div></div></header>`;
}
function storageWarn(){
  return STORAGE_OK?'':`<div class="wrap"><div class="warn mt-2.5"><b>Vista previa sin guardado.</b> Este entorno bloquea el almacenamiento local. Descargá el archivo y abrilo desde tu celular o compu: ahí sí guarda todo.</div></div>`;
}

/* ---------------- ENTRENAR ---------------- */
function viewTrain(){
  if(state.active) return viewSession();
  const rs=state.routines.map(r=>{
    const last=doneSessions().find(s=>s.routineId===r.id);
    const ago=last?(daysAgo(last.date)===0?'hoy':daysAgo(last.date)===1?'ayer':'hace '+daysAgo(last.date)+' días'):'nunca';
    return `<div class="card cursor-pointer" data-act="start" data-id="${r.id}">
      <div class="between"><div class="flex-1 min-w-0">
        <div class="h2">${esc(r.name)}</div>
        <div class="text-small text-dim truncate">${esc(r.subtitle||'')}</div>
        <div class="flex items-center mt-2 gap-1.5 flex-wrap">
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
    <div class="card bg-p2">
      <div class="flex items-center gap-4">
        <div><div class="eyebrow">Últimos 7 días</div><div class="mono text-h1 font-extrabold">${last7}<span class="text-dim text-ui"> sesiones</span></div></div>
        <div><div class="eyebrow">Series hechas</div><div class="mono text-h1 font-extrabold">${totalSets}</div></div>
      </div>
    </div>
    <div class="eyebrow mt-[18px] mx-0 mb-1">Elegí la sesión de hoy</div>
    ${rs}
    <div class="card bg-transparent border-dashed"><div class="text-small text-dim">Regla del plan: no hagas dos días de pierna seguidos y respetá al menos 1 día de descanso cada 3 sesiones.</div></div>
  </div>`;
}

function viewSession(){
  const s=state.active;
  const {v,sets}=sessionVolume(s);
  const total=s.entries.reduce((a,e)=>a+e.sets.length,0);
  const body=s.entries.map((en,idx)=>entryCard(en,idx,s)).join('');
  return header('En curso · '+dlong(s.date),s.name,`<button class="btn sm" data-act="finish">Terminar</button>`)+storageWarn()+`<div class="wrap">
    <div class="card bg-p2 py-[11px] px-3.5">
      <div class="between">
        <div><span class="eyebrow">Series</span> <span class="mono font-extrabold">${sets}/${total}</span></div>
        <div><span class="eyebrow">Volumen</span> <span class="mono font-extrabold">${fmt(Math.round(v))} kg</span></div>
        <div><span class="eyebrow">Tiempo</span> <span class="mono font-extrabold" id="elapsed">${elapsed(s)}</span></div>
      </div>
    </div>
    ${body}
    <button class="btn w-full mt-3" data-act="add-ex">+ Agregar ejercicio a esta sesión</button>
    <label class="f"><span class="eyebrow">Notas de la sesión</span>
      <textarea data-act="s-note" placeholder="Cómo te sentiste, molestias, qué ajustar la próxima…">${esc(s.notes||'')}</textarea></label>
    <div class="grid grid-cols-2 gap-2.5 mt-3 mx-0 mb-7">
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
      <div class="flex-1 min-w-0 cursor-pointer" data-act="guide" data-id="${en.exerciseId}">
        <div class="h3">${esc(ex?ex.name:'(borrado)')}</div>
        <div class="text-tiny text-dim">${esc(ex?ex.group:'')} · objetivo ${t.repsMin||''}-${t.repsMax||''} reps · RIR ${esc(t.rir||'')} · ${t.rest||90}s ${t.ss?' · superserie '+t.ss:''}</div>
      </div>
      <button class="btn icon sm" data-act="entry-menu" data-e="${en.id}">⋯</button>
    </div>
    <div class="setgrid"><div></div><div class="lbl">kg</div><div class="lbl">reps</div><div class="lbl">rir</div><div></div></div>
    ${rows}
    <div class="prevline">${esc(prevTxt)}</div>
    <div class="flex items-center mt-[9px] gap-2 flex-wrap">
      <button class="btn sm" data-act="addset" data-e="${en.id}">+ Serie</button>
      <button class="btn sm" data-act="delset" data-e="${en.id}">− Serie</button>
      <button class="btn sm ghost" data-act="rest" data-e="${en.id}">⏱ ${t.rest||90}s</button>
      <button class="btn icon sm ghost" data-act="rest-edit" data-e="${en.id}" title="Cambiar el descanso de hoy">✎</button>
      <div class="flex-1 min-w-0"></div>
      <button class="btn sm ghost" data-act="guide" data-id="${en.exerciseId}">Cómo se hace</button>
    </div>
    ${en.note?`<div class="note mt-[9px]">${esc(en.note)}</div>`:''}
  </div>`;
}

/* ---------------- RUTINAS ---------------- */
function viewRoutines(){
  const list=state.routines.map(r=>`<div class="card">
    <div class="between">
      <div class="flex-1 min-w-0 cursor-pointer" data-act="r-edit" data-id="${r.id}">
        <div class="h2">${esc(r.name)}</div>
        <div class="text-small text-dim">${esc(r.subtitle||'')}</div>
      </div>
      <button class="btn sm" data-act="r-edit" data-id="${r.id}">Editar</button>
    </div>
    <hr class="border-t border-line my-3">
    ${r.items.map((it,i)=>`<div class="flex items-center gap-2.5 text-tiny py-[3px] px-0">
      <span class="mono text-dim w-5">${it.ss?it.ss:i+1}</span>
      <span class="flex-1 min-w-0 truncate">${esc(exName(it.exerciseId))}</span>
      <span class="mono text-dim">${it.sets}×${it.repsMin}-${it.repsMax}</span></div>`).join('')}
    <div class="flex items-center mt-2.5 gap-2">
      <button class="btn sm ghost" data-act="r-dup" data-id="${r.id}">Duplicar</button>
      <button class="btn sm ghost danger" data-act="r-del" data-id="${r.id}">Borrar</button>
      <div class="flex-1 min-w-0"></div>
      <button class="btn sm primary" data-act="start" data-id="${r.id}">Empezar</button>
    </div>
  </div>`).join('');
  return header('Tus sesiones','Rutinas',`<button class="btn sm primary" data-act="r-new">+ Nueva</button>`)+`<div class="wrap">${list||'<div class="empty">Todavía no hay rutinas. Creá la primera.</div>'}
    <div class="card bg-transparent border-dashed mb-7"><div class="text-small text-dim">Mantené los mismos ejercicios 6-10 semanas. Cambiar todo cada semana hace imposible medir el progreso.</div></div></div>`;
}
function sheetRoutine(id){
  const r=id?routineById(id):{id:'',name:'',subtitle:'',items:[]};
  const opts=exOptions();
  const items=r.items.map((it,i)=>`<div class="card p-[11px]" data-ri="${i}">
    <div class="flex items-center gap-[7px]">
      <span class="mono text-dim text-tiny w-4">${i+1}</span>
      <select class="flex-1 min-w-0" data-k="exerciseId">${opts(it.exerciseId)}</select>
      <button class="btn icon sm" data-act="ri-up" data-i="${i}">↑</button>
      <button class="btn icon sm" data-act="ri-down" data-i="${i}">↓</button>
      <button class="btn icon sm" data-act="ri-replace" data-i="${i}" title="Reemplazar ejercicio">⇄</button>
      <button class="btn icon sm danger" data-act="ri-del" data-i="${i}">✕</button>
    </div>
    <div class="grid grid-cols-3 gap-2.5 mt-2">
      <label class="f m-0"><span class="eyebrow">Series</span><input type="text" inputmode="numeric" data-k="sets" value="${it.sets}"></label>
      <label class="f m-0"><span class="eyebrow">Reps mín</span><input type="text" inputmode="numeric" data-k="repsMin" value="${it.repsMin}"></label>
      <label class="f m-0"><span class="eyebrow">Reps máx</span><input type="text" inputmode="numeric" data-k="repsMax" value="${it.repsMax}"></label>
    </div>
    <div class="grid grid-cols-3 gap-2.5 mt-2">
      <label class="f m-0"><span class="eyebrow">RIR</span><input type="text" data-k="rir" value="${esc(it.rir)}"></label>
      <label class="f m-0"><span class="eyebrow">Descanso s</span><input type="text" inputmode="numeric" data-k="rest" value="${it.rest}"></label>
      <label class="f m-0"><span class="eyebrow">Superserie</span><input type="text" data-k="ss" value="${esc(it.ss||'')}" placeholder="A, B…"></label>
    </div>
  </div>`).join('');
  openSheet(`<div class="between"><div class="h2">${id?'Editar rutina':'Nueva rutina'}</div><button class="btn sm ghost" data-act="closesheet">Cerrar</button></div>
    <div id="rform" data-id="${esc(r.id)}">
    <label class="f"><span class="eyebrow">Nombre</span><input type="text" data-k="name" value="${esc(r.name)}" placeholder="F · Full body"></label>
    <label class="f"><span class="eyebrow">Subtítulo</span><input type="text" data-k="subtitle" value="${esc(r.subtitle||'')}" placeholder="Músculos que cubre"></label>
    <div class="eyebrow mt-4 mx-0 mb-1.5">Ejercicios</div>
    <div id="ritems">${items||'<div class="empty text-small">Sin ejercicios todavía.</div>'}</div>
    <div class="grid grid-cols-2 gap-2.5 mt-2">
      <button class="btn" data-act="ri-add">+ De mi biblioteca</button>
      <button class="btn" data-act="ri-add-db">🔎 Buscar más (873)</button>
    </div>
    <button class="btn w-full primary mt-3.5" data-act="r-save">Guardar rutina</button>
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
  const blocks=Object.keys(byG).sort().map(g=>`<div class="eyebrow mt-[18px] mx-0 mb-0.5">${esc(g)} · ${byG[g].length}</div>
    <div class="card">${byG[g].map(e=>`<div class="li">
      <div class="flex-1 min-w-0 cursor-pointer" data-act="guide" data-id="${e.id}">
        <div class="h3 truncate">${esc(e.name)}</div>
        <div class="text-tiny text-dim">${e.cues.length} pasos${e.custom?' · propio':''}</div>
      </div>
      <button class="btn icon sm ghost" data-act="x-replace-db" data-id="${e.id}" title="Reemplazar por otro de la base pública">⇄</button>
      <button class="btn sm ghost" data-act="x-edit" data-id="${e.id}">Editar</button>
    </div>`).join('')}</div>`).join('');
  return header('Biblioteca','Ejercicios',`<button class="btn sm primary" data-act="x-new">+ Nuevo</button>`)+`<div class="wrap">
    <input class="mt-1.5" type="text" placeholder="Buscar ejercicio o músculo…" value="${esc(state.ui.exq||'')}" data-act="exq">
    <button class="btn w-full ghost mt-2.5" data-act="x-search-db-lib">🔎 Explorar más ejercicios (873, con fotos)</button>
    ${blocks||'<div class="empty">Nada con ese nombre.</div>'}
    <div class="h-6"></div></div>`;
}
function sheetGuide(id){
  const e=exById(id); if(!e) return;
  const hist=exerciseHistory(id).slice(0,5);
  const photos=(e.images&&e.images.length)?`<div class="flex items-center gap-2 mt-3 overflow-x-auto" data-photos='${esc(JSON.stringify(e.images))}'>
    ${e.images.map((u,i)=>`<img class="h-[150px] rounded-ctl border border-line flex-none cursor-zoom-in" src="${esc(u)}" loading="lazy" data-act="photo" data-idx="${i}" onerror="this.style.display='none'">`).join('')}
    </div>${e.photoNote?`<div class="warn mt-2">${esc(e.photoNote)}</div>`:''}
    <div class="text-tiny text-dim mt-[5px]">Fotos: Free Exercise DB (dominio público)</div>`:'';
  openSheet(`<div class="between"><div class="flex-1 min-w-0"><div class="eyebrow">${esc(e.group)}</div><div class="h2">${esc(e.name)}</div></div>
    <button class="btn sm ghost" data-act="closesheet">Cerrar</button></div>
    ${photos}
    ${e.tip?`<div class="note mt-3">${esc(e.tip)}</div>`:''}
    <div class="eyebrow mt-4 mx-0 mb-1">Ejecución</div>
    ${e.cues.map((c,i)=>`<div class="cue"><b>${i+1}</b><span>${esc(c)}</span></div>`).join('')}
    ${e.err?`<div class="eyebrow mt-3.5 mx-0 mb-1">Error común</div><div class="warn">${esc(e.err)}</div>`:''}
    ${hist.length?`<div class="eyebrow mt-4 mx-0 mb-1">Últimas sesiones</div>
      <table class="t"><tr><th>Fecha</th><th>Mejor serie</th><th class="n">1RM est.</th></tr>
      ${hist.map(h=>`<tr><td>${dnice(h.date)}</td><td>${fmt(h.bw)}×${h.br}</td><td class="n">${fmt(Math.round(h.e))}</td></tr>`).join('')}</table>`:''}
    <button class="btn w-full mt-4" data-act="x-edit" data-id="${e.id}">Editar este ejercicio</button>`);
}
function sheetExercise(id, prefill?){
  const base = id?exById(id):{id:'',name:'',group:'Pecho',cues:[],err:'',tip:'',images:[]};
  const e = prefill ? Object.assign({}, base, prefill, {id: base.id}) : base;
  const photos=(e.images&&e.images.length)?`<div class="flex items-center gap-2 my-2 mx-0 overflow-x-auto" data-photos='${esc(JSON.stringify(e.images))}'>
    ${e.images.map((u,i)=>`<img class="h-20 rounded-lg border border-line flex-none cursor-zoom-in" src="${esc(u)}" loading="lazy" data-act="photo" data-idx="${i}" onerror="this.style.display='none'">`).join('')}
    </div>`:'';
  openSheet(`<div class="between"><div class="h2">${id?'Editar ejercicio':'Nuevo ejercicio'}</div><button class="btn sm ghost" data-act="closesheet">Cerrar</button></div>
    ${id?`<button class="btn w-full ghost mt-1" data-act="x-replace-db" data-id="${esc(e.id)}">Reemplazar por otro de la base pública</button>`:'<button class="btn w-full ghost mt-1" data-act="x-search-db">Buscar en la base pública (con fotos)</button>'}
    <div id="xform" data-id="${esc(e.id)}" data-images='${esc(JSON.stringify(e.images||[]))}'>
    ${photos}
    <label class="f"><span class="eyebrow">Nombre</span><input type="text" data-k="name" value="${esc(e.name)}"></label>
    <label class="f"><span class="eyebrow">Grupo muscular</span><select data-k="group">${GROUPS.map(g=>`<option ${g===e.group?'selected':''}>${g}</option>`).join('')}</select></label>
    <label class="f"><span class="eyebrow">Pasos de ejecución (uno por línea)</span><textarea class="min-h-[130px]" data-k="cues">${esc((e.cues||[]).join('\n'))}</textarea></label>
    <label class="f"><span class="eyebrow">Error común</span><textarea class="min-h-[60px]" data-k="err">${esc(e.err||'')}</textarea></label>
    <label class="f"><span class="eyebrow">Nota / por qué está elegido</span><textarea class="min-h-[60px]" data-k="tip">${esc(e.tip||'')}</textarea></label>
    <button class="btn w-full primary mt-3.5" data-act="x-save">Guardar</button>
    ${id?`<button class="btn w-full danger ghost mt-2" data-act="x-del" data-id="${e.id}">Borrar ejercicio</button>`:''}
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
  const tabs=`<div class="flex items-center gap-2 mt-2 mx-0 mb-0.5">
    ${[['ex','Ejercicio'],['vol','Volumen'],['hist','Historial'],['bw','Peso corporal']].map(([k,l])=>
      `<button class="btn sm ${tab===k?'primary':'ghost'}" data-act="ptab" data-t="${k}">${l}</button>`).join('')}</div>`;
  let body='';
  if(tab==='ex') body=progExercise();
  if(tab==='vol') body=progVolume();
  if(tab==='hist') body=progHistory();
  if(tab==='bw') body=progBW();
  return header('Lo que se mide, mejora','Progreso')+`<div class="wrap">${tabs}${body}<div class="h-7"></div></div>`;
}
function progExercise(){
  const id=state.ui.progressEx||state.exercises[0].id;
  const h=exerciseHistory(id);
  const opts=exOptions()(id);
  const chart=h.length>1?lineChart(h.map(x=>({x:x.date,y:x.e}))):'<div class="empty text-small">Registrá al menos dos sesiones con este ejercicio para ver la curva.</div>';
  const rows=h.slice().reverse().map(x=>`<tr><td>${dnice(x.date)}</td><td>${fmt(x.bw)}×${x.br}</td><td class="n">${fmt(Math.round(x.e))}</td><td class="n">${fmt(Math.round(x.vol))}</td></tr>`).join('');
  const first=h[0],last=h[h.length-1];
  const delta=(first&&last&&h.length>1)?((last.e-first.e)/first.e*100):null;
  return `<label class="f"><span class="eyebrow">Ejercicio</span><select data-act="pex">${opts}</select></label>
    <div class="card">
      <div class="between mb-1.5">
        <div><div class="eyebrow">1RM estimado</div><div class="mono text-[24px] font-extrabold">${last?fmt(Math.round(last.e)):'—'}<span class="text-dim text-small"> kg</span></div></div>
        ${delta!=null?`<div class="text-right"><div class="eyebrow">Desde el inicio</div><div class="mono text-[24px] font-extrabold ${delta>=0?'text-ok':'text-hot'}">${delta>=0?'+':''}${fmt(Math.round(delta*10)/10)}%</div></div>`:''}
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
  return `<svg class="w-full h-auto block" viewBox="0 0 ${W} ${H}">
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
    return `<div class="py-[9px] px-0 border-b border-line">
      <div class="between mb-[5px]">
        <div class="text-small font-bold">${esc(g)}</div>
        <div class="mono text-tiny ${n<lo?'text-dim':''}">${n} <span class="text-dim">/ ${lo}-${hi}</span></div>
      </div>
      <div class="bar"><i class="${cls}" style="width:${pct}%"></i><span class="zone" style="left:${lp}%;width:${hp-lp}%"></span></div>
    </div>`;
  }).join('');
  const hist=weekBars();
  return `<div class="card"><div class="eyebrow">Series efectivas · últimos 7 días</div>
    <div class="text-tiny text-dim mt-0.5 mx-0 mb-2">Las líneas marcan el rango óptimo del plan. Solo cuentan las series que marcaste como hechas.</div>
    ${rows}</div>
    <div class="card"><div class="eyebrow">Volumen por semana (kg totales)</div>${hist}</div>`;
}
function weekBars(){
  const weeks=[];
  for(let i=7;i>=0;i--){
    const end=new Date(Date.now()-i*7*864e5), start=new Date(+end-7*864e5);
    const a=start.toISOString().slice(0,10), b=end.toISOString().slice(0,10);
    let v=0,n=0;
    state.sessions.filter(s=>s.endedAt&&s.date>a&&s.date<=b).forEach(s=>{const r=sessionVolume(s);v+=r.v;n++;});
    weeks.push({label:dnice(b),v,n});
  }
  const mx=Math.max(1,...weeks.map(w=>w.v));
  if(mx<=1) return '<div class="empty text-small">Sin sesiones registradas todavía.</div>';
  return `<div class="flex items-end gap-[5px] h-[110px] mt-2.5">
    ${weeks.map(w=>`<div class="flex-1 min-w-0 text-center">
      <div class="rounded-t-[4px] min-h-[3px] ${w.v?'bg-sig':'bg-p3'}" style="height:${Math.round(w.v/mx*84)}px"></div>
      <div class="text-tiny text-dim mono mt-1">${w.label}</div></div>`).join('')}</div>
    <div class="text-tiny text-dim mt-1.5">Cada barra = una semana que termina en esa fecha.</div>`;
}
function progHistory(){
  const ss=doneSessions();
  if(!ss.length) return '<div class="empty">Todavía no terminaste ninguna sesión.</div>';
  return ss.map(s=>{const r=sessionVolume(s);return `<div class="card">
    <div class="between">
      <div class="flex-1 min-w-0 cursor-pointer" data-act="sess-view" data-id="${s.id}">
        <div class="h3">${esc(s.name)}</div>
        <div class="text-tiny text-dim">${dlong(s.date)} · ${r.sets} series · ${fmt(Math.round(r.v))} kg${s.dur?' · '+s.dur:''}</div>
      </div>
      <button class="btn sm ghost" data-act="sess-view" data-id="${s.id}">Ver</button>
    </div></div>`;}).join('');
}
function sheetSession(id){
  const s=state.sessions.find(x=>x.id===id); if(!s) return;
  const r=sessionVolume(s);
  openSheet(`<div class="between"><div class="flex-1 min-w-0"><div class="eyebrow">${dlong(s.date)}</div><div class="h2">${esc(s.name)}</div></div>
    <button class="btn sm ghost" data-act="closesheet">Cerrar</button></div>
    <div class="flex items-center gap-2 my-2.5 mx-0"><span class="chip">${r.sets} series</span><span class="chip">${fmt(Math.round(r.v))} kg</span>${s.dur?`<span class="chip">${esc(s.dur)}</span>`:''}</div>
    ${s.entries.map(en=>`<div class="card p-[11px]">
      <div class="h3">${esc(exName(en.exerciseId))}</div>
      <div class="mono text-small text-dim mt-1">${en.sets.filter(x=>x.done).map(x=>`${fmt(num(x.w))}×${x.r}${x.rir!==''?' (RIR '+x.rir+')':''}`).join(' · ')||'sin series'}</div>
    </div>`).join('')}
    ${s.notes?`<div class="note">${esc(s.notes)}</div>`:''}
    <button class="btn w-full ghost mt-3" data-act="sess-repeat" data-id="${s.id}">Repetir esta sesión</button>
    <button class="btn w-full danger ghost mt-2" data-act="sess-del" data-id="${s.id}">Borrar del historial</button>`);
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
      <div class="flex items-center gap-2">
        <input class="flex-1" type="text" inputmode="decimal" id="bwkg" placeholder="kg de hoy">
        <button class="btn primary" data-act="bw-add">Anotar</button>
      </div>
      <div class="flex items-center gap-4 mt-3">
        <div><div class="eyebrow">Promedio 7 días</div><div class="mono text-[24px] font-extrabold">${a1!=null?fmt(Math.round(a1*10)/10):'—'}</div></div>
        <div><div class="eyebrow">vs semana previa</div><div class="mono text-[24px] font-extrabold ${diff==null?'text-dim':Math.abs(diff)<=0.3?'text-ok':'text-sig'}">${diff!=null?(diff>0?'+':'')+fmt(Math.round(diff*10)/10):'—'}</div></div>
      </div>
      ${chart}
      <div class="note mt-2.5">${esc(verdict)}</div>
    </div>
    ${b.length?`<table class="t"><tr><th>Fecha</th><th class="n">kg</th><th></th></tr>${b.map(x=>`<tr><td>${dnice(x.date)}</td><td class="n">${fmt(x.kg)}</td><td class="n"><button class="btn sm ghost danger" data-act="bw-del" data-d="${x.date}">✕</button></td></tr>`).join('')}</table>`:'<div class="empty text-small">Sin pesadas cargadas.</div>'}`;
}

/* ---------------- AJUSTES ---------------- */
function viewSettings(){
  const s=state.settings;
  const ACCENTS=[['mostaza','Mostaza'],['verde','Verde'],['fucsia','Fucsia'],['violeta','Violeta'],['celeste','Celeste'],['coral','Coral']];
  return header('Tu copia, tus datos','Ajustes')+`<div class="wrap">
    ${accountCard()}
    <div class="card">
      <div class="eyebrow">Apariencia</div>
      <div class="flex items-center gap-2 mt-2.5 mx-0 mb-3.5">
        <button class="btn ${s.theme!=='light'?'primary':''} flex-1" data-act="theme" data-v="dark">Oscuro</button>
        <button class="btn ${s.theme==='light'?'primary':''} flex-1" data-act="theme" data-v="light">Claro</button>
      </div>
      <div class="eyebrow mb-2">Color</div>
      <div class="flex items-center gap-2.5 flex-wrap">
        ${ACCENTS.map(([v,label])=>`<button class="w-[38px] h-[38px] rounded-pill p-0 flex-none border-2 ${s.accent===v?'border-tx':'border-transparent'}" data-act="accent" data-v="${v}" title="${label}" style="background:${ACCENT_HEX[v]}"></button>`).join('')}
      </div>
    </div>
    <div class="card">
      <div class="eyebrow">Entrenamiento</div>
      <div class="switch"><div><div class="h3">Arrancar el descanso solo</div><div class="text-tiny text-dim">Al marcar una serie como hecha</div></div>
        <div class="tog ${s.autoTimer?'on':''}" data-act="tog" data-k="autoTimer"><i></i></div></div>
      <div class="switch"><div><div class="h3">Sonidos del descanso</div><div class="text-tiny text-dim">Al arrancar, cuando está por terminar y al terminar</div></div>
        <div class="tog ${s.sound?'on':''}" data-act="tog" data-k="sound"><i></i></div></div>
      <div class="switch"><div><div class="h3">Vibración</div><div class="text-tiny text-dim">Si el dispositivo la soporta</div></div>
        <div class="tog ${s.vibrate?'on':''}" data-act="tog" data-k="vibrate"><i></i></div></div>
      <div class="switch border-b-0"><div><div class="h3">Pantalla siempre encendida</div><div class="text-tiny text-dim">Mientras dura la sesión</div></div>
        <div class="tog ${s.wake?'on':''}" data-act="tog" data-k="wake"><i></i></div></div>
      <label class="f"><span class="eyebrow">Descanso por defecto (segundos)</span>
        <input type="text" inputmode="numeric" data-act="set-rest" value="${s.rest}"></label>
    </div>

    <div class="card">
      <div class="eyebrow">Calculadora de discos</div>
      <div class="text-tiny text-dim mt-0.5 mx-0 mb-2">Cuántos discos por lado para el peso total que querés.</div>
      <div class="flex items-center gap-2">
        <input class="flex-1" type="text" inputmode="decimal" id="plateW" placeholder="peso total">
        <input class="w-22" type="text" inputmode="decimal" id="plateBar" value="${s.bar}" title="barra">
        <button class="btn primary" data-act="plate">Calcular</button>
      </div>
      <div id="plateOut" class="mono text-small mt-2.5 text-sig"></div>
    </div>

    <div class="card">
      <div class="eyebrow">Privacidad</div>
      <div class="text-small text-dim mt-1 mx-0 mb-2.5">Un PIN para abrir la app en este dispositivo. Se guarda solo acá, no viaja a la nube ni a otros dispositivos.</div>
      ${pinIsSet()
        ? `<div class="grid grid-cols-2 gap-2.5"><button class="btn" data-act="pin-change">Cambiar PIN</button><button class="btn ghost danger" data-act="pin-disable">Desactivar</button></div>`
        : `<button class="btn w-full primary" data-act="pin-enable">Activar PIN</button>`}
    </div>
    <div class="card">
      <div class="eyebrow">Copia de seguridad</div>
      <div class="text-tiny text-dim mt-0.5 mx-0 mb-2.5">Los datos viven solo en este navegador. Exportá de vez en cuando y guardate el archivo.</div>
      <div class="grid grid-cols-2 gap-2.5">
        <button class="btn" data-act="export">Exportar .json</button>
        <button class="btn" data-act="import">Importar .json</button>
      </div>
      <input class="hidden" type="file" id="fileIn" accept="application/json,.json">
      <button class="btn w-full ghost mt-2" data-act="export-csv">Exportar historial .csv</button>
    </div>

    <div class="card">
      <div class="eyebrow">Datos</div>
      <div class="flex items-center gap-3 mt-2">
        <div><div class="mono text-[22px] font-extrabold">${state.sessions.filter(x=>x.endedAt).length}</div><div class="text-tiny text-dim">sesiones</div></div>
        <div><div class="mono text-[22px] font-extrabold">${state.exercises.length}</div><div class="text-tiny text-dim">ejercicios</div></div>
        <div><div class="mono text-[22px] font-extrabold">${state.routines.length}</div><div class="text-tiny text-dim">rutinas</div></div>
      </div>
      <button class="btn w-full ghost mt-3.5" data-act="tutorial">Ver el tutorial</button>
      <button class="btn w-full ghost mt-2" data-act="update">Buscar actualización de la app</button>
      <button class="btn w-full danger ghost mt-2" data-act="reset">Restaurar el plan original</button>
      <button class="btn w-full danger ghost mt-2" data-act="wipe">Borrar todo</button>
    </div>

    <div class="card bg-transparent border-dashed mb-7">
      <div class="text-small text-dim">Bitácora · basada en tu plan Push-Pull-Legs + Torso-Pierna. Guía general de entrenamiento, no consejo médico.
      Doble progresión: cuando llegás al techo de repeticiones en todas las series, subí 2,5 kg arriba / 5 kg abajo y volvé al piso del rango.</div>
    </div>
  </div>`;
}


/* =========================================================
   CUENTA Y SINCRONIZACIÓN (interfaz)
   ========================================================= */
function syncBadge(){
  const S: any=window.Sync?Sync.state:{status:'unconfigured'};
  const map={ ok:['ok','Al día'], syncing:['sig','Sincronizando…'], offline:['','Sin conexión'],
              error:['','Error'], local:['','Solo este dispositivo'], unconfigured:['','Solo este dispositivo'] };
  const [cls,txt]=map[S.status]||['',''];
  return `<span class="chip ${cls}">${esc(S.msg||txt)}</span>`;
}
function accountCard(){
  const S: any=window.Sync?Sync.state:{status:'unconfigured'};
  if(S.status==='unconfigured'){
    return `<div class="card">
      <div class="eyebrow">Cuenta</div>
      <div class="text-small text-dim mt-1">La sincronización está apagada porque falta cargar las claves de Firebase en <span class="mono">config.js</span>. La app funciona igual: los datos quedan guardados en este dispositivo.</div>
    </div>`;
  }
  if(!S.user){
    return `<div class="card">
      <div class="between"><div class="eyebrow">Cuenta</div>${syncBadge()}</div>
      <div class="text-small text-dim mt-1 mx-0 mb-2.5">Iniciá sesión para que tu historial se guarde en la nube y lo tengas en cualquier dispositivo.</div>
      <button class="btn w-full primary" data-act="auth-open">Entrar o crear cuenta</button>
    </div>`;
  }
  const lp=(window.Sync&&Sync.lastPull)?Sync.lastPull():null;
  const lpTxt=lp?new Date(lp).toLocaleString('es-AR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'}):'nunca';
  return `<div class="card">
    <div class="between"><div class="eyebrow">Cuenta</div>${syncBadge()}</div>
    <div class="h3 mt-1">${esc(S.user.email||'')}</div>
    <div class="text-tiny text-dim">${S.last?'Última sincronización: '+new Date(S.last).toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'}):'Todavía no sincronizó'}</div>
    <div class="text-tiny text-dim">Último intercambio con la nube: ${esc(lpTxt)}</div>
    <div class="grid grid-cols-2 gap-2.5 mt-2.5">
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
    <div id="auErr" class="warn hidden mt-2.5"></div>
    <button class="btn w-full primary mt-3.5" data-act="${reg?'auth-signup':'auth-signin'}">${reg?'Crear cuenta':'Entrar'}</button>
    <button class="btn w-full ghost mt-2" data-act="auth-toggle" data-m="${reg?'in':'reg'}">${reg?'Ya tengo cuenta':'Crear una cuenta nueva'}</button>
    ${reg?'':'<button class="btn w-full ghost mt-2" data-act="auth-reset">Olvidé la contraseña</button>'}
    <div class="flex items-center gap-2.5 my-4 mx-0"><hr class="border-t border-line my-3 flex-1 m-0"><span class="text-tiny text-dim">o</span><hr class="border-t border-line my-3 flex-1 m-0"></div>
    <button class="btn w-full" data-act="auth-google">
      <svg class="mr-0.5" width="17" height="17" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.56 2.7-3.87 2.7-6.62z"/><path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.96v2.33A9 9 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.03l2.99-2.33z"/><path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.97l2.99 2.33C4.66 5.17 6.65 3.58 9 3.58z"/></svg>
      Continuar con Google
    </button>
    <div class="text-tiny text-dim mt-3.5 mx-0 mb-1">Al entrar, lo que ya tengas en la nube se descarga y se junta con lo de este dispositivo. Nada se pisa sin avisar.</div>`);
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
  save(true); view='train'; void keepAwake(true); render();
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
  state.sessions.push(s); state.active=null; save(true); stopTimer(); void keepAwake(false); render();
  if(window.Sync) Sync.schedule(800);
  openSheet(`<div class="h2">Sesión guardada</div>
    <div class="flex items-center gap-2 my-3 mx-0"><span class="chip">${r.sets} series</span><span class="chip">${fmt(Math.round(r.v))} kg movidos</span><span class="chip">${esc(s.dur)}</span></div>
    ${prs.length?`<div class="eyebrow mt-2.5">Récords personales</div>${prs.map(p=>`<div class="cue"><b>★</b><span>${esc(p)}</span></div>`).join('')}`:
      `<div class="note">Sin récords hoy. La próxima vez, apuntá a una repetición más en al menos un ejercicio: eso es doble progresión.</div>`}
    <button class="btn w-full primary mt-3.5" data-act="closesheet">Listo</button>`);
}

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

/* =========================================================
   EVENTOS
   ========================================================= */
document.addEventListener('click',(ev: any)=>{
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
  if(a==='rest-edit'){
    const en=entryOf(el.dataset.e); if(!en) return;
    const cur=(en.target&&en.target.rest)||state.settings.rest;
    const v=prompt('Descanso de "'+exName(en.exerciseId)+'" para esta sesión (segundos):', String(cur));
    if(v===null) return;
    const n=parseInt(v,10);
    if(!n || n<5 || n>900){ toast('Poné un número entre 5 y 900 segundos'); return; }
    en.target=en.target||{}; en.target.rest=n;
    save(true); render(); toast('Descanso '+n+'s — solo para hoy');
    return;
  }
  if(a==='guide'){ sheetGuide(el.dataset.id); return; }
  if(a==='add-ex'){
    openSheet(`<div class="h2">Agregar ejercicio</div>
      <label class="f"><span class="eyebrow">Ejercicio</span><select id="addExSel">${exOptions()('')}</select></label>
      <div class="grid grid-cols-3 gap-2.5"><label class="f"><span class="eyebrow">Series</span><input id="addExSets" type="text" inputmode="numeric" value="3"></label>
      <label class="f"><span class="eyebrow">Reps</span><input id="addExReps" type="text" value="8-12"></label>
      <label class="f"><span class="eyebrow">Descanso s</span><input id="addExRest" type="text" inputmode="numeric" value="90"></label></div>
      <button class="btn w-full primary mt-3.5" data-act="add-ex-ok">Agregar</button>`);
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
      <button class="btn w-full primary mt-2.5" data-act="entry-note" data-e="${id}">Guardar nota</button>
      <button class="btn w-full ghost mt-2" data-act="guide" data-id="${en.exerciseId}">Ver ejecución</button>
      <button class="btn w-full ghost mt-2" data-act="entry-replace" data-e="${id}">Reemplazar ejercicio</button>
      <button class="btn w-full danger ghost mt-2" data-act="entry-del" data-e="${id}">Quitar de la sesión</button>`);
    return;
  }
  if(a==='entry-note'){ const en=entryOf(el.dataset.e); en.note=$('#enNote').value.trim(); save(true); closeSheet(); render(); return; }
  if(a==='entry-replace'){ sheetExDbSearch('session-item', el.dataset.e); return; }
  if(a==='swap-today' || a==='swap-forever'){
    const en=entryOf(el.dataset.e), e=exdbPending;
    if(!en || !e) return;
    // el ítem se resuelve antes de tocar la entry: el emparejamiento usa el ejercicio saliente
    const it=a==='swap-forever'?routineItemForEntry(en):null;
    const created=quickImport(e);
    if(it) it.exerciseId=created.id;
    en.exerciseId=created.id;
    en.sets.forEach(x=>{ x.w=''; x.r=''; x.rir=''; x.done=false; });
    exdbPending=null;
    save(true); closeSheet(); render();
    toast(it?('Actualizado en la rutina: '+created.name):('Solo por hoy: '+created.name));
    return;
  }
  if(a==='entry-del'){ state.active.entries=state.active.entries.filter(e=>e.id!==el.dataset.e); save(true); closeSheet(); render(); return; }

  /* rutinas */
  if(a==='r-new'){ sheetRoutine(null); return; }
  if(a==='r-edit'){ sheetRoutine(el.dataset.id); return; }
  if(a==='r-dup'){ const r=routineById(el.dataset.id);
    state.routines.push({id:uid(),name:r.name+' (copia)',subtitle:r.subtitle,items:r.items.map(i=>Object.assign({},i,{id:uid()}))});
    save(true); render(); toast('Rutina duplicada'); return; }
  if(a==='r-del'){ if(!confirm('¿Borrar esta rutina? El historial no se toca.')) return;
    state.routines=state.routines.filter(x=>x.id!==el.dataset.id); save(true); render(); return; }
  if(a==='ri-add'){ const items=collectItems(); items.push({id:uid(),exerciseId:state.exercises[0].id,sets:3,repsMin:8,repsMax:12,rir:'1-2',rest:90,ss:''});
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
  if(a==='exdb-pick'){ void pickExdb(el.dataset.id); return; }
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
        sets:en.sets.map(()=>({w:'',r:'',rir:'',done:false}))}))};
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
    void Sync.signOut().then(()=>{ toast('Sesión cerrada'); render(); }); return; }
  if(a==='sync-now'){ void Sync.run('manual'); toast('Sincronizando…'); return; }
  if(a==='update'){
    toast('Actualizando…');
    setTimeout(()=>{ void checkForUpdate(); },600);
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
    setState(seedState()); save(true); render(); toast('Todo borrado'); return; }

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
  if(id){ const r=routineById(id); r.name=name; r.subtitle=subtitle; r.items=items; save(true); sheetRoutine(id); }
  else{ const nid=uid(); state.routines.push({id:nid,name,subtitle,items}); save(true); sheetRoutine(nid); }
}

document.addEventListener('change',(ev: any)=>{
  const el=ev.target, a=el.dataset.act;
  if(a==='pex'){ state.ui.progressEx=el.value; save(); render(); return; }
  if(a==='exq'){ return; }
  if(a==='set-rest'){ state.settings.rest=parseInt(el.value)||90; save(); return; }
  if(a==='s-note'){ if(state.active){ state.active.notes=el.value; save(); } return; }
  const row=el.closest('.setrow'); if(row && el.tagName==='INPUT'){ readSetRow(row); save(); updateStats(); }
  if(el.id==='fileIn' && el.files && el.files[0]){
    const fr=new FileReader();
    fr.onload=()=>{ try{ const o=JSON.parse(fr.result as string);
      if(!o.exercises||!o.routines) throw 0;
      if(!confirm('Reemplaza los datos actuales por los del archivo. ¿Seguir?')) return;
      setState(o); state.settings=Object.assign({...DEFAULT_SETTINGS},state.settings||{});
      state.ui=state.ui||{}; save(true); render(); toast('Datos importados');
    }catch(e){ toast('El archivo no es una copia válida'); } };
    fr.readAsText(el.files[0]); el.value='';
  }
});
document.addEventListener('input',(ev: any)=>{
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
    setState(next); state.active=act;
    save(true);
    if(!sheetIsOpen()) render();
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
    if(btn) (btn as HTMLElement).click(); else closeSheet();
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
if(state.active) void keepAwake(true);
render();
if(pinIsSet()) showLock('unlock'); else maybeStartTour();
if(window.Sync){
  Sync.on(()=>{ if(view==='settings') render(); });
  void Sync.init();
}
registerServiceWorker();
