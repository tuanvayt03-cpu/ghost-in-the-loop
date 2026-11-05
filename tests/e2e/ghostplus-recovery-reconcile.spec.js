// @ts-check
const {test,expect}=require('@playwright/test');
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'../..');
const runtime=fs.readFileSync(path.join(root,'ghost-plus-runtime-manager.js'),'utf8');
const core=fs.readFileSync(path.join(root,'ghost-in-the-loop.user.js'),'utf8')
  .replace(/\/\/ ==UserScript==[\s\S]*?\/\/ ==\/UserScript==/m,'')
  .replace('window.__GITL_V9__ = true;',
    'window.__coreTest={state:S,bootstrapPrompt};\nwindow.__GITL_V9__ = true;');
const gate=fs.readFileSync(path.join(root,'ghost-plus-operator-gate.js'),'utf8');
const watchdog=fs.readFileSync(path.join(root,'ghost-plus-companion-v2.js'),'utf8')
  .replace('function addStyle() {',
    'window.__watchdogTest={recover,captureSnapshot,recoveryPrompt,state:S};\nfunction addStyle() {');
// Test-only diagnostic hook: no production export or operator bypass.
const web=fs.readFileSync(path.join(root,'ghost-plus-web-recovery.js'),'utf8')
  .replace('RT.clearInterval(S.timer);',
    'window.__webTest={beginRecoveryAttempt,recoveryAcceptanceObserved,observeActiveRecovery,sendRecoveryProbe,state:S};\nRT.clearInterval(S.timer);');
const gm=`
window.__values={};
window.GM_getValue=(k,d)=>Object.prototype.hasOwnProperty.call(window.__values,k)?window.__values[k]:d;
window.GM_setValue=(k,v)=>{window.__values[k]=v;};
window.GM_setClipboard=()=>{};
window.GM_notification=()=>{};
window.GM_xmlhttpRequest=()=>({abort(){}});
`;
function html(user='',action='stop',assistant=''){
  const actionButton=action==='send'
    ?'<button id="composer-submit-button" data-testid="send-button" aria-label="Send prompt" type="button">↑</button>'
    :'<button id="composer-submit-button" data-testid="stop-button" aria-label="Stop streaming" type="button">■</button>';
  return `<!doctype html><html><head><style>
    body{font:14px system-ui}
    form[data-type="unified-composer"]{position:fixed;bottom:15px;left:20%;right:20%}
    #prompt-textarea{width:75%;min-height:40px;border:1px solid gray}
    button{min-width:36px;min-height:36px}
  </style></head><body><main>
    ${user?'<article data-testid="conversation-turn-1" aria-label="You said:">'+user+'</article>':''}
    ${assistant?'<article data-testid="conversation-turn-2" aria-label="ChatGPT said:"><div class="markdown">'+assistant+'</div></article>':''}
    <form data-type="unified-composer">
      <div id="prompt-textarea" role="textbox" contenteditable="true" aria-label="Message ChatGPT"></div>
      ${actionButton}
    </form>
  </main><div id="ghostplus-watch"></div></body></html>`;
}
async function boot(page,{withWeb=false,withWatchdog=false,user='',action='stop',assistant=''}={}){
  await page.route('https://chatgpt.com/**',route=>route.fulfill({status:200,contentType:'text/html',body:html(user,action,assistant)}));
  await page.goto('https://chatgpt.com/c/recovery-gate-test');
  await page.addScriptTag({content:gm+'\n'+runtime+'\n'+core+'\n'+gate+(withWeb?'\n'+web:'')+(withWatchdog?'\n'+watchdog:'')});
  await page.waitForFunction(()=>!!window.__ghostPlusSupervisor&&!!document.querySelector('#gitl9'));
}
async function lock(page,overrides={}){
  return page.evaluate(o=>{
    window.__ghostPlusSupervisor.lock('HUMAN_REQUIRED',{
      source:'web-recovery',transient:'WEB_SEND_UNCERTAIN',autoReconcile:true,
      baselineUsers:0,baselineAssistants:0,baselineAssistantHash:'',faultKey:'test',...o
    });
  },overrides);
}
test('Stop/BUSY alone cannot clear a transient uncertain-send gate',async({page})=>{
  await boot(page);await lock(page);
  await expect(page.locator('#ghostplus-gate')).toBeVisible();
  await page.waitForTimeout(1100);
  expect(await page.evaluate(()=>window.__ghostPlusSupervisor.isLocked())).toBe(true);
  await expect(page.locator('#gitl9 .status')).toContainText('Controller: HARD_GATE');
  await expect(page.locator('#gitl9 .status')).toContainText('Host: BUSY (không can thiệp)');
});
test('operator Resume while Stop is visible adopts the active turn and never stages/sends',async({page})=>{
  await boot(page);await lock(page);
  await page.evaluate(()=>{
    window.__clicks=0;
    document.querySelector('#composer-submit-button').addEventListener('click',()=>window.__clicks++);
  });
  await page.locator('#ghostplus-gate [data-resume]').click();
  await expect.poll(()=>page.evaluate(()=>window.__ghostPlusSupervisor.isLocked())).toBe(false);
  await expect(page.locator('#gitl9 .status')).toContainText('RUNNING',{timeout:4000});
  const state=await page.evaluate(()=>({
    clicks:window.__clicks,
    draft:document.querySelector('#prompt-textarea').textContent,
    userTurns:document.querySelectorAll('[data-testid^="conversation-turn-user"]').length
  }));
  expect(state).toEqual({clicks:0,draft:'',userTurns:0});
});
test('unrelated manual user turn cannot clear an uncertain-send gate',async({page})=>{
  await boot(page);await lock(page);
  await page.evaluate(()=>{
    window.__clicks=0;
    document.querySelector('#composer-submit-button').addEventListener('click',()=>window.__clicks++);
    const turn=document.createElement('article');
    turn.setAttribute('data-testid','conversation-turn-77');
    turn.setAttribute('aria-label','You said:');
    turn.textContent='Unrelated manual message';
    document.querySelector('main').insertBefore(turn,document.querySelector('form'));
  });
  await page.waitForTimeout(850);
  expect(await page.evaluate(()=>window.__ghostPlusSupervisor.isLocked())).toBe(true);
  await expect(page.locator('#gitl9 .status')).toContainText('HARD_GATE');
  expect(await page.evaluate(()=>window.__clicks)).toBe(0);
});
test('uncertain-send gate clears only after Core confirms the same late transaction',async({page})=>{
  await boot(page);await lock(page);
  await page.evaluate(()=>{
    window.__ghostCoreSendJournal={hasUnresolved:()=>false,reconcile:()=>true,
      latest:()=>({stage:'CONFIRMED',lateReconciled:true,confirmedAt:Date.now()+1})};
  });
  await expect.poll(()=>page.evaluate(()=>window.__ghostPlusSupervisor.isLocked()),{timeout:4000}).toBe(false);
});
test('hard AUTH gate does not unlock or stage a prompt while ChatGPT is busy',async({page})=>{
  await boot(page);
  await page.evaluate(()=>window.__ghostPlusSupervisor.lock('AUTH_ERROR',{reason:'Login required'}));
  await page.locator('#ghostplus-gate [data-resume]').click();
  expect(await page.evaluate(()=>window.__ghostPlusSupervisor.isLocked())).toBe(true);
  expect(await page.locator('#prompt-textarea').textContent()).toBe('');
});

test('Web Recovery ignores unrelated Core round and requires its own confirmed intent id',async({page})=>{
 await boot(page,{withWeb:true,user:'Prior task',action:'send'});
 const s=await page.evaluate(()=>{
   const prompt='[WEB RECOVERY STATUS PROBE]\\n[GHOST-RECOVERY-ID:abc123def456]\\nCheck state';
   const attempt=window.__webTest.beginRecoveryAttempt(prompt,{key:'a',error:{type:'NETWORK_ERROR'}},1,1);
   const original=window.__ghostCoreSendJournal;
   window.__ghostCoreSendJournal={latest:()=>({
     stage:'CONFIRMED',intentId:'wrongIntent',confirmedAt:Date.now()+1
   })};
   document.querySelector('#gitl9 .status').textContent='RUNNING · round 9/25';
   const unrelated=window.__webTest.recoveryAcceptanceObserved(attempt);
   window.__ghostCoreSendJournal={latest:()=>({
     stage:'CONFIRMED',intentId:'abc123def456',confirmedAt:Date.now()+1
   })};
   const exact=window.__webTest.recoveryAcceptanceObserved(attempt);
   window.__ghostCoreSendJournal=original;
   return {unrelated,exact};
 });
 expect(s).toEqual({unrelated:'',exact:'core-send-confirmed'});
});

test('recovery rejects unrelated user progress; only exact probe receipt confirms submission',async({page})=>{
  await boot(page,{withWeb:true,user:'Old request'});
  const result=await page.evaluate(()=>{
    const snap={key:'fault-test',error:{type:'PLAY_SEND_UNCERTAIN'},active:true};
    const prompt='[WEB RECOVERY STATUS PROBE]';
    const attempt=window.__webTest.beginRecoveryAttempt(prompt,snap,1,0);
    const before=window.__webTest.recoveryAcceptanceObserved(attempt);
    document.querySelector('article').textContent='New manual request (same number of turns)';
    const unrelated=window.__webTest.recoveryAcceptanceObserved(attempt);
    document.querySelector('article').textContent=prompt;
    return {before,unrelated,matching:window.__webTest.recoveryAcceptanceObserved(attempt)};
  });
  expect(result).toEqual({before:'',unrelated:'',matching:'matching-user-turn'});
});
test('recovery in active Stop state remains observation-only, never HUMAN escalation',async({page})=>{
  await boot(page,{withWeb:true,user:'Old request'});
  const result=await page.evaluate(()=>{
    const snap={key:'fault-test',error:{type:'PLAY_SEND_UNCERTAIN'},active:true,status:'PAUSED'};
    const attempt=window.__webTest.beginRecoveryAttempt('[WEB RECOVERY STATUS PROBE]',snap,1,0);
    const observed=window.__webTest.observeActiveRecovery(snap,attempt);
    return {observed,attempted:window.__webTest.state.attemptedThisEpisode,locked:window.__ghostPlusSupervisor.isLocked()};
  });
  expect(result).toEqual({observed:true,attempted:true,locked:false});
});

test('watchdog recovery re-acquires Play after Stop re-renders the Ghost panel',async({page})=>{
  await boot(page,{withWatchdog:true,user:'Original task',assistant:'Previous completed answer',action:'send'});
  await page.evaluate(()=>{
    window.__hostSendClicks=0;
    const send=document.querySelector('#composer-submit-button');
    send.addEventListener('click',()=>{
      window.__hostSendClicks+=1;
      const input=document.querySelector('#prompt-textarea');
      const text=input.textContent||'';
      const turn=document.createElement('article');
      turn.setAttribute('data-testid','conversation-turn-99');
      turn.setAttribute('aria-label','You said:');
      turn.textContent=text;
      document.querySelector('main').insertBefore(turn,document.querySelector('form'));
      input.textContent='';
      input.dispatchEvent(new Event('input',{bubbles:true}));
    });
  });
  const transition=await page.evaluate(async()=>{
    window.__beforePlayRef=document.querySelector('#gitl9 [data-a="play"]');
    const snap=window.__watchdogTest.captureSnapshot(true);
    await window.__watchdogTest.recover(snap,{allowStopped:true,source:'lease'});
    return {
      oldPlayConnected:!!window.__beforePlayRef?.isConnected,
      freshPlayConnected:!!document.querySelector('#gitl9 [data-a="play"]')?.isConnected
    };
  });
  expect(transition.oldPlayConnected).toBe(false);
  expect(transition.freshPlayConnected).toBe(true);
  const receiptState=await page.evaluate(()=>{
    const current=window.__ghostPlusRuntime.dom.chatgptUserSnapshot();
    const expected=window.__coreTest.bootstrapPrompt(window.__watchdogTest.recoveryPrompt());
    const norm=v=>String(v||'').replace(/\s+/g,' ').trim();
    return {
      exactExpected:norm(expected)===norm(current.latestText),
      observed:window.__ghostPlusRuntime.dom.chatgptSubmissionObserved(
        {count:1,latestText:'Original task'},expected
      )
    };
  });
  expect(receiptState.exactExpected).toBe(false);
  expect(receiptState.observed).toBe(true);
  await expect.poll(()=>page.locator('#gitl9 .status').innerText(),{timeout:5000}).toContain('round 1/25');
  const result=await page.evaluate(()=>({
    running:/^RUNNING\b/i.test(document.querySelector('#gitl9 .status')?.innerText||''),
    clicks:window.__hostSendClicks,
    draft:(document.querySelector('#prompt-textarea')?.textContent||'').trim(),
    users:document.querySelectorAll('article[aria-label^="You said"]').length,
    recovering:window.__watchdogTest.state.recovering
  }));
  expect(result.clicks).toBe(1);
  expect(result.users).toBe(2);
  expect(result.draft).toBe('');
  expect(result.recovering).toBe(false);
  expect(result.running).toBe(true);
});

test('web recovery re-acquires Play and accepts the core-confirmed wrapped probe while a waiting task is idle',async({page})=>{
  await boot(page,{withWeb:true,user:'Start release build',assistant:'CI is still running; continue polling until the artifact is ready.',action:'send'});
  await page.evaluate(()=>{
    window.__hostSendClicks=0;
    const send=document.querySelector('#composer-submit-button');
    send.addEventListener('click',()=>{
      window.__hostSendClicks+=1;
      const input=document.querySelector('#prompt-textarea');
      const text=input.textContent||'';
      const turn=document.createElement('article');
      turn.setAttribute('data-testid','conversation-turn-99');
      turn.setAttribute('aria-label','You said:');
      turn.textContent=text;
      document.querySelector('main').insertBefore(turn,document.querySelector('form'));
      input.textContent='';
      input.dispatchEvent(new Event('input',{bubbles:true}));
    });
  });
  const transition=await page.evaluate(async()=>{
    window.__beforeWebPlayRef=document.querySelector('#gitl9 [data-a="play"]');
    await window.__webTest.sendRecoveryProbe({
      key:'wait-fault',
      active:true,
      blockedType:'',
      streamDesync:false,
      status:'idle waiting',
      error:{type:'MESSAGE_DELIVERY_TIMEOUT',text:'Message delivery timed out'}
    });
    return {
      oldPlayConnected:!!window.__beforeWebPlayRef?.isConnected,
      freshPlayConnected:!!document.querySelector('#gitl9 [data-a="play"]')?.isConnected,
      clicks:window.__hostSendClicks,
      locked:window.__ghostPlusSupervisor.isLocked(),
      status:document.querySelector('#gitl9 .status')?.innerText||'',
      attempted:window.__webTest.state.attemptedThisEpisode
    };
  });
  expect(transition.oldPlayConnected).toBe(false);
  expect(transition.freshPlayConnected).toBe(true);
  expect(transition.clicks).toBe(1);
  expect(transition.locked).toBe(false);
  expect(transition.attempted).toBe(true);
  expect(transition.status).toContain('round 1/25');
});