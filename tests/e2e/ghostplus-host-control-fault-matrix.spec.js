// @ts-check
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const RUNTIME = fs.readFileSync(path.join(ROOT, 'ghost-plus-runtime-manager.js'), 'utf8');
const CORE = fs.readFileSync(path.join(ROOT, 'ghost-in-the-loop.user.js'), 'utf8')
  .replace(/\/\/ ==UserScript==[\s\S]*?\/\/ ==\/UserScript==/m, '')
  .replace('const CHATGPT_SEND_CONFIRM_MS = 45000;', 'const CHATGPT_SEND_CONFIRM_MS = 2500;');

const GM = `
window.__gmStore = {};
window.GM_getValue = (k, d) => Object.prototype.hasOwnProperty.call(window.__gmStore, k) ? window.__gmStore[k] : d;
window.GM_setValue = (k, v) => { window.__gmStore[k] = v; };
window.GM_setClipboard = () => {};
window.GM_notification = () => {};
window.GM_xmlhttpRequest = () => {};
`;

function html(body) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body{font:14px system-ui;margin:0;min-height:900px}
    main{padding:24px}
    form[data-type="unified-composer"]{position:fixed;left:20%;right:20%;bottom:20px;display:flex;gap:8px;align-items:end}
    #prompt-textarea{min-height:48px;flex:1;border:1px solid #999;padding:8px}
    button{min-width:36px;min-height:36px}
  </style></head><body><main>${body}</main></body></html>`;
}

const composer = (action, draft='') => `
<form data-type="unified-composer">
  <div id="prompt-textarea" role="textbox" contenteditable="true" aria-label="Message ChatGPT">${draft}</div>
  ${action}
</form>`;

async function openFixture(page, body, { core=false } = {}) {
  await page.route('https://chatgpt.com/**', route => route.fulfill({
    status: 200,
    contentType: 'text/html; charset=utf-8',
    body: html(body)
  }));
  await page.goto('https://chatgpt.com/c/ghostplus-fault-matrix');
  await page.addScriptTag({ content: GM + '\n' + RUNTIME + (core ? '\n' + CORE : '') });
  await page.waitForFunction(() => !!window.__ghostPlusRuntime);
  if (core) await expect(page.locator('#gitl9')).toBeVisible({ timeout: 5000 });
}

async function host(page) {
  return page.evaluate(() => {
    const rt = window.__ghostPlusRuntime;
    const state = rt.dom.chatgptHostControlState();
    const fault = rt.dom.chatgptFaultState();
    const activity = rt.dom.chatgptActivityState();
    return {
      mode: state.mode,
      busy: state.busy,
      ready: state.ready,
      why: state.why,
      faultType: state.faultType || fault.type || '',
      generating: rt.dom.isChatgptGenerating(),
      activityBusy: activity.busy,
      activityStrong: activity.strong,
      activityReason: activity.reason
    };
  });
}

test.describe('Ghost+ authoritative ChatGPT host-control fault matrix', () => {
  test('modern agent-turn-start completed output exits WAITING without sending another user turn',async({page})=>{
    await openFixture(page,
      '<div data-turn-key="modern-c">'+
      '<div data-user-message-bubble>Continue existing job</div>'+
      '<section data-chatgpt-agent-turn-start>'+
      '<div class="markdown">Report finalized.</div>'+
      '<div class="markdown">[[GITL::HALT]]</div>'+
      '</section></div>'+
      composer('<button aria-label="Start voice mode">voice</button>'),
      {core:true}
    );
    await page.evaluate(()=>{
      window.__voiceClicks=0;
      document.querySelector('form button').addEventListener('click',()=>window.__voiceClicks++);
    });
    await page.locator('#gitl9 [data-a="play"]').click();
    await expect(page.locator('#gitl9 .status')).toContainText('COMPLETE',{timeout:5500});
    expect(await page.evaluate(()=>window.__voiceClicks)).toBe(0);
  });

  test('Stop plus cleared composer cannot falsely confirm a Ghost Send without matching user receipt',async({page})=>{
    await openFixture(page,composer(
      '<button id="composer-submit-button" type="button" data-testid="send-button" aria-label="Send prompt">↑</button>',
      'Continue the verified job'
    ),{core:true});
    await page.evaluate(()=>{
      window.__attemptClicks=0;
      const button=document.getElementById('composer-submit-button');
      button.addEventListener('click',()=>{
        window.__attemptClicks++;
        document.getElementById('prompt-textarea').textContent='';
        button.setAttribute('data-testid','stop-button');
        button.setAttribute('aria-label','Stop streaming');
        button.textContent='■';
      });
    });
    await page.locator('#gitl9 [data-a="play"]').click();
    await expect.poll(()=>page.evaluate(()=>window.__attemptClicks)).toBe(1);
    await expect(page.locator('#gitl9 .status')).toContainText('PLAY-SEND-UNCERTAIN',{timeout:7000});
    expect(await page.evaluate(()=>window.__attemptClicks)).toBe(1);
    expect(await page.locator('article[aria-label^="You said"]').count()).toBe(0);
  });

  test('explicit Stop is authoritative and Play adopts without a host Send', async ({ page }) => {
    await openFixture(page, composer(
      '<button id="composer-submit-button" data-testid="stop-button" aria-label="Stop streaming" type="button">■</button>'
    ), { core:true });
    await page.evaluate(() => {
      window.__host = { clicks:0 };
      document.getElementById('composer-submit-button').addEventListener('click', () => window.__host.clicks++);
    });

    expect(await host(page)).toMatchObject({ mode:'stop', busy:true, generating:true });
    await page.locator('#gitl9 [data-a="play"]').click();
    await expect(page.locator('#gitl9 .status')).toContainText('RUNNING');
    expect(await page.evaluate(() => window.__host.clicks)).toBe(0);
  });


  test('real Stop rendered as a sibling outside the composer form is adopted without a new send',async({page})=>{
    await openFixture(page,
      '<article data-testid="conversation-turn-1" aria-label="You said:">tiếp đi</article>'+
      '<section class="composer-shell" style="position:fixed;left:20%;right:20%;bottom:20px">'+
      '<form data-type="unified-composer" style="position:static;width:100%">'+
      '<div id="prompt-textarea" role="textbox" contenteditable="true" aria-label="Message ChatGPT"></div>'+
      '</form>'+
      '<button id="outside-stop" aria-label="Stop streaming" style="position:absolute;right:8px;bottom:8px">■</button>'+
      '</section>',
      {core:true}
    );
    expect(await host(page)).toMatchObject({mode:'stop',busy:true});
    await page.evaluate(()=>{
      window.__stopClicked=0;
      document.getElementById('outside-stop').addEventListener('click',()=>window.__stopClicked++);
    });
    await page.locator('#gitl9 [data-a="play"]').click();
    await expect(page.locator('#gitl9 .status')).toContainText('RUNNING');
    await expect(page.locator('#gitl9 .status')).toContainText('Model working...');
    expect(await page.evaluate(()=>window.__stopClicked)).toBe(0);
  });

  test('SVG square Stop rendered beside the composer but without labels is still BUSY',async({page})=>{
    await openFixture(page,
      '<section class="composer-shell" style="position:fixed;left:20%;right:20%;bottom:20px">'+
      '<form data-type="unified-composer" style="position:static;width:100%">'+
      '<div id="prompt-textarea" role="textbox" contenteditable="true" aria-label="Message ChatGPT"></div>'+
      '</form>'+
      '<button id="outside-glyph" style="position:absolute;right:8px;bottom:8px">'+
      '<svg viewBox="0 0 24 24" width="20" height="20"><rect x="7" y="7" width="10" height="10"/></svg></button>'+
      '</section>'
    );
    expect(await host(page)).toMatchObject({mode:'stop',busy:true});
  });


  test('an outside-form composer Send control is eligible for the one-shot send path',async({page})=>{
    await openFixture(page,
      '<section class="composer-shell" style="position:fixed;left:20%;right:20%;bottom:20px">'+
      '<form data-type="unified-composer" style="position:static;width:100%">'+
      '<div id="prompt-textarea" role="textbox" contenteditable="true" aria-label="Message ChatGPT">do the next step</div>'+
      '</form>'+
      '<button id="outside-send" data-testid="send-button" aria-label="Send prompt" style="position:absolute;right:8px;bottom:8px">↑</button>'+
      '</section>',
      {core:true}
    );
    expect(await host(page)).toMatchObject({mode:'send',busy:false,ready:true});
    await page.evaluate(()=>{
      window.__sendClicked=0;
      document.getElementById('outside-send').addEventListener('click',()=>{
        window.__sendClicked++;
        const article=document.createElement('article');
        article.setAttribute('data-testid','conversation-turn-user-'+window.__sendClicked);
        article.setAttribute('aria-label','You said:');
        article.textContent=document.getElementById('prompt-textarea').textContent||'sent';
        document.querySelector('main').prepend(article);
        const btn=document.getElementById('outside-send');
        btn.setAttribute('data-testid','stop-button');
        btn.setAttribute('aria-label','Stop streaming');
        btn.textContent='■';
      });
    });
    await page.locator('#gitl9 [data-a="play"]').click();
    await expect.poll(()=>page.evaluate(()=>window.__sendClicked)).toBe(1);
    await page.waitForTimeout(350);
    expect(await page.evaluate(()=>window.__sendClicked)).toBe(1);
  });

  test('existing user turn with no assistant and no Stop arms monitoring, never resends',async({page})=>{
    await openFixture(page,
      '<article data-testid="conversation-turn-1" aria-label="You said:">tiếp đi</article>'+
      composer('<button aria-label="Start voice mode">voice</button>'),
      {core:true}
    );
    await page.evaluate(()=>{window.__clicks=0;document.querySelector('form button').addEventListener('click',()=>window.__clicks++);});
    await page.locator('#gitl9 [data-a="play"]').click();
    await expect(page.locator('#gitl9 .status')).toContainText('RUNNING');
    await expect(page.locator('#gitl9 .status')).toContainText('Waiting for assistant output');
    expect(await page.evaluate(()=>window.__clicks)).toBe(0);
  });


  test('an existing routed chat whose turns are virtualized arms monitoring without fabricating a Send',async({page})=>{
    await openFixture(page,composer('<button aria-label="Start voice mode">voice</button>'),{core:true});
    await page.evaluate(()=>{
      window.__voiceClicks=0;
      document.querySelector('form button').addEventListener('click',()=>window.__voiceClicks++);
    });
    await page.locator('#gitl9 [data-a="play"]').click();
    await expect(page.locator('#gitl9 .status')).toContainText('RUNNING');
    await expect(page.locator('#gitl9 .status')).toContainText('Waiting for assistant output');
    expect(await page.evaluate(()=>window.__voiceClicks)).toBe(0);
  });

  test('an unrelated Stop button elsewhere in the page cannot impersonate ChatGPT composer Stop',async({page})=>{
    await openFixture(page,
      '<button aria-label="Stop streaming" style="position:absolute;left:40px;top:40px">Stop</button>'+
      composer('<button aria-label="Start voice mode">voice</button>')
    );
    expect(await host(page)).toMatchObject({mode:'idle',busy:false,ready:false});
  });


  test('already completed multi-block answer is processed instead of Waiting for assistant output',async({page})=>{
    await openFixture(page,
      '<article data-testid="conversation-turn-1" aria-label="You said:">continue research</article>'+
      '<article data-testid="conversation-turn-2" aria-label="ChatGPT said:">'+
      '<div class="markdown"><h3>Trader results</h3><table><tr><td>Stable Growth</td><td>20%</td></tr></table></div>'+
      '<div class="markdown">Research saved on GitHub.</div>'+
      '<div class="markdown">[[GITL::HALT]]</div></article>'+
      composer('<button aria-label="Start voice mode">voice</button>'),
      {core:true}
    );
    await page.evaluate(()=>{
      window.__voiceClicks=0;
      document.querySelector('form button').addEventListener('click',()=>window.__voiceClicks++);
    });
    await page.locator('#gitl9 [data-a="play"]').click();
    await expect(page.locator('#gitl9 .status')).toContainText('COMPLETE',{timeout:5000});
    expect(await page.evaluate(()=>window.__voiceClicks)).toBe(0);
  });

  test('assistant appearing after Play under a different author wrapper is detected and completes',async({page})=>{
    await openFixture(page,
      '<article data-testid="conversation-turn-1" aria-label="You said:">continue task</article>'+
      composer('<button aria-label="Start voice mode">voice</button>'),{core:true}
    );
    await page.locator('#gitl9 [data-a="play"]').click();
    await expect(page.locator('#gitl9 .status')).toContainText('Waiting for assistant output');
    await page.evaluate(()=>{
      const answer=document.createElement('section');
      answer.setAttribute('data-message-author-role','assistant');
      answer.innerHTML='<div class="markdown">Results saved.</div><div class="markdown">[[GITL::HALT]]</div>';
      document.querySelector('main').insertBefore(answer,document.querySelector('form'));
    });
    await expect(page.locator('#gitl9 .status')).toContainText('COMPLETE',{timeout:5500});
  });

  test('a visible assistant answer without a marker is monitored first, not immediately re-sent',async({page})=>{
    await openFixture(page,
      '<article data-testid="conversation-turn-1" aria-label="You said:">continue task</article>'+
      '<article data-testid="conversation-turn-2">'+
      '<div class="markdown">The report is already saved.</div>'+
      '<button aria-label="Copy" data-testid="copy-turn-action-button">Copy</button></article>'+
      composer('<button aria-label="Start voice mode">voice</button>'),{core:true}
    );
    await page.evaluate(()=>{window.__voiceClicks=0;document.querySelector('form button').addEventListener('click',()=>window.__voiceClicks++);});
    await page.locator('#gitl9 [data-a="play"]').click();
    await expect(page.locator('#gitl9 .status')).toContainText('Output quiet',{timeout:4000});
    expect(await page.evaluate(()=>window.__voiceClicks)).toBe(0);
  });

  test('ready Send with a staged user task dispatches once and only once', async ({ page }) => {
    await openFixture(page, composer(
      '<button id="composer-submit-button" data-testid="send-button" aria-label="Send prompt" type="button">↑</button>',
      'finish the current task'
    ), { core:true });
    await page.evaluate(() => {
      window.__host = { clicks:0 };
      const button = document.getElementById('composer-submit-button');
      button.addEventListener('click', () => {
        window.__host.clicks++;
        const article = document.createElement('article');
        article.setAttribute('data-testid', 'conversation-turn-user-' + window.__host.clicks);
        article.setAttribute('aria-label', 'You said:');
        article.textContent = document.getElementById('prompt-textarea').textContent || 'sent';
        document.querySelector('main').prepend(article);
        button.setAttribute('data-testid', 'stop-button');
        button.setAttribute('aria-label', 'Stop streaming');
        button.textContent = '■';
      });
    });

    expect(await host(page)).toMatchObject({ mode:'send', busy:false, ready:true, generating:false });
    await page.locator('#gitl9 [data-a="play"]').click();
    await expect.poll(() => page.evaluate(() => window.__host.clicks)).toBe(1);
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => window.__host.clicks)).toBe(1);
  });

  test('Resume stream unavailable + stale Resuming + voice-only composer is fault-idle, never fake BUSY', async ({ page }) => {
    await openFixture(page,
      '<div data-stream-error>Resume stream unavailable</div>' +
      '<div role="status">Resuming...</div>' +
      composer('<button aria-label="Start voice mode" type="button">voice</button>'),
      { core:true }
    );

    expect(await host(page)).toMatchObject({
      mode:'idle',
      busy:false,
      ready:false,
      faultType:'STREAM_RESUME_UNAVAILABLE',
      generating:false,
      activityBusy:false
    });

    await page.locator('#gitl9 [data-a="play"]').click();
    await expect(page.locator('#gitl9 .status')).toContainText('PAUSED');
    await expect(page.locator('#gitl9 .status')).toContainText('STREAM_RESUME_UNAVAILABLE');
  });

  test('RUNNING Ghost releases stale Model-working state when Stop becomes Resume stream unavailable', async ({ page }) => {
    await openFixture(page, composer(
      '<button id="composer-submit-button" data-testid="stop-button" aria-label="Stop streaming" type="button">■</button>'
    ), { core:true });

    await page.locator('#gitl9 [data-a="play"]').click();
    await expect(page.locator('#gitl9 .status')).toContainText('RUNNING');

    await page.evaluate(() => {
      const main=document.querySelector('main');
      const error=document.createElement('div');
      error.setAttribute('data-stream-error','');
      error.textContent='Resume stream unavailable';
      main.prepend(error);
      const stale=document.createElement('div');
      stale.setAttribute('role','status');
      stale.textContent='Resuming...';
      main.prepend(stale);
      const button=document.getElementById('composer-submit-button');
      button.removeAttribute('id');
      button.removeAttribute('data-testid');
      button.setAttribute('aria-label','Start voice mode');
      button.textContent='voice';
    });

    await expect.poll(async () => (await host(page)).mode).toBe('idle');
    await expect.poll(async () => (await host(page)).generating).toBe(false);
    await expect(page.locator('#gitl9 .status')).not.toContainText('Model working...', { timeout: 2500 });
    await expect(page.locator('#gitl9 .status')).toContainText('Waiting for assistant output', { timeout: 2500 });
  });

  test('a real Stop still wins even when Resume stream unavailable remains visible', async ({ page }) => {
    await openFixture(page,
      '<div data-stream-error>Resume stream unavailable</div>' +
      composer('<button id="composer-submit-button" data-testid="stop-button" aria-label="Stop streaming" type="button">■</button>')
    );
    expect(await host(page)).toMatchObject({ mode:'stop', busy:true, generating:true });
  });

  test('message delivery timeout suppresses stale weak status but does not invent Send readiness', async ({ page }) => {
    await openFixture(page,
      '<div role="alert">Message delivery timed out. Please try again.</div>' +
      '<div role="status">Processing...</div>' +
      composer('<button aria-label="Start voice mode" type="button">voice</button>')
    );
    expect(await host(page)).toMatchObject({
      mode:'idle',
      busy:false,
      ready:false,
      faultType:'MESSAGE_DELIVERY_TIMEOUT',
      generating:false
    });
  });

  test('fault banner cannot override an explicit Stop during a Send-to-Stop race', async ({ page }) => {
    await openFixture(page,
      '<div data-stream-error>Resume stream unavailable</div>' +
      composer('<button id="composer-submit-button" data-testid="send-button" aria-label="Send prompt" type="button" disabled>↑</button>', 'recovery probe')
    );

    const result = await page.evaluate(async () => {
      const rt = window.__ghostPlusRuntime;
      const scope = rt.module('browser-race');
      const button = document.getElementById('composer-submit-button');
      setTimeout(() => {
        button.disabled = false;
        button.setAttribute('data-testid','stop-button');
        button.setAttribute('aria-label','Stop streaming');
        button.textContent='■';
      }, 150);
      return await rt.dom.waitChatgptSendReady(scope,{expectedText:'recovery probe',timeoutMs:1200});
    });
    expect(result).toMatchObject({ ok:false, mode:'stop', busy:true });
  });

  test('empty voice-only composer is recognized as resting idle', async ({ page }) => {
    await openFixture(page, composer('<button aria-label="Start voice mode" type="button">voice</button>'));
    expect(await host(page)).toMatchObject({ mode:'idle', busy:false, ready:false, generating:false, why:'resting-composer-control' });
  });

  test('page-global stale Đang tải status cannot hold an idle voice composer BUSY', async ({ page }) => {
    await openFixture(page,
      '<div role="status">Đang tải tin nhắn cũ...</div>' +
      '<article data-testid="conversation-turn-2" aria-label="ChatGPT said:"><div class="markdown">Done.</div></article>' +
      composer('<button aria-label="Start voice mode" type="button">voice</button>'),
      { core:true }
    );
    expect(await host(page)).toMatchObject({mode:'idle',busy:false,ready:false,generating:false,why:'resting-composer-control'});
    await page.locator('#gitl9 [data-a="play"]').click();
    await expect(page.locator('#gitl9 .status')).not.toContainText('Model working...', {timeout:2500});
  });

  test('scoped weak loading status expires without Stop corroboration', async ({ page }) => {
    await openFixture(page,
      '<article data-testid="conversation-turn-2" aria-label="ChatGPT said:"><div role="status">Đang tải dữ liệu...</div></article>' +
      composer('<button aria-label="Start voice mode" type="button">voice</button>')
    );
    const first=await host(page);
    expect(first).toMatchObject({mode:'busy',busy:true,generating:true});
    await page.evaluate(() => {
      const real=Date.now;
      window.__ghostRealDateNow=real;
      const base=real();
      Date.now=()=>base+12001;
    });
    const expired=await host(page);
    expect(expired).toMatchObject({mode:'idle',busy:false,generating:false,why:'resting-composer-control'});
  });

  test('RUNNING Ghost releases Model-working when Stop disappears but stale global Đang tải remains', async ({ page }) => {
    await openFixture(page,
      '<article data-testid="conversation-turn-2" aria-label="ChatGPT said:"><div class="markdown">Work in progress.</div></article>' +
      composer('<button id="composer-submit-button" data-testid="stop-button" aria-label="Stop streaming" type="button">■</button>'),
      {core:true}
    );
    await page.locator('#gitl9 [data-a="play"]').click();
    await expect(page.locator('#gitl9 .status')).toContainText('RUNNING');
    await expect(page.locator('#gitl9 .status')).toContainText('Model working...');

    await page.evaluate(()=>{
      const main=document.querySelector('main');
      const stale=document.createElement('div');
      stale.setAttribute('role','status');
      stale.textContent='Đang tải tin nhắn cũ...';
      main.prepend(stale);
      const button=document.getElementById('composer-submit-button');
      button.removeAttribute('id');
      button.removeAttribute('data-testid');
      button.setAttribute('aria-label','Start voice mode');
      button.textContent='voice';
    });

    await expect.poll(async()=> (await host(page)).mode).toBe('idle');
    await expect.poll(async()=> (await host(page)).generating).toBe(false);
    await expect(page.locator('#gitl9 .status')).not.toContainText('Model working...', {timeout:2500});
  });

  test('ready Send is authoritative over unrelated global loading leftovers', async ({ page }) => {
    await openFixture(page,
      '<div role="status">Đang tải tin nhắn cũ...</div>' +
      composer('<button id="composer-submit-button" data-testid="send-button" aria-label="Send prompt" type="button">↑</button>','continue')
    );
    expect(await host(page)).toMatchObject({mode:'send',busy:false,ready:true,generating:false});
  });

  test('exact managed-draft cleanup preserves unrelated user text', async ({ page }) => {
    await openFixture(page, composer(
      '<button id="composer-submit-button" data-testid="stop-button" aria-label="Stop streaming" type="button">■</button>',
      'my manual draft'
    ));
    const result = await page.evaluate(async () => {
      const rt=window.__ghostPlusRuntime, scope=rt.module('browser-clear');
      const wrong=await rt.dom.clearComposerIfExact('ghost recovery probe',scope,{verifyMs:400});
      const afterWrong=rt.dom.readComposer();
      const exact=await rt.dom.clearComposerIfExact('my manual draft',scope,{verifyMs:700});
      return {wrong,afterWrong,exact,afterExact:rt.dom.readComposer()};
    });
    expect(result.wrong).toMatchObject({ok:false,why:'composer-changed'});
    expect(result.afterWrong).toBe('my manual draft');
    expect(result.exact).toMatchObject({ok:true});
    expect(result.afterExact).toBe('');
  });
});
test('Ghost runtime and core refuse to initialize on a mocked non-ChatGPT host',async({page})=>{
  await page.route('https://gemini.google.com/**',route=>route.fulfill({
    status:200,contentType:'text/html',
    body:html(composer('<button id="composer-submit-button" data-testid="send-button" aria-label="Send prompt">↑</button>','a task'))
  }));
  await page.goto('https://gemini.google.com/app');
  await page.addScriptTag({content:GM+'\n'+RUNTIME+'\n'+CORE});
  const state=await page.evaluate(()=>({
    runtime:!!window.__ghostPlusRuntime,
    panel:!!document.getElementById('gitl9'),
    core:window.__GITL_V9__===true
  }));
  expect(state).toEqual({runtime:false,panel:false,core:false});
});