const {test,expect}=require('@playwright/test');
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'../..');
const load=name=>fs.readFileSync(path.join(root,name),'utf8');
const core=load('ghost-in-the-loop.user.js').replace(/\/\/ ==UserScript==[\s\S]*?\/\/ ==\/UserScript==/m,'');
const runtime=load('ghost-plus-runtime-manager.js');
const i18n=load('ghost-plus-i18n-vi.js');
const alerts=load('ghost-plus-alert-router.js');
const watcher=load('ghost-plus-companion-v2.js');
const gate=load('ghost-plus-operator-gate.js');
const telegram=load('ghost-plus-telegram.js');
const turnBudget=load('ghost-plus-turn-budget-v2.js');
const viSafe=load('ghost-plus-ui-vi-safe.js');
const gm=`
window.__kv={};
window.GM_getValue=(k,v)=>Object.prototype.hasOwnProperty.call(window.__kv,k)?window.__kv[k]:v;
window.GM_setValue=(k,v)=>{window.__kv[k]=v;};
window.GM_setClipboard=()=>{};
window.__desktop=[];
window.GM_notification=(o)=>{window.__desktop.push(o)};
window.GM_xmlhttpRequest=()=>({abort(){}});
`;
const html=`<!doctype html><html><body><main>
<article data-testid="conversation-turn-1" aria-label="You said:"><div>Existing human request</div></article>
<form data-type="unified-composer" style="position:fixed;bottom:12px;left:18%;width:700px">
<div id="prompt-textarea" role="textbox" contenteditable="true" aria-label="Message ChatGPT" style="height:42px;width:450px;border:1px solid"></div>
<button id="composer-submit-button" data-testid="send-button" aria-label="Send prompt" type="button">↑</button>
</form></main></body></html>`;
async function boot(page){
  await page.route('https://chatgpt.com/**',route=>route.fulfill({status:200,contentType:'text/html',body:html}));
  await page.goto('https://chatgpt.com/c/i18n-fixture-20261107');
  await page.addScriptTag({content:[gm,runtime,i18n,alerts,core,watcher,gate,turnBudget,telegram,viSafe].join('\n')});
  await page.waitForFunction(()=>!!window.__ghostPlusI18n&&!!document.querySelector('#gitl9')&&!!document.querySelector('#ghostplus-watch'));
}
test('localized controls render natively, and machine status remains available separately',async({page})=>{
  await boot(page);
  const state=await page.locator('#gitl9 .status').evaluate(el=>({text:el.innerText,code:el.dataset.ghostCode}));
  expect(state.code).toBe('IDLE');
  expect(state.text).toContain('Đang nghỉ');
  expect(state.text).not.toMatch(/\bIDLE\b|\bround\b/);
  await expect(page.locator('#gitl9 [data-tab="play"]')).toHaveText('Chạy');
  await expect(page.locator('#gitl9 [data-a="play"]')).toContainText('Chạy');
  await expect(page.locator('#gitl9 [data-a="stop"]')).toContainText('Dừng Ghost');
  await expect(page.locator('#gitl9 [data-a="report"]')).toContainText('Sao chép báo cáo chẩn đoán');
  const css=await page.locator('#ghost-plus-vi-safe-style').textContent();
  expect(css).not.toMatch(/font-size:\s*0\s*!important|::after\s*\{\s*content:/);
  await page.locator('#gitl9 [data-a="play"]').click();
  await expect(page.locator('#gitl9 .status')).toContainText('Đang chạy');
  expect(await page.locator('#gitl9 .status').getAttribute('data-ghost-code')).toBe('RUNNING');
});
test('event types, severity and dedupe remain machine-stable while alerts are Vietnamese',async({page})=>{
  await boot(page);
  const data=await page.evaluate(()=>{
    const e=window.__ghostPlusAlerts.emit({
      id:'translation-check',type:'HUMAN_REQUIRED',group:'operator',severity:'critical',
      title:'Ghost+ · HUMAN REQUIRED',
      text:'HUMAN REQUIRED · HUM-ABC1-001',reason:'Job stopped by operator.',
      desktop:false
    });
    const again=window.__ghostPlusAlerts.emit({
      id:'translation-check-2',type:'HUMAN_REQUIRED',group:'operator',severity:'critical',
      title:'Ghost+ · HUMAN REQUIRED',
      text:'HUMAN REQUIRED · HUM-ABC1-001',reason:'Job stopped by operator.',
      desktop:false
    });
    return {first:e,second:again};
  });
  expect(data.first.type).toBe('HUMAN_REQUIRED');
  expect(data.first.severity).toBe('critical');
  expect(data.first.title).toBe('Ghost+ · Cần người dùng xử lý');
  expect(data.first.reason).toBe('Người dùng đã dừng Ghost.');
  expect(data.second.suppressed).toBe(true);
});
test('operator gate and Telegram settings show Vietnamese, without changing gate identity',async({page})=>{
  await boot(page);
  await page.evaluate(()=>window.__ghostPlusSupervisor.lock('HUMAN_REQUIRED',{
    source:'manual-review',reason:'Current chat composer was not found.'
  }));
  const g=page.locator('#ghostplus-gate');
  await expect(g).toBeVisible();
  await expect(g.locator('[data-t]')).toContainText('Cần người dùng xử lý');
  await expect(g.locator('[data-resume]')).toHaveText('Tiếp tục');
  await expect(page.locator('#gitl9 .status')).toContainText('Đã tạm dừng');
  expect(await page.locator('#gitl9 .status').getAttribute('data-ghost-code')).toBe('PAUSED');
  const t=page.locator('#ghostplus-telegram');
  await t.locator('summary').click();
  await expect(t.locator('[data-save]')).toContainText('Lưu');
  await expect(t.locator('[data-bind]')).toContainText('Liên kết nhóm');
  await expect(t.locator('[data-reason]')).toHaveCount(1);
  expect(await page.evaluate(()=>window.__ghostPlusSupervisor.isLocked())).toBe(true);
});

test('Vietnamese control labels remain usable on a narrow viewport',async({page})=>{
  await page.setViewportSize({width:390,height:780});
  await boot(page);
  const playButtons=await page.locator('#gitl9 [data-a="play"],#gitl9 [data-a="stop"]').evaluateAll(nodes=>
    nodes.map(el=>({text:el.textContent.trim(),rect:el.getBoundingClientRect().toJSON()})));
  await page.locator('#gitl9 [data-tab="export"]').click();
  const reportButton=await page.locator('#gitl9 [data-a="report"]').evaluate(el=>({text:el.textContent.trim(),rect:el.getBoundingClientRect().toJSON()}));
  const buttons=[...playButtons,reportButton];
  const width=await page.evaluate(()=>innerWidth);
  for(const item of buttons){
    expect(item.rect.width).toBeGreaterThan(25);
    expect(item.rect.left).toBeGreaterThanOrEqual(-1);
    expect(item.rect.right).toBeLessThanOrEqual(width+2);
  }
  const style=await page.locator('#ghost-plus-vi-safe-style').textContent();
  expect(style).toContain('overflow-wrap:anywhere');
});
