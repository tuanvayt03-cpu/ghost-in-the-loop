(() => {
'use strict';

const ROOT='__ghostPlusRuntime';
const VERSION='0.15.3';
const previous=window[ROOT];
try { if(previous?.active && typeof previous.destroy==='function') previous.destroy('reinject'); } catch (_) {}

const native={
  setInterval: globalThis.setInterval.bind(globalThis),
  clearInterval: globalThis.clearInterval.bind(globalThis),
  setTimeout: globalThis.setTimeout.bind(globalThis),
  clearTimeout: globalThis.clearTimeout.bind(globalThis),
  requestAnimationFrame: globalThis.requestAnimationFrame?.bind(globalThis),
  cancelAnimationFrame: globalThis.cancelAnimationFrame?.bind(globalThis)
};
const seq=(Number(window.__ghostPlusRuntimeSeq)||0)+1;
window.__ghostPlusRuntimeSeq=seq;

const scopes=new Map();
let active=true, destroyedAt=0, destroyReason='';
const startedAt=Date.now();
try{document.documentElement.dataset.ghostplusRuntimeGeneration=String(seq)}catch(_){}

function publicSnapshot(d){
  const totals={};
  for(const [k,v] of Object.entries(d?.totals||{}))totals[k]=Number(v)||0;
  return {
    version:String(d?.version||VERSION),
    generation:Number(d?.generation)||seq,
    active:!!d?.active,
    destroyedAt:Number(d?.destroyedAt)||0,
    destroyReason:String(d?.destroyReason||''),
    totals,
    allZero:Object.values(totals).every(v=>v===0)
  }
}
function publishLast(d){
  const safe=publicSnapshot(d);
  try{document.documentElement.dataset.ghostplusLastDiagnostics=JSON.stringify(safe)}catch(_){}
  try{delete document.documentElement.dataset.ghostplusRuntimeGeneration}catch(_){}
  try{console.info('[Ghost+] runtime destroyed',safe)}catch(_){}
  return safe
}

function makeScope(name){
  if(scopes.has(name)) return scopes.get(name).api;
  const intervals=new Set(), timeouts=new Set(), rafs=new Set(), observers=new Set();
  const listeners=new Set(), abortables=new Set(), nodes=new Set(), cleanups=[];
  const sleeps=new Map(), patches=[];
  let scopeActive=true;

  const alive=()=>active&&scopeActive&&window[ROOT]?.generation===seq;
  const interval=(fn,ms,...args)=>{
    if(!alive()) return null;
    const id=native.setInterval(()=>{if(alive())try{fn(...args)}catch(_){}},Math.max(0,Number(ms)||0));
    intervals.add(id); return id;
  };
  const clearIntervalOwned=id=>{if(id==null)return;try{native.clearInterval(id)}catch(_){} intervals.delete(id)};
  const timeout=(fn,ms,...args)=>{
    if(!alive()) return null;
    let id=null;
    id=native.setTimeout(()=>{
      timeouts.delete(id);
      if(alive())try{fn(...args)}catch(_){}
    },Math.max(0,Number(ms)||0));
    timeouts.add(id); return id;
  };
  const clearTimeoutOwned=id=>{if(id==null)return;try{native.clearTimeout(id)}catch(_){} timeouts.delete(id)};
  const sleep=ms=>new Promise(resolve=>{
    if(!alive()){resolve(false);return}
    let id=null;
    id=native.setTimeout(()=>{
      timeouts.delete(id);sleeps.delete(id);
      resolve(alive());
    },Math.max(0,Number(ms)||0));
    timeouts.add(id);sleeps.set(id,resolve);
  });
  const raf=fn=>{
    if(!alive()||!native.requestAnimationFrame)return null;
    let id=null;
    id=native.requestAnimationFrame(ts=>{rafs.delete(id);if(alive())try{fn(ts)}catch(_){}});
    rafs.add(id);return id;
  };
  const cancelRaf=id=>{if(id==null||!native.cancelAnimationFrame)return;try{native.cancelAnimationFrame(id)}catch(_){}rafs.delete(id)};
  const listen=(target,type,fn,opts)=>{
    if(!alive()||!target?.addEventListener||typeof fn!=='function')return()=>{};
    const wrapped=function(...args){if(alive())return fn.apply(this,args)};
    target.addEventListener(type,wrapped,opts);
    const rec={target,type,wrapped,opts};listeners.add(rec);
    return()=>{try{target.removeEventListener(type,wrapped,opts)}catch(_){}listeners.delete(rec)};
  };
  const observe=(observer,target,opts)=>{
    if(!alive()||!observer?.observe||!target)return observer;
    try{observer.observe(target,opts);observers.add(observer)}catch(_){}
    return observer;
  };
  const node=el=>{if(el?.remove)nodes.add(el);return el};
  const cleanup=fn=>{if(typeof fn==='function')cleanups.push(fn);return fn};
  const abortable=h=>{if(h&&typeof h.abort==='function')abortables.add(h);return h};
  const releaseAbortable=h=>{abortables.delete(h)};
  const patch=(obj,key,value)=>{
    if(!alive()||!obj)return false;
    const had=Object.prototype.hasOwnProperty.call(obj,key),desc=had?Object.getOwnPropertyDescriptor(obj,key):null;
    try{obj[key]=value}catch(_){return false}
    patches.push({obj,key,value,had,desc});
    return true;
  };

  function destroyScope(reason='destroy'){
    if(!scopeActive)return;
    scopeActive=false;
    for(const id of intervals)try{native.clearInterval(id)}catch(_){}
    intervals.clear();
    for(const id of timeouts)try{native.clearTimeout(id)}catch(_){}
    timeouts.clear();
    for(const resolve of sleeps.values())try{resolve(false)}catch(_){}
    sleeps.clear();
    for(const id of rafs)try{native.cancelAnimationFrame?.(id)}catch(_){}
    rafs.clear();
    for(const rec of listeners)try{rec.target.removeEventListener(rec.type,rec.wrapped,rec.opts)}catch(_){}
    listeners.clear();
    for(const o of observers)try{o.disconnect()}catch(_){}
    observers.clear();
    for(const h of abortables)try{h.abort()}catch(_){}
    abortables.clear();
    for(let i=cleanups.length-1;i>=0;i--)try{cleanups[i](reason)}catch(_){}
    cleanups.length=0;
    for(let i=patches.length-1;i>=0;i--){
      const p=patches[i];
      try{
        if(p.obj[p.key]!==p.value)continue;
        if(p.had&&p.desc)Object.defineProperty(p.obj,p.key,p.desc);
        else delete p.obj[p.key];
      }catch(_){}
    }
    patches.length=0;
    for(const el of nodes)try{el.remove()}catch(_){}
    nodes.clear();
  }
  function stats(){return{
    active:alive(),intervals:intervals.size,timeouts:timeouts.size,sleeps:sleeps.size,
    rafs:rafs.size,listeners:listeners.size,observers:observers.size,
    abortables:abortables.size,nodes:nodes.size,patches:patches.length,cleanups:cleanups.length
  }}

  const api=Object.freeze({
    name,generation:seq,alive,interval,clearInterval:clearIntervalOwned,timeout,clearTimeout:clearTimeoutOwned,
    sleep,raf,cancelRaf,listen,observe,node,cleanup,abortable,releaseAbortable,patch,
    destroy:destroyScope,stats
  });
  scopes.set(name,{api,destroy:destroyScope,stats});
  return api;
}

function cleanupDom(){
  try{document.documentElement.removeAttribute('data-ghostplus-gate')}catch(_){}
  try{document.title=document.title.replace(/^[🔴🟠]\s+(HUMAN|RELAY|CONTEXT|AUTH|RECOVERY|BLOCKED)\s+·\s+/,'')}catch(_){}
  try{
    for(const el of document.querySelectorAll('#gitl9,[id^="ghostplus-"]'))el.remove();
  }catch(_){}
}
function cleanupGlobals(){
  const names=[
    '__GHOST_PLUS_ALERT_ROUTER__','__GHOST_PLUS_TELEGRAM__','__GHOST_PLUS_TURN_BUDGET_V2__',
    '__GITL_V9__','__GITL_V9_BOOTING__','__GHOST_PLUS_OPERATOR_GATE__','__GHOST_PLUS_UNCERTAIN_RECONCILE__',
    '__GHOST_PLUS_SMART__','__GHOST_PLUS_CORE_BUSY_GATE__','__GHOST_PLUS_CONTEXT_BOUNDARY__',
    '__GHOST_PLUS_WEB_RECOVERY__','__GHOST_PLUS_VI_SAFE__','__GHOST_PLUS_HELP__','__GHOST_PLUS_LAYOUT_FIX__',
    '__ghostPlusAlerts','__ghostPlusCurrentChatName','__ghostPlusNotify','__ghostPlusTelegram',
    '__ghostPlusSupervisor','__ghostPlusWatchdog'
  ];
  for(const n of names)try{delete window[n]}catch(_){try{window[n]=undefined}catch(_){}}
}
function diagnostics(){
  const modules={};const totals={intervals:0,timeouts:0,sleeps:0,rafs:0,listeners:0,observers:0,abortables:0,nodes:0,patches:0,cleanups:0};
  for(const [name,s] of scopes){const x=s.stats();modules[name]=x;for(const k of Object.keys(totals))totals[k]+=Number(x[k]||0)}
  return{version:VERSION,generation:seq,active,startedAt,destroyedAt,destroyReason,modules,totals};
}
function destroy(reason='operator'){
  if(!active)return diagnostics();
  active=false;destroyedAt=Date.now();destroyReason=String(reason||'destroy');
  for(const s of [...scopes.values()].reverse())try{s.destroy(destroyReason)}catch(_){}
  cleanupDom();cleanupGlobals();
  const final=diagnostics();
  try{window.__ghostPlusRuntimeLastDiagnostics=final}catch(_){}
  publishLast(final);
  return final;
}

const runtime=Object.freeze({
  version:VERSION,generation:seq,get active(){return active},module:makeScope,destroy,diagnostics
});
window[ROOT]=runtime;
})();
