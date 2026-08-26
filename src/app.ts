/* =========================================================
   BITÁCORA — registro de entrenamiento offline
   Sin internet. Datos en este dispositivo.

   Fase 3 en curso. Ya salieron el estado, los datos, los
   helpers y las vistas. Le quedan los features (temporizador,
   PIN, visor de fotos, base pública, tour), las acciones de la
   sesión y el despachador de eventos, que salen en los dos PRs
   siguientes.
   ========================================================= */
import "./app.css";
import "./sync";
import { registerServiceWorker, checkForUpdate } from "./pwa";
import { clamp, e1rm, num } from "./lib/calc";
import {
  newTimer,
  restoreTimer as restoredTimerState,
  timerFrame,
  type TimerState,
} from "./lib/timer";
import { $, $$, dl, esc, uid } from "./lib/dom";
import { fmt, today } from "./lib/format";
import { pinCheck, pinClear, pinIsSet, pinSet } from "./features/pin";
import { DEFAULT_SETTINGS, save, seedState, setState, state } from "./state/store";
import {
  bestE1RM,
  doneSessions,
  entryOf,
  exById,
  exName,
  routineById,
  sessionVolume,
} from "./state/selectors";
import { closeSheet, openSheet, sheetIsOpen } from "./ui/sheet";
import { render, setView, view } from "./ui/shell";
import { applyTheme } from "./ui/theme";
import { toast } from "./ui/toast";
import { elapsed } from "./views/entrenar";
import { sheetExercise, sheetGuide, exOptions } from "./views/ejercicios";
import { sheetRoutine } from "./views/rutinas";
import { sheetSession } from "./views/progreso";
import { authErr, sheetAuth } from "./views/cuenta";

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
/* =========================================================
   ACCIONES
   ========================================================= */
function startSession(routineId){
  const r=routineById(routineId); if(!r) return;
  state.active={ id:uid(), routineId:r.id, name:r.name, date:today(), startedAt:Date.now(), notes:'',
    entries:r.items.map(it=>({ id:uid(), exerciseId:it.exerciseId,
      target:{sets:it.sets,repsMin:it.repsMin,repsMax:it.repsMax,rir:it.rir,rest:it.rest,ss:it.ss},
      sets:Array.from({length:it.sets},()=>({w:'',r:'',rir:'',done:false})) })) };
  save(true); setView('train'); void keepAwake(true); render();
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
  if(a==='nav'){ setView(el.dataset.v); closeSheet(); render(); return; }
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
    save(true); closeSheet(); setView('train'); render(); return;
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
    if(tourIdx>=TOUR_STEPS.length-1){ endTour(); setView('train'); render(); return; }
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
