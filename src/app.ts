/* =========================================================
   BITÁCORA — registro de entrenamiento offline
   Sin internet. Datos en este dispositivo.

   Fase 3, anteultimo paso. Ya salieron el estado, los datos, las
   vistas y los features. Lo que queda es el despachador de
   eventos, el puente con sync y el arranque. La cadena de `if`
   se convierte en tabla de handlers en el PR 4.
   ========================================================= */
import "./app.css";
import "./sync";
import { registerServiceWorker, checkForUpdate } from "./pwa";
import { num } from "./lib/calc";
import { $, esc, uid } from "./lib/dom";
import { fmt, today } from "./lib/format";
import { exportCSV, exportJSON, importJSON } from "./features/backup";
import { clearPendingSwap, pendingSwap, pickExdb, quickImport, sheetExDbSearch } from "./features/exdb";
import { closeLightbox, openLightbox, stepLightbox } from "./features/lightbox";
import { pinIsSet, showLock } from "./features/pin";
import { collectItems, stashRoutine } from "./features/rutinas";
import {
  finishSession,
  readSetRow,
  startSession,
  toggleSet,
  updateStats,
} from "./features/sesion";
import { routineItemForEntry } from "./features/swap";
import { keepAwake, restoreTimer, startTimer, stopTimer, T, tick } from "./features/timer";
import { endTour, maybeStartTour, startTour, tourNext, tourPrev } from "./features/tour";
import { save, seedState, setState, state } from "./state/store";
import { entryOf, exById, exName, routineById } from "./state/selectors";
import { closeSheet, openSheet, sheetIsOpen } from "./ui/sheet";
import { render, setView, view } from "./ui/shell";
import { applyTheme } from "./ui/theme";
import { toast } from "./ui/toast";
import { exOptions, sheetExercise, sheetGuide } from "./views/ejercicios";
import { sheetRoutine } from "./views/rutinas";
import { sheetSession } from "./views/progreso";
import { authErr, sheetAuth } from "./views/cuenta";

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
    const en=entryOf(el.dataset.e), e=pendingSwap();
    if(!en || !e) return;
    // el ítem se resuelve antes de tocar la entry: el emparejamiento usa el ejercicio saliente
    const it=a==='swap-forever'?routineItemForEntry(en):null;
    const created=quickImport(e);
    if(it) it.exerciseId=created.id;
    en.exerciseId=created.id;
    en.sets.forEach(x=>{ x.w=''; x.r=''; x.rir=''; x.done=false; });
    clearPendingSwap();
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
  if(a==='lightbox-prev'){ stepLightbox(-1); return; }
  if(a==='lightbox-next'){ stepLightbox(1); return; }

  /* tutorial guiado */
  if(a==='tutorial'){ startTour(); return; }
  if(a==='tour-skip'){ endTour(); return; }
  if(a==='tour-prev'){ tourPrev(); return; }
  if(a==='tour-next'){ tourNext(); return; }
});


document.addEventListener('change',(ev: any)=>{
  const el=ev.target, a=el.dataset.act;
  if(a==='pex'){ state.ui.progressEx=el.value; save(); render(); return; }
  if(a==='exq'){ return; }
  if(a==='set-rest'){ state.settings.rest=parseInt(el.value)||90; save(); return; }
  if(a==='s-note'){ if(state.active){ state.active.notes=el.value; save(); } return; }
  const row=el.closest('.setrow'); if(row && el.tagName==='INPUT'){ readSetRow(row); save(); updateStats(); }
  if(el.id==='fileIn' && el.files && el.files[0]){ importJSON(el.files[0]); el.value=''; }
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
