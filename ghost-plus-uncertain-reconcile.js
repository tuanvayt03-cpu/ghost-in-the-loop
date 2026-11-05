(() => {
'use strict';
const RT=window.__ghostPlusRuntime?.module('uncertain-reconcile');if(!RT)return;
if (window.__GHOST_PLUS_UNCERTAIN_RECONCILE__) return;
window.__GHOST_PLUS_UNCERTAIN_RECONCILE__=true;
if (!/^(chatgpt\.com|chat\.openai\.com)$/i.test(location.hostname)) return;
const q=s=>document.querySelector(s), qa=s=>[...document.querySelectorAll(s)], norm=v=>String(v||'').replace(/\s+/g,' ').trim();
let last='';
function hash(v){const s=String(v||'');let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return `${s.length}:${(h>>>0).toString(16)}`}
function latest(){const shared=window.__ghostPlusRuntime?.dom?.latestChatgptAssistantText;if(shared)return String(shared()||'').replace(/\u00a0/g,' ').replace(/\r/g,'').trim();const a=qa('[data-message-author-role="assistant"]').filter(x=>x.isConnected),e=a[a.length-1];return String(e?.innerText||e?.textContent||'').replace(/\u00a0/g,' ').replace(/\r/g,'').trim()}
function terminal(t){const l=String(t||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean).pop()||'';if(l==='[[GITL::PROCEED]]'||l==='[[AOA::CONTINUE]]')return'proceed';if(l==='[[GITL::HALT]]'||l==='[[AOA::HALT]]')return'halt';if(l==='[[GITL::HUMAN]]'||l==='[[AOA::HUMAN]]')return'human';if(/^\[\[AOA::RELAY:/.test(l))return'relay';return'bad'}
function uncertain(){const s=norm(q('#gitl9 .status')?.innerText||'');return /^PAUSED\b/i.test(s)&&/UNCERTAIN/i.test(s)}
function click(a){try{q(`#gitl9 [data-a="${a}"]`)?.click();return true}catch(_){return false}}
function emit(e){try{window.__ghostPlusAlerts?.emit(e)}catch(_){}}
function run(){
  if(window.__ghostPlusSupervisor?.isLocked?.()||!uncertain())return;
  const journal=window.__ghostCoreSendJournal;
  // An old assistant terminal is NOT evidence of this uncertain Send.
  // Only a post-attempt matching user-turn receipt can unlock reconciliation.
  if(journal?.hasUnresolved?.()){
    if(!journal.reconcile?.())return;
  }
  const entry=journal?.latest?.();
  if(!entry||entry.stage!=='CONFIRMED'||!entry.lateReconciled)return;
  const turns=window.__ghostPlusRuntime?.dom?.chatgptTurns?.();
  const currentAssistants=Array.isArray(turns)?turns.filter(x=>x.role==='assistant').length:0;
  if(currentAssistants<=entry.beforeAssistants)return;
  const t=latest();if(!t)return;
  const h=hash(t);if(h===last)return;
  const ty=terminal(t);
  if(ty==='bad'||ty==='human'||ty==='relay')return;
  last=h;
  if(ty==='halt'){
    click('stop');
    emit({id:`late-halt:${h}`,type:'COMPLETE',severity:'info',group:'complete',
      title:'Ghost complete',text:'Confirmed late Send receipt followed by a new HALT turn.',source:'uncertain',desktop:true});
    return;
  }
  if(ty==='proceed'){
    click('stop');
    RT.timeout(()=>{
      if(!RT.alive()||window.__ghostPlusSupervisor?.isLocked?.())return;
      click('play');
      emit({id:`late-proceed:${h}`,type:'UNCERTAIN_RESOLVED',severity:'info',group:'recovery',
        title:'Ghost+ uncertain resolved',text:'Matching late Send receipt and new assistant terminal confirmed.',source:'uncertain',desktop:false});
    },120);
  }
}
RT.interval(run,500);run();
})();