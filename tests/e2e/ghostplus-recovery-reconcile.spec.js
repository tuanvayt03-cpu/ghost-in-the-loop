// @ts-check
const {test,expect}=require('@playwright/test');
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'../..');
const runtime=fs.readFileSync(path.join(root,'ghost-plus-runtime-manager.js'),'utf8');
const core=fs.readFileSync(path.join(root,'ghost-in-the-loop.user.js'),'utf8').replace(/\/\/ ==UserScript==[\s\S]*?\/\/ ==\/UserScript==/m,'');
const gate=fs.readFileSync(path.join(root,'ghost-plus-operator-gate.js'),'utf8');
// Test-only diagnostic hook: no production export or operator bypass.
const web=fs.readFileSync(path.join(root,'ghost-plus-web-recovery.js'),'utf8')
  .replace('RT.clearInterval(S.timer);',
    'window.__webTest={beginRecoveryAttempt,recoveryAcceptanceObserved,observeActiveRecovery,state:S};\nRT.clearInterval(S.timer);');
const gm=`
window.__values={};
window.GM_getValue=(k,d)=>Object.prototype.hasOwnProperty.call(window.__values,k)?window.__values[k]:d;
window.GM_setValue=(k,v)=>{window.__values[k]=v;};
window.GM_setClipboard=()=>{};
window.GM_notification=()=>{};
window.GM_xmlhttpRequest=()=>({abort(){}});
`;
function html(user=''){
  return `<!doctype html><html><head><style>
    body{font:14px system-ui}
    form[data-type="unified-composer"]{position:fixed;bottom:15px;left:20%;right:20%}
    #prompt-textarea{width:75%;min-height:40px;border:1px solid gray}
    button{min-width:36px;min-height:36px}
  </style></head><body><main>
    ${user?'<article data-testid="conversation-turn-1" aria-label="You said:">'+user+'</article>':''}
    <form data-type="unified-composer">
      <div id="prompt-textarea" role="textbox" contenteditable="true" aria-label="Message ChatGPT"></div>
      <button id="composer-submit-button" data-testid="stop-button" aria-label="Stop streaming">■</button>
    </form>
  </main><div id="ghostplus-watch"></div></body></html>`;
}
async function boot(page,{withWeb=false,user=''}={}){
  await page.route('https://chatgpt.com/**',route=>route.fulfill({status:200,contentType:'text/html',body:html(user)}));
  await page.goto('https://chatgpt.com/c/recovery-gate-test');
  await page.addScriptTag({content:gm+'\n'+runtime+'\n'+core+'\n'+gate+(withWeb?'\n'+web:'')});
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
  await expect(page.locator('#gitl9 .status')).toContainText('ChatGPT đang làm việc');
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
test('a new user turn after a transient lock positively reconciles without duplicate Send',async({page})=>{
  await boot(page);await lock(page);
  await page.evaluate(()=>{
    window.__clicks=0;
    document.querySelector('#composer-submit-button').addEventListener('click',()=>window.__clicks++);
    const turn=document.createElement('article');
    turn.setAttribute('data-testid','conversation-turn-77');
    turn.setAttribute('aria-label','You said:');
    turn.textContent='Manually resumed';
    document.querySelector('main').insertBefore(turn,document.querySelector('form'));
  });
  await expect.poll(()=>page.evaluate(()=>window.__ghostPlusSupervisor.isLocked()),{timeout:4000}).toBe(false);
  await expect(page.locator('#gitl9 .status')).toContainText('RUNNING');
  expect(await page.evaluate(()=>window.__clicks)).toBe(0);
});
test('hard AUTH gate does not unlock or stage a prompt while ChatGPT is busy',async({page})=>{
  await boot(page);
  await page.evaluate(()=>window.__ghostPlusSupervisor.lock('AUTH_ERROR',{reason:'Login required'}));
  await page.locator('#ghostplus-gate [data-resume]').click();
  expect(await page.evaluate(()=>window.__ghostPlusSupervisor.isLocked())).toBe(true);
  expect(await page.locator('#prompt-textarea').textContent()).toBe('');
});
test('recovery uses user text fingerprints when virtualized user count stays constant',async({page})=>{
  await boot(page,{withWeb:true,user:'Old request'});
  const result=await page.evaluate(()=>{
    const snap={key:'fault-test',error:{type:'PLAY_SEND_UNCERTAIN'},active:true};
    const attempt=window.__webTest.beginRecoveryAttempt('[WEB RECOVERY STATUS PROBE]',snap,1,0);
    const before=window.__webTest.recoveryAcceptanceObserved(attempt);
    document.querySelector('article').textContent='New request (same number of turns)';
    return {before,after:window.__webTest.recoveryAcceptanceObserved(attempt)};
  });
  expect(result).toEqual({before:'',after:'changed-user-turn'});
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