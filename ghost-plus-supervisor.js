(() => {
'use strict';
if (window.__GHOST_PLUS_SUPERVISOR__) return;
window.__GHOST_PLUS_SUPERVISOR__ = true;
if (!/^(chatgpt\.com|chat\.openai\.com)$/i.test(location.hostname)) return;

const CFG = Object.freeze({ tickMs: 500, reminderMs: [15*60*1000, 60*60*1000] });
const STORE = 'ghostplus.supervisor.v1';
const q = (s,r=document) => r.querySelector(s);
const qa = (s,r=document) => [...r.querySelectorAll(s)];
const now = () => Date.now();
const norm = v => String(v || '').replace(/\s+/g,' ').trim();
const pathKey = () => String(location.pathname || '/').split(/[?#]/)[0];
const chatKey = () => pathKey().match(/\/c\/([^/]+)/i)?.[1] || pathKey();

const MARKERS = Object.freeze({
  '[[GITL::HUMAN]]':'HUMAN','[[AOA::HUMAN]]':'HUMAN',
  '[[GITL::RELAY]]':'RELAY','[[AOA::RELAY]]':'RELAY',
  '[[GITL::HALT]]':'HALT','[[AOA::HALT]]':'HALT',
  '[[GITL::PROCEED]]':'PROCEED','[[AOA::PROCEED]]':'PROCEED'
});

function loadAll(){ try { const v=GM_getValue(STORE,{}); return v && typeof v==='object' ? v : {}; } catch(_) { return {}; } }
function saveAll(v){ try { GM_setValue(STORE,v); } catch(_) {} }
function readState(){ const all=loadAll(); return all[chatKey()] || null; }
function writeState(state){
  const all=loadAll();
  if (state) all[chatKey()] = state; else delete all[chatKey()];
  saveAll(all);
}
function hash(value){ const s=String(value||''); let h=2166136261; for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);} return (h>>>0).toString(16); }
function latestAssistantText(){ const xs=qa('[data-message-author-role="assistant"]').filter(x=>x.isConnected); const el=xs[xs.length-1]; return String(el?.innerText||el?.textContent||'').trim(); }
function terminalFromText(text){
  const lines=String(text||'').replace(/\r/g,'').split('\n').map(x=>x.trim()).filter(Boolean);
  const last=lines[lines.length-1] || '';
  return { type: MARKERS[last] || '', marker:last };
}
function latestTerminal(){ const text=latestAssistantText(); const t=terminalFromText(text); return {...t,text,hash:hash(text)}; }
function ghostStatus(){ return norm(q('#gitl9 .status')?.innerText||''); }
function ghostStop(){ return q('#gitl9 [data-a="stop"]'); }
function ghostPlay(){ return q('#gitl9 [data-a="play"]'); }
function visible(el){ return !!el && el.isConnected && !el.disabled && el.getAttribute('aria-disabled')!=='true' && !!(el.offsetWidth||el.offsetHeight||el.getClientRects().length); }

function emitAlert(event){
  try {
    window.dispatchEvent(new CustomEvent('ghostplus:alert',{detail:event}));
  } catch(_) {}
  try {
    const title = event.severity==='critical' ? 'Ghost+ · Cần can thiệp' : 'Ghost+';
    GM_notification?.({title,text:event.message||event.type,timeout:10000});
  } catch(_) {}
}

function lock(type, terminal, reason=''){
  if (!['HUMAN','RELAY','HALT'].includes(type)) return null;
  const prev=readState();
  const same=prev && prev.locked && prev.type===type && prev.terminalHash===terminal.hash;
  const state=same ? prev : {
    locked:true,type,at:now(),terminalHash:terminal.hash,marker:terminal.marker,
    reason:norm(reason || terminal.text).slice(0,320), acknowledged:false, remindersSent:0
  };
  writeState(state);
  const stop=ghostStop();
  if (type!=='HALT' && visible(stop) && /^RUNNING\b/i.test(ghostStatus())) {
    try { stop.click(); } catch(_) {}
  }
  if (!same) emitAlert({
    type:type==='HUMAN'?'HUMAN_REQUIRED':type==='RELAY'?'RELAY_REQUIRED':'COMPLETE',
    severity:type==='HALT'?'info':'critical',
    chat:window.__ghostPlusCurrentChatName?.() || chatKey(),
    episodeId:`${chatKey()}:${type}:${terminal.hash}`,
    message:type==='HUMAN'?'Ghost đang PAUSE và cần quyết định của người dùng.':type==='RELAY'?'Ghost đang PAUSE và cần relay thủ công.':'Ghost đã HALT.'
  });
  return state;
}

function currentGate(){
  const s=readState();
  if (!s?.locked) return null;
  return s;
}
function blocksAutomation(){ const s=currentGate(); return !!s && ['HUMAN','RELAY','HALT'].includes(s.type); }
function acknowledge(){
  const s=currentGate(); if(!s) return false;
  s.acknowledged=true; writeState(s); return true;
}
function clearFromTrustedUserEvent(ev){
  if (!ev?.isTrusted) return false;
  const s=currentGate(); if(!s || s.type==='HALT') return false;
  writeState(null);
  window.dispatchEvent(new CustomEvent('ghostplus:gate-cleared',{detail:{type:s.type,at:now()}}));
  return true;
}
function resumeFromTrustedUserEvent(ev){
  if (!clearFromTrustedUserEvent(ev)) return false;
  const play=ghostPlay(); if (visible(play)) { try { play.click(); } catch(_) { return false; } }
  return true;
}

function render(){
  const s=currentGate();
  let box=q('#ghostplus-operator-gate');
  if (!s) { if(box) box.remove(); return; }
  const host=q('#ghostplus-watch') || q('#gitl9') || document.body;
  if (!box) {
    box=document.createElement('div'); box.id='ghostplus-operator-gate';
    box.style.cssText='margin-top:6px;padding:7px;border:1px solid #ef4444;border-radius:7px;background:rgba(254,226,226,.96);font:11px/1.35 system-ui;color:#7f1d1d;z-index:2147483646';
    host.appendChild(box);
  }
  const age=Math.max(0,Math.floor((now()-s.at)/60000));
  box.innerHTML=`<div><b>${s.type==='HUMAN'?'🔴 HUMAN REQUIRED':s.type==='RELAY'?'🟠 RELAY REQUIRED':'✅ COMPLETE'}</b> · ${age}m</div>
    <div style="margin-top:3px;max-width:320px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${String(s.reason||'').replace(/[<>&]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;'}[c]))}</div>
    ${s.type==='HALT'?'':'<div style="margin-top:5px"><button data-gp-ack>Acknowledge</button> <button data-gp-resume>Resume</button></div>'}`;
  const ack=q('[data-gp-ack]',box), resume=q('[data-gp-resume]',box);
  if (ack) ack.onclick=e=>{ if(!e.isTrusted)return; acknowledge(); ack.disabled=true; ack.textContent='Acknowledged'; };
  if (resume) resume.onclick=e=>resumeFromTrustedUserEvent(e);
}

let baseTitle='';
function titleTick(){
  const s=currentGate();
  if (!s) {
    if (baseTitle && document.title.startsWith('⚠ ')) document.title=baseTitle;
    baseTitle=''; return;
  }
  if (!baseTitle || !document.title.startsWith('⚠ ')) baseTitle=document.title.replace(/^⚠\s+(HUMAN|RELAY)\s+·\s+/,'');
  if (s.type==='HUMAN' || s.type==='RELAY') {
    const name=window.__ghostPlusCurrentChatName?.() || 'ChatGPT';
    const wanted=`⚠ ${s.type} · ${name}`;
    if (document.title!==wanted) document.title=wanted;
  }
}

function reminderTick(){
  const s=currentGate(); if(!s || s.acknowledged || !['HUMAN','RELAY'].includes(s.type)) return;
  const idx=Number(s.remindersSent)||0; if(idx>=CFG.reminderMs.length) return;
  if (now()-s.at < CFG.reminderMs[idx]) return;
  s.remindersSent=idx+1; writeState(s);
  emitAlert({type:'GATE_REMINDER',severity:'critical',chat:window.__ghostPlusCurrentChatName?.()||chatKey(),episodeId:`${chatKey()}:${s.type}:${s.terminalHash}:r${idx+1}`,message:`${s.type} vẫn đang chờ can thiệp.`});
}

function sample(){
  const terminal=latestTerminal();
  if (terminal.type==='HUMAN' || terminal.type==='RELAY' || terminal.type==='HALT') lock(terminal.type,terminal);
  render(); titleTick(); reminderTick();
}

window.__ghostPlusSupervisor=Object.freeze({
  latestTerminal, currentGate, blocksAutomation, acknowledge,
  clearFromTrustedUserEvent, resumeFromTrustedUserEvent,
  canAutomate:()=>!blocksAutomation(),
  emitAlert
});

setInterval(sample,CFG.tickMs);
sample();
})();