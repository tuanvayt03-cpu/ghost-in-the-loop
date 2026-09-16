(() => {
'use strict';
if (window.__GHOST_PLUS__) return;
window.__GHOST_PLUS__ = true;
if (!/^(chatgpt\.com|chat\.openai\.com)$/i.test(location.hostname)) return;

const CFG = { tick:1000, grace:30000, stopVerify:20000, ghostRestartVerify:10000, defaultSec:300 };
const K = { collapsed:'ghostplus.collapsed', timeout:'ghostplus.timeout', auto:'ghostplus.auto' };
const S = {
  collapsed: !!GM_getValue(K.collapsed,false),
  timeout: Math.max(0, Math.min(3600, Number(GM_getValue(K.timeout,CFG.defaultSec)) || CFG.defaultSec)),
  auto: GM_getValue(K.auto,true) !== false,
  lastSig:'', lastActivity:Date.now(), suspectAt:0, recovering:false, timer:null, lastPanelRect:null,
  lastRecoverySig:''
};
const q=(s,r=document)=>r.querySelector(s), qa=(s,r=document)=>[...r.querySelectorAll(s)];
const visible=e=>!!e&&e.isConnected&&!e.disabled&&e.getAttribute('aria-disabled')!=='true'&&!!(e.offsetWidth||e.offsetHeight||e.getClientRects().length);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const hash=v=>{const s=String(v||'');let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return `${s.length}:${(h>>>0).toString(16)}`;};
const fmt=ms=>{const s=Math.max(0,Math.floor(ms/1000));return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;};
function notice(title,text){try{GM_notification?.({title,text,timeout:9000});}catch(_){}}
function panel(){return q('#gitl9');}
function ghostStatus(){return (q('#gitl9 .status')?.innerText||'').trim();}
function ghostRunning(){return /^RUNNING\b/i.test(ghostStatus());}
function ghostUncertain(){return /UNCERTAIN/i.test(ghostStatus());}
function ghostStop(){return q('#gitl9 [data-a="stop"]');}
function ghostPlay(){return q('#gitl9 [data-a="play"]');}
function stopButtons(){const sels=['button[data-testid="stop-button"]','button[aria-label="Stop generating"]','button[aria-label="Stop streaming"]'];const out=[],seen=new Set();for(const s of sels)for(const e of qa(s))if(visible(e)&&!seen.has(e)){seen.add(e);out.push(e);}return out;}
function generating(){return stopButtons().length>0;}
function assistants(){return qa('[data-message-author-role="assistant"]').filter(e=>e.isConnected);}
function users(){return qa('[data-message-author-role="user"]').filter(e=>e.isConnected);}
function composer(){return q('#prompt-textarea')||q('textarea[data-id="root"]');}
function composerText(){const e=composer();return String(e?.innerText??e?.textContent??e?.value??'').trim();}
function signature(){const a=assistants();const last=a[a.length-1];const text=last?(last.innerText||last.textContent||''):'';const tools=last?qa('[data-testid*="tool" i],[class*="tool" i],details,[role="status"]',last).map(x=>(x.innerText||x.textContent||'').trim()).join('|'):'';return [generating()?'G1':'G0',`U${users().length}`,`A${a.length}`,hash(text),hash(tools)].join('|');}
function mark(){S.lastActivity=Date.now();S.suspectAt=0;}

function recoveryPrompt(){return [
  '[WATCHDOG RECOVERY STATUS PROBE]',
  'The previous ChatGPT web turn became inactive or was interrupted before a trustworthy terminal outcome was observed.',
  'Reconcile first. Do not assume any in-flight tool call, external action, write, send, order, or side effect succeeded or failed.',
  'Inspect the current conversation plus fresh machine/tool state and the latest verified checkpoint.',
  'Classify the situation internally as RESUMABLE, BLOCKED, COMPLETE, or UNKNOWN_SIDE_EFFECT.',
  'If RESUMABLE: continue the existing task now from the latest verified checkpoint without repeating completed work.',
  'If BLOCKED: explain the genuine blocker and request human input.',
  'If COMPLETE: preserve the completed result and finish.',
  'If UNKNOWN_SIDE_EFFECT: do NOT replay/resend/retry that side effect; reconcile evidence first, and request human input if certainty cannot be restored.',
  'Do not merely report the classification when safe progress is possible. Continue the existing goal.',
  'Keep the active Ghost control protocol in force and end with exactly one valid Ghost terminal control line.'
].join('\n');}

async function setComposerText(text){
  const e=composer(); if(!e) return false;
  try{
    e.focus();
    if(e.isContentEditable){
      const range=document.createRange(); range.selectNodeContents(e);
      const sel=window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
      let inserted=false; try{inserted=document.execCommand('insertText',false,text);}catch(_){}
      if(!inserted){e.textContent=text;e.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:text}));}
      else e.dispatchEvent(new Event('input',{bubbles:true}));
    }else{
      const proto=e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;
      const setter=Object.getOwnPropertyDescriptor(proto,'value')?.set;
      if(setter)setter.call(e,text);else e.value=text;
      e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));
    }
  }catch(_){return false;}
  await sleep(120);
  return composerText().replace(/\s+/g,' ').trim()===String(text).replace(/\s+/g,' ').trim();
}

function addStyle(){if(q('#ghostplus-style'))return;const st=document.createElement('style');st.id='ghostplus-style';st.textContent=`
#gitl9{background:rgba(248,250,252,.90)!important;color:#26343d!important;border:1px solid rgba(148,163,184,.38)!important;box-shadow:0 10px 34px rgba(15,23,42,.16)!important;backdrop-filter:blur(14px) saturate(1.06)!important;-webkit-backdrop-filter:blur(14px) saturate(1.06)!important}
#gitl9 .meta,#gitl9 .tiny{color:#64748b!important;opacity:.92!important}#gitl9 .status{background:rgba(255,255,255,.72)!important;color:#26343d!important;border:1px solid rgba(148,163,184,.22)!important}
#gitl9 button{background:rgba(255,255,255,.78)!important;color:#334155!important;border-color:rgba(148,163,184,.40)!important}#gitl9 button:hover{background:rgba(241,245,249,.98)!important}#gitl9 button.on{background:rgba(209,250,229,.92)!important;border-color:rgba(16,185,129,.48)!important;color:#065f46!important}#gitl9 button.stop{background:rgba(254,226,226,.88)!important;border-color:rgba(239,68,68,.38)!important;color:#991b1b!important}
#gitl9 label{background:rgba(255,255,255,.62)!important;border-color:rgba(148,163,184,.30)!important;color:#334155!important}#gitl9 input{background:rgba(255,255,255,.86)!important;color:#334155!important;border-color:rgba(148,163,184,.42)!important}
#ghostplus-collapse{position:fixed;z-index:2147483647;width:24px;height:24px;border:1px solid rgba(148,163,184,.42);border-radius:7px;background:rgba(255,255,255,.88);color:#475569;box-shadow:0 3px 10px rgba(15,23,42,.10);cursor:pointer;font:700 15px/20px system-ui;padding:0}
#ghostplus-mini{position:fixed;z-index:2147483647;width:46px;height:46px;display:none;place-items:center;border:1px solid rgba(148,163,184,.42);border-radius:12px;background:rgba(248,250,252,.92);color:#334155;box-shadow:0 8px 24px rgba(15,23,42,.16);backdrop-filter:blur(14px);cursor:pointer;font:22px/1 system-ui;padding:0}
#ghostplus-mini.run{box-shadow:0 0 0 2px rgba(16,185,129,.35),0 8px 24px rgba(15,23,42,.16)}#ghostplus-mini.warn{box-shadow:0 0 0 2px rgba(245,158,11,.48),0 8px 24px rgba(15,23,42,.16)}
#ghostplus-watch{position:fixed;z-index:2147483647;padding:6px 7px;border:1px solid rgba(148,163,184,.34);border-radius:9px;background:rgba(248,250,252,.91);color:#475569;box-shadow:0 6px 18px rgba(15,23,42,.10);backdrop-filter:blur(12px);font:10px/1.3 system-ui}
#ghostplus-watch .r{display:flex;align-items:center;justify-content:space-between;gap:6px}#ghostplus-watch select{font:10px system-ui;padding:2px 3px;border:1px solid rgba(148,163,184,.42);border-radius:5px;background:#fff;color:#475569}#ghostplus-watch label{display:flex;align-items:center;gap:3px}.gp-dot{width:7px;height:7px;border-radius:50%;background:#94a3b8;display:inline-block;margin-right:4px}.gp-dot.ok{background:#10b981}.gp-dot.warn{background:#f59e0b}.gp-dot.bad{background:#ef4444}
`;document.documentElement.appendChild(st);}
function controls(){let c=q('#ghostplus-collapse');if(!c){c=document.createElement('button');c.id='ghostplus-collapse';c.textContent='−';c.title='Thu nhỏ Ghost';c.onclick=()=>collapse(true);document.documentElement.appendChild(c);}let m=q('#ghostplus-mini');if(!m){m=document.createElement('button');m.id='ghostplus-mini';m.textContent='👻';m.title='Mở Ghost';m.onclick=()=>collapse(false);document.documentElement.appendChild(m);}let w=q('#ghostplus-watch');if(!w){w=document.createElement('div');w.id='ghostplus-watch';w.innerHTML=`<div class="r"><span><span class="gp-dot"></span><b>Theo dõi</b> <span data-state>đang nghỉ</span></span><span data-silent>00:00</span></div><div class="r" style="margin-top:4px"><select data-time><option value="0">Tắt</option><option value="180">3 phút</option><option value="300">5 phút</option><option value="600">10 phút</option><option value="900">15 phút</option><option value="1500">25 phút</option></select><label><input data-auto type="checkbox"> tự khôi phục khi treo</label></div>`;document.documentElement.appendChild(w);const sel=q('[data-time]',w),au=q('[data-auto]',w);sel.value=String(S.timeout);au.checked=S.auto;sel.onchange=e=>{S.timeout=Math.max(0,Math.min(3600,Number(e.target.value)||0));GM_setValue(K.timeout,S.timeout);mark();};au.onchange=e=>{S.auto=!!e.target.checked;GM_setValue(K.auto,S.auto);};}return {c,m,w};}
function layout(){const p=panel(),{c,m,w}=controls();if(!p){c.style.display='none';w.style.display='none';m.style.display='none';return;}const r=p.getBoundingClientRect();if(!S.collapsed&&r.width>0)S.lastPanelRect={top:r.top,right:innerWidth-r.right,width:r.width,bottom:r.bottom};const pr=S.lastPanelRect||{top:70,right:8,width:270,bottom:300};if(S.collapsed){p.style.setProperty('display','none','important');c.style.display='none';w.style.display='none';m.style.display='grid';m.style.top=`${pr.top}px`;m.style.right=`${pr.right}px`;}else{p.style.removeProperty('display');m.style.display='none';c.style.display='block';w.style.display='block';c.style.top=`${Math.max(4,r.top+6)}px`;c.style.right=`${Math.max(4,innerWidth-r.right+6)}px`;w.style.top=`${Math.max(4,r.bottom+5)}px`;w.style.right=`${Math.max(4,innerWidth-r.right)}px`;w.style.width=`${Math.max(210,r.width)}px`;}}
function collapse(v){if(!v){const p=panel();if(p)p.style.removeProperty('display');}S.collapsed=!!v;GM_setValue(K.collapsed,S.collapsed);layout();}
function ui(){layout();const w=q('#ghostplus-watch'),m=q('#ghostplus-mini');if(!w)return;const silent=Date.now()-S.lastActivity;const st=q('[data-state]',w),sl=q('[data-silent]',w),d=q('.gp-dot',w);sl.textContent=fmt(silent);d.className='gp-dot';if(!ghostRunning()){st.textContent='đang nghỉ';}else if(S.recovering){st.textContent='đang khôi phục';d.classList.add('bad');}else if(S.timeout===0){st.textContent='tắt';}else if(silent>=S.timeout*1000){st.textContent='nghi treo';d.classList.add('warn');}else{st.textContent='ổn định';d.classList.add('ok');}m.className=ghostRunning()?'run':'';if(S.timeout>0&&silent>=S.timeout*1000)m.className='warn';m.title=`Ghost · ${ghostStatus()||'waiting'} · im ${fmt(silent)}`;}
async function wait(pred,ms){const t=Date.now();while(Date.now()-t<ms){try{if(pred())return true;}catch(_){}await sleep(250);}return false;}

async function recover(){
  if(S.recovering||!ghostRunning()||ghostUncertain()) return;
  const stallSig=signature();
  if(stallSig===S.lastRecoverySig){notice('Ghost+ watchdog','Đã thử khôi phục đúng trạng thái này một lần. Không lặp lại để tránh resend.');S.suspectAt=Date.now();return;}
  if(composerText()){notice('Ghost+ watchdog','Ô nhập đang có nội dung của anh. Không ghi đè để khôi phục tự động.');S.suspectAt=Date.now();return;}
  S.recovering=true; ui();

  if(generating()){
    const stops=stopButtons();
    if(stops.length!==1){notice('Ghost+ watchdog',`Phát hiện treo nhưng thấy ${stops.length} nút Stop. Fail-closed, không click.`);S.recovering=false;S.suspectAt=Date.now();return;}
    try{stops[0].click();}catch(e){notice('Ghost+ watchdog','Không click được Stop: '+String(e?.message||e));S.recovering=false;return;}
    if(!await wait(()=>!generating(),CFG.stopVerify)){notice('Ghost+ watchdog','Đã click Stop nhưng không xác nhận được generation dừng. Không retry.');S.recovering=false;return;}
  }

  const gs=ghostStop(), gp=ghostPlay();
  if(!visible(gs)||!visible(gp)){notice('Ghost+ watchdog','Không tìm thấy nút điều khiển Ghost đáng tin cậy. Dừng khôi phục.');S.recovering=false;return;}

  try{gs.click();}catch(e){notice('Ghost+ watchdog','Không chuyển Ghost về trạng thái an toàn: '+String(e?.message||e));S.recovering=false;return;}
  await sleep(100);

  if(!await setComposerText(recoveryPrompt())){notice('Ghost+ watchdog','Không stage được recovery status probe. Không gửi.');S.recovering=false;return;}

  const beforeUsers=users().length;
  try{gp.click();}catch(e){notice('Ghost+ watchdog','Không khởi động lại Ghost: '+String(e?.message||e));S.recovering=false;return;}

  const restarted=await wait(()=>ghostRunning()||generating()||users().length>beforeUsers,CFG.ghostRestartVerify);
  if(!restarted){notice('Ghost+ watchdog','Đã stage probe nhưng không xác nhận được Ghost bắt đầu lại. Prompt được giữ để anh kiểm tra thủ công.');S.recovering=false;return;}

  S.lastRecoverySig=stallSig;
  mark();
  notice('Ghost+ watchdog','Đã gửi recovery status probe qua chính Play/send-once của Ghost.');
  S.recovering=false; ui();
}

function sample(){addStyle();controls();layout();const sig=signature();if(sig!==S.lastSig){S.lastSig=sig;mark();}const silent=Date.now()-S.lastActivity;if(ghostRunning()&&S.timeout>0&&!S.recovering&&silent>=S.timeout*1000){if(!S.suspectAt){S.suspectAt=Date.now();notice('Ghost+ watchdog',`Không thấy activity ${S.timeout}s. Grace 30s bắt đầu.`);}else if(Date.now()-S.suspectAt>=CFG.grace){if(!S.auto){S.suspectAt=Date.now();notice('Ghost+ watchdog','Turn có vẻ stalled. Tự khôi phục đang tắt.');}else recover().catch(e=>{S.recovering=false;notice('Ghost+ watchdog error',String(e?.message||e));});}}else if(S.timeout===0||silent<S.timeout*1000){S.suspectAt=0;}ui();}
addStyle();controls();S.lastSig=signature();mark();clearInterval(S.timer);S.timer=setInterval(sample,CFG.tick);sample();
})();