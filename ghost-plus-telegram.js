(() => {
'use strict';
if(window.__GHOST_PLUS_TELEGRAM__)return;window.__GHOST_PLUS_TELEGRAM__=true;
if(!/^(chatgpt\.com|chat\.openai\.com)$/i.test(location.hostname))return;

const K={
  t:'ghostplus.tg.token',c:'ghostplus.tg.chat',n:'ghostplus.tg.name',b:'ghostplus.tg.bot',
  h:'ghostplus.tg.thread',p:'ghostplus.tg.topic',
  e:'ghostplus.tg.enabled',r:'ghostplus.tg.reason',s:'ghostplus.tg.stall',
  f:'ghostplus.tg.complete',x:'ghostplus.tg.sent',m:'ghostplus.tg.reminders'
};
const q=(s,r=document)=>r.querySelector(s);
const n=v=>String(v||'').replace(/\s+/g,' ').trim();
const now=()=>Date.now(),sleep=ms=>new Promise(r=>setTimeout(r,ms));
const get=(k,d='')=>{try{return GM_getValue(k,d)}catch(_){return d}};
const set=(k,v)=>{try{GM_setValue(k,v)}catch(_){}};
let code='',deadline=0,offset=0,timer=null,lastError='',queue=Promise.resolve();
const reminderPending=new Set();

const token=()=>n(get(K.t,''));
const dest=()=>n(get(K.c,''));
const thread=()=>{const v=Number(get(K.h,0));return Number.isInteger(v)&&v>0?v:0};
const enabled=()=>get(K.e,false)===true;
function json(k){try{const v=get(k,'{}');return typeof v==='object'?(v||{}):JSON.parse(String(v||'{}'))}catch(_){return{}}}
function put(k,v){set(k,JSON.stringify(v))}
function maskToken(v=token()){
  const t=n(v);
  if(!t)return'';
  if(t.length<=8)return t.slice(0,4)+'••••'+t.slice(-4);
  return t.slice(0,4)+'••••••••••••'+t.slice(-4);
}
function applyTokenInput(el){
  const v=n(el?.value||'');
  const current=token(),masked=maskToken(current);
  if(!v||v===masked)return false;
  if(v.includes('•'))throw new Error('Token đang ở dạng che. Hãy paste full token mới để thay đổi.');
  set(K.t,v);set(K.e,true);return true;
}
function targetPayload(extra={}){
  const out={chat_id:dest(),...extra};
  const th=thread();
  if(th)out.message_thread_id=th;
  return out;
}
function req(method,data={}){
  const t=token();
  if(!t)return Promise.reject(new Error('Chưa có Bot Token'));
  if(typeof GM_xmlhttpRequest!=='function')return Promise.reject(new Error('Thiếu GM_xmlhttpRequest'));
  return new Promise((ok,no)=>GM_xmlhttpRequest({
    method:'POST',url:'https://api.telegram.org/bot'+t+'/'+method,
    headers:{'Content-Type':'application/json'},data:JSON.stringify(data),timeout:10000,
    onload:r=>{let b={};try{b=JSON.parse(r.responseText||'{}')}catch(_){}
      r.status>=200&&r.status<300&&b.ok?ok(b.result):no(new Error(b.description||('Telegram HTTP '+r.status)))},
    onerror:()=>no(new Error('Telegram network error')),ontimeout:()=>no(new Error('Telegram timeout'))
  }))
}
async function retry(method,data,ntry=2){
  let e;
  for(let i=0;i<ntry;i++){
    try{return await req(method,data)}catch(x){
      e=x;if(/Telegram 4\d\d/.test(String(x?.message||x)))break;
      if(i+1<ntry)await sleep(i?3000:1000)
    }
  }
  throw e
}
function mark(k){const m=json(K.x);m[k]=now();put(K.x,Object.fromEntries(Object.entries(m).sort((a,b)=>b[1]-a[1]).slice(0,120)))}
function sent(k){return!!json(K.x)[k]}
function should(e){
  if(e?.source==='legacy')return false;
  if(!enabled()||!token()||!dest())return false;
  if(['HUMAN_REQUIRED','MODEL_RELAY','CONTEXT_BOUNDARY','AUTH_ERROR','RECOVERY_EXHAUSTED','RATE_LIMIT'].includes(e.type))return true;
  if(e.type==='STALL_WARNING')return get(K.s,true)!==false;
  if(e.type==='COMPLETE')return get(K.f,false)===true;
  return false
}
function text(e,rem=false){
  const ic=/HUMAN|CONTEXT|AUTH|RECOVERY_EXHAUSTED/.test(e.type)?'🔴':e.type==='COMPLETE'?'🟢':'🟠';
  const a=[ic+' Ghost+ — '+String(e.type||'ALERT').replaceAll('_',' '),e.chat||window.__ghostPlusCurrentChatName?.()||'ChatGPT'];
  if(e.episodeId)a.push('Job: '+e.episodeId);
  if(rem)a.push('Reminder: job vẫn đang chờ người xử lý.');
  if(get(K.r,false)===true&&e.reason)a.push('Reason: '+n(e.reason).slice(0,280));
  if(['HUMAN_REQUIRED','MODEL_RELAY','CONTEXT_BOUNDARY'].includes(e.type))a.push('Status: PAUSED — auto continuation/recovery bị khóa.');
  return a.join('\n')
}
function send(e,{key='',rem=false}={}){
  if(!rem&&!should(e))return Promise.resolve(false);
  const k=key||'event:'+(e.episodeId||e.id||e.type+':'+e.at)+':'+e.type;
  if(sent(k))return Promise.resolve(false);
  queue=queue.catch(()=>{}).then(async()=>{
    try{
      await retry('sendMessage',targetPayload({text:text(e,rem)}),2);
      mark(k);lastError='';render();return true
    }catch(x){lastError=n(x?.message||x).slice(0,220);render();return false}
  });
  return queue
}
async function getMe(){
  const me=await req('getMe');
  set(K.b,me?.username||me?.first_name||'bot');set(K.e,true);lastError='';render();return me
}
async function test(){
  if(!dest())throw new Error('Chưa có destination');
  await retry('sendMessage',targetPayload({text:'👻 Ghost+ test OK\nAlerts ready.'}),1)
}
function secureCode(){
  if(!globalThis.crypto?.getRandomValues)throw new Error('Secure random unavailable');
  const a='ABCDEFGHJKLMNPQRSTUVWXYZ23456789',b=new Uint8Array(6);crypto.getRandomValues(b);
  return[...b].map(x=>a[x%a.length]).join('')
}
async function bind(){
  applyTokenInput(q('#ghostplus-telegram [data-token]'));
  const wh=await req('getWebhookInfo');
  if(wh?.url)throw new Error('Bot đang có webhook; Ghost không tự xóa. Dùng bot riêng hoặc nhập Chat ID.');
  const u=await req('getUpdates',{timeout:0,limit:100,allowed_updates:['message','channel_post']});
  offset=(u||[]).reduce((m,x)=>Math.max(m,Number(x.update_id)||0),0)+1;
  code=secureCode();deadline=now()+60000;clearInterval(timer);timer=setInterval(poll,2000);render()
}
function topicNameFrom(m){
  return n(m?.forum_topic_created?.name||m?.reply_to_message?.forum_topic_created?.name||'')
}
async function poll(){
  if(!code||now()>deadline){clearInterval(timer);timer=null;code='';render();return}
  try{
    const u=await req('getUpdates',{offset,timeout:0,limit:20,allowed_updates:['message','channel_post']});
    for(const x of u||[]){
      offset=Math.max(offset,Number(x.update_id||0)+1);
      const m=x.message||x.channel_post,c=m?.chat,t=n(m?.text);
      if(!c||!new RegExp('^/ghost_bind(?:@\\w+)?\\s+'+code+'$','i').test(t))continue;
      const th=Number(m.message_thread_id)||0;
      set(K.c,String(c.id));set(K.n,n(c.title||c.username||c.first_name||c.id));
      set(K.h,th>0?String(th):'');set(K.p,th>0?(topicNameFrom(m)||('topic #'+th)):'');
      set(K.e,true);clearInterval(timer);timer=null;code='';lastError='';render();await test();return
    }
  }catch(e){lastError=n(e?.message||e).slice(0,220);render()}
}
function saveDest(v,threadValue=''){
  v=n(v);
  if(/^https?:\/\/t\.me\//i.test(v)||/^t\.me\//i.test(v))throw new Error('Invite link không phải chat_id. Dùng Bind topic/group.');
  if(v&&!/^-?\d+$/.test(v)&&!/^@[A-Za-z0-9_]{4,}$/.test(v))throw new Error('Dùng numeric Chat ID hoặc @username');
  const tv=n(threadValue);
  if(tv&&!/^\d+$/.test(tv))throw new Error('Topic ID phải là số.');
  if(v){set(K.c,v);set(K.n,v)}
  set(K.h,tv?String(Number(tv)):'');set(K.p,tv?('topic #'+Number(tv)):'');
  if(v||dest())set(K.e,true)
}
function saveUi(){
  const r=q('#ghostplus-telegram');if(!r)return;
  applyTokenInput(q('[data-token]',r));
  const d=n(q('[data-dest]',r).value),th=n(q('[data-thread]',r).value);
  saveDest(d,th);lastError='Đã lưu cấu hình.';render()
}
function forget(){
  [K.t,K.c,K.n,K.b,K.h,K.p].forEach(k=>set(k,''));
  set(K.e,false);clearInterval(timer);timer=null;code='';lastError='';render()
}
function buttonStyle(){
  return 'width:100%;padding:5px 6px;border:1px solid rgba(100,116,139,.35);border-radius:6px;background:#fff;cursor:pointer;font:10px system-ui'
}
function ui(){
  const h=q('#ghostplus-watch');if(!h)return null;
  let r=q('#ghostplus-telegram',h);if(r)return r;
  r=document.createElement('details');r.id='ghostplus-telegram';
  r.style.cssText='margin-top:6px;padding-top:5px;border-top:1px solid rgba(148,163,184,.25);font:10px system-ui';
  r.innerHTML='<summary><b>Telegram</b> <span data-st></span></summary>'+
    '<div style="display:grid;gap:5px;margin-top:6px">'+
      '<input data-token type="text" autocomplete="off" spellcheck="false" placeholder="Bot Token" style="width:100%;box-sizing:border-box">'+
      '<input data-dest placeholder="Chat ID hoặc @username" style="width:100%;box-sizing:border-box">'+
      '<input data-thread inputmode="numeric" placeholder="Topic ID (tự điền khi Bind)" style="width:100%;box-sizing:border-box">'+
      '<div data-actions style="display:grid;grid-template-columns:1fr 1fr;gap:5px">'+
        '<button data-save>💾 Save</button><button data-check>✓ Check bot</button>'+
        '<button data-bind>🔗 Bind topic/group</button><button data-test>✉ Test</button>'+
      '</div>'+
      '<div style="display:flex;gap:8px;flex-wrap:wrap">'+
        '<label><input data-reason type="checkbox"> reason</label>'+
        '<label><input data-stall type="checkbox"> stall</label>'+
        '<label><input data-done type="checkbox"> complete</label>'+
      '</div>'+
      '<div data-help style="line-height:1.35"></div><div data-error style="color:#b91c1c;line-height:1.35"></div>'+
    '</div>';
  h.appendChild(r);
  for(const b of r.querySelectorAll('[data-actions] button'))b.style.cssText=buttonStyle();

  const tokenEl=q('[data-token]',r);
  tokenEl.addEventListener('focus',()=>{if(tokenEl.value===maskToken())tokenEl.select()});
  tokenEl.addEventListener('blur',()=>setTimeout(render,0));

  q('[data-save]',r).onclick=()=>{try{saveUi()}catch(e){lastError=n(e?.message||e);render()}};
  q('[data-check]',r).onclick=async()=>{try{applyTokenInput(tokenEl);await getMe();lastError='Bot hợp lệ.';render()}catch(e){lastError=n(e?.message||e);render()}};
  q('[data-bind]',r).onclick=()=>bind().catch(e=>{lastError=n(e?.message||e);render()});
  q('[data-test]',r).onclick=async()=>{try{applyTokenInput(tokenEl);saveDest(n(q('[data-dest]',r).value),n(q('[data-thread]',r).value));await test();lastError='Test OK.';render()}catch(e){lastError=n(e?.message||e);render()}};
  q('[data-reason]',r).onchange=e=>set(K.r,!!e.target.checked);
  q('[data-stall]',r).onchange=e=>set(K.s,!!e.target.checked);
  q('[data-done]',r).onchange=e=>set(K.f,!!e.target.checked);
  return r
}
function render(){
  const r=ui();if(!r)return;
  const ok=!!token()&&!!dest()&&enabled(),bot=n(get(K.b,'')),name=n(get(K.n,''))||dest(),th=thread(),topic=n(get(K.p,''));
  const tok=q('[data-token]',r),de=q('[data-dest]',r),te=q('[data-thread]',r);
  if(document.activeElement!==tok)tok.value=maskToken();
  if(document.activeElement!==de)de.value=dest();
  if(document.activeElement!==te)te.value=th?String(th):'';
  const target=name+(th?' · '+(topic||('topic #'+th)):'');
  q('[data-st]',r).textContent=ok?'✓ '+(bot?'@'+bot.replace(/^@/,'')+' → ':'')+target:token()?(dest()?'token ✓ · đích ✓':'token ✓ · chưa bind'):'chưa cấu hình';
  q('[data-reason]',r).checked=get(K.r,false)===true;
  q('[data-stall]',r).checked=get(K.s,true)!==false;
  q('[data-done]',r).checked=get(K.f,false)===true;
  q('[data-help]',r).textContent=code
    ?'Gửi /ghost_bind '+code+' NGAY TRONG topic muốn nhận alert · '+Math.max(0,Math.ceil((deadline-now())/1000))+'s'
    :(th?'Đang gửi vào topic ID '+th+'. Muốn đổi topic: Bind lại và gửi mã trong topic mới.':'Bind topic/group: gửi mã bind trong đúng topic. Nếu gửi ở General thì alert sẽ vào General.');
  q('[data-error]',r).textContent=lastError
}
function reminders(){
  if(!enabled()||!token()||!dest())return;
  const g=window.__ghostPlusSupervisor?.gate?.();
  if(!g||g.type!=='HUMAN_REQUIRED'||!g.id)return;
  const age=now()-Number(g.since||0),m=json(K.m),e={id:'rem:'+g.id,type:'HUMAN_REQUIRED',episodeId:g.id,reason:g.reason||'',chat:g.chat};
  for(const [tag,ms] of [['15m',900000],['60m',3600000]]){
    const rk=g.id+':'+tag;
    if(age<ms||m[rk]||reminderPending.has(rk))continue;
    reminderPending.add(rk);
    send(e,{key:'reminder:'+rk,rem:true}).then(ok=>{if(ok){const mm=json(K.m);mm[rk]=now();put(K.m,mm)}}).finally(()=>reminderPending.delete(rk))
  }
}

window.__ghostPlusAlerts?.subscribe?.(e=>send(e));
setInterval(reminders,60000);setInterval(render,1500);ui();render();
window.__ghostPlusTelegram={getMe,test,bind,send,forget,threadId:thread,maskedToken:maskToken};
})();