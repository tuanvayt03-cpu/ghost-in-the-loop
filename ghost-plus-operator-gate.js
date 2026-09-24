(() => {
'use strict';
const RT=window.__ghostPlusRuntime?.module('operator-gate');if(!RT)return;
if (window.__GHOST_PLUS_OPERATOR_GATE__) return;
window.__GHOST_PLUS_OPERATOR_GATE__=true;
if (!/^(chatgpt\.com|chat\.openai\.com)$/i.test(location.hostname)) return;
const q=(s,r=document)=>r.querySelector(s), qa=(s,r=document)=>[...r.querySelectorAll(s)], norm=v=>String(v||'').replace(/\s+/g,' ').trim(), now=()=>Date.now(), sleep=ms=>RT.sleep(ms);
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

const KG='ghostplus.gates.v1', KA='ghostplus.gateAck.v1', KS='ghostplus.gateSeq.v1';
const S={key:'',gate:null,last:'',busy:false,msg:''};
function hash(v){const s=String(v||'');let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return `${s.length}:${(h>>>0).toString(16)}`}
function path(){return String(location.pathname||'/').split(/[?#]/)[0]}
function key(){const p=path(),id=p.match(/\/c\/([^/]+)/i)?.[1];return id?`c:${id}`:`p:${p}`}
function json(k){try{const v=GM_getValue(k,'{}');return typeof v==='object'?(v||{}):JSON.parse(String(v||'{}'))}catch(_){return{}}}
function put(k,v){try{GM_setValue(k,JSON.stringify(v))}catch(_){}}
function gate(k=key()){return json(KG)[k]||null}
function save(k,v){const m=json(KG);if(v)m[k]=v;else delete m[k];put(KG,m)}
function ack(k=key()){return String(json(KA)[k]?.h||'')}
function saveAck(k,h){const m=json(KA);if(h)m[k]={h,at:now()};else delete m[k];put(KA,m)}
function meta(t){return({
  HUMAN_REQUIRED:{code:'HUM',label:'HUMAN REQUIRED',short:'HUMAN',icon:'🔴'},
  MODEL_RELAY:{code:'REL',label:'MODEL RELAY',short:'RELAY',icon:'🟠'},
  CONTEXT_BOUNDARY:{code:'CTX',label:'CONTEXT LIMIT',short:'CONTEXT',icon:'🔴'},
  AUTH_ERROR:{code:'AUTH',label:'AUTH REQUIRED',short:'AUTH',icon:'🔴'},
  RECOVERY_EXHAUSTED:{code:'REC',label:'RECOVERY EXHAUSTED',short:'RECOVERY',icon:'🔴'}
}[t]||{code:'BLK',label:'OPERATOR REQUIRED',short:'BLOCKED',icon:'🔴'})}
function episode(t){let n=(Number(GM_getValue(KS,0))||0)+1;try{GM_setValue(KS,n)}catch(_){}return `${meta(t).code}-${hash(key()).split(':').pop().slice(-4).toUpperCase()}-${String(n).padStart(3,'0')}`}
function status(){return norm(q('#gitl9 .status')?.innerText||'')}
function stop(){const b=q('#gitl9 [data-a="stop"]');try{b?.click();return !!b}catch(_){return false}}
function play(){return q('#gitl9 [data-a="play"]')}
function composer(){return q('#prompt-textarea')||q('textarea[data-id="root"]')}
function ctext(el=composer()){return norm(el?.innerText??el?.textContent??el?.value??'')}
function users(){return qa('[data-message-author-role="user"]').filter(x=>x.isConnected).length}
function assistants(){return qa('[data-message-author-role="assistant"]').filter(x=>x.isConnected).length}
function latestRaw(){const a=qa('[data-message-author-role="assistant"]').filter(x=>x.isConnected);const e=a[a.length-1];return String(e?.innerText||e?.textContent||'').replace(/\u00a0/g,' ').replace(/\r/g,'').trim()}
function latest(){return norm(latestRaw())}
function modelBusy(){try{const watch=norm(q('#ghostplus-watch [data-state]')?.textContent||'');if(/ĐANG THỰC THI|BUSY/i.test(watch))return true;const sels=['button[data-testid="stop-button"]:not([data-ghostplus-sentinel])','button[aria-label="Stop generating"]:not([data-ghostplus-sentinel])','button[aria-label="Stop streaming"]:not([data-ghostplus-sentinel])'];return sels.some(sel=>qa(sel).some(x=>x.isConnected&&!!(x.offsetWidth||x.offsetHeight||x.getClientRects().length)))}catch(_){return false}}
function term(t){const l=String(t||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean).pop()||'';if(/^(\[\[GITL::HUMAN\]\]|\[\[AOA::HUMAN\]\])$/.test(l))return['human',''];if(/^(\[\[GITL::HALT\]\]|\[\[AOA::HALT\]\])$/.test(l))return['halt',''];if(/^(\[\[GITL::PROCEED\]\]|\[\[AOA::CONTINUE\]\])$/.test(l))return['proceed',''];const m=l.match(/^\[\[AOA::RELAY:([^\]]{1,80})\]\]$/);return m?['relay',m[1].trim()]:['bad','']}
function reason(t){const a=String(t||'').split(/\r?\n/);while(a.length&&/^\s*\[\[(GITL|AOA)::/.test(a[a.length-1]))a.pop();const s=norm(a.join('\n'));return s.length>320?`…${s.slice(-320)}`:s}
function chat(){try{return window.__ghostPlusCurrentChatName?.()||'ChatGPT'}catch(_){return'ChatGPT'}}
function emit(e){try{return window.__ghostPlusAlerts?.emit({chat:chat(),path:path(),...e})}catch(_){}try{GM_notification?.({title:e.title||'Ghost+',text:e.text||'',timeout:12000})}catch(_){}}
function setComposer(text){const e=composer();if(!e||ctext(e))return false;const preservedSelection=captureExternalSelection(e);try{focusNoScroll(e);if(e.isContentEditable){const r=document.createRange();r.selectNodeContents(e);const s=getSelection();s.removeAllRanges();s.addRange(r);let ok=false;try{ok=document.execCommand('insertText',false,text)}catch(_){}if(!ok)e.textContent=text;e.dispatchEvent(new Event('input',{bubbles:true}))}else{const p=e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,st=Object.getOwnPropertyDescriptor(p,'value')?.set;if(st)st.call(e,text);else e.value=text;e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}))}}catch(_){return false}finally{restoreExternalSelection(preservedSelection)}return ctext(e)===norm(text)}
function lock(type,data={}){const k=key(),h=data.h||'',old=gate(k);if(old&&old.type===type&&(!h||old.h===h)){S.gate=old;enforce();return old}const g={type,id:episode(type),since:now(),h,reason:norm(data.reason),model:norm(data.model),source:norm(data.source),transient:norm(data.transient),autoReconcile:!!data.autoReconcile,baselineUsers:Number.isFinite(data.baselineUsers)?data.baselineUsers:null,baselineAssistants:Number.isFinite(data.baselineAssistants)?data.baselineAssistants:null,faultKey:norm(data.faultKey),path:path(),chat:chat()};save(k,g);S.key=k;S.gate=g;stop();enforce();const m=meta(type);emit({id:`gate:${g.id}`,type,severity:'critical',group:'operator',title:`Ghost+ · ${m.label}`,text:`${m.label} · ${g.id}${g.reason?` · ${g.reason.slice(0,150)}`:''}`,episodeId:g.id,reason:g.reason,source:'gate'});return g}
function clear(stopped=false){const g=S.gate||gate();if(g?.h)saveAck(key(),g.h);save(key(),null);S.gate=null;S.msg=stopped?'Job stopped by operator.':'';document.documentElement.removeAttribute('data-ghostplus-gate');document.title=document.title.replace(/^[🔴🟠]\s+(HUMAN|RELAY|CONTEXT|AUTH|RECOVERY|BLOCKED)\s+·\s+/,'');const m=q('#ghostplus-mini');if(m&&m.textContent==='⚠')m.textContent='👻';render()}
function clearLegacyOperationalGate(){
  const g=S.gate||gate();
  if(!g||g.type!=='HUMAN_REQUIRED'||g.h||g.source)return false;
  const oldReason='Ô nhập đang có nội dung. Ghost+ không ghi đè recovery probe; cần kiểm tra thủ công.';
  if(norm(g.reason)!==oldReason)return false;
  const id=g.id;
  clear(false);
  S.msg=`Đã tự dọn gate cũ ${id}: draft trong ô nhập là trạng thái vận hành, không phải HUMAN.`;
  emit({id:`legacy-gate-cleared:${id}`,type:'LEGACY_OPERATIONAL_GATE_CLEARED',severity:'info',group:'operator',title:'Ghost+ cleared legacy operational gate',text:id,episodeId:id,reason:'legacy-composer-draft-gate',source:'gate',desktop:false});
  return true;
}
function clearV01513FalseTriageGate(){
  const g=S.gate||gate();
  const oldReason='Báo cáo timeout thiếu trường bắt buộc; không tự tiếp tục khi chưa phân loại được trạng thái.';
  if(!g||g.type!=='HUMAN_REQUIRED'||norm(g.reason)!==oldReason||g.source||g.transient)return false;
  const raw=latestRaw();
  if(!raw||!/\[GHOST TIMEOUT TRIAGE REPORT\]/i.test(raw))return false;
  if(!g.h||hash(raw)!==g.h)return false;
  const md='[*_`]*';
  const sm=raw.match(new RegExp('(?:^|\\n)\\s*'+md+'TRẠNG THÁI'+md+'\\s*:\\s*'+md+'(TIẾP_TỤC|TIẾP TỤC)'+md+'\\s*(?=\\n|$)','i'));
  const em=raw.match(new RegExp('(?:^|\\n)\\s*'+md+'SIDE EFFECT CHƯA XÁC MINH'+md+'\\s*:\\s*'+md+'(không)'+md+'\\s*(?=\\n|$)','i'));
  const [ty]=term(raw);
  if(!sm||!em||ty!=='proceed')return false;
  const id=g.id;
  clear(false);
  S.msg=`Đã tự dọn false HUMAN gate 15.13 ${id}; report timeout xác nhận TIẾP_TỤC an toàn.`;
  emit({id:`triage-gate-cleared:${id}`,type:'FALSE_TRIAGE_GATE_CLEARED',severity:'info',group:'operator',title:'Ghost+ cleared v0.15.13 false triage gate',text:id,episodeId:id,reason:'v0.15.13-underscore-parser',source:'gate',desktop:false});
  RT.timeout(()=>{
    if(!RT.alive()||gate()||modelBusy()||ctext())return;
    try{play()?.click()}catch(_){}
  },0);
  return true;
}
function autoReconcileTransientGate(){
  const g=S.gate||gate();
  if(!g||g.type!=='HUMAN_REQUIRED'||g.transient!=='WEB_SEND_UNCERTAIN'||!g.autoReconcile)return false;
  const latestText=latest(), [ty]=term(latestText);
  if(ty==='human'||ty==='relay')return false;
  const bu=Number.isFinite(g.baselineUsers)?g.baselineUsers:null;
  const ba=Number.isFinite(g.baselineAssistants)?g.baselineAssistants:null;
  const userAdvanced=bu!==null&&users()>bu;
  const assistantAdvanced=ba!==null&&assistants()>ba;
  const busy=modelBusy();
  if(!busy&&!userAdvanced&&!assistantAdvanced)return false;
  const why=busy?'late-generation':userAdvanced?'user-turn-advanced':'assistant-turn-advanced';
  const id=g.id;
  clear(false);
  S.msg=`Auto-reconciled ${id}: ${why}.`;
  emit({id:`gate-auto-clear:${id}`,type:'GATE_AUTO_RECONCILED',severity:'info',group:'operator',title:'Ghost+ auto-reconciled transient HUMAN',text:`${id} · ${why}`,episodeId:id,reason:why,source:'gate',desktop:false});
  if(busy){
    RT.timeout(()=>{
      if(!RT.alive()||gate()||!modelBusy())return;
      try{play()?.click()}catch(_){}
    },0);
  }
  return true;
}
function style(){if(q('#ghostplus-gate-style'))return;const s=document.createElement('style');s.id='ghostplus-gate-style';s.textContent=`html[data-ghostplus-gate] #ghostplus-mini{box-shadow:0 0 0 3px rgba(239,68,68,.6),0 8px 24px rgba(15,23,42,.18)!important;background:#fff1f2!important;color:#991b1b!important}#ghostplus-gate{margin-top:6px;padding:7px;border:1px solid rgba(239,68,68,.4);border-radius:8px;background:#fff1f2;color:#7f1d1d;font:10px/1.35 system-ui}#ghostplus-gate .r{display:flex;gap:4px;margin-top:5px}#ghostplus-gate input{min-width:0;flex:1;font:10px system-ui;padding:4px}#ghostplus-gate button{font:10px system-ui;padding:4px 6px}`;document.documentElement.appendChild(s);RT.node(s)}
function ui(){style();const h=q('#ghostplus-watch');if(!h)return null;let r=q('#ghostplus-gate',h);if(r)return r;r=document.createElement('div');r.id='ghostplus-gate';r.innerHTML=`<div><b data-t></b> <span data-id></span></div><div data-r style="margin-top:3px;max-height:54px;overflow:auto"></div><div class="r"><input data-note placeholder="Phản hồi/ghi chú"><button data-resume>Resume</button><button data-stop>Stop</button></div><div data-msg style="margin-top:3px"></div>`;h.appendChild(r);RT.node(r);q('[data-resume]',r).onclick=e=>{if(!e.isTrusted)return;resume()};q('[data-stop]',r).onclick=e=>{if(!e.isTrusted)return;stop();clear(true)};return r}
function render(){const r=ui(),g=S.gate||gate();if(!r)return;if(!g){r.style.display='none';return}S.gate=g;const m=meta(g.type);r.style.display='block';q('[data-t]',r).textContent=`${m.icon} ${m.label}`;q('[data-id]',r).textContent=g.id;q('[data-r]',r).textContent=g.model?`${g.reason||'Model relay requested'} · ${g.model}`:(g.reason||'Đang chờ người dùng.');q('[data-msg]',r).textContent=S.msg||'Auto Play/recovery đang bị khóa.'}
function enforce(){const g=S.gate||gate();if(!g)return;S.gate=g;document.documentElement.setAttribute('data-ghostplus-gate',g.type);const st=q('#gitl9 .status');if(st)st.innerHTML=`<b>PAUSED</b> · ${g.type}<br>${g.id}`;const m=q('#ghostplus-mini'),gm=meta(g.type);if(m){m.textContent='⚠';m.title=`${g.type} · ${g.id}`}const base=document.title.replace(/^[🔴🟠]\s+(HUMAN|RELAY|CONTEXT|AUTH|RECOVERY|BLOCKED)\s+·\s+/,'');document.title=`${gm.icon} ${gm.short} · ${base}`;render();guardDraft()}
function guardDraft(){if(!S.gate)return;const e=composer(),t=ctext(e);if(!/^\[(WEB|WATCHDOG) RECOVERY STATUS PROBE\]/i.test(t))return;try{if(e.isContentEditable){e.textContent='';e.dispatchEvent(new Event('input',{bubbles:true}))}else{e.value='';e.dispatchEvent(new Event('input',{bubbles:true}))}S.msg='Đã chặn recovery probe trong lúc gate khóa.';render()}catch(_){}}
async function resume(){if(S.busy)return;const g=S.gate||gate();if(!g)return;if(ctext()){S.msg='Ô nhập đang có draft. Hãy gửi/xóa draft trước khi Resume.';render();return}S.busy=true;const note=norm(q('#ghostplus-gate [data-note]')?.value||''),p=['[OPERATOR GATE RESOLVED]','A human explicitly authorized continuation.',note?`Operator response: ${note}`:'Continue from the exact paused checkpoint.','Do not restart or repeat completed work. Reconcile uncertain prior side effects before new ones.','Keep the Ghost protocol and end with exactly one valid terminal control line.'].join('\n');stop();await sleep(100);if(!RT.alive()){S.busy=false;return}if(!setComposer(p)){S.busy=false;S.msg='Không stage được resume prompt; gate vẫn khóa.';render();return}if(g.type==='RECOVERY_EXHAUSTED'){try{window.__ghostPlusWatchdog?.resetRecoveryEpisode?.()}catch(_){}}if(g.h)saveAck(key(),g.h);save(key(),null);S.gate=null;document.documentElement.removeAttribute('data-ghostplus-gate');document.title=document.title.replace(/^[🔴🟠]\s+(HUMAN|RELAY|CONTEXT|AUTH|RECOVERY|BLOCKED)\s+·\s+/,'');const b=play(),before=users();try{b?.click()}catch(_){}const start=now();let ok=false;while(now()-start<4000){if(/^RUNNING\b/i.test(status())||users()>before){ok=true;break}await sleep(200);if(!RT.alive()){S.busy=false;return}}S.busy=false;if(!ok){lock(g.type,{h:g.h,reason:g.reason,model:g.model});S.msg='Resume chưa xác nhận; gate đã khóa lại.';render()}else emit({id:`resumed:${g.id}`,type:'GATE_RESUMED',severity:'info',group:'operator',title:'Ghost+ resumed',text:g.id,episodeId:g.id,desktop:false})}
function evaluate(){const k=key();if(k!==S.key){S.key=k;S.gate=gate(k);S.last=''}if(S.gate){if(clearLegacyOperationalGate())return;if(clearV01513FalseTriageGate())return;if(autoReconcileTransientGate())return;enforce();return}if(q('#ghostplus-context-boundary-state')){lock('CONTEXT_BOUNDARY',{reason:'Context limit reached; manual handoff to a new chat is required.'});return}if(modelBusy()){render();return}const t=latest(),h=hash(t);if(t&&h!==S.last){S.last=h;const [ty,model]=term(t);if(ty==='human'&&ack(k)!==h)lock('HUMAN_REQUIRED',{h,reason:reason(t)});else if(ty==='relay'&&ack(k)!==h)lock('MODEL_RELAY',{h,reason:reason(t),model})}if(S.gate)enforce();else render()}
RT.listen(document,'click',e=>{const b=e.target instanceof Element?e.target.closest('#gitl9 [data-a="play"]'):null,g=S.gate||gate();if(!b||!g)return;e.preventDefault();e.stopImmediatePropagation();S.msg=`Play bị khóa bởi ${g.type} · ${g.id}.`;render()},true);
RT.interval(evaluate,600);
RT.cleanup(()=>{S.busy=false;document.documentElement.removeAttribute('data-ghostplus-gate');document.title=document.title.replace(/^[🔴🟠]\s+(HUMAN|RELAY|CONTEXT|AUTH|RECOVERY|BLOCKED)\s+·\s+/,'')});
window.__ghostPlusSupervisor={version:'0.15',gate:()=>S.gate||gate(),isLocked:()=>!!(S.gate||gate()),canAutoAct:()=>!(S.gate||gate()),lock,emitAlert:emit,chatKey:key};
evaluate();
})();
