(() => {
'use strict';

const ROOT='__ghostPlusRuntime';
const VERSION='0.15.21';
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


const CHATGPT_COMPOSER_SELECTORS=Object.freeze([
  '#prompt-textarea',
  '[data-testid="prompt-textarea"]',
  'div.ProseMirror[contenteditable="true"]',
  '[role="textbox"][contenteditable="true"]',
  'div[contenteditable="true"][data-placeholder]',
  'textarea[data-id="root"]'
]);
function domNorm(v){return String(v??'').replace(/\u00a0/g,' ').replace(/\r/g,'').replace(/\s+/g,' ').trim()}
function domTurnText(v){return String(v??'').replace(/\u00a0/g,' ').replace(/\r/g,'').replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim()}
function domReadComposer(el=domComposer()){return domNorm(el?.innerText??el?.textContent??el?.value??'')}
function domStrongIdentity(el){return !!el&&(el.id==='prompt-textarea'||el.getAttribute?.('data-testid')==='prompt-textarea')}
function domVisible(el){
  if(!el||!el.isConnected||el.disabled||el.getAttribute?.('aria-disabled')==='true'||el.getAttribute?.('aria-hidden')==='true'||el.hidden)return false;
  try{const s=getComputedStyle(el);if(s?.display==='none'||s?.visibility==='hidden')return false}catch(_){}
  try{if(el.offsetWidth||el.offsetHeight||el.getClientRects?.().length)return true}catch(_){}
  return el===document.activeElement;
}
function domSemanticHint(el){
  const hint=[
    el?.getAttribute?.('aria-label'),
    el?.getAttribute?.('placeholder'),
    el?.getAttribute?.('data-placeholder'),
    el?.getAttribute?.('data-testid')
  ].filter(Boolean).join(' ');
  return /message|prompt|ask|chat|anything|send|nhắn|tin nhắn|hỏi/i.test(hint);
}
function domComposerCandidate(el){
  if(!domVisible(el))return false;
  const editable=el?.tagName==='TEXTAREA'||el?.isContentEditable||el?.getAttribute?.('contenteditable')==='true';
  if(!editable)return false;
  try{if(el.closest('#gitl9,[id^="ghostplus-"]'))return false}catch(_){}
  const form=el.closest?.('form');
  if(!domStrongIdentity(el)&&!domSemanticHint(el)&&!form&&el!==document.activeElement)return false;
  return true;
}
function domComposerScore(el){
  let n=0;
  if(el.id==='prompt-textarea')n+=1400;
  if(el.getAttribute?.('data-testid')==='prompt-textarea')n+=1300;
  if(el.closest?.('form[data-type="unified-composer"]'))n+=650;
  if(el.closest?.('form[data-testid="composer"]'))n+=600;
  if(el.closest?.('form'))n+=250;
  if(el.getAttribute?.('role')==='textbox'&&(el.isContentEditable||el.getAttribute?.('contenteditable')==='true'))n+=320;
  if(el.classList?.contains('ProseMirror'))n+=260;
  if(el.getAttribute?.('data-placeholder'))n+=180;
  if(domSemanticHint(el))n+=220;
  if(el.tagName==='TEXTAREA')n+=120;
  if(el===document.activeElement||el.contains?.(document.activeElement))n+=160;
  try{const r=el.getBoundingClientRect?.();if(r&&Number.isFinite(r.top)&&r.top>(window.innerHeight||800)*0.45)n+=90}catch(_){}
  if(!domStrongIdentity(el)&&el.closest?.('nav,aside,[role="dialog"]'))n-=1000;
  return n;
}
function domComposerCandidates(){
  if(!/^(chatgpt\.com|chat\.openai\.com)$/i.test(location.hostname))return [];
  const seen=new Set(),out=[];
  for(const selector of CHATGPT_COMPOSER_SELECTORS){
    let nodes=[];try{nodes=[...document.querySelectorAll(selector)]}catch(_){}
    for(const el of nodes){
      if(seen.has(el)){continue}seen.add(el);
      if(domComposerCandidate(el))out.push({el,score:domComposerScore(el)});
    }
  }
  return out.sort((a,b)=>b.score-a.score);
}
function domComposer(){
  const ranked=domComposerCandidates();
  if(!ranked.length||ranked[0].score<420)return null;
  const top=ranked[0],second=ranked[1];
  if(domStrongIdentity(top.el))return top.el;
  if(second&&top.score-second.score<90)return null;
  return top.el;
}
function domCaptureSelection(el){
  try{
    const sel=window.getSelection?.();if(!sel||sel.rangeCount===0||sel.isCollapsed)return null;
    const a=sel.anchorNode,f=sel.focusNode;if((a&&el?.contains?.(a))||(f&&el?.contains?.(f)))return null;
    const ranges=[];for(let i=0;i<sel.rangeCount;i++)ranges.push(sel.getRangeAt(i).cloneRange());return ranges;
  }catch(_){return null}
}
function domRestoreSelection(ranges){
  if(!ranges?.length)return;
  try{const sel=window.getSelection?.();if(!sel)return;const live=ranges.filter(r=>r.startContainer?.isConnected&&r.endContainer?.isConnected);if(!live.length)return;sel.removeAllRanges();for(const r of live)sel.addRange(r)}catch(_){}
}
function domFocusNoScroll(el){try{el?.focus?.({preventScroll:true})}catch(_){try{el?.focus?.()}catch(_){}}}
function domWriteComposer(el,text){
  if(!el)return false;
  const preserved=domCaptureSelection(el);
  try{
    domFocusNoScroll(el);
    if(el.isContentEditable||el.getAttribute?.('contenteditable')==='true'){
      const range=document.createRange();range.selectNodeContents(el);
      const sel=window.getSelection?.();sel?.removeAllRanges?.();sel?.addRange?.(range);
      let inserted=false;try{inserted=!!document.execCommand?.('insertText',false,text)}catch(_){}
      if(!inserted){
        el.textContent=text;
        const E=typeof InputEvent==='function'?InputEvent:Event;
        el.dispatchEvent(new E('input',{bubbles:true,inputType:'insertText',data:text}));
      }else el.dispatchEvent(new Event('input',{bubbles:true}));
    }else{
      const proto=el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;
      const setter=Object.getOwnPropertyDescriptor(proto,'value')?.set;
      if(setter)setter.call(el,text);else el.value=text;
      el.dispatchEvent(new Event('input',{bubbles:true}));
      el.dispatchEvent(new Event('change',{bubbles:true}));
    }
    return true;
  }catch(_){return false}
  finally{domRestoreSelection(preserved)}
}
function domFrame(scope){
  return new Promise(resolve=>{
    if(!scope?.alive?.()){resolve(false);return}
    let settled=false;
    const done=()=>{if(settled)return;settled=true;resolve(scope.alive())};
    const id=scope.raf?.(done);
    if(id==null)done();
  });
}
async function stageComposerText(text,scope,options={}){
  if(!scope?.alive?.())return{ok:false,why:'runtime-destroyed'};
  const expected=domNorm(text),requireEmpty=!!options.requireEmpty,verifyMs=Math.max(300,Number(options.verifyMs)||1800);
  const first=domComposer();
  if(!first)return{ok:false,why:'input-missing'};
  if(requireEmpty&&domReadComposer(first))return{ok:false,why:'composer-not-empty'};
  if(!domWriteComposer(first,String(text??'')))return{ok:false,why:'write-failed'};
  await domFrame(scope);await domFrame(scope);
  const started=Date.now();let stableEl=null,stableCount=0,observed='';
  while(Date.now()-started<verifyMs){
    if(!scope.alive())return{ok:false,why:'runtime-destroyed'};
    const current=domComposer();
    if(current){
      observed=domReadComposer(current);
      if(observed===expected){
        if(current===stableEl)stableCount+=1;else{stableEl=current;stableCount=1}
        if(stableCount>=2)return{ok:true,el:current,replaced:current!==first};
      }else{stableEl=null;stableCount=0}
    }
    const alive=await scope.sleep(80);if(!alive)return{ok:false,why:'runtime-destroyed'};
  }
  return{ok:false,why:'visible-text-mismatch',expectedLength:expected.length,observedLength:observed.length};
}

const CHATGPT_TURN_SELECTOR='article[data-testid*="conversation-turn"]';
function domChatGptRole(node){
  if(!node)return'';
  const attr=String(node.getAttribute?.('data-message-author-role')||node.getAttribute?.('data-author')||node.getAttribute?.('data-turn')||'');
  if(/assistant/i.test(attr))return'assistant';
  if(/user/i.test(attr))return'user';
  const testid=String(node.getAttribute?.('data-testid')||'');
  if(/assistant/i.test(testid))return'assistant';
  if(/user/i.test(testid))return'user';
  const label=String(node.getAttribute?.('aria-label')||'');
  if(/assistant|chatgpt/i.test(label))return'assistant';
  if(/^(?:you|user)\b/i.test(label))return'user';
  let nested=null;
  try{nested=node.querySelector?.('[data-message-author-role],[data-author]')||null}catch(_){}
  if(nested&&nested!==node)return domChatGptRole(nested);
  return'';
}
function domChatGptTurnText(node){
  if(!node)return'';
  let content=node;
  try{
    content=node.querySelector?.('[data-message-author-role] .markdown')
      ||node.querySelector?.('.markdown')
      ||node.querySelector?.('[data-message-author-role],[data-author]')
      ||node;
  }catch(_){}
  return domTurnText(content?.innerText??content?.textContent??'');
}
function domChatGptTurns(){
  if(!/^(chatgpt\.com|chat\.openai\.com)$/i.test(location.hostname))return[];
  let nodes=[];
  try{nodes=[...document.querySelectorAll(CHATGPT_TURN_SELECTOR)].filter(x=>x.isConnected)}catch(_){}
  if(!nodes.length){
    try{nodes=[...document.querySelectorAll('[data-message-author-role],[data-author],[data-turn="user"],[data-turn="assistant"]')].filter(x=>x.isConnected)}catch(_){}
  }
  const rows=[];
  for(const el of nodes){
    const role=domChatGptRole(el);if(!role)continue;
    const text=domChatGptTurnText(el);if(!text)continue;
    rows.push(Object.freeze({role,text,el}));
  }
  return rows;
}
function domLatestChatGptAssistantText(){
  const rows=domChatGptTurns().filter(x=>x.role==='assistant');
  return rows.length?rows[rows.length-1].text:'';
}
function domChatGptUserCount(){return domChatGptTurns().filter(x=>x.role==='user').length}
const CHATGPT_PENDING_RE=/(đang\s+(suy nghĩ|truy vấn|tìm|phân tích|xử lý|tải|chạy|gọi|thực thi|duyệt))|\b(thinking|searching|querying|analyzing|processing|working|running|retrieving|calling\s+(a\s+)?tool|using\s+(a\s+)?tool|browsing|fetching|resuming)\b/i;
function domChatGptActivityState(){
  if(!/^(chatgpt\.com|chat\.openai\.com)$/i.test(location.hostname))return{busy:false,strong:false,reason:'unsupported-host'};
  const strongSelectors=[
    '#composer-submit-button[data-testid="stop-button"]',
    'button[data-testid="stop-button"]',
    'button[aria-label="Stop generating"]',
    'button[aria-label="Stop streaming"]',
    'button[aria-label="Stop responding"]'
  ];
  for(const selector of strongSelectors){
    let nodes=[];try{nodes=[...document.querySelectorAll(selector)]}catch(_){}
    if(nodes.some(el=>domVisible(el)&&!el.closest?.('#gitl9,[id^="ghostplus-"]')))return{busy:true,strong:true,reason:'native-stop'};
  }
  let controls=[];try{controls=[...document.querySelectorAll('button,[role="button"],[aria-label]')]}catch(_){}
  for(const control of controls){
    if(!domVisible(control)||control.closest?.('#gitl9,[id^="ghostplus-"]'))continue;
    const label=String(control.getAttribute?.('aria-label')||'');
    if(/Stop generating|Stop streaming|Stop responding|停止生成|正在思考/i.test(label))return{busy:true,strong:true,reason:'semantic-stop'};
  }

  const scopedStatusSelectors=[
    'main [role="status"]','main [aria-live="polite"]','main [aria-live="assertive"]',
    'main [data-testid*="thinking" i]','main [data-testid*="loading" i]','main [data-testid*="status" i]'
  ];
  for(const selector of scopedStatusSelectors){
    let nodes=[];try{nodes=[...document.querySelectorAll(selector)]}catch(_){}
    for(const el of nodes){
      if(!domRendered(el)||el.closest?.('#gitl9,[id^="ghostplus-"]'))continue;
      const text=domNorm(el.textContent||'');
      if(text&&text.length<=260&&CHATGPT_PENDING_RE.test(text))return{busy:true,strong:false,reason:'status:'+text.slice(0,80)};
    }
  }

  const busySelectors=['main [aria-busy="true"]','form [aria-busy="true"]','main [role="progressbar"]','main [data-testid*="spinner" i]','main [class*="animate-spin" i]'];
  for(const selector of busySelectors){
    let nodes=[];try{nodes=[...document.querySelectorAll(selector)]}catch(_){}
    if(nodes.some(el=>domRendered(el)&&!el.closest?.('#gitl9,[id^="ghostplus-"]')))return{busy:true,strong:false,reason:'progress-indicator'};
  }

  const turns=domChatGptTurns();
  const lastAssistant=[...turns].reverse().find(x=>x.role==='assistant')?.el||null;
  if(lastAssistant){
    if(lastAssistant.getAttribute?.('aria-busy')==='true'&&domRendered(lastAssistant))return{busy:true,strong:false,reason:'assistant-aria-busy'};
    let nodes=[];try{nodes=[...lastAssistant.querySelectorAll('[role="status"],[aria-live],[aria-busy="true"],[data-testid*="tool" i],[data-testid*="thinking" i],[data-testid*="loading" i],details')]}catch(_){}
    for(const el of nodes){
      if(!domRendered(el)||el.closest?.('#gitl9,[id^="ghostplus-"]'))continue;
      if(el.matches?.('.markdown,pre,code')||el.closest?.('.markdown,pre,code'))continue;
      const text=domNorm(el.textContent||'');
      if((el.getAttribute?.('aria-busy')==='true')||(text&&text.length<=260&&CHATGPT_PENDING_RE.test(text)))return{busy:true,strong:false,reason:'assistant-activity'};
    }
    let leaves=[];try{leaves=[...lastAssistant.querySelectorAll('*')].filter(el=>!el.children?.length)}catch(_){}
    for(const el of leaves){
      if(!domRendered(el)||el.closest?.('#gitl9,[id^="ghostplus-"]'))continue;
      if(el.matches?.('.markdown,pre,code')||el.closest?.('.markdown,pre,code'))continue;
      const text=domNorm(el.textContent||'');
      if(/^(?:Thinking|Đang suy nghĩ|正在思考)(?:\.{0,3})?$/i.test(text))return{busy:true,strong:false,reason:'assistant-thinking-leaf'};
    }
  }
  return{busy:false,strong:false,reason:'idle'};
}
function domIsChatGptGenerating(){return !!domChatGptActivityState().busy}

function domClassifyChatGptFaultText(text){
  const t=domNorm(text).toLowerCase();
  if(!t)return'';
  if(/resume stream unavailable|stream resume unavailable|không thể.*(?:resume|tiếp tục).*(?:stream|luồng)/i.test(t))return'STREAM_RESUME_UNAVAILABLE';
  if(/message delivery timed out|delivery timed out.*try again|timed out delivering|hết thời gian.*(?:phân phối|giao).*tin nhắn/i.test(t))return'MESSAGE_DELIVERY_TIMEOUT';
  if(/connection interrupted|kết nối bị gián đoạn|đang chờ câu trả lời hoàn chỉnh|waiting for (?:a |the )?complete response/.test(t))return'CONNECTION_INTERRUPTED';
  if(/timed out waiting to send|timeout.*send|send.*timed out|hết thời gian chờ gửi|chờ gửi tin nhắn.*quá|đã hết thời gian chờ gửi/.test(t))return'SEND_TIMEOUT';
  if(/rate limit|too many requests|quá nhiều yêu cầu|429\b/.test(t))return'RATE_LIMIT';
  if(/session expired|authentication|unauthorized|sign in again|đăng nhập lại|phiên.*hết hạn|xác thực/.test(t))return'AUTH_ERROR';
  if(/network error|network connection|connection error|lỗi mạng|mất kết nối|kết nối mạng/.test(t))return'NETWORK_ERROR';
  if(/something went wrong|error generating|generation error|đã xảy ra lỗi|có lỗi xảy ra|không thể tạo phản hồi/.test(t))return'GENERATION_ERROR';
  return'';
}
function domChatGptRetryButtons(){
  let buttons=[];try{buttons=[...document.querySelectorAll('button')]}catch(_){}
  return buttons.filter(el=>{
    if(!domRendered(el)||el.closest?.('#gitl9,[id^="ghostplus-"]'))return false;
    const t=domNorm(el.textContent||el.getAttribute?.('aria-label')||'');
    return /^(retry|try again|thử lại|thử lần nữa)$/i.test(t)||/retry|try again|thử lại/i.test(t);
  });
}
let domFaultFallbackAt=0,domFaultFallbackText='';
function domChatGptFaultFallbackText(){
  const now=Date.now();
  if(now-domFaultFallbackAt<3000)return domFaultFallbackText;
  domFaultFallbackAt=now;domFaultFallbackText='';
  const patterns=[
    /resume stream unavailable/i,
    /message delivery timed out(?:\.\s*please try again)?/i,
    /connection interrupted(?:\.|:)?\s*(?:waiting for (?:a |the )?complete response)?/i,
    /kết nối bị gián đoạn(?:\.|:)?\s*(?:đang chờ câu trả lời hoàn chỉnh)?/i,
    /a network error occurred(?:\.|:)?\s*(?:please check your connection and try again)?/i
  ];
  const root=document.querySelector?.('main')||document.body;
  try{
    if(root&&document.createTreeWalker&&typeof NodeFilter!=='undefined'){
      const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
      let node=null,seen=0;
      while((node=walker.nextNode())&&seen++<6000){
        const parent=node.parentElement;if(!parent||!domRendered(parent)||parent.closest?.('#gitl9,[id^="ghostplus-"]'))continue;
        const raw=String(node.nodeValue||'');
        for(const re of patterns){const m=raw.match(re);if(m){domFaultFallbackText=domNorm(m[0]);return domFaultFallbackText}}
      }
      return'';
    }
  }catch(_){}
  let raw='';try{raw=String(root?.textContent||'')}catch(_){}
  for(const re of patterns){const m=raw.match(re);if(m){domFaultFallbackText=domNorm(m[0]);break}}
  return domFaultFallbackText;
}
function domChatGptFaultState(){
  if(!/^(chatgpt\.com|chat\.openai\.com)$/i.test(location.hostname))return{type:'',text:'',retryVisible:false};
  const candidates=[],seen=new Set(),add=value=>{const t=domNorm(value);if(!t||t.length>900||seen.has(t))return;seen.add(t);candidates.push(t)};
  const selectors=['[role="alert"]','[role="status"]','[aria-live="assertive"]','[aria-live="polite"]','[data-testid*="error" i]','[data-testid*="toast" i]','[class*="error" i]'];
  for(const selector of selectors){
    let nodes=[];try{nodes=[...document.querySelectorAll(selector)]}catch(_){}
    for(const el of nodes)if(domRendered(el)&&!el.closest?.('#gitl9,[id^="ghostplus-"]'))add(el.textContent||'');
  }
  const retry=domChatGptRetryButtons();
  for(const btn of retry){
    add(btn.textContent||btn.getAttribute?.('aria-label')||'');
    let node=btn.parentElement;
    for(let depth=0;node&&depth<4;depth++,node=node.parentElement)add(node.textContent||'');
  }
  add(domChatGptFaultFallbackText());
  for(const text of candidates){
    const type=domClassifyChatGptFaultText(text);
    if(type)return{type,text,retryVisible:retry.length>0};
  }
  return{type:'',text:'',retryVisible:retry.length>0};
}

function domRendered(el){
  if(!el||!el.isConnected||el.getAttribute?.('aria-hidden')==='true'||el.hidden)return false;
  try{const s=getComputedStyle(el);if(s?.display==='none'||s?.visibility==='hidden')return false}catch(_){}
  try{if(el.offsetWidth||el.offsetHeight||el.getClientRects?.().length)return true}catch(_){}
  return el===document.activeElement;
}
function domChatGptSendMeta(el){
  const testid=String(el?.getAttribute?.('data-testid')||'').trim();
  const label=String(el?.getAttribute?.('aria-label')||'').trim();
  const title=String(el?.getAttribute?.('title')||'').trim();
  const text=String(el?.textContent||'').replace(/\s+/g,' ').trim();
  const type=String(el?.getAttribute?.('type')||'').toLowerCase();
  const id=String(el?.id||'');
  const semantic=[testid,label,title,text].filter(Boolean).join(' ');
  const stop=testid==='stop-button'||/(?:^|\b)(?:stop|stop generating|stop streaming|stop responding|dừng|停止生成|中止)(?:\b|$)/i.test(semantic);
  const send=id==='composer-submit-button'
    ||testid==='send-button'
    ||type==='submit'
    ||/^(?:send(?: prompt| message)?|submit|gửi(?: tin nhắn)?|发送(?:消息|提示)?|提交)$/i.test(label)
    ||/^(?:send|submit|gửi|发送|提交)$/i.test(text);
  return{send:send&&!stop,stop,testid,label,title,text,type,id,semantic};
}
function domChatGptSendRoot(){
  const composer=domComposer();if(!composer)return null;
  const form=composer.closest?.('form');if(form)return form;
  let fallback=null,node=composer;
  for(let depth=0;node&&depth<10;depth++,node=node.parentElement){
    try{
      if(node.matches?.('[data-type="unified-composer"],[data-testid*="composer" i]'))return node;
      if(node.querySelector?.('#composer-submit-button,button[data-testid="send-button"],button[data-testid="stop-button"],button[aria-label="Send"],button[aria-label="Send prompt"],button[aria-label="Send message"],button[aria-label="Stop generating"],button[aria-label="Stop streaming"],button[type="submit"]'))return node;
      if(!fallback&&[...node.querySelectorAll?.('button')||[]].some(domRendered))fallback=node;
    }catch(_){}
  }
  return fallback||composer.parentElement||null;
}
const CHATGPT_SEND_SELECTORS=Object.freeze([
  '#composer-submit-button',
  'button[data-testid="send-button"]',
  'button[aria-label="Send prompt"]',
  'button[aria-label="Send message"]',
  'button[aria-label="Send"]',
  'button[aria-label="Submit"]',
  'button[aria-label="Gửi"]',
  'button[aria-label="Gửi tin nhắn"]',
  'button[aria-label="发送"]',
  'button[aria-label="发送消息"]',
  'button[type="submit"]'
]);
const CHATGPT_STOP_SELECTORS=Object.freeze([
  '#composer-submit-button[data-testid="stop-button"]',
  'button[data-testid="stop-button"]',
  'button[aria-label="Stop generating"]',
  'button[aria-label="Stop streaming"]',
  'button[aria-label="Stop responding"]',
  'button[aria-label="Dừng"]'
]);
const CHATGPT_AUX_CONTROL_RE=/(attach|upload|microphone|voice|record|dictat|camera|image|file|tool|search|browse|model|reason|canvas|plus|add files?|audio|settings?|temporary chat)/i;
function domChatGptStopGlyph(el){
  if(!el)return false;
  const meta=domChatGptSendMeta(el);
  if(meta.stop)return true;
  try{
    if(el.querySelector('[data-icon="stop"],[data-testid*="stop" i],svg[aria-label*="Stop" i]'))return true;
    const rects=[...el.querySelectorAll('svg rect')];
    if(rects.some(r=>{
      const w=Number(r.getAttribute('width')),h=Number(r.getAttribute('height'));
      return Number.isFinite(w)&&Number.isFinite(h)&&w>=5&&h>=5&&Math.abs(w-h)<=2;
    }))return true;
    const blocks=[...el.querySelectorAll('span,div')];
    if(blocks.some(x=>{
      const cls=String(x.className||'');
      return /(?:^|\s)(?:size-[234]|h-[234]\s+w-[234]|w-[234]\s+h-[234])(?:\s|$)/.test(cls)&&/(?:bg-current|bg-token-text)/.test(cls);
    }))return true;
  }catch(_){}
  return false;
}
function domChatGptAuxControl(el){
  const meta=domChatGptSendMeta(el);
  return CHATGPT_AUX_CONTROL_RE.test(meta.semantic)&&!meta.send&&!meta.stop;
}
function domChatGptPrimaryFallback(root=domChatGptSendRoot()){
  const composer=domComposer();
  if(!root||!composer)return null;
  let buttons=[];try{buttons=[...root.querySelectorAll('button')]}catch(_){}
  const cr=(()=>{try{return composer.getBoundingClientRect?.()||null}catch(_){return null}})();
  const ranked=[];
  for(let i=0;i<buttons.length;i++){
    const el=buttons[i];
    if(!domRendered(el)||el.closest?.('#gitl9,[id^="ghostplus-"]')||domChatGptAuxControl(el))continue;
    const meta=domChatGptSendMeta(el);
    let score=0;
    if(meta.id==='composer-submit-button')score+=2200;
    if(meta.testid==='stop-button'||meta.testid==='send-button')score+=2100;
    if(meta.stop||meta.send)score+=1600;
    if(meta.type==='submit')score+=1200;
    if(domChatGptStopGlyph(el))score+=1100;
    const iconOnly=!meta.text&&!!el.querySelector?.('svg');
    if(iconOnly)score+=450;
    try{
      const r=el.getBoundingClientRect?.();
      if(r&&cr&&Number.isFinite(r.left)&&Number.isFinite(cr.right)){
        const dx=Math.abs(r.right-cr.right),dy=Math.abs((r.top+r.bottom)/2-(cr.top+cr.bottom)/2);
        if(dx<=140)score+=260;
        if(dy<=100)score+=180;
        if(r.width>=24&&r.width<=64&&r.height>=24&&r.height<=64)score+=160;
      }
    }catch(_){}
    score+=Math.min(i,30);
    if(score>=500)ranked.push({el,meta,score});
  }
  ranked.sort((a,b)=>b.score-a.score);
  if(!ranked.length)return null;
  const top=ranked[0],second=ranked[1];
  if(second&&top.score-second.score<120&&!top.meta.send&&!top.meta.stop&&!domChatGptStopGlyph(top.el))return null;
  return top;
}
function domChatGptSendCandidates(){
  if(!/^(chatgpt\.com|chat\.openai\.com)$/i.test(location.hostname))return[];
  const root=domChatGptSendRoot();if(!root)return[];
  const seen=new Set(),out=[];
  for(const selector of CHATGPT_SEND_SELECTORS){
    let nodes=[];try{nodes=[...root.querySelectorAll(selector)]}catch(_){}
    for(const el of nodes){
      if(seen.has(el)){continue}seen.add(el);
      if(!domRendered(el))continue;
      const meta=domChatGptSendMeta(el);
      if(meta.stop||!meta.send)continue;
      let score=0;
      if(meta.id==='composer-submit-button')score+=1400;
      if(meta.testid==='send-button')score+=1300;
      if(/^Send prompt$/i.test(meta.label))score+=800;
      if(/^Send message$/i.test(meta.label))score+=780;
      if(/^(?:Send|Submit|Gửi|Gửi tin nhắn|发送|发送消息)$/i.test(meta.label))score+=700;
      if(meta.type==='submit')score+=450;
      out.push({el,meta,score});
    }
  }
  const fallback=domChatGptPrimaryFallback(root);
  if(fallback&&!seen.has(fallback.el)&&!domChatGptStopGlyph(fallback.el)){
    const meta=domChatGptSendMeta(fallback.el);
    const composerHasText=!!domReadComposer();
    if(meta.send||composerHasText)out.push({el:fallback.el,meta:{...meta,send:true,stop:false},score:Math.max(900,fallback.score)});
  }
  return out.sort((a,b)=>b.score-a.score);
}
function domChatGptExplicitStop(root=domChatGptSendRoot()){
  if(!root)return null;
  for(const selector of CHATGPT_STOP_SELECTORS){
    let nodes=[];try{nodes=[...root.querySelectorAll(selector)]}catch(_){}
    const el=nodes.find(domRendered);if(el)return el;
  }
  const fallback=domChatGptPrimaryFallback(root);
  if(fallback&&domChatGptStopGlyph(fallback.el))return fallback.el;
  return null;
}
function domChatGptHostControlState(){
  if(!/^(chatgpt\.com|chat\.openai\.com)$/i.test(location.hostname))return{mode:'unsupported',busy:false,ready:false,found:false,why:'unsupported-host',el:null};
  const composer=domComposer();
  if(!composer)return{mode:'missing',busy:false,ready:false,found:false,why:'composer-missing',el:null};
  const root=domChatGptSendRoot();
  const stopEl=domChatGptExplicitStop(root);
  if(stopEl)return{mode:'stop',busy:true,ready:false,found:true,why:'host-stop-control',el:stopEl,source:'control'};
  const activity=domChatGptActivityState();
  const ranked=domChatGptSendCandidates();
  if(ranked.length){
    const top=ranked[0],el=top.el;
    const disabled=!!el.disabled,ariaDisabled=el.getAttribute?.('aria-disabled')==='true';
    if(activity.busy)return{
      mode:'busy',busy:true,ready:false,found:true,why:'activity-busy-with-send-control',
      activityReason:activity.reason,el,source:'activity',disabled,ariaDisabled,score:top.score
    };
    return{
      mode:'send',busy:false,ready:domRendered(el)&&!disabled&&!ariaDisabled,found:true,
      why:disabled||ariaDisabled?'send-not-ready':'send-ready',el,source:'control',
      disabled,ariaDisabled,score:top.score
    };
  }
  if(activity.busy)return{mode:'busy',busy:true,ready:false,found:false,why:'activity-busy',activityReason:activity.reason,el:null,source:'activity'};
  return{mode:'uncertain',busy:false,ready:false,found:false,why:'host-control-unresolved',el:null,source:'none'};
}
function domChatGptSendState(){
  const state=domChatGptHostControlState();
  return{
    found:!!state.found,ready:state.mode==='send'&&!!state.ready,mode:state.mode,
    why:state.why,el:state.el||null,disabled:!!state.disabled,ariaDisabled:!!state.ariaDisabled,
    score:Number(state.score)||0,busy:!!state.busy,activityReason:state.activityReason||''
  };
}
function domIsChatGptSendControl(el){
  if(!el||!el.isConnected)return false;
  const state=domChatGptHostControlState();
  return state.mode==='send'&&state.el===el;
}
async function domWaitChatGptHostControl(scope,options={}){
  if(!scope?.alive?.())return{ok:false,why:'runtime-destroyed',mode:'missing',busy:false,ready:false};
  const timeoutMs=Math.max(300,Number(options.timeoutMs)||8000),started=Date.now();
  let last=domChatGptHostControlState();
  while(Date.now()-started<timeoutMs){
    if(!scope.alive())return{ok:false,why:'runtime-destroyed',mode:'missing',busy:false,ready:false};
    last=domChatGptHostControlState();
    if(last.mode==='stop'||last.mode==='busy'||last.mode==='send')return{ok:true,...last,waitedMs:Date.now()-started};
    const alive=await scope.sleep(100);if(!alive)return{ok:false,why:'runtime-destroyed',mode:'missing',busy:false,ready:false};
  }
  return{ok:false,...last,waitedMs:Date.now()-started};
}
async function domWaitChatGptSendReady(scope,options={}){
  if(!scope?.alive?.())return{ok:false,why:'runtime-destroyed',found:false,ready:false};
  const expected=domNorm(options.expectedText||''),timeoutMs=Math.max(500,Number(options.timeoutMs)||10000);
  const started=Date.now();let last=domChatGptHostControlState();
  while(Date.now()-started<timeoutMs){
    if(!scope.alive())return{ok:false,why:'runtime-destroyed',found:false,ready:false};
    if(expected&&domReadComposer()!==expected)return{ok:false,why:'composer-changed',found:false,ready:false,mode:'uncertain'};
    last=domChatGptHostControlState();
    if(last.mode==='stop'||last.mode==='busy')return{ok:false,...last,waitedMs:Date.now()-started};
    if(last.mode==='send'&&last.ready)return{ok:true,...last,waitedMs:Date.now()-started};
    const alive=await scope.sleep(100);if(!alive)return{ok:false,why:'runtime-destroyed',found:false,ready:false};
  }
  return{ok:false,...last,why:last.why||'send-control-unresolved',waitedMs:Date.now()-started};
}
async function domClearComposerIfExact(expectedText,scope,options={}){
  if(!scope?.alive?.())return{ok:false,why:'runtime-destroyed'};
  const expected=domNorm(expectedText||''),el=domComposer();
  if(!el)return{ok:false,why:'composer-missing'};
  if(domReadComposer(el)!==expected)return{ok:false,why:'composer-changed'};
  if(!domWriteComposer(el,''))return{ok:false,why:'clear-failed'};
  const timeoutMs=Math.max(250,Number(options.verifyMs)||1200),started=Date.now();
  while(Date.now()-started<timeoutMs){
    if(!scope.alive())return{ok:false,why:'runtime-destroyed'};
    if(domReadComposer()==='')return{ok:true,why:'cleared'};
    const alive=await scope.sleep(80);if(!alive)return{ok:false,why:'runtime-destroyed'};
  }
  return{ok:false,why:'clear-unconfirmed'};
}
function domActuateChatGptSend(expectedText=''){
  const expected=domNorm(expectedText);
  if(expected&&domReadComposer()!==expected)return{ok:false,attempted:false,why:'composer-changed'};
  const state=domChatGptHostControlState();
  if(state.mode==='stop'||state.mode==='busy')return{ok:false,attempted:false,why:'generation-active',mode:state.mode,activityReason:state.activityReason||state.why};
  if(state.mode!=='send'||!state.ready||!state.el)return{ok:false,attempted:false,why:state.why||'send-not-ready',mode:state.mode};
  if(!domIsChatGptSendControl(state.el))return{ok:false,attempted:false,why:'send-control-identity-lost'};
  try{state.el.click();return{ok:true,attempted:true,why:'clicked'}}catch(error){return{ok:false,attempted:true,why:'click-threw',error:String(error?.message||error)}}
}
const dom=Object.freeze({
  composer:domComposer,
  composerCandidates:domComposerCandidates,
  readComposer:domReadComposer,
  stageComposerText,
  chatgptTurns:domChatGptTurns,
  latestChatgptAssistantText:domLatestChatGptAssistantText,
  chatgptUserCount:domChatGptUserCount,
  chatgptActivityState:domChatGptActivityState,
  isChatgptGenerating:domIsChatGptGenerating,
  classifyChatgptFaultText:domClassifyChatGptFaultText,
  chatgptFaultState:domChatGptFaultState,
  chatgptHostControlState:domChatGptHostControlState,
  chatgptSendState:domChatGptSendState,
  waitChatgptHostControl:domWaitChatGptHostControl,
  waitChatgptSendReady:domWaitChatGptSendReady,
  clearComposerIfExact:domClearComposerIfExact,
  actuateChatgptSend:domActuateChatGptSend,
  isChatgptSendControl:domIsChatGptSendControl
});

const runtime=Object.freeze({
  version:VERSION,generation:seq,get active(){return active},module:makeScope,destroy,diagnostics,dom
});
window[ROOT]=runtime;
})();
