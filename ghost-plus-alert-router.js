(() => {
'use strict';
const RT=window.__ghostPlusRuntime?.module('alert-router');if(!RT)return;
if(window.__GHOST_PLUS_ALERT_ROUTER__)return;window.__GHOST_PLUS_ALERT_ROUTER__=true;
const raw=typeof GM_notification==='function'?GM_notification:null,subs=new Set(),seen=new Map(),groupSeen=new Map();
const n=v=>String(v||'').replace(/\s+/g,' ').trim(),now=()=>Date.now(),path=()=>String(location.pathname||'/').split(/[?#]/)[0];
function chat(){try{const p=path(),id=p.match(/\/c\/([^/]+)/i)?.[1]||'';for(const a of document.querySelectorAll('a[href]')){const h=String(a.getAttribute('href')||'').split(/[?#]/)[0];if(h!==p&&!(id&&h.includes('/c/'+id)))continue;const t=n(a.getAttribute('title')||a.getAttribute('aria-label')||a.textContent);if(t&&!/^(chatgpt|new chat)$/i.test(t))return t.slice(0,72)}const t=n(document.title).replace(/^[🔴🟠🟡🟢⚠️\s]+/,'').replace(/\s*[-|·]\s*ChatGPT\s*$/i,'');return t|| (id?'chat '+id.slice(0,8):'ChatGPT')}catch(_){return'ChatGPT'}}
function classify(title,text){const t=(title+' '+text).toLowerCase();if(/human decision|human required|cần người dùng|human gate/.test(t))return['HUMAN_REQUIRED','critical','operator'];if(/model relay/.test(t))return['MODEL_RELAY','critical','operator'];if(/context.*too long|conversation too long|maximum context|đoạn chat quá dài/.test(t))return['CONTEXT_BOUNDARY','critical','context'];if(/authentication|auth error|xác thực|đăng nhập/.test(t))return['AUTH_ERROR','critical','hard-error'];if(/rate limit|429|too many requests/.test(t))return['RATE_LIMIT','warning','hard-error'];if(/recovery budget|kiểm tra thủ công|manual check/.test(t))return['RECOVERY_EXHAUSTED','critical','recovery'];if(/vẫn báo busy|meaningful progress|idle\/stalled|nghi treo/.test(t))return['STALL_WARNING','warning','stall'];if(/ghost complete|task complete|returned halt/.test(t))return['COMPLETE','info','complete'];return['GENERAL','info','general']}
function dispatch(e={}){const x=Object.freeze({id:e.id||path()+':'+(e.type||'GENERAL')+':'+now(),type:e.type||'GENERAL',severity:e.severity||'info',group:e.group||'general',title:n(e.title||'Ghost+'),text:n(e.text||''),reason:n(e.reason||''),chat:e.chat||chat(),path:e.path||path(),episodeId:e.episodeId||'',source:e.source||'structured',at:Number(e.at)||now(),data:e.data||null});for(const f of [...subs])try{f(x)}catch(_){};try{window.dispatchEvent(new CustomEvent('ghostplus:alert',{detail:x}))}catch(_){};return x}
function desktop(e){if(!raw)return;const key=[e.path,e.type,e.episodeId,e.text||e.reason].join('|'),ttl=e.severity==='critical'?8000:30000,gttl=e.severity==='critical'?1800:900;if(now()-(seen.get(key)||0)<ttl)return;if(now()-(groupSeen.get(e.group)||0)<gttl)return;seen.set(key,now());groupSeen.set(e.group,now());try{raw({title:e.title+' · '+e.chat,text:e.text||e.reason||e.type,timeout:e.severity==='critical'?12000:8000})}catch(_){}}
function emit(e={}){const x=dispatch(e);if(e.desktop!==false&&!e.silent)desktop(x);return x}
function subscribe(f){if(typeof f!=='function')return()=>{};subs.add(f);return()=>subs.delete(f)}
function legacy(d,done){const o=typeof d==='string'?{title:'Ghost+',text:d}:{...(d||{})},c=classify(n(o.title),n(o.text||o.message)),x=dispatch({type:c[0],severity:c[1],group:c[2],title:n(o.title||'Ghost+'),text:n(o.text||o.message),source:'legacy'});desktop(x);try{if(typeof done==='function')RT.timeout(done,0)}catch(_){}}
window.__ghostPlusAlerts={emit,subscribe,currentChatName:chat};window.__ghostPlusCurrentChatName=chat;window.__ghostPlusNotify=legacy;
let installed=false;
try{GM_notification=legacy;installed=true}catch(_){try{globalThis.GM_notification=legacy;installed=true}catch(_){}}
RT.cleanup(()=>{
  subs.clear();seen.clear();groupSeen.clear();
  if(installed){
    try{if(GM_notification===legacy)GM_notification=raw}catch(_){try{if(globalThis.GM_notification===legacy)globalThis.GM_notification=raw}catch(_){}}
  }
});
})();