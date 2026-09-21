(() => {
'use strict';
const RT=window.__ghostPlusRuntime?.module('turn-budget');if(!RT)return;
if (window.__GHOST_PLUS_TURN_BUDGET_V2__) return;
window.__GHOST_PLUS_TURN_BUDGET_V2__ = true;
if (!/^(chatgpt\.com|chat\.openai\.com)$/i.test(location.hostname)) return;

const K = Object.freeze({
  minutes: 'ghostplus.turnBudgetMin',
  startedAt: 'ghostplus.turnStartedAt'
});
const CFG = Object.freeze({ defaultMinutes: 20, tickMs: 1000, cleanupMs: 12000 });
const q = (s, r=document) => r.querySelector(s);
const qa = (s, r=document) => [...r.querySelectorAll(s)];
const norm = v => String(v || '').replace(/\s+/g, ' ').trim();
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, Number.isFinite(n) ? n : lo));
const now = () => Date.now();
function captureExternalSelection(el) {
  try {
    const sel = window.getSelection?.();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
    const a = sel.anchorNode, f = sel.focusNode;
    if ((a && el?.contains?.(a)) || (f && el?.contains?.(f))) return null;
    const ranges = [];
    for (let i = 0; i < sel.rangeCount; i++) ranges.push(sel.getRangeAt(i).cloneRange());
    return ranges;
  } catch (_) { return null; }
}
function restoreExternalSelection(ranges) {
  if (!ranges?.length) return;
  try {
    const sel = window.getSelection?.();
    if (!sel) return;
    const live = ranges.filter(r => r.startContainer?.isConnected && r.endContainer?.isConnected);
    if (!live.length) return;
    sel.removeAllRanges();
    for (const r of live) sel.addRange(r);
  } catch (_) {}
}

function focusNoScroll(el) {
  try { el?.focus?.({ preventScroll:true }); }
  catch (_) { try { el?.focus?.(); } catch (_) {} }
}

const T = { injectedText:'', injectedAt:0, beforeUsers:0 };

function budgetMinutes(){
  const raw = Number(GM_getValue(K.minutes, CFG.defaultMinutes));
  if (!Number.isFinite(raw)) return CFG.defaultMinutes;
  return clamp(Math.round(raw), 0, 60);
}
function setBudgetMinutes(value){
  const n = clamp(Number(value) || 0, 0, 60);
  GM_setValue(K.minutes, n);
  return n;
}
function isGhostManagedPrompt(text){
  return /\[GHOST CORE CONTROL\]|\[WATCHDOG RECOVERY STATUS PROBE\]|\[WEB RECOVERY STATUS PROBE\]|\[\[GITL::|\[\[AOA::|Continue the existing task from the current conversation|Protocol compliance drifted twice|You strayed from the active control protocol/i.test(String(text || ''));
}
function budgetContract(){
  const minutes = budgetMinutes();
  if (!minutes) return '';
  const wrapAt = Math.max(1, Math.round(minutes * 0.80));
  const checkpointAt = Math.max(wrapAt, Math.round(minutes * 0.90));
  let deadline='';
  try { deadline = new Date(now()+minutes*60000).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}); } catch(_){}
  return [
    '[WEB TURN BUDGET]',
    `Turn budget: about ${minutes} minutes${deadline ? `; target checkpoint by about ${deadline} local browser time` : ''}.`,
    'This is a planning deadline, not permission to hard-stop an in-flight operation.',
    `By about minute ${wrapAt} (~80%): stop opening new branches of work and start wrapping the current bounded unit.`,
    `By about minute ${checkpointAt} (~90%): finish the current safe atomic operation, verify it, record the exact checkpoint/evidence, and prepare to hand off.`,
    `At minute ${minutes}: if still BUSY, do not abandon or interrupt an in-flight side effect merely to meet the clock. Finish at the next safe boundary, then return the normal PROCEED control marker so Ghost starts a fresh turn.`,
    'Preserve fresh machine evidence and exact side-effect state. Do not weaken verification or tests to meet the budget.',
    'Do not replay, resend, or retry any action whose outcome is uncertain.'
  ].join('\n');
}
function composer(){ return q('#prompt-textarea') || q('textarea[data-id="root"]'); }
function composerText(el=composer()){ return norm(el?.innerText ?? el?.textContent ?? el?.value ?? ''); }
function usersCount(){ return qa('[data-message-author-role="user"]').filter(el=>el.isConnected).length; }
function generating(){
  const sels=['button[data-testid="stop-button"]','button[aria-label="Stop generating"]','button[aria-label="Stop streaming"]','button[aria-label*="Dừng" i]'];
  for (const sel of sels){
    let nodes=[]; try{nodes=qa(sel);}catch(_){}
    if(nodes.some(el=>el.isConnected && !!(el.offsetWidth||el.offsetHeight||el.getClientRects().length))) return true;
  }
  return false;
}
function replaceComposerSafely(el,text){
  if(!el) return false;
  const expected=norm(text), preservedSelection=captureExternalSelection(el);
  try{
    focusNoScroll(el);
    if(el.isContentEditable){
      const range=document.createRange(); range.selectNodeContents(el);
      const sel=window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
      let inserted=false; try{inserted=document.execCommand('insertText', false, text);}catch(_){}
      if(!inserted) return false;
      el.dispatchEvent(new Event('input',{bubbles:true}));
    }else{
      const proto=el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;
      const setter=Object.getOwnPropertyDescriptor(proto,'value')?.set;
      if(setter) setter.call(el,text); else el.value=text;
      el.dispatchEvent(new Event('input',{bubbles:true}));
      el.dispatchEvent(new Event('change',{bubbles:true}));
    }
  }catch(_){ return false; }
  finally{ restoreExternalSelection(preservedSelection); }
  return composerText(el)===expected;
}
function clearComposerSafely(el){
  if(!el) return false;
  const preservedSelection=captureExternalSelection(el);
  try{
    focusNoScroll(el);
    if(el.isContentEditable){
      const range=document.createRange(); range.selectNodeContents(el);
      const sel=window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
      let ok=false; try{ok=document.execCommand('delete', false);}catch(_){}
      if(!ok) return false;
      el.dispatchEvent(new Event('input',{bubbles:true}));
    }else{
      const proto=el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;
      const setter=Object.getOwnPropertyDescriptor(proto,'value')?.set;
      if(setter) setter.call(el,''); else el.value='';
      el.dispatchEvent(new Event('input',{bubbles:true}));
      el.dispatchEvent(new Event('change',{bubbles:true}));
    }
  }catch(_){ return false; }
  finally{ restoreExternalSelection(preservedSelection); }
  return composerText(el)==='';
}
function isChatGptSendButton(el){
  if(!(el instanceof Element)) return false;
  try{return el.matches('#composer-submit-button,button[data-testid="send-button"],button[aria-label="Send prompt"],button[aria-label="Send message"]');}catch(_){return false;}
}
function augmentBeforeProgrammaticSend(){
  if(!budgetMinutes()) return false;
  const el=composer();
  const current=composerText(el);
  if(!current || !isGhostManagedPrompt(current) || current.includes('[WEB TURN BUDGET]')) return false;
  const contract=budgetContract();
  if(!contract) return false;
  const augmented=`${current}\n\n${contract}`;
  if(!replaceComposerSafely(el,augmented)) return false;
  T.injectedText=norm(augmented);
  T.injectedAt=now();
  T.beforeUsers=usersCount();
  GM_setValue(K.startedAt,T.injectedAt);
  return true;
}

// Safer than v1: no direct textContent write into ChatGPT's controlled editor.
// The original Send click is still executed exactly once.
try{
  const originalClick=HTMLButtonElement.prototype.click;
  if(!originalClick.__ghostPlusBudgetV2Wrapped){
    const wrapped=function(...args){
      if(isChatGptSendButton(this)) augmentBeforeProgrammaticSend();
      return originalClick.apply(this,args);
    };
    try{Object.defineProperty(wrapped,'__ghostPlusBudgetV2Wrapped',{value:true});}catch(_){}
    RT.patch(HTMLButtonElement.prototype,'click',wrapped);
  }
}catch(_){}

function cleanupStaleInjectedDraft(){
  if(!T.injectedText) return;
  const el=composer();
  const current=composerText(el);
  const accepted=generating() || usersCount()>T.beforeUsers;
  if(!current){ T.injectedText=''; T.injectedAt=0; T.beforeUsers=0; return; }
  if(accepted && current===T.injectedText){
    clearComposerSafely(el);
    T.injectedText=''; T.injectedAt=0; T.beforeUsers=0;
    return;
  }
  if(current!==T.injectedText || now()-T.injectedAt>CFG.cleanupMs){
    T.injectedText=''; T.injectedAt=0; T.beforeUsers=0;
  }
}

function fmtElapsed(ms){
  const sec=Math.max(0,Math.floor(ms/1000));
  return `${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`;
}
function ensureUi(){
  const host=q('#ghostplus-watch'); if(!host) return null;
  let row=q('#ghostplus-turn-budget',host); if(row) return row;
  row=document.createElement('div'); row.id='ghostplus-turn-budget';
  row.style.cssText='margin-top:5px;padding-top:5px;border-top:1px solid rgba(148,163,184,.25);font-size:10px;line-height:1.35';
  row.innerHTML=`<div style="display:flex;align-items:center;justify-content:space-between;gap:6px"><span><span data-budget-dot style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#94a3b8;margin-right:4px"></span><b>Ngân sách turn</b> <span data-budget-state>chờ turn</span></span><span data-budget-elapsed>00:00</span></div><div style="display:flex;align-items:center;justify-content:space-between;gap:6px;margin-top:4px"><select data-budget-min style="font:10px system-ui;padding:3px 4px;border:1px solid rgba(148,163,184,.42);border-radius:5px;background:#fff;color:#475569"><option value="0">Tắt</option><option value="15">15 phút</option><option value="18">18 phút</option><option value="20">20 phút</option><option value="22">22 phút</option><option value="24">24 phút</option></select><span style="color:#64748b">80% wrap · 90% checkpoint · không tự Stop</span></div>`;
  host.appendChild(row);
  const select=q('[data-budget-min]',row); select.value=String(budgetMinutes());
  select.onchange=e=>{setBudgetMinutes(e.target.value);GM_setValue(K.startedAt,0);};
  return row;
}
function renderUi(){
  cleanupStaleInjectedDraft();
  const row=ensureUi(); if(!row) return;
  const minutes=budgetMinutes();
  const startedAt=Number(GM_getValue(K.startedAt,0))||0;
  const elapsed=startedAt?Math.max(0,now()-startedAt):0;
  const limit=minutes*60000;
  const state=q('[data-budget-state]',row), elapsedEl=q('[data-budget-elapsed]',row), dot=q('[data-budget-dot]',row);
  elapsedEl.textContent=startedAt?`${fmtElapsed(elapsed)} / ${minutes||0}m`:'00:00';
  dot.style.background='#94a3b8';
  if(!minutes) state.textContent='tắt';
  else if(!startedAt) state.textContent='chờ turn';
  else if(elapsed>=limit){state.textContent='quá budget · chờ safe checkpoint';dot.style.background='#ef4444';}
  else if(elapsed>=limit*.9){state.textContent='checkpoint ngay';dot.style.background='#f97316';}
  else if(elapsed>=limit*.8){state.textContent='wrap up';dot.style.background='#f59e0b';}
  else{state.textContent='ổn';dot.style.background='#10b981';}
}
RT.interval(renderUi,CFG.tickMs);
renderUi();
})();