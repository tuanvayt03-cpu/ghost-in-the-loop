(() => {
'use strict';
if (window.__GHOST_PLUS_UNCERTAIN_RECONCILE__) return;
window.__GHOST_PLUS_UNCERTAIN_RECONCILE__=true;
if (!/^(chatgpt\.com|chat\.openai\.com)$/i.test(location.hostname)) return;
const q=s=>document.querySelector(s), qa=s=>[...document.querySelectorAll(s)], norm=v=>String(v||'').replace(/\s+/g,' ').trim();
let last='';
function hash(v){const s=String(v||'');let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return `${s.length}:${(h>>>0).toString(16)}`}
function latest(){const a=qa('[data-message-author-role="assistant"]').filter(x=>x.isConnected),e=a[a.length-1];return norm(e?.innerText||e?.textContent||'')}
function terminal(t){const l=String(t||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean).pop()||'';if(l==='[[GITL::PROCEED]]'||l==='[[AOA::CONTINUE]]')return'proceed';if(l==='[[GITL::HALT]]'||l==='[[AOA::HALT]]')return'halt';if(l==='[[GITL::HUMAN]]'||l==='[[AOA::HUMAN]]')return'human';if(/^\[\[AOA::RELAY:/.test(l))return'relay';return'bad'}
function uncertain(){const s=norm(q('#gitl9 .status')?.innerText||'');return /^PAUSED\b/i.test(s)&&/UNCERTAIN/i.test(s)}
function click(a){try{q(`#gitl9 [data-a="${a}"]`)?.click();return true}catch(_){return false}}
function emit(e){try{window.__ghostPlusAlerts?.emit(e)}catch(_){}}
function run(){if(window.__ghostPlusSupervisor?.isLocked?.()||!uncertain())return;const t=latest();if(!t)return;const h=hash(t);if(h===last)return;const ty=terminal(t);if(ty==='bad'||ty==='human'||ty==='relay')return;last=h;if(ty==='halt'){click('stop');emit({id:`late-halt:${h}`,type:'COMPLETE',severity:'info',group:'complete',title:'Ghost complete',text:'Late HALT resolved PLAY-SEND-UNCERTAIN.',source:'uncertain',desktop:true});return}if(ty==='proceed'){click('stop');setTimeout(()=>{if(window.__ghostPlusSupervisor?.isLocked?.())return;click('play');emit({id:`late-proceed:${h}`,type:'UNCERTAIN_RESOLVED',severity:'info',group:'recovery',title:'Ghost+ uncertain resolved',text:'Late PROCEED proved the prior send was accepted; recovery probe skipped.',source:'uncertain',desktop:false})},120)}}
setInterval(run,500);run();
})();