// @ts-check
const {test,expect}=require('@playwright/test');
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'../..');
const runtime=fs.readFileSync(path.join(root,'ghost-plus-runtime-manager.js'),'utf8');
const core=fs.readFileSync(path.join(root,'ghost-in-the-loop.user.js'),'utf8')
 .replace(/\/\/ ==UserScript==[\s\S]*?\/\/ ==\/UserScript==/m,'')
 .replace('window.__GITL_V9__ = true;',
   'window.__lifecycleTest={state:S,handleDrift,handleTerminal,play,stop,tick,hash,armContinuity,assistantText,render};\nwindow.__GITL_V9__ = true;');
const gate=fs.readFileSync(path.join(root,'ghost-plus-operator-gate.js'),'utf8');
const budget=fs.readFileSync(path.join(root,'ghost-plus-turn-budget-v2.js'),'utf8');
const uncertain=fs.readFileSync(path.join(root,'ghost-plus-uncertain-reconcile.js'),'utf8');
const gm=`
window.GM_getValue=(k,d)=>{
  const x=localStorage.getItem('ghost-test-gm:'+k);
  return x===null?d:JSON.parse(x);
};
window.GM_setValue=(k,v)=>{localStorage.setItem('ghost-test-gm:'+k,JSON.stringify(v));};
window.GM_setClipboard=()=>{};
window.GM_notification=()=>{};
window.GM_xmlhttpRequest=()=>({abort(){}});
`;
const fixture=(stop=false)=>`<!doctype html><html><head><style>#ghostplus-watch{position:fixed!important;right:10px!important;top:10px!important;left:auto!important;z-index:2147483647!important}#gitl9{left:10px!important;top:120px!important;right:auto!important;z-index:4!important}</style></head><body><main>
 <article data-testid="conversation-turn-1" aria-label="You said:">Run CI and wait for result</article>
 <article data-testid="conversation-turn-2" aria-label="ChatGPT said:"><div class="markdown">CI still running; continue checking.</div></article>
 <form data-type="unified-composer" style="position:fixed;bottom:10px;left:10px;width:700px;height:70px">
 <div id="prompt-textarea" contenteditable="true" role="textbox" style="width:400px;height:45px;border:1px solid"></div>
 <button id="composer-submit-button" data-testid="${stop?'stop-button':'send-button'}" aria-label="${stop?'Stop streaming':'Send prompt'}" type="button" style="width:45px;height:45px">${stop?'■':'↑'}</button>
 </form>
 </main><div id="ghostplus-watch"></div></body></html>`;
async function boot(page,{stop=false,withGate=true,withBudget=false}={}){
 await page.route('https://chatgpt.com/**',route=>route.fulfill({status:200,contentType:'text/html',body:fixture(stop)}));
 await page.goto('https://chatgpt.com/c/lifecycle-audit-case');
 await page.addScriptTag({content:gm+'\n'+runtime+(withBudget?'\n'+budget:'')+'\n'+core+(withGate?'\n'+gate:'')});
 await page.waitForFunction(()=>!!window.__lifecycleTest&&!!document.querySelector('#gitl9'));
}
test('repeated missing terminal becomes a soft protocol wait, never a fabricated HUMAN gate',async({page})=>{
 await boot(page);
 const s=await page.evaluate(async()=>{
   const c=window.__lifecycleTest;c.state.mode='RUNNING';c.state.drift=1;
   await c.handleDrift('missing marker');
   return {mode:c.state.mode,detail:c.state.detail,gate:window.__ghostPlusSupervisor.isLocked()};
 });
 expect(s.gate).toBe(false);
 expect(s.mode).toBe('PROTOCOL_WAIT');
 expect(s.detail).toMatch(/protocol/i);
});

test('a manually submitted next user turn revives soft protocol wait without Ghost Send',async({page})=>{
 await boot(page,{withGate:false});
 const s=await page.evaluate(async()=>{
   const c=window.__lifecycleTest;
   c.state.mode='RUNNING';c.state.drift=1;
   await c.handleDrift('missing marker');
   const before=c.state.mode;
   const row=document.createElement('article');
   row.setAttribute('data-testid','conversation-turn-80');
   row.setAttribute('aria-label','You said:');
   row.textContent='tiếp đi';
   document.querySelector('main').insertBefore(row,document.querySelector('form'));
   await c.tick();
   return {before,after:c.state.mode,detail:c.state.detail,
     journal:window.__ghostCoreSendJournal.snapshot()};
 });
 expect(s.before).toBe('PROTOCOL_WAIT');
 expect(s.after).toBe('RUNNING');
 expect(s.detail).toContain('without Send');
 expect(s.journal).toBe(null);
});

test('legacy protocol-drift gate permits explicit adopt while ChatGPT BUSY without another Send',async({page})=>{
 await boot(page,{stop:true});
 await page.evaluate(()=>{
   window.__hostClicks=0;
   document.querySelector('#composer-submit-button').addEventListener('click',()=>window.__hostClicks++);
   window.__ghostPlusSupervisor.lock('HUMAN_REQUIRED',{reason:'Protocol drift repeated 2 times. Human review required.'});
 });
 await page.locator('#ghostplus-gate [data-resume]').click();
 await expect.poll(()=>page.evaluate(()=>window.__ghostPlusSupervisor.isLocked())).toBe(false);
 expect(await page.evaluate(()=>window.__hostClicks)).toBe(0);
 await expect(page.locator('#gitl9 .status')).toContainText('RUNNING');
});
test('operator gate remains persisted until Core confirms the resumed Send receipt',async({page})=>{
 await boot(page);
 await page.evaluate(()=>{
   window.__resumeClicks=0;
   document.querySelector('#composer-submit-button').addEventListener('click',()=>{
     window.__resumeClicks++;
     const text=document.querySelector('#prompt-textarea').textContent;
     setTimeout(()=>{
       const turn=document.createElement('article');
       turn.setAttribute('data-testid','conversation-turn-90');
       turn.setAttribute('aria-label','You said:');
       turn.textContent=text;
       document.querySelector('main').insertBefore(turn,document.querySelector('form'));
       document.querySelector('#prompt-textarea').textContent='';
     },500);
   });
   window.__ghostPlusSupervisor.lock('HUMAN_REQUIRED',{h:'explicit-human-marker',reason:'Human approved continuation'});
 });
 await page.locator('#ghostplus-gate [data-resume]').click();
 await page.waitForTimeout(120);
 expect(await page.evaluate(()=>window.__ghostPlusSupervisor.isLocked())).toBe(true);
 await expect.poll(()=>page.evaluate(()=>window.__ghostPlusSupervisor.isLocked()),{timeout:5000}).toBe(false);
 const state=await page.evaluate(()=>({
   clicks:window.__resumeClicks,
   text:document.querySelector('article[data-testid="conversation-turn-90"]')?.textContent||'',
   round:window.__lifecycleTest.state.round
 }));
 expect(state.clicks).toBe(1);
 expect(state.round).toBe(1);
 expect(state.text).toContain('[OPERATOR GATE RESOLVED]');
});

test('crash/reload while Send outcome is unknown never dispatches a second prompt',async({page})=>{
 await boot(page,{withGate:false});
 await page.evaluate(()=>{
   const button=document.querySelector('#composer-submit-button');
   button.addEventListener('click',()=>{
     const n=Number(sessionStorage.getItem('test-click-count')||'0')+1;
     sessionStorage.setItem('test-click-count',String(n));
     sessionStorage.setItem('test-wire',document.querySelector('#prompt-textarea').textContent||'');
   });
   document.querySelector('#prompt-textarea').textContent='Start a fresh operation';
 });
 await page.locator('#gitl9 [data-a="play"]').click();
 await expect.poll(()=>page.evaluate(()=>window.__ghostCoreSendJournal.hasUnresolved()),{timeout:5000}).toBe(true);
 expect(await page.evaluate(()=>sessionStorage.getItem('test-click-count'))).toBe('1');
 await page.reload();
 await page.addScriptTag({content:gm+'\n'+runtime+'\n'+core});
 await page.waitForFunction(()=>!!window.__lifecycleTest&&!!document.querySelector('#gitl9'));
 await page.evaluate(()=>{document.querySelector('#prompt-textarea').textContent='Attempt to start another operation';});
 await page.locator('#gitl9 [data-a="play"]').click();
 await expect.poll(()=>page.evaluate(()=>window.__lifecycleTest.state.mode),{timeout:4000}).toBe('PAUSED');
 expect(await page.evaluate(()=>({
   clicks:sessionStorage.getItem('test-click-count'),
   unknown:window.__lifecycleTest.state.uncertain,
   journal:window.__ghostCoreSendJournal.snapshot()?.stage,
   draft:document.querySelector('#prompt-textarea').textContent
 }))).toEqual({
   clicks:'1',unknown:true,journal:'ATTEMPTED',
   draft:'Attempt to start another operation'
 });
});


test('identical assistant text in a newer turn is not mistaken for the previous answer',async({page})=>{
 await boot(page,{withGate:false});
 const s=await page.evaluate(async()=>{
   const c=window.__lifecycleTest;
   const text=c.assistantText();
   c.state.mode='RUNNING';c.state.awaitingFrom=c.hash(text);c.state.awaitingAssistantCount=1;
   const turn=document.createElement('article');
   turn.setAttribute('data-testid','conversation-turn-77');
   turn.setAttribute('aria-label','ChatGPT said:');
   turn.innerHTML='<div class="markdown"></div>';
   turn.querySelector('.markdown').textContent=text;
   document.querySelector('main').insertBefore(turn,document.querySelector('form'));
   await c.tick();
   return {awaiting:c.state.awaitingFrom,detail:c.state.detail};
 });
 expect(s.awaiting).toBe('');
 expect(s.detail).not.toContain('Waiting for the next answer');
});

test('a new identical terminal marker is handled on a distinct assistant turn',async({page})=>{
 await boot(page,{withGate:false});
 const s=await page.evaluate(async()=>{
   const c=window.__lifecycleTest;
   c.state.mode='RUNNING';
   c.state.lastHandled=c.hash('[[GITL::HALT]]');
   c.state.lastHandledAssistantCount=1;
   document.querySelector('article[aria-label="ChatGPT said:"] .markdown').textContent='[[GITL::HALT]]';
   const t=document.createElement('article');
   t.setAttribute('data-testid','conversation-turn-99');
   t.setAttribute('aria-label','ChatGPT said:');
   t.innerHTML='<div class="markdown">[[GITL::HALT]]</div>';
   document.querySelector('main').insertBefore(t,document.querySelector('form'));
   await c.handleTerminal('[[GITL::HALT]]',{type:'halt'});
   return {mode:c.state.mode,detail:c.state.detail};
 });
 expect(s).toMatchObject({mode:'COMPLETE',detail:'Task complete'});
});

test('continuity lease and Turn Budget timestamps stay isolated across tabs',async({page})=>{
 await boot(page,{withGate:false,withBudget:true});
 const page2=await page.context().newPage();
 await boot(page2,{withGate:false,withBudget:true});
 await page.evaluate(()=>{
    window.__lifecycleTest.armContinuity();
    window.__ghostPlusTurnBudget.onSendConfirmed('[WEB TURN BUDGET]');
 });
 const read=async p=>p.evaluate(()=>({
    lease:[...Array(sessionStorage.length).keys()].map(i=>sessionStorage.key(i))
       .filter(k=>k.startsWith('ghostplus.continuityLeaseStartedAt.v2:'))
       .map(k=>Number(sessionStorage.getItem(k))).filter(Boolean),
    budget:[...Array(sessionStorage.length).keys()].map(i=>sessionStorage.key(i))
       .filter(k=>k.startsWith('ghostplus.turnStartedAt.v2:'))
       .map(k=>Number(sessionStorage.getItem(k))).filter(Boolean)
 }));
 const a=await read(page),b=await read(page2);
 expect(a.lease.length).toBe(1);
 expect(a.budget.length).toBe(1);
 expect(b.lease.length).toBe(0);
 expect(b.budget.length).toBe(0);
 await page2.close();
});


test('old assistant PROCEED marker cannot reconcile a newer uncertain Send without receipt',async({page})=>{
 await boot(page,{withGate:false});
 await page.evaluate(()=>{
   const c=window.__lifecycleTest;
   document.querySelector('article[aria-label="ChatGPT said:"] .markdown').textContent='Previous answer\\n[[GITL::PROCEED]]';
   c.state.mode='PAUSED';c.state.uncertain=true;c.state.detail='PLAY-SEND-UNCERTAIN';c.render();
   window.__controlClicks=0;
   for(const b of document.querySelectorAll('#gitl9 [data-a="stop"],#gitl9 [data-a="play"]')){
     b.addEventListener('click',()=>window.__controlClicks++);
   }
 });
 await page.addScriptTag({content:uncertain});
 await page.waitForTimeout(900);
 expect(await page.evaluate(()=>({
   clicks:window.__controlClicks,
   mode:window.__lifecycleTest.state.mode,
   uncertain:window.__lifecycleTest.state.uncertain
 }))).toEqual({clicks:0,mode:'PAUSED',uncertain:true});
});

test('Turn Budget cannot rewrite prompt after Core freezes the Send receipt',async({page})=>{
 await boot(page,{withGate:false,withBudget:true});
 await page.evaluate(()=>{
   window.__hostClicks=0;
   document.querySelector('#composer-submit-button').addEventListener('click',()=>{
     window.__hostClicks++;
     const editor=document.querySelector('#prompt-textarea');
     const turn=document.createElement('article');
     turn.setAttribute('data-testid','conversation-turn-99');
     turn.setAttribute('aria-label','You said:');
     turn.textContent=editor.textContent;
     document.querySelector('main').insertBefore(turn,document.querySelector('form'));
     editor.textContent='';editor.dispatchEvent(new Event('input',{bubbles:true}));
   });
   document.querySelector('#prompt-textarea').textContent='Continue current task';
 });
 await page.locator('#gitl9 [data-a="play"]').click();
 await expect.poll(()=>page.evaluate(()=>window.__lifecycleTest.state.round),{timeout:6000}).toBe(1);
 const s=await page.evaluate(()=>({
    clicks:window.__hostClicks,
    uncertain:window.__lifecycleTest.state.uncertain,
    wire:document.querySelector('article[data-testid="conversation-turn-99"]')?.textContent||''
 }));
 expect(s.clicks).toBe(1);
 expect(s.uncertain).toBe(false);
 expect(s.wire).toContain('[WEB TURN BUDGET]');
});
