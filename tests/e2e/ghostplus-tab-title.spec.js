const {test,expect}=require('@playwright/test');
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'../..');
const runtime=fs.readFileSync(path.join(root,'ghost-plus-runtime-manager.js'),'utf8');
const operator=fs.readFileSync(path.join(root,'ghost-plus-operator-gate.js'),'utf8');
const gm=`
window.__store={};
window.GM_getValue=(key,def)=>Object.prototype.hasOwnProperty.call(window.__store,key)?window.__store[key]:def;
window.GM_setValue=(key,value)=>{window.__store[key]=value};
window.GM_notification=()=>{};
`;
async function fixture(page,{title='Research task',sidebar='Research task'}={}){
  const html=`<!doctype html><html><head><title>${title}</title></head><body>
    <nav><a id="current-chat" href="/c/tabtitle-case">${sidebar}</a></nav>
    <main><form><div id="prompt-textarea" contenteditable="true"></div></form></main>
    <div id="ghostplus-watch"></div></body></html>`;
  await page.route('https://chatgpt.com/**',route=>route.fulfill({status:200,contentType:'text/html',body:html}));
  await page.goto('https://chatgpt.com/c/tabtitle-case');
  await page.addScriptTag({content:gm+'\n'+runtime+'\n'+operator});
  await page.waitForFunction(()=>!!window.__ghostPlusSupervisor);
}
async function lock(page,type='HUMAN_REQUIRED'){
  await page.evaluate(type=>window.__ghostPlusSupervisor.lock(type,{reason:'Human input required'}),type);
}
test.describe('Ghost+ task-preserving single tab badge',()=>{
  test('repeated legacy HUMAN prefixes collapse to one red dot and retain the task title',async({page})=>{
    await fixture(page,{title:'🔴 HUMAN · 🔴 HUMAN · Copy trade research',sidebar:'Copy trade research'});
    await lock(page);
    await expect.poll(()=>page.title()).toBe('🔴 Copy trade research');
    await page.waitForTimeout(1600);
    expect(await page.title()).toBe('🔴 Copy trade research');
  });
  test('sidebar restores the task when old title contains only repeated HUMAN badges',async({page})=>{
    await fixture(page,{title:'🔴 HUMAN · 🔴 HUMAN',sidebar:'Top Down'});
    await lock(page);
    await expect.poll(()=>page.title()).toBe('🔴 Top Down');
  });
  test('react changes title and the user renames the task while HUMAN remains locked',async({page})=>{
    await fixture(page,{title:'Second Brain',sidebar:'Second Brain'});
    await lock(page);
    await page.evaluate(()=>document.title='🔴 HUMAN · 🔴 HUMAN · Second Brain');
    await expect.poll(()=>page.title()).toBe('🔴 Second Brain');
    await page.evaluate(()=>{
      document.querySelector('#current-chat').textContent='Second Brain Knowledge Graph';
      document.title='Second Brain Knowledge Graph';
    });
    await expect.poll(()=>page.title()).toBe('🔴 Second Brain Knowledge Graph');
  });
  test('route switch drops old badge without leaking old task name',async({page})=>{
    await fixture(page,{title:'Copy trading',sidebar:'Copy trading'});
    await lock(page);
    await page.evaluate(()=>{
      history.pushState({},'','/c/another-conversation');
      document.title='EA Reverse';
      const a=document.querySelector('#current-chat');
      a.setAttribute('href','/c/another-conversation');
      a.textContent='EA Reverse';
    });
    await expect.poll(()=>page.title()).toBe('EA Reverse');
    await page.waitForTimeout(900);
    expect(await page.title()).toBe('EA Reverse');
  });
  test('destroy clears the badge and preserves the task title',async({page})=>{
    await fixture(page,{title:'Telegram channel audit',sidebar:'Telegram channel audit'});
    await lock(page);
    await expect.poll(()=>page.title()).toBe('🔴 Telegram channel audit');
    await page.evaluate(()=>window.__ghostPlusRuntime.destroy('manual-unload'));
    await expect.poll(()=>page.title()).toBe('Telegram channel audit');
  });
  test('relay uses one orange dot without the RELAY label',async({page})=>{
    await fixture(page,{title:'EA Reverse',sidebar:'EA Reverse'});
    await lock(page,'MODEL_RELAY');
    await expect.poll(()=>page.title()).toBe('🟠 EA Reverse');
  });
});